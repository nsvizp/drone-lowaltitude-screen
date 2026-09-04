import { describe, expect, it } from 'vitest'
import { createDisasterEvent, createFloodEvent, DISASTER_NAME, type DisasterKind } from './disaster'
import { mulberry32 } from './drone-sim'

const area = { minLng: 121.42, maxLng: 121.62, minLat: 31.16, maxLat: 31.26 }

describe('灾种扩展（洪灾/泥石流）', () => {
  it('createDisasterEvent 生成泥石流事件，kind 正确', () => {
    const e = createDisasterEvent(mulberry32(7), area, 0, 'debris')
    expect(e.kind).toBe('debris')
    expect(e.id).toContain('debris')
    expect(e.severity).toBeGreaterThanOrEqual(1)
    expect(e.severity).toBeLessThanOrEqual(3)
  })

  it('createDisasterEvent 默认洪灾，且 createFloodEvent 保持兼容', () => {
    const f1 = createDisasterEvent(mulberry32(9), area, 0)
    expect(f1.kind).toBe('flood')
    const f2 = createFloodEvent(mulberry32(9), area, 0)
    expect(f2.kind).toBe('flood')
    expect(f2.id).toContain('flood')
  })

  it('DISASTER_NAME 覆盖两种灾种', () => {
    const names: DisasterKind[] = ['flood', 'debris']
    for (const k of names) expect(DISASTER_NAME[k]).toBeTruthy()
    expect(DISASTER_NAME.flood).toBe('洪灾')
    expect(DISASTER_NAME.debris).toBe('泥石流')
  })
})
