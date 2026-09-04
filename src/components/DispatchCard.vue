<script setup lang="ts">
import { computed } from 'vue'
import { useDisaster } from '@/composables/useDisaster'
import { useDrones } from '@/composables/useDrones'
import { liveEta, liveSurveyRows } from '@/sim/live-dispatch'

const { flood, plan, evalResult, reinforced, executeReinforcement } = useDisaster()
const { drones } = useDrones()

/** 勘测组实时行：电量/距离/ETA 随机队 WS 快照每秒刷新 */
const liveRows = computed(() => (plan.value ? liveSurveyRows(plan.value, drones.value) : []))

/** 增援组实时行：按机名绑定机队遥测 */
const reinforcementRows = computed(() => {
  const r = plan.value?.reinforcement
  const f = flood.value
  if (!r || !f) return []
  return r.drones.map((d) => {
    const live = drones.value.find((x) => x.name === d.droneName)
    if (!live) return { ...d, distanceKm: null as number | null, battery: null as number | null, etaSec: null as number | null, arrived: false }
    const eta = liveEta(live, f.position)
    return { ...d, distanceKm: eta.distanceKm, battery: live.batteryPct, etaSec: eta.etaSec, arrived: eta.arrived }
  })
})

function etaText(sec: number, arrived?: boolean): string {
  if (arrived) return '已到场'
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
      <div class="dispatch-card__group-title">勘测组（在飞改派 · 实时）</div>
      <div v-for="s in liveRows" :key="s.droneId" class="dispatch-card__row">
        <span class="dispatch-card__name">{{ s.droneName }}<template v-if="s.offline">（已归舱）</template></span>
        <span class="dispatch-card__dim">{{ s.distanceKm }}km · 电量 {{ s.battery }}% · {{ etaText(s.etaSec, s.arrived) }}</span>
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

    <!-- F1：二次调配增援组（执行后出现，实时遥测） -->
    <div v-if="plan.reinforcement" class="dispatch-card__group dispatch-card__group--reinforce">
      <div class="dispatch-card__group-title">增援组（二次调配 · {{ plan.reinforcement.shelterName }}起飞）</div>
      <div v-for="r in reinforcementRows" :key="r.droneName" class="dispatch-card__row">
        <span class="dispatch-card__name">{{ r.droneName }} · {{ r.task }}</span>
        <span class="dispatch-card__dim">
          <template v-if="r.distanceKm !== null">{{ r.distanceKm }}km · 电量 {{ r.battery }}% · {{ etaText(r.etaSec!, r.arrived) }}</template>
          <template v-else>准备起飞…</template>
        </span>
      </div>
    </div>

    <!-- 增援评估与二次调配按钮（原现场态势卡迁入） -->
    <div v-if="evalResult" class="dispatch-card__eval" :class="{ 'dispatch-card__eval--need': evalResult.needed }">
      <div class="dispatch-card__eval-title">
        {{ evalResult.needed ? '🔴 建议二次调配增援' : '🟢 暂不需要增援' }}
      </div>
      <ul v-if="evalResult.needed" class="dispatch-card__reasons">
        <li v-for="r in evalResult.reasons" :key="r">· {{ r }}</li>
      </ul>
      <div class="dispatch-card__rec">{{ evalResult.recommendation }}</div>
      <button
        v-if="evalResult.needed"
        class="dispatch-card__btn"
        :disabled="reinforced"
        @click="executeReinforcement"
      >
        {{ reinforced ? '✓ 增援已执行' : '执行增援' }}
      </button>
    </div>
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

  &__group--reinforce { border-top-color: rgba(82, 196, 26, 0.4); }

  &__eval {
    margin-top: 8px;
    padding: 6px 8px;
    border-radius: 4px;
    background: rgba(82, 196, 26, 0.08);
    border: 1px solid rgba(82, 196, 26, 0.3);

    &--need { background: rgba(255, 59, 59, 0.12); border-color: rgba(255, 59, 59, 0.45); }
  }

  &__eval-title { font-size: 12px; font-weight: 600; color: #ffd666; }
  &__reasons { margin: 4px 0; padding: 0; list-style: none; color: var(--text-dim); font-size: 11px; }
  &__rec { font-size: 11px; color: var(--accent); margin-top: 3px; }

  &__btn {
    margin-top: 6px;
    padding: 4px 14px;
    font-size: 12px;
    color: #fff;
    background: rgba(255, 59, 59, 0.35);
    border: 1px solid rgba(255, 59, 59, 0.6);
    border-radius: 4px;
    cursor: pointer;

    &:hover:not(:disabled) { background: rgba(255, 59, 59, 0.55); }
    &:disabled { opacity: 0.55; cursor: default; }
  }
}
</style>
