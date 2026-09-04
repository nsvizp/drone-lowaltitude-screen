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

### 防掉线：脱离终端的一键启动

```bash
./scripts/start-dev.sh   # nohup 双端拉起，关终端/会话不掉线；已运行则自动跳过
```

> 说明：AI 会话启动的后台任务会随会话结束被清理（表现为"后端老离线"），
> nohup 方式父进程挂到 init，彻底独立。该模式后端无 --watch 热重载，
> 改后端代码后需重启：kill 掉进程再跑一次脚本即可。
> 日志：backend/dev-server.log（后端）、dev-server.log（前端，根目录）。

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