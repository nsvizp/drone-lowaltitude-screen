import { describe, expect, it } from 'vitest'
import { mulberry32 } from './drone-sim'
import { createEmergencyData, routesBBox } from './emergency-data'

describe('routesBBox', () => {
  it('包围盒覆盖全部无人机航线范围', () => {
    const bbox = routesBBox()
    expect(bbox.minLng).toBeLessThan(121.32)
    expect(bbox.maxLng).toBeGreaterThan(121.76)
    expect(bbox.minLat).toBeLessThan(31.15)
    expect(bbox.maxLat).toBeGreaterThan(31.25)
  })
})

describe('createEmergencyData', () => {
  const data = createEmergencyData(mulberry32(20260903))

  it('生成三类图层数据：物资 12、人员 20、车辆 15', () => {
    expect(data.supplies).toHaveLength(12)
    expect(data.personnel).toHaveLength(20)
    expect(data.vehicles).toHaveLength(15)
  })

  it('所有点位落在航线包围盒（上海市范围）内', () => {
    const bbox = routesBBox()
    const all = [...data.supplies, ...data.personnel, ...data.vehicles]
    for (const p of all) {
      expect(p.position[0]).toBeGreaterThanOrEqual(bbox.minLng)
      expect(p.position[0]).toBeLessThanOrEqual(bbox.maxLng)
      expect(p.position[1]).toBeGreaterThanOrEqual(bbox.minLat)
      expect(p.position[1]).toBeLessThanOrEqual(bbox.maxLat)
    }
  })

  it('id 全局唯一且字段完整', () => {
    const all = [...data.supplies, ...data.personnel, ...data.vehicles]
    expect(new Set(all.map((p) => p.id)).size).toBe(all.length)
    for (const p of all) {
      expect(p.name).toBeTruthy()
      expect(p.detail).toBeTruthy()
      expect(p.status).toBeTruthy()
      expect(p.org).toBeTruthy()
    }
  })

  it('同一 seed 生成结果确定可复现', () => {
    const a = createEmergencyData(mulberry32(7))
    const b = createEmergencyData(mulberry32(7))
    expect(a).toEqual(b)
  })
})
