import { describe, expect, it } from 'vitest'
import { advanceFleet, createFleet, createShanghaiRoutes, mulberry32 } from './drone-sim'
import { createEmergencyData, routesBBox } from './emergency-data'
import {
  createFloodEvent,
  isSurveyDroneDispatchable,
  pickRestedFlyers,
  pickShelters,
  pickSupplySite,
  planFloodDispatch,
  type FlyerInfo,
  type ShelterInfo,
} from './disaster'
import { EMERGENCY_SPEED } from './drone-sim'

const routes = createShanghaiRoutes()
const bbox = routesBBox()

const SHELTERS: ShelterInfo[] = [
  { id: 4001, name: '1号方舱', position: [121.4990, 31.2410], spareDrones: 2 },
  { id: 4002, name: '2号方舱', position: [121.4450, 31.1890], spareDrones: 2 },
  { id: 4003, name: '3号方舱', position: [121.5950, 31.2050], spareDrones: 2 },
  { id: 4004, name: '4号方舱', position: [121.3330, 31.2000], spareDrones: 1 },
]

const FLYERS: FlyerInfo[] = [
  { id: 3001, name: '张三', lastMission: '2026-05-13 07:50' },
  { id: 3002, name: '李四', lastMission: '2026-05-13 15:40' },
  { id: 3003, name: '王五', lastMission: '2026-05-12 20:10' },
  { id: 3004, name: '赵六', lastMission: '2026-05-12 11:25' },
]

describe('createFloodEvent', () => {
  it('洪灾点落在给定范围内，severity 1~3', () => {
    const f = createFloodEvent(mulberry32(42), bbox, 0)
    expect(f.position[0]).toBeGreaterThanOrEqual(bbox.minLng)
    expect(f.position[0]).toBeLessThanOrEqual(bbox.maxLng)
    expect(f.position[1]).toBeGreaterThanOrEqual(bbox.minLat)
    expect(f.position[1]).toBeLessThanOrEqual(bbox.maxLat)
    expect([1, 2, 3]).toContain(f.severity)
  })
})

describe('pickSupplySite（灾种匹配优先于距离）', () => {
  const supplies = createEmergencyData(mulberry32(20260903)).supplies
  const flood = createFloodEvent(mulberry32(42), bbox, 0)

  it('洪灾优先选饮用水/食品/救生类物资点', () => {
    const site = pickSupplySite(supplies, flood)!
    expect(site.detail).toMatch(/饮用水|食品|救生|冲锋舟|帐篷|被褥/)
  })

  it('即使防化服仓库更近也不选（灾种不匹配）', () => {
    const site = pickSupplySite(supplies, flood)!
    expect(site.name).not.toContain('化工')
  })

  it('空物资列表返回 null', () => {
    expect(pickSupplySite([], flood)).toBeNull()
  })
})

describe('pickRestedFlyers（休整充分优先）', () => {
  it('选最近任务最早的飞手且不重复', () => {
    const picked = pickRestedFlyers(FLYERS, 2)
    expect(picked.map((f) => f.name)).toEqual(['赵六', '王五']) // 5-12 的两位
    expect(new Set(picked.map((f) => f.id)).size).toBe(2)
  })

  it('离线飞手不进入候选调度', () => {
    const picked = pickRestedFlyers([
      { id: 1, name: '离线飞手', lastMission: '2025-01-01 00:00', status: 'offline' },
      { id: 2, name: '在线飞手', lastMission: '2026-01-01 00:00', status: 'available' },
    ], 2)
    expect(picked.map((flyer) => flyer.name)).toEqual(['在线飞手'])
  })
})

describe('isSurveyDroneDispatchable（应急改派资格）', () => {
  const drone = createFleet(routes, 1, mulberry32(9)).drones[0]

  it('正常返程且电量达标的巡逻机仍可改派', () => {
    expect(isSurveyDroneDispatchable({ ...drone, status: 'returning', mission: 'patrol', batteryPct: 80 })).toBe(true)
  })

  it('低电量或非巡逻任务不可改派', () => {
    expect(isSurveyDroneDispatchable({ ...drone, status: 'returning', mission: 'patrol', batteryPct: 20 })).toBe(false)
    expect(isSurveyDroneDispatchable({ ...drone, status: 'flying', mission: 'survey', batteryPct: 80 })).toBe(false)
  })
})

describe('planFloodDispatch 调配引擎', () => {
  it('勘测组选距灾点最近且电量达标的 2 架', () => {
    let fleet = createFleet(routes, 8, mulberry32(20260513))
    for (let i = 0; i < 60; i++) fleet = advanceFleet(fleet, routes, 3000)
    const flood = createFloodEvent(mulberry32(42), bbox, fleet.tickCount)
    const plan = planFloodDispatch(fleet, SHELTERS, FLYERS, createEmergencyData(mulberry32(20260903)).supplies, flood)

    expect(plan.survey).toHaveLength(2)
    expect(plan.survey[0].droneName).toBe('DJI-M350-004') // 演算证据：距灾点 1.86km 最近
    expect(plan.survey[0].distanceKm).toBeLessThan(plan.survey[1].distanceKm)
    for (const s of plan.survey) expect(s.battery).toBeGreaterThanOrEqual(50)
    expect(plan.survey[0].etaSec).toBeGreaterThan(0)
  })

  it('投送组选最近方舱，航段为 方舱→物资点→灾点→方舱', () => {
    let fleet = createFleet(routes, 8, mulberry32(20260513))
    for (let i = 0; i < 60; i++) fleet = advanceFleet(fleet, routes, 3000)
    const flood = createFloodEvent(mulberry32(42), bbox, fleet.tickCount)
    const plan = planFloodDispatch(fleet, SHELTERS, FLYERS, createEmergencyData(mulberry32(20260903)).supplies, flood)

    expect(plan.delivery).not.toBeNull()
    expect(plan.delivery!.shelterName).toBe('3号方舱') // 演算证据：距灾点 1.69km
    expect(plan.delivery!.legs).toHaveLength(4)
    expect(plan.delivery!.legs[0]).toEqual(SHELTERS[2].position)
    expect(plan.delivery!.legs[3]).toEqual(SHELTERS[2].position)
    expect(plan.delivery!.flyers).toEqual(['赵六', '王五'])
    expect(plan.delivery!.etaMinutes).toBeGreaterThan(0)
  })

  it('方舱无备用机时给出警告且不生成投送组', () => {
    let fleet = createFleet(routes, 8, mulberry32(20260513))
    const noSpare = SHELTERS.map((s) => ({ ...s, spareDrones: 0 }))
    const flood = createFloodEvent(mulberry32(42), bbox, 0)
    const plan = planFloodDispatch(fleet, noSpare, FLYERS, [], flood)
    expect(plan.delivery).toBeNull()
    expect(plan.warnings.length).toBeGreaterThan(0)
  })
})

describe('B1 pickShelters 增援方舱按距离排序', () => {
  it('灾点在 3号方舱旁时：最近=3号，次近=1号（不是写死的 2号）', () => {
    const flood = { id: 'f', kind: 'flood' as const, position: [121.5950, 31.2050] as [number, number], severity: 2 as const, createdTick: 0 }
    const picked = pickShelters(SHELTERS, flood, 2)
    expect(picked[0].name).toBe('3号方舱')
    expect(picked[1].name).toBe('1号方舱')
  })

  it('无备用机的方舱不参与增援挑选', () => {
    const flood = { id: 'f', kind: 'flood' as const, position: [121.5950, 31.2050] as [number, number], severity: 2 as const, createdTick: 0 }
    const noSpare3 = SHELTERS.map((s) => (s.id === 4003 ? { ...s, spareDrones: 0 } : s))
    const picked = pickShelters(noSpare3, flood, 2)
    expect(picked[0].name).toBe('1号方舱')
  })
})

describe('B3 ETA 按应急速度计算', () => {
  it('etaSec = 距离 / EMERGENCY_SPEED', () => {
    let fleet = createFleet(routes, 8, mulberry32(20260513))
    for (let i = 0; i < 60; i++) fleet = advanceFleet(fleet, routes, 3000)
    const flood = createFloodEvent(mulberry32(42), bbox, fleet.tickCount)
    const plan = planFloodDispatch(fleet, SHELTERS, FLYERS, createEmergencyData(mulberry32(20260903)).supplies, flood)
    for (const s of plan.survey) {
      const expected = Math.round((s.distanceKm * 1000) / EMERGENCY_SPEED)
      expect(Math.abs(s.etaSec - expected)).toBeLessThanOrEqual(2)
    }
  })
})
