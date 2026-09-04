import { ref } from 'vue'
import { onFleetTick } from './useDrones'
import type { FleetState, Mission } from '@/sim/drone-sim'

export type FeedKind = 'system' | 'drone' | 'disaster' | 'supply' | 'field'

export interface FeedEvent {
  seq: number
  time: string
  kind: FeedKind
  text: string
}

export interface NodeRecord {
  seq: number
  time: string
  title: string
  detail: string
}

const FEED_MAX = 50
const NODE_MAX = 30

/** 容量截断追加（纯函数，可测） */
export function appendCapped<T>(list: T[], item: T, max: number): T[] {
  const next = [...list, item]
  return next.length > max ? next.slice(next.length - max) : next
}

// ---------- 模块级共享状态 ----------
export const feedEvents = ref<FeedEvent[]>([])
export const nodeRecords = ref<NodeRecord[]>([])

let feedSeq = 0
let nodeSeq = 0

function now(): string {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false })
}

export function pushFeed(kind: FeedKind, text: string): void {
  feedSeq += 1
  feedEvents.value = appendCapped(feedEvents.value, { seq: feedSeq, time: now(), kind, text }, FEED_MAX)
}

export function pushNode(title: string, detail: string): void {
  nodeSeq += 1
  nodeRecords.value = appendCapped(nodeRecords.value, { seq: nodeSeq, time: now(), title, detail }, NODE_MAX)
  pushFeed('disaster', '节点：' + title)
}

// ---------- 机队例行事件（起飞/归舱/换电上岗/低电返航） ----------

export interface DronePrev {
  status: string
  mission: Mission
}

const MISSION_LABEL: Record<Mission, string> = { patrol: '巡逻', survey: '勘测', delivery: '投送' }

/**
 * 机队状态流转 → 例行动态事件（纯函数，可测）。
 * 传入当前机队与上一轮快照表，返回新事件并更新快照表。
 */
export function transitionFeed(
  fleet: FleetState,
  prev: Map<string, DronePrev>,
): { kind: FeedKind; text: string }[] {
  const events: { kind: FeedKind; text: string }[] = []
  const seen = new Set<string>()

  for (const d of fleet.drones) {
    seen.add(d.id)
    const p = prev.get(d.id)
    if (!p) {
      // 新出现的无人机（初始机队建基线不报，只报任务型新机）
      if (prev.size > 0 || d.mission !== 'patrol') {
        events.push({ kind: 'drone', text: d.name + ' ' + MISSION_LABEL[d.mission] + '起飞 · ' + d.taskName })
      }
      prev.set(d.id, { status: d.status, mission: d.mission })
      continue
    }
    if (p.status !== d.status) {
      if (d.status === 'returning') events.push({ kind: 'drone', text: d.name + ' 低电返航' })
      else if (d.status === 'docked') events.push({ kind: 'drone', text: d.name + ' 归舱充电' })
      else if (p.status === 'docked' && d.status === 'flying') events.push({ kind: 'drone', text: d.name + ' 换电完毕，重新上岗' })
    }
    prev.set(d.id, { status: d.status, mission: d.mission })
  }

  // 被清理出机队的 id 同步移除
  for (const id of [...prev.keys()]) {
    if (!seen.has(id)) prev.delete(id)
  }
  return events
}

// ---------- 惰性注册机队钩子（哪个组件先挂载谁启动） ----------
let fleetHookRegistered = false
const fleetPrev = new Map<string, DronePrev>()
let baselineDone = false

export function useEventLog() {
  if (!fleetHookRegistered) {
    fleetHookRegistered = true
    onFleetTick((fleet) => {
      // 首次采样只做基线（8 架初始巡逻机不算「起飞」）
      if (!baselineDone) {
        baselineDone = true
        transitionFeed(fleet, fleetPrev)
        return
      }
      for (const e of transitionFeed(fleet, fleetPrev)) pushFeed(e.kind, e.text)
    })
  }
  return { feedEvents, nodeRecords, pushFeed, pushNode }
}
