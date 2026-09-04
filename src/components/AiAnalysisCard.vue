<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
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
// 应急资源（物资/人员/车辆）模拟数据，与地图图层同源（同一 seed）
const emergencyData = reactive(createEmergencyData(mulberry32(20260903)))

const collapsed = ref(true)
const playing = ref(false)
const loopCount = ref(0)
const phase = ref<'idle' | 'thinking' | 'output' | 'done'>('idle')
const thinking = ref<string[]>([])
const output = ref<{ tag: string; text: string }[]>([])

interface AiParagraph { tag: string; text: string }

/** 依据实时状态（灾情/物资/人员/车辆/机队）生成一整套推演脚本 */
function buildScript(): { think: string[]; paras: AiParagraph[] } {
  const f = disaster.flood.value
  const sit = disaster.situation.value
  const sum = disaster.summary.value

  const think: string[] = [
    '正在建立灾情感知通道…',
    '识别洪峰过境信号，正在解算淹没范围…',
    '正在检索应急物资台账与库存余量…',
    '正在评估救援人员与车辆出动状态…',
    '正在规划无人机侦察与投送航线…',
    '正在汇总生成综合处置建议…',
  ]

  const paras: AiParagraph[] = []

  const kind = f ? (f.kind === 'debris' ? '泥石流' : '洪灾') : '洪灾'
  const sev = f ? 'ⅠⅡⅢ'[f.severity - 1] : 'Ⅱ'
  const pos = f ? f.position[0].toFixed(3) + ', ' + f.position[1].toFixed(3) : '121.468, 31.215'
  const water = sit ? sit.waterLevelM.toFixed(1) : '1.8'
  const area = sum ? sum.areaKm2 : 1.2
  const trapped = sum ? sum.trapped : 26

  paras.push({
    tag: '🌊 灾情研判',
    text:
      '检测到' + kind + sev + '级灾害，灾点位于（' + pos + '）。当前水位 ' + water +
      'm，受淹面积约 ' + area + ' km²，估算被困 ' + trapped + ' 人，影响范围呈扩大趋势。',
  })

  const supplies = emergencyData.supplies
  const ready = supplies.filter((s) => s.status === '可用')
  const top = (ready.length ? ready : supplies).slice(0, 3)
  const supplyText = top.map((s) => s.name + '（' + s.detail + '）').join('；')
  const gap = 40 + Math.floor(Math.random() * 40)
  paras.push({
    tag: '📦 物资评估',
    text: '可用物资点：' + supplyText + '。经测算饮用水与救生器材缺口约 ' + gap + ' 件，建议优先从最近物资点调运并同步补库。',
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
      '建议启动' + sev + '级应急响应：① 优先投送饮用水与救生器材；② 增派 1 架勘测机扩大覆盖；' +
      '③ 2 台运输车立即出发；④ 每 30 分钟复核水位与被困人数。',
  })

  return { think, paras }
}

// ---------- 循环播放动画（可取消的异步脚本） ----------
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
  await delay(5000)
  if (!playing.value) return
  loopCount.value += 1
  runScript()
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
  if (loopCount.value === 0) loopCount.value = 1
  runScript()
}

function reset(): void {
  stop()
  phase.value = 'idle'
  thinking.value = []
  output.value = []
  loopCount.value = 0
}

const statusText = computed(() => {
  if (!playing.value) return output.value.length ? '已暂停' : '待机'
  if (phase.value === 'thinking') return '思考中'
  if (phase.value === 'output') return '输出中'
  return '已完成'
})

// 进入页面即自动开始循环播放
onMounted(() => {
  playing.value = true
  loopCount.value = 1
  runScript()
})

onBeforeUnmount(() => stop())
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
          点击 ▶ 开始大模型灾害推演（自动循环播放）
        </div>
      </div>

     
    </div>
  </div>
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

  &__foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 8px;
    border-top: 1px dashed rgba(47, 128, 237, 0.25);
    padding-top: 6px;
  }

  &__loop {
    font-size: 11px;
    color: var(--text-dim);

    &[data-on='true'] { color: var(--ok); }
  }

  &__reset {
    background: none;
    border: none;
    color: var(--text-dim);
    font-size: 11px;
    cursor: pointer;
    padding: 0;

    &:hover { color: var(--accent); }
  }
}
</style>
