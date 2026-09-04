import { describe, expect, it } from 'vitest'
import { createFleet, createShanghaiRoutes, divertDrone, mulberry32 } from './drone-sim'
import {
  assessSituation,
  evaluateReinforcement,
  EVENTS_MAX,
  initSituation,
  recordDelivery,
  summarizeSituation,
} from './situation'
import { createFloodEvent } from './disaster'
import { routesBBox } from './emergency-data'

const flood = { ...createFloodEvent(mulberry32(42), routesBBox(), 0), severity: 3 as const }
const routes = createShanghaiRoutes()

describe('initSituation / assessSituation 事件流', () => {
  it('按灾情等级初始化估算指标', () => {
    const s = initSituation(flood)
    expect(s.areaKm2).toBeCloseTo(0.9)
    expect(s.trapped).toBe(12)
    expect(s.waterLevelM).toBeCloseTo(1.3)
  })

  it('每次观测追加一条事件，指标随之演化', () => {
    let s = initSituation(flood)
    const rng = mulberry32(7)
    for (let i = 0; i < 5; i++) s = assessSituation(s, rng, i, 'DJI-M350-004')
    expect(s.events).toHaveLength(5)
    expect(s.events[0].text).toContain('DJI-M350-004')
    expect(s.waterHistory.length).toBeGreaterThan(1)
  })

  it('事件流超长截断到 EVENTS_MAX', () => {
    let s = initSituation(flood)
    const rng = mulberry32(8)
    for (let i = 0; i < EVENTS_MAX + 10; i++) s = assessSituation(s, rng, i, 'DJI-M350-004')
    expect(s.events).toHaveLength(EVENTS_MAX)
  })
})

describe('summarizeSituation 态势总结', () => {
  it('水位三连涨判定为 rising', () => {
    const s = { ...initSituation(flood), waterHistory: [1.0, 1.1, 1.2] }
    expect(summarizeSituation(s, 2).waterTrend).toBe('rising')
  })

  it('水位三连降判定为 falling，否则 stable', () => {
    const down = { ...initSituation(flood), waterHistory: [1.2, 1.1, 1.0] }
    expect(summarizeSituation(down, 2).waterTrend).toBe('falling')
    const flat = { ...initSituation(flood), waterHistory: [1.0, 1.2, 1.1] }
    expect(summarizeSituation(flat, 2).waterTrend).toBe('stable')
  })

  it('覆盖能力 = 盘旋机数 × 单机覆盖', () => {
    const s = initSituation(flood)
    expect(summarizeSituation(s, 2).coverageKm2).toBeCloseTo(1.57, 1)
  })
})

describe('evaluateReinforcement 二次调配评估', () => {
  const fleet = createFleet(routes, 8, mulberry32(1))

  it('一切正常时不需要增援', () => {
    const s = initSituation({ ...flood, severity: 1 })
    const summary = summarizeSituation({ ...s, areaKm2: 0.3, trapped: 4, waterHistory: [1.0, 1.0, 1.0] }, 2)
    const ev = evaluateReinforcement(summary, fleet)
    expect(ev.needed).toBe(false)
    expect(ev.reasons).toHaveLength(0)
  })

  it('被困超阈触发增援', () => {
    const s = initSituation(flood)
    const summary = summarizeSituation({ ...s, trapped: 24 }, 2)
    const ev = evaluateReinforcement(summary, fleet)
    expect(ev.needed).toBe(true)
    expect(ev.reasons.join('')).toContain('被困')
    expect(ev.recommendation).toContain('二次调配')
  })

  it('受淹面积超覆盖触发增援', () => {
    const s = initSituation(flood)
    const summary = summarizeSituation({ ...s, areaKm2: 3.2 }, 2)
    const ev = evaluateReinforcement(summary, fleet)
    expect(ev.needed).toBe(true)
    expect(ev.reasons.join('')).toContain('覆盖')
    expect(ev.recommendation).toContain('勘测机')
  })

  it('勘测机低电量触发轮班建议', () => {
    let f = createFleet(routes, 8, mulberry32(2))
    f = divertDrone(f, 'drone-1', [121.59, 31.19], 'survey')
    f = {
      ...f,
      drones: f.drones.map((d) => (d.id === 'drone-1' ? { ...d, batteryPct: 22 } : d)),
    }
    const s = initSituation({ ...flood, severity: 1 })
    const summary = summarizeSituation({ ...s, areaKm2: 0.3, trapped: 4 }, 2)
    const ev = evaluateReinforcement(summary, f)
    expect(ev.needed).toBe(true)
    expect(ev.recommendation).toContain('轮班')
  })
})

describe('recordDelivery', () => {
  it('登记投送物资包数', () => {
    const s = recordDelivery(initSituation(flood), 553)
    expect(s.deliveredPacks).toBe(553)
  })
})
