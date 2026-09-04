<script setup lang="ts">
import PanelCard from '@/components/PanelCard.vue'
import { useEventLog, type FeedKind } from '@/composables/event-log'
import { useDrones } from '@/composables/useDrones'
import { useDisaster } from '@/composables/useDisaster'
import { buildDispatchRows, buildWarehouseRows, type WarehouseRow } from '@/sim/dispatch-board'
import { openWarehouses } from '@/api'
import { computed, onMounted, ref } from 'vue'

// ---------- 物资仓储（静态台账） + 物资调度（实时机队） ----------
const { drones } = useDrones()
const { situation } = useDisaster()

// 仓储台账：后端接口优先，失败回退本地静态台账
const warehouses = ref<WarehouseRow[]>(buildWarehouseRows())
onMounted(async () => {
  warehouses.value = await openWarehouses(buildWarehouseRows())
})

const dispatch = computed(() =>
  buildDispatchRows({ drones: drones.value, tickCount: 0 }, situation.value),
)

// ---------- 事件实时动态 + 节点记录 ----------
const { feedEvents, nodeRecords } = useEventLog()

const KIND_ICON: Record<FeedKind, string> = {
  system: '⚙️',
  drone: '🛩',
  disaster: '🚨',
  supply: '📦',
  field: '📡',
}
</script>

<template>
  <aside class="right-panel">
    <PanelCard title="物资调度情况" class="right-panel__material">
      <div class="mat">
        <div class="mat__dispatch">
          <div class="mat__stats">
            <div class="mat__stat">
              <span class="mat__stat-num mat__stat-num--blue">{{ dispatch.inflight }}</span>
              <span class="mat__stat-label">在途架次</span>
            </div>
            <div class="mat__stat">
              <span class="mat__stat-num mat__stat-num--cyan">{{ dispatch.deliveredPacks }}</span>
              <span class="mat__stat-label">已投送（件）</span>
            </div>
          </div>
          <ul class="mat__rows">
            <li v-for="(r, i) in dispatch.rows" :key="r.drone + i" class="mat__row">
              <span class="mat__row-drone">{{ r.drone }}</span>
              <span class="mat__row-task" :title="r.task">{{ r.task }}</span>
              <span class="mat__row-status">{{ r.statusText }}</span>
            </li>
            <li v-if="dispatch.rows.length === 0" class="mat__empty">当前无物资调度任务</li>
          </ul>
        </div>

        <div class="mat__warehouse">
          <div class="mat__section-title">物资仓储情况</div>
          <ul class="mat__warehouses">
            <li v-for="w in warehouses" :key="w.name" class="mat__wh">
              <div class="mat__wh-head">
                <span class="mat__wh-name">{{ w.name }}</span>
                <span class="mat__wh-num">{{ w.stock }}/{{ w.capacity }}</span>
              </div>
              <div class="mat__wh-track">
                <div
                  class="mat__wh-bar"
                  :class="{ 'mat__wh-bar--low': w.percent < 40 }"
                  :style="{ width: w.percent + '%' }"
                />
              </div>
              <div class="mat__wh-items">{{ w.items }}</div>
            </li>
          </ul>
        </div>
      </div>
    </PanelCard>

    <PanelCard title="事件实时动态" class="right-panel__feed">
      <div class="feed">
        <ul class="feed__list">
          <li v-for="e in [...feedEvents].reverse()" :key="e.seq" class="feed__item">
            <span class="feed__time">{{ e.time }}</span>
            <span class="feed__icon">{{ KIND_ICON[e.kind] }}</span>
            <span class="feed__text">{{ e.text }}</span>
          </li>
          <li v-if="feedEvents.length === 0" class="feed__empty">暂无事件，系统运行中…</li>
        </ul>

        <div class="nodes">
          <div class="nodes__header">节点记录</div>
          <ul class="nodes__list">
            <li v-for="n in [...nodeRecords].reverse()" :key="n.seq" class="nodes__item">
              <div class="nodes__head">
                <span class="nodes__title">{{ n.title }}</span>
                <span class="nodes__time">{{ n.time }}</span>
              </div>
              <div class="nodes__detail">{{ n.detail }}</div>
            </li>
            <li v-if="nodeRecords.length === 0" class="feed__empty">灾情发生时自动生成节点</li>
          </ul>
        </div>
      </div>
    </PanelCard>
  </aside>
</template>

<style scoped lang="scss">
.right-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;

  &__material { flex: 1.2; min-height: 0; }
  &__feed { flex: 1; min-height: 0; }
}

.feed {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: 8px;

  &__list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__item {
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-main);
  }

  &__time {
    font-family: var(--font-num);
    color: var(--text-dim);
    font-size: 11px;
    flex-shrink: 0;
  }

  &__icon { flex-shrink: 0; font-size: 11px; }

  &__empty { color: var(--text-dim); font-size: 12px; padding: 6px 0; }
}

.nodes {
  flex: 0 0 38%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-top: 1px dashed rgba(47, 128, 237, 0.3);
  padding-top: 6px;

  &__header {
    font-size: 13px;
    font-weight: 600;
    color: #ffd666;
    margin-bottom: 4px;
  }

  &__list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  &__item {
    border-left: 2px solid rgba(255, 214, 102, 0.5);
    padding-left: 8px;
  }

  &__head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }

  &__title { font-size: 12px; font-weight: 600; color: #eaf3ff; }

  &__time {
    font-family: var(--font-num);
    font-size: 11px;
    color: var(--text-dim);
    flex-shrink: 0;
  }

  &__detail {
    font-size: 11px;
    color: var(--text-dim);
    line-height: 1.5;
  }
}

.mat {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: 10px;

  &__section-title {
    font-size: 13px;
    font-weight: 600;
    color: #ffd666;
    margin-bottom: 6px;
  }

  &__dispatch { flex: 0 0 auto; }

  &__stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 8px;
  }

  &__stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 6px 0;
    background: rgba(6, 24, 48, 0.7);
    border: 1px solid rgba(47, 128, 237, 0.25);
    border-radius: 4px;

    &-num {
      font-family: var(--font-num);
      font-size: 20px;
      font-weight: 700;

      &--blue { color: #8ab8ff; }
      &--cyan { color: var(--accent); }
    }

    &-label { font-size: 11px; color: var(--text-dim); }
  }

  &__rows {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 88px;
    overflow-y: auto;
  }

  &__row {
    display: grid;
    grid-template-columns: 96px 1fr 48px;
    gap: 6px;
    font-size: 12px;
    align-items: center;

    &-drone { color: var(--accent); font-family: var(--font-num); font-size: 11px; }

    &-task {
      color: var(--text-main);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    &-status { color: #52d273; text-align: right; }
  }

  &__empty { color: var(--text-dim); font-size: 12px; padding: 4px 0; }

  &__warehouse {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    border-top: 1px dashed rgba(47, 128, 237, 0.3);
    padding-top: 8px;
  }

  &__warehouses {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__wh {
    &-head {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
    }

    &-name { color: var(--text-main); }

    &-num { font-family: var(--font-num); color: #8ab8ff; font-size: 11px; }

    &-track {
      height: 6px;
      margin-top: 3px;
      background: rgba(6, 24, 48, 0.8);
      border-radius: 3px;
      overflow: hidden;
    }

    &-bar {
      height: 100%;
      border-radius: 3px;
      background: linear-gradient(90deg, var(--primary), var(--primary-light));

      &--low { background: linear-gradient(90deg, #ff6b6b, #ffd666); }
    }

    &-items { font-size: 11px; color: var(--text-dim); margin-top: 2px; }
  }
}
</style>
