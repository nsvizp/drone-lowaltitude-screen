<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useDrones } from '@/composables/useDrones'
import { useDisaster } from '@/composables/useDisaster'
import { useDraggable, useResizable } from '@/composables/useDraggable'
import { formatHudTelemetry, getVideoSource, signalBars } from '@/sim/video'
import { pickSurveyVideo } from '@/sim/video-packs'

const { drones } = useDrones()
const disaster = useDisaster()
const { videoDroneId, closeVideo } = disaster

const canvasRef = ref<HTMLCanvasElement | null>(null)
const rootRef = ref<HTMLElement | null>(null)
const dragHandleRef = ref<HTMLElement | null>(null)
const resizeGripRef = ref<HTMLElement | null>(null)
useDraggable(rootRef, dragHandleRef)
useResizable(rootRef, resizeGripRef, { minW: 240, minH: 200, maxW: 960, axis: 'x' })

// 画布分辨率跟随面板宽度（16:9），放大不糊
let resizeObserver: ResizeObserver | null = null
function syncCanvasSize() {
  const canvas = canvasRef.value
  const root = rootRef.value
  if (!canvas || !root) return
  const w = Math.max(160, root.clientWidth - 4)
  canvas.width = w
  canvas.style.height = Math.round((w * 9) / 16) + 'px'
}
const drone = computed(() => drones.value.find((d) => d.id === videoDroneId.value) ?? null)
// B5：无人机归舱 → 图传信号丢失，3 秒后自动关窗
const signalLost = computed(() => drone.value?.status === 'docked')
let lostTimer: ReturnType<typeof setTimeout> | undefined
watch(signalLost, (lost) => {
  if (lost) lostTimer = setTimeout(() => closeVideo(), 3000)
  else clearTimeout(lostTimer)
})
const scene = computed(() => {
  const d = drone.value
  if (!d) return 'city' as const
  const src = getVideoSource(d)
  return src.type === 'simulated' ? src.scene : ('city' as const)
})

/**
 * 灾情勘测实况：勘测机在场时切换真实航拍视频。
 * 多架勘测机各看不同机位（按 droneId 散列选片）；执行增援后切换到包内下一片。
 */
const liveSrc = computed(() => {
  const d = drone.value
  const f = disaster.flood.value
  if (!d || !f || d.mission !== 'survey') return null
  return pickSurveyVideo(f.kind ?? 'flood', d.id, disaster.reinforced.value)
})
const disasterLabel = computed(() => {
  const k = disaster.flood.value?.kind
  return k === 'debris' ? '⛰ 泥石流' : k === 'fire' ? '🔥 火灾' : '🌊 洪灾'
})
/** HUD 遥测行（真实视频模式下以 DOM 覆盖层呈现，与画布模式一致） */
const hudLines = computed(() => (drone.value ? formatHudTelemetry(drone.value) : []))

let raf = 0
let frame = 0

function draw() {
  const canvas = canvasRef.value
  const d = drone.value
  if (!canvas || !d || signalLost.value || liveSrc.value) { raf = requestAnimationFrame(draw); return }
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const W = canvas.width
  const H = canvas.height
  frame++

  if (scene.value === 'flood') {
    // 洪灾水面：波纹 + 漂浮物 + 疑似目标红框
    ctx.fillStyle = '#0a2a3d'
    ctx.fillRect(0, 0, W, H)
    for (let i = 0; i < 8; i++) {
      ctx.strokeStyle = 'rgba(86, 204, 242, ' + (0.12 + 0.08 * Math.sin(frame / 20 + i)) + ')'
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let x = 0; x <= W; x += 8) {
        const y = 60 + i * 22 + Math.sin(x / 30 + frame / 15 + i) * 6
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    // 漂浮物
    ctx.fillStyle = 'rgba(200, 180, 120, 0.5)'
    for (let i = 0; i < 5; i++) {
      const x = (frame * (0.3 + i * 0.1) + i * 90) % (W + 40) - 20
      ctx.fillRect(x, 90 + i * 30, 10, 4)
    }
    // 疑似被困目标红框（闪烁）
    if (Math.floor(frame / 30) % 2 === 0) {
      ctx.strokeStyle = '#ff3b3b'
      ctx.lineWidth = 2
      ctx.strokeRect(W * 0.62, H * 0.4, 44, 30)
      ctx.fillStyle = '#ff3b3b'
      ctx.font = '10px monospace'
      ctx.fillText('疑似目标', W * 0.62, H * 0.4 - 4)
    }
  } else {
    // 城市巡逻：透视网格移动
    ctx.fillStyle = '#060f22'
    ctx.fillRect(0, 0, W, H)
    const horizon = H * 0.35
    const grad = ctx.createLinearGradient(0, horizon, 0, H)
    grad.addColorStop(0, 'rgba(47,128,237,0.05)')
    grad.addColorStop(1, 'rgba(47,128,237,0.25)')
    ctx.fillStyle = grad
    ctx.fillRect(0, horizon, W, H - horizon)
    ctx.strokeStyle = 'rgba(86,204,242,0.35)'
    ctx.lineWidth = 1
    // 纵向透视线
    for (let i = -6; i <= 6; i++) {
      ctx.beginPath()
      ctx.moveTo(W / 2 + i * 18, horizon)
      ctx.lineTo(W / 2 + i * 90, H)
      ctx.stroke()
    }
    // 横向线滚动
    const offset = (frame % 40) / 40
    for (let i = 0; i < 10; i++) {
      const t = (i + offset) / 10
      const y = horizon + (H - horizon) * t * t
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(W, y)
      ctx.stroke()
    }
  }

  // 十字准星
  ctx.strokeStyle = 'rgba(0,229,255,0.8)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(W / 2 - 14, H / 2); ctx.lineTo(W / 2 + 14, H / 2)
  ctx.moveTo(W / 2, H / 2 - 14); ctx.lineTo(W / 2, H / 2 + 14)
  ctx.stroke()

  // HUD
  const hud = formatHudTelemetry(d)
  ctx.font = '11px monospace'
  ctx.fillStyle = '#00e5ff'
  hud.forEach((line, i) => ctx.fillText(line, 10, 16 + i * 14))
  // 时间戳
  ctx.textAlign = 'right'
  ctx.fillText(new Date().toLocaleTimeString('zh-CN', { hour12: false }), W - 10, H - 10)
  ctx.textAlign = 'left'
  // REC 闪烁
  if (Math.floor(frame / 20) % 2 === 0) {
    ctx.fillStyle = '#ff3b3b'
    ctx.beginPath()
    ctx.arc(W - 18, 16, 4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = '#ff6b6b'
  ctx.fillText('REC', W - 44, 20)

  raf = requestAnimationFrame(draw)
}

onMounted(() => { raf = requestAnimationFrame(draw) })
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  resizeObserver?.disconnect()
  clearTimeout(lostTimer)
})

// 视频窗是 v-if 后渲染的，rootRef 出现时才挂 ResizeObserver
watch(rootRef, (el) => {
  resizeObserver?.disconnect()
  resizeObserver = null
  if (el) {
    resizeObserver = new ResizeObserver(syncCanvasSize)
    resizeObserver.observe(el)
    syncCanvasSize()
  }
})
watch(videoDroneId, () => { frame = 0 })
</script>

<template>
  <div v-if="drone" ref="rootRef" class="video-feed">
    <div ref="dragHandleRef" class="video-feed__bar video-feed__drag">
      <span class="video-feed__title">📹 {{ drone.name }} 实时图传</span>
      <span class="video-feed__signal">信号 {{ '▮'.repeat(signalBars(drone)) }}{{ '▯'.repeat(5 - signalBars(drone)) }}</span>
      <button class="video-feed__close" @click="closeVideo">✕</button>
    </div>
    <div class="video-feed__screen">
      <video
        v-if="liveSrc"
        :key="liveSrc"
        :src="liveSrc"
        class="video-feed__video"
        autoplay
        muted
        loop
        playsinline
      />
      <canvas v-show="!liveSrc" ref="canvasRef" class="video-feed__canvas" width="352" height="198" />
      <!-- 真实视频模式的 HUD 覆盖层（遥测/准星/REC/时间戳） -->
      <div v-if="liveSrc" class="video-feed__hud">
        <div class="video-feed__hud-telemetry">
          <div v-for="(line, i) in hudLines" :key="i">{{ line }}</div>
        </div>
        <div class="video-feed__hud-cross">+</div>
        <div class="video-feed__hud-rec">● REC</div>
        <div class="video-feed__hud-clock">{{ new Date().toLocaleTimeString('zh-CN', { hour12: false }) }}</div>
      </div>
      <div v-if="signalLost" class="video-feed__lost">📡 信号丢失 · 无人机已归舱</div>
    </div>
    <div class="video-feed__foot">
      {{ liveSrc ? disasterLabel + ' 勘测实况（航拍图传）' : (scene === 'flood' ? '🌊 洪灾勘测画面（模拟图传）' : '🏙 巡逻画面（模拟图传）') }} · {{ drone.taskName }}
    </div>
    <div ref="resizeGripRef" class="video-feed__resize" title="拖动调整大小" />
  </div>
</template>

<style scoped lang="scss">
.video-feed {
  position: absolute;
  right: 12px;
  bottom: 12px;
  z-index: 30;
  width: 356px;
  background: rgba(4, 16, 34, 0.95);
  border: 1px solid var(--accent);
  border-radius: 6px;
  box-shadow: 0 0 24px rgba(0, 229, 255, 0.25);
  overflow: hidden;

  &__bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: rgba(0, 229, 255, 0.08);
    border-bottom: 1px solid rgba(0, 229, 255, 0.3);
  }

  &__drag {
    cursor: move;
    user-select: none;
    touch-action: none;
  }

  &__resize {
    position: absolute;
    right: 2px;
    bottom: 2px;
    width: 14px;
    height: 14px;
    cursor: nwse-resize;
    touch-action: none;
    background:
      linear-gradient(135deg, transparent 50%, rgba(0, 229, 255, 0.6) 50%),
      linear-gradient(135deg, transparent 70%, rgba(0, 229, 255, 0.6) 70%);
    border-radius: 2px;
  }

  &__title { font-size: 12px; font-weight: 600; color: var(--accent); flex: 1; }
  &__signal { font-size: 10px; color: var(--ok); }

  &__close {
    background: none;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    font-size: 13px;
    &:hover { color: #fff; }
  }

  &__screen { position: relative; }

  &__canvas { display: block; width: 100%; }

  &__video { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; background: #000; }

  &__hud {
    position: absolute;
    inset: 0;
    pointer-events: none;
    font-family: monospace;
  }

  &__hud-telemetry {
    position: absolute;
    top: 6px;
    left: 10px;
    font-size: 11px;
    line-height: 14px;
    color: #00e5ff;
    text-shadow: 0 0 3px rgba(0, 0, 0, 0.9);
  }

  &__hud-cross {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 22px;
    color: rgba(0, 229, 255, 0.8);
    text-shadow: 0 0 4px rgba(0, 0, 0, 0.9);
  }

  &__hud-rec {
    position: absolute;
    top: 6px;
    right: 10px;
    font-size: 11px;
    color: #ff6b6b;
    animation: rec-blink 1s step-end infinite;
    text-shadow: 0 0 3px rgba(0, 0, 0, 0.9);
  }

  &__hud-clock {
    position: absolute;
    right: 10px;
    bottom: 6px;
    font-size: 11px;
    color: #00e5ff;
    text-shadow: 0 0 3px rgba(0, 0, 0, 0.9);
  }

  @keyframes rec-blink { 50% { opacity: 0.2; } }

  &__lost {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    color: #ff8a8a;
    background: rgba(4, 10, 20, 0.85);
    letter-spacing: 1px;
  }

  &__foot {
    padding: 5px 10px;
    font-size: 11px;
    color: var(--text-dim);
    border-top: 1px solid rgba(0, 229, 255, 0.15);
  }
}
</style>
