import { describe, expect, it } from 'vitest'
import { formatPlace, nearestDistrict } from './place-name'

describe('nearestDistrict 行政区回退表', () => {
  it('市中心坐标 → 黄浦区附近', () => {
    expect(nearestDistrict([121.49, 31.23])).toBe('黄浦区')
  })

  it('浦东坐标 → 浦东新区', () => {
    expect(nearestDistrict([121.70, 31.24])).toBe('浦东新区')
  })

  it('远离所有区中心 → 仍返回最近的区（不抛错）', () => {
    expect(nearestDistrict([120.0, 30.0])).toBeTruthy()
  })
})

describe('formatPlace 地点+坐标文案', () => {
  it('有地名：松江区广富林文化遗址附近（121.5950, 31.1760）', () => {
    expect(formatPlace('松江区广富林文化遗址', [121.595, 31.176]))
      .toBe('松江区广富林文化遗址附近（121.5950, 31.1760）')
  })

  it('无地名回退行政区：黄浦区（121.4900, 31.2300）', () => {
    expect(formatPlace(null, [121.49, 31.23])).toBe('黄浦区（121.4900, 31.2300）')
  })

  it('空字符串地名视为无', () => {
    expect(formatPlace('', [121.49, 31.23])).toContain('黄浦区')
  })
})
