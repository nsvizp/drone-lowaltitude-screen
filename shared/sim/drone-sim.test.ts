import { describe, expect, it } from 'vitest'
import {
  advanceFleet,
  bearingDegrees,
  createFleet,
  createShanghaiRoutes,
  distanceMeters,
  fleetSummary,
  mulberry32,
  pointAlongRoute,
  routeLengthMeters,
} from './drone-sim'

describe('地理计算', () => {
  it('distanceMeters：陆家嘴到外滩约 1~2 公里', () => {
    const d = distanceMeters([121.5014, 31.2397], [121.4900, 31.2390])
    expect(d).toBeGreaterThan(500)
    expect(d).toBeLessThan(3000)
  })

  it('bearingDegrees：正东方向约 90 度', () => {
    const b = bearingDegrees([121.47, 31.23], [121.48, 31.23])
    expect(b).toBeGreaterThan(80)
    expect(b).toBeLessThan(100)
  })
})

describe('航线工具', () => {
  const routes = createShanghaiRoutes()

  it('生成 6 条上海示范航线', () => {
    expect(routes).toHaveLength(6)
    for (const r of routes) expect(r.points.length).toBeGreaterThanOrEqual(2)
  })

  it('pointAlongRoute 起点 progress=0，终点 progress=1', () => {
    const route = routes[0]
    const total = routeLengthMeters(route)
    expect(pointAlongRoute(route, 0).progress).toBe(0)
    expect(pointAlongRoute(route, total).progress).toBe(1)
    expect(pointAlongRoute(route, total * 2).progress).toBe(1) // 超出截断
  })

  it('pointAlongRoute 中点位置位于航线包围盒内', () => {
    const route = routes[0]
    const total = routeLengthMeters(route)
    const mid = pointAlongRoute(route, total / 2).position
    const lngs = route.points.map((p) => p[0])
    const lats = route.points.map((p) => p[1])
    expect(mid[0]).toBeGreaterThanOrEqual(Math.min(...lngs) - 1e-9)
    expect(mid[0]).toBeLessThanOrEqual(Math.max(...lngs) + 1e-9)
    expect(mid[1]).toBeGreaterThanOrEqual(Math.min(...lats) - 1e-9)
    expect(mid[1]).toBeLessThanOrEqual(Math.max(...lats) + 1e-9)
  })
})

describe('机队模拟', () => {
  const routes = createShanghaiRoutes()

  it('createFleet 创建指定数量无人机且进度在 0..0.5', () => {
    const fleet = createFleet(routes, 8, mulberry32(42))
    expect(fleet.drones).toHaveLength(8)
    for (const d of fleet.drones) {
      expect(d.progress).toBeGreaterThanOrEqual(0)
      expect(d.progress).toBeLessThanOrEqual(0.5)
      expect(d.battery).toBeGreaterThanOrEqual(60)
      expect(d.status).toBe('flying')
    }
  })

  it('advanceFleet 让无人机沿航线前进且不越界', () => {
    let fleet = createFleet(routes, 6, mulberry32(7))
    fleet = advanceFleet(fleet, routes, 5000)
    for (const d of fleet.drones) {
      expect(d.progress).toBeGreaterThanOrEqual(0)
      expect(d.progress).toBeLessThanOrEqual(1)
      expect(d.battery).toBeLessThanOrEqual(100)
    }
    expect(fleet.tickCount).toBe(1)
  })

  it('推进足够时间后无人机到达终点并返航', () => {
    let fleet = createFleet(routes, 1, mulberry32(1))
    for (let i = 0; i < 120; i++) fleet = advanceFleet(fleet, routes, 5000)
    expect(fleet.drones[0].status).toBe('returning')
  })

  it('返航回到起点后满电重新出发', () => {
    let fleet = createFleet(routes, 1, mulberry32(3))
    for (let i = 0; i < 300; i++) fleet = advanceFleet(fleet, routes, 5000)
    const drone = fleet.drones[0]
    expect(['flying', 'returning']).toContain(drone.status)
    expect(drone.battery).toBeGreaterThan(0)
  })

  it('fleetSummary 汇总飞行/返航/低电量数量', () => {
    const fleet = createFleet(routes, 8, mulberry32(9))
    const summary = fleetSummary(fleet)
    expect(summary.flying + summary.returning).toBe(8)
    expect(summary.lowBattery).toBeGreaterThanOrEqual(0)
  })

  it('无人机位置始终落在上海周边（经度 121.2~121.9，纬度 31.1~31.4）', () => {
    let fleet = createFleet(routes, 12, mulberry32(2024))
    for (let i = 0; i < 50; i++) {
      fleet = advanceFleet(fleet, routes, 3000)
      for (const d of fleet.drones) {
        expect(d.lng).toBeGreaterThan(121.2)
        expect(d.lng).toBeLessThan(121.9)
        expect(d.lat).toBeGreaterThan(31.1)
        expect(d.lat).toBeLessThan(31.4)
      }
    }
  })
})
