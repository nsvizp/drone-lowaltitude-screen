import { describe, expect, it } from 'vitest'
import { createFleet, createShanghaiRoutes, divertDrone, mulberry32 } from './drone-sim'
import { formatHudTelemetry, getVideoSource, signalBars } from './video'

const routes = createShanghaiRoutes()

describe('getVideoSource', () => {
  it('巡逻机画面为城市场景', () => {
    const fleet = createFleet(routes, 1, mulberry32(1))
    expect(getVideoSource(fleet.drones[0])).toEqual({ type: 'simulated', scene: 'city' })
  })

  it('被改派勘测的无人机画面切换为洪灾场景', () => {
    let fleet = createFleet(routes, 1, mulberry32(1))
    fleet = divertDrone(fleet, 'drone-1', [121.59, 31.19], 'survey')
    expect(getVideoSource(fleet.drones[0])).toEqual({ type: 'simulated', scene: 'flood' })
  })
})

describe('formatHudTelemetry', () => {
  it('输出高度/电量/速度/坐标四行', () => {
    const fleet = createFleet(routes, 1, mulberry32(1))
    const lines = formatHudTelemetry(fleet.drones[0])
    expect(lines).toHaveLength(4)
    expect(lines[0]).toMatch(/^ALT \d+ M$/)
    expect(lines[1]).toMatch(/^BAT [\d.]+%$/)
    expect(lines[2]).toMatch(/^SPD [\d.]+ M\/S$/)
    expect(lines[3]).toMatch(/^121\.\d{4}, 31\.\d{4}$/)
  })
})

describe('signalBars', () => {
  it('按电量分档', () => {
    const fleet = createFleet(routes, 1, mulberry32(1))
    const d = fleet.drones[0]
    expect(signalBars({ ...d, battery: 90 })).toBe(5)
    expect(signalBars({ ...d, battery: 70 })).toBe(4)
    expect(signalBars({ ...d, battery: 45 })).toBe(3)
    expect(signalBars({ ...d, battery: 26 })).toBe(2)
    expect(signalBars({ ...d, battery: 10 })).toBe(1)
  })
})
