import { describe, expect, it } from 'vitest'
import { analyzeWithLlm, buildDisasterPrompt, parseLlmPlanResponse } from './llm'
import type { FloodEvent } from '../../../shared/sim/disaster'

const flood: FloodEvent = { id: 'fire-0', kind: 'fire', position: [121.5, 31.2], severity: 2, createdTick: 0 }

const ctx = {
  drones: [
    { id: 'drone-1', name: 'DJI-M350-001', batteryPct: 88, distanceKm: 1.5 },
    { id: 'drone-2', name: 'DJI-M350-002', batteryPct: 91, distanceKm: 2.1 },
  ],
  warehouses: [{ id: 'supply-5002', name: '徐汇医疗物资储备点' }],
  shelters: [{ id: 4002, name: '2号方舱' }],
}

describe('buildDisasterPrompt 提示词构造', () => {
  it('包含灾种/坐标/候选机与仓库', () => {
    const p = buildDisasterPrompt(flood, ctx)
    expect(p).toContain('火灾')
    expect(p).toContain('121.5')
    expect(p).toContain('drone-1')
    expect(p).toContain('supply-5002')
  })
})

describe('parseLlmPlanResponse 响应解析（防御性）', () => {
  it('解析 markdown 围栏包裹的 JSON', () => {
    const raw = '分析过程……\n```json\n{"reasoning":"火势向东蔓延","surveyDroneIds":["drone-1"],"supplySiteId":"supply-5002","shelterId":4002}\n```'
    const r = parseLlmPlanResponse(raw, ctx)
    expect(r).not.toBeNull()
    expect(r!.reasoning).toBe('火势向东蔓延')
    expect(r!.surveyDroneIds).toEqual(['drone-1'])
  })

  it('裸 JSON 也能解析', () => {
    const r = parseLlmPlanResponse('{"reasoning":"r","surveyDroneIds":["drone-2"],"supplySiteId":"supply-5002","shelterId":4002}', ctx)
    expect(r!.surveyDroneIds).toEqual(['drone-2'])
  })

  it('引用不存在的机/仓库 → null（触发算法兜底）', () => {
    const r = parseLlmPlanResponse('{"reasoning":"r","surveyDroneIds":["drone-999"],"supplySiteId":"supply-5002","shelterId":4002}', ctx)
    expect(r).toBeNull()
  })

  it('非 JSON 输出 → null', () => {
    expect(parseLlmPlanResponse('我建议派无人机去', ctx)).toBeNull()
  })
})

describe('analyzeWithLlm 编排（含容错）', () => {
  it('端点正常 → 返回解析结果', async () => {
    const client = async () => ({ content: '{"reasoning":"ok","surveyDroneIds":["drone-1"],"supplySiteId":"supply-5002","shelterId":4002}' })
    const r = await analyzeWithLlm({ client, timeoutMs: 5000 }, flood, ctx)
    expect(r?.reasoning).toBe('ok')
  })

  it('端点抛错（大模型 down）→ null', async () => {
    const client = async () => { throw new Error('ECONNREFUSED') }
    const r = await analyzeWithLlm({ client, timeoutMs: 5000 }, flood, ctx)
    expect(r).toBeNull()
  })

  it('超时 → null', async () => {
    const client = () => new Promise<never>(() => {}) // 永不返回
    const r = await analyzeWithLlm({ client, timeoutMs: 50 }, flood, ctx)
    expect(r).toBeNull()
  })
})
