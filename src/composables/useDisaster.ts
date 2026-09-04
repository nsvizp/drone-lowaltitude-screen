import { computed, ref, watch } from 'vue'
import { authFetch } from '@/api/http'
import { getSocket } from '@/api/socket'
import { nearestDistrict } from '@/sim/place-name'
import type { DispatchPlan, FloodEvent } from '@/sim/disaster'
import type { ReinforcementEval, SituationState, SituationSummary } from '@/sim/situation'

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
  planSource: 'ai' | 'algorithm' | null
  aiReasoning: string | null
}

// ---------- 模块级灾情状态（镜像服务端权威状态） ----------
const flood = ref<FloodEvent | null>(null)
const plan = ref<DispatchPlan | null>(null)
const pendingPlan = ref<DispatchPlan | null>(null)
const situation = ref<SituationState | null>(null)
const summaryRef = ref<SituationSummary | null>(null)
const evalResult = ref<ReinforcementEval | null>(null)
const reinforced = ref(false)
const planSource = ref<'ai' | 'algorithm' | null>(null)
const aiReasoning = ref<string | null>(null)
/** 灾点地名（高德逆地理；失败回退最近行政区） */
export const floodPlace = ref<string | null>(null)

/** AMap Geocoder 插件实例（与地图同源 JS key，精度到街道/路） */
let geocoder: { getAddress: (loc: [number, number], cb: (status: string, result: { regeocode?: { formattedAddress?: string } }) => void) => void } | null = null

/** JS API Geocoder（窗口 AMap 就绪后可用） */
function jsApiGeocode(lng: number, lat: number): Promise<string | null> {
  return new Promise((resolve) => {
    const AMap = (window as unknown as Record<string, unknown>).AMap as {
      plugin: (name: string, cb: () => void) => void
      Geocoder: new () => NonNullable<typeof geocoder>
    } | undefined
    if (!AMap) { resolve(null); return }
    try {
      AMap.plugin('AMap.Geocoder', () => {
        geocoder ??= new AMap.Geocoder()
        geocoder!.getAddress([lng, lat], (status, result) => {
          const addr = status === 'complete' ? result.regeocode?.formattedAddress : null
          resolve(addr && typeof addr === 'string' ? addr : null)
        })
      })
    } catch { resolve(null) }
    setTimeout(() => resolve(null), 6000)
  })
}

/** 逆地理编码：优先 JS API Geocoder（与地图同 key，街道级）→ REST → 行政区兜底 */
async function reverseGeocode(lng: number, lat: number): Promise<void> {
  floodPlace.value = nearestDistrict([lng, lat]) // 先给行政区兜底
  try {
    const addr = await jsApiGeocode(lng, lat)
    if (addr) { floodPlace.value = addr.replace(/^上海市/, ''); return }
    const cfg = (await (await authFetch('/api/config/public')).json()) as { 'amap.key'?: string }
    const key = cfg['amap.key']
    if (!key) return
    const res = await fetch('https://restapi.amap.com/v3/geocode/regeo?location=' + lng + ',' + lat + '&key=' + key + '&extensions=base')
    const data = (await res.json()) as { status: string; regeocode?: { formattedAddress?: string } }
    const addrRest = data.status === '1' ? data.regeocode?.formattedAddress : null
    if (addrRest) floodPlace.value = addrRest.replace(/^上海市/, '')
  } catch { /* 回退行政区 */ }
}

// 灾点落地即解析地名
watch(flood, (f) => {
  if (f) void reverseGeocode(f.position[0], f.position[1])
  else floodPlace.value = null
})
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
  planSource.value = s.planSource ?? null
  aiReasoning.value = s.aiReasoning ?? null
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
      body: JSON.stringify({ type }),
    }).catch(() => undefined)
  }

  /** 指挥确认调配：下达抢险调配单，初始化现场态势实时动态 */
  const executeDispatch = () => {
    void authFetch('/api/disaster/execute', { method: 'POST' }).catch(() => undefined)
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
  ;(window as unknown as Record<string, unknown>).__DISASTER = { flood, plan, pendingPlan, situation, summaryRef, evalResult, planSource, aiReasoning, floodPlace, openVideo, closeVideo }

  const active = computed(() => flood.value !== null)

  return {
    flood, plan, pendingPlan, situation, summary: summaryRef, evalResult, reinforced, active, videoDroneId, planSource, aiReasoning, floodPlace,
    simulateFlood, executeDispatch, executeReinforcement, resolveDisaster, openVideo, closeVideo,
  }
}
