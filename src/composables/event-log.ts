import { ref } from 'vue'
import { getSocket } from '@/api/socket'
import { onFleetTick } from './useDrones'
import type { DroneState, FleetState, Mission } from '@/sim/drone-sim'

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

function returnEventText(drone: DroneState): string {
  const battery = drone.batteryPct.toFixed(1) + '%'
  if (drone.returnReason === 'low_battery') {
    return drone.name + ' 电量 ' + battery + '，已自动返航'
  }
  if (drone.returnReason === 'route_complete') {
    return drone.name + ' 完成巡航，正在返航 · 电量 ' + battery
  }
  if (drone.returnReason === 'mission_complete') {
    return drone.name + ' 任务完成，正在返航 · 电量 ' + battery
  }
  if (drone.returnReason === 'manual_recall') {
    return drone.name + ' 已人工召回 · 电量 ' + battery
  }
  return drone.name + ' 正在返航 · 电量 ' + battery
}

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
      if (d.status === 'returning') events.push({ kind: 'drone', text: returnEventText(d) })
      else if (d.status === 'docked') {
        events.push({ kind: 'drone', text: d.name + ' 已归舱 · 电量 ' + d.batteryPct.toFixed(1) + '%' })
      } else if (p.status === 'docked' && d.status === 'flying') {
        events.push({ kind: 'drone', text: d.name + ' 换电完毕，重新上岗 · 电量 ' + d.batteryPct.toFixed(1) + '%' })
      }
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

let socketWired = false

function wireSocket(): void {
  if (socketWired) return
  socketWired = true
  const s = getSocket()
  // 服务端灾情域事件（灾情/投送/现场观测/节点）
  s.on('feed', (e: { kind: FeedKind; text: string; time: string }) => {
    feedSeq += 1
    feedEvents.value = appendCapped(feedEvents.value, { seq: feedSeq, ...e }, FEED_MAX)
  })
  s.on('node', (n: { title: string; detail: string; time: string }) => {
    nodeSeq += 1
    nodeRecords.value = appendCapped(nodeRecords.value, { seq: nodeSeq, ...n }, NODE_MAX)
  })
  // 首次连接补历史
  s.on('history', (h: { feed: { kind: FeedKind; text: string; time: string }[]; nodes: { title: string; detail: string; time: string }[] }) => {
    for (const e of h.feed) { feedSeq += 1; feedEvents.value = appendCapped(feedEvents.value, { seq: feedSeq, ...e }, FEED_MAX) }
    for (const n of h.nodes) { nodeSeq += 1; nodeRecords.value = appendCapped(nodeRecords.value, { seq: nodeSeq, ...n }, NODE_MAX) }
  })
}

export function useEventLog() {
  wireSocket()
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
