# 应急指挥调度平台 · 大屏可视化

上海无人机低空智慧调度平台的数据大屏原型。Vue 3 + Vite + TypeScript + ECharts + 高德地图。

## 功能

| 模块 | 内容 |
| --- | --- |
| 登录页 | 用户名/密码/验证码（admin / Admin@2026，后端 bcrypt 校验）；强密码强制；连续失败 5 次锁 5 分钟（服务端滑窗判定） |
| 顶部导航 | 实时时间、星期、日期、天气；系统标题；首页（登出）、用户名、头像 |
| 左栏 | 资源总览（方舱/飞手/航线/架次/计划/工单/里程/时长）+ 飞行案例 TOP10（按执行时间降序，卡片式） |
| 右栏 | 飞行任务排行榜（今日/本周/本月/本年/累计筛选 × 待派发/派发中/已接单/已结单状态切换，各组织数量与占比）+ 飞行统计分析（ECharts：架次/里程/时长） |
| 中央地图 | 高德地图实时无人机位置（每秒推进，航向旋转、电量消耗、自动返航）、巡检航线、方舱点位，卫星图/电子地图/暗色主题切换，点击无人机查看详情 |
| 大屏适配 | 1920×1080 设计稿等比缩放居中，支持 16:9 / 21:9 / 32:9 / 48:9，无拉伸无裁切 |
| 应急图层 | 模拟物资/应急人员/应急车辆三图层，图层控件独立显隐（默认隐藏），点击查详情 |
| 洪灾抢险 | 「模拟洪灾」随机灾情 → 红色闪烁报警 → 调配引擎自动改派勘测机 + 方舱起飞投送（灾种匹配物资、休整优先飞手） |
| 现场追踪 | 勘测机灾点盘旋，实时事件流（水位/受淹面积/被困人数），态势总结卡 |
| 二次调配 | 增援评估规则引擎（覆盖不足/水位连涨/被困超阈/电量红线）→ 结论卡 + 一键增援 |
| 实时视频 | 点击无人机 →「观看实时视频」→ 模拟 FPV 小窗（HUD 遥测实时联动，预留 FLV 真流接口） |
| 实时轨迹 | 航迹尾线渐隐；改派/投送时计划航线动态切换为虚线指向目标 |

## 快速开始

```bash
# 1. 后端（数据库文件已随仓库提交，clone 即用，无需建库/种子）
cd backend && pnpm install --ignore-workspace   # postinstall 自动生成 Prisma Client
pnpm dev                       # http://127.0.0.1:3000/api

# 2. 前端（另开终端，/api 自动代理到 3000）
pnpm install
pnpm dev                       # http://127.0.0.1:5173
```

> 数据库为 SQLite 单文件 backend/data/app.db（已提交，含 admin 账号/高德 Key/台账种子数据）；
> 如需重置：删除该文件后执行 pnpm exec prisma migrate dev && pnpm seed。

> 配置优先级：后端 /api/config/public（数据库 system_config 表）> .env.local（后端未启动时的离线兜底）。
> 高德 Key：到 https://lbs.amap.com/ 申请「Web端(JS API)」类型 Key 与安全密钥，写入数据库或 .env.local 均可；
> 防盗刷请在高德后台配置**域名白名单**。

## 测试与构建

```bash
pnpm test        # vitest，67 个用例（mock API / 模拟器 / 灾情调配 / 态势评估 / 适配 / 时钟）
pnpm build       # vue-tsc 类型检查 + 生产构建
```

## 架构

```
src/
  api/          # 5 个 mock 接口（openTotalDataByDept / openAssociatedFlyRecord /
                # openWorkOrderOverview / openTaskOverview / openNewTotalDataByDay）
                # 数据源自物料包 mock JSON；接真后端时替换为 fetch 即可，组件无需改动
  sim/          # 纯函数内核：drone-sim（机队/航迹/改飞/盘旋） disaster（调配引擎）
                # situation（事件流/总结/增援评估） video（视频源） emergency-data（应急图层）
  composables/  # useScreenScale（等比缩放）/ useClock / useDrones
  views/        # LoginView、ScreenView
  views/screen/ # TopBar、LeftPanel、RightPanel、CenterMap
  stores/       # pinia auth（mock 登录 + localStorage token）
```

## 说明与已知边界

- 任务排行榜的周期筛选：mock 数据未按周期细分，前端按确定性系数缩放模拟；接真后端后删除 `PERIOD_FACTOR`。
- 天气为静态演示数据，真实场景接气象接口。
- 无人机实时数据由内置模拟器生成（上海 6 条示范航线、8 架机），真实场景替换为 WebSocket 推送后复用 `useDrones` 的渲染接口。
- 生产构建中 ScreenView chunk 较大（ECharts 全量引入）；可按需改 `echarts/core` 按需引入。