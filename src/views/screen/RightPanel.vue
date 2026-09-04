<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import PanelCard from '@/components/PanelCard.vue'
import { openTaskOverview } from '@/api'
import { PERIOD_LABELS } from '@/api/period'
import type { Period, TaskOverview, TaskStatus } from '@/api/types'
import { useEventLog, type FeedKind } from '@/composables/event-log'

// ---------- 飞行任务排行榜 ----------
const periods: Period[] = ['today', 'week', 'month', 'year', 'total']
const period = ref<Period>('total')
const task = ref<TaskOverview | null>(null)
const activeStatus = ref<TaskStatus>('dispatched')

const STATUS_META: { key: TaskStatus; label: string; numKey: keyof TaskOverview; pctKey: keyof TaskOverview; color: string }[] = [
  { key: 'dispatched', label: '待派发', numKey: 'dispatchedNum', pctKey: 'dispatchedPercent', color: '#ff6b6b' },
  { key: 'dispatching', label: '派发中', numKey: 'dispatchingNum', pctKey: 'dispatchingPercent', color: '#2f80ed' },
  { key: 'received', label: '已接单', numKey: 'receivedNum', pctKey: 'receivedPercent', color: '#52d273' },
  { key: 'completed', label: '已结单', numKey: 'completedNum', pctKey: 'completedPercent', color: '#a66bff' },
]

// 请求序号——快速切换周期时只采纳最后一次响应，防止旧数据覆盖
let taskReqSeq = 0
async function loadTask() {
  const seq = ++taskReqSeq
  const res = await openTaskOverview(period.value)
  if (seq === taskReqSeq) task.value = res.data
}
watch(period, loadTask)

const orgBars = computed(() => {
  const list = task.value?.taskOverviewRespVoList ?? []
  const meta = STATUS_META.find((m) => m.key === activeStatus.value)!
  return list.map((org) => ({
    name: org.deptName,
    value: org[meta.numKey] as number,
    percent: org[meta.pctKey] as number,
  }))
})

const activeMeta = computed(() => STATUS_META.find((m) => m.key === activeStatus.value)!)

// ---------- 事件实时动态 + 节点记录 ----------
const { feedEvents, nodeRecords } = useEventLog()

const KIND_ICON: Record<FeedKind, string> = {
  system: '⚙️',
  drone: '🛩',
  disaster: '🚨',
  supply: '📦',
  field: '📡',
}

onMounted(loadTask)
</script>

<template>
  <aside class="right-panel">
    <PanelCard title="飞行任务排行榜" class="right-panel__task">
      <div class="task__periods">
        <button
          v-for="p in periods"
          :key="p"
          class="task__period"
          :class="{ 'task__period--active': period === p }"
          @click="period = p"
        >
          {{ PERIOD_LABELS[p] }}
        </button>
      </div>

      <div v-if="task" class="task__statuses">
        <button
          v-for="m in STATUS_META"
          :key="m.key"
          class="task__status"
          :class="{ 'task__status--active': activeStatus === m.key }"
          :style="{ '--status-color': m.color }"
          @click="activeStatus = m.key"
        >
          <span class="task__status-num">{{ task[m.numKey] }}</span>
          <span class="task__status-label">{{ m.label }}</span>
        </button>
      </div>

      <ul class="task__orgs">
        <li v-for="org in orgBars" :key="org.name" class="task__org">
          <span class="task__org-name">{{ org.name }}</span>
          <div class="task__org-track">
            <div
              class="task__org-bar"
              :style="{ width: Math.max(org.percent, 2) + '%', background: activeMeta.color }"
            />
          </div>
          <span class="task__org-value">{{ org.value }}</span>
          <span class="task__org-pct">{{ org.percent }}%</span>
        </li>
      </ul>
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

  &__task { flex: 1.2; min-height: 0; }
  &__feed { flex: 1; min-height: 0; }
}

.task {
  &__periods {
    display: flex;
    gap: 8px;
  }

  &__period {
    flex: 1;
    padding: 6px 0;
    font-size: 13px;
    color: var(--text-main);
    background: rgba(6, 24, 48, 0.7);
    border: 1px solid rgba(47, 128, 237, 0.3);
    border-radius: 4px;
    cursor: pointer;

    &--active {
      background: linear-gradient(90deg, var(--primary), var(--primary-light));
      color: #fff;
      border-color: transparent;
    }
  }

  &__statuses {
    margin-top: 12px;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }

  &__status {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 0;
    background: rgba(6, 24, 48, 0.7);
    border: 1px solid rgba(47, 128, 237, 0.25);
    border-radius: 4px;
    cursor: pointer;

    &--active {
      border-color: var(--status-color);
      box-shadow: inset 0 0 12px rgba(0, 229, 255, 0.08);
    }

    &-num {
      font-family: var(--font-num);
      font-size: 24px;
      font-weight: 700;
      color: var(--status-color);
    }

    &-label { font-size: 12px; color: var(--text-dim); margin-top: 2px; }
  }

  &__orgs {
    margin-top: 12px;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  &__org {
    display: grid;
    grid-template-columns: 56px 1fr 30px 40px;
    align-items: center;
    gap: 8px;
    font-size: 12px;

    &-name { color: var(--text-main); }

    &-track {
      height: 10px;
      background: rgba(6, 24, 48, 0.8);
      border-radius: 5px;
      overflow: hidden;
    }

    &-bar {
      height: 100%;
      border-radius: 5px;
      transition: width 0.4s ease;
    }

    &-value {
      font-family: var(--font-num);
      color: #8ab8ff;
      text-align: right;
    }

    &-pct {
      font-family: var(--font-num);
      color: var(--accent);
      text-align: right;
    }
  }
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
</style>
