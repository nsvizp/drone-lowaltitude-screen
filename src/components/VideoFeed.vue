<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useDrones } from '@/composables/useDrones'
import { useDisaster } from '@/composables/useDisaster'
import { formatHudTelemetry, getVideoSource, signalBars } from '@/sim/video'

const { drones } = useDrones()
const { videoDroneId, closeVideo } = useDisaster()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const drone = computed(() => drones.value.find((d) => d.id === videoDroneId.value) ?? null)
const scene = computed(() => {
  const d = drone.value
  if (!d) return 'city' as const
  const src = getVideoSource(d)
  return src.type === 'simulated' ? src.scene : ('city' as const)
})

let raf = 0
let frame = 0

function draw() {
  const canvas = canvasRef.value
  const d = drone.value
  if (!canvas || !d) { raf = requestAnimationFrame(draw); return }
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
onBeforeUnmount(() => cancelAnimationFrame(raf))
watch(videoDroneId, () => { frame = 0 })
</script>

<template>
  <div v-if="drone" class="video-feed">
    <div class="video-feed__bar">
      <span class="video-feed__title">📹 {{ drone.name }} 实时图传</span>
      <span class="video-feed__signal">信号 {{ '▮'.repeat(signalBars(drone)) }}{{ '▯'.repeat(5 - signalBars(drone)) }}</span>
      <button class="video-feed__close" @click="closeVideo">✕</button>
    </div>
    <canvas ref="canvasRef" class="video-feed__canvas" width="352" height="198" />
    <div class="video-feed__foot">
      {{ scene === 'flood' ? '🌊 洪灾勘测画面（模拟图传）' : '🏙 巡逻画面（模拟图传）' }} · {{ drone.taskName }}
    </div>
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

  &__canvas { display: block; width: 100%; }

  &__foot {
    padding: 5px 10px;
    font-size: 11px;
    color: var(--text-dim);
    border-top: 1px solid rgba(0, 229, 255, 0.15);
  }
}
</style>
