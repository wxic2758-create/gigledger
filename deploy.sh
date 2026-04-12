#!/bin/bash

# 设置环境变量
export CLOUDFLARE_API_TOKEN="cfut_fRQNsK6VXMv3bR6k9CLJeQwkeCjmqQPpz0bLo5Ye32575054"

echo "正在部署到 Cloudflare Pages..."

# 检查构建文件
if [ ! -d "dist" ]; then
    echo "构建文件不存在，正在构建..."
    npm run build
fi

# 部署
echo "开始部署..."
npx wrangler pages deploy dist

echo "部署完成！"
