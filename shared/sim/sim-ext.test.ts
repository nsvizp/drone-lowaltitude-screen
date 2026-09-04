import { describe, expect, it } from 'vitest'
import {
  advanceFleet,
  createFleet,
  createShanghaiRoutes,
  distanceMeters,
  divertDrone,
  launchDrone,
  mulberry32,
  ORBIT_RADIUS_M,
  TRACK_MAX,
} from './drone-sim'

const routes = createShanghaiRoutes()

describe('v4 航迹', () => {
  it('巡逻机每 tick 追加航迹点', () => {
    let fleet = createFleet(routes, 1, mulberry32(11))
    const before = fleet.drones[0].track.length
    fleet = advanceFleet(fleet, routes, 3000)
    expect(fleet.drones[0].track.length).toBe(before + 1)
  })

  it('航迹超长截断到 TRACK_MAX', () => {
    let fleet = createFleet(routes, 1, mulberry32(12))
    for (let i = 0; i < TRACK_MAX + 50; i++) fleet = advanceFleet(fleet, routes, 3000)
    expect(fleet.drones[0].track.length).toBeLessThanOrEqual(TRACK_MAX)
  })
})

describe('v4 改飞（divertDrone）', () => {
  it('改派后 plannedRoute 指向目标，最终进入盘旋', () => {
    let fleet = createFleet(routes, 8, mulberry32(13))
    const target: [number, number] = [121.5906, 31.1903]
    fleet = divertDrone(fleet, 'drone-4', target, 'survey')
    const d4 = fleet.drones.find((d) => d.id === 'drone-4')!
    expect(d4.mission).toBe('survey')
    expect(d4.plannedRoute).toEqual([target])
    expect(d4.status).toBe('flying')

    for (let i = 0; i < 300; i++) fleet = advanceFleet(fleet, routes, 5000)
    const arrived = fleet.drones.find((d) => d.id === 'drone-4')!
    expect(arrived.status).toBe('hovering')
    expect(arrived.orbitCenter).toEqual(target)
  })

  it('盘旋时位置保持在灾点 500m 半径附近', () => {
    let fleet = createFleet(routes, 8, mulberry32(14))
    const target: [number, number] = [121.5906, 31.1903]
    fleet = divertDrone(fleet, 'drone-4', target, 'survey')
    for (let i = 0; i < 300; i++) fleet = advanceFleet(fleet, routes, 5000)
    for (let i = 0; i < 10; i++) {
      fleet = advanceFleet(fleet, routes, 5000)
      const d = fleet.drones.find((x) => x.id === 'drone-4')!
      if (d.status === 'hovering') {
        const r = distanceMeters([d.lng, d.lat], target)
        expect(r).toBeGreaterThan(ORBIT_RADIUS_M - 120)
        expect(r).toBeLessThan(ORBIT_RADIUS_M + 120)
      }
    }
  })

  it('改派不影响其他无人机的巡逻', () => {
    let fleet = createFleet(routes, 8, mulberry32(15))
    fleet = divertDrone(fleet, 'drone-4', [121.5906, 31.1903], 'survey')
    fleet = advanceFleet(fleet, routes, 3000)
    const d5 = fleet.drones.find((d) => d.id === 'drone-5')!
    expect(d5.mission).toBe('patrol')
    expect(d5.plannedRoute).toBeNull()
  })
})

describe('v4 方舱起飞投送（launchDrone）', () => {
  it('投送机从方舱起飞，走完全部航段后归舱', () => {
    let fleet = createFleet(routes, 2, mulberry32(16))
    const shelter: [number, number] = [121.5950, 31.2050]
    const supply: [number, number] = [121.5850, 31.1980] // ~1.3km
    const flood: [number, number] = [121.5906, 31.1903]  // ~0.9km
    fleet = launchDrone(fleet, { home: shelter, waypoints: [supply, flood, shelter], taskName: '物资投送' })
    expect(fleet.drones).toHaveLength(3)
    const delivery = fleet.drones[2]
    expect(delivery.mission).toBe('delivery')
    expect(delivery.lng).toBeCloseTo(shelter[0])
    expect(delivery.lat).toBeCloseTo(shelter[1])

    // 轮询直到归舱（之后会被保留期清理，所以归舱当下就要断言）
    let docked: (typeof fleet.drones)[number] | undefined
    for (let i = 0; i < 400 && !docked; i++) {
      fleet = advanceFleet(fleet, routes, 5000)
      const d = fleet.drones.find((x) => x.id === 'delivery-1')
      if (d?.status === 'docked') docked = d
    }
    expect(docked).toBeDefined()
    expect(docked!.lng).toBeCloseTo(shelter[0], 3)
    expect(docked!.lat).toBeCloseTo(shelter[1], 3)
    expect(docked!.batteryPct).toBe(100) // 归舱满电
  })

  it('归舱后不再计入在飞统计', () => {
    let fleet = createFleet(routes, 0, mulberry32(17))
    const shelter: [number, number] = [121.5950, 31.2050]
    fleet = launchDrone(fleet, { home: shelter, waypoints: [shelter], taskName: '测试' })
    for (let i = 0; i < 10; i++) fleet = advanceFleet(fleet, routes, 5000)
    expect(fleet.drones[0].status).toBe('docked')
  })
})
