import { flyRecords, flightStats, taskOverview, totalData, workOrderOverview } from './mock-data'
import type {
  ApiResponse,
  FlightStat,
  FlyRecordPage,
  Period,
  TaskOverview,
  TotalData,
  WorkOrderOverview,
} from './types'

const LATENCY_MS = 120

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), LATENCY_MS))
}

function ok<T>(data: T): ApiResponse<T> {
  return { code: 200, msg: '操作成功', data }
}

/** 接口1：飞行总览统计 */
export async function openTotalDataByDept(): Promise<ApiResponse<TotalData>> {
  return delay(ok({ ...totalData }))
}

/** 接口2：分页查询飞行记录（TOP10 按执行时间降序） */
export async function openAssociatedFlyRecord(pageNum = 1, pageSize = 10): Promise<FlyRecordPage> {
  const sorted = [...flyRecords].sort((a, b) => b.createTime.localeCompare(a.createTime))
  const start = (pageNum - 1) * pageSize
  return delay({ total: 25, rows: sorted.slice(start, start + pageSize) })
}

/** 接口3：各单位工单统计 */
export async function openWorkOrderOverview(): Promise<ApiResponse<WorkOrderOverview>> {
  return delay(ok(structuredClone(workOrderOverview)))
}

/** 按时间范围对任务数做确定性缩放，模拟不同周期数据（真实后端接入后删除） */
const PERIOD_FACTOR: Record<Period, number> = {
  today: 0.08,
  week: 0.3,
  month: 0.6,
  year: 0.85,
  total: 1,
}

function scaleTask(node: TaskOverview, factor: number): TaskOverview {
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

/** 接口4：各单位任务统计（支持时间范围筛选） */
export async function openTaskOverview(period: Period = 'total'): Promise<ApiResponse<TaskOverview>> {
  return delay(ok(scaleTask(taskOverview, PERIOD_FACTOR[period])))
}

/** 接口5：各单位飞行统计（2024-01-01 至今） */
export async function openNewTotalDataByDay(): Promise<ApiResponse<FlightStat>> {
  return delay(ok(structuredClone(flightStats)))
}
