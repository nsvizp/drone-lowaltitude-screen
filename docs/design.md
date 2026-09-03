# 无人机低空指挥调度平台 · 大屏可视化系统设计文档

| 版本 | 日期 | 说明 |
| --- | --- | --- |
| v0.1 | 2026-09-03 | 大屏原型首版（mock 数据 + 模拟器） |

---

## 1. 背景与目标

公安、交管部门对辖区道路、重点区域开展无人机常态化巡航。本系统建设「态势一张图」大屏，统一展示：

- 无人机**实时位置**、**航线**、**任务状态**
- 飞行资源总览（方舱、飞手、航线、架次等）
- 飞行案例、任务排行榜、飞行统计分析

### 1.1 设计目标

1. **展示优先**：1920×1080 设计稿等比缩放，16:9 / 21:9 / 32:9 / 48:9 无拉伸无裁切
2. **可换数据**：mock 层与接口文档一一对应，接真后端时组件零改动
3. **可测**：数据转换与推演逻辑全部下沉为纯函数，UI 只做渲染
4. **合规**：国内底图用高德 JS API，Key 由部署方自配、不入库

### 1.2 非目标（本期不做）

- 无人机控制指令下发（只读态势展示）
- 用户权限体系（mock 单账号）
- 3D 楼宇 / Cesium（预留评估）
- 真实 WebSocket 推送通道（以模拟器代替，接口预留）

---

## 2. 技术选型

| 类别 | 选型 | 理由 |
| --- | --- | --- |
| 框架 | Vue 3.5 + TypeScript | 需求允许 Vue3；组合式 API + 类型约束适合大屏多面板 |
| 构建 | Vite 6 | 秒级 HMR，原生 ESM |
| 样式 | Sass | 需求指定 sass 方案 |
| 图表 | ECharts 5 | 大屏图表事实标准（本期全量引入，后续可按需裁减） |
| 地图 | 高德 JS API 2.0（@amap/amap-jsapi-loader） | 国内合规、上海数据好、暗色主题内置 |
| 状态 | Pinia | 登录态 |
| 测试 | Vitest（node 环境） | 纯函数单测，32 用例 |
| 验收 | Playwright | 截图 + 交互回归脚本 |

浏览器兼容：Chrome / Edge / Firefox / Safari 及国产浏览器极速模式（Chromium 内核）。

---

## 3. 总体架构

```
┌─────────────────────────────────────────────────────────┐
│                     views（渲染层）                        │
│  LoginView   ScreenView ┬ TopBar                         │
│                         ├ LeftPanel（总览/案例）           │
│                         ├ CenterMap（高德地图/无人机）      │
│                         └ RightPanel（排行/统计）          │
├─────────────────────────────────────────────────────────┤
│              composables（状态编排层）                      │
│  useScreenScale   useClock   useDrones                    │
├───────────────────────┬─────────────────────────────────┤
│  api（数据访问层）      │  sim（推演层，纯函数）              │
│  5 个接口 mock 实现     │  航线插值 / 机队推进 / 电量模型      │
│  period 时间范围解析    │  大圆距离 / 航向角                  │
├───────────────────────┴─────────────────────────────────┤
│  stores（pinia：auth 登录态，localStorage 持久化）           │
└─────────────────────────────────────────────────────────┘
```

**分层原则**：渲染层不直接依赖 mock 数据；api 层是唯一的「接缝」（seam），替换实现即完成真后端接入。sim 层不依赖 DOM/AMap，可在 node 环境完整测试。

### 3.1 目录结构

```
src/
  api/           types.ts（接口契约） mock-data.ts index.ts period.ts *.test.ts
  sim/           drone-sim.ts（纯函数模拟器） drone-sim.test.ts
  composables/   useScreenScale.ts useClock.ts useDrones.ts composables.test.ts
  components/    PanelCard.vue（面板卡片通用容器）
  views/         LoginView.vue ScreenView.vue
  views/screen/  TopBar.vue LeftPanel.vue RightPanel.vue CenterMap.vue
  stores/        auth.ts
  router/        index.ts（hash 路由 + 登录守卫）
  styles/        global.scss（设计变量 + 缩放容器）
scripts/         screenshot.mjs / theme-test.mjs / drone-click-test.mjs（Playwright 验收）
```

---

## 4. 模块设计

### 4.1 大屏适配（useScreenScale）

方案：**固定 1920×1080 舞台 + transform scale 等比缩放 + 居中**。

```
scale   = min(viewportW / 1920, viewportH / 1080)
offsetX = (viewportW - 1920 × scale) / 2
offsetY = (viewportH - 1080 × scale) / 2
```

- 与 rem/vw 方案相比，布局按像素精确还原设计稿，不会因比例换算累积误差
- 超宽屏（32:9、48:9）按高度适配，左右留白居中；窄屏上下留白
- `computeScale» 为纯函数，5 个分辨率用例覆盖（含 7680×1440 三屏拼接）
- 取舍：超宽屏两侧留白未利用；若需「内容拉宽」需改为分栏独立缩放，本期不做

### 4.2 数据访问层（api）

5 个接口与物料包《接口字段说明》一一对应：

| 方法 | 接口 | 用途 |
| --- | --- | --- |
| `openTotalDataByDept()» | GET | 飞行总览（方舱/飞手/航线/架次/计划/工单/里程/时长） |
| `openAssociatedFlyRecord(pageNum, pageSize)» | GET | 飞行案例 TOP10，按 `createTime» 降序 |
| `openWorkOrderOverview()» | GET | 工单统计（省→市两级 + 按日明细） |
| `openTaskOverview(period)» | POST | 任务统计（4 状态数量 + 占比 + 下级部门） |
| `openNewTotalDataByDay()» | POST | 飞行统计（架次/里程/时长，省→下级 + 按日明细） |

**接缝设计**：

- 返回类型以 `types.ts» 为契约，组件只 import 类型，不感知 mock 实现
- mock 实现带 120ms 延迟，模拟真实网络
- `openTaskOverview» 的周期筛选：mock 数据未按周期细分，前端按确定性系数缩放（`PERIOD_FACTOR»），接真后端后删除该系数即可

### 4.3 无人机模拟器（sim/drone-sim）

纯函数推演内核，支撑「实时位置 + 航线 + 任务状态」的演示：

```
createShanghaiRoutes()       → 6 条示范航线（陆家嘴/外滩/虹桥/张江/徐汇滨江/浦东机场）
createFleet(routes, n, rng)  → 机队初始状态（确定性 RNG：mulberry32）
advanceFleet(state, routes, dtMs) → 新状态（纯函数，不改入参）
```

推演模型：

- **位置**：沿航线按速度（12~18 m/s）匀速插值；大圆距离 + 线性插值
- **航向**：当前航段方位角（0=正北顺时针），返航 +180°
- **状态机**：`flying →(到终点/电量<15%)→ returning →(回到起点)→ flying»（回巢满电）
- **电量**：0.004%/s 演示速率；低电量（<25%）计入告警统计

确定性 RNG 使测试可复现；11 个用例覆盖距离/航向/插值/状态机/边界（坐标不出上海范围）。

### 4.4 实时编排（useDrones）

- 真实 1s tick 对应模拟 3s（演示倍速，常量 `SIM_SPEED»）
- 每次 tick 整体替换 `drones» 引用，Vue watch 触发地图 marker 增量更新
- 接真后端：将 `setInterval + advanceFleet» 换成 WebSocket 订阅，`drones»/`summary» 的响应式接口不变

### 4.5 中央地图（CenterMap）

- 加载：`AMapLoader.load({ key, version: '2.0' })»，Key 读 `VITE_AMAP_KEY»；未配置/加载失败 → 显示网格 fallback + 配置指引，不影响其他面板
- 图层：
  - 航线：`AMap.Polyline»（虚线、6 色循环）
  - 方舱：`AMap.Marker» 自定义 HTML（4 个固定点位）
  - 无人机：`AMap.Marker» 自定义 HTML，每秒 `setPosition» + `setContent»（航向旋转、状态着色）；点击弹 `InfoWindow»（任务/航线/高度/速度/电量/状态）
- 底图切换：`setMapStyle('amap://styles/darkblue' | 'normal')» + 卫星 `TileLayer.Satellite» 叠加/移除
- 细节：无人机标签 `pointer-events: none»，避免遮挡相邻 marker 点击

### 4.6 登录与路由

- mock 账号 `admin / admin123»（`stores/auth.ts»），token 存 localStorage
- 验证码：canvas 4 字符 + 干扰线，本地校验，点击刷新
- hash 路由守卫：未登录 → `/login»；已登录访问 `/login» → 大屏
- 安全说明：验证码与密码校验均为前端 mock，仅用于演示流程；真实场景必须由后端校验

### 4.7 右侧面板（RightPanel）

- **任务排行榜**：周期（今日/本周/本月/本年/累计）× 状态（待派发/派发中/已接单/已结单）双维切换；选中状态后展示各组织数量与占比横条
- **飞行统计分析**：ECharts 横向柱状图，架次/里程/时长三指标切换；窗口 resize 时 `chart.resize()»

---

## 5. 数据流

```
mock-data.ts ─→ api/index.ts ─→ 面板组件（onMounted 拉取，周期切换重新拉取）

drone-sim.ts ─→ useDrones（1s tick）─→ CenterMap watch ─→ AMap marker 增量更新
                                    └─→ 机队状态条（flying/returning/lowBattery）
```

统计一致性约束（有测试守护）：

- 任务：四状态数量之和 = 任务总量；四状态占比之和 ≈ 100（±4 取整容差）
- 飞行统计：省级 `recordCount» = 各下级之和
- 案例：返回列表必须按执行时间降序

---

## 6. 测试与验收

### 6.1 单元测试（Vitest，32 用例）

| 范围 | 用例数 | 内容 |
| --- | --- | --- |
| `api.test.ts» | 14 | 5 接口契约 + 上述一致性约束 + 时间范围解析 |
| `drone-sim.test.ts» | 11 | 地理计算 / 航线插值 / 机队状态机 / 上海范围边界 |
| `composables.test.ts» | 7 | 5 种分辨率缩放 + 时钟格式化 |

### 6.2 验收脚本（Playwright）

```bash
node scripts/screenshot.mjs        # 登录页 / 大屏 / 周期+状态筛选
node scripts/theme-test.mjs        # 卫星图 / 电子地图切换
node scripts/drone-click-test.mjs  # 无人机详情弹窗
```

产出截图在 `shots/»，用于视觉回归比对。

### 6.3 验收标准对照（需求文档 §六）

| 标准 | 状态 |
| --- | --- |
| 左/中/右三栏 + 顶部导航 | ✅ |
| 飞行总览数据正确展示 | ✅ |
| 案例 TOP10 降序卡片 | ✅ |
| 排行榜周期筛选 + 状态切换组织占比 | ✅ |
| 飞行统计架次/里程/时长 | ✅ |
| 地图底图切换（卫星/电子/暗色） | ✅ |
| 多分辨率自适应无拉伸裁切 | ✅（含 48:9 用例） |

---

## 7. 部署与环境

```bash
pnpm install
cp .env.example .env.local   # VITE_AMAP_KEY / VITE_AMAP_SECURITY_CODE（部署方自配，git 忽略）
pnpm dev                     # 开发
pnpm build && pnpm preview   # 生产
```

- 构建产物 `dist/» 为纯静态文件，可放任意静态服务器 / Nginx
- 高德 Key 需在控制台配置白名单域名；2021 年后申请的 Key 必须同时配置安全密钥

---

## 8. 已知边界与后续路线

| 项 | 现状 | 后续 |
| --- | --- | --- |
| 实时通道 | 内置模拟器（3 倍速） | WebSocket 订阅替换 `useDrones» 内部实现 |
| 任务周期数据 | 前端系数缩放模拟 | 后端按周期返回后删除 `PERIOD_FACTOR» |
| 天气 | 静态展示 | 接气象接口 |
| ECharts 体积 | 全量引入（chunk ~1MB） | 改 `echarts/core» 按需引入 + manualChunks 分包 |
| AI 识别告警 | 未实现 | 告警事件流面板 + 地图目标弹窗（数据字段已在接口2中） |
| 超宽屏留白 | 居中留白 | 可选：三栏独立填充布局 |

---

## 9. 关键决策记录（ADR 摘要）

1. **等比缩放而非 rem/vw**：设计稿精确还原 > 超宽屏空间利用；测试可覆盖全部目标分辨率
2. **模拟器做成纯函数内核**：推演逻辑不依赖 DOM/AMap，node 环境可测；渲染层只做 marker 同步
3. **mock 按接口文档签名实现**：`src/api» 是唯一替换点，避免接真后端时改动组件
4. **高德而非 Cesium**：本期 2D 态势足够，接入成本与合规性最优；3D 需求另行评估
5. **hash 路由**：静态部署无需服务端 rewrite 规则

---

## 10. 洪灾抢险子系统（v2 新增）

### 10.1 闭环

```
灾情生成 → 初次调配 → 现场追踪 → 态势总结 → 二次调配评估 → 增援执行
simulateFlood  planFlood  assessSituation  summarize   evaluateReinforcement
```

### 10.2 调配引擎（sim/disaster.ts，纯函数）

- **勘测组**：在飞 + 巡逻中 + 电量 ≥ 50% 的无人机按距灾点升序取 2 架改飞（不新起飞，响应最快）
- **投送组**：距灾点最近且有备用机的方舱出新机；物资点**灾种匹配优先于距离**（洪灾关键词：饮用水/食品/救生/冲锋舟/帐篷/被褥，防化服等不匹配项自动降权）；飞手按最近任务时间升序取 2 名（休整最充分、不重复）
- 输出含全部证据字段（距离/电量/ETA/航段里程），供调配单面板直接展示

### 10.3 模拟器扩展（sim/drone-sim.ts）

- `DroneState» 新增 `track»（航迹，上限 200 点）、`plannedRoute»（动态航线）、`mission»（patrol/survey/delivery）、`orbitCenter/orbitAngle»（盘旋）、`home»（归巢点）
- 状态机扩展：`docked»（归舱）与 `hovering»（盘旋）；盘旋低电量自动返航
- `divertDrone» 改派、`launchDrone» 方舱起飞，均为纯函数

### 10.4 态势与评估（sim/situation.ts，纯函数）

- `assessSituation»：水位演化模型（前期 60% 概率上涨，随观测次数趋稳）、面积/被困估计增长、事件流上限 30 条
- `evaluateReinforcement» 规则：面积超覆盖 / 水位三连涨 / 被困 > 20 人 / 勘测机电量 < 30%，输出理由 + 增援建议

### 10.5 实时视频（sim/video.ts + VideoFeed.vue）

- `getVideoSource» 是唯一真流接缝：当前返回模拟场景（巡逻=城市网格 / 勘测=水面波纹），接真机时改为 `{ type: 'flv', url }»，渲染层换 flv.js 即可
- 入口：无人机 InfoWindow 内「观看实时视频」按钮（事件委托），浮动小窗 canvas 渲染，HUD 遥测每秒与模拟器真实状态同步

### 10.6 编排（composables）

- `useDrones» 重构为模块级共享单例（机队状态跨组件共享，惰性启动）
- `useDisaster» 注册 `onFleetTick» 钩子：每 10 tick 驱动观测、投送归舱登记、逐 tick 刷新总结与评估
