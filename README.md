# 无人机低空指挥调度平台 · 大屏可视化

上海无人机低空智慧调度平台的数据大屏原型。Vue 3 + Vite + TypeScript + ECharts + 高德地图。

## 功能

| 模块 | 内容 |
| --- | --- |
| 登录页 | 用户名/密码/验证码（mock 账号：admin / admin123），登录成功进大屏、登出回登录页 |
| 顶部导航 | 实时时间、星期、日期、天气；系统标题；首页（登出）、用户名、头像 |
| 左栏 | 资源总览（方舱/飞手/航线/架次/计划/工单/里程/时长）+ 飞行案例 TOP10（按执行时间降序，卡片式） |
| 右栏 | 飞行任务排行榜（今日/本周/本月/本年/累计筛选 × 待派发/派发中/已接单/已结单状态切换，各组织数量与占比）+ 飞行统计分析（ECharts：架次/里程/时长） |
| 中央地图 | 高德地图实时无人机位置（每秒推进，航向旋转、电量消耗、自动返航）、巡检航线、方舱点位，卫星图/电子地图/暗色主题切换，点击无人机查看详情 |
| 大屏适配 | 1920×1080 设计稿等比缩放居中，支持 16:9 / 21:9 / 32:9 / 48:9，无拉伸无裁切 |

## 快速开始

```bash
pnpm install
cp .env.example .env.local   # 填入你自己的高德 Key（不要提交）
pnpm dev                     # http://127.0.0.1:5173
```

> 高德 Key：到 https://lbs.amap.com/ 申请「Web端(JS API)」类型 Key，并同时配置安全密钥。
> 未配置 Key 时地图区域会显示配置提示，其余面板正常工作。

## 测试与构建

```bash
pnpm test        # vitest，32 个用例（mock API / 模拟器 / 大屏适配 / 时钟）
pnpm build       # vue-tsc 类型检查 + 生产构建
```

## 架构

```
src/
  api/          # 5 个 mock 接口（openTotalDataByDept / openAssociatedFlyRecord /
                # openWorkOrderOverview / openTaskOverview / openNewTotalDataByDay）
                # 数据源自物料包 mock JSON；接真后端时替换为 fetch 即可，组件无需改动
  sim/          # 无人机模拟器（纯函数）：大圆距离、航向角、航线插值、机队推进
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
