# 项目架构文档 — 应急指挥调度平台

> 版本基线：commit bdee413（M3 权威模拟器完成后）

## 1. 总体架构

```
┌─────────────────────────── 浏览器（可多开大屏） ───────────────────────────┐
│ Vue 3 大屏前端（:5173）                                                   │
│  ├─ 展示层  CenterMap(高德) / LeftPanel / RightPanel / SituationCard …    │
│  ├─ 状态层  composables：useDrones / useDisaster / useEventLog（纯订阅）   │
│  └─ 接入层  src/api（REST + 失败回退 mock）· socket.io-client（WS 订阅）   │
└──────────────▲──────────────────────────────────▲────────────────────────┘
        REST /api/* │  vite 代理           WS /socket.io │  vite 代理(ws)
┌──────────────┴──────────────────────────────────┴────────────────────────┐
│ NestJS 后端（:3000，全局前缀 /api）                                       │
│  ├─ sim-host   权威模拟器：FleetService(1s tick) / DisasterService(灾情编排)│
│  │             EventLogService(事件写库+广播) / EventsGateway(socket.io)   │
│  ├─ open       5 个统计接口（stat_feeds 聚合快照 + flight_records）        │
│  ├─ ledger     台账接口：warehouses / shelters / flyers                    │
│  ├─ auth       JWT 登录 + bcrypt + 滑动窗口锁定（5 次锁 5 分钟）           │
│  └─ config     /api/config/public（system_config 公开项，如高德 Key）      │
│  Prisma ORM ──► SQLite 单文件 backend/data/app.db（WAL，随仓库提交）       │
└──────────────────────────────────────────────────────────────────────────┘
┌────────────────────────── shared/sim（前后端共享引擎） ───────────────────┐
│ drone-sim(机队推进/改派/起飞/召回) disaster(灾情/调配规划) situation(态势/空投)│
│ emergency-data(应急资源) dispatch-board(调度面板行) video(图传模拟)          │
│ 纯函数、零依赖、vitest 全测；前端经 vite alias 引入，后端经相对路径引入     │
└──────────────────────────────────────────────────────────────────────────┘
```

## 2. 核心设计决策

| 决策 | 内容 | 理由 |
|---|---|---|
| 权威模拟器在后端 | 机队/灾情状态由后端单例推进，前端纯订阅 | 多开大屏状态逐位一致；刷新/新客户端不丢状态 |
| 引擎代码共享 | shared/sim 单一事实源 | 前端 mock 兜底与后端权威模拟行为完全一致 |
| SQLite 单文件 | backend/data/app.db 随仓库提交 | clone 即用，零 Docker 零建库 |
| REST + WS 双通道 | 状态快照走 WS 推，控制动作走 REST POST | 订阅实时性 + 动作可靠性 |
| mock 永不断粮 | 前端每个 API 失败后自动回退本地 mock | 后端挂了演示界面仍可操作（灾情除外） |

## 3. 数据流

### 3.1 机队快照（每秒）
```
FleetService.tick() → advanceFleet(shared/sim) → EventsGateway.emit("fleet")
→ 前端 useDrones → 地图 marker / 左下角统计 / onFleetTick 钩子(事件流转侦测)
```

### 3.2 灾情闭环（权威状态机）
```
POST /api/disaster/simulate
→ DisasterService：生成灾点 → planFloodDispatch(调配) → 改派勘测 + 方舱起飞投送
→ disaster_events 建档入库 → 事件流/节点广播
每 tick：勘测到场判定 → assessSituation(现场观测) → detectSupplyDrops(空投检测)
→ 空投即扣来源仓库存(warehouses 表) + 广播 warehouses → 仓储面板实时刷新
→ summarizeSituation/evaluateReinforcement → 需要时「执行增援」
POST /api/disaster/resolve → recallMissionDrones 全部返航 → 档案 resolvedAt
```

### 3.3 事件与节点
```
EventLogService.pushFeed/pushNode → 写 event_feed/node_records 表（fire-and-forget）
→ 内存环形缓冲(50/30) → WS 广播 → 前端事件流/节点面板
新客户端连入 → 补发 fleet/disaster 快照 + history 历史
```

### 3.4 配置链
```
system_config 表(amap.key) → GET /api/config/public（只放行 isSecret=false）
→ src/api/config.ts loadPublicConfig()（带缓存）→ CenterMap 初始化高德
兜底：.env.local（后端离线时的降级来源）
```

## 4. 数据库表（SQLite，Prisma schema）

| 表 | 用途 | 写入方 |
|---|---|---|
| system_config | 配置中心（高德 Key 等，isSecret 控制公开性） | seed / 管理接口(预留) |
| users / login_attempts | 管理员账号 / 登录尝试（滑动窗口锁定依据） | auth |
| flight_records | 飞行记录（接口2 数据源） | seed / 业务(预留) |
| warehouses | 仓储台账（含坐标、实时库存；空投扣减） | seed + DisasterService |
| shelters / flyers | 方舱 / 飞手台账 | seed |
| stat_feeds | 统计聚合快照（接口1/3/4/5，JSON payload） | seed / 业务(预留) |
| event_feed / node_records | 事件流 / 处置节点 | EventLogService |
| disaster_events | 灾情档案（等级/位置/起止时间） | DisasterService |

## 5. 接口清单

### REST（全局前缀 /api）
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | /auth/login | 登录（失败计数/锁定，返回 JWT 12h） |
| GET | /config/public | 公开配置（高德 Key） |
| GET | /open/total-data-by-dept | 接口1 飞行总览 |
| GET | /open/associated-fly-record?pageNum&pageSize | 接口2 飞行记录分页 |
| GET | /open/work-order-overview | 接口3 工单统计 |
| GET | /open/task-overview?period=today/week/month/year/total | 接口4 任务统计 |
| GET | /open/new-total-data-by-day | 接口5 飞行统计 |
| GET | /warehouses 、 /shelters 、 /flyers | 台账 |
| POST | /disaster/simulate 、 /reinforce 、 /resolve | 灾情控制 |
| GET | /disaster/state 、 /events/recent | 快照/历史兜底 |

### WebSocket（/socket.io）
| 事件 | 方向 | 频率 | 内容 |
|---|---|---|---|
| fleet | S→C | 每秒 | 全量机队快照 FleetState |
| disaster | S→C | 变更时 | 灾情状态快照（flood/plan/situation/summary/eval/reinforced） |
| feed / node | S→C | 产生时 | 单条事件/节点 |
| warehouses | S→C | 空投时 | 最新仓储台账（含 percent） |
| history | S→C | 连入时 | 最近 50 事件 + 30 节点 |

## 6. 目录结构

```
├── src/                    # 前端（Vue3）
│   ├── api/                # REST 接入（mock 回退）+ config + socket 单例
│   ├── composables/        # useDrones/useDisaster/useEventLog（订阅态）
│   ├── stores/             # auth(JWT) / login-guard(强密码)
│   └── views/screen/       # 大屏组件（CenterMap/LeftPanel/RightPanel/…）
├── shared/sim/             # 前后端共享模拟引擎（纯函数 + 测试）
├── backend/
│   ├── src/                # auth / config / open / ledger / sim-host
│   ├── prisma/             # schema + migrations + seed
│   └── data/app.db         # SQLite 数据库（随仓库提交）
├── scripts/                # Playwright 验收脚本（SCREEN_URL 可覆盖）
├── docs/                   # 本文档 / design / backend-plan / bom / technical
└── shots/                  # 验收截图
```
