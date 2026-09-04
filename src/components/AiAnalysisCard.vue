<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useDisaster } from '@/composables/useDisaster'
import { useDrones } from '@/composables/useDrones'
import { useDraggable } from '@/composables/useDraggable'
import { createEmergencyData } from '@/sim/emergency-data'
import { mulberry32 } from '@/sim/drone-sim'

const rootRef = ref<HTMLElement | null>(null)
const dragHandleRef = ref<HTMLElement | null>(null)
useDraggable(rootRef, dragHandleRef)

const { drones } = useDrones()
const disaster = useDisaster()
// 待指挥确认的调配草稿（AI 推演完成后由后端下发，用于确认弹框预览）
const pendingPlan = disaster.pendingPlan
const KIND_NAME: Record<string, string> = { flood: '洪灾', debris: '泥石流', fire: '火灾' }
// 应急资源（物资/人员/车辆）模拟数据，与地图图层同源（同一 seed）
const emergencyData = reactive(createEmergencyData(mulberry32(20260903)))

const collapsed = ref(true)
const playing = ref(false)
const phase = ref<'idle' | 'thinking' | 'output' | 'done'>('idle')
const thinking = ref<string[]>([])
const output = ref<{ tag: string; text: string }[]>([])
const confirmOpen = ref(false)

interface AiParagraph { tag: string; text: string }

/** 场景话术表：推演语言跟随灾种（洪灾/泥石流/火灾） */
const SCENE = {
  flood: {
    name: '洪灾', icon: '🌊',
    sensing: '识别洪峰过境信号，正在解算淹没范围…',
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
} as const

/** 依据实时状态（灾情/物资/人员/车辆/机队）生成一整套推演脚本 */
function buildScript(): { think: string[]; paras: AiParagraph[] } {
  const f = disaster.flood.value
  const sum = disaster.summary.value
  const scene = SCENE[f?.kind ?? 'flood']

  const think: string[] = [
    '正在建立灾情感知通道…',
    scene.sensing,
    '正在检索应急物资台账与库存余量…',
    '正在评估救援人员与车辆出动状态…',
    '正在规划无人机侦察与投送航线…',
    '正在汇总生成综合处置建议…',
  ]

  const paras: AiParagraph[] = []

  const sev = f ? 'ⅠⅡⅢ'[f.severity - 1] : 'Ⅱ'
  const pos = f ? f.position[0].toFixed(3) + ', ' + f.position[1].toFixed(3) : '121.4203, 31.1623'
  const delivered = sum ? sum.deliveredPacks : 0

  paras.push({
    tag: scene.icon + ' 灾情研判',
    text:
      '检测到' + scene.name + sev + '级灾害，灾点位于（' + pos + '）。' +
      scene.narrative +
      (delivered > 0 ? '；已累计投送应急物资 ' + delivered + ' 件' : '') + '。',
  })

  const supplies = emergencyData.supplies
  const ready = supplies.filter((s) => s.status === '可用')
  const top = (ready.length ? ready : supplies).slice(0, 3)
  const supplyText = top.map((s) => s.name + '（' + s.detail + '）').join('；')
  const gap = 40 + Math.floor(Math.random() * 40)
  paras.push({
    tag: '📦 物资评估',
    text: '可用物资点：' + supplyText + '。经测算' + scene.supplyFocus + '缺口约 ' + gap + ' 件，建议优先从最近物资点调运并同步补库。',
  })

  const persons = emergencyData.personnel
  const cnt = (s: string) => persons.filter((x) => x.status === s).length
  paras.push({
    tag: '👷 人员状态',
    text: '救援力量统计：待命 ' + cnt('待命') + ' 组、备勤 ' + cnt('备勤') + ' 组、出勤中 ' + cnt('出勤中') + ' 组，均已按最小作战单元编成，可随时响应。',
  })

  const vehicles = emergencyData.vehicles
  const readyV = vehicles.filter((x) => x.status !== '保养中').length
  paras.push({
    tag: '🚒 车辆状态',
    text: '可调用应急车辆 ' + readyV + ' 台（消防/救护/指挥/运输等），其中 2 台物资运输车已装载待发，可保障第一批投送。',
  })

  const fleet = drones.value
  let droneText: string
  if (fleet.length > 0) {
    const patrol = fleet.filter((d) => d.mission === 'patrol').length
    const survey = fleet.filter((d) => d.mission === 'survey').length
    const delivery = fleet.filter((d) => d.mission === 'delivery').length
    const names = [...new Set(fleet.map((d) => d.routeName))].slice(0, 3).join('、')
    droneText =
      '机队共 ' + fleet.length + ' 架在飞：巡逻 ' + patrol + '、勘测 ' + survey + '、投送 ' + delivery + '。' +
      (names ? '当前航线：' + names + '。' : '') + '勘测机已改飞灾点，投送机沿方舱→物资点→灾点航线空投。'
  } else {
    droneText = '机队共 8 架在飞：巡逻 5、勘测 2、投送 1。当前航线：外环巡逻航线 A1、黄浦江巡检航线 B2、应急投送航线 C3。勘测机已改飞灾点，投送机沿方舱→物资点→灾点航线空投。'
  }
  paras.push({ tag: '🚁 航线规划', text: droneText })

  paras.push({
    tag: '✅ 综合结论',
    text:
      '建议启动' + sev + '级应急响应：① ' + scene.first + '；② 增派 1 架勘测机扩大覆盖；' +
      '③ 2 台运输车立即出发；④ ' + scene.review + '。' +
      (pendingPlan.value ? '抢险调配方案已生成，请指挥确认后下达执行。' : ''),
  })

  return { think, paras }
}

// ---------- 播放动画（可取消的异步脚本） ----------
const timers: ReturnType<typeof setTimeout>[] = []
const waiters: (() => void)[] = []

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    waiters.push(resolve)
    timers.push(setTimeout(() => resolve(), ms))
  })
}

function clearTimers(): void {
  for (const t of timers) clearTimeout(t)
  timers.length = 0
}

/** 逐字输出一个段落（打字机效果） */
function typeParagraph(p: AiParagraph): Promise<void> {
  return new Promise((resolve) => {
    const cur = reactive({ tag: p.tag, text: '' })
    output.value.push(cur)
    let i = 0
    const timer = setInterval(() => {
      if (!playing.value) {
        clearInterval(timer)
        resolve()
        return
      }
      i += 1 + Math.floor(Math.random() * 3)
      cur.text = p.text.slice(0, i)
      if (i >= p.text.length) {
        cur.text = p.text
        clearInterval(timer)
        resolve()
      }
    }, 22)
  })
}

/** 单次推演：思考 → 逐段输出 → 停留在完成态（不循环） */
async function runScript(): Promise<void> {
  if (!playing.value) return
  thinking.value = []
  output.value = []
  phase.value = 'thinking'

  const { think, paras } = buildScript()
  for (const line of think) {
    if (!playing.value) return
    thinking.value.push(line)
    await delay(420 + Math.random() * 380)
  }
  if (!playing.value) return
  await delay(320)
  if (!playing.value) return
  phase.value = 'output'
  for (const p of paras) {
    if (!playing.value) return
    await typeParagraph(p)
    if (!playing.value) return
    await delay(560)
  }
  if (!playing.value) return
  phase.value = 'done'
  playing.value = false
}

function stop(): void {
  playing.value = false
  clearTimers()
  const ws = waiters.splice(0)
  for (const w of ws) w()
}

function togglePlay(): void {
  if (playing.value) {
    stop()
    return
  }
  playing.value = true
  runScript()
}

const statusText = computed(() => {
  if (phase.value === 'done') return '已完成'
  if (!playing.value) return output.value.length || thinking.value.length ? '已暂停' : '待机'
  if (phase.value === 'output') return '输出中'
  return '思考中'
})

/** 由外部（CenterMap 点击「模拟灾害」）触发：展开面板并执行一次推演。
 *  灾点经 WS 异步到达——等灾种就位再开演（最多等 3 秒），保证话术与场景一致 */
function start(): void {
  stop()
  collapsed.value = false
  thinking.value = []
  output.value = []
  phase.value = 'idle'
  confirmOpen.value = false
  const begin = () => { playing.value = true; void runScript() }
  if (disaster.flood.value) { begin(); return }
  const unwatch = watch(disaster.flood, (f) => { if (f) { unwatch(); begin() } })
  setTimeout(() => { unwatch(); if (!playing.value) begin() }, 3000)
}

/** 推演完成且调配草稿已下发 → 弹出确认调配弹框。
 *  同时监听 phase 与 pendingPlan，避免「推演完成时草稿尚未到达」导致不弹框 */
watch([phase, pendingPlan], () => {
  if (phase.value === 'done' && pendingPlan.value) confirmOpen.value = true
})

function etaText(sec: number): string {
  return sec < 90 ? sec + ' 秒' : '约 ' + Math.round(sec / 60) + ' 分钟'
}

function confirmDispatch(): void {
  confirmOpen.value = false
  disaster.executeDispatch()
}

function cancelDispatch(): void {
  confirmOpen.value = false
}

/** 手动触发物资调配确认框 */
function openDispatchConfirm(): void {
  if (!pendingPlan.value) return
  confirmOpen.value = true
}

defineExpose({ start })

onBeforeUnmount(() => { stop() })
</script>

<template>
  <div ref="rootRef" class="ai-card">
    <div ref="dragHandleRef" class="ai-card__bar ai-card__drag">
      <span class="ai-card__model">⋮⋮ 🧠 应急决策大模型</span>
      <span class="ai-card__status" :data-phase="phase">{{ statusText }}</span>
      <button class="ai-card__btn" :title="playing ? '暂停' : '开始推演'" @click="togglePlay">
        {{ playing ? '⏸' : '▶' }}
      </button>
      <button
        class="ai-card__btn ai-card__btn--collapse"
        :title="collapsed ? '展开' : '折叠'"
        @click="collapsed = !collapsed"
      >
        {{ collapsed ? '▴' : '▾' }}
      </button>
    </div>

    <div v-show="!collapsed" class="ai-card__body">
      <div class="ai-card__dispatch-bar">
        <button
          class="ai-card__dispatch-btn"
          :disabled="!pendingPlan"
          :title="pendingPlan ? '打开抢险调配确认框' : '暂无调配方案'"
          @click="openDispatchConfirm"
        >
          📦 物资调配
        </button>
      </div>

      <div class="ai-card__think">
        <div class="ai-card__section-title" :class="{ 'ai-card__section-title--live': playing && phase === 'thinking' }">
          <span v-if="playing && phase === 'thinking'" class="ai-card__spinner" />
          {{ playing && phase === 'thinking' ? '思考中…' : '推演过程' }}
        </div>
        <ul class="ai-card__think-list">
          <li v-for="(t, i) in thinking" :key="i" class="ai-card__think-line">
            <span class="ai-card__think-dot">▍</span>{{ t }}
          </li>
        </ul>
      </div>

      <div class="ai-card__output">
        <div v-for="(p, i) in output" :key="i" class="ai-card__para">
          <span class="ai-card__para-tag">{{ p.tag }}</span>
          <span class="ai-card__para-text">
            {{ p.text }}
            <span
              v-if="i === output.length - 1 && playing && phase === 'output'"
              class="ai-card__caret"
            />
          </span>
        </div>
        <div v-if="!playing && output.length === 0 && thinking.length === 0" class="ai-card__empty">
          点击地图「模拟灾害」按钮，大模型将执行一次灾情推演
        </div>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <div v-if="confirmOpen && pendingPlan" class="dispatch-confirm">
      <div class="dispatch-confirm__mask" @click="cancelDispatch" />
      <div class="dispatch-confirm__panel">
        <div class="dispatch-confirm__head">
          <span class="dispatch-confirm__title">🚨 确认抢险调配</span>
          <button class="dispatch-confirm__close" title="暂不调配" @click="cancelDispatch">✕</button>
        </div>
        <div class="dispatch-confirm__meta">
          {{ 'ⅠⅡⅢ'[pendingPlan.flood.severity - 1] }} 级{{ KIND_NAME[pendingPlan.flood.kind] }}
          · 灾点（{{ pendingPlan.flood.position[0].toFixed(4) }}, {{ pendingPlan.flood.position[1].toFixed(4) }}）
        </div>

        <div class="dispatch-confirm__group">
          <div class="dispatch-confirm__group-title">勘测组（在飞改派）</div>
          <div v-for="s in pendingPlan.survey" :key="s.droneId" class="dispatch-confirm__row">
            <span class="dispatch-confirm__name">{{ s.droneName }}</span>
            <span class="dispatch-confirm__dim">{{ s.distanceKm }}km · 电量 {{ s.battery }}% · ETA {{ etaText(s.etaSec) }}</span>
          </div>
          <div v-if="pendingPlan.survey.length === 0" class="dispatch-confirm__dim dispatch-confirm__note">
            满足电量条件的巡逻机不足，勘测组缺编
          </div>
          <div v-if="pendingPlan.survey[0]?.flyerNote" class="dispatch-confirm__dim dispatch-confirm__note">
            {{ pendingPlan.survey[0].flyerNote }}
          </div>
        </div>

        <div v-if="pendingPlan.delivery" class="dispatch-confirm__group">
          <div class="dispatch-confirm__group-title">投送组（方舱起飞）</div>
          <div class="dispatch-confirm__row">
            <span class="dispatch-confirm__name">{{ pendingPlan.delivery.shelterName }} × {{ pendingPlan.delivery.droneCount }} 架</span>
            <span class="dispatch-confirm__dim">飞手：{{ pendingPlan.delivery.flyers.join('、') }}</span>
          </div>
          <div class="dispatch-confirm__dim">{{ pendingPlan.delivery.supplySiteName }}（{{ pendingPlan.delivery.supplyDetail }}）</div>
          <div class="dispatch-confirm__dim">全程 {{ pendingPlan.delivery.totalKm }}km · 预计 {{ pendingPlan.delivery.etaMinutes }} 分钟（含装卸）</div>
        </div>

        <div v-for="w in pendingPlan.warnings" :key="w" class="dispatch-confirm__warn">⚠ {{ w }}</div>

        <div class="dispatch-confirm__actions">
          <button class="dispatch-confirm__btn dispatch-confirm__btn--cancel" @click="cancelDispatch">暂不调配</button>
          <button class="dispatch-confirm__btn dispatch-confirm__btn--ok" @click="confirmDispatch">✅ 确认下达调配</button>
        </div>
      </div>
    </div>
  </Teleport>

</template>

<style scoped lang="scss">
.ai-card {
  position: absolute;
  right: 12px;
  top: 64px;
  z-index: 40;
  width: 400px;
  background: rgba(4, 16, 34, 0.94);
  border: 1px solid rgba(0, 229, 255, 0.35);
  border-radius: 6px;
  box-shadow: 0 0 24px rgba(0, 229, 255, 0.12);
  overflow: hidden;

  &__bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    background: linear-gradient(90deg, rgba(0, 229, 255, 0.12), rgba(47, 128, 237, 0.06));
    border-bottom: 1px solid rgba(0, 229, 255, 0.25);
  }

  &__drag {
    cursor: move;
    user-select: none;
    touch-action: none;
  }

  &__model {
    flex: 1;
    font-size: 13px;
    font-weight: 700;
    color: #eaf3ff;
    letter-spacing: 0.5px;
  }

  &__status {
    font-size: 11px;
    padding: 1px 8px;
    border-radius: 10px;
    color: var(--text-dim);
    background: rgba(125, 155, 196, 0.12);
    border: 1px solid rgba(125, 155, 196, 0.4);

    &[data-phase='thinking'] {
      color: #ffd666;
      background: rgba(255, 214, 102, 0.12);
      border-color: rgba(255, 214, 102, 0.5);
    }

    &[data-phase='output'] {
      color: var(--accent);
      background: rgba(0, 229, 255, 0.1);
      border-color: rgba(0, 229, 255, 0.5);
    }

    &[data-phase='done'] { color: var(--ok); border-color: rgba(82, 210, 115, 0.5); }
  }

  &__btn {
    background: none;
    border: 1px solid rgba(0, 229, 255, 0.35);
    border-radius: 4px;
    color: var(--accent);
    cursor: pointer;
    width: 26px;
    height: 24px;
    font-size: 12px;
    line-height: 1;
    padding: 0;

    &:hover { background: rgba(0, 229, 255, 0.15); }

    &--collapse { color: var(--text-dim); border-color: var(--panel-border); }
  }

  &__body { padding: 10px 12px 8px; max-height: 480px; overflow-y: auto; }

  &__section-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-dim);
    margin-bottom: 4px;

    &--live { color: #ffd666; }
  }

  &__spinner {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid rgba(255, 214, 102, 0.25);
    border-top-color: #ffd666;
    animation: ai-spin 0.8s linear infinite;
  }

  @keyframes ai-spin { to { transform: rotate(360deg); } }

  &__think-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 3px;
    margin-bottom: 8px;
    border-bottom: 1px dashed rgba(47, 128, 237, 0.3);
    padding-bottom: 8px;
  }

  &__think-line {
    font-size: 12px;
    color: var(--text-dim);
    line-height: 1.6;
  }

  &__think-dot { color: #ffd666; margin-right: 2px; }

  &__output {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__para {
    font-size: 12px;
    line-height: 1.7;

    &-tag {
      display: block;
      font-weight: 700;
      color: var(--accent);
      margin-bottom: 2px;
    }

    &-text { color: var(--text-main); }
  }

  &__caret {
    display: inline-block;
    width: 7px;
    height: 13px;
    vertical-align: text-bottom;
    margin-left: 2px;
    background: var(--accent);
    animation: ai-caret 0.8s step-end infinite;
  }

  @keyframes ai-caret { 50% { opacity: 0; } }

  &__empty {
    color: var(--text-dim);
    font-size: 12px;
    text-align: center;
    padding: 16px 0;
  }

  &__dispatch-bar {
    display: flex;
    margin-bottom: 10px;
  }

  &__dispatch-btn {
    flex: 1;
    padding: 8px 0;
    border: none;
    border-radius: 4px;
    background: linear-gradient(90deg, rgba(0, 229, 255, 0.22), rgba(47, 128, 237, 0.16));
    border: 1px solid rgba(0, 229, 255, 0.5);
    color: #eaf3ff;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 1px;
    cursor: pointer;

    &:hover:not(:disabled) {
      background: linear-gradient(90deg, rgba(0, 229, 255, 0.32), rgba(47, 128, 237, 0.24));
      box-shadow: 0 0 12px rgba(0, 229, 255, 0.25);
    }

    &:disabled { opacity: 0.45; cursor: default; }
  }
}

// ---------- 确认调配弹框（Teleport 到 body，fixed 居中） ----------
.dispatch-confirm {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;

  &__mask {
    position: absolute;
    inset: 0;
    background: rgba(2, 10, 24, 0.6);
    backdrop-filter: blur(2px);
  }

  &__panel {
    position: relative;
    width: 420px;
    max-height: 76vh;
    overflow-y: auto;
    padding: 14px 16px 16px;
    background: rgba(10, 28, 52, 0.98);
    border: 1px solid rgba(255, 59, 59, 0.6);
    border-radius: 8px;
    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6), 0 0 24px rgba(255, 59, 59, 0.18);
    font-size: 12px;
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  &__title {
    font-size: 15px;
    font-weight: 700;
    color: #ff8a8a;
  }

  &__close {
    background: none;
    border: 1px solid var(--panel-border);
    border-radius: 4px;
    color: var(--text-dim);
    width: 24px;
    height: 22px;
    line-height: 1;
    cursor: pointer;

    &:hover { color: #fff; border-color: var(--text-dim); }
  }

  &__meta {
    color: var(--text-dim);
    font-family: var(--font-num);
    margin-bottom: 8px;
  }

  &__group {
    border-top: 1px dashed rgba(255, 107, 107, 0.3);
    padding-top: 6px;
    margin-top: 6px;

    &-title { color: #ffd666; font-weight: 600; margin-bottom: 4px; }
  }

  &__row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    margin-top: 3px;
  }

  &__name { color: #eaf3ff; font-weight: 600; }
  &__dim { color: var(--text-dim); font-size: 11px; }
  &__note { margin-top: 3px; }

  &__warn { color: #ff9a6b; margin-top: 6px; }

  &__reasons {
    list-style: none;
    color: var(--text-main);
    margin-bottom: 6px;
    li { line-height: 1.6; }
  }

  &__rec { color: #ffd666; margin-bottom: 4px; }

  &--reinforce &__panel {
    border-color: rgba(255, 122, 26, 0.65);
    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6), 0 0 24px rgba(255, 122, 26, 0.2);
  }

  &--reinforce &__title { color: #ff9a6b; }

  &__actions {
    display: flex;
    gap: 10px;
    margin-top: 14px;
  }

  &__btn {
    flex: 1;
    padding: 8px 0;
    border: none;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;

    &--cancel {
      background: rgba(125, 155, 196, 0.15);
      color: var(--text-dim);
      border: 1px solid var(--panel-border);

      &:hover { color: var(--text-main); background: rgba(125, 155, 196, 0.25); }
    }

    &--ok {
      background: linear-gradient(90deg, #c0392b, #ff6b6b);
      color: #fff;

      &:hover { filter: brightness(1.1); }
    }
  }
}
</style>
