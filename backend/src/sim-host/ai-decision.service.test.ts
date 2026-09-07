import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDisasterEvent, planFloodDispatch } from '../../../shared/sim/disaster'
import { createEmergencyData } from '../../../shared/sim/emergency-data'
import { createFleet, createShanghaiRoutes, mulberry32 } from '../../../shared/sim/drone-sim'
import { initSituation } from '../../../shared/sim/situation'
import { AiDecisionService } from './ai-decision.service'

function context() {
  const disaster = createDisasterEvent(mulberry32(1), { minLng: 121.4, maxLng: 121.5, minLat: 31.1, maxLat: 31.2 }, 0)
  const fleet = createFleet(createShanghaiRoutes(), 4, mulberry32(2))
  const emergency = createEmergencyData(mulberry32(3))
  const candidatePlan = planFloodDispatch(fleet, [
    { id: 1, name: '测试方舱', position: [121.45, 31.15], spareDrones: 2 },
  ], [{ id: 1, name: '测试飞手', lastMission: '2026-01-01 00:00' }], emergency.supplies, disaster)
  return {
    disaster,
    situation: initSituation(disaster),
    candidatePlan,
    fleet: fleet.drones,
    resources: {
      supplies: emergency.supplies,
      operators: [{ id: 1, name: '测试飞手', status: '拟调度' as const, lastMission: '2026-01-01 00:00' }],
      personnel: { 待命: 2 },
      vehicles: { 待命: 3 },
    },
    constraints: { surveyMinBattery: 50, surveyTeamSize: 2, deliveryTeamSize: 2, humanConfirmationRequired: true as const },
  }
}

describe('AiDecisionService', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.unstubAllGlobals()
  })

  it('未配置模型时返回规则兜底结果', async () => {
    delete process.env.LLM_BASE_URL
    delete process.env.LLM_API_KEY
    const result = await new AiDecisionService().analyze(context())
    expect(result.source).toBe('rule-fallback')
    expect(result.routeAssessment).toContain('拟改派')
  })

  it('强制兜底时跳过模型调用并返回规则结果', async () => {
    process.env.LLM_BASE_URL = 'https://example.test/v1'
    process.env.LLM_API_KEY = 'test-key'
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await new AiDecisionService().analyze(context(), { forceRuleFallback: true })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.source).toBe('rule-fallback')
    expect(result.fallbackReason).toBe('演示模式：已强制使用规则算法兜底')
  })

  it('模型返回结构化 JSON 时保留模型结果', async () => {
    process.env.LLM_BASE_URL = 'https://example.test/v1'
    process.env.LLM_API_KEY = 'test-key'
    process.env.LLM_MODEL = 'test-model'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({
        situationAssessment: '灾情判断',
        supplyAssessment: '物资判断',
        personnelAssessment: '人员判断',
        vehicleAssessment: '车辆判断',
        routeAssessment: '航线判断',
        recommendation: '建议人工确认',
        risks: ['测试风险'],
        confidence: 0.88,
      }) } }] }),
    }))
    const result = await new AiDecisionService().analyze(context())
    expect(result.source).toBe('model')
    expect(result.model).toBe('test-model')
    expect(result.confidence).toBe(0.88)
  })

  it('百炼账号不可用时返回可读的规则兜底原因', async () => {
    process.env.LLM_BASE_URL = 'https://example.test/v1'
    process.env.LLM_API_KEY = 'test-key'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { code: 'Arrearage' } }),
    }))
    const result = await new AiDecisionService().analyze(context())
    expect(result.source).toBe('rule-fallback')
    expect(result.fallbackReason).toBe('百炼账号欠费或未开通可用额度')
  })

  it('模型未开通时返回可读的规则兜底原因', async () => {
    process.env.LLM_BASE_URL = 'https://example.test/v1'
    process.env.LLM_API_KEY = 'test-key'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: { code: 'AccessDenied.Unpurchased' } }),
    }))
    const result = await new AiDecisionService().analyze(context())
    expect(result.source).toBe('rule-fallback')
    expect(result.fallbackReason).toBe('当前百炼工作空间尚未开通该模型的调用权限')
  })

  it('工作空间地址无效时返回可读的规则兜底原因', async () => {
    process.env.LLM_BASE_URL = 'https://example.test/v1'
    process.env.LLM_API_KEY = 'test-key'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { code: 'invalid_parameter_error', message: 'Workspace endpoint is invalid.' } }),
    }))
    const result = await new AiDecisionService().analyze(context())
    expect(result.source).toBe('rule-fallback')
    expect(result.fallbackReason).toBe('百炼工作空间 Base URL 无效')
  })
})
