/** 经纬度坐标 [lng, lat] */
export type LngLat = [number, number]

export interface DroneRoute {
  id: string
  name: string
  points: LngLat[]
}

export type DroneStatus = 'flying' | 'hovering' | 'returning'

export interface DroneState {
  id: string
  name: string
  status: DroneStatus
  lng: number
  lat: number
  /** 航向角，度，0=正北，顺时针 */
  heading: number
  /** 速度 m/s */
  speed: number
  battery: number
  altitude: number
  routeId: string
  routeName: string
  /** 当前航线进度 0..1 */
  progress: number
  taskName: string
}

export interface FleetState {
  drones: DroneState[]
  tickCount: number
}

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
  // 不可达（上面循环必然返回），仅为类型完备
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
  for (let i = 0; i < count; i++) {
    const route = routes[i % routes.length]
    const startDistance = routeLengthMeters(route) * rng() * 0.5
    const { position, heading, progress } = pointAlongRoute(route, startDistance)
    drones.push({
      id: 'drone-' + (i + 1),
      name: 'DJI-M350-' + String(i + 1).padStart(3, '0'),
      status: 'flying',
      lng: position[0],
      lat: position[1],
      heading,
      speed: 12 + rng() * 6, // 12~18 m/s
      battery: 60 + Math.round(rng() * 40),
      altitude: 80 + Math.round(rng() * 40), // 80~120 m
      routeId: route.id,
      routeName: route.name,
      progress,
      taskName: TASK_NAMES[Math.floor(rng() * TASK_NAMES.length)],
    })
  }
  return { drones, tickCount: 0 }
}

function findRoute(routes: DroneRoute[], id: string): DroneRoute {
  const route = routes.find((r) => r.id === id)
  if (!route) throw new Error('route not found: ' + id)
  return route
}

/** 电量每秒消耗 0.004%（演示节奏），回巢充满 */
const BATTERY_DRAIN_PER_SEC = 0.004

/**
 * 推进机队 dtMs 毫秒。纯函数：返回新状态，不修改入参。
 * 无人机沿航线匀速飞行；到终点后进入 returning（沿原航线反向折返），回到起点后满电重新出发。
 */
export function advanceFleet(state: FleetState, routes: DroneRoute[], dtMs: number): FleetState {
  const dtSec = dtMs / 1000
  const drones = state.drones.map((drone) => {
    const route = findRoute(routes, drone.routeId)
    const total = routeLengthMeters(route)
    const travel = drone.speed * dtSec
    const direction = drone.status === 'returning' ? -1 : 1
    let currentDistance = drone.progress * total + travel * direction
    let status: DroneStatus = drone.status
    let battery = drone.battery - BATTERY_DRAIN_PER_SEC * dtSec

    if (currentDistance >= total) {
      currentDistance = total
      status = 'returning'
    } else if (currentDistance <= 0) {
      currentDistance = 0
      status = 'flying'
      battery = 100 // 回巢换电
    }
    if (battery < 15 && status === 'flying') {
      status = 'returning' // 低电量强制返航
    }

    const { position, heading } = pointAlongRoute(route, currentDistance)
    return {
      ...drone,
      status,
      lng: position[0],
      lat: position[1],
      heading: status === 'returning' ? (heading + 180) % 360 : heading,
      battery: Math.max(0, Math.round(battery * 10) / 10),
      progress: total === 0 ? 0 : currentDistance / total,
    }
  })
  return { drones, tickCount: state.tickCount + 1 }
}

/** 派生统计：飞行中 / 返航中 / 低电量 */
export function fleetSummary(state: FleetState): { flying: number; returning: number; lowBattery: number } {
  return {
    flying: state.drones.filter((d) => d.status === 'flying').length,
    returning: state.drones.filter((d) => d.status === 'returning').length,
    lowBattery: state.drones.filter((d) => d.battery < 25).length,
  }
}
