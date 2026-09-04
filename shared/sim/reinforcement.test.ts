import { describe, expect, it } from 'vitest'
import { mulberry32 } from './drone-sim'
import { buildReinforcement, createDisasterEvent, type ShelterInfo } from './disaster'

const SHELTERS: ShelterInfo[] = [
  { id: 4001, name: '1号方舱', position: [121.50, 31.22], spareDrones: 2 },
  { id: 4002, name: '2号方舱', position: [121.55, 31.18], spareDrones: 2 },
  { id: 4003, name: '3号方舱', position: [121.60, 31.21], spareDrones: 2 },
  { id: 4004, name: '4号方舱', position: [121.45, 31.19], spareDrones: 1 },
]

const area = { minLng: 121.42, maxLng: 121.62, minLat: 31.16, maxLat: 31.26 }

describe('buildReinforcement 二次调配增援段', () => {
  const flood = createDisasterEvent(mulberry32(9), area, 0)

  it('含方舱名 + R1 增援勘测机', () => {
    const r = buildReinforcement(SHELTERS, flood, false)
    expect(r.shelterName).toContain('方舱')
    expect(r.drones).toEqual([{ droneName: 'DJI-M350-R1', task: '增援勘测' }])
  })

  it('有投送组时追加 R2 增援投送', () => {
    const r = buildReinforcement(SHELTERS, flood, true)
    expect(r.drones.map((d) => d.droneName)).toEqual(['DJI-M350-R1', 'DJI-M350-R2'])
    expect(r.drones[1].task).toContain('增援投送')
  })

  it('增援方舱与初调不同（取次近）且确定性', () => {
    const a = buildReinforcement(SHELTERS, flood, false)
    const b = buildReinforcement(SHELTERS, flood, false)
    expect(a.shelterName).toBe(b.shelterName)
  })
})
