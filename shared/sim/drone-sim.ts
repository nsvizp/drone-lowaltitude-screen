/** 经纬度坐标 [lng, lat] */
export type LngLat = [number, number]

export interface DroneRoute {
  id: string
  name: string
  points: LngLat[]
}

export type DroneStatus = 'flying' | 'hovering' | 'returning' | 'docked'

/** 任务类型：巡逻 / 抢险勘测 / 物资投送 */
export type Mission = 'patrol' | 'survey' | 'delivery'

/** 电池状态：正常 / 低电 / 严重低电 / 充电中 / 已充满 */
export type BatteryState = 'normal' | 'low' | 'critical' | 'charging' | 'full'

/** 返航原因：低电 / 航线完成 / 任务完成 / 人工召回 */
export type ReturnReason = 'low_battery' | 'route_complete' | 'mission_complete' | 'manual_recall' | null

export interface DroneState {
  id: string
  name: string
  status: DroneStatus
  mission: Mission
  lng: number
  lat: number
  /** 航向角，度，0=正北，顺时针 */
  heading: number
  /** 速度 m/s */
  speed: number
  /** 当前剩余电量百分比，计算保留三位小数，展示保留一位小数 */
  batteryPct: number
  batteryState: BatteryState
  returnReason: ReturnReason
  /** 遥测序号，用于前端丢弃乱序快照 */
  telemetrySeq: number
  /** 遥测采样时间（Unix 毫秒） */
  telemetryAt: number
  altitude: number
  routeId: string
  routeName: string
  /** 当前航线进度 0..1（巡逻用） */
  progress: number
  taskName: string
  /** 航迹（飞过的位置，新点追加在尾部，最多保留 TRACK_MAX 个） */
  track: LngLat[]
  /** 计划航线：改派/投送时的剩余途经点；null 表示沿固定巡逻航线 */
  plannedRoute: LngLat[] | null
  /** 盘旋中心（勘测到达灾点后绕圈） */
  orbitCenter: LngLat | null
  /** 盘旋角度（弧度） */
  orbitAngle: number
  /** 归属点（方舱/航线起点），低电量返航目标 */
  home: LngLat
  /** 归舱时刻（tick），未归舱为 null；用于保留期清理 */
  dockedAt: number | null
}

export interface FleetState {
  drones: DroneState[]
  tickCount: number
}

/** 航迹最大保留点数（1s tick 下约 10 分钟） */
export const TRACK_MAX = 200
/** 到达途经点的判定阈值（米） */
export const ARRIVAL_THRESHOLD_M = 40
/** 勘测盘旋半径（米） */
export const ORBIT_RADIUS_M = 500
/** 统一电量阈值：低电告警 / 自动返航 / 严重低电 */
export const LOW_BATTERY_PERCENT = 25
export const AUTO_RETURN_PERCENT = 20
export const CRITICAL_BATTERY_PERCENT = 10
/** 应急改飞速度 m/s（勘测/增援改派时提速至此） */
export const EMERGENCY_SPEED = 22
/** 归舱后保留 tick 数（无航线机型超过即清理出机队） */
export const DOCKED_RETENTION_TICKS = 300

/** mulberry32 确定性伪随机数发生器，便于测试复现 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const EARTH_RADIUS = 6378137

/** 两点间大圆距离（米） */
export function distanceMeters(a: LngLat, b: LngLat): number {
  const rad = Math.PI / 180
  const dLat = (b[1] - a[1]) * rad
  const dLng = (b[0] - a[0]) * rad
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(h))
}

/** 航向角（度，0=正北顺时针） */
export function bearingDegrees(a: LngLat, b: LngLat): number {
  const rad = Math.PI / 180
  const dLng = (b[0] - a[0]) * rad
  const y = Math.sin(dLng) * Math.cos(b[1] * rad)
  const x =
    Math.cos(a[1] * rad) * Math.sin(b[1] * rad) -
    Math.sin(a[1] * rad) * Math.cos(b[1] * rad) * Math.cos(dLng)
  return (Math.atan2(y, x) / rad + 360) % 360
}

/** 从 from 朝 to 前进 distMeters 米后的新位置（可能越过 to，调用方负责到达判定） */
export function moveTowards(from: LngLat, to: LngLat, distMeters_: number): LngLat {
  const total = distanceMeters(from, to)
  if (total === 0) return [to[0], to[1]]
  const t = Math.min(1, distMeters_ / total)
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]
}

/** 航线总长（米） */
export function routeLengthMeters(route: DroneRoute): number {
  let total = 0
  for (let i = 1; i < route.points.length; i++) {
    total += distanceMeters(route.points[i - 1], route.points[i])
  }
  return total
}

/** 沿航线前进 distance 米后的位置与航向 */
export function pointAlongRoute(
  route: DroneRoute,
  distance: number,
): { position: LngLat; heading: number; progress: number } {
  const total = routeLengthMeters(route)
  const d = Math.max(0, Math.min(distance, total))
  let acc = 0
  for (let i = 1; i < route.points.length; i++) {
    const from = route.points[i - 1]
    const to = route.points[i]
    const seg = distanceMeters(from, to)
    if (acc + seg >= d || i === route.points.length - 1) {
      const t = seg === 0 ? 0 : (d - acc) / seg
      const position: LngLat = [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]
      return { position, heading: bearingDegrees(from, to), progress: total === 0 ? 0 : d / total }
    }
    acc += seg
  }
  return { position: route.points[0], heading: 0, progress: 0 }
}

/** 上海市中心 */
export const SHANGHAI_CENTER: LngLat = [121.4737, 31.2304]

/** 生成上海区域的示范巡检航线（覆盖陆家嘴/外滩/虹桥/张江/徐汇滨江/浦东机场方向） */
export function createShanghaiRoutes(): DroneRoute[] {
  return [
    {
      id: 'route-lpj',
      name: '陆家嘴环巡线',
      points: [
        [121.5014, 31.2397], [121.5150, 31.2320], [121.5240, 31.2210],
        [121.5100, 31.2140], [121.4980, 31.2260],
      ],
    },
    {
      id: 'route-wt',
      name: '外滩-北外滩线',
      points: [
        [121.4900, 31.2390], [121.4970, 31.2480], [121.5060, 31.2530],
        [121.5160, 31.2460], [121.5050, 31.2350],
      ],
    },
    {
      id: 'route-hq',
      name: '虹桥枢纽线',
      points: [
        [121.3200, 31.1940], [121.3360, 31.2020], [121.3520, 31.2100],
        [121.3400, 31.2180], [121.3240, 31.2080],
      ],
    },
    {
      id: 'route-zj',
      name: '张江高科线',
      points: [
        [121.5870, 31.2040], [121.6020, 31.2100], [121.6150, 31.1980],
        [121.6000, 31.1880], [121.5850, 31.1950],
      ],
    },
    {
      id: 'route-xh',
      name: '徐汇滨江线',
      points: [
        [121.4370, 31.1880], [121.4550, 31.1800], [121.4700, 31.1720],
        [121.4800, 31.1850], [121.4600, 31.1940],
      ],
    },
    {
      id: 'route-pd',
      name: '浦东机场方向线',
      points: [
        [121.7000, 31.1500], [121.7300, 31.1450], [121.7600, 31.1500],
        [121.7350, 31.1650], [121.7050, 31.1600],
      ],
    },
  ]
}

const TASK_NAMES = ['交通巡查', '事故识别', '重点区域巡航', '烟雾监测', '人流统计', '夜间巡检']

/** 创建机队：每架无人机分配一条航线，初始随机落在航线前半段 */
export function createFleet(routes: DroneRoute[], count: number, rng: () => number = Math.random): FleetState {
  const drones: DroneState[] = []
  const telemetryAt = Date.now()
  for (let i = 0; i < count; i++) {
    const route = routes[i % routes.length]
    const startDistance = routeLengthMeters(route) * rng() * 0.5
    const { position, heading, progress } = pointAlongRoute(route, startDistance)
    const batteryPct = 60 + Math.round(rng() * 40)
    drones.push({
      id: 'drone-' + (i + 1),
      name: 'DJI-M350-' + String(i + 1).padStart(3, '0'),
      status: 'flying',
      mission: 'patrol',
      lng: position[0],
      lat: position[1],
      heading,
      speed: 12 + rng() * 6, // 12~18 m/s
      batteryPct,
      batteryState: batteryStateOf(batteryPct, 'flying'),
      returnReason: null,
      telemetrySeq: 0,
      telemetryAt,
      altitude: 80 + Math.round(rng() * 40), // 80~120 m
      routeId: route.id,
      routeName: route.name,
      progress,
      taskName: TASK_NAMES[Math.floor(rng() * TASK_NAMES.length)],
      track: [[position[0], position[1]]],
      plannedRoute: null,
      orbitCenter: null,
      orbitAngle: 0,
      home: route.points[0],
      dockedAt: null,
    })
  }
  return { drones, tickCount: 0 }
}

function findRoute(routes: DroneRoute[], id: string): DroneRoute {
  const route = routes.find((r) => r.id === id)
  if (!route) throw new Error('route not found: ' + id)
  return route
}

/** 电量每模拟秒消耗 0.004%；后端按 3 倍模拟速度推进 */
export const BATTERY_DRAIN_PER_SEC = 0.004

/** 限制到 0~100，并保留三位小数，避免每帧取一位小数导致耗电量被吞掉 */
function normalizeBattery(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 1000) / 1000))
}

function drainBattery(batteryPct: number, dtSec: number): number {
  return normalizeBattery(batteryPct - BATTERY_DRAIN_PER_SEC * dtSec)
}

export function batteryStateOf(batteryPct: number, status: DroneStatus): BatteryState {
  if (status === 'docked') return batteryPct >= 100 ? 'full' : 'charging'
  if (batteryPct <= CRITICAL_BATTERY_PERCENT) return 'critical'
  if (batteryPct <= LOW_BATTERY_PERCENT) return 'low'
  return 'normal'
}

function appendTrack(track: LngLat[], pos: LngLat): LngLat[] {
  const next = track.length >= TRACK_MAX ? track.slice(track.length - TRACK_MAX + 1) : track.slice()
  next.push([pos[0], pos[1]])
  return next
}

/** 盘旋：绕 orbitCenter 以 ORBIT_RADIUS_M 半径转圈 */
function orbitStep(drone: DroneState, dtSec: number): DroneState {
  const center = drone.orbitCenter!
  const angular = (drone.speed * dtSec) / ORBIT_RADIUS_M
  const angle = drone.orbitAngle + angular
  const latRadius = ORBIT_RADIUS_M / 111320
  const lngRadius = ORBIT_RADIUS_M / (111320 * Math.cos((center[1] * Math.PI) / 180))
  const lng = center[0] + lngRadius * Math.cos(angle)
  const lat = center[1] + latRadius * Math.sin(angle)
  return {
    ...drone,
    lng,
    lat,
    heading: ((angle * 180) / Math.PI + 90 + 360) % 360,
    orbitAngle: angle,
    batteryPct: drainBattery(drone.batteryPct, dtSec),
    track: appendTrack(drone.track, [lng, lat]),
  }
}

/** 途经点跟随：朝 plannedRoute[0] 飞，到达后按任务类型推进 */
function waypointStep(drone: DroneState, dtSec: number): DroneState {
  const target = drone.plannedRoute![0]
  const travel = drone.speed * dtSec
  const dist = distanceMeters([drone.lng, drone.lat], target)
  const batteryPct = drainBattery(drone.batteryPct, dtSec)

  if (dist <= Math.max(travel, ARRIVAL_THRESHOLD_M)) {
    // 到达当前途经点
    const rest = drone.plannedRoute!.slice(1)
    if (rest.length === 0) {
      if (drone.mission === 'survey' && drone.status !== 'returning') {
        // 到达灾点 → 盘旋勘测（返航到家不在此列）
        return {
          ...drone, lng: target[0], lat: target[1], batteryPct,
          status: 'hovering', orbitCenter: target, orbitAngle: 0, plannedRoute: null,
          returnReason: null,
          track: appendTrack(drone.track, target),
        }
      }
      // 投送完成/返航到家 → 归舱换电
      return {
        ...drone, lng: target[0], lat: target[1], batteryPct: 100,
        status: 'docked', plannedRoute: null,
        track: appendTrack(drone.track, target),
      }
    }
    return {
      ...drone, lng: target[0], lat: target[1], batteryPct,
      status: drone.mission === 'delivery' && rest.length === 1 ? 'returning' : drone.status,
      returnReason: drone.mission === 'delivery' && rest.length === 1 ? 'mission_complete' : drone.returnReason,
      plannedRoute: rest, track: appendTrack(drone.track, target),
    }
  }

  const next = moveTowards([drone.lng, drone.lat], target, travel)
  return {
    ...drone,
    lng: next[0], lat: next[1],
    heading: bearingDegrees([drone.lng, drone.lat], target),
    batteryPct,
    track: appendTrack(drone.track, next),
  }
}

/** 巡逻：沿固定航线往返（既有逻辑） */
function patrolStep(drone: DroneState, routes: DroneRoute[], dtSec: number): DroneState {
  const route = findRoute(routes, drone.routeId)
  const total = routeLengthMeters(route)
  const travel = drone.speed * dtSec
  const direction = drone.status === 'returning' ? -1 : 1
  let currentDistance = drone.progress * total + travel * direction
  let status: DroneStatus = drone.status
  let batteryPct = drainBattery(drone.batteryPct, dtSec)
  let returnReason = drone.returnReason

  if (currentDistance >= total) {
    currentDistance = total
    status = 'returning'
    returnReason = 'route_complete'
  } else if (currentDistance <= 0) {
    currentDistance = 0
    status = 'flying'
    batteryPct = 100 // 回巢换电
    returnReason = null
  }
  if (batteryPct <= AUTO_RETURN_PERCENT && status === 'flying') {
    status = 'returning'
    returnReason = 'low_battery'
  }

  const { position, heading } = pointAlongRoute(route, currentDistance)
  return {
    ...drone,
    status,
    lng: position[0],
    lat: position[1],
    heading: status === 'returning' ? (heading + 180) % 360 : heading,
    batteryPct,
    returnReason,
    progress: total === 0 ? 0 : currentDistance / total,
    track: appendTrack(drone.track, position),
  }
}

/**
 * 推进机队 dtMs 毫秒。纯函数：返回新状态，不修改入参。
 * - 巡逻机沿固定航线往返，回巢满电
 * - 改派机沿 plannedRoute 途经点飞行：勘测机到终点盘旋，投送机走完航段归舱
 * - 盘旋机低电量自动返航回家
 */
export function advanceFleet(
  state: FleetState,
  routes: DroneRoute[],
  dtMs: number,
  telemetryAt = Date.now(),
): FleetState {
  const dtSec = dtMs / 1000
  const nextTick = state.tickCount + 1
  const stepped = state.drones.map((drone) => {
    if (drone.status === 'docked') {
      // 勘测机回巢换电完毕 → 回到自己的固定巡逻航线重新上岗（home 即航线起点，无跳变）
      // 无巡逻航线的增援机（routeId 不在 routes 中）留在舱内待命
      if (drone.mission === 'survey' && routes.some((r) => r.id === drone.routeId)) {
        return {
          ...drone,
          mission: 'patrol' as Mission,
          status: 'flying' as DroneStatus,
          plannedRoute: null,
          orbitCenter: null,
          orbitAngle: 0,
          progress: 0,
          returnReason: null,
        }
      }
      return drone
    }

    if (drone.status === 'hovering' && drone.orbitCenter) {
      const stepped = orbitStep(drone, dtSec)
      if (stepped.batteryPct <= AUTO_RETURN_PERCENT) {
        return {
          ...stepped,
          status: 'returning' as DroneStatus,
          returnReason: 'low_battery' as ReturnReason,
          orbitCenter: null,
          plannedRoute: [stepped.home],
        }
      }
      return stepped
    }

    if (drone.plannedRoute && drone.plannedRoute.length > 0) {
      const stepped = waypointStep(drone, dtSec)
      if (
        stepped.status !== 'docked' &&
        stepped.status !== 'returning' &&
        stepped.batteryPct <= AUTO_RETURN_PERCENT
      ) {
        return {
          ...stepped,
          status: 'returning' as DroneStatus,
          returnReason: 'low_battery' as ReturnReason,
          orbitCenter: null,
          plannedRoute: [stepped.home],
        }
      }
      return stepped
    }

    return patrolStep(drone, routes, dtSec)
  })
  // 新归舱的盖章 dockedAt；无航线机型超过保留期后清理出机队
  const stamped = stepped.map((d, i) => {
    const withDockedAt = d.status === 'docked' && state.drones[i].status !== 'docked'
      ? { ...d, dockedAt: nextTick }
      : d
    return {
      ...withDockedAt,
      batteryPct: normalizeBattery(withDockedAt.batteryPct),
      batteryState: batteryStateOf(withDockedAt.batteryPct, withDockedAt.status),
      telemetrySeq: nextTick,
      telemetryAt,
    }
  })
  const drones = stamped.filter(
    (d) =>
      !(
        d.status === 'docked' &&
        d.dockedAt !== null &&
        nextTick - d.dockedAt > DOCKED_RETENTION_TICKS &&
        !routes.some((r) => r.id === d.routeId)
      ),
  )
  return { drones, tickCount: nextTick }
}

/** 改派一架无人机飞往目标点执行任务（勘测用）。纯函数。 */
export function divertDrone(state: FleetState, droneId: string, target: LngLat, mission: Mission): FleetState {
  return {
    ...state,
    drones: state.drones.map((d) =>
      d.id === droneId
        ? {
            ...d,
            mission,
            status: 'flying' as DroneStatus,
            returnReason: null,
            plannedRoute: [target],
            orbitCenter: null,
            progress: 0,
            speed: Math.max(d.speed, EMERGENCY_SPEED),
          }
        : d,
    ),
  }
}

/** 演练结束撤机：任务机（勘测/投送）立即返航回家归舱。巡航/归舱机不受影响。纯函数。 */
export function recallDrone(state: FleetState, droneId: string): FleetState {
  return {
    ...state,
    drones: state.drones.map((d) =>
      d.id === droneId && d.mission !== 'patrol' && d.status !== 'docked'
        ? {
            ...d,
            status: 'returning' as DroneStatus,
            returnReason: 'manual_recall' as ReturnReason,
            orbitCenter: null,
            plannedRoute: [d.home],
          }
        : d,
    ),
  }
}

/** 批量召回所有任务机。纯函数。 */
export function recallMissionDrones(state: FleetState): FleetState {
  let next = state
  for (const d of state.drones) {
    if (d.mission !== 'patrol') next = recallDrone(next, d.id)
  }
  return next
}

let deliverySeq = 0

/** 方舱临时起飞参数，供前后端共享模拟器调用。 */
export interface LaunchOptions {
  name?: string
  home: LngLat
  waypoints: LngLat[]
  taskName: string
  mission?: Mission
}

/** 从方舱起飞一架投送机，沿 waypoints（物资点 → 灾点 → 回舱）飞行。纯函数。 */
export function launchDrone(
  state: FleetState,
  opts: LaunchOptions,
): FleetState {
  deliverySeq += 1
  const telemetryAt = Date.now()
  const drone: DroneState = {
    id: 'delivery-' + deliverySeq,
    name: opts.name ?? 'DJI-M350-D' + String(deliverySeq).padStart(2, '0'),
    status: 'flying',
    mission: opts.mission ?? 'delivery',
    lng: opts.home[0],
    lat: opts.home[1],
    heading: 0,
    speed: 12,
    batteryPct: 100,
    batteryState: 'normal',
    returnReason: null,
    telemetrySeq: state.tickCount,
    telemetryAt,
    altitude: 100,
    routeId: '',
    routeName: '临时投送航线',
    progress: 0,
    taskName: opts.taskName,
    track: [[opts.home[0], opts.home[1]]],
    plannedRoute: opts.waypoints.slice(),
    orbitCenter: null,
    orbitAngle: 0,
    home: opts.home,
    dockedAt: null,
  }
  return { ...state, drones: [...state.drones, drone] }
}

/** 派生统计：飞行中（含盘旋作业）/ 返航中 / 低电量（不含已归舱），与地图可见 marker 口径一致 */
export function fleetSummary(state: FleetState): { flying: number; returning: number; lowBattery: number } {
  const active = state.drones.filter((d) => d.status !== 'docked')
  return {
    flying: active.filter((d) => d.status === 'flying' || d.status === 'hovering').length,
    returning: active.filter((d) => d.status === 'returning').length,
    lowBattery: active.filter((d) => d.batteryPct <= LOW_BATTERY_PERCENT).length,
  }
}
