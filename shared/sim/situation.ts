import type { FloodEvent } from './disaster'
import type { FleetState } from './drone-sim'

export type SituationKind = 'water' | 'area' | 'trapped' | 'road' | 'supply'

export interface SituationEvent {
  seq: number
  tick: number
  kind: SituationKind
  text: string
}

export interface SituationState {
  events: SituationEvent[]
  /** 当前水位（米） */
  waterLevelM: number
  /** 水位历史（用于趋势判定） */
  waterHistory: number[]
  /** 估算受淹面积 km² */
  areaKm2: number
  /** 估算被困人数 */
  trapped: number
  /** 已投送物资包数 */
  deliveredPacks: number
}

export type WaterTrend = 'rising' | 'stable' | 'falling'

export interface SituationSummary {
  areaKm2: number
  trapped: number
  waterTrend: WaterTrend
  deliveredPacks: number
  /** 勘测覆盖能力 km²（盘旋机数 × 单机覆盖） */
  coverageKm2: number
  eventCount: number
}

/** 单机盘旋覆盖面积 km²（半径 500m 圆） */
export const COVERAGE_PER_DRONE_KM2 = Math.PI * 0.5 * 0.5

/** 事件流长度上限 */
export const EVENTS_MAX = 30

/** 按灾情等级初始化态势 */
export function initSituation(flood: FloodEvent): SituationState {
  const s = flood.severity
  return {
    events: [],
    waterLevelM: 0.4 + 0.3 * s,
    waterHistory: [0.4 + 0.3 * s],
    areaKm2: Math.round(0.3 * s * 100) / 100,
    trapped: 4 * s,
    deliveredPacks: 0,
  }
}

const EVENT_TEMPLATES: Record<SituationKind, string[]> = {
  water: ['积水深度 %v 米，水流湍急', '水位涨至 %v 米，接近警戒水位'],
  area: ['受淹面积扩大至约 %v km²', '新发现受淹街区，累计 %v km²'],
  trapped: ['发现被困人员约 %v 人，位于屋顶/高处', '热成像识别 %v 名待救援群众'],
  road: ['主干道积水 %v 米，交通中断', '桥梁通行受阻，积水 %v 米'],
  supply: ['现场急需饮用水和食品，缺口约 %v 件', '救生器材不足，缺口 %v 件'],
}

/**
 * 推进一轮现场观测（勘测机在盘旋时调用）。
 * 水位前期上涨概率大，后期趋稳/回落；面积随水位扩大；被困估计缓慢增长。
 */
export function assessSituation(
  state: SituationState,
  rng: () => number,
  tick: number,
  droneName: string,
): SituationState {
  // 水位演化：早期 60% 上涨，随时间推移回落概率增大
  const age = state.events.length
  const riseP = Math.max(0.2, 0.7 - age * 0.05)
  const roll = rng()
  let delta = 0
  if (roll < riseP) delta = 0.05 + rng() * 0.15
  else if (roll > 0.92) delta = -(0.03 + rng() * 0.08)
  const waterLevelM = Math.max(0.1, Math.round((state.waterLevelM + delta) * 100) / 100)
  const waterHistory = [...state.waterHistory, waterLevelM].slice(-6)

  const areaKm2 = Math.round(Math.max(state.areaKm2, state.areaKm2 + Math.max(0, delta) * 2) * 100) / 100
  const trapped = state.trapped + (rng() < 0.55 ? 2 + Math.floor(rng() * 3) : 0)

  const kinds: SituationKind[] = ['water', 'area', 'trapped', 'road', 'supply']
  const kind = kinds[Math.floor(rng() * kinds.length)]
  const v =
    kind === 'water' || kind === 'road' ? waterLevelM
    : kind === 'area' ? areaKm2
    : kind === 'trapped' ? trapped
    : 20 + Math.floor(rng() * 80)
  const template = EVENT_TEMPLATES[kind][Math.floor(rng() * EVENT_TEMPLATES[kind].length)]
  const event: SituationEvent = {
    seq: state.events.length + 1,
    tick,
    kind,
    text: droneName + '：' + template.replace('%v', String(v)),
  }

  return {
    ...state,
    events: [...state.events, event].slice(-EVENTS_MAX),
    waterLevelM,
    waterHistory,
    areaKm2,
    trapped,
  }
}

/**
 * 侦测投送机越过灾点（剩余航段 2→1：物资点 ✓ → 灾点 ✓ → 返舱途中）。
 * 纯函数：传入上一轮的航段计数表，返回本轮新完成空投的无人机 id 与新表。
 */
export function detectSupplyDrops(
  fleet: FleetState,
  prevLegs: Map<string, number>,
): { droppedIds: string[]; nextLegs: Map<string, number> } {
  const droppedIds: string[] = []
  const nextLegs = new Map<string, number>()
  for (const d of fleet.drones) {
    const cur = d.mission === 'delivery' && d.plannedRoute ? d.plannedRoute.length : 0
    if (prevLegs.get(d.id) === 2 && cur === 1) droppedIds.push(d.id)
    nextLegs.set(d.id, cur)
  }
  return { droppedIds, nextLegs }
}

/** 物资投送完成后登记 */
export function recordDelivery(state: SituationState, packs: number): SituationState {
  return { ...state, deliveredPacks: state.deliveredPacks + packs }
}

/** 态势总结 */
export function summarizeSituation(state: SituationState, surveyDroneCount: number): SituationSummary {
  const h = state.waterHistory
  let waterTrend: WaterTrend = 'stable'
  if (h.length >= 3) {
    const last3 = h.slice(-3)
    if (last3[2] > last3[1] && last3[1] > last3[0]) waterTrend = 'rising'
    else if (last3[2] < last3[1] && last3[1] < last3[0]) waterTrend = 'falling'
  }
  return {
    areaKm2: state.areaKm2,
    trapped: state.trapped,
    waterTrend,
    deliveredPacks: state.deliveredPacks,
    coverageKm2: Math.round(surveyDroneCount * COVERAGE_PER_DRONE_KM2 * 100) / 100,
    eventCount: state.events.length,
  }
}

/** 增援触发阈值 */
export const TRAPPED_THRESHOLD = 20
export const SURVEY_LOW_BATTERY = 30

export interface ReinforcementEval {
  needed: boolean
  reasons: string[]
  recommendation: string
}

/**
 * 二次调配评估（规则引擎）：
 * - 受淹面积超出勘测覆盖能力
 * - 水位连续上涨
 * - 被困估计超阈
 * - 勘测机电量不足
 */
export function evaluateReinforcement(
  summary: SituationSummary,
  fleet: FleetState,
): ReinforcementEval {
  const reasons: string[] = []

  if (summary.areaKm2 > summary.coverageKm2) {
    reasons.push('受淹面积 ' + summary.areaKm2 + ' km² 超出现场勘测覆盖能力 ' + summary.coverageKm2 + ' km²')
  }
  if (summary.waterTrend === 'rising') {
    reasons.push('水位持续上涨（最近观测三连涨）')
  }
  if (summary.trapped > TRAPPED_THRESHOLD) {
    reasons.push('被困人员估计 ' + summary.trapped + ' 人，超过阈值 ' + TRAPPED_THRESHOLD + ' 人')
  }
  const surveyLow = fleet.drones.filter((d) => d.mission === 'survey' && d.status !== 'docked' && d.battery < SURVEY_LOW_BATTERY)
  if (surveyLow.length > 0) {
    reasons.push('勘测机 ' + surveyLow.map((d) => d.name).join('、') + ' 电量低于 ' + SURVEY_LOW_BATTERY + '%')
  }

  const needed = reasons.length > 0
  let recommendation = '暂不需要增援，继续监视'
  if (needed) {
    const parts: string[] = []
    if (summary.areaKm2 > summary.coverageKm2) parts.push('次近方舱增派 1 架勘测机')
    if (summary.waterTrend === 'rising' || summary.trapped > TRAPPED_THRESHOLD) parts.push('追加 1 个投送架次（冲锋舟/救生器材优先）')
    if (surveyLow.length > 0) parts.push('派替换机轮班')
    recommendation = '建议二次调配：' + parts.join('；')
  }
  return { needed, reasons, recommendation }
}
