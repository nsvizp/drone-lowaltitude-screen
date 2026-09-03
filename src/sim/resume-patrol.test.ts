import { describe, expect, it } from 'vitest'
import {
  advanceFleet,
  createFleet,
  createShanghaiRoutes,
  divertDrone,
  launchDrone,
  mulberry32,
} from './drone-sim'

const routes = createShanghaiRoutes()

describe('勘测机返航后应重新上岗（修复卡死 bug）', () => {
  it('低电返航到家 → 短暂归舱换电 → 恢复巡逻任务，而不是在原地盘旋', () => {
    let fleet = createFleet(routes, 8, mulberry32(31))
    fleet = divertDrone(fleet, 'drone-4', [121.55, 31.21], 'survey')
    // 加速到盘旋状态后人工压低电量触发自动返航
    for (let i = 0; i < 400; i++) fleet = advanceFleet(fleet, routes, 5000)
    expect(fleet.drones.find((d) => d.id === 'drone-4')!.status).toBe('hovering')
    fleet = {
      ...fleet,
      drones: fleet.drones.map((d) => (d.id === 'drone-4' ? { ...d, battery: 24 } : d)),
    }
    // 盘旋低电 → 自动返航
    fleet = advanceFleet(fleet, routes, 5000)
    expect(fleet.drones.find((d) => d.id === 'drone-4')!.status).toBe('returning')

    // 飞回家：轮询直到归舱（最多 400 tick 足够 20km）
    let sawDocked = false
    for (let i = 0; i < 400 && !sawDocked; i++) {
      fleet = advanceFleet(fleet, routes, 5000)
      sawDocked = fleet.drones.find((d) => d.id === 'drone-4')!.status === 'docked'
    }
    expect(sawDocked).toBe(true)

    // 换电后立刻重新上岗：回到原航线巡逻
    fleet = advanceFleet(fleet, routes, 5000)
    const d4 = fleet.drones.find((d) => d.id === 'drone-4')!
    expect(d4.mission).toBe('patrol')
    expect(d4.status).toBe('flying')
    expect(d4.orbitCenter).toBeNull()
    expect(d4.plannedRoute).toBeNull()
    expect(d4.battery).toBeGreaterThan(99)
  })

  it('无巡逻航线的增援勘测机（R1）返航后保持归舱，不抛异常', () => {
    let fleet = createFleet(routes, 0, mulberry32(32))
    const shelter: [number, number] = [121.445, 31.189]
    // launchDrone 的 mission: 'survey'，routeId 为空（无对应巡逻航线）
    fleet = launchDrone(fleet, { name: 'DJI-M350-R1', home: shelter, waypoints: [[121.5, 31.2]], taskName: '增援勘测', mission: 'survey' })
    for (let i = 0; i < 300; i++) fleet = advanceFleet(fleet, routes, 5000)
    expect(fleet.drones[0].status).toBe('hovering')
    fleet = { ...fleet, drones: [{ ...fleet.drones[0], battery: 24 }] }
    for (let i = 0; i < 300; i++) fleet = advanceFleet(fleet, routes, 5000)
    expect(fleet.drones[0].status).toBe('docked') // 回舱后待命、不复活、不报错
  })
})
