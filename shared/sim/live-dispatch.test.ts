import { describe, expect, it } from 'vitest'
import { EMERGENCY_SPEED, type DroneState } from './drone-sim'
import type { DispatchPlan, FloodEvent } from './disaster'
import { liveEta, liveSurveyRows } from './live-dispatch'

const flood: FloodEvent = { id: 'f', kind: 'flood', position: [121.5, 31.2], severity: 2, createdTick: 0 }

function drone(over: Partial<DroneState>): DroneState {
  return {
    id: 'drone-1', name: 'DJI-M350-001', lng: 121.4, lat: 31.1, heading: 0,
    speed: 15, altitude: 100, batteryPct: 80, status: 'flying', mission: 'survey',
    routeName: '灾点勘测', taskName: '灾点勘测', track: [], plannedRoute: [], waypoints: [],
    ...over,
  } as DroneState
}

function plan(): DispatchPlan {
  return {
    flood,
    survey: [{
      droneId: 'drone-1', droneName: 'DJI-M350-001', flyerNote: '原飞手保持操控',
      distanceKm: 99, battery: 80, etaSec: 9999,
    }],
    delivery: null,
    warnings: [],
  }
}

describe('liveEta 单机实时遥测', () => {
  it('飞行中：距离实时计算，ETA 按应急速度', () => {
    const r = liveEta(drone({ lng: 121.4, lat: 31.1 }), flood.position)
    expect(r.arrived).toBe(false)
    expect(r.distanceKm).toBeGreaterThan(10) // 约 13km
    expect(r.etaSec).toBe(Math.round(r.distanceKm * 1000 / EMERGENCY_SPEED))
  })

  it('到场盘旋：ETA=0 且 arrived=true', () => {
    const r = liveEta(drone({ status: 'hovering', lng: 121.5, lat: 31.2 }), flood.position)
    expect(r.arrived).toBe(true)
    expect(r.etaSec).toBe(0)
  })
})

describe('liveSurveyRows 勘测组实时行', () => {
  it('电池/距离/ETA 被实时数据覆盖（不再是初调快照）', () => {
    const rows = liveSurveyRows(plan(), [drone({ batteryPct: 55 })])
    expect(rows[0].battery).toBe(55)          // 实时电量
    expect(rows[0].distanceKm).not.toBe(99)   // 不再是初调快照
    expect(rows[0].etaSec).not.toBe(9999)
    expect(rows[0].offline).toBe(false)
  })

  it('机归舱消失：回退初调快照并标注 offline', () => {
    const rows = liveSurveyRows(plan(), [])
    expect(rows[0].offline).toBe(true)
    expect(rows[0].battery).toBe(80)
    expect(rows[0].etaSec).toBe(9999)
  })

  it('无人机飞近后 ETA 单调变小', () => {
    const far = liveSurveyRows(plan(), [drone({ lng: 121.4, lat: 31.1 })])[0]
    const near = liveSurveyRows(plan(), [drone({ lng: 121.49, lat: 31.19 })])[0]
    expect(near.etaSec).toBeLessThan(far.etaSec)
  })
})
