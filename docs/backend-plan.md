# 应急指挥调度平台 — 后端建设方案（待评审）

> 状态：**待你决策，未实施**。本方案回答三件事：后端怎么建、硬编码密钥/配置怎么入库、前端怎么切换。

## 1. 现状盘点：需要后端化的东西

| 现状（前端） | 位置 | 后端化后 |
|---|---|---|
| 高德 JS API Key 硬编码在 .env.local | .env.local | system_config 表，前端启动时拉取 |
| 6 个统计接口全部 mock（120ms 假延迟） | src/api/index.ts | 真实 REST 接口 |
| 机队模拟器跑在浏览器（内存态，刷新即丢） | src/composables/useDrones.ts | 后端模拟器/真实遥测，WebSocket 推送 |
| 灾情子系统状态在浏览器内存 | useDisaster.ts | disaster_events 表持久化 |
| 事件流/节点记录刷新即丢 | event-log.ts | event_feed / node_records 表 |
| 登录是前端写死单账号 + 前端锁定 | stores/auth.ts, login-guard.ts | users + login_attempts 表，服务端认证与锁定 |
| 仓储台账写死 12 条 | sim/dispatch-board.ts | warehouses + warehouse_stock 表 |
| 方舱/飞手名册写死 | useDisaster.ts | shelters / flyers 表 |

## 2. 技术选型（二选一，需你拍板）

| 维度 | 方案 A：NestJS + PostgreSQL + Prisma（**推荐**） | 方案 B：Spring Boot + MySQL |
|---|---|---|
| 语言 | TypeScript（与前端同栈，模拟器代码可直接复用） | Java |
| 契合度 | 高：drone-sim/disaster/situation 三个纯 TS 引擎可**原样搬进后端** | 接口文档是 Spring 风格（RespVO），若需对接既有 Java 体系选它 |
| 开发速度 | 快（M1 约 1~1.5 天） | 中等 |
| WebSocket 推送机队 | socket.io 直接集成 | Spring WebSocket |
| 风险 | 低 | 需把模拟引擎重写为 Java |

**推荐理由**：本项目核心资产是前端大屏 + 模拟引擎，引擎已是纯 TS 且有 104 个测试，搬到 NestJS 零翻译成本。

## 3. 配置与密钥入库（去硬编码核心设计）

### 3.1 system_config 表

| 字段 | 类型 | 说明 |
|---|---|---|
| key | varchar(64) PK | 如 amap.key、amap.securityCode、sim.tickMs |
| value | text | 值（敏感项存密文） |
| is_secret | boolean | 是否加密存储 |
| description | varchar | 用途说明 |
| updated_at / updated_by | - | 审计 |

### 3.2 关键认知：高德 Key 的「保密」边界

高德 **JS API Key 本质上是公开的**——它必须发到浏览器才能加载地图，打开 DevTools 就能看到。所以：

- **入库的价值**不是保密，而是：① 不进 git 仓库；② 可在线轮换不发版；③ 多环境（开发/演示/生产）隔离
- **真正的防盗刷手段**在高德后台：绑定**域名白名单**（仅允许你的部署域名调用）+ 配额告警——需要你在高德控制台手工配置
- securityJsCode（安全密钥）同理入 system_config
- 前端启动流程：GET /api/config/public 拿 amap.key → 动态加载高德 SDK；该接口只放行 is_secret=false 的项

### 3.3 真密钥（不对前端暴露的）存法

- 数据库连接串、JWT 签名密钥：走**环境变量**，不入库
- system_config 中 is_secret=true 的项：AES-256-GCM 加密后存 value，主密钥来自环境变量 MASTER_KEY

## 4. 数据库 Schema 草表（PostgreSQL）

| 表 | 关键字段 | 说明 |
|---|---|---|
| users | id, username, password_hash(bcrypt), display_name, role | role: admin/commander/viewer |
| login_attempts | id, username, success, ip, created_at | 服务端锁定：5 分钟滑窗内失败满 5 次锁定 |
| system_config | 见 §3 | 配置中心 |
| drones | id, name, model, home_lng/lat, status | 机队台账 |
| drone_routes | id, name, points(jsonb), drone_id | 报备航线 |
| shelters | id, name, lng, lat, spare_drones | 方舱 |
| flyers | id, name, last_mission_at | 飞手名册 |
| warehouses | id, name, org, lng, lat, capacity | 仓储点 |
| warehouse_stock | id, warehouse_id, item, quantity | 库存明细（替代写死台账） |
| flight_records | id, name, route_id, flyer_id, shelter_id, started_at | 对齐接口2字段 |
| disaster_events | id, severity, lng, lat, created_at, resolved_at | 灾情档案 |
| situation_events | id, disaster_id, seq, kind, text, created_at | 现场观测流 |
| dispatch_records | id, disaster_id, type(survey/delivery), drone_id, shelter_id, packs | 调配记录 |
| event_feed | id, kind, text, created_at | 事件实时动态（面板数据源） |
| node_records | id, disaster_id, title, detail, created_at | 节点记录 |

## 5. API 设计（REST + WebSocket）

**对齐接口字段说明的 6 个统计接口**（路径保持 mock 里的名字，前端 api 层零改动）。

**新增**：

| 接口 | 说明 |
|---|---|
| POST /api/auth/login | bcrypt 校验 + 服务端失败锁定（返回 remainSec） |
| GET /api/config/public | 公开配置（高德 key 等） |
| GET/PUT /api/config | 管理端配置读写（admin） |
| GET /api/warehouses、/api/shelters、/api/flyers | 台账 |
| WS /ws/fleet | 每秒推机队快照（后端跑 drone-sim） |
| WS /ws/events | 事件流/节点推送 |
| POST /api/disaster/simulate | 触发灾情（替代按钮本地逻辑） |

## 6. 前端改动点（后端就绪后）

1. src/api/index.ts：mock 实现 → fetch 实现，**保留 USE_MOCK 开关**可回退
2. 删除 .env.local，启动时先拉 /api/config/public 再加载地图
3. useDrones 的 setInterval 模拟器 → 订阅 /ws/fleet（模拟引擎代码移入后端包，测试随迁）
4. login-guard 的前端锁定 → 改为信任服务端返回（前端只做倒计时展示）
5. event-log 本地缓冲 → 改为 WS 推送 + 入库

## 7. 分阶段计划（建议）

| 里程碑 | 内容 | 预估 |
|---|---|---|
| M1 骨架+配置+认证 | NestJS 工程、PostgreSQL、system_config、登录/锁定服务端化、前端配置拉取 | 1~1.5 天 |
| M2 业务接口 | 6 个统计接口 + 台账接口（机队/方舱/飞手/仓储） | 1~2 天 |
| M3 实时化 | 模拟引擎迁入后端、WS 推送、事件/节点入库 | 2 天 |
| M4 部署 | docker-compose（postgres+backend）、部署到 10.10.12.185 | 0.5 天 |

## 8. 需要你拍板的决策点

1. **技术栈**：A（NestJS+PG，推荐）还是 B（Spring Boot+MySQL）？
2. **数据库**：本机 Docker 起 PostgreSQL，还是直接用 10.10.12.185 上的？
3. **模拟引擎归宿**：迁入后端做「权威模拟器」（大屏多开状态一致）？还是保持浏览器模拟、后端只管台账统计（工作量减半）？
4. **认证范围**：只要单管理员账号，还是要 RBAC 三角色？
5. **高德域名白名单**：需要你登录高德控制台配置（我无法代劳），配置后 key 泄漏风险基本消除

> 回复「按方案 A 做，决策点 X 选 Y」即可开工；或直接指出要修改的部分。