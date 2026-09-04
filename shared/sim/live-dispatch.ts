import { distanceMeters, EMERGENCY_SPEED, type DroneState, type LngLat } from './drone-sim'
import type { DispatchPlan } from './disaster'

/** 单机实时遥测快照（调配单行显示用） */
export interface LiveEta {
  /** 距目标实时公里数（两位小数） */
  distanceKm: number
  /** 实时 ETA 秒（到场盘旋=0） */
  etaSec: number
  /** 已到场盘旋 */
  arrived: boolean
}

/** 用无人机实时位置/状态算距目标的距离与 ETA（应急速度口径，与初调一致） */
export function liveEta(drone: DroneState, target: LngLat): LiveEta {
  const arrived = drone.status === 'hovering'
  const distM = distanceMeters([drone.lng, drone.lat], target)
  return {
    distanceKm: Math.round((distM / 1000) * 100) / 100,
    etaSec: arrived ? 0 : Math.round(distM / EMERGENCY_SPEED),
    arrived,
  }
}

export interface LiveSurveyRow {
  droneId: string
  droneName: string
  flyerNote: string
  distanceKm: number
  battery: number
  etaSec: number
  arrived: boolean
  /** 机已不在机队（归舱）：显示初调快照并标注 */
  offline: boolean
}

/** 调配单勘测组行：初调 plan 为骨架，电池/距离/ETA 用机队实时数据覆盖 */
export function liveSurveyRows(plan: DispatchPlan, drones: DroneState[]): LiveSurveyRow[] {
  return plan.survey.map((s) => {
    const d = drones.find((x) => x.id === s.droneId)
    if (!d) return { ...s, arrived: false, offline: true }
    const live = liveEta(d, plan.flood.position)
    return {
      droneId: s.droneId,
      droneName: s.droneName,
      flyerNote: s.flyerNote,
      distanceKm: live.distanceKm,
      battery: d.batteryPct,
      etaSec: live.etaSec,
      arrived: live.arrived,
      offline: false,
    }
  })
}
