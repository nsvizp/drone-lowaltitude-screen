<script setup lang="ts">
import { useDisaster } from '@/composables/useDisaster'

const { flood, plan } = useDisaster()

function etaText(sec: number): string {
  return sec < 90 ? sec + ' 秒' : '约 ' + Math.round(sec / 60) + ' 分钟'
}
</script>

<template>
  <div v-if="plan && flood" class="dispatch-card">
    <div class="dispatch-card__head">
      <span class="dispatch-card__title">🚨 抢险调配单</span>
      <span class="dispatch-card__severity" :data-sev="flood.severity">{{ 'ⅠⅡⅢ'[flood.severity - 1] }} 级洪灾</span>
    </div>
    <div class="dispatch-card__coord">
      灾点 {{ flood.position[0].toFixed(4) }}, {{ flood.position[1].toFixed(4) }}
    </div>

    <div class="dispatch-card__group">
      <div class="dispatch-card__group-title">勘测组（在飞改派）</div>
      <div v-for="s in plan.survey" :key="s.droneId" class="dispatch-card__row">
        <span class="dispatch-card__name">{{ s.droneName }}</span>
        <span class="dispatch-card__dim">{{ s.distanceKm }}km · 电量 {{ s.battery }}% · ETA {{ etaText(s.etaSec) }}</span>
      </div>
      <div class="dispatch-card__dim dispatch-card__note">{{ plan.survey[0]?.flyerNote }}</div>
    </div>

    <div v-if="plan.delivery" class="dispatch-card__group">
      <div class="dispatch-card__group-title">投送组（方舱起飞）</div>
      <div class="dispatch-card__row">
        <span class="dispatch-card__name">{{ plan.delivery.shelterName }} × {{ plan.delivery.droneCount }} 架</span>
        <span class="dispatch-card__dim">飞手：{{ plan.delivery.flyers.join('、') }}</span>
      </div>
      <div class="dispatch-card__dim">
        {{ plan.delivery.supplySiteName }}（{{ plan.delivery.supplyDetail }}）
      </div>
      <div class="dispatch-card__dim">
        全程 {{ plan.delivery.totalKm }}km · 预计 {{ plan.delivery.etaMinutes }} 分钟（含装卸）
      </div>
    </div>

    <div v-for="w in plan.warnings" :key="w" class="dispatch-card__warn">⚠ {{ w }}</div>
  </div>
</template>

<style scoped lang="scss">
.dispatch-card {
  position: absolute;
  left: 12px;
  bottom: 12px;
  z-index: 20;
  width: 340px;
  padding: 10px 14px 12px;
  background: rgba(30, 8, 12, 0.9);
  border: 1px solid rgba(255, 59, 59, 0.6);
  border-radius: 6px;
  box-shadow: 0 0 20px rgba(255, 59, 59, 0.2);
  font-size: 12px;

  &__head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }

  &__title { font-size: 14px; font-weight: 700; color: #ff8a8a; }

  &__severity {
    font-size: 11px;
    padding: 1px 8px;
    border-radius: 3px;
    background: rgba(255, 59, 59, 0.2);
    color: #ff6b6b;
    border: 1px solid rgba(255, 59, 59, 0.5);
  }

  &__coord { color: var(--text-dim); font-family: var(--font-num); margin-bottom: 8px; }

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
}
</style>
