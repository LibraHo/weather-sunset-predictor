#!/bin/bash
# 霞客部署脚本：本地拉代码 → rsync 推服务器 → 重启服务

set -e

REMOTE="ubuntu@43.143.237.15"
SSH_KEY="$HOME/.ssh/id_ed25519"
REMOTE_DIR="~/weather-sunset-predictor"
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "📦 拉取最新代码..."
git pull origin main

echo "🚀 同步到服务器..."
rsync -avz --delete \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.env' \
  --exclude='*.log' \
  -e "ssh -i $SSH_KEY" \
  "$LOCAL_DIR/" "$REMOTE:$REMOTE_DIR/"

echo "🔄 重启后端服务..."
ssh -i "$SSH_KEY" "$REMOTE" "
  kill \$(ps aux | grep 'node index' | grep -v grep | awk '{print \$2}') 2>/dev/null || true
  sleep 1
  cd $REMOTE_DIR/server
  PATH=/usr/local/node-v18/bin:\$PATH npm install --silent
  nohup /usr/local/node-v18/bin/node index.js > ~/backend.log 2>&1 &
  sleep 2
  curl -s http://localhost:3000/health
"

echo "✅ 部署完成"
