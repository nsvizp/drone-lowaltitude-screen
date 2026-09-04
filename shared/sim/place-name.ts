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

/** 灾点文案：有具体地名 →「地名附近（坐标）」；否则 →「行政区（坐标）」 */
export function formatPlace(placeName: string | null | undefined, position: LngLat): string {
  const coord = position[0].toFixed(4) + ', ' + position[1].toFixed(4)
  if (placeName && placeName.trim()) return placeName.trim() + '附近（' + coord + '）'
  return nearestDistrict(position) + '（' + coord + '）'
}
