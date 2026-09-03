import { describe, expect, it } from 'vitest'
import { computeScale, DESIGN_HEIGHT, DESIGN_WIDTH } from './useScreenScale'
import { formatClock } from './useClock'

describe('computeScale 大屏适配', () => {
  it('16:9 1920x1080 原尺寸 scale=1 无偏移', () => {
    const r = computeScale(1920, 1080)
    expect(r.scale).toBe(1)
    expect(r.offsetX).toBe(0)
    expect(r.offsetY).toBe(0)
  })

  it('4K 屏等比放大', () => {
    const r = computeScale(3840, 2160)
    expect(r.scale).toBe(2)
  })

  it('32:9 超宽屏按高度适配并水平居中', () => {
    const r = computeScale(5120, 1440)
    expect(r.scale).toBeCloseTo(1440 / DESIGN_HEIGHT)
    expect(r.offsetX).toBeGreaterThan(0)
    expect(r.offsetY).toBe(0)
  })

  it('48:9 三屏拼接不裁切不拉伸', () => {
    const r = computeScale(7680, 1440)
    expect(r.scale).toBeCloseTo(1440 / DESIGN_HEIGHT)
    const shownW = DESIGN_WIDTH * r.scale
    expect(shownW).toBeLessThanOrEqual(7680)
  })

  it('窄屏留白垂直居中', () => {
    const r = computeScale(1280, 1080)
    expect(r.scale).toBeCloseTo(1280 / DESIGN_WIDTH)
    expect(r.offsetY).toBeGreaterThan(0)
  })
})

describe('formatClock 顶栏时钟', () => {
  it('输出 时间/日期/星期 三段', () => {
    const c = formatClock(new Date('2026-05-13T18:18:05')) // 周三
    expect(c.time).toBe('18:18:05')
    expect(c.date).toBe('2026-05-13')
    expect(c.weekday).toBe('星期三')
  })

  it('个位数补零', () => {
    const c = formatClock(new Date('2026-01-02T03:04:05'))
    expect(c.time).toBe('03:04:05')
    expect(c.date).toBe('2026-01-02')
  })
})
