import { readonly, ref } from 'vue'
import type { FlyRecord } from '@/api/types'
import type { LngLat } from '@/sim/drone-sim'

export interface FlightCaseDetail {
  flyRecordId: number
  droneCount: number
  droneNames: string[]
  destinationName: string
  path: LngLat[]
}

type FlightCasePreset = Omit<FlightCaseDetail, 'flyRecordId'>

/**
 * 飞行案例演示轨迹：与台账中的 flyRecordId 一一对应。
 * 当前后端记录尚未保存轨迹点，因此最小改造阶段由前端提供确定性回放数据。
 */
const FLIGHT_CASE_PRESETS: Record<number, FlightCasePreset> = {
  1001: {
    droneCount: 2,
    droneNames: ['DJI-M350-001', 'DJI-M350-002'],
    destinationName: '陆家嘴金融城',
    path: [[121.499, 31.241], [121.506, 31.239], [121.515, 31.232], [121.524, 31.221]],
  },
  1002: {
    droneCount: 3,
    droneNames: ['DJI-M350-003', 'DJI-M350-004', 'DJI-M350-005'],
    destinationName: '虹桥交通枢纽',
    path: [[121.445, 31.189], [121.405, 31.193], [121.36, 31.196], [121.321, 31.197]],
  },
  1003: {
    droneCount: 2,
    droneNames: ['DJI-M350-006', 'DJI-M350-007'],
    destinationName: '徐汇滨江龙华段',
    path: [[121.499, 31.241], [121.482, 31.218], [121.47, 31.194], [121.455, 31.18]],
  },
  1004: {
    droneCount: 3,
    droneNames: ['DJI-M350-001', 'DJI-M350-004', 'DJI-M350-008'],
    destinationName: '北外滩滨江',
    path: [[121.595, 31.205], [121.558, 31.224], [121.526, 31.239], [121.506, 31.253]],
  },
  1005: {
    droneCount: 2,
    droneNames: ['DJI-M350-002', 'DJI-M350-005'],
    destinationName: '张江高科技园区故障点 A',
    path: [[121.445, 31.189], [121.5, 31.195], [121.55, 31.2], [121.602, 31.21]],
  },
  1006: {
    droneCount: 1,
    droneNames: ['DJI-M350-003'],
    destinationName: '人民广场核心区',
    path: [[121.499, 31.241], [121.491, 31.238], [121.48, 31.233], [121.4737, 31.2304]],
  },
  1007: {
    droneCount: 2,
    droneNames: ['DJI-M350-006', 'DJI-M350-008'],
    destinationName: '佘山高压输电走廊',
    path: [[121.333, 31.2], [121.29, 31.18], [121.23, 31.14], [121.19, 31.1]],
  },
  1008: {
    droneCount: 1,
    droneNames: ['DJI-M350-004'],
    destinationName: '张江变电站',
    path: [[121.595, 31.205], [121.605, 31.208], [121.615, 31.198]],
  },
  1009: {
    droneCount: 1,
    droneNames: ['DJI-M350-001'],
    destinationName: '徐汇滨江河道',
    path: [[121.445, 31.189], [121.455, 31.18], [121.47, 31.172]],
  },
  1010: {
    droneCount: 3,
    droneNames: ['DJI-M350-002', 'DJI-M350-005', 'DJI-M350-008'],
    destinationName: '佘山山区巡检点',
    path: [[121.499, 31.241], [121.39, 31.21], [121.28, 31.16], [121.19, 31.1]],
  },
}

const activeFlightCase = ref<FlightCaseDetail | null>(null)

/** 按整条航线长度计算回放位置，避免长航段与短航段使用相同时长。 */
export function pointAlongFlightPath(
  path: readonly (readonly [number, number])[],
  progress: number,
): LngLat | null {
  if (path.length === 0) return null
  if (path.length === 1) return [path[0][0], path[0][1]]

  const lengths: number[] = []
  let total = 0
  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1]
    const to = path[i]
    // 经度按当前纬度折算，足以保证演示航线上的匀速视觉效果。
    const latRad = ((from[1] + to[1]) / 2) * Math.PI / 180
    const length = Math.hypot((to[0] - from[0]) * Math.cos(latRad), to[1] - from[1])
    lengths.push(length)
    total += length
  }
  if (total === 0) return [path[0][0], path[0][1]]

  const target = Math.min(1, Math.max(0, progress)) * total
  let passed = 0
  for (let i = 0; i < lengths.length; i++) {
    const length = lengths[i]
    if (passed + length >= target || i === lengths.length - 1) {
      const ratio = length === 0 ? 0 : (target - passed) / length
      const from = path[i]
      const to = path[i + 1]
      return [
        from[0] + (to[0] - from[0]) * ratio,
        from[1] + (to[1] - from[1]) * ratio,
      ]
    }
    passed += length
  }
  const end = path[path.length - 1]
  return [end[0], end[1]]
}

export function getFlightCaseDetail(record: FlyRecord): FlightCaseDetail {
  const preset = FLIGHT_CASE_PRESETS[record.flyRecordId]
  if (preset) return { flyRecordId: record.flyRecordId, ...preset }

  // 新增台账记录尚未配置轨迹时，仍提供可理解的单机方舱巡检占位信息。
  return {
    flyRecordId: record.flyRecordId,
    droneCount: 1,
    droneNames: ['待分配无人机'],
    destinationName: record.flyRecordName,
    path: [],
  }
}

export function useFlightCases() {
  const showFlightCase = (detail: FlightCaseDetail) => {
    activeFlightCase.value = detail
  }

  const clearFlightCase = () => {
    activeFlightCase.value = null
  }

  return {
    activeFlightCase: readonly(activeFlightCase),
    showFlightCase,
    clearFlightCase,
  }
}
