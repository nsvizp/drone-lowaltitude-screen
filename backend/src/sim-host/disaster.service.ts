import { Injectable, OnModuleInit } from '@nestjs/common'
import {
  buildReinforcement,
  createDisasterEvent,
  DISASTER_NAME,
  pickShelters,
  planFloodDispatch,
  type DisasterKind,
  type DispatchPlan,
  type FloodEvent,
  type FlyerInfo,
  type ShelterInfo,
} from '../../../shared/sim/disaster'
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
import { mulberry32, recallMissionDrones, type FleetState } from '../../../shared/sim/drone-sim'
import { createEmergencyData } from '../../../shared/sim/emergency-data'
import { PrismaService } from '../prisma.service'
import { EventBus } from './event-bus'
import { EventLogService } from './event-log.service'
import { FleetService } from './fleet.service'

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
  { id: 3001, name: '张三', lastMission: '2026-05-13 07:50' },
  { id: 3002, name: '李四', lastMission: '2026-05-13 15:40' },
  { id: 3003, name: '王五', lastMission: '2026-05-12 20:10' },
  { id: 3004, name: '赵六', lastMission: '2026-05-12 11:25' },
]

export interface DisasterSnapshot {
  flood: FloodEvent | null
  plan: DispatchPlan | null
  situation: SituationState | null
  summary: SituationSummary | null
  eval: ReinforcementEval | null
  reinforced: boolean
}

/** 权威灾情编排：灾点生成 → 调配 → 现场态势 → 空投登记 → 增援评估 */
@Injectable()
export class DisasterService implements OnModuleInit {
  private flood: FloodEvent | null = null
  private disasterId: number | null = null
  private plan: DispatchPlan | null = null
  private situation: SituationState | null = null
  private summary: SituationSummary | null = null
  private evalResult: ReinforcementEval | null = null
  private reinforced = false
  private prevLegs = new Map<string, number>()
  private readonly recordedDrops = new Set<string>()
  private surveyArrivedAnnounced = false
  private lastBroadcast = ''

  constructor(
    private readonly fleet: FleetService,
    private readonly log: EventLogService,
    private readonly bus: EventBus,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    this.fleet.onTick((f) => this.onTick(f))
  }

  getState(): DisasterSnapshot {
    return {
      flood: this.flood,
      plan: this.plan,
      situation: this.situation,
      summary: this.summary,
      eval: this.evalResult,
      reinforced: this.reinforced,
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

  /** 模拟灾情（洪灾/泥石流）：随机灾点 → 调配引擎 → 改派勘测 + 方舱起飞投送 */
  async simulateFlood(kind: DisasterKind = 'flood'): Promise<DisasterSnapshot> {
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

    for (const s of dispatchPlan.survey) this.fleet.divert(s.droneId, floodEvent.position, 'survey')
    if (dispatchPlan.delivery) {
      const d = dispatchPlan.delivery
      for (let i = 0; i < d.droneCount; i++) {
        this.fleet.launch({
          home: d.legs[0],
          waypoints: d.legs.slice(1),
          taskName: dName + '物资投送 · ' + d.supplySiteName,
          mission: 'delivery',
        })
      }
    }

    this.flood = floodEvent
    this.plan = dispatchPlan
    this.situation = initSituation(floodEvent)
    this.summary = null
    this.evalResult = null
    this.reinforced = false
    this.prevLegs = new Map()
    this.recordedDrops.clear()
    this.surveyArrivedAnnounced = false

    // 灾情档案入库
    const rec = await this.prisma.disasterEvent.create({
      data: { severity: floodEvent.severity, lng: floodEvent.position[0], lat: floodEvent.position[1] },
    })
    this.disasterId = rec.id

    // 事件日志：灾情节点 + 初次调配节点 + 报警动态
    this.log.pushNode('⚠ 灾情发生', SEVERITY_TEXT[floodEvent.severity] + dName + ' · ' + floodEvent.position[0].toFixed(4) + ', ' + floodEvent.position[1].toFixed(4), this.disasterId)
    this.log.pushNode('初次调配下达', dispatchPlan.survey.length + ' 架勘测机改派 · ' + (dispatchPlan.delivery ? dispatchPlan.delivery.shelterName + ' ' + dispatchPlan.delivery.droneCount + ' 架投送 ' + dispatchPlan.delivery.droneCount * PACKS_PER_SORTIE + ' 件物资' : '无投送'), this.disasterId)
    this.log.pushFeed('disaster', SEVERITY_TEXT[floodEvent.severity] + dName + '报警，抢险勘测与物资投送启动')

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
    this.situation = null
    this.summary = null
    this.evalResult = null
    this.reinforced = false
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
    const nextEval = evaluateReinforcement(nextSummary, fleet)
    if (JSON.stringify(nextEval) !== JSON.stringify(this.evalResult)) this.evalResult = nextEval
  }

  private async onTick(fleet: FleetState): Promise<void> {
    if (!this.flood || !this.situation) return

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
}
