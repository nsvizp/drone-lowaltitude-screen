import { createShanghaiRoutes, type LngLat } from './drone-sim'

export type EmergencyCategory = 'supplies' | 'personnel' | 'vehicles'

export interface EmergencyPoint {
  id: string
  category: EmergencyCategory
  /** 点位名称（仓库名 / 队员名 / 车牌号） */
  name: string
  position: LngLat
  /** 类别明细，如「防汛物资 · 500 件」 */
  detail: string
  /** 状态：可用 / 待命 / 出勤中 … */
  status: string
  /** 所属单位 */
  org: string
}

export interface BBox {
  minLng: number
  maxLng: number
  minLat: number
  maxLat: number
}

/** 从无人机航线范围推导数据边界（参考无人机轨迹范围），四周外扩 margin 度 */
export function routesBBox(margin = 0.03): BBox {
  const routes = createShanghaiRoutes()
  const lngs: number[] = []
  const lats: number[] = []
  for (const r of routes) for (const p of r.points) { lngs.push(p[0]); lats.push(p[1]) }
  return {
    minLng: Math.min(...lngs) - margin,
    maxLng: Math.max(...lngs) + margin,
    minLat: Math.min(...lats) - margin,
    maxLat: Math.max(...lats) + margin,
  }
}

const SUPPLY_SITES = [
  { name: '浦东防汛物资仓库', detail: '沙袋 · 救生衣 · 抽水泵', org: '浦东新区应急管理局' },
  { name: '徐汇医疗物资储备点', detail: '急救包 · 担架 · 氧气瓶', org: '徐汇区卫健委' },
  { name: '静安应急食品供应站', detail: '饮用水 · 方便食品', org: '静安区商务委' },
  { name: '杨浦救援装备库', detail: '破拆工具 · 绳索装备', org: '杨浦区消防救援支队' },
  { name: '虹桥综合物资枢纽', detail: '帐篷 · 被褥 · 照明设备', org: '闵行区应急管理局' },
  { name: '张江防疫物资仓', detail: '防护服 · 消杀设备', org: '浦东新区疾控中心' },
  { name: '宝山钢材应急库', detail: '支撑钢梁 · 防护板', org: '宝山区建管委' },
  { name: '嘉定燃油储备点', detail: '柴油 · 汽油 · 发电机油料', org: '嘉定区发改委' },
  { name: '松江通信器材库', detail: '对讲机 · 卫星电话', org: '松江区科委' },
  { name: '青浦水域救援物资点', detail: '冲锋舟 · 救生圈', org: '青浦区水务局' },
  { name: '奉贤临时安置物资站', detail: '折叠床 · 毛毯 · 热食', org: '奉贤区民政局' },
  { name: '金山化工应急物资库', detail: '防化服 · 中和剂', org: '金山区应急管理局' },
]

const PERSONNEL_UNITS = ['消防救援站', '医疗急救中心', '公安特警队', '蓝天救援队', '民兵应急连']
const PERSONNEL_STATUS = ['待命', '出勤中', '备勤']
const SURNAMES = ['王', '李', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '胡', '朱', '高', '林', '何', '郭', '马', '罗']

const VEHICLE_TYPES = [
  { type: '消防车', prefix: '沪A·X', org: '消防救援支队' },
  { type: '救护车', prefix: '沪B·J', org: '医疗急救中心' },
  { type: '警用巡逻车', prefix: '沪C·警', org: '公安分局' },
  { type: '应急指挥车', prefix: '沪D·Z', org: '应急管理局' },
  { type: '物资运输车', prefix: '沪E·W', org: '交通运输局' },
]
const VEHICLE_STATUS = ['待命', '出勤中', '保养中']

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]
}

function randomPoint(bbox: BBox, rng: () => number): LngLat {
  return [
    bbox.minLng + rng() * (bbox.maxLng - bbox.minLng),
    bbox.minLat + rng() * (bbox.maxLat - bbox.minLat),
  ]
}

/** 生成三类应急资源模拟数据，坐标落在无人机航线包围盒内（上海市区范围） */
export function createEmergencyData(rng: () => number): Record<EmergencyCategory, EmergencyPoint[]> {
  const bbox = routesBBox()

  const supplies: EmergencyPoint[] = SUPPLY_SITES.map((site, i) => ({
    id: 'supply-' + (i + 1),
    category: 'supplies',
    name: site.name,
    position: randomPoint(bbox, rng),
    detail: site.detail + ' · ' + (100 + Math.floor(rng() * 900)) + ' 件',
    status: '可用',
    org: site.org,
  }))

  const personnel: EmergencyPoint[] = []
  for (let i = 0; i < 20; i++) {
    const unit = pick(PERSONNEL_UNITS, rng)
    const surname = SURNAMES[i % SURNAMES.length]
    personnel.push({
      id: 'person-' + (i + 1),
      category: 'personnel',
      name: surname + '队长',
      position: randomPoint(bbox, rng),
      detail: unit + ' · ' + (3 + Math.floor(rng() * 8)) + ' 人小组',
      status: pick(PERSONNEL_STATUS, rng),
      org: unit,
    })
  }

  const vehicles: EmergencyPoint[] = []
  for (let i = 0; i < 15; i++) {
    const v = pick(VEHICLE_TYPES, rng)
    vehicles.push({
      id: 'vehicle-' + (i + 1),
      category: 'vehicles',
      name: v.prefix + String(1000 + Math.floor(rng() * 9000)),
      position: randomPoint(bbox, rng),
      detail: v.type + ' · ' + pick(['2 人', '4 人', '6 人'], rng) + ' 编组',
      status: pick(VEHICLE_STATUS, rng),
      org: v.org,
    })
  }

  return { supplies, personnel, vehicles }
}
