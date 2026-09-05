import { computed, ref } from 'vue'
import { authFetch } from '@/api/http'
import { getSocket } from '@/api/socket'
import type { DispatchPlan, FloodEvent } from '@/sim/disaster'
import type { ReinforcementEval, SituationState, SituationSummary } from '@/sim/situation'
import type { AiDecisionResult, AiDecisionStatus } from '@/sim/ai-decision'

/** 方舱（含备用机编制）与飞手名册（展示用常量；权威数据在后端 ledger 表） */
export const SHELTERS = [
  { id: 4001, name: '1号方舱', position: [121.499, 31.241] as [number, number], spareDrones: 2 },
  { id: 4002, name: '2号方舱', position: [121.445, 31.189] as [number, number], spareDrones: 2 },
  { id: 4003, name: '3号方舱', position: [121.595, 31.205] as [number, number], spareDrones: 2 },
  { id: 4004, name: '4号方舱', position: [121.333, 31.2] as [number, number], spareDrones: 1 },
]
export const FLYERS = [
  { id: 3001, name: '张三', lastMission: '2026-05-13 07:50' },
  { id: 3002, name: '李四', lastMission: '2026-05-13 15:40' },
  { id: 3003, name: '王五', lastMission: '2026-05-12 20:10' },
  { id: 3004, name: '赵六', lastMission: '2026-05-12 11:25' },
]

interface DisasterSnapshot {
  flood: FloodEvent | null
  plan: DispatchPlan | null
  pendingPlan: DispatchPlan | null
  situation: SituationState | null
  summary: SituationSummary | null
  eval: ReinforcementEval | null
  reinforced: boolean
  aiStatus: AiDecisionStatus
  aiDecision: AiDecisionResult | null
}

// ---------- 模块级灾情状态（镜像服务端权威状态） ----------
const flood = ref<FloodEvent | null>(null)
const plan = ref<DispatchPlan | null>(null)
const pendingPlan = ref<DispatchPlan | null>(null)
const situation = ref<SituationState | null>(null)
const summaryRef = ref<SituationSummary | null>(null)
const evalResult = ref<ReinforcementEval | null>(null)
const reinforced = ref(false)
const aiStatus = ref<AiDecisionStatus>('idle')
const aiDecision = ref<AiDecisionResult | null>(null)
// 仅控制新触发的灾情是否跳过模型调用，便于稳定演示规则算法兜底。
const forceRuleFallback = ref(false)
const videoDroneId = ref<string | null>(null)

let connected = false

function applySnapshot(s: DisasterSnapshot): void {
  flood.value = s.flood
  plan.value = s.plan
  pendingPlan.value = s.pendingPlan
  situation.value = s.situation
  summaryRef.value = s.summary
  evalResult.value = s.eval
  reinforced.value = s.reinforced
  aiStatus.value = s.aiStatus ?? 'idle'
  aiDecision.value = s.aiDecision ?? null
}

function connect(): void {
  if (connected) return
  connected = true
  getSocket().on('disaster', applySnapshot)
  // 兜底：socket 未通时拉一次 REST 快照
  authFetch('/api/disaster/state')
    .then((r) => (r.ok ? r.json() : null))
    .then((s) => { if (s) applySnapshot(s) })
    .catch(() => undefined)
}

export function useDisaster() {
  connect()

  /** 模拟灾情感知（服务端仅生成灾点与调配草稿，等待指挥确认）：
   *  flood 洪灾 / debris 泥石流 */
  const simulateFlood = (type: 'flood' | 'debris' | 'fire' = 'flood') => {
    void authFetch('/api/disaster/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, forceRuleFallback: forceRuleFallback.value }),
    })
      .then((response) => response.ok ? response.json() : null)
      .then((snapshot) => { if (snapshot) applySnapshot(snapshot) })
      .catch(() => undefined)
  }

  /** 指挥确认调配：下达抢险调配单，初始化现场态势实时动态 */
  const executeDispatch = async (): Promise<DisasterSnapshot | null> => {
    try {
      const response = await authFetch('/api/disaster/execute', { method: 'POST' })
      const snapshot = response.ok ? await response.json() as DisasterSnapshot : null
      if (snapshot) applySnapshot(snapshot)
      return snapshot
    } catch {
      return null
    }
  }

  /** 执行二次调配增援 */
  const executeReinforcement = () => {
    void authFetch('/api/disaster/reinforce', { method: 'POST' }).catch(() => undefined)
  }

  /** 结束演练（灾情解除，恢复初始态） */
  const resolveDisaster = () => {
    void authFetch('/api/disaster/resolve', { method: 'POST' }).catch(() => undefined)
  }

  const openVideo = (droneId: string) => { videoDroneId.value = droneId }
  const closeVideo = () => { videoDroneId.value = null }

  // 调试/验收钩子（Playwright 探针）
  ;(window as unknown as Record<string, unknown>).__DISASTER = {
    flood, plan, situation, summaryRef, evalResult, forceRuleFallback, openVideo, closeVideo,
  }

  const active = computed(() => flood.value !== null)

  return {
    flood, plan, pendingPlan, situation, summary: summaryRef, evalResult, reinforced, aiStatus, aiDecision,
    forceRuleFallback, active, videoDroneId,
    simulateFlood, executeDispatch, executeReinforcement, resolveDisaster, openVideo, closeVideo,
  }
}
