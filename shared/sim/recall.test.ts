import { describe, expect, it } from 'vitest'
import {
  advanceFleet,
  createFleet,
  createShanghaiRoutes,
  divertDrone,
  launchDrone,
  mulberry32,
  recallDrone,
} from './drone-sim'

const routes = createShanghaiRoutes()

describe('recallDrone 演练结束撤机', () => {
  it('盘旋勘测机被召回：转为返航、目标为家点', () => {
    let fleet = createFleet(routes, 8, mulberry32(41))
    fleet = divertDrone(fleet, 'drone-4', [121.55, 31.21], 'survey')
    for (let i = 0; i < 400; i++) fleet = advanceFleet(fleet, routes, 5000)
    expect(fleet.drones.find((d) => d.id === 'drone-4')!.status).toBe('hovering')

    fleet = recallDrone(fleet, 'drone-4')
    const d4 = fleet.drones.find((d) => d.id === 'drone-4')!
    expect(d4.status).toBe('returning')
    expect(d4.orbitCenter).toBeNull()
    expect(d4.plannedRoute).toEqual([d4.home])
  })

  it('巡航机与归舱机不受影响', () => {
    let fleet = createFleet(routes, 8, mulberry32(42))
    const before = fleet.drones.find((d) => d.id === 'drone-1')!
    fleet = recallDrone(fleet, 'drone-1')
    const after = fleet.drones.find((d) => d.id === 'drone-1')!
    expect(after.mission).toBe('patrol')
    expect(after.status).toBe(before.status)
  })

  it('被召回的勘测机最终归舱，并因有巡逻航线而重新上岗', () => {
    let fleet = createFleet(routes, 8, mulberry32(43))
    fleet = divertDrone(fleet, 'drone-4', [121.55, 31.21], 'survey')
    for (let i = 0; i < 400; i++) fleet = advanceFleet(fleet, routes, 5000)
    fleet = recallDrone(fleet, 'drone-4')
    let docked = false
    for (let i = 0; i < 500 && !docked; i++) {
      fleet = advanceFleet(fleet, routes, 5000)
      docked = fleet.drones.find((d) => d.id === 'drone-4')!.status === 'docked'
    }
    expect(docked).toBe(true)
    fleet = advanceFleet(fleet, routes, 5000)
    expect(fleet.drones.find((d) => d.id === 'drone-4')!.mission).toBe('patrol')
  })

  it('途中投送机被召回：放弃剩余航线直接回家', () => {
    let fleet = createFleet(routes, 0, mulberry32(44))
    fleet = launchDrone(fleet, {
      name: 'DJI-M350-D1',
      home: [121.445, 31.189],
      waypoints: [[121.5, 31.2], [121.55, 31.21]],
      taskName: '洪灾物资投送',
      mission: 'delivery',
    })
    for (let i = 0; i < 10; i++) fleet = advanceFleet(fleet, routes, 5000)
    const id = fleet.drones[0].id
    fleet = recallDrone(fleet, id)
    const d = fleet.drones[0]
    expect(d.status).toBe('returning')
    expect(d.plannedRoute).toEqual([d.home])
  })
})
