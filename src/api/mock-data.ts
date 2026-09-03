import type { FlyRecord, FlightStat, TaskOverview, TotalData, WorkOrderOverview } from './types'

export const totalData: TotalData = {
  shelterNum: 11,
  flyLineNum: 48,
  achieveNum: 156,
  flyerNum: 12,
  workOrderNum: 50,
  recordCount: 168,
  flyPlaneNum: 60,
  flightLength: '1392.47',
  durationHours: '35.1',
}

export const flyRecords: FlyRecord[] = [
  { flyRecordId: 1001, flyRecordName: '巡检飞行记录-东区线路', flyLineId: 2001, flyLineName: '指点飞行', flyerId: 3001, flyerName: '张三', createTime: '2026-05-09 10:30:00', shelterId: 4001, shelterName: '1号方舱' },
  { flyRecordId: 1002, flyRecordName: '巡检飞行记录-西区线路', flyLineId: 2002, flyLineName: '航线飞行', flyerId: 3002, flyerName: '李四', createTime: '2026-05-09 14:20:00', shelterId: 4002, shelterName: '2号方舱' },
  { flyRecordId: 1003, flyRecordName: '巡检飞行记录-南区线路', flyLineId: 2003, flyLineName: '指点飞行', flyerId: 3003, flyerName: '王五', createTime: '2026-05-10 09:15:00', shelterId: 4001, shelterName: '1号方舱' },
  { flyRecordId: 1004, flyRecordName: '巡检飞行记录-北区线路', flyLineId: 2004, flyLineName: '航线飞行', flyerId: 3001, flyerName: '张三', createTime: '2026-05-10 13:45:00', shelterId: 4003, shelterName: '3号方舱' },
  { flyRecordId: 1005, flyRecordName: '应急巡检-故障点A', flyLineId: 2005, flyLineName: '指点飞行', flyerId: 3004, flyerName: '赵六', createTime: '2026-05-11 08:00:00', shelterId: 4002, shelterName: '2号方舱' },
  { flyRecordId: 1006, flyRecordName: '日常巡检-中心区域', flyLineId: 2006, flyLineName: '航线飞行', flyerId: 3002, flyerName: '李四', createTime: '2026-05-11 16:30:00', shelterId: 4001, shelterName: '1号方舱' },
  { flyRecordId: 1007, flyRecordName: '夜间巡检-高压线路', flyLineId: 2007, flyLineName: '指点飞行', flyerId: 3003, flyerName: '王五', createTime: '2026-05-12 20:10:00', shelterId: 4004, shelterName: '4号方舱' },
  { flyRecordId: 1008, flyRecordName: '巡检飞行记录-变电站周边', flyLineId: 2008, flyLineName: '航线飞行', flyerId: 3004, flyerName: '赵六', createTime: '2026-05-12 11:25:00', shelterId: 4003, shelterName: '3号方舱' },
  { flyRecordId: 1009, flyRecordName: '巡检飞行记录-河流区域', flyLineId: 2009, flyLineName: '指点飞行', flyerId: 3001, flyerName: '张三', createTime: '2026-05-13 07:50:00', shelterId: 4002, shelterName: '2号方舱' },
  { flyRecordId: 1010, flyRecordName: '巡检飞行记录-山区线路', flyLineId: 2010, flyLineName: '航线飞行', flyerId: 3002, flyerName: '李四', createTime: '2026-05-13 15:40:00', shelterId: 4001, shelterName: '1号方舱' },
]

export const workOrderOverview: WorkOrderOverview = {
  deptId: 100, deptName: '省公司', workOrderTotalNum: 56, toReceiveNum: 12, receivedNum: 28, completedNum: 16,
  workOrderOverviewRespVos: [
    {
      deptId: 101, deptName: '市公司A', workOrderTotalNum: 22, toReceiveNum: 5, receivedNum: 12, completedNum: 5,
      secondWordOderDetails: [
        { deptId: 101, deptName: '市公司A', workOrderTotalNum: 22, toReceiveNum: 2, receivedNum: 4, completedNum: 2, displayDate: '2026/5/9' },
        { deptId: 101, deptName: '市公司A', workOrderTotalNum: 22, toReceiveNum: 1, receivedNum: 3, completedNum: 1, displayDate: '2026/5/10' },
        { deptId: 101, deptName: '市公司A', workOrderTotalNum: 22, toReceiveNum: 2, receivedNum: 5, completedNum: 2, displayDate: '2026/5/11' },
      ],
    },
    {
      deptId: 102, deptName: '市公司B', workOrderTotalNum: 18, toReceiveNum: 4, receivedNum: 9, completedNum: 5,
      secondWordOderDetails: [
        { deptId: 102, deptName: '市公司B', workOrderTotalNum: 18, toReceiveNum: 1, receivedNum: 3, completedNum: 2, displayDate: '2026/5/9' },
        { deptId: 102, deptName: '市公司B', workOrderTotalNum: 18, toReceiveNum: 2, receivedNum: 4, completedNum: 1, displayDate: '2026/5/10' },
        { deptId: 102, deptName: '市公司B', workOrderTotalNum: 18, toReceiveNum: 1, receivedNum: 2, completedNum: 2, displayDate: '2026/5/11' },
      ],
    },
    {
      deptId: 103, deptName: '市公司C', workOrderTotalNum: 16, toReceiveNum: 3, receivedNum: 7, completedNum: 6,
      secondWordOderDetails: [
        { deptId: 103, deptName: '市公司C', workOrderTotalNum: 16, toReceiveNum: 1, receivedNum: 2, completedNum: 3, displayDate: '2026/5/9' },
        { deptId: 103, deptName: '市公司C', workOrderTotalNum: 16, toReceiveNum: 1, receivedNum: 3, completedNum: 2, displayDate: '2026/5/10' },
        { deptId: 103, deptName: '市公司C', workOrderTotalNum: 16, toReceiveNum: 1, receivedNum: 2, completedNum: 1, displayDate: '2026/5/11' },
      ],
    },
  ],
}

export const taskOverview: TaskOverview = {
  deptId: 100, deptName: '省公司', taskTotalNum: 120,
  dispatchedNum: 24, dispatchingNum: 36, receivedNum: 48, completedNum: 12,
  dispatchedPercent: 20, dispatchingPercent: 30, receivedPercent: 40, completedPercent: 10,
  taskOverviewRespVoList: [
    { deptId: 101, deptName: '江心洲', taskTotalNum: 50, dispatchedNum: 10, dispatchingNum: 15, receivedNum: 20, completedNum: 5, dispatchedPercent: 20, dispatchingPercent: 30, receivedPercent: 40, completedPercent: 10 },
    { deptId: 102, deptName: '水务局', taskTotalNum: 40, dispatchedNum: 8, dispatchingNum: 12, receivedNum: 16, completedNum: 4, dispatchedPercent: 20, dispatchingPercent: 30, receivedPercent: 40, completedPercent: 10 },
    { deptId: 103, deptName: '交通局', taskTotalNum: 30, dispatchedNum: 6, dispatchingNum: 9, receivedNum: 12, completedNum: 3, dispatchedPercent: 20, dispatchingPercent: 30, receivedPercent: 40, completedPercent: 10 },
  ],
}

export const flightStats: FlightStat = {
  deptId: 100, deptName: '省公司', recordCount: 168, flightLength: '1392.47', durationHours: '35.1',
  countViewRespVos: [
    {
      deptId: 101, deptName: '江心洲', recordCount: 68, flightLength: '560.2', durationHours: '14.2',
      secondCountViewRespList: [
        { deptId: 101, deptName: '江心洲', recordCount: 12, flightLength: '98.5', durationHours: '2.5', displayDate: '2026/5/9' },
        { deptId: 101, deptName: '江心洲', recordCount: 15, flightLength: '125.3', durationHours: '3.1', displayDate: '2026/5/10' },
        { deptId: 101, deptName: '江心洲', recordCount: 10, flightLength: '82.4', durationHours: '2.0', displayDate: '2026/5/11' },
      ],
    },
    {
      deptId: 102, deptName: '水务局', recordCount: 55, flightLength: '450.8', durationHours: '11.3',
      secondCountViewRespList: [
        { deptId: 102, deptName: '水务局', recordCount: 8, flightLength: '65.2', durationHours: '1.6', displayDate: '2026/5/9' },
        { deptId: 102, deptName: '水务局', recordCount: 12, flightLength: '98.7', durationHours: '2.5', displayDate: '2026/5/10' },
        { deptId: 102, deptName: '水务局', recordCount: 9, flightLength: '75.6', durationHours: '1.9', displayDate: '2026/5/11' },
      ],
    },
    {
      deptId: 103, deptName: '交通局', recordCount: 45, flightLength: '381.47', durationHours: '9.6',
      secondCountViewRespList: [
        { deptId: 103, deptName: '交通局', recordCount: 7, flightLength: '58.9', durationHours: '1.5', displayDate: '2026/5/9' },
        { deptId: 103, deptName: '交通局', recordCount: 10, flightLength: '85.3', durationHours: '2.1', displayDate: '2026/5/10' },
        { deptId: 103, deptName: '交通局', recordCount: 8, flightLength: '68.2', durationHours: '1.7', displayDate: '2026/5/11' },
      ],
    },
  ],
}
