import { distanceMeters, type LngLat } from './drone-sim'

/** 上海 16 区中心（逆地理编码不可用时的回退） */
const DISTRICTS: { name: string; center: LngLat }[] = [
  { name: '黄浦区', center: [121.490, 31.230] },
  { name: '徐汇区', center: [121.437, 31.188] },
  { name: '长宁区', center: [121.424, 31.220] },
  { name: '静安区', center: [121.459, 31.247] },
  { name: '普陀区', center: [121.407, 31.263] },
  { name: '虹口区', center: [121.498, 31.269] },
  { name: '杨浦区', center: [121.526, 31.275] },
  { name: '闵行区', center: [121.382, 31.112] },
  { name: '宝山区', center: [121.489, 31.405] },
  { name: '嘉定区', center: [121.265, 31.298] },
  { name: '浦东新区', center: [121.638, 31.221] },
  { name: '金山区', center: [121.341, 30.742] },
  { name: '松江区', center: [121.228, 31.032] },
  { name: '青浦区', center: [121.124, 31.150] },
  { name: '奉贤区', center: [121.474, 30.918] },
  { name: '崇明区', center: [121.625, 31.624] },
]

/** 上海公开地标（逆地理不可用时的次精度回退：区 + 近地标） */
const LANDMARKS: { name: string; position: LngLat }[] = [
  { name: '上海站', position: [121.455, 31.249] },
  { name: '上海虹桥国际机场', position: [121.336, 31.198] },
  { name: '上海西站', position: [121.400, 31.263] },
  { name: '上海南站', position: [121.430, 31.154] },
  { name: '南翔古镇', position: [121.312, 31.296] },
  { name: '共青森林公园', position: [121.547, 31.320] },
  { name: '世纪公园', position: [121.551, 31.219] },
  { name: '东方体育中心', position: [121.481, 31.156] },
  { name: '迪士尼度假区', position: [121.658, 31.144] },
  { name: '浦东国际机场', position: [121.805, 31.152] },
  { name: '闵行体育公园', position: [121.372, 31.144] },
  { name: '广富林文化遗址', position: [121.198, 31.060] },
  { name: '东方明珠', position: [121.500, 31.240] },
  { name: '徐汇滨江', position: [121.460, 31.180] },
]

/** 最近地标（超过 maxKm 视为不可靠，返回 null） */
export function nearestLandmark(position: LngLat, maxKm = 3): string | null {
  let best: string | null = null
  let bestDist = maxKm * 1000
  for (const l of LANDMARKS) {
    const d = distanceMeters(l.position, position)
    if (d < bestDist) { bestDist = d; best = l.name }
  }
  return best
}

/** 距坐标最近的行政区（回退用） */
export function nearestDistrict(position: LngLat): string {
  let best = DISTRICTS[0]
  let bestDist = Infinity
  for (const d of DISTRICTS) {
    const dist = distanceMeters(d.center, position)
    if (dist < bestDist) { bestDist = dist; best = d }
  }
  return best.name
}

/** 灾点文案：有具体地名 →「地名附近（坐标）」；否则 →「行政区·近地标（坐标）」或「行政区（坐标）」 */
export function formatPlace(placeName: string | null | undefined, position: LngLat): string {
  const coord = position[0].toFixed(4) + ', ' + position[1].toFixed(4)
  if (placeName && placeName.trim()) return placeName.trim() + '附近（' + coord + '）'
  const landmark = nearestLandmark(position)
  const district = nearestDistrict(position)
  return landmark ? district + '·近' + landmark + '（' + coord + '）' : district + '（' + coord + '）'
}
