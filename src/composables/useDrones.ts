import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
  advanceFleet,
  createFleet,
  createShanghaiRoutes,
  fleetSummary,
  mulberry32,
  type DroneRoute,
  type DroneState,
  type FleetState,
} from '@/sim/drone-sim'

/** 演示倍速：真实 1 秒对应模拟 3 秒，让大屏上移动可见 */
const SIM_SPEED = 3
const TICK_MS = 1000

/** 实时机队：航线 + 每秒钟推进一次的无人机状态 */
export function useDrones(count = 8) {
  const routes = ref<DroneRoute[]>(createShanghaiRoutes())
  const drones = ref<DroneState[]>([])
  const summary = ref({ flying: 0, returning: 0, lowBattery: 0 })

  let fleet: FleetState
  let timer: ReturnType<typeof setInterval> | undefined

  onMounted(() => {
    fleet = createFleet(routes.value, count, mulberry32(20260513))
    drones.value = fleet.drones
    summary.value = fleetSummary(fleet)
    timer = setInterval(() => {
      fleet = advanceFleet(fleet, routes.value, TICK_MS * SIM_SPEED)
      drones.value = fleet.drones
      summary.value = fleetSummary(fleet)
    }, TICK_MS)
  })

  onBeforeUnmount(() => clearInterval(timer))

  return { routes, drones, summary }
}
