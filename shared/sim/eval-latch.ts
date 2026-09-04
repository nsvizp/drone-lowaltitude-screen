import type { ReinforcementEval } from './situation'

/** 增援评估闩锁：一旦判定需要增援即锁定（防止水位趋势回落导致调配单按钮闪烁消失）。
 *  锁定状态由「执行增援」或「结束演练」解除（服务层负责清空 evalResult）。 */
export function latchReinforceEval(prev: ReinforcementEval | null, next: ReinforcementEval | null): ReinforcementEval | null {
  if (prev?.needed && next && !next.needed) return prev
  return next
}
