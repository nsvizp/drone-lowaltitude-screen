import { afterEach, describe, expect, it, vi } from 'vitest'
import { DisasterService } from './disaster.service'
import { EventBus } from './event-bus'
import { EventLogService } from './event-log.service'
import { FleetService } from './fleet.service'
import type { PrismaService } from '../prisma.service'
import { AiDecisionService } from './ai-decision.service'

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
  const svc = new DisasterService(fleet, log, bus, prismaStub(), new AiDecisionService())
  return { svc, fleet }
}

describe('两段式灾情指挥（感知草稿 → 确认执行）', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.unstubAllGlobals()
  })
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

  it('大模型在线：保留规则候选方案并返回模型研判', async () => {
    const { svc } = makeService()
    process.env.LLM_BASE_URL = 'https://example.test/v1'
    process.env.LLM_API_KEY = 'test-key'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({
        situationAssessment: '火势向东蔓延',
        supplyAssessment: '防护物资充足',
        personnelAssessment: '救援人员可调度',
        vehicleAssessment: '应急车辆待命',
        routeAssessment: '规则候选航线可执行',
        recommendation: '建议确认规则候选方案并就近压制',
        risks: ['注意风向变化'],
        confidence: 0.9,
      }) } }] }),
    }))
    const s = await svc.simulateFlood('fire')
    expect(s.planSource).toBe('ai')
    expect(s.aiReasoning).toContain('规则候选方案')
    expect(s.pendingPlan!.survey.length).toBeGreaterThan(0)
  })

  it('大模型 down（抛错）：回退算法选案 + planSource=algorithm', async () => {
    const { svc } = makeService()
    process.env.LLM_BASE_URL = 'https://example.test/v1'
    process.env.LLM_API_KEY = 'test-key'
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))
    const s = await svc.simulateFlood('flood')
    expect(s.planSource).toBe('algorithm')
    expect(s.aiReasoning).toBeNull()
    expect(s.pendingPlan).not.toBeNull()
    expect(s.pendingPlan!.survey.length).toBeGreaterThan(0)
  })

  it('大模型输出非法（引用不存在的机）：同样回退算法', async () => {
    const { svc } = makeService()
    process.env.LLM_BASE_URL = 'https://example.test/v1'
    process.env.LLM_API_KEY = 'test-key'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"reasoning":"r"}' } }] }),
    }))
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
