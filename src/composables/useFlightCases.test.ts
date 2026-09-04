import { describe, expect, it } from 'vitest'
import type { FlyRecord } from '@/api/types'
import { getFlightCaseDetail, pointAlongFlightPath, useFlightCases } from './useFlightCases'

const record: FlyRecord = {
  flyRecordId: 1009,
  flyRecordName: '巡检飞行记录-河流区域',
  flyLineId: 2009,
  flyLineName: '指点飞行',
  flyerId: 3001,
  flyerName: '张三',
  createTime: '2026-05-13 07:50:00',
  shelterId: 4002,
  shelterName: '2号方舱',
}

describe('飞行案例轨迹', () => {
  it('返回明确的无人机数量、目的地和轨迹点', () => {
    const detail = getFlightCaseDetail(record)
    expect(detail.droneCount).toBe(1)
    expect(detail.droneNames).toHaveLength(detail.droneCount)
    expect(detail.droneNames).toEqual(['DJI-M350-001'])
    expect(detail.destinationName).toBe('徐汇滨江河道')
    expect(detail.path.length).toBeGreaterThanOrEqual(2)
  })

  it('案例选择状态可供左侧列表与中心地图共享', () => {
    const { activeFlightCase, showFlightCase, clearFlightCase } = useFlightCases()
    const detail = getFlightCaseDetail(record)
    showFlightCase(detail)
    expect(activeFlightCase.value?.flyRecordId).toBe(record.flyRecordId)
    clearFlightCase()
    expect(activeFlightCase.value).toBeNull()
  })

  it('按航线长度计算加速回放位置', () => {
    const path = [[121, 31], [121.01, 31], [121.03, 31]] as const
    expect(pointAlongFlightPath(path, 0)).toEqual([121, 31])
    expect(pointAlongFlightPath(path, 1)).toEqual([121.03, 31])
    const middle = pointAlongFlightPath(path, 0.5)
    expect(middle?.[0]).toBeCloseTo(121.015, 3)
  })
})
