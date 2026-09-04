import { distanceMeters, EMERGENCY_SPEED, type DroneState, type FleetState, type LngLat } from './drone-sim'
import type { EmergencyPoint } from './emergency-data'
import type { BBox } from './emergency-data'

/** 灾种：洪灾 / 泥石流 / 火灾 */
export type DisasterKind = 'flood' | 'debris' | 'fire'

export const DISASTER_NAME: Record<DisasterKind, string> = {
  flood: '洪灾',
  debris: '泥石流',
  fire: '火灾',
}

/** 灾种匹配的物资关键词 */
export const DISASTER_SUPPLY_KEYWORDS: Record<DisasterKind, string[]> = {
  flood: ['饮用水', '食品', '救生', '冲锋舟', '帐篷', '被褥'],
  debris: ['破拆', '绳索', '担架', '急救', '钢', '防护'],
  fire: ['破拆', '急救', '防护', '照明', '中和剂', '氧气'],
}

export interface FloodEvent {
  id: string
  position: LngLat
  /** 严重等级 1~3 */
  severity: 1 | 2 | 3
  createdTick: number
  /** 灾种（历史数据兼容：缺省视为洪灾） */
  kind: DisasterKind
}

export interface ShelterInfo {
  id: number
  name: string
  position: LngLat
  /** 舱内备用机数 */
  spareDrones: number
}

export interface FlyerInfo {
  id: number
  name: string
  /** 最近任务时间 yyyy-MM-dd HH:mm，越早说明休整越充分 */
  lastMission: string
}

/** @deprecated 兼容引用：等价于 DISASTER_SUPPLY_KEYWORDS.flood */
export const FLOOD_SUPPLY_KEYWORDS = DISASTER_SUPPLY_KEYWORDS.flood

/** 勘测机最低电量阈值（%） */
export const SURVEY_MIN_BATTERY = 50
/** 勘测组编制（架） */
export const SURVEY_TEAM_SIZE = 2
/** 投送组编制（架/人） */
export const DELIVERY_TEAM_SIZE = 2
/** 投送机载荷巡航速度 m/s */
export const DELIVERY_SPEED = 12
/** 装卸货时间（分钟） */
export const HANDLING_MINUTES = 5

export interface SurveyAssignment {
  droneId: string
  droneName: string
  flyerNote: string
  distanceKm: number
  battery: number
  etaSec: number
}

export interface DeliveryAssignment {
  shelterId: number
  shelterName: string
  droneCount: number
  flyers: string[]
  supplySiteId: string
  supplySiteName: string
  supplyDetail: string
  /** 航段：方舱 → 物资点 → 灾点 → 方舱 */
  legs: LngLat[]
  totalKm: number
  etaMinutes: number
}

/** 二次调配增援段（执行增援后追加到 plan） */
export interface ReinforcementAssignment {
  /** 增援起飞方舱（次近方舱） */
  shelterName: string
  /** 增援机（名称与后端 launch 固定命名一致，前端按名绑定实时遥测） */
  drones: { droneName: string; task: string }[]
}

export interface DispatchPlan {
  flood: FloodEvent
  survey: SurveyAssignment[]
  delivery: DeliveryAssignment | null
  /** 无法调配时的原因（如电量不足） */
  warnings: string[]
  /** 二次调配增援段（执行后存在） */
  reinforcement?: ReinforcementAssignment
}

/** 构造增援段：次近方舱起飞 R1 勘测，（有投送组时）R2 投送 */
export function buildReinforcement(
  shelters: ShelterInfo[],
  flood: FloodEvent,
  withDelivery: boolean,
): ReinforcementAssignment {
  const shelter = pickShelters(shelters, flood, 2)[1] ?? pickShelters(shelters, flood, 1)[0] ?? shelters[0]
  return {
    shelterName: shelter.name,
    drones: withDelivery
      ? [{ droneName: 'DJI-M350-R1', task: '增援勘测' }, { droneName: 'DJI-M350-R2', task: '增援投送' }]
      : [{ droneName: 'DJI-M350-R1', task: '增援勘测' }],
  }
}

/** 随机生成一处灾情（落在给定范围内，通常用无人机航线包围盒） */
export function createDisasterEvent(rng: () => number, bbox: BBox, tick: number, kind: DisasterKind = 'flood'): FloodEvent {
  return {
    id: kind + '-' + tick,
    kind,
    position: [
      bbox.minLng + rng() * (bbox.maxLng - bbox.minLng),
      bbox.minLat + rng() * (bbox.maxLat - bbox.minLat),
    ],
    severity: (1 + Math.floor(rng() * 3)) as 1 | 2 | 3,
    createdTick: tick,
  }
}

/** @deprecated 兼容旧调用：等价于 createDisasterEvent(..., 'flood') */
export function createFloodEvent(rng: () => number, bbox: BBox, tick: number): FloodEvent {
  return createDisasterEvent(rng, bbox, tick, 'flood')
}

/** 洪灾物资点打分：灾种关键词匹配优先，其次按距离 */
export function pickSupplySite(supplies: EmergencyPoint[], flood: FloodEvent): EmergencyPoint | null {
  if (supplies.length === 0) return null
  const keywords = DISASTER_SUPPLY_KEYWORDS[flood.kind ?? 'flood']
  const matched = supplies.filter((s) => keywords.some((k) => s.detail.includes(k)))
  const pool = matched.length > 0 ? matched : supplies
  return [...pool].sort(
    (a, b) => distanceMeters(a.position, flood.position) - distanceMeters(b.position, flood.position),
  )[0]
}

/** 按距灾点升序挑选有备用机的方舱（初次调配取 1 个，增援取次近） */
export function pickShelters(shelters: ShelterInfo[], flood: FloodEvent, n: number): ShelterInfo[] {
  return [...shelters]
    .filter((s) => s.spareDrones > 0)
    .sort((a, b) => distanceMeters(a.position, flood.position) - distanceMeters(b.position, flood.position))
    .slice(0, n)
}

/** 挑选休整最充分的 n 名飞手（最近任务时间最早优先），不重复 */
export function pickRestedFlyers(flyers: FlyerInfo[], n: number): FlyerInfo[] {
  return [...flyers].sort((a, b) => a.lastMission.localeCompare(b.lastMission)).slice(0, n)
}

/**
 * 洪灾调配引擎（纯函数）：
 * 1. 勘测组：在飞、巡逻中、电量 ≥ 50% 的无人机按距灾点升序取 2 架改飞
 * 2. 投送组：距灾点最近方舱出新机，物资点按灾种匹配>距离选择，飞手按休整充分度指派
 */
export function planFloodDispatch(
  fleet: FleetState,
  shelters: ShelterInfo[],
  flyers: FlyerInfo[],
  supplies: EmergencyPoint[],
  flood: FloodEvent,
): DispatchPlan {
  const warnings: string[] = []

  // --- 勘测组 ---
  const candidates = fleet.drones
    .filter((d: DroneState) => d.status === 'flying' && d.mission === 'patrol' && d.batteryPct >= SURVEY_MIN_BATTERY)
    .map((d) => ({ d, dist: distanceMeters([d.lng, d.lat], flood.position) }))
    .sort((a, b) => a.dist - b.dist)
  const survey: SurveyAssignment[] = candidates.slice(0, SURVEY_TEAM_SIZE).map(({ d, dist }) => ({
    droneId: d.id,
    droneName: d.name,
    flyerNote: '原飞手保持操控',
    distanceKm: Math.round((dist / 1000) * 100) / 100,
    battery: d.batteryPct,
    etaSec: Math.round(dist / EMERGENCY_SPEED), // 改派后提速至应急速度，ETA 按实际口径
  }))
  if (survey.length < SURVEY_TEAM_SIZE) {
    warnings.push('满足电量条件的巡逻机不足 ' + SURVEY_TEAM_SIZE + ' 架，勘测组缺编')
  }

  // --- 投送组 ---
  let delivery: DeliveryAssignment | null = null
  const shelter = pickShelters(shelters, flood, 1)[0]
  if (!shelter) {
    warnings.push('无机库备用机可用，无法组织投送')
  } else {
    const site = pickSupplySite(supplies, flood)
    if (!site) {
      warnings.push('无可用物资点')
    } else {
      const rested = pickRestedFlyers(flyers, DELIVERY_TEAM_SIZE)
      const legs: LngLat[] = [shelter.position, site.position, flood.position, shelter.position]
      let totalM = 0
      for (let i = 1; i < legs.length; i++) totalM += distanceMeters(legs[i - 1], legs[i])
      delivery = {
        shelterId: shelter.id,
        shelterName: shelter.name,
        droneCount: Math.min(DELIVERY_TEAM_SIZE, shelter.spareDrones),
        flyers: rested.map((f) => f.name),
        supplySiteId: site.id,
        supplySiteName: site.name,
        supplyDetail: site.detail,
        legs,
        totalKm: Math.round((totalM / 1000) * 100) / 100,
        etaMinutes: Math.round(totalM / DELIVERY_SPEED / 60) + HANDLING_MINUTES,
      }
      if (rested.length < DELIVERY_TEAM_SIZE) warnings.push('可指派飞手不足 ' + DELIVERY_TEAM_SIZE + ' 名')
    }
  }

  return { flood, survey, delivery, warnings }
}
