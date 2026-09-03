<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import PanelCard from '@/components/PanelCard.vue'
import { openNewTotalDataByDay, openTaskOverview } from '@/api'
import { PERIOD_LABELS } from '@/api/period'
import type { FlightStat, Period, TaskOverview, TaskStatus } from '@/api/types'

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

// B7：请求序号——快速切换周期时只采纳最后一次响应，防止旧数据覆盖
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

// ---------- 飞行统计分析 ----------
const stats = ref<FlightStat | null>(null)
const metric = ref<'recordCount' | 'flightLength' | 'durationHours'>('recordCount')
const METRIC_LABELS = { recordCount: '飞行架次', flightLength: '飞行里程', durationHours: '飞行时长' } as const
const METRIC_UNITS = { recordCount: '次', flightLength: 'km', durationHours: 'h' } as const
const chartRef = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null

function renderChart() {
  if (!chartRef.value || !stats.value) return
  if (!chart) chart = echarts.init(chartRef.value)
  const orgs = stats.value.countViewRespVos ?? []
  const names = orgs.map((o) => o.deptName)
  const values = orgs.map((o) => Number(o[metric.value]))
  chart.setOption({
    grid: { left: 8, right: 40, top: 10, bottom: 0, containLabel: true },
    xAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: 'rgba(47,128,237,0.12)' } },
      axisLabel: { color: '#7d9bc4', fontSize: 10 },
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: names,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#d8e6ff', fontSize: 12 },
    },
    series: [
      {
        type: 'bar',
        data: values,
        barWidth: 12,
        label: { show: true, position: 'right', color: '#00e5ff', fontSize: 11, fontFamily: 'DIN Alternate, sans-serif' },
        itemStyle: {
          borderRadius: [0, 6, 6, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#2f80ed' },
            { offset: 1, color: '#00e5ff' },
          ]),
        },
      },
    ],
  })
}
watch([metric, stats], renderChart)

const resizeHandler = () => chart?.resize()

onMounted(async () => {
  await loadTask()
  const res = await openNewTotalDataByDay()
  stats.value = res.data
  renderChart()
  window.addEventListener('resize', resizeHandler)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeHandler)
  chart?.dispose()
})
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

    <PanelCard title="飞行统计分析" class="right-panel__stats">
      <div class="stats__tabs">
        <button
          v-for="(label, key) in METRIC_LABELS"
          :key="key"
          class="stats__tab"
          :class="{ 'stats__tab--active': metric === key }"
          @click="metric = key"
        >
          {{ label }}
        </button>
        <span class="stats__unit">单位：{{ METRIC_UNITS[metric] }}</span>
      </div>
      <div ref="chartRef" class="stats__chart" />
    </PanelCard>
  </aside>
</template>

<style scoped lang="scss">
.right-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;

  &__task { flex: 1.2; min-height: 0; }
  &__stats { flex: 1; min-height: 0; }
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

.stats {
  &__tabs {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__tab {
    padding: 5px 12px;
    font-size: 12px;
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

  &__unit {
    margin-left: auto;
    font-size: 11px;
    color: var(--text-dim);
  }

  &__chart {
    margin-top: 8px;
    height: calc(100% - 40px);
    min-height: 180px;
  }
}
</style>
