import { describe, expect, it } from 'vitest'
import { latchReinforceEval } from './eval-latch'
import type { ReinforcementEval } from './situation'

const need: ReinforcementEval = { needed: true, reasons: ['水位持续上涨'], recommendation: '建议二次调配' }
const calm: ReinforcementEval = { needed: false, reasons: [], recommendation: '暂不需要增援' }

describe('latchReinforceEval 增援评估闩锁', () => {
  it('曾触发 needed → 后续评估转 false 仍锁定 true（防止调配单闪烁消失）', () => {
    expect(latchReinforceEval(need, calm)?.needed).toBe(true)
    expect(latchReinforceEval(need, calm)?.reasons).toEqual(['水位持续上涨'])
  })

  it('从未触发 → 正常跟随', () => {
    expect(latchReinforceEval(null, calm)?.needed).toBe(false)
    expect(latchReinforceEval(null, need)?.needed).toBe(true)
  })

  it('both null → null', () => {
    expect(latchReinforceEval(null, null)).toBeNull()
  })
})