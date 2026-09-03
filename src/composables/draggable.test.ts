import { describe, expect, it } from 'vitest'
import { clampPosition, computeResized } from './useDraggable'

describe('clampPosition 拖动位置钳制', () => {
  it('正常范围内原样返回', () => {
    expect(clampPosition(100, 80, 400, 300, 1200, 700)).toEqual({ x: 100, y: 80 })
  })

  it('拖出左上边界时钳到 0', () => {
    expect(clampPosition(-50, -20, 400, 300, 1200, 700)).toEqual({ x: 0, y: 0 })
  })

  it('拖出右下边界时钳到容器内最大位置', () => {
    expect(clampPosition(1000, 650, 400, 300, 1200, 700)).toEqual({ x: 800, y: 400 })
  })

  it('面板比容器还大时钉在 0', () => {
    expect(clampPosition(50, 50, 2000, 900, 1200, 700)).toEqual({ x: 0, y: 0 })
  })
})

describe('computeResized 缩放尺寸计算', () => {
  it('按拖拽增量放大', () => {
    expect(computeResized({ w: 400, h: 300 }, 60, 40, { minW: 320, minH: 200 }))
      .toEqual({ w: 460, h: 340 })
  })

  it('缩小不低于最小尺寸', () => {
    expect(computeResized({ w: 400, h: 300 }, -500, -500, { minW: 320, minH: 200 }))
      .toEqual({ w: 320, h: 200 })
  })

  it('有上限时不超过最大尺寸', () => {
    expect(computeResized({ w: 400, h: 300 }, 500, 500, { minW: 320, minH: 200, maxW: 640, maxH: 480 }))
      .toEqual({ w: 640, h: 480 })
  })
})
