import { computed, ref } from 'vue'
import {
  createFloodEvent,
  planFloodDispatch,
  type DispatchPlan,
  type FloodEvent,
  type FlyerInfo,
  type ShelterInfo,
} from '@/sim/disaster'
import {
  assessSituation,
  evaluateReinforcement,
  initSituation,
  recordDelivery,
  summarizeSituation,
  type ReinforcementEval,
  type SituationState,
  type SituationSummary,
} from '@/sim/situation'
import { mulberry32, type FleetState } from '@/sim/drone-sim'
import { createEmergencyData } from '@/sim/emergency-data'

/** 洪灾演练区域（市区核心，保证应急响应在 1~2 分钟内到场） */
const FLOOD_AREA = { minLng: 121.42, maxLng: 121.62, minLat: 31.16, maxLat: 31.26 }
import { onFleetTick, useDrones } from './useDrones'

/** 方舱（含备用机编制）与飞手名册（源自 mock 接口数据） */
export const SHELTERS: ShelterInfo[] = [
  { id: 4001, name: '1号方舱', position: [121.4990, 31.2410], spareDrones: 2 },
  { id: 4002, name: '2号方舱', position: [121.4450, 31.1890], spareDrones: 2 },
  { id: 4003, name: '3号方舱', position: [121.5950, 31.2050], spareDrones: 2 },
  { id: 4004, name: '4号方舱', position: [121.3330, 31.2000], spareDrones: 1 },
]

export const FLYERS: FlyerInfo[] = [
  { id: 3001, name: '张三', lastMission: '2026-05-13 07:50' },
  { id: 3002, name: '李四', lastMission: '2026-05-13 15:40' },
  { id: 3003, name: '王五', lastMission: '2026-05-12 20:10' },
  { id: 3004, name: '赵六', lastMission: '2026-05-12 11:25' },
]

/** 单架投送机载货量（包） */
const PACKS_PER_SORTIE = 200
/** 每多少 tick 生成一条现场观测（1s tick → 约 6s 一条） */
const ASSESS_INTERVAL_TICKS = 6

// ---------- 模块级灾情状态（共享单例） ----------
const flood = ref<FloodEvent | null>(null)
const plan = ref<DispatchPlan | null>(null)
const situation = ref<SituationState | null>(null)
const summaryRef = ref<SituationSummary | null>(null)
const evalResult = ref<ReinforcementEval | null>(null)
const reinforced = ref(false)
const videoDroneId = ref<string | null>(null)

let recordedDockedDeliveries = 0
let hookRegistered = false

function refreshEval(fleet: FleetState): void {
  if (!situation.value) return
  const surveyCount = fleet.drones.filter((d) => d.mission === 'survey' && d.status !== 'docked').length
  summaryRef.value = summarizeSituation(situation.value, Math.max(surveyCount, 1))
  evalResult.value = evaluateReinforcement(summaryRef.value, fleet)
}

function onTick(fleet: FleetState): void {
  if (!flood.value || !situation.value) return

  // 现场观测：有盘旋勘测机才产生事件流
  const surveyor = fleet.drones.find((d) => d.mission === 'survey' && d.status === 'hovering')
  if (surveyor && fleet.tickCount % ASSESS_INTERVAL_TICKS === 0) {
    const rng = mulberry32(fleet.tickCount * 7919)
    situation.value = assessSituation(situation.value, rng, fleet.tickCount, surveyor.name)
  }

  // 投送完成登记（delivery 归舱即视为该架次完成投送）
  const dockedDeliveries = fleet.drones.filter((d) => d.mission === 'delivery' && d.status === 'docked').length
  if (dockedDeliveries > recordedDockedDeliveries) {
    const newSorties = dockedDeliveries - recordedDockedDeliveries
    recordedDockedDeliveries = dockedDeliveries
    situation.value = recordDelivery(situation.value, newSorties * PACKS_PER_SORTIE)
    situation.value = {
      ...situation.value,
      events: [...situation.value.events, {
        seq: situation.value.events.length + 1,
        tick: fleet.tickCount,
        kind: 'supply' as const,
        text: '投送组：' + newSorties + ' 个架次物资已送达并返舱（+' + newSorties * PACKS_PER_SORTIE + ' 件）',
      }].slice(-30),
    }
  }

  refreshEval(fleet)
}

export function useDisaster() {
  const { drones, divert, launch } = useDrones()

  if (!hookRegistered) {
    hookRegistered = true
    onFleetTick(onTick)
  }

  /** 模拟洪灾：随机灾点 → 调配引擎 → 改派勘测 + 方舱起飞投送 */
  const simulateFlood = () => {
    const currentDrones = drones.value
    if (currentDrones.length === 0) return
    const rng = mulberry32(Date.now() % 100000)
    const floodEvent = createFloodEvent(rng, FLOOD_AREA, 0)
    const supplies = createEmergencyData(mulberry32(20260903)).supplies

    const fleetSnapshot: FleetState = { drones: currentDrones, tickCount: 0 }
    const dispatchPlan = planFloodDispatch(fleetSnapshot, SHELTERS, FLYERS, supplies, floodEvent)

    // 执行调配：勘测组改飞
    for (const s of dispatchPlan.survey) divert(s.droneId, floodEvent.position, 'survey')
    // 执行调配：投送组从方舱起飞（方舱 → 物资点 → 灾点 → 方舱）
    if (dispatchPlan.delivery) {
      const d = dispatchPlan.delivery
      for (let i = 0; i < d.droneCount; i++) {
        launch({
          home: d.legs[0],
          waypoints: d.legs.slice(1),
          taskName: '洪灾物资投送 · ' + d.supplySiteName,
          mission: 'delivery',
        })
      }
    }

    flood.value = floodEvent
    plan.value = dispatchPlan
    situation.value = initSituation(floodEvent)
    summaryRef.value = null
    evalResult.value = null
    reinforced.value = false
    recordedDockedDeliveries = 0
  }

  /** 执行二次调配增援：增派勘测机 + 追加投送架次 */
  const executeReinforcement = () => {
    if (!flood.value || !evalResult.value?.needed || reinforced.value || !plan.value) return
    const shelter = SHELTERS[1] // 次近方舱（演示：2号方舱）
    launch({
      name: 'DJI-M350-R1',
      home: shelter.position,
      waypoints: [flood.value.position],
      taskName: '增援勘测',
      mission: 'survey',
    })
    if (plan.value.delivery) {
      const d = plan.value.delivery
      launch({
        name: 'DJI-M350-R2',
        home: d.legs[0],
        waypoints: d.legs.slice(1),
        taskName: '增援投送 · ' + d.supplySiteName,
        mission: 'delivery',
      })
    }
    reinforced.value = true
    if (situation.value) {
      situation.value = {
        ...situation.value,
        events: [...situation.value.events, {
          seq: situation.value.events.length + 1,
          tick: situation.value.events.length,
          kind: 'supply' as const,
          text: '指挥部：二次调配增援已执行，增援勘测机与投送架次已起飞',
        }].slice(-30),
      }
    }
  }

  const openVideo = (droneId: string) => { videoDroneId.value = droneId }
  const closeVideo = () => { videoDroneId.value = null }

  // 调试/验收钩子（Playwright 探针）
  ;(window as unknown as Record<string, unknown>).__DISASTER = { flood, plan, situation, summaryRef, evalResult, openVideo, closeVideo }

  const active = computed(() => flood.value !== null)

  return {
    flood, plan, situation, summary: summaryRef, evalResult, reinforced, active, videoDroneId,
    simulateFlood, executeReinforcement, openVideo, closeVideo,
  }
}
