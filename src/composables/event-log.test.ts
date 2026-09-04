import { describe, expect, it } from 'vitest'
import { appendCapped, transitionFeed, type DronePrev } from './event-log'
import { createFleet, createShanghaiRoutes, launchDrone, mulberry32 } from '@/sim/drone-sim'

describe('appendCapped 容量截断', () => {
  it('超过上限丢弃最旧记录', () => {
    let list: number[] = []
    for (let i = 0; i < 10; i++) list = appendCapped(list, i, 5)
    expect(list).toEqual([5, 6, 7, 8, 9])
  })

  it('纯函数：不改原数组', () => {
    const a = [1, 2]
    const b = appendCapped(a, 3, 5)
    expect(a).toEqual([1, 2])
    expect(b).toEqual([1, 2, 3])
  })
})

describe('transitionFeed 机队状态流转事件', () => {
  const routes = createShanghaiRoutes()

  it('新起飞无人机产生「起飞」事件', () => {
    const fleet0 = createFleet(routes, 1, mulberry32(51))
    const prev = new Map<string, DronePrev>()
    transitionFeed(fleet0, prev) // 首次采样建基线，不应有事件
    const fleet1 = launchDrone(fleet0, { home: [121.5, 31.2], waypoints: [[121.51, 31.21]], taskName: '投送' })
    const events = transitionFeed(fleet1, prev)
    expect(events).toHaveLength(1)
    expect(events[0].text).toContain('起飞')
    expect(events[0].text).toContain('投送')
  })

  it('归舱与换电上岗产生对应事件', () => {
    let fleet = createFleet(routes, 0, mulberry32(52))
    fleet = launchDrone(fleet, { home: [121.5, 31.2], waypoints: [[121.5, 31.2]], taskName: '测试' })
    const prev = new Map<string, DronePrev>()
    transitionFeed(fleet, prev)
    fleet = { ...fleet, drones: [{ ...fleet.drones[0], status: 'docked' as const }] }
    const events = transitionFeed(fleet, prev)
    expect(events.some((e) => e.text.includes('归舱'))).toBe(true)
  })

  it('无人机被清理出机队时不产生事件且不报错', () => {
    const fleet = createFleet(routes, 2, mulberry32(53))
    const prev = new Map<string, DronePrev>()
    transitionFeed(fleet, prev)
    const events = transitionFeed({ ...fleet, drones: [] }, prev)
    expect(events).toHaveLength(0)
    expect(prev.size).toBe(0) // prev 表同步清理
  })
})
