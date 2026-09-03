<script setup lang="ts">
import { ref } from 'vue'
import { useDisaster } from '@/composables/useDisaster'
import { useDraggable, useResizable } from '@/composables/useDraggable'

const { situation, summary, evalResult, reinforced, executeReinforcement } = useDisaster()

const rootRef = ref<HTMLElement | null>(null)
const dragHandleRef = ref<HTMLElement | null>(null)
const resizeGripRef = ref<HTMLElement | null>(null)
useDraggable(rootRef, dragHandleRef)
useResizable(rootRef, resizeGripRef, { minW: 320, minH: 240, maxW: 720, maxH: 640 })

const TREND_TEXT = { rising: '↑ 上涨', stable: '→ 稳定', falling: '↓ 回落' } as const
const KIND_ICON: Record<string, string> = {
  water: '💧', area: '🗺', trapped: '🆘', road: '🚧', supply: '📦',
}
</script>

<template>
  <div v-if="situation && summary" ref="rootRef" class="situation-card">
    <div ref="dragHandleRef" class="situation-card__title situation-card__drag">⋮⋮ 现场态势 · 实时追踪</div>

    <div class="situation-card__stats">
      <div class="situation-card__stat">
        <span class="situation-card__stat-num">{{ summary.areaKm2 }}</span>
        <span class="situation-card__stat-label">受淹 km²</span>
      </div>
      <div class="situation-card__stat">
        <span class="situation-card__stat-num">{{ summary.trapped }}</span>
        <span class="situation-card__stat-label">被困估计</span>
      </div>
      <div class="situation-card__stat">
        <span class="situation-card__stat-num" :data-trend="summary.waterTrend">{{ TREND_TEXT[summary.waterTrend] }}</span>
        <span class="situation-card__stat-label">水位 {{ situation.waterLevelM.toFixed(1) }}m</span>
      </div>
      <div class="situation-card__stat">
        <span class="situation-card__stat-num">{{ summary.deliveredPacks }}</span>
        <span class="situation-card__stat-label">已投送(件)</span>
      </div>
    </div>

    <ul class="situation-card__feed">
      <li v-for="e in [...situation.events].reverse()" :key="e.seq" class="situation-card__event">
        {{ KIND_ICON[e.kind] ?? '•' }} {{ e.text }}
      </li>
      <li v-if="situation.events.length === 0" class="situation-card__event situation-card__event--dim">
        等待勘测机到达现场…
      </li>
    </ul>

    <div v-if="evalResult" class="situation-card__eval" :class="{ 'situation-card__eval--need': evalResult.needed }">
      <div class="situation-card__eval-title">
        {{ evalResult.needed ? '🔴 建议二次调配增援' : '🟢 暂不需要增援' }}
      </div>
      <ul v-if="evalResult.needed" class="situation-card__reasons">
        <li v-for="r in evalResult.reasons" :key="r">· {{ r }}</li>
      </ul>
      <div class="situation-card__rec">{{ evalResult.recommendation }}</div>
      <button
        v-if="evalResult.needed"
        class="situation-card__btn"
        :disabled="reinforced"
        @click="executeReinforcement"
      >
        {{ reinforced ? '✓ 增援已执行' : '执行增援' }}
      </button>
    </div>
    <div ref="resizeGripRef" class="situation-card__resize" title="拖动调整大小" />
  </div>
</template>

<style scoped lang="scss">
.situation-card {
  position: absolute;
  left: 50%;
  bottom: 12px;
  transform: translateX(-50%);
  z-index: 20;
  width: 400px;
  max-height: 420px;
  display: flex;
  flex-direction: column;
  padding: 10px 14px 12px;
  background: rgba(4, 16, 34, 0.92);
  border: 1px solid var(--panel-border);
  border-radius: 6px;
  font-size: 12px;

  &__title { font-size: 14px; font-weight: 700; color: #eaf3ff; margin-bottom: 8px; }

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
      linear-gradient(135deg, transparent 50%, rgba(0, 229, 255, 0.5) 50%),
      linear-gradient(135deg, transparent 70%, rgba(0, 229, 255, 0.5) 70%);
    border-radius: 2px;
  }

  &__stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
    margin-bottom: 8px;
  }

  &__stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 6px 0;
    background: rgba(6, 24, 48, 0.7);
    border-radius: 4px;

    &-num {
      font-family: var(--font-num);
      font-size: 17px;
      font-weight: 700;
      color: var(--accent);

      &[data-trend='rising'] { color: var(--warn); }
      &[data-trend='falling'] { color: var(--ok); }
    }

    &-label { font-size: 10px; color: var(--text-dim); margin-top: 2px; }
  }

  &__feed {
    list-style: none;
    overflow-y: auto;
    flex: 1;
    min-height: 60px;
    max-height: 160px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    border-top: 1px dashed rgba(47, 128, 237, 0.3);
    padding-top: 6px;
  }

  &__event {
    color: var(--text-main);
    line-height: 1.5;

    &--dim { color: var(--text-dim); }
  }

  &__eval {
    margin-top: 8px;
    padding: 8px 10px;
    border-radius: 4px;
    background: rgba(82, 210, 115, 0.08);
    border: 1px solid rgba(82, 210, 115, 0.4);

    &--need {
      background: rgba(255, 59, 59, 0.1);
      border-color: rgba(255, 59, 59, 0.5);
    }

    &-title { font-weight: 700; margin-bottom: 4px; }
  }

  &__reasons {
    list-style: none;
    color: var(--text-main);
    margin-bottom: 4px;
    li { line-height: 1.5; }
  }

  &__rec { color: #ffd666; margin-bottom: 6px; }

  &__btn {
    width: 100%;
    padding: 6px 0;
    border: none;
    border-radius: 4px;
    background: linear-gradient(90deg, #c0392b, #ff6b6b);
    color: #fff;
    font-size: 13px;
    cursor: pointer;

    &:disabled { opacity: 0.55; cursor: default; }
  }
}
</style>
