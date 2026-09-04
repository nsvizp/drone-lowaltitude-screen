import { describe, expect, it } from 'vitest'
import { buildDispatchRows, buildWarehouseRows } from './dispatch-board'
import { createFleet, createShanghaiRoutes, launchDrone, mulberry32, advanceFleet } from './drone-sim'
import { initSituation } from './situation'
import type { FloodEvent } from './disaster'

const routes = createShanghaiRoutes()

describe('buildWarehouseRows 物资仓储', () => {
  it('返回 12 个仓储点，库存百分比在 0~100', () => {
    const rows = buildWarehouseRows()
    expect(rows).toHaveLength(12)
    for (const r of rows) {
      expect(r.percent).toBeGreaterThan(0)
      expect(r.percent).toBeLessThanOrEqual(100)
      expect(r.stock).toBeLessThanOrEqual(r.capacity)
    }
  })
})

describe('buildDispatchRows 物资调度', () => {
  const flood: FloodEvent = { id: 'f', position: [121.59, 31.19], severity: 2, createdTick: 0 }

  it('无投送任务时为空、在途 0', () => {
    const fleet = createFleet(routes, 4, mulberry32(61))
    const b = buildDispatchRows(fleet, null)
    expect(b.rows).toHaveLength(0)
    expect(b.inflight).toBe(0)
    expect(b.deliveredPacks).toBe(0)
  })

  it('投送机在飞时出现在调度列表，含任务与状态', () => {
    let fleet = createFleet(routes, 0, mulberry32(62))
    fleet = launchDrone(fleet, { home: [121.595, 31.205], waypoints: [[121.585, 31.198], [121.59, 31.19], [121.595, 31.205]], taskName: '洪灾物资投送 · 静安应急食品供应站', mission: 'delivery' })
    fleet = advanceFleet(fleet, routes, 5000)
    const b = buildDispatchRows(fleet, initSituation(flood))
    expect(b.rows).toHaveLength(1)
    expect(b.rows[0].task).toContain('洪灾物资投送')
    expect(b.rows[0].statusText).toBe('运输中')
    expect(b.inflight).toBe(1)
  })

  it('已投送件数来自现场态势', () => {
    const fleet = createFleet(routes, 2, mulberry32(63))
    const sit = { ...initSituation(flood), deliveredPacks: 400 }
    const b = buildDispatchRows(fleet, sit)
    expect(b.deliveredPacks).toBe(400)
  })

  it('归舱的投送机不计入在途', () => {
    let fleet = createFleet(routes, 0, mulberry32(64))
    fleet = launchDrone(fleet, { home: [121.595, 31.205], waypoints: [[121.595, 31.205]], taskName: '投送', mission: 'delivery' })
    for (let i = 0; i < 10; i++) fleet = advanceFleet(fleet, routes, 5000)
    const b = buildDispatchRows(fleet, null)
    expect(b.inflight).toBe(0)
  })
})
