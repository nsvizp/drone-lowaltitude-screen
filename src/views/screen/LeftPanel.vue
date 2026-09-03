<script setup lang="ts">
import { onMounted, ref } from 'vue'
import PanelCard from '@/components/PanelCard.vue'
import { openAssociatedFlyRecord, openTotalDataByDept } from '@/api'
import type { FlyRecord, TotalData } from '@/api/types'

const total = ref<TotalData | null>(null)
const cases = ref<FlyRecord[]>([])
const caseTotal = ref(0)
const expanded = ref(false)

onMounted(async () => {
  const [t, page] = await Promise.all([openTotalDataByDept(), openAssociatedFlyRecord(1, 10)])
  total.value = t.data
  cases.value = page.rows
  caseTotal.value = page.total
})

const visibleCases = () => (expanded.value ? cases.value : cases.value.slice(0, 6))
</script>

<template>
  <aside class="left-panel">
    <PanelCard title="资源总览" class="left-panel__overview">
      <div v-if="total" class="overview">
        <div class="overview__item overview__item--hero">
          <div class="overview__icon">📦</div>
          <div>
            <div class="overview__label">总方舱数</div>
            <div class="overview__num">{{ total.shelterNum }}<span class="overview__unit">个</span></div>
          </div>
        </div>
        <div class="overview__item overview__item--hero">
          <div class="overview__icon">🚁</div>
          <div>
            <div class="overview__label">总飞行员数</div>
            <div class="overview__num">{{ total.flyerNum }}<span class="overview__unit">人</span></div>
          </div>
        </div>
        <div class="overview__grid">
          <div class="overview__cell">
            <span class="overview__cell-num">{{ total.flyLineNum }}</span>
            <span class="overview__cell-label">飞行航线</span>
          </div>
          <div class="overview__cell">
            <span class="overview__cell-num">{{ total.recordCount }}</span>
            <span class="overview__cell-label">飞行架次</span>
          </div>
          <div class="overview__cell">
            <span class="overview__cell-num">{{ total.flyPlaneNum }}</span>
            <span class="overview__cell-label">飞行计划</span>
          </div>
          <div class="overview__cell">
            <span class="overview__cell-num">{{ total.workOrderNum }}</span>
            <span class="overview__cell-label">工单数量</span>
          </div>
          <div class="overview__cell">
            <span class="overview__cell-num">{{ total.flightLength }}</span>
            <span class="overview__cell-label">里程(km)</span>
          </div>
          <div class="overview__cell">
            <span class="overview__cell-num">{{ total.durationHours }}</span>
            <span class="overview__cell-label">时长(h)</span>
          </div>
        </div>
      </div>
    </PanelCard>

    <PanelCard title="飞行案例" class="left-panel__cases">
      <ul class="cases">
        <li v-for="(c, i) in visibleCases()" :key="c.flyRecordId" class="cases__item">
          <span class="cases__rank" :class="{ 'cases__rank--top': i < 3 }">{{ i + 1 }}</span>
          <div class="cases__info">
            <div class="cases__row">
              <span class="cases__name">{{ c.flyRecordName }}</span>
              <span class="cases__status">执行中</span>
            </div>
            <div class="cases__sub">{{ c.flyLineName }} · {{ c.shelterName }}</div>
            <div class="cases__meta">
              <span>任务编号：{{ c.flyRecordId }}</span>
              <span>{{ c.createTime }}</span>
            </div>
          </div>
        </li>
      </ul>
      <button class="cases__more" @click="expanded = !expanded">
        {{ expanded ? '收起 ▲' : '查看更多案例 ▼' }}
      </button>
    </PanelCard>
  </aside>
</template>

<style scoped lang="scss">
.left-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;

  &__overview { flex: 0 0 auto; }
  &__cases { flex: 1; min-height: 0; }
}

.overview {
  display: flex;
  flex-direction: column;
  gap: 10px;

  &__item {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 10px 14px;
    background: linear-gradient(90deg, rgba(47, 128, 237, 0.18), transparent);
    border: 1px solid rgba(47, 128, 237, 0.25);
    border-radius: 4px;
  }

  &__icon { font-size: 30px; }
  &__label { font-size: 13px; color: var(--text-dim); }

  &__num {
    font-family: var(--font-num);
    font-size: 30px;
    font-weight: 700;
    color: var(--accent);
    line-height: 1.1;
  }

  &__unit {
    font-size: 12px;
    color: var(--text-dim);
    margin-left: 6px;
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  &__cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 0;
    background: rgba(6, 24, 48, 0.6);
    border-radius: 4px;

    &-num {
      font-family: var(--font-num);
      font-size: 20px;
      font-weight: 700;
      color: #8ab8ff;
    }

    &-label { font-size: 12px; color: var(--text-dim); margin-top: 2px; }
  }
}

.cases {
  list-style: none;
  overflow-y: auto;
  max-height: calc(100% - 34px);
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__item {
    display: flex;
    gap: 10px;
    padding: 10px;
    background: rgba(6, 24, 48, 0.6);
    border: 1px solid rgba(47, 128, 237, 0.2);
    border-radius: 4px;
  }

  &__rank {
    flex: 0 0 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(47, 128, 237, 0.3);
    color: #cfe4ff;
    font-size: 13px;
    font-weight: 700;

    &--top {
      background: linear-gradient(135deg, var(--primary), var(--primary-light));
      color: #fff;
    }
  }

  &__info { flex: 1; min-width: 0; }

  &__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  &__name {
    font-size: 14px;
    font-weight: 600;
    color: #eaf3ff;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__status {
    flex: 0 0 auto;
    font-size: 11px;
    color: var(--ok);
    border: 1px solid rgba(82, 210, 115, 0.5);
    border-radius: 3px;
    padding: 1px 6px;
  }

  &__sub {
    margin-top: 3px;
    font-size: 12px;
    color: var(--text-dim);
  }

  &__meta {
    margin-top: 3px;
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--text-dim);
    font-family: var(--font-num);
  }
}

.cases__more {
  width: 100%;
  margin-top: 8px;
  padding: 6px 0;
  background: rgba(47, 128, 237, 0.12);
  border: 1px solid rgba(47, 128, 237, 0.3);
  border-radius: 4px;
  color: var(--text-main);
  font-size: 12px;
  cursor: pointer;

  &:hover { background: rgba(47, 128, 237, 0.25); }
}
</style>
