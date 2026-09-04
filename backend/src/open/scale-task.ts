/** 按时间范围对任务数做确定性缩放（纯函数，可测） */

export type Period = 'today' | 'week' | 'month' | 'year' | 'total'

export const PERIOD_FACTOR: Record<Period, number> = {
  today: 0.08,
  week: 0.3,
  month: 0.6,
  year: 0.85,
  total: 1,
}

export interface TaskNode {
  taskTotalNum: number
  dispatchedNum: number
  dispatchingNum: number
  receivedNum: number
  completedNum: number
  dispatchedPercent: number
  dispatchingPercent: number
  receivedPercent: number
  completedPercent: number
  taskOverviewRespVoList?: TaskNode[]
  [key: string]: unknown
}

export function scaleTask<T extends TaskNode>(node: T, factor: number): T {
  const dispatchedNum = Math.max(0, Math.round(node.dispatchedNum * factor))
  const dispatchingNum = Math.max(0, Math.round(node.dispatchingNum * factor))
  const receivedNum = Math.max(0, Math.round(node.receivedNum * factor))
  const completedNum = Math.max(0, Math.round(node.completedNum * factor))
  const taskTotalNum = dispatchedNum + dispatchingNum + receivedNum + completedNum
  const pct = (n: number) => (taskTotalNum === 0 ? 0 : Math.round((n / taskTotalNum) * 100))
  return {
    ...node,
    taskTotalNum,
    dispatchedNum,
    dispatchingNum,
    receivedNum,
    completedNum,
    dispatchedPercent: pct(dispatchedNum),
    dispatchingPercent: pct(dispatchingNum),
    receivedPercent: pct(receivedNum),
    completedPercent: pct(completedNum),
    taskOverviewRespVoList: node.taskOverviewRespVoList?.map((c) => scaleTask(c, factor)),
  }
}

/** 简单分页（纯函数） */
export function paginate<T>(rows: T[], pageNum: number, pageSize: number): { total: number; rows: T[] } {
  const start = (pageNum - 1) * pageSize
  return { total: rows.length, rows: rows.slice(start, start + pageSize) }
}
