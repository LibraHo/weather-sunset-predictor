#!/bin/bash
# 霞客部署脚本
# 流程：本地 git pull → scp 推文件到腾讯云 → 重启服务

set -e

REMOTE="ubuntu@43.143.237.15"
SSH_KEY="$HOME/.ssh/id_ed25519"
LOCAL="$(cd "$(dirname "$0")" && pwd)"

echo "📦 拉取最新代码..."
git -C "$LOCAL" pull origin main

echo "🚀 推送文件到服务器..."
scp -i "$SSH_KEY" "$LOCAL/index.html" $REMOTE:~/weather-sunset-predictor/
scp -i "$SSH_KEY" "$LOCAL/server/index.js" $REMOTE:~/weather-sunset-predictor/server/
scp -i "$SSH_KEY" "$LOCAL/server/routes/"*.js $REMOTE:~/weather-sunset-predictor/server/routes/
scp -i "$SSH_KEY" "$LOCAL/server/services/"*.js $REMOTE:~/weather-sunset-predictor/server/services/
scp -i "$SSH_KEY" "$LOCAL/src/controllers/"*.js $REMOTE:~/weather-sunset-predictor/src/controllers/
scp -i "$SSH_KEY" "$LOCAL/src/services/"*.js $REMOTE:~/weather-sunset-predictor/src/services/
scp -i "$SSH_KEY" "$LOCAL/styles/"*.css $REMOTE:~/weather-sunset-predictor/styles/ 2>/dev/null || true

echo "🔄 重启后端..."
ssh -i "$SSH_KEY" $REMOTE "
  kill \$(ps aux | grep 'node index' | grep -v grep | awk '{print \$2}') 2>/dev/null || true
  sleep 1
  cd ~/weather-sunset-predictor/server
  PATH=/usr/local/node-v18/bin:\$PATH nohup node index.js > ~/backend.log 2>&1 &
  sleep 3
  curl -s http://localhost:3000/health
"

echo "✅ 部署完成"
