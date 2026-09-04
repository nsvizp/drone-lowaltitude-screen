import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import {
  advanceFleet,
  createFleet,
  createShanghaiRoutes,
  divertDrone,
  launchDrone,
  recallMissionDrones,
  type DroneState,
  type FleetState,
  type LaunchOptions,
  type LngLat,
  type Mission,
  mulberry32,
} from '../../../shared/sim/drone-sim'

const TICK_MS = 1000
const SIM_SPEED = 3
const FLEET_SIZE = 8
const FLEET_SEED = 20260513

/** 权威机队模拟器：后端单例推进，所有大屏共享同一状态 */
@Injectable()
export class FleetService implements OnModuleInit, OnModuleDestroy {
  private fleet: FleetState
  private readonly routes = createShanghaiRoutes()
  private timer: ReturnType<typeof setInterval> | undefined
  private readonly listeners = new Set<(f: FleetState) => void>()

  constructor() {
    this.fleet = createFleet(this.routes, FLEET_SIZE, mulberry32(FLEET_SEED))
  }

  onModuleInit(): void {
    this.timer = setInterval(() => {
      this.fleet = advanceFleet(this.fleet, this.routes, TICK_MS * SIM_SPEED, Date.now())
      for (const fn of this.listeners) fn(this.fleet)
    }, TICK_MS)
  }

  onModuleDestroy(): void {
    clearInterval(this.timer)
  }

  onTick(fn: (f: FleetState) => void): void {
    this.listeners.add(fn)
  }

  getSnapshot(): FleetState {
    return this.fleet
  }

  divert(droneId: string, target: LngLat, mission: Mission): void {
    this.fleet = divertDrone(this.fleet, droneId, target, mission)
  }

  launch(opts: LaunchOptions): void {
    this.fleet = launchDrone(this.fleet, opts)
  }

  /** 演练结束：召回所有任务机返航归舱 */
  recallAll(): void {
    this.fleet = recallMissionDrones(this.fleet)
  }

  get drones(): DroneState[] {
    return this.fleet.drones
  }
}
