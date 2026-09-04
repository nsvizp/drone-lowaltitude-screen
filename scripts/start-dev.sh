#!/bin/bash
# 开发环境一键启动（独立于终端/会话存活，关终端不掉线）
# 用法：./scripts/start-dev.sh
cd "$(dirname "$0")/.."

# 后端（nohup 脱离会话，日志 backend/dev-server.log）
if ! curl -s -o /dev/null --max-time 3 http://127.0.0.1:3000/api/config/public; then
  echo "[start] backend :3000"
  (cd backend && nohup node --require ts-node/register/transpile-only src/main.ts > dev-server.log 2>&1 &)
else
  echo "[skip] backend already running"
fi

# 前端（nohup，日志 dev-server.log）
if ! curl -s -o /dev/null --max-time 3 http://127.0.0.1:5173/; then
  echo "[start] frontend :5173"
  nohup pnpm dev > dev-server.log 2>&1 &
else
  echo "[skip] frontend already running"
fi

sleep 8
curl -s -o /dev/null --max-time 3 http://127.0.0.1:3000/api/config/public && echo "[ok] backend  :3000" || echo "[fail] backend"
curl -s -o /dev/null --max-time 3 http://127.0.0.1:5173/ && echo "[ok] frontend :5173" || echo "[fail] frontend"
