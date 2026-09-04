import { describe, expect, it } from 'vitest'
import {
  advanceFleet,
  createFleet,
  createShanghaiRoutes,
  launchDrone,
  mulberry32,
  DOCKED_RETENTION_TICKS,
  type FleetState,
} from './drone-sim'
import { detectSupplyDrops } from './situation'

const routes = createShanghaiRoutes()
const shelter: [number, number] = [121.595, 31.205]

describe('B8 归舱生命周期', () => {
  it('归舱时记录 dockedAt tick', () => {
    let fleet = createFleet(routes, 0, mulberry32(41))
    fleet = launchDrone(fleet, { home: shelter, waypoints: [shelter], taskName: '测试' })
    for (let i = 0; i < 10; i++) fleet = advanceFleet(fleet, routes, 5000)
    expect(fleet.drones[0].status).toBe('docked')
    expect(fleet.drones[0].dockedAt).toBeGreaterThan(0)
  })

  it('无航线机型归舱超过保留期后从机队移除', () => {
    let fleet = createFleet(routes, 0, mulberry32(42))
    fleet = launchDrone(fleet, { home: shelter, waypoints: [shelter], taskName: '测试' })
    for (let i = 0; i < DOCKED_RETENTION_TICKS + 20; i++) fleet = advanceFleet(fleet, routes, 5000)
    expect(fleet.drones).toHaveLength(0) // 已清理
  })
})

describe('B2 detectSupplyDrops 过灾点即登记', () => {
  it('投送机剩余航段 2→1（越过灾点）时被检出且只报一次', () => {
    // 构造：方舱 → 物资点 → 灾点 → 方舱（3 个 waypoints）
    let fleet = createFleet(routes, 0, mulberry32(43))
    const supply: [number, number] = [121.585, 31.198]
    const flood: [number, number] = [121.5906, 31.1903]
    fleet = launchDrone(fleet, { home: shelter, waypoints: [supply, flood, shelter], taskName: '投送' })

    const id = fleet.drones[0].id // deliverySeq 跨用例递增，不写死编号
    let prevLegs = new Map<string, number>()
    const drops: string[] = []
    for (let i = 0; i < 600 && fleet.drones.length > 0; i++) {
      fleet = advanceFleet(fleet, routes, 5000)
      const r = detectSupplyDrops(fleet, prevLegs)
      prevLegs = r.nextLegs
      drops.push(...r.droppedIds)
    }
    expect(drops.filter((d) => d === id)).toHaveLength(1) // 恰好一次：越过灾点那一刻
  })

  it('巡逻/勘测机不触发投送登记', () => {
    let fleet = createFleet(routes, 2, mulberry32(44))
    let prevLegs = new Map<string, number>()
    for (let i = 0; i < 30; i++) {
      fleet = advanceFleet(fleet, routes, 5000)
      const r = detectSupplyDrops(fleet, prevLegs)
      prevLegs = r.nextLegs
      expect(r.droppedIds).toHaveLength(0)
    }
  })
})
