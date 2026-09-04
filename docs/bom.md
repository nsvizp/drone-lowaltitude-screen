# 物料清单（BOM）— 前后端依赖

> 版本基线：commit bdee413 ｜ 包管理器：pnpm（后端需 --ignore-workspace）

## 1. 前端（根 package.json）

### 运行依赖
| 包 | 版本 | 用途 |
|---|---|---|
| vue | ^3.5.13 | 框架核心（Composition API） |
| vue-router | ^4.5.0 | 路由（hash 模式：登录页/大屏） |
| pinia | ^3.0.3 | 状态管理（auth store） |
| @amap/amap-jsapi-loader | ^1.0.1 | 高德地图 JS API 动态加载 |
| socket.io-client | ^4.8.3 | WebSocket 订阅后端权威状态 |

### 开发依赖
| 包 | 版本 | 用途 |
|---|---|---|
| vite | ^6.0.7 | 构建/开发服务器（含 /api 与 /socket.io 代理） |
| @vitejs/plugin-vue | ^5.2.1 | Vue SFC 支持 |
| typescript / vue-tsc | ^5.7.3 / ^2.2.0 | 类型系统与构建期检查 |
| sass | ^1.83.4 | 样式预处理 |
| vitest | ^2.1.8 | 单元测试（含 shared/sim 引擎测试，共 108 项） |
| playwright | ^1.62.1 | 端到端验收（scripts/*.mjs，SCREEN_URL 可覆盖） |
| @types/node | ^26.4.1 | Node 类型 |

### 已移除
| 包 | 原因 |
|---|---|
| echarts | 需求变更（排名图下线），减少 ~1MB 产物 |

## 2. 后端（backend/package.json）

### 运行依赖
| 包 | 版本 | 用途 |
|---|---|---|
| @nestjs/common / core | ^10.4.15 | NestJS 框架（DI/模块/装饰器） |
| @nestjs/platform-express | ^10.4.15 | HTTP 适配层 |
| @nestjs/websockets + platform-socket.io | ^10.4.22 | WebSocket 网关（**必须钉 10.x**，12.x 与 core 10 不兼容） |
| socket.io | ^4.8.3 | WS 服务端 |
| @nestjs/jwt | ^10.2.0 | JWT 签发（登录令牌 12h） |
| bcryptjs | ^2.4.3 | 密码哈希（纯 JS，免原生编译） |
| @prisma/client | ^6.2.1 | ORM 客户端（postinstall 自动生成） |
| reflect-metadata / rxjs | — | NestJS DI 基石 |

### 开发依赖
| 包 | 版本 | 用途 |
|---|---|---|
| prisma | ^6.2.1 | schema 迁移（migrate dev） |
| ts-node | ^10.9.2 | dev 运行器（transpile-only + --watch 热重载；**不能用 tsx/esbuild**——不发射装饰器元数据会导致 DI 崩溃） |
| typescript | ^5.7.2 | 类型系统 |
| vitest | ^2.1.8 | 后端单元测试（login-lock / scale-task，8 项） |
| @types/* | — | bcryptjs / express / node / socket.io 类型 |

## 3. 共享引擎（shared/sim，无第三方依赖）

| 模块 | 内容 | 测试 |
|---|---|---|
| drone-sim.ts | 机队推进/巡逻/改派/起飞/返航/召回/归舱换电 | drone-sim / lifecycle / resume-patrol / recall |
| disaster.ts | 灾点生成/方舱选择/调配规划（勘测+投送） | disaster.test.ts |
| situation.ts | 现场态势评估/空投检测/增援评估 | situation.test.ts |
| emergency-data.ts | 应急资源模拟数据（人员/车辆；物资已改台账） | emergency-data.test.ts |
| dispatch-board.ts | 调度/仓储面板行构建 | dispatch-board.test.ts |
| video.ts | 模拟图传画面合成 | video.test.ts |

## 4. 运行时环境要求

| 项 | 要求 |
|---|---|
| Node.js | ≥ 18（开发机验证版本 v26） |
| pnpm | ≥ 9（后端安装需 --ignore-workspace，根目录存在 pnpm-workspace.yaml） |
| 浏览器 | 支持 WebSocket 的现代浏览器（大屏建议 1920×1080） |
| 高德 Key | Web端(JS API) 类型，存 system_config 表或 .env.local |
