import { ref } from 'vue'
import { getSocket } from '@/api/socket'
import {
  createShanghaiRoutes,
  fleetSummary,
  type DroneRoute,
  type DroneState,
  type FleetState,
} from '@/sim/drone-sim'

/**
 * 机队状态订阅：权威模拟器在后端运行（多开大屏状态一致、刷新不丢），
 * 前端通过 WebSocket 接收每秒快照。模块级状态 + 惰性连接。
 */
const routes = ref<DroneRoute[]>(createShanghaiRoutes())
const drones = ref<DroneState[]>([])
const summary = ref({ flying: 0, returning: 0, lowBattery: 0 })
const lastTelemetryAt = ref(0)

type TickHook = (state: FleetState) => void
const tickHooks: TickHook[] = []

/** 每快照回调（事件日志的状态流转侦测等用） */
export function onFleetTick(fn: TickHook): void {
  tickHooks.push(fn)
}

let connected = false

function connect(): void {
  if (connected) return
  connected = true
  getSocket().on('fleet', (fleet: FleetState) => {
    const incomingAt = fleet.drones.reduce((latest, drone) => Math.max(latest, drone.telemetryAt), 0)
    // 网络抖动或重连时丢弃旧快照，避免电量和状态在界面上倒退
    if (incomingAt > 0 && incomingAt < lastTelemetryAt.value) return
    lastTelemetryAt.value = incomingAt
    drones.value = fleet.drones
    summary.value = fleetSummary(fleet)
    // 调试/验收钩子（Playwright 探针用）
    ;(window as unknown as Record<string, unknown>).__FLEET = fleet
    for (const fn of tickHooks) fn(fleet)
  })
}

export function useDrones() {
  connect()
  return { routes, drones, summary, lastTelemetryAt }
}
