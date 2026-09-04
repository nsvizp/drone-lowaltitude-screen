import type { FleetState } from './drone-sim'
import type { SituationState } from './situation'

// ---------- 物资仓储（mock 仓储台账，后端接入后替换为接口） ----------
export interface WarehouseRow {
  name: string
  org: string
  /** 主要物资 */
  items: string
  /** 当前库存（件） */
  stock: number
  /** 库容量（件） */
  capacity: number
  /** 库存占比 % */
  percent: number
}

interface WarehouseSpec {
  name: string
  org: string
  items: string
  stock: number
  capacity: number
}

const WAREHOUSES: WarehouseSpec[] = [
  { name: '浦东防汛物资仓库', org: '浦东新区应急管理局', items: '沙袋 · 救生衣 · 抽水泵', stock: 4680, capacity: 6000 },
  { name: '徐汇医疗物资储备点', org: '徐汇区卫健委', items: '急救包 · 担架 · 氧气瓶', stock: 2350, capacity: 3000 },
  { name: '静安应急食品供应站', org: '静安区商务委', items: '饮用水 · 方便食品', stock: 9200, capacity: 12000 },
  { name: '杨浦救援装备库', org: '杨浦区消防救援支队', items: '破拆工具 · 绳索装备', stock: 1120, capacity: 1500 },
  { name: '虹桥综合物资枢纽', org: '闵行区应急管理局', items: '帐篷 · 被褥 · 照明设备', stock: 5400, capacity: 8000 },
  { name: '张江防疫物资仓', org: '浦东新区疾控中心', items: '防护服 · 消杀设备', stock: 3100, capacity: 5000 },
  { name: '宝山钢材应急库', org: '宝山区建管委', items: '支撑钢梁 · 防护板', stock: 860, capacity: 1000 },
  { name: '嘉定燃油储备点', org: '嘉定区发改委', items: '柴油 · 汽油 · 发电机油料', stock: 1750, capacity: 2000 },
  { name: '松江通信器材库', org: '松江区科委', items: '对讲机 · 卫星电话', stock: 640, capacity: 1200 },
  { name: '青浦水域救援物资点', org: '青浦区水务局', items: '冲锋舟 · 救生圈', stock: 430, capacity: 600 },
  { name: '奉贤临时安置物资站', org: '奉贤区民政局', items: '折叠床 · 毛毯 · 热食', stock: 2900, capacity: 4000 },
  { name: '金山化工应急物资库', org: '金山区应急管理局', items: '防化服 · 中和剂', stock: 980, capacity: 1500 },
]

/** 仓储台账 → 面板行（纯函数） */
export function buildWarehouseRows(): WarehouseRow[] {
  return WAREHOUSES.map((w) => ({ ...w, percent: Math.round((w.stock / w.capacity) * 100) }))
}

// ---------- 物资调度（实时机队 + 现场态势推导） ----------
export interface DispatchRow {
  drone: string
  task: string
  statusText: string
}

export interface DispatchBoard {
  rows: DispatchRow[]
  /** 在途架次 */
  inflight: number
  /** 已投送件数 */
  deliveredPacks: number
}

const DELIVERY_STATUS_TEXT: Record<string, string> = {
  flying: '运输中',
  hovering: '空投中',
  returning: '返航中',
  docked: '已完成',
}

/** 机队 + 态势 → 调度面板数据（纯函数） */
export function buildDispatchRows(fleet: FleetState, situation: SituationState | null): DispatchBoard {
  const deliveries = fleet.drones.filter((d) => d.mission === 'delivery')
  const rows: DispatchRow[] = deliveries.map((d) => ({
    drone: d.name,
    task: d.taskName,
    statusText: DELIVERY_STATUS_TEXT[d.status] ?? d.status,
  }))
  return {
    rows,
    inflight: deliveries.filter((d) => d.status === 'flying' || d.status === 'hovering').length,
    deliveredPacks: situation?.deliveredPacks ?? 0,
  }
}
