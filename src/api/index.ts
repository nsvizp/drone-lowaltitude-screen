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
import { paginateLocal, scaleTask, PERIOD_FACTOR } from './mock-scale'
import type { WarehouseRow } from '@/sim/dispatch-board'

/** VITE_USE_MOCK=1 时强制走本地 mock（离线演示）；默认真接口、失败自动回退 mock */
const USE_MOCK = import.meta.env.VITE_USE_MOCK === '1'

function ok<T>(data: T): ApiResponse<T> {
  return { code: 200, msg: '操作成功', data }
}

/** 真接口优先；网络/服务异常回退本地 mock，保证大屏永不断粮 */
async function req<T>(path: string, fallback: () => Promise<T> | T): Promise<T> {
  if (USE_MOCK) return fallback()
  try {
    const res = await fetch(path)
    if (!res.ok) throw new Error('HTTP ' + res.status)
    return (await res.json()) as T
  } catch (e) {
    console.warn('[api] 后端不可用，回退本地 mock：' + path, e)
    return fallback()
  }
}

/** 接口1：飞行总览统计 */
export function openTotalDataByDept(): Promise<ApiResponse<TotalData>> {
  return req('/api/open/total-data-by-dept', () => ok({ ...totalData }))
}

/** 接口2：分页查询飞行记录（TOP10 按执行时间降序） */
export function openAssociatedFlyRecord(pageNum = 1, pageSize = 10): Promise<FlyRecordPage> {
  const sorted = [...flyRecords].sort((a, b) => b.createTime.localeCompare(a.createTime))
  return req('/api/open/associated-fly-record?pageNum=' + pageNum + '&pageSize=' + pageSize,
    () => paginateLocal(sorted, pageNum, pageSize))
}

/** 接口3：各单位工单统计 */
export function openWorkOrderOverview(): Promise<ApiResponse<WorkOrderOverview>> {
  return req('/api/open/work-order-overview', () => ok(structuredClone(workOrderOverview)))
}

/** 接口4：各单位任务统计（支持时间范围筛选） */
export function openTaskOverview(period: Period = 'total'): Promise<ApiResponse<TaskOverview>> {
  return req('/api/open/task-overview?period=' + period,
    () => ok(scaleTask(taskOverview, PERIOD_FACTOR[period])))
}

/** 接口5：各单位飞行统计（2024-01-01 至今） */
export function openNewTotalDataByDay(): Promise<ApiResponse<FlightStat>> {
  return req('/api/open/new-total-data-by-day', () => ok(structuredClone(flightStats)))
}

/** 仓储台账（物资仓储情况面板） */
export function openWarehouses(fallback: WarehouseRow[]): Promise<WarehouseRow[]> {
  return req('/api/warehouses', () => fallback)
}

/** 方舱台账 */
export function openShelters<T>(fallback: T): Promise<T> {
  return req('/api/shelters', () => fallback)
}

/** 飞手名册 */
export function openFlyers<T>(fallback: T): Promise<T> {
  return req('/api/flyers', () => fallback)
}
