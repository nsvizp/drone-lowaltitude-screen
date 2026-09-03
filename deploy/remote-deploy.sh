#!/usr/bin/env bash
# 无人机大屏 · 服务器端一键部署（CentOS 7 / Nginx）
# 用法：bash remote-deploy.sh [端口]   默认端口 8090
set -euo pipefail

PORT="${1:-8090}"
APP_ROOT="/usr/local/sh/drone-screen"
PKG_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> 1/4 部署静态文件到 $APP_ROOT"
mkdir -p "$APP_ROOT"
rm -rf "$APP_ROOT/dist"
cp -r "$PKG_DIR/dist" "$APP_ROOT/dist"

echo "==> 2/4 检查 Nginx"
if ! command -v nginx >/dev/null 2>&1; then
  echo "    nginx 未安装，尝试 yum 安装…"
  yum install -y nginx
fi

echo "==> 3/4 写入站点配置 /etc/nginx/conf.d/drone-screen.conf（端口 $PORT）"
cat > /etc/nginx/conf.d/drone-screen.conf <<EOF
server {
    listen $PORT;
    server_name _;
    root $APP_ROOT/dist;
    index index.html;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|svg|woff2?)$ {
        expires 7d;
        add_header Cache-Control "public";
    }
}
EOF

echo "==> 4/4 校验配置并启动/重载 Nginx"
nginx -t
if systemctl is-active --quiet nginx; then
  systemctl reload nginx
else
  systemctl enable --now nginx
fi

# 防火墙放行（firewalld 存在且运行时）
if command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --state >/dev/null 2>&1; then
  firewall-cmd --permanent --add-port="$PORT/tcp" >/dev/null
  firewall-cmd --reload >/dev/null
  echo "    firewalld 已放行 $PORT/tcp"
fi

echo ""
echo "✅ 部署完成：http://$(hostname -I | awk '{print $1}'):$PORT"
echo "   （若浏览器打不开，请检查云安全组/防火墙是否放行 $PORT 端口）"
