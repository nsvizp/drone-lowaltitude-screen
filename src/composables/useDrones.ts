import { ref } from 'vue'
import {
  advanceFleet,
  createFleet,
  createShanghaiRoutes,
  divertDrone,
  fleetSummary,
  launchDrone,
  mulberry32,
  type DroneRoute,
  type DroneState,
  type FleetState,
  type LngLat,
  type Mission,
} from '@/sim/drone-sim'

/** 演示倍速：真实 1 秒对应模拟 3 秒，让大屏上移动可见 */
const SIM_SPEED = 3
const TICK_MS = 1000

/**
 * 机队共享单例：多组件（地图/灾情编排/视频窗）共用同一机队状态。
 * 模块级状态 + 惰性启动，哪个组件先挂载谁先启动。
 */
const routes = ref<DroneRoute[]>(createShanghaiRoutes())
const drones = ref<DroneState[]>([])
const summary = ref({ flying: 0, returning: 0, lowBattery: 0 })

let fleet: FleetState | null = null
let timer: ReturnType<typeof setInterval> | undefined

type TickHook = (state: FleetState) => void
const tickHooks: TickHook[] = []

export function onFleetTick(fn: TickHook): void {
  tickHooks.push(fn)
}

function snapshot(): void {
  if (!fleet) return
  drones.value = fleet.drones
  summary.value = fleetSummary(fleet)
  // 调试/验收钩子（Playwright 探针用）
  ;(window as unknown as Record<string, unknown>).__FLEET = fleet
}

export function useDrones(count = 8) {
  if (!fleet) {
    fleet = createFleet(routes.value, count, mulberry32(20260513))
    snapshot()
  }
  if (!timer) {
    timer = setInterval(() => {
      if (!fleet) return
      if (typeof document !== 'undefined' && document.hidden) return // 后台标签页零消耗
      fleet = advanceFleet(fleet, routes.value, TICK_MS * SIM_SPEED)
      snapshot()
      for (const fn of tickHooks) fn(fleet)
    }, TICK_MS)
  }

  /** 改派无人机飞往目标（勘测/增援） */
  const divert = (droneId: string, target: LngLat, mission: Mission) => {
    if (!fleet) return
    fleet = divertDrone(fleet, droneId, target, mission)
    snapshot()
  }

  /** 方舱起飞新机（投送/增援勘测） */
  const launch = (opts: { name?: string; home: LngLat; waypoints: LngLat[]; taskName: string; mission?: Mission }) => {
    if (!fleet) return
    fleet = launchDrone(fleet, opts)
    snapshot()
  }

  return { routes, drones, summary, divert, launch }
}
