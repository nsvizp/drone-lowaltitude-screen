import { Injectable, OnModuleInit } from '@nestjs/common'
import {
  buildReinforcement,
  createDisasterEvent,
  DELIVERY_TEAM_SIZE,
  DISASTER_NAME,
  isSurveyDroneDispatchable,
  pickShelters,
  planFloodDispatch,
  SURVEY_MIN_BATTERY,
  SURVEY_TEAM_SIZE,
  type DisasterKind,
  type DispatchPlan,
  type FloodEvent,
  type FlyerInfo,
  type ShelterInfo,
} from '../../../shared/sim/disaster'
import type { AiDecisionResult, AiDecisionStatus, EmergencyDecisionContext } from '../../../shared/sim/ai-decision'
import {
  assessSituation,
  detectSupplyDrops,
  evaluateReinforcement,
  initSituation,
  recordDelivery,
  summarizeSituation,
  type ReinforcementEval,
  type SituationState,
  type SituationSummary,
} from '../../../shared/sim/situation'
import { distanceMeters, EMERGENCY_SPEED, mulberry32, type FleetState } from '../../../shared/sim/drone-sim'
import { createEmergencyData } from '../../../shared/sim/emergency-data'
import { latchReinforceEval } from '../../../shared/sim/eval-latch'
import { PrismaService } from '../prisma.service'
import { EventBus } from './event-bus'
import { EventLogService } from './event-log.service'
import { FleetService } from './fleet.service'
import { AiDecisionService } from './ai-decision.service'

/** 洪灾演练区域（市区核心，保证应急响应在 1~2 分钟内到场） */
const FLOOD_AREA = { minLng: 121.42, maxLng: 121.62, minLat: 31.16, maxLat: 31.26 }
const PACKS_PER_SORTIE = 200
const ASSESS_INTERVAL_TICKS = 6
const SEVERITY_TEXT: Record<number, string> = { 1: 'Ⅰ 级', 2: 'Ⅱ 级', 3: 'Ⅲ 级' }

/** 方舱与飞手名册（与 ledger 种子一致；后续改读库） */
const SHELTERS: ShelterInfo[] = [
  { id: 4001, name: '1号方舱', position: [121.499, 31.241], spareDrones: 2 },
  { id: 4002, name: '2号方舱', position: [121.445, 31.189], spareDrones: 2 },
  { id: 4003, name: '3号方舱', position: [121.595, 31.205], spareDrones: 2 },
  { id: 4004, name: '4号方舱', position: [121.333, 31.2], spareDrones: 1 },
]
const FLYERS: FlyerInfo[] = [
  { id: 3001, name: '张三', lastMission: '2026-05-13 07:50', status: 'available' },
  { id: 3002, name: '李四', lastMission: '2026-05-13 15:40', status: 'available' },
  { id: 3003, name: '王五', lastMission: '2026-05-12 20:10', status: 'available' },
  { id: 3004, name: '赵六', lastMission: '2026-05-12 11:25', status: 'offline' },
]

export interface DisasterSnapshot {
  flood: FloodEvent | null
  plan: DispatchPlan | null
  pendingPlan: DispatchPlan | null
  situation: SituationState | null
  summary: SituationSummary | null
  eval: ReinforcementEval | null
  reinforced: boolean
  aiStatus: AiDecisionStatus
  aiDecision: AiDecisionResult | null
  /** 兼容大屏展示：ai 表示模型生成说明，algorithm 表示规则兜底。 */
  planSource: 'ai' | 'algorithm' | null
  aiReasoning: string | null
}

/** 权威灾情编排：灾点生成 → 调配 → 现场态势 → 空投登记 → 增援评估 */
@Injectable()
export class DisasterService implements OnModuleInit {
  private flood: FloodEvent | null = null
  private disasterId: number | null = null
  private plan: DispatchPlan | null = null
  private pendingPlan: DispatchPlan | null = null
  private situation: SituationState | null = null
  private summary: SituationSummary | null = null
  private evalResult: ReinforcementEval | null = null
  private reinforced = false
  private aiStatus: AiDecisionStatus = 'idle'
  private aiDecision: AiDecisionResult | null = null
  private prevLegs = new Map<string, number>()
  private readonly recordedDrops = new Set<string>()
  private surveyArrivedAnnounced = false
  private lastBroadcast = ''

  constructor(
    private readonly fleet: FleetService,
    private readonly log: EventLogService,
    private readonly bus: EventBus,
    private readonly prisma: PrismaService,
    private readonly ai: AiDecisionService,
  ) {}

  onModuleInit(): void {
    this.fleet.onTick((f) => this.onTick(f))
  }

  getState(): DisasterSnapshot {
    return {
      flood: this.flood,
      plan: this.plan,
      pendingPlan: this.pendingPlan,
      situation: this.situation,
      summary: this.summary,
      eval: this.evalResult,
      reinforced: this.reinforced,
      aiStatus: this.aiStatus,
      aiDecision: this.aiDecision,
      planSource: this.aiDecision?.source === 'model' ? 'ai' : this.aiDecision ? 'algorithm' : null,
      aiReasoning: this.aiDecision?.source === 'model' ? this.aiDecision.recommendation : null,
    }
  }

  /** 状态变化时广播（每秒 tick 调用方触发，内部做 diff） */
  broadcastIfChanged(): void {
    const state = this.getState()
    const json = JSON.stringify(state)
    if (json !== this.lastBroadcast) {
      this.lastBroadcast = json
      this.bus.emit('disaster', state)
    }
  }

  /** 模拟灾情：生成规则候选方案和大模型解释，等待指挥确认后才执行。 */
  async simulateFlood(kind: DisasterKind = 'flood', forceRuleFallback = false): Promise<DisasterSnapshot> {
    const currentDrones = this.fleet.drones
    if (currentDrones.length === 0) return this.getState()
    const rng = mulberry32(Date.now() % 100000)
    const floodEvent = createDisasterEvent(rng, FLOOD_AREA, 0, kind)
    const dName = DISASTER_NAME[kind]
    // 物资点 = 仓储台账（真实坐标 + 实时库存）；为空时回退模拟数据
    const warehouses = await this.prisma.warehouse.findMany({ orderBy: { id: 'asc' } })
    const supplies = warehouses.length > 0
      ? warehouses.map((w) => ({
          id: 'supply-' + w.id,
          category: 'supplies' as const,
          name: w.name,
          position: [w.lng, w.lat] as [number, number],
          detail: w.items + ' · 库存 ' + w.stock + ' 件',
          status: '可用',
          org: w.org,
        }))
      : createEmergencyData(mulberry32(20260903)).supplies
    const fleetSnapshot: FleetState = { drones: currentDrones, tickCount: 0 }
    const dispatchPlan = planFloodDispatch(fleetSnapshot, SHELTERS, FLYERS, supplies, floodEvent)

    this.flood = floodEvent
    this.plan = null
    this.pendingPlan = dispatchPlan
    // 草稿阶段不启动现场态势；初始快照仅用于模型研判，确认下达后再正式计时。
    const initialSituation = initSituation(floodEvent)
    this.situation = null
    this.summary = null
    this.evalResult = null
    this.reinforced = false
    this.aiStatus = 'analyzing'
    this.aiDecision = null
    this.prevLegs = new Map()
    this.recordedDrops.clear()
    this.surveyArrivedAnnounced = false

    // 灾情档案入库
    const rec = await this.prisma.disasterEvent.create({
      data: { severity: floodEvent.severity, lng: floodEvent.position[0], lat: floodEvent.position[1] },
    })
    this.disasterId = rec.id

    // 先记录灾情感知；调配节点在人工确认后写入。
    this.log.pushNode('⚠ 灾情发生', SEVERITY_TEXT[floodEvent.severity] + dName + ' · ' + floodEvent.position[0].toFixed(4) + ', ' + floodEvent.position[1].toFixed(4), this.disasterId)
    this.log.pushFeed('disaster', SEVERITY_TEXT[floodEvent.severity] + dName + '报警，正在生成辅助决策方案')

    this.broadcastIfChanged()

    const emergency = createEmergencyData(mulberry32(20260903))
    const selectedFlyers = new Set(dispatchPlan.delivery?.flyers ?? [])
    const countByStatus = (rows: { status: string }[]): Record<string, number> => rows.reduce<Record<string, number>>((result, row) => {
      result[row.status] = (result[row.status] ?? 0) + 1
      return result
    }, {})
    const context: EmergencyDecisionContext = {
      disaster: floodEvent,
      situation: initialSituation,
      candidatePlan: dispatchPlan,
      fleet: currentDrones.map(({ id, name, status, mission, batteryPct, lng, lat, routeName }) => ({
        id, name, status, mission, batteryPct, lng, lat, routeName,
      })),
      resources: {
        supplies: warehouses.length > 0
          ? warehouses.map((row) => ({ name: row.name, detail: row.items, stock: row.stock, status: '可用' }))
          : emergency.supplies.map(({ name, detail, status }) => ({ name, detail, status })),
        operators: FLYERS.map((flyer) => ({
          id: flyer.id,
          name: flyer.name,
          status: selectedFlyers.has(flyer.name) ? '拟调度' : flyer.status === 'offline' ? '离线' : '可调度',
          lastMission: flyer.lastMission,
        })),
        personnel: countByStatus(emergency.personnel),
        vehicles: countByStatus(emergency.vehicles),
      },
      constraints: {
        surveyMinBattery: SURVEY_MIN_BATTERY,
        surveyTeamSize: SURVEY_TEAM_SIZE,
        deliveryTeamSize: DELIVERY_TEAM_SIZE,
        humanConfirmationRequired: true,
      },
    }
    const decision = await this.ai.analyze(context, { forceRuleFallback })
    // 如果分析期间演练已结束或新灾情已覆盖，则丢弃过期结果。
    if (this.flood !== floodEvent) return this.getState()
    this.aiDecision = decision
    this.aiStatus = decision.source === 'model' ? 'ready' : 'fallback'
    this.log.pushFeed('ai', decision.source === 'model'
      ? '应急决策模型分析完成，等待指挥确认'
      : '模型暂不可用，已启用规则方案等待指挥确认')
    this.broadcastIfChanged()
    return this.getState()
  }

  /** 人工确认后执行待调配方案；重复调用不会重复起飞。 */
  executeDispatch(): DisasterSnapshot {
    if (!this.flood || !this.pendingPlan || this.plan) return this.getState()
    this.refreshPendingTelemetry(this.fleet.getSnapshot())
    const nextPlan = this.pendingPlan
    const unavailable = nextPlan.survey.filter((assignment) => {
      const drone = this.fleet.drones.find((item) => item.id === assignment.droneId)
      return !drone || !isSurveyDroneDispatchable(drone)
    })
    if (unavailable.length > 0) {
      const staleWarning = '候选勘测机状态已变化，请重新发起灾情分析'
      this.pendingPlan = {
        ...nextPlan,
        warnings: nextPlan.warnings.includes(staleWarning) ? nextPlan.warnings : [...nextPlan.warnings, staleWarning],
      }
      this.log.pushFeed('disaster', '调配未执行：候选勘测机状态已变化')
      this.broadcastIfChanged()
      return this.getState()
    }

    for (const assignment of nextPlan.survey) this.fleet.divert(assignment.droneId, this.flood.position, 'survey')
    if (nextPlan.delivery) {
      const delivery = nextPlan.delivery
      for (let i = 0; i < delivery.droneCount; i++) {
        this.fleet.launch({
          home: delivery.legs[0],
          waypoints: delivery.legs.slice(1),
          taskName: DISASTER_NAME[this.flood.kind] + '物资投送 · ' + delivery.supplySiteName,
          mission: 'delivery',
        })
      }
    }

    this.plan = nextPlan
    this.pendingPlan = null
    this.situation = initSituation(this.flood)
    this.summary = summarizeSituation(this.situation, nextPlan.survey.length)
    this.log.pushNode('初次调配下达', nextPlan.survey.length + ' 架勘测机改派 · ' + (nextPlan.delivery ? nextPlan.delivery.shelterName + ' ' + nextPlan.delivery.droneCount + ' 架投送 ' + nextPlan.delivery.droneCount * PACKS_PER_SORTIE + ' 件物资' : '无投送'), this.disasterId ?? undefined)
    this.log.pushFeed('disaster', '指挥确认调配，抢险勘测与物资投送启动')
    this.broadcastIfChanged()
    return this.getState()
  }

  /** 执行二次调配增援 */
  executeReinforcement(): DisasterSnapshot {
    if (!this.flood || !this.evalResult?.needed || this.reinforced || !this.plan) return this.getState()
    const shelter = pickShelters(SHELTERS, this.flood, 2)[1] ?? SHELTERS[0]
    this.fleet.launch({
      name: 'DJI-M350-R1',
      home: shelter.position,
      waypoints: [this.flood.position],
      taskName: '增援勘测',
      mission: 'survey',
    })
    if (this.plan.delivery) {
      const d = this.plan.delivery
      this.fleet.launch({
        name: 'DJI-M350-R2',
        home: d.legs[0],
        waypoints: d.legs.slice(1),
        taskName: '增援投送 · ' + d.supplySiteName,
        mission: 'delivery',
      })
    }
    this.reinforced = true
    // F1：增援段写入 plan，抢险调配单同步出现「增援组」
    this.plan = { ...this.plan, reinforcement: buildReinforcement(SHELTERS, this.flood, !!this.plan.delivery) }
    const reinforceText = '指挥部：二次调配增援已执行，增援勘测机与投送架次已起飞'
    if (this.situation) {
      this.situation = {
        ...this.situation,
        events: [...this.situation.events, {
          seq: this.situation.events.length + 1,
          tick: this.situation.events.length,
          kind: 'supply' as const,
          text: reinforceText,
        }].slice(-30),
      }
    }
    this.log.pushFeed('disaster', reinforceText)
    this.log.pushNode('二次增援执行', shelter.name + ' 起飞增援勘测/投送', this.disasterId ?? undefined)
    this.broadcastIfChanged()
    return this.getState()
  }

  /** 结束演练：灾情档案标记 resolvedAt，清空在演状态，按钮恢复可用 */
  async resolveDisaster(): Promise<DisasterSnapshot> {
    if (!this.flood) return this.getState()
    if (this.disasterId != null) {
      await this.prisma.disasterEvent.update({
        where: { id: this.disasterId },
        data: { resolvedAt: new Date() },
      }).catch(() => undefined)
    }
    const delivered = this.situation?.deliveredPacks ?? 0
    // 撤回全部任务机（勘测/投送/增援 → 返航归舱），清掉地图上的任务航线
    const missionDrones = this.fleet.drones.filter((d) => d.mission !== 'patrol').length
    this.fleet.recallAll()
    this.flood = null
    this.plan = null
    this.pendingPlan = null
    this.situation = null
    this.summary = null
    this.evalResult = null
    this.reinforced = false
    this.aiStatus = 'idle'
    this.aiDecision = null
    this.disasterId = null
    this.prevLegs = new Map()
    this.recordedDrops.clear()
    this.surveyArrivedAnnounced = false
    this.log.pushFeed('disaster', '演练结束，灾情解除（累计投送 ' + delivered + ' 件物资，' + missionDrones + ' 架任务机返航）')
    this.log.pushNode('演练结束', '灾情解除 · 累计投送 ' + delivered + ' 件 · ' + missionDrones + ' 架任务机返航')
    this.broadcastIfChanged()
    return this.getState()
  }

  private refreshEval(fleet: FleetState): void {
    if (!this.situation) return
    const surveyCount = fleet.drones.filter((d) => d.mission === 'survey' && d.status !== 'docked').length
    const nextSummary = summarizeSituation(this.situation, Math.max(surveyCount, 1))
    if (JSON.stringify(nextSummary) !== JSON.stringify(this.summary)) this.summary = nextSummary
    // 一旦达到增援阈值即锁定，避免后续遥测波动导致按钮闪烁消失。
    const nextEval = latchReinforceEval(this.evalResult, evaluateReinforcement(nextSummary, fleet))
    if (JSON.stringify(nextEval) !== JSON.stringify(this.evalResult)) this.evalResult = nextEval
  }

  private async onTick(fleet: FleetState): Promise<void> {
    if (!this.flood) return
    if (!this.plan) {
      // 模型分析期间机队仍在飞行，持续刷新确认框中的实时遥测。
      this.refreshPendingTelemetry(fleet)
      this.broadcastIfChanged()
      return
    }
    if (!this.situation) return

    // 现场观测：有盘旋勘测机才产生事件流
    const surveyor = fleet.drones.find((d) => d.mission === 'survey' && d.status === 'hovering')
    if (surveyor && !this.surveyArrivedAnnounced) {
      this.surveyArrivedAnnounced = true
      this.log.pushNode('勘测机到场', surveyor.name + ' 等开始盘旋勘测', this.disasterId ?? undefined)
    }
    if (surveyor && fleet.tickCount % ASSESS_INTERVAL_TICKS === 0) {
      const rng = mulberry32(fleet.tickCount * 7919)
      const before = this.situation.events.length
      this.situation = assessSituation(this.situation, rng, fleet.tickCount, surveyor.name)
      const events = this.situation.events
      if (events.length > before) this.log.pushFeed('field', events[events.length - 1].text)
    }

    // 投送登记：越过灾点那一刻即空投完成
    const drops = detectSupplyDrops(fleet, this.prevLegs)
    this.prevLegs = drops.nextLegs
    const newDrops = drops.droppedIds.filter((id) => !this.recordedDrops.has(id))
    if (newDrops.length > 0) {
      for (const id of newDrops) this.recordedDrops.add(id)
      const names = newDrops
        .map((id) => fleet.drones.find((d) => d.id === id)?.name ?? id)
        .join('、')
      const packs = newDrops.length * PACKS_PER_SORTIE
      this.situation = recordDelivery(this.situation, packs)
      // 投送件数实时扣减来源仓库存（台账同步）
      let stockNote = ''
      if (this.plan?.delivery) {
        const siteName = this.plan.delivery.supplySiteName
        const wh = await this.prisma.warehouse.findFirst({ where: { name: siteName } })
        if (wh) {
          const newStock = Math.max(0, wh.stock - packs)
          await this.prisma.warehouse.update({ where: { id: wh.id }, data: { stock: newStock } }).catch(() => undefined)
          stockNote = '，' + siteName + ' 余量 ' + newStock + ' 件'
          const rows = await this.prisma.warehouse.findMany({ orderBy: { id: 'asc' } })
          this.bus.emit('warehouses', rows.map((w) => ({ ...w, percent: Math.round((w.stock / w.capacity) * 100) })))
        }
      }
      const dropText = '投送组：' + names + ' 已在灾点上空空投（+' + packs + ' 件）' + stockNote + '，正在返航'
      this.situation = {
        ...this.situation,
        events: [...this.situation.events, {
          seq: this.situation.events.length + 1,
          tick: fleet.tickCount,
          kind: 'supply' as const,
          text: dropText,
        }].slice(-30),
      }
      this.log.pushFeed('supply', dropText)
      this.log.pushNode('空投完成', names + ' · 累计 ' + this.situation.deliveredPacks + ' 件物资' + stockNote, this.disasterId ?? undefined)
    }

    this.refreshEval(fleet)
  }

  /** 保留模型已评估的候选机编号，仅用最新遥测刷新距离、电量与 ETA。 */
  private refreshPendingTelemetry(fleet: FleetState): void {
    if (!this.pendingPlan || !this.flood) return
    this.pendingPlan = {
      ...this.pendingPlan,
      survey: this.pendingPlan.survey.map((assignment) => {
        const drone = fleet.drones.find((item) => item.id === assignment.droneId)
        if (!drone) return assignment
        const distanceKm = distanceMeters([drone.lng, drone.lat], this.flood!.position) / 1000
        return {
          ...assignment,
          distanceKm: Math.round(distanceKm * 100) / 100,
          battery: Math.round(drone.batteryPct * 10) / 10,
          etaSec: Math.round(distanceKm * 1000 / EMERGENCY_SPEED),
        }
      }),
    }
  }
}
