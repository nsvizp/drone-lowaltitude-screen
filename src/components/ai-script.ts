import type { DisasterKind, DispatchPlan, FloodEvent } from '@/sim/disaster'

export interface AiParagraph { tag: string; text: string }

/** 场景话术表：推演语言跟随灾种 */
export const SCENE: Record<DisasterKind, {
  name: string; icon: string; sensing: string; narrative: string
  supplyFocus: string; first: string; review: string
}> = {
  flood: {
    name: '洪灾', icon: '🌊',
    sensing: '识别洪峰过境信号，正在解算水情演进趋势…',
    narrative: '周边低洼区域存在漫溢风险，需持续盯防水情变化',
    supplyFocus: '饮用水与救生器材',
    first: '优先投送饮用水与救生器材',
    review: '勘测机每 30 分钟回传一轮水情复核画面',
  },
  debris: {
    name: '泥石流', icon: '⛰️',
    sensing: '解算坡体位移与泥石流通路，评估二次滑塌风险…',
    narrative: '坡体存在二次滑塌风险，须严防救援通道被掩埋',
    supplyFocus: '破拆工具与担架急救包',
    first: '优先投送破拆工具与急救物资',
    review: '勘测机每 30 分钟回传一轮坡体复核画面',
  },
  fire: {
    name: '火灾', icon: '🔥',
    sensing: '识别热异常信号与浓烟扩散方向，解算火势蔓延趋势…',
    narrative: '火场存在复燃与蔓延风险，需持续监控风向变化',
    supplyFocus: '防护装备与急救物资',
    first: '优先投送防护装备与急救物资',
    review: '勘测机每 30 分钟回传一轮火场复核画面',
  },
}

interface SituationLike {
  events: { kind: string; text: string }[]
  deliveredPacks: number
}

interface EvalLike {
  needed: boolean
  reasons: string[]
  recommendation: string
}

/** 第二幕·情况分析：执行中，引用最新现场事件与累计投送（与事件流同源） */
export function buildSituationNote(situation: SituationLike, kindName: string): AiParagraph[] {
  if (situation.events.length === 0) {
    return [{ tag: '📡 情况分析', text: kindName + '处置进行中，等待勘测机回传现场态势…' }]
  }
  const latest = situation.events.slice(-2).map((e) => e.text).join('；')
  return [{
    tag: '📡 情况分析',
    text: '现场最新态势：' + latest + '。累计投送应急物资 ' + situation.deliveredPacks + ' 件，处置链路运转正常，持续盯防中。',
  }]
}

/** 第三幕·二次调度分析：评估触发增援时，引用评估理由与建议 */
export function buildReinforceNote(evalResult: EvalLike): AiParagraph[] {
  const reasons = evalResult.reasons.length ? '依据：' + evalResult.reasons.join('；') + '。' : ''
  return [{
    tag: '⚖️ 二次调度分析',
    text: '现场力量评估触发增援阈值。' + reasons + '研判建议：' + evalResult.recommendation + '。请指挥在抢险调配单中确认执行。',
  }]
}

/** 第四幕·结论：演练结束汇总 */
export function buildConclusionNote(summary: { deliveredPacks: number } | null, missionDrones: number): AiParagraph[] {
  const packs = summary?.deliveredPacks ?? 0
  return [{
    tag: '🏁 演练结论',
    text: '处置闭环完成：累计投送应急物资 ' + packs + ' 件，' + missionDrones + ' 架任务机安全返航归舱。' +
      '感知→研判→调配→执行→评估全链路验证通过，建议复盘投送效率并归档灾情档案。',
  }]
}

export interface AiScriptInput {
  flood: FloodEvent | null
  /** 已生效调配单 */
  plan: DispatchPlan | null
  /** 待确认调配草稿（优先于 plan 展示——推演发生在确认前） */
  pendingPlan: DispatchPlan | null
  deliveredPacks: number
}

/** 推演稿生成：与抢险调配单同源（pendingPlan/plan 直出），无草稿时回退通用稿 */
export function buildAiScript(input: AiScriptInput): { think: string[]; paras: AiParagraph[] } {
  const { flood, deliveredPacks } = input
  const scene = SCENE[flood?.kind ?? 'flood']
  const draft = input.pendingPlan ?? input.plan

  const think: string[] = [
    '正在建立灾情感知通道…',
    scene.sensing,
    '正在检索应急物资台账与库存余量…',
    '正在评估救援人员与车辆出动状态…',
    '正在规划无人机侦察与投送航线…',
    '正在汇总生成综合处置建议…',
  ]

  const paras: AiParagraph[] = []
  const sev = flood ? 'ⅠⅡⅢ'[flood.severity - 1] : 'Ⅱ'
  const pos = flood ? flood.position[0].toFixed(3) + ', ' + flood.position[1].toFixed(3) : '121.4203, 31.1623'

  paras.push({
    tag: scene.icon + ' 灾情研判',
    text:
      '检测到' + scene.name + sev + '级灾害，灾点位于（' + pos + '）。' +
      scene.narrative +
      (deliveredPacks > 0 ? '；已累计投送应急物资 ' + deliveredPacks + ' 件' : '') + '。',
  })

  // 物资评估：有调配方案时念真实供应点（与调配单一致）
  if (draft?.delivery) {
    const d = draft.delivery
    paras.push({
      tag: '📦 物资评估',
      text: '调配供应点：' + d.supplySiteName + '（' + d.supplyDetail + '）。' +
        '由' + d.shelterName + '起飞 ' + d.droneCount + ' 架投送，全程 ' + d.totalKm + 'km，预计 ' + d.etaMinutes + ' 分钟（含装卸）。',
    })
  } else {
    paras.push({
      tag: '📦 物资评估',
      text: '正在检索全区物资储备点，建议优先调运' + scene.supplyFocus + '并同步补库。',
    })
  }

  paras.push({
    tag: '👷 人员状态',
    text: '救援力量已按最小作战单元编成，可随时响应；飞手保持值守，增援通道畅通。',
  })

  paras.push({
    tag: '🚒 车辆状态',
    text: '可调用应急车辆（消防/救护/指挥/运输等）处于待发状态，物资运输车已装载，可保障第一批投送。',
  })

  // 航线规划：念真实勘测机与航线（与调配单一致）
  if (draft) {
    const surveyNames = draft.survey.map((s) => s.droneName).join('、')
    const surveyTxt = draft.survey.length > 0
      ? '改派勘测机：' + surveyNames + '（最近 ' + draft.survey[0].distanceKm + 'km，ETA 约 ' + Math.max(1, Math.round(draft.survey[0].etaSec / 60)) + ' 分钟）。'
      : '满足电量条件的巡逻机不足，勘测组缺编。'
    const deliveryTxt = draft.delivery
      ? '投送航线：' + draft.delivery.shelterName + ' → ' + draft.delivery.supplySiteName + ' → 灾点 → 返航。'
      : '无机库备用机，无法组织投送。'
    paras.push({ tag: '🚁 航线规划', text: surveyTxt + deliveryTxt })
  } else {
    paras.push({
      tag: '🚁 航线规划',
      text: '待命机队保持巡逻航线，灾情确认后将就近改派勘测机，并按方舱→物资点→灾点组织投送。',
    })
  }

  const warns = draft?.warnings.length ? '注意：' + draft.warnings.join('；') + '。' : ''
  paras.push({
    tag: '✅ 综合结论',
    text:
      '建议启动' + sev + '级应急响应：① ' + scene.first + '；② 增派 1 架勘测机扩大覆盖；' +
      '③ 2 台运输车立即出发；④ ' + scene.review + '。' + warns +
      (input.pendingPlan ? '抢险调配方案已生成，请指挥确认后下达执行。' : ''),
  })

  return { think, paras }
}
