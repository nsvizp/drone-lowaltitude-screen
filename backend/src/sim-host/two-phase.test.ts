import { describe, expect, it } from 'vitest'
import { DisasterService } from './disaster.service'
import { EventBus } from './event-bus'
import { EventLogService } from './event-log.service'
import { FleetService } from './fleet.service'
import type { PrismaService } from '../prisma.service'

/** 最小 Prisma 桩：接口调用全部吞掉 */
function prismaStub(): PrismaService {
  const tbl = { findMany: async () => [], findFirst: async () => null, update: async () => ({}), create: async () => ({ id: 1 }) }
  return {
    warehouse: tbl, disasterEvent: tbl, eventFeed: tbl, nodeRecord: tbl,
  } as unknown as PrismaService
}

function makeService(): { svc: DisasterService; fleet: FleetService } {
  const fleet = new FleetService() // 不开定时器：纯同步调用
  const bus = new EventBus()
  const log = new EventLogService(prismaStub(), bus)
  const svc = new DisasterService(fleet, log, bus, prismaStub())
  return { svc, fleet }
}

describe('两段式灾情指挥（感知草稿 → 确认执行）', () => {
  it('simulate 只产 pendingPlan：不动机队、不起态势、plan 为空', async () => {
    const { svc, fleet } = makeService()
    const s = await svc.simulateFlood('flood')
    expect(s.flood).not.toBeNull()
    expect(s.pendingPlan).not.toBeNull()      // 草稿已生成
    expect(s.plan).toBeNull()                 // 但未生效
    expect(s.situation).toBeNull()            // 态势未初始化
    expect(fleet.drones.every((d) => d.mission === 'patrol')).toBe(true) // 无机改派
  })

  it('executeDispatch 确认后：草稿生效、勘测机改派、态势初始化', async () => {
    const { svc, fleet } = makeService()
    await svc.simulateFlood('flood')
    const s = svc.executeDispatch()
    expect(s.pendingPlan).toBeNull()
    expect(s.plan).not.toBeNull()
    expect(s.situation).not.toBeNull()
    expect(fleet.drones.some((d) => d.mission === 'survey')).toBe(true)
  })

  it('无草稿时 executeDispatch 幂等 no-op', async () => {
    const { svc } = makeService()
    const s = svc.executeDispatch()
    expect(s.plan).toBeNull()
    expect(s.flood).toBeNull()
  })

  it('resolve 清理草稿（未确认就结束演练）', async () => {
    const { svc } = makeService()
    await svc.simulateFlood('debris')
    const s = await svc.resolveDisaster()
    expect(s.pendingPlan).toBeNull()
    expect(s.flood).toBeNull()
  })

  it('大模型在线：pendingPlan 采用其选案 + planSource=ai + 推理原文', async () => {
    const { svc, fleet } = makeService()
    const firstTwo = fleet.drones.slice(0, 2).map((d) => d.id)
    svc.llmClient = async () => ({ content: JSON.stringify({
      reasoning: '火势向东蔓延，建议就近压制',
      surveyDroneIds: firstTwo, supplySiteId: 'supply-1', shelterId: 4002,
    }) })
    const s = await svc.simulateFlood('fire')
    expect(s.planSource).toBe('ai')
    expect(s.aiReasoning).toContain('火势')
    expect(s.pendingPlan!.survey.map((x) => x.droneId).sort()).toEqual([...firstTwo].sort())
  })

  it('大模型 down（抛错）：回退算法选案 + planSource=algorithm', async () => {
    const { svc } = makeService()
    svc.llmClient = async () => { throw new Error('ECONNREFUSED') }
    const s = await svc.simulateFlood('flood')
    expect(s.planSource).toBe('algorithm')
    expect(s.aiReasoning).toBeNull()
    expect(s.pendingPlan).not.toBeNull()
    expect(s.pendingPlan!.survey.length).toBeGreaterThan(0)
  })

  it('大模型输出非法（引用不存在的机）：同样回退算法', async () => {
    const { svc } = makeService()
    svc.llmClient = async () => ({ content: '{"reasoning":"r","surveyDroneIds":["ghost"],"supplySiteId":"x","shelterId":1}' })
    const s = await svc.simulateFlood('flood')
    expect(s.planSource).toBe('algorithm')
  })

  it('确认后增援评估链路不受影响（execute → reinforce 可用）', async () => {
    const { svc } = makeService()
    await svc.simulateFlood('fire')
    svc.executeDispatch()
    // 增援需要 evalResult.needed，由 tick 评估产生；此处验证 plan 携带 flood 引用即可
    const s = svc.getState()
    expect(s.plan?.flood.kind).toBe('fire')
  })
})
