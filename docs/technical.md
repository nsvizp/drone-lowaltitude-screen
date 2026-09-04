# 技术文档 — 应急指挥调度平台

> 面向接手开发/部署者。架构细节见 architecture.md，依赖清单见 bom.md。

## 1. clone 后启动（完整流程）

```bash
git clone https://github.com/nsvizp/drone-lowaltitude-screen.git
cd drone-lowaltitude-screen

# ── ① 后端（数据库文件已随仓库提交，免建库/免种子/免环境变量）
cd backend
pnpm install --ignore-workspace     # postinstall 会自动 prisma generate
pnpm dev                            # http://127.0.0.1:3000/api

# ── ② 前端（另开终端，回到仓库根目录）
cd ..
pnpm install
pnpm dev                            # http://127.0.0.1:5173
```

打开 http://127.0.0.1:5173 → 登录（**admin / Admin@2026**）→ 进入大屏。
前端通过 vite 代理把 /api 与 /socket.io 转发到 :3000，无需任何额外配置。

### 启动验证清单
| 检查 | 命令/操作 | 预期 |
|---|---|---|
| 后端存活 | curl http://127.0.0.1:3000/api/config/public | 返回 {"amap.key":"..."} |
| 机队在跑 | curl http://127.0.0.1:3000/api/disaster/state | 返回 JSON（flood 可为 null） |
| 前端代理 | 浏览器左上角角标 | 显示「● 后端在线」 |
| 地图加载 | 进入大屏 | 高德地图 + 无人机移动 |

## 2. 常用脚本

### 前端（仓库根目录）
| 命令 | 作用 |
|---|---|
| pnpm dev | 开发服务器 :5173 |
| pnpm build | 类型检查 + 产物构建（dist/） |
| pnpm test | vitest 全量（108 项，含 shared/sim） |
| node scripts/<name>.mjs | Playwright 验收（SCREEN_URL 环境变量可指向任意部署地址） |

### 后端（backend/）
| 命令 | 作用 |
|---|---|
| pnpm dev | ts-node --watch 热重载开发服务器 :3000 |
| pnpm test | vitest 后端单测（8 项） |
| pnpm seed | 重置种子数据（admin/高德 Key/台账/统计快照；不会重置库存） |
| pnpm exec prisma migrate dev | 新增迁移（改 schema 后） |
| pnpm exec prisma studio | 可视化管理数据库 |

## 3. 配置与环境变量

| 配置 | 位置 | 优先级/说明 |
|---|---|---|
| 高德 Key | system_config 表（amap.key） | 最高；经 /api/config/public 下发 |
| 高德 Key 兜底 | 根目录 .env.local（VITE_AMAP_KEY/SECURITY_CODE） | 后端离线时降级使用（不入库） |
| 后端端口 | backend/.env（PORT，默认 3000） | .env 不入库，模板见 .env.example |
| JWT 密钥 | backend/.env（JWT_SECRET） | 生产必须更换 |
| 后端地址覆盖 | 前端 BACKEND_URL 环境变量 | 改 vite 代理目标 |
| 强制 mock | VITE_USE_MOCK=1 | 前端完全离线演示模式 |

## 4. 测试体系

| 层 | 工具 | 规模 | 覆盖 |
|---|---|---|---|
| 共享引擎 | vitest | 含在 108 内 | 机队生命周期/灾情调配/态势/召回等 12 个测试文件 |
| 前端单元 | vitest | 合计 108 | api/composables/stores/引擎 |
| 后端单元 | vitest | 8 | 登录锁定滑窗 / 任务周期缩放 / 分页 |
| 端到端 | Playwright | scripts/ 下 17 个脚本 | 登录/面板/灾情闭环/双屏同步/库存扣减等 |

调试探针（Playwright 脚本用，浏览器控制台也可访问）：
- window.__FLEET：当前机队快照
- window.__DISASTER：灾情响应式状态（flood/plan/situation/summaryRef/evalResult）
- window.__MAP：高德地图实例

## 5. 生产部署（无 Docker）

```bash
# 服务器上（Node ≥ 18 + pnpm）
git clone <repo> && cd drone-lowaltitude-screen

# 后端
cd backend && pnpm install --ignore-workspace
cp .env.example .env              # 生产：更换 JWT_SECRET
pnpm exec prisma migrate deploy   # 应用迁移（db 已随仓库则幂等）
pnpm build && pnpm start          # 或 pm2 start dist/backend/src/main.js --name drone-backend

# 前端
cd .. && pnpm install && pnpm build
# dist/ 交给 nginx；注意把 /api 与 /socket.io（ws）反代到后端 :3000
```

nginx 反代要点：
```nginx
location /api/ { proxy_pass http://127.0.0.1:3000; }
location /socket.io/ {
  proxy_pass http://127.0.0.1:3000;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
}
```

## 6. 踩坑记录（不要再踩）

| 坑 | 现象 | 解法 |
|---|---|---|
| tsx/esbuild 跑 NestJS | Cannot read properties of undefined (DI 全崩) | esbuild 不发射装饰器元数据 → 用 ts-node |
| @nestjs/websockets@12 | ERR_MODULE_NOT_FOUND @nestjs/common/internal | 钉 ^10.4.22 匹配 core 10 |
| shared/sim 被根 type:module 污染 | ERR_REQUIRE_ESM | shared/package.json 声明 commonjs |
| pnpm 嵌套 workspace | backend 下 install 空转 | --ignore-workspace |
| 后端不在时点「模拟洪灾」 | 静默失败像按钮坏了 | 已有在线角标+离线禁用；生产用 pm2 守护 |
| 全量 write 覆盖截断 | 文件缺尾部标签编译报错 | 改已有文件用 edit 工具或先整读 |

## 7. 演示操作手册

1. 登录（admin / Admin@2026）
2. 地图左侧图层：巡航航线/方舱/物资/人员/车辆/医院可开关
3. 点「⚠ 模拟洪灾」→ 灾点红圈 + 勘测机改派 + 方舱起飞投送
4. 观察：调配卡 → 现场态势 → 空投（仓储面板实时扣库存）→ 增援评估
5. 「执行增援」二次调配；「✅ 结束演练」撤机归档，可再次演练
6. 多开浏览器窗口：两块大屏状态逐位一致（权威模拟器在后端）
