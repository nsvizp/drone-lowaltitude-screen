/** 接口返回的公共包装 */
export interface ApiResponse<T> {
  code: number
  msg: string
  data: T
}

/** 接口1：飞行总览统计 openTotalDataByDept */
export interface TotalData {
  shelterNum: number
  flyLineNum: number
  achieveNum: number
  flyerNum: number
  workOrderNum: number
  recordCount: number
  flyPlaneNum: number
  /** 飞行里程（公里） */
  flightLength: string
  /** 飞行时长（小时） */
  durationHours: string
}

/** 接口2：飞行记录 openAssociatedFlyRecord */
export interface FlyRecord {
  flyRecordId: number
  flyRecordName: string
  flyLineId: number
  flyLineName: string
  flyerId: number
  flyerName: string
  /** 起飞时间 yyyy-MM-dd HH:mm:ss */
  createTime: string
  shelterId: number
  shelterName: string
}

export interface FlyRecordPage {
  total: number
  rows: FlyRecord[]
}

/** 接口3：工单统计 openWorkOrderOverview */
export interface WorkOrderOverview {
  deptId: number
  deptName: string
  workOrderTotalNum: number
  toReceiveNum: number
  receivedNum: number
  completedNum: number
  displayDate?: string
  workOrderOverviewRespVos?: WorkOrderOverview[]
  secondWordOderDetails?: WorkOrderOverview[]
}

/** 接口4：任务统计 openTaskOverview */
export interface TaskOverview {
  deptId: number
  deptName: string
  taskTotalNum: number
  dispatchedNum: number
  dispatchingNum: number
  receivedNum: number
  completedNum: number
  dispatchedPercent: number
  dispatchingPercent: number
  receivedPercent: number
  completedPercent: number
  taskOverviewRespVoList?: TaskOverview[]
}

/** 接口5：飞行统计 openNewTotalDataByDay */
export interface FlightStat {
  deptId: number
  deptName: string
  recordCount: number
  flightLength: string
  durationHours: string
  displayDate?: string
  countViewRespVos?: FlightStat[]
  secondCountViewRespList?: FlightStat[]
}

/** 排行榜时间范围 */
export type Period = 'today' | 'week' | 'month' | 'year' | 'total'

export type TaskStatus = 'dispatched' | 'dispatching' | 'received' | 'completed'
