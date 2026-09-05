import { describe, expect, it } from 'vitest'
import { mulberry32, createFleet, createShanghaiRoutes } from './drone-sim'
import { planFloodDispatch, createDisasterEvent, type ShelterInfo, type FlyerInfo } from './disaster'
import type { EmergencyPoint } from './emergency-data'

const SHELTERS: ShelterInfo[] = [
  { id: 4001, name: '1号方舱', position: [121.50, 31.22], spareDrones: 2 },
  { id: 4002, name: '2号方舱', position: [121.55, 31.18], spareDrones: 2 },
]
const FLYERS: FlyerInfo[] = [
  { id: 3001, name: '张三', lastMission: '2026-05-13 07:50' },
  { id: 3002, name: '李四', lastMission: '2026-05-13 15:40' },
]
const SUPPLIES: EmergencyPoint[] = [
  { id: 'supply-1', category: 'supplies', name: '仓库A', position: [121.51, 31.21], detail: '饮用水', status: '可用', org: 'x' },
  { id: 'supply-2', category: 'supplies', name: '仓库B', position: [121.56, 31.19], detail: '救生衣', status: '可用', org: 'y' },
]
const area = { minLng: 121.42, maxLng: 121.62, minLat: 31.16, maxLat: 31.26 }

function setup() {
  const fleet = createFleet(createShanghaiRoutes(), 8, mulberry32(20260513))
  const flood = createDisasterEvent(mulberry32(7), area, 0, 'flood')
  return { fleet, flood }
}

describe('planFloodDispatch picks（大模型选案注入）', () => {
  it('指定勘测机：完全采用 picks 的机与顺序', () => {
    const { fleet, flood } = setup()
    const ids = [fleet.drones[3].id, fleet.drones[0].id]
    const plan = planFloodDispatch(fleet, SHELTERS, FLYERS, SUPPLIES, flood, { surveyDroneIds: ids })
    expect(plan.survey.map((s) => s.droneId)).toEqual(ids)
  })

  it('指定物资点与方舱：投送组采用 picks', () => {
    const { fleet, flood } = setup()
    const plan = planFloodDispatch(fleet, SHELTERS, FLYERS, SUPPLIES, flood, { supplySiteId: 'supply-2', shelterId: 4002 })
    expect(plan.delivery?.supplySiteId).toBe('supply-2')
    expect(plan.delivery?.shelterId).toBe(4002)
  })

  it('picks 引用不存在的资源 → 忽略该项回退自动选择', () => {
    const { fleet, flood } = setup()
    const plan = planFloodDispatch(fleet, SHELTERS, FLYERS, SUPPLIES, flood, { supplySiteId: 'ghost', shelterId: 9999 })
    expect(plan.delivery?.supplySiteId).toBe('supply-1') // 自动最近
    expect(plan.delivery?.shelterId).toBe(4001)
  })

  it('不传 picks：行为与现状完全一致（确定性）', () => {
    const { fleet, flood } = setup()
    const a = planFloodDispatch(fleet, SHELTERS, FLYERS, SUPPLIES, flood)
    const b = planFloodDispatch(fleet, SHELTERS, FLYERS, SUPPLIES, flood, undefined)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})
