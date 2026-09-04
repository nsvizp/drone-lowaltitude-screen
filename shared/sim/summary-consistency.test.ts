import { describe, expect, it } from 'vitest'
import { advanceFleet, createFleet, createShanghaiRoutes, divertDrone, fleetSummary, launchDrone, mulberry32 } from './drone-sim'

const routes2 = createShanghaiRoutes()

describe('fleetSummary 口径与地图可见性一致', () => {
  it('盘旋（勘测中）的无人机计入飞行中', () => {
    let fleet = createFleet(routes2, 8, mulberry32(21))
    fleet = divertDrone(fleet, 'drone-4', [121.55, 31.21], 'survey')
    for (let i = 0; i < 400; i++) fleet = advanceFleet(fleet, routes2, 5000)
    const d4 = fleet.drones.find((d) => d.id === 'drone-4')!
    expect(d4.status).toBe('hovering')
    const s = fleetSummary(fleet)
    // 全部 8 架都应在「飞行中 + 返航」里，不少算
    expect(s.flying + s.returning).toBe(8)
  })

  it('归舱的投送机不计入任何在飞统计', () => {
    let fleet = createFleet(routes2, 0, mulberry32(22))
    const shelter: [number, number] = [121.595, 31.205]
    fleet = launchDrone(fleet, { home: shelter, waypoints: [shelter], taskName: '测试' })
    for (let i = 0; i < 10; i++) fleet = advanceFleet(fleet, routes2, 5000)
    const s = fleetSummary(fleet)
    expect(s.flying + s.returning).toBe(0)
    expect(s.lowBattery).toBe(0)
  })
})
