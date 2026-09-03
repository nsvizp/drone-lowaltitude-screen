import { describe, expect, it } from 'vitest'
import {
  openAssociatedFlyRecord,
  openNewTotalDataByDay,
  openTaskOverview,
  openTotalDataByDept,
  openWorkOrderOverview,
} from './index'
import { resolvePeriodRange } from './period'
import type { TaskOverview } from './types'

describe('openTotalDataByDept', () => {
  it('返回方舱数、飞手数等总览统计', async () => {
    const res = await openTotalDataByDept()
    expect(res.code).toBe(200)
    expect(res.data.shelterNum).toBe(11)
    expect(res.data.flyerNum).toBe(12)
    expect(res.data.recordCount).toBe(168)
  })
})

describe('openAssociatedFlyRecord', () => {
  it('默认返回前 10 条且按执行时间降序', async () => {
    const page = await openAssociatedFlyRecord()
    expect(page.rows).toHaveLength(10)
    const times = page.rows.map((r) => r.createTime)
    const sorted = [...times].sort((a, b) => b.localeCompare(a))
    expect(times).toEqual(sorted)
  })

  it('包含飞行编号、航线、飞手、方舱等字段', async () => {
    const page = await openAssociatedFlyRecord()
    const row = page.rows[0]
    expect(row.flyRecordId).toBeTypeOf('number')
    expect(row.flyLineName).toBeTruthy()
    expect(row.flyerName).toBeTruthy()
    expect(row.shelterName).toMatch(/方舱/)
  })
})

describe('openTaskOverview', () => {
  it('四状态数量之和等于任务总量', async () => {
    const res = await openTaskOverview('total')
    const d = res.data
    expect(d.dispatchedNum + d.dispatchingNum + d.receivedNum + d.completedNum).toBe(d.taskTotalNum)
  })

  it('四状态百分比之和约为 100', async () => {
    for (const period of ['today', 'week', 'month', 'year', 'total'] as const) {
      const res = await openTaskOverview(period)
      const d = res.data
      const sum = d.dispatchedPercent + d.dispatchingPercent + d.receivedPercent + d.completedPercent
      expect(Math.abs(sum - 100)).toBeLessThanOrEqual(4)
    }
  })

  it('不同周期返回不同数量级，累计最大', async () => {
    const results: Record<string, TaskOverview> = {}
    for (const period of ['today', 'week', 'month', 'year', 'total'] as const) {
      results[period] = (await openTaskOverview(period)).data
    }
    expect(results.total.taskTotalNum).toBeGreaterThanOrEqual(results.year.taskTotalNum)
    expect(results.year.taskTotalNum).toBeGreaterThanOrEqual(results.month.taskTotalNum)
    expect(results.month.taskTotalNum).toBeGreaterThanOrEqual(results.today.taskTotalNum)
  })

  it('下级部门列表非空', async () => {
    const res = await openTaskOverview('month')
    expect(res.data.taskOverviewRespVoList!.length).toBeGreaterThan(0)
  })
})

describe('openWorkOrderOverview', () => {
  it('返回省公司及下级部门工单统计', async () => {
    const res = await openWorkOrderOverview()
    expect(res.data.deptName).toBe('省公司')
    expect(res.data.workOrderOverviewRespVos).toHaveLength(3)
  })
})

describe('openNewTotalDataByDay', () => {
  it('省级汇总等于各下级之和', async () => {
    const res = await openNewTotalDataByDay()
    const children = res.data.countViewRespVos!
    const sum = children.reduce((acc, c) => acc + c.recordCount, 0)
    expect(res.data.recordCount).toBe(sum)
  })
})

describe('resolvePeriodRange', () => {
  const now = new Date('2026-05-13T15:40:00') // 周三

  it('今日从当天 0 点开始', () => {
    const { start, end } = resolvePeriodRange('today', now)
    expect(start.getHours()).toBe(0)
    expect(start.getDate()).toBe(13)
    expect(end).toBe(now)
  })

  it('本周从周一开始', () => {
    const { start } = resolvePeriodRange('week', now)
    expect(start.getDay()).toBe(1)
    expect(start.getDate()).toBe(11)
  })

  it('本月从 1 号开始', () => {
    const { start } = resolvePeriodRange('month', now)
    expect(start.getDate()).toBe(1)
  })

  it('本年从 1 月 1 日开始', () => {
    const { start } = resolvePeriodRange('year', now)
    expect(start.getMonth()).toBe(0)
    expect(start.getDate()).toBe(1)
  })

  it('累计从 2024-01-01 开始', () => {
    const { start } = resolvePeriodRange('total', now)
    expect(start.getFullYear()).toBe(2024)
    expect(start.getMonth()).toBe(0)
    expect(start.getDate()).toBe(1)
  })
})
