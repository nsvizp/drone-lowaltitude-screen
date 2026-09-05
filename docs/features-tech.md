# 应急指挥调度平台 — 功能技术清单

> 版本：2026-09-04（git 0fb997d）｜前端 159 测 / 后端 29 测全绿
> 架构：Vue 3.5 + TS + Vite 6 前端 · NestJS 10 + Prisma 6 + SQLite 后端 · socket.io 实时推送 · shared/sim 共享纯函数引擎（前后端同源）

---

## 一、功能 → 技术对照总表

### 1. 大屏框架与地图

| 功能 | 技术实现 |
|---|---|
| 大屏自适应缩放 | useScreenScale：1920×1080 设计稿 transform scale，居中偏移 |
| 高德地图集成 | @amap/amap-jsapi-loader 动态加载 JS API 2.0；key 由后端 /api/config/public 下发（DB 配置可热改） |
| 卫星/电子/暗色主题 | 三套 AMap 图层切换（Satellite/TileLayer），状态本地持久化 |
| 应急资源图层 | 图层开关（巡航航线/模拟物资/应急人员/应急车辆），确定性 seed（mulberry32 20260903）生成，物资点异步替换为仓储台账真实坐标 |
| 报警横幅 | 灾种名跟随 kind + 真实逆地理地名（街道级）+ 坐标 tooltip 悬浮完整经纬度 |

### 2. 机队实时态势

| 功能 | 技术实现 |
|---|---|
| 机队每秒实时同步 | 后端权威模拟器 1s tick（3 倍速）→ WS 全量快照 → 前端镜像（前端纯订阅者） |
| 无人机标记 | AMap Marker 自定义 DOM；性能优化：内容缓存（状态+5° 朝向桶，不变不重建 DOM） |
| 航迹渐隐尾线 | AMap Polyline，200 点环形；颜色缓存按需 setOptions；归舱即清除 |
| 动态计划航线 | 改派/投送虚线指向目标（勘测红/投送黄），随 tick 收缩 |
| 无人机详情弹窗 | InfoWindow 实时刷新（内容 diff 后才 setContent），含「观看实时视频」入口 |
| 低电返航 | 引擎规则：电量 <20% 强制返航、<10% 紧急降落；统一电量遥测与返航状态 |
| 资源与任务面板 | 可调度统计（无人机/操作员/低电量）+ tab 切换机列表 |
| 飞行案例面板 | 台账 TOP10 + 案例轨迹回放 + 巡航视频联动（useFlightCases） |

### 3. 实时图传（视频窗）

| 功能 | 技术实现 |
|---|---|
| 模拟图传（巡逻） | Canvas 2D 程序生成画面 + HUD 遥测/十字准星/REC/时间戳，rAF 60fps |
| 真实航拍（灾情勘测） | 勘测机在场时切换视频包 public/videos/{flood,fire,debris}/（9 段航拍素材） |
| 多机不同机位 | pickSurveyVideo：droneId 散列选片——多架勘测机画面互不重复 |
| 增援换片 | 执行二次调配后自动切到包内下一段（轮换机位） |
| 信号丢失 | 无人机归舱 → 信号丢失提示，3 秒自动关窗 |
| 窗口交互 | 自研 useDraggable/useResizable：标题栏拖拽、右下角缩放 |

### 4. 两段式灾情指挥（核心流程）

| 功能 | 技术实现 |
|---|---|
| 灾情感知 | POST /api/disaster/simulate {type} → 随机灾点 + 调配引擎生成草稿 pendingPlan，机队按兵不动 |
| AI 推演面板 | 点模拟按钮自动开演；灾种竞态修复：等 WS 灾点到达再开演（≤3s）保证话术与场景一致 |
| 场景化推演话术 | SCENE 话术表：洪灾=洪峰水情 / 泥石流=坡体滑塌 / 火灾=热异常浓烟火势 |
| 推演稿与调配单同源 | buildAiScript 直读 pendingPlan——真实勘测机名/方舱/物资点/ETA |
| 大模型调度 | backend/llm.ts：OpenAI 兼容端点（env 配置）→ 真实候选集提示词 → 防御性 JSON 解析 → 8s 超时/非法/down 自动回退算法引擎 |
| 选案注入 | planFloodDispatch picks 参数：大模型指定勘测机/物资点/方舱，无效项忽略回退 |
| 来源徽标 | 快照带 planSource（ai/algorithm）+ aiReasoning 研判原文，AI 卡头部紫/灰徽标 |
| 指挥确认 | 推演完成+草稿到达 → 确认弹框（预览草稿全貌）→ POST /api/disaster/execute 下达 |
| 草稿卡三态门控 | draftConfirmState：大模型选案→只在 AI 卡确认；算法兜底→推演中锁定/完成后解锁 |
| 灾点地名 | 三级精度链：AMap JS Geocoder（街道级，需安全密钥）→ REST regeo → 行政区+最近地标（14 个上海地标库） |

### 5. 执行阶段（确认下达后）

| 功能 | 技术实现 |
|---|---|
| 抢险调配单（执行态） | 勘测组/投送组/警告；liveSurveyRows：电量/距离/ETA 随快照每秒实时刷新；到场显示「已到场」 |
| 现场态势引擎 | assessSituation：勘测机盘旋时每 6 tick 生成现场事件（道路/受困/投送），与事件流同源 |
| 物资投送登记 | detectSupplyDrops：越过灾点上空即空投；实时扣减来源仓库库存（DB）+ WS 广播 → 面板进度条同步 |
| AI 情况分析幕 | 现场事件新增即自动分析（引用真实事件文本+累计投送，限 3 次防刷屏） |
| 增援评估 | evaluateReinforcement：水位趋势/受困/覆盖度三维评估 → 建议二次调配 + 理由 |
| 评估闩锁 | latchReinforceEval：一旦触发即锁定到执行/结束，杜绝趋势回落导致按钮闪烁消失 |
| AI 二次调度分析幕 | 评估触发自动给出依据与建议 |
| 二次调配执行 | 次近方舱起飞 R1 勘测 + R2 投送；增援段写入 plan → 调配单绿色「增援组」实时遥测 |
| 结束演练 | 撤机 recallMissionDrones（任务机返航归舱）+ 灾情档案 resolvedAt + 覆盖物清理 |
| AI 结论幕 | 汇总投送件数与任务机数（plan 存活期捕获），处置闭环总结 |

### 6. 事件与档案

| 功能 | 技术实现 |
|---|---|
| 事件实时动态 | WS feed 推送 + 50 条环形缓冲；新页面连入补发 history |
| 节点记录 | 关键节点时间轴（灾情发生/调配下达/勘测到场/空投完成/二次增援/演练结束），30 条环形 |
| 灾情档案 | disaster_events 表：灾种/等级/坐标/起止时间，处置报告页可回看 |
| 写库策略 | EventLogService：内存缓冲即时广播 + 异步写库（失败静默不阻塞实时链路） |

### 7. 后端与安全

| 功能 | 技术实现 |
|---|---|
| 权威模拟引擎 | shared/sim 纯函数（前后端同源）：advanceFleet/divertDrone/launchDrone/recallMissionDrones |
| WS 推送 | @nestjs/websockets + socket.io：fleet 每秒、disaster 变更 diff、feed/node 即时、warehouses 空投时 |
| 认证 | JWT（12h）+ bcryptjs + 登录锁定（5 次失败锁 5 分钟滑动窗口）+ 图形验证码 |
| 全局认证守卫 | AuthGuard（APP_GUARD）+ @Public 白名单；WS 握手 auth.token 鉴权，无效即断 |
| CORS 白名单 | ALLOWED_ORIGINS 环境变量可配，HTTP+WS 同源共用 |
| 台账接口 | /api/warehouses、shelters、flyers（Prisma + SQLite，DB 入库随仓库分发） |
| 统计接口 | /api/open/*（总览/记录分页/工单/任务/飞行统计），mock 回退保证大屏永不断粮 |
| nginx 安全头 | X-Frame-Options / nosniff / Referrer-Policy / CSP（放行高德域+ws） |
| 防掉线 | scripts/start-dev.sh：nohup 双端拉起（父进程挂 init），幂等自检 |

### 8. 测试与质量

| 项 | 数据 |
|---|---|
| 前端测试 | 159（vitest：引擎/选片/地名/闩锁/推演稿/登录守卫等） |
| 后端测试 | 29（登录锁定/规模换算/认证守卫 5/两段式 5/LLM 8） |
| e2e 验证 | Playwright 全流程实测（shots/ 44 张证据截图） |
| 方法论 | 全程 TDD（Red→Green），纯函数 seam 优先 |

---

## 二、技术栈总览

- 前端：Vue 3.5 / TypeScript / Vite 6 / Sass / Pinia / vue-router(hash) / @amap/amap-jsapi-loader / socket.io-client 4
- 后端：NestJS 10 / @nestjs/websockets + socket.io 4 / Prisma 6 / SQLite / bcryptjs / @nestjs/jwt / ts-node
- 共享：shared/sim 纯函数引擎（前后端同一实现，vitest 直测）
- 测试：vitest 3 / Playwright chromium
- 运维：nohup 防掉线 / nginx（部署脚本含安全头）/ GitHub 协作

---

## 三、界面元素级对照（按屏幕区域）

### 中央地图

| 元素 | 技术实现 |
|---|---|
| 飞行轨迹（航迹尾线） | 每机一条 Polyline，200 点环形缓冲每秒追加；**颜色=实时状态**：在飞 #00e5ff 青 / 盘旋 #ffd666 琥珀 / 返航 #a66bff 紫 / 归舱 #3a5578 灰（归舱即整线清除）；颜色缓存——只有状态变化才调 setOptions |
| 计划航线（虚线） | 改派/投送时从机位指向目标：勘测红 #ff6b6b / 投送黄 #ffd666；随飞行逐段收缩，归舱清除 |
| 无人机标记 | 自定义 DOM：状态色机身 + 朝向箭头旋转；内容缓存（状态+5° 朝向桶不变不重建，每秒省 ~10 次 DOM 操作） |
| 巡航航线 | 常亮底图航线层（图层开关可控） |
| 灾点标记 | 警戒圈（半径=等级×400m）+ 脉冲 emoji：🌊 红 / ⛰️ 土黄 / 🔥 橙 |

### 左栏

| 元素 | 技术实现 |
|---|---|
| 资源与任务 | 可调度统计（无人机/操作员/低电量）+ tab 机列表（名称/速度/高度/状态/电量%） |
| 飞行案例 | 台账 TOP10（执行中标记）+ 轨迹回放 + 巡航视频联动 |
| 低电量统计 | 引擎 batteryStateOf：≤25% low / ≤10% critical（紧急降落）；电量消耗 0.004%/s（3 倍速下约 14 分钟耗尽全程） |

### 右栏

| 元素 | 技术实现 |
|---|---|
| 物资调度情况（右上） | 在途架次/已投送件数实时统计（buildDispatchRows 从机队+态势计算） |
| 物资仓储情况 | 12 仓库存进度条（名称/物资明细/余量）；**空投即扣库**：detectSupplyDrops 越点上空 → DB 扣减 → WS 广播 → 进度条秒级同步 |
| 事件实时动态（右下） | WS 推送 5 类事件带图标：⚙️系统 🛩 无人机 🚨灾情 📦投送 📡现场；50 条环形缓冲；新页面连入补发历史 |
| 节点记录 | 关键节点时间轴（灾情发生/调配下达/勘测到场/空投完成/二次增援/演练结束），30 条环形 |

### 悬浮层

| 元素 | 技术实现 |
|---|---|
| 实时图传窗 | 巡逻=Canvas 程序画面（城市透视网格）+ HUD（遥测/准星/REC/时间戳）；灾情勘测=真实航拍视频包（按机散列选片、增援换片）；归舱信号丢失 3s 自动关窗；可拖拽可缩放 |
| AI 推演卡 | 四幕生命周期（开始调度/情况分析/二次调度分析/结论）+ 打字机输出 + 推演中锁定门控 + 选案来源徽标 |
| 抢险调配单 | 草稿态（静态预览+三态确认门控）→ 执行态（勘测组每秒实时遥测/增援组/评估块） |
| 报警横幅 | 灾种+等级+街道级真实地名（三级逆地理链）+ 坐标 tooltip |
| 无人机详情弹窗 | InfoWindow 跟随机位每秒刷新（内容 diff 后才重建），含实时视频入口 |

### 返航全场景

| 场景 | 触发 | 行为 |
|---|---|---|
| 低电返航 | 电量 ≤25% | 强制脱离任务返航，航线画回家 |
| 紧急降落 | 电量 ≤10% | 原地降落（critical） |
| 演练撤机 | 点「结束演练」 | recallMissionDrones：全部任务机（勘测/投送/增援）返航归舱，航线与标记清理 |
| 正常归舱 | 任务完成/返航到达 | 标记隐藏 + 航迹清除 + 若正在看图传则 3s 后自动关窗 |
