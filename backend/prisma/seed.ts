import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // 管理员账号：admin / Admin@2026（bcrypt）
  await prisma.user.upsert({
    where: { username: 'admin' },
    create: {
      username: 'admin',
      passwordHash: await bcrypt.hash('Admin@2026', 10),
      displayName: 'Admin',
      role: 'admin',
    },
    update: {},
  })

  // 公开配置：高德 key（从前端 .env.local 迁入数据库）
  await prisma.systemConfig.upsert({
    where: { key: 'amap.key' },
    create: {
      key: 'amap.key',
      value: 'b54fe350f613dfe61c5ebf4753fd9362',
      isSecret: false,
      description: '高德 JS API Key（前端加载地图用；防盗刷靠高德后台域名白名单）',
    },
    update: {},
  })

  // ---------- 聚合快照（对齐 mock 数值） ----------
  const feeds: Record<string, unknown> = {
    total_data: {
      shelterNum: 11, flyLineNum: 48, achieveNum: 156, flyerNum: 12,
      workOrderNum: 50, recordCount: 168, flyPlaneNum: 60,
      flightLength: '1392.47', durationHours: '35.1',
    },
    task_overview: {
      deptId: 100, deptName: '省公司', taskTotalNum: 120,
      dispatchedNum: 24, dispatchingNum: 36, receivedNum: 48, completedNum: 12,
      dispatchedPercent: 20, dispatchingPercent: 30, receivedPercent: 40, completedPercent: 10,
      taskOverviewRespVoList: [
        { deptId: 101, deptName: '江心洲', taskTotalNum: 50, dispatchedNum: 10, dispatchingNum: 15, receivedNum: 20, completedNum: 5, dispatchedPercent: 20, dispatchingPercent: 30, receivedPercent: 40, completedPercent: 10 },
        { deptId: 102, deptName: '水务局', taskTotalNum: 40, dispatchedNum: 8, dispatchingNum: 12, receivedNum: 16, completedNum: 4, dispatchedPercent: 20, dispatchingPercent: 30, receivedPercent: 40, completedPercent: 10 },
        { deptId: 103, deptName: '交通局', taskTotalNum: 30, dispatchedNum: 6, dispatchingNum: 9, receivedNum: 12, completedNum: 3, dispatchedPercent: 20, dispatchingPercent: 30, receivedPercent: 40, completedPercent: 10 },
      ],
    },
    workorder_overview: {
      deptId: 100, deptName: '省公司', workOrderTotalNum: 56, toReceiveNum: 12, receivedNum: 28, completedNum: 16,
      workOrderOverviewRespVos: [
        { deptId: 101, deptName: '市公司A', workOrderTotalNum: 22, toReceiveNum: 5, receivedNum: 12, completedNum: 5 },
        { deptId: 102, deptName: '市公司B', workOrderTotalNum: 18, toReceiveNum: 4, receivedNum: 9, completedNum: 5 },
        { deptId: 103, deptName: '市公司C', workOrderTotalNum: 16, toReceiveNum: 3, receivedNum: 7, completedNum: 6 },
      ],
    },
    flight_stats: {
      deptId: 100, deptName: '省公司', recordCount: 168, flightLength: '1392.47', durationHours: '35.1',
      countViewRespVos: [
        { deptId: 101, deptName: '江心洲', recordCount: 68, flightLength: '560.2', durationHours: '14.2' },
        { deptId: 102, deptName: '水务局', recordCount: 55, flightLength: '452.3', durationHours: '11.5' },
        { deptId: 103, deptName: '交通局', recordCount: 45, flightLength: '379.97', durationHours: '9.4' },
      ],
    },
  }
  for (const [key, payload] of Object.entries(feeds)) {
    await prisma.statFeed.upsert({
      where: { key },
      create: { key, payload: JSON.stringify(payload) },
      update: { payload: JSON.stringify(payload) },
    })
  }

  // ---------- 飞行记录 ----------
  const records = [
    [1001, '巡检飞行记录-东区线路', 2001, '指点飞行', 3001, '张三', '2026-05-09 10:30:00', 4001, '1号方舱'],
    [1002, '巡检飞行记录-西区线路', 2002, '航线飞行', 3002, '李四', '2026-05-09 14:20:00', 4002, '2号方舱'],
    [1003, '巡检飞行记录-南区线路', 2003, '指点飞行', 3003, '王五', '2026-05-10 09:15:00', 4001, '1号方舱'],
    [1004, '巡检飞行记录-北区线路', 2004, '航线飞行', 3001, '张三', '2026-05-10 13:45:00', 4003, '3号方舱'],
    [1005, '应急巡检-故障点A', 2005, '指点飞行', 3004, '赵六', '2026-05-11 08:00:00', 4002, '2号方舱'],
    [1006, '日常巡检-中心区域', 2006, '航线飞行', 3002, '李四', '2026-05-11 16:30:00', 4001, '1号方舱'],
    [1007, '夜间巡检-高压线路', 2007, '指点飞行', 3003, '王五', '2026-05-12 20:10:00', 4004, '4号方舱'],
    [1008, '巡检飞行记录-变电站周边', 2008, '航线飞行', 3004, '赵六', '2026-05-12 11:25:00', 4003, '3号方舱'],
    [1009, '巡检飞行记录-河流区域', 2009, '指点飞行', 3001, '张三', '2026-05-13 07:50:00', 4002, '2号方舱'],
    [1010, '巡检飞行记录-山区线路', 2010, '航线飞行', 3002, '李四', '2026-05-13 15:40:00', 4001, '1号方舱'],
  ] as const
  for (const [id, name, routeId, routeName, flyerId, flyerName, createTime, shelterId, shelterName] of records) {
    await prisma.flightRecord.upsert({
      where: { id },
      create: { id, name, routeId, routeName, flyerId, flyerName, createTime, shelterId, shelterName },
      update: {},
    })
  }

  // ---------- 台账：仓储 / 方舱 / 飞手 ----------
  const warehouses = [
    ['浦东防汛物资仓库', '浦东新区应急管理局', '沙袋 · 救生衣 · 抽水泵', 4680, 6000, 121.544, 31.222],
    ['徐汇医疗物资储备点', '徐汇区卫健委', '急救包 · 担架 · 氧气瓶', 2350, 3000, 121.437, 31.188],
    ['静安应急食品供应站', '静安区商务委', '饮用水 · 方便食品', 9200, 12000, 121.459, 31.247],
    ['杨浦救援装备库', '杨浦区消防救援支队', '破拆工具 · 绳索装备', 1120, 1500, 121.526, 31.259],
    ['虹桥综合物资枢纽', '闵行区应急管理局', '帐篷 · 被褥 · 照明设备', 5400, 8000, 121.381, 31.194],
    ['张江防疫物资仓', '浦东新区疾控中心', '防护服 · 消杀设备', 3100, 5000, 121.587, 31.207],
    ['宝山钢材应急库', '宝山区建管委', '支撑钢梁 · 防护板', 860, 1000, 121.47, 31.29],
    ['嘉定燃油储备点', '嘉定区发改委', '柴油 · 汽油 · 发电机油料', 1750, 2000, 121.38, 31.28],
    ['松江通信器材库', '松江区科委', '对讲机 · 卫星电话', 640, 1200, 121.44, 31.163],
    ['青浦水域救援物资点', '青浦区水务局', '冲锋舟 · 救生圈', 430, 600, 121.37, 31.17],
    ['奉贤临时安置物资站', '奉贤区民政局', '折叠床 · 毛毯 · 热食', 2900, 4000, 121.55, 31.165],
    ['金山化工应急物资库', '金山区应急管理局', '防化服 · 中和剂', 980, 1500, 121.6, 31.17],
  ] as const
  for (let i = 0; i < warehouses.length; i++) {
    const [name, org, items, stock, capacity, lng, lat] = warehouses[i]
    await prisma.warehouse.upsert({
      where: { name },
      create: { id: 5001 + i, name, org, items, stock, capacity, lng, lat },
      update: { lng, lat },
    })
  }

  const shelters = [
    [4001, '1号方舱', 121.499, 31.241, 2],
    [4002, '2号方舱', 121.445, 31.189, 2],
    [4003, '3号方舱', 121.595, 31.205, 2],
    [4004, '4号方舱', 121.333, 31.2, 1],
  ] as const
  for (const [id, name, lng, lat, spareDrones] of shelters) {
    await prisma.shelter.upsert({ where: { id }, create: { id, name, lng, lat, spareDrones }, update: {} })
  }

  const flyers = [
    [3001, '张三', '2026-05-13 07:50'],
    [3002, '李四', '2026-05-13 15:40'],
    [3003, '王五', '2026-05-12 20:10'],
    [3004, '赵六', '2026-05-12 11:25'],
  ] as const
  for (const [id, name, lastMission] of flyers) {
    await prisma.flyer.upsert({ where: { id }, create: { id, name, lastMission }, update: {} })
  }

  console.log('[seed] done: user admin, config amap.key, stat feeds, 10 records, 12 warehouses, 4 shelters, 4 flyers')
}

main().finally(() => prisma.$disconnect())