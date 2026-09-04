import { describe, expect, it } from 'vitest'
import { buildAiScript, buildConclusionNote, buildReinforceNote, buildSituationNote, draftConfirmState, SCENE } from './ai-script'
import type { DispatchPlan, FloodEvent } from '@/sim/disaster'

const flood: FloodEvent = { id: 'f', kind: 'fire', position: [121.5, 31.2], severity: 2, createdTick: 0 }

const plan: DispatchPlan = {
  flood,
  survey: [
    { droneId: 'd1', droneName: 'DJI-M350-002', flyerNote: '原飞手保持操控', distanceKm: 1.5, battery: 88, etaSec: 70 },
    { droneId: 'd2', droneName: 'DJI-M350-005', flyerNote: '原飞手保持操控', distanceKm: 2.1, battery: 91, etaSec: 95 },
  ],
  delivery: {
    shelterId: 4002, shelterName: '2号方舱', droneCount: 2, flyers: ['张三', '李四'],
    supplySiteId: 'supply-5002', supplySiteName: '徐汇医疗物资储备点', supplyDetail: '急救包 · 库存 1950 件',
    legs: [], totalKm: 9.5, etaMinutes: 8,
  },
  warnings: [],
}

describe('buildAiScript 推演稿与调配单同源', () => {
  it('航线规划念真实勘测机名与投送方舱（不是数机队）', () => {
    const { paras } = buildAiScript({ flood, plan: null, pendingPlan: plan, deliveredPacks: 0 })
    const route = paras.find((p) => p.tag.includes('航线'))!
    expect(route.text).toContain('DJI-M350-002')
    expect(route.text).toContain('DJI-M350-005')
    expect(route.text).toContain('2号方舱')
  })

  it('物资评估念真实供应点（与调配单一致）', () => {
    const { paras } = buildAiScript({ flood, plan: null, pendingPlan: plan, deliveredPacks: 0 })
    const supply = paras.find((p) => p.tag.includes('物资'))!
    expect(supply.text).toContain('徐汇医疗物资储备点')
    expect(supply.text).not.toContain('缺口约') // 不再编随机缺口
  })

  it('火灾场景：话术为火势/浓烟，无洪峰/水位', () => {
    const { think, paras } = buildAiScript({ flood, plan: null, pendingPlan: plan, deliveredPacks: 0 })
    const all = think.join('') + paras.map((p) => p.text).join('')
    expect(all).toMatch(/热异常|浓烟|火势/)
    expect(all).not.toMatch(/洪峰|水位|淹没|受淹|被困/)
  })

  it('综合结论包含调配方案确认提示（有待确认草稿时）', () => {
    const { paras } = buildAiScript({ flood, plan: null, pendingPlan: plan, deliveredPacks: 0 })
    const concl = paras.find((p) => p.tag.includes('结论'))!
    expect(concl.text).toContain('确认')
  })

  it('无草稿时回退通用稿（不含机名）', () => {
    const { paras } = buildAiScript({ flood: null, plan: null, pendingPlan: null, deliveredPacks: 0 })
    const route = paras.find((p) => p.tag.includes('航线'))!
    expect(route.text).not.toContain('DJI-M350-002')
  })

  it('SCENE 覆盖三种灾种', () => {
    expect(Object.keys(SCENE).sort()).toEqual(['debris', 'fire', 'flood'])
  })
})

describe('AI 卡生命周期幕（情况分析/二次调度/结论）', () => {
  const situation = {
    waterLevelM: 2.2, events: [
      { seq: 1, tick: 6, kind: 'road' as const, text: 'DJI-M350-002：主干道积水 2.25 米，交通中断' },
      { seq: 2, tick: 12, kind: 'supply' as const, text: '投送组：DJI-M350-003 已在灾点上空空投（+400 件）' },
    ],
    deliveredPacks: 400,
  }

  it('情况分析：引用最新现场事件与累计投送', () => {
    const paras = buildSituationNote(situation as never, '洪灾')
    const all = paras.map((p) => p.text).join('')
    expect(all).toContain('主干道积水')
    expect(all).toContain('400')
    expect(paras[0].tag).toContain('情况分析')
  })

  it('二次调度分析：引用评估理由与建议', () => {
    const evalResult = { needed: true, reasons: ['勘测覆盖不足'], recommendation: '建议增派 1 架勘测机' }
    const paras = buildReinforceNote(evalResult)
    const all = paras.map((p) => p.text).join('')
    expect(all).toContain('勘测覆盖不足')
    expect(all).toContain('增派 1 架勘测机')
    expect(paras[0].tag).toContain('二次调度')
  })

  it('结论：汇总投送件数与处置结果', () => {
    const paras = buildConclusionNote({ deliveredPacks: 800 }, 4)
    const all = paras.map((p) => p.text).join('')
    expect(all).toContain('800')
    expect(all).toContain('4')
    expect(paras[0].tag).toContain('结论')
  })

  it('draftConfirmState：大模型选案 → 不出现算法确认按钮', () => {
    expect(draftConfirmState('ai', 'done')).toBe('ai-dialog')
    expect(draftConfirmState('ai', 'running')).toBe('ai-dialog')
  })

  it('draftConfirmState：算法兜底 → 推演中锁定，完成后可确认', () => {
    expect(draftConfirmState('algorithm', 'running')).toBe('locked')
    expect(draftConfirmState('algorithm', 'idle')).toBe('locked')
    expect(draftConfirmState('algorithm', 'done')).toBe('ready')
  })

  it('空态势事件时给等待提示', () => {
    const paras = buildSituationNote({ waterLevelM: 0, events: [], deliveredPacks: 0 } as never, '火灾')
    expect(paras.map((p) => p.text).join('')).toContain('等待')
  })
})
