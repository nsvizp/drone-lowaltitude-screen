<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PanelCard from '@/components/PanelCard.vue'
import { openAssociatedFlyRecord, openFlyers } from '@/api'
import type { FlyRecord } from '@/api/types'
import { useDrones } from '@/composables/useDrones'
import { getFlightCaseDetail, useFlightCases } from '@/composables/useFlightCases'
import {
  LOW_BATTERY_PERCENT,
  type DroneState,
} from '@/sim/drone-sim'

interface FlyerRow {
  id: number
  name: string
  lastMission: string
}

const FALLBACK_FLYERS: FlyerRow[] = [
  { id: 3001, name: '张三', lastMission: '2026-05-13 07:50' },
  { id: 3002, name: '李四', lastMission: '2026-05-13 15:40' },
  { id: 3003, name: '王五', lastMission: '2026-05-12 20:10' },
  { id: 3004, name: '赵六', lastMission: '2026-05-12 11:25' },
]

const { drones } = useDrones()
const { activeFlightCase, showFlightCase, clearFlightCase } = useFlightCases()
const cases = ref<FlyRecord[]>([])
const caseTotal = ref(0)
const expanded = ref(false)
const activeResource = ref<'drones' | 'operators'>('drones')
const flyers = ref<FlyerRow[]>([])

const availableDrones = computed(() => drones.value.filter((drone) =>
  drone.status !== 'docked' &&
  drone.status !== 'returning' &&
  drone.batteryPct > LOW_BATTERY_PERCENT,
).length)
const lowBatteryDrones = computed(() => drones.value.filter((drone) =>
  drone.status !== 'docked' && drone.batteryPct <= LOW_BATTERY_PERCENT,
).length)
const availableFlyers = computed(() => Math.max(0, flyers.value.length - 1))

onMounted(async () => {
  const [page, flyerRows] = await Promise.all([
    openAssociatedFlyRecord(1, 10),
    openFlyers(FALLBACK_FLYERS),
  ])
  cases.value = page.rows
  caseTotal.value = page.total
  flyers.value = flyerRows
})

const visibleCases = computed(() => {
  const rows = expanded.value ? cases.value : cases.value.slice(0, 6)
  return rows.map((record) => ({ record, detail: getFlightCaseDetail(record) }))
})

function toggleFlightCase(detail: ReturnType<typeof getFlightCaseDetail>): void {
  if (activeFlightCase.value?.flyRecordId === detail.flyRecordId) {
    clearFlightCase()
    return
  }
  showFlightCase(detail)
}

function droneStatusLabel(drone: DroneState): string {
  if (drone.status === 'returning') return '返航'
  if (drone.status === 'docked') return '归舱'
  if (drone.mission === 'survey') return '勘测'
  if (drone.mission === 'delivery') return '投送'
  return '巡逻'
}

function droneStatusTone(drone: DroneState): string {
  if (drone.batteryState === 'critical') return 'danger'
  if (drone.batteryState === 'low') return 'warning'
  if (drone.status === 'returning') return 'warning'
  if (drone.status === 'docked') return 'muted'
  return 'active'
}
</script>

<template>
  <aside class="left-panel">
    <PanelCard title="资源与任务" class="left-panel__overview">
      <div class="resource-board">
        <div class="resource-stats" aria-label="资源状态统计">
          <div class="resource-stat">
            <strong>{{ availableDrones }}</strong>
            <span>无人机可调度</span>
          </div>
          <div class="resource-stat">
            <strong>{{ availableFlyers }}</strong>
            <span>操作员可调度</span>
          </div>
          <div class="resource-stat">
            <strong>{{ lowBatteryDrones }}</strong>
            <span>低电量</span>
          </div>
        </div>

        <div class="resource-tabs" role="tablist" aria-label="资源类型">
          <button
            type="button"
            role="tab"
            :aria-selected="activeResource === 'drones'"
            :class="{ 'is-active': activeResource === 'drones' }"
            @click="activeResource = 'drones'"
          >无人机</button>
          <button
            type="button"
            role="tab"
            :aria-selected="activeResource === 'operators'"
            :class="{ 'is-active': activeResource === 'operators' }"
            @click="activeResource = 'operators'"
          >操作员</button>
        </div>

        <div v-if="activeResource === 'drones'" class="resource-list" role="tabpanel">
          <article v-for="drone in drones" :key="drone.id" class="drone-row">
            <div class="drone-row__main">
              <strong>{{ drone.name }}</strong>
              <span>{{ Math.round(drone.speed) }} m/s · 高度 {{ Math.round(drone.altitude) }}m</span>
            </div>
            <div class="drone-row__state">
              <span class="state-chip" :class="'state-chip--' + droneStatusTone(drone)">
                {{ droneStatusLabel(drone) }}
              </span>
              <strong :class="{ 'is-low': drone.batteryPct <= LOW_BATTERY_PERCENT }">
                {{ drone.batteryPct.toFixed(1) }}%
              </strong>
            </div>
          </article>
          <div v-if="drones.length === 0" class="resource-empty">正在接收机队遥测...</div>
        </div>

        <div v-else class="resource-list resource-list--operators" role="tabpanel">
          <article v-for="(flyer, index) in flyers" :key="flyer.id" class="operator-row">
            <span class="operator-status" :class="{ 'is-offline': index === flyers.length - 1 }">
              {{ index === flyers.length - 1 ? '离线' : '可调度' }}
            </span>
            <strong>{{ flyer.name }}</strong>
            <span>{{ (1.2 + index * 2.3).toFixed(1) }}km · 值守 {{ index + 2 }}h · M30T 资质</span>
          </article>
          <div v-if="flyers.length === 0" class="resource-empty">正在加载操作员名册...</div>
        </div>
      </div>
    </PanelCard>

    <PanelCard title="飞行案例" class="left-panel__cases">
      <ul class="cases" aria-label="飞行案例轨迹列表">
        <li v-for="({ record, detail }, i) in visibleCases" :key="record.flyRecordId">
          <button
            type="button"
            class="cases__item"
            :class="{ 'is-active': activeFlightCase?.flyRecordId === record.flyRecordId }"
            :aria-pressed="activeFlightCase?.flyRecordId === record.flyRecordId"
            @click="toggleFlightCase(detail)"
          >
            <span class="cases__rank" :class="{ 'cases__rank--top': i < 3 }">{{ i + 1 }}</span>
            <div class="cases__info">
              <div class="cases__row">
                <span class="cases__name">{{ record.flyRecordName }}</span>
                <span class="cases__status">
                  {{ activeFlightCase?.flyRecordId === record.flyRecordId ? '回放中' : '查看轨迹' }}
                </span>
              </div>
              <div class="cases__mission">
                <strong>{{ detail.droneCount }}架无人机</strong>
                <span>从 {{ record.shelterName }} 飞往</span>
                <em>{{ detail.destinationName }}</em>
              </div>
              <div class="cases__sub">{{ detail.droneNames.join('、') }}</div>
              <div class="cases__meta">
                <span>任务编号：{{ record.flyRecordId }}</span>
                <span>{{ record.createTime }}</span>
              </div>
            </div>
          </button>
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

  &__overview {
    flex: 0 0 620px;

    :deep(.panel-card__body) {
      display: flex;
      padding-top: 2px;
    }
  }

  &__cases { flex: 1; min-height: 0; }
}

.resource-board {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.resource-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.resource-stat {
  height: 76px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, rgba(14, 51, 91, 0.9), rgba(6, 27, 53, 0.9));
  border: 1px solid rgba(47, 128, 237, 0.34);
  border-radius: 5px;

  strong {
    font-family: var(--font-num);
    font-size: 26px;
    line-height: 1;
    color: var(--accent);
    text-shadow: 0 0 12px rgba(0, 229, 255, 0.26);
  }

  span {
    margin-top: 10px;
    font-size: 12px;
    color: var(--text-dim);
    white-space: nowrap;
  }
}

.resource-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: 8px 0;

  button {
    height: 34px;
    border: 1px solid rgba(47, 128, 237, 0.45);
    border-radius: 4px;
    background: rgba(4, 25, 50, 0.78);
    color: #d4e5ff;
    font-family: inherit;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: background 160ms ease, border-color 160ms ease, color 160ms ease;

    &:hover:not(.is-active) {
      background: rgba(47, 128, 237, 0.16);
      border-color: rgba(86, 204, 242, 0.55);
    }

    &:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }

    &.is-active {
      color: #fff;
      border-color: transparent;
      background: linear-gradient(100deg, #2f80ed 0%, #56ccf2 100%);
      box-shadow: 0 0 14px rgba(47, 128, 237, 0.18);
    }
  }
}

.resource-list {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
  scrollbar-color: rgba(47, 128, 237, 0.76) transparent;

  &::after {
    content: '';
    position: sticky;
    display: block;
    bottom: 0;
    height: 18px;
    margin-top: -18px;
    pointer-events: none;
    background: linear-gradient(transparent, rgba(9, 32, 63, 0.94));
  }

  &--operators {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
}

.drone-row {
  min-height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 7px 9px 7px 10px;
  background: rgba(5, 27, 55, 0.72);
  border: 1px solid rgba(47, 128, 237, 0.2);
  border-radius: 4px;

  & + & { margin-top: 5px; }

  &__main {
    display: flex;
    min-width: 0;
    flex-direction: column;

    strong {
      overflow: hidden;
      color: #e8f1ff;
      font-family: var(--font-num);
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.2px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    span {
      margin-top: 4px;
      color: #7898c3;
      font-family: var(--font-num);
      font-size: 11px;
    }
  }

  &__state {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 8px;

    > strong {
      font-family: var(--font-num);
      font-size: 14px;
      font-weight: 700;
      color: #52e982;

      &.is-low { color: #ff7d7d; }
    }
  }
}

.state-chip {
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 11px;
  line-height: 16px;

  &--active { color: #00e5ff; background: rgba(0, 229, 255, 0.12); }
  &--warning { color: #ffc857; background: rgba(255, 200, 87, 0.12); }
  &--danger { color: #ff7d7d; background: rgba(255, 107, 107, 0.13); }
  &--muted { color: #8ca5c7; background: rgba(125, 155, 196, 0.13); }
}

.operator-row {
  min-height: 38px;
  display: grid;
  grid-template-columns: 54px 46px minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  padding: 6px 8px;
  background: rgba(5, 27, 55, 0.72);
  border: 1px solid rgba(47, 128, 237, 0.2);
  border-radius: 4px;

  strong { color: #e8f1ff; font-size: 13px; }

  > span:last-child {
    overflow: hidden;
    color: #83a3cd;
    font-family: var(--font-num);
    font-size: 11px;
    text-align: right;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.operator-status {
  padding: 2px 5px;
  border-radius: 3px;
  color: #52e982;
  background: rgba(39, 196, 111, 0.13);
  font-size: 11px;
  text-align: center;

  &.is-offline {
    color: #8ca5c7;
    background: rgba(125, 155, 196, 0.13);
  }
}

.resource-empty {
  display: grid;
  min-height: 96px;
  place-items: center;
  color: var(--text-dim);
  font-size: 12px;
}

.cases {
  list-style: none;
  overflow-y: auto;
  max-height: calc(100% - 34px);
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__item {
    width: 100%;
    display: flex;
    gap: 10px;
    padding: 10px;
    color: inherit;
    font-family: inherit;
    text-align: left;
    background: rgba(6, 24, 48, 0.6);
    border: 1px solid rgba(47, 128, 237, 0.2);
    border-radius: 4px;
    cursor: pointer;
    transition: border-color 160ms ease, background 160ms ease, box-shadow 160ms ease;

    &:hover {
      background: rgba(10, 42, 78, 0.76);
      border-color: rgba(86, 204, 242, 0.55);
    }

    &:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }

    &.is-active {
      background: linear-gradient(90deg, rgba(47, 128, 237, 0.2), rgba(0, 229, 255, 0.08));
      border-color: #56ccf2;
      box-shadow: inset 3px 0 0 #00e5ff, 0 0 14px rgba(0, 229, 255, 0.12);
    }
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
    overflow: hidden;
    margin-top: 4px;
    font-family: var(--font-num);
    font-size: 10px;
    color: var(--text-dim);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__mission {
    display: flex;
    align-items: baseline;
    gap: 5px;
    margin-top: 5px;
    font-size: 11px;
    color: #8eadd3;

    strong {
      flex: 0 0 auto;
      color: #00e5ff;
      font-size: 12px;
    }

    em {
      overflow: hidden;
      color: #ffd666;
      font-style: normal;
      font-weight: 600;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
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
