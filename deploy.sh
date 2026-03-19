#!/bin/bash
# 霞客部署脚本
# 流程：本地 git pull → scp 推文件到腾讯云 → 重启服务

set -e

REMOTE="ubuntu@43.143.237.15"
SSH_KEY="$HOME/.ssh/id_ed25519"
LOCAL="$(cd "$(dirname "$0")" && pwd)"

echo "📦 拉取最新代码..."
git -C "$LOCAL" pull origin main

echo "🔍 检查服务器 .env 配置..."
MISSING_KEYS=""
ssh -i "$SSH_KEY" $REMOTE "grep -q 'GAODE_API_KEY=' ~/weather-sunset-predictor/server/.env && grep 'GAODE_API_KEY=' ~/weather-sunset-predictor/server/.env | grep -qv 'your_gaode'" || MISSING_KEYS="GAODE_API_KEY"

if [ -n "$MISSING_KEYS" ]; then
  echo "⚠️  警告：服务器 .env 缺少以下 key：$MISSING_KEYS"
  echo "    地理搜索将无法正常工作，请部署后手动补充："
  echo "    ssh -i $SSH_KEY $REMOTE 'echo GAODE_API_KEY=<your_key> >> ~/weather-sunset-predictor/server/.env'"
  echo ""
fi

# 补充 .env 中新增的 key（不覆盖已有值）
echo "📝 同步 .env 新增配置项（不覆盖已有值）..."
ssh -i "$SSH_KEY" $REMOTE "
  ENV_FILE=~/weather-sunset-predictor/server/.env
  EXAMPLE_FILE=~/weather-sunset-predictor/server/.env.example
  if [ -f \"\$EXAMPLE_FILE\" ]; then
    while IFS= read -r line; do
      # 跳过注释和空行
      [[ \"\$line\" =~ ^# ]] && continue
      [[ -z \"\$line\" ]] && continue
      KEY=\$(echo \"\$line\" | cut -d= -f1)
      # 只有 .env 里没有这个 key 时才追加
      if ! grep -q \"^\$KEY=\" \"\$ENV_FILE\" 2>/dev/null; then
        echo \"\$line\" >> \"\$ENV_FILE\"
        echo \"  + 追加新 key: \$KEY\"
      fi
    done < \"\$EXAMPLE_FILE\"
  fi
"

echo "🚀 推送文件到服务器..."
scp -i "$SSH_KEY" "$LOCAL/index.html" $REMOTE:~/weather-sunset-predictor/
scp -i "$SSH_KEY" "$LOCAL/server/index.js" $REMOTE:~/weather-sunset-predictor/server/
scp -i "$SSH_KEY" "$LOCAL/server/routes/"*.js $REMOTE:~/weather-sunset-predictor/server/routes/
scp -i "$SSH_KEY" "$LOCAL/server/services/"*.js $REMOTE:~/weather-sunset-predictor/server/services/
# ⚠️ 注意：不推送 server/.env，敏感配置只在服务器上手动维护
scp -i "$SSH_KEY" "$LOCAL/server/.env.example" $REMOTE:~/weather-sunset-predictor/server/
scp -i "$SSH_KEY" "$LOCAL/src/controllers/"*.js $REMOTE:~/weather-sunset-predictor/src/controllers/
scp -i "$SSH_KEY" "$LOCAL/src/services/"*.js $REMOTE:~/weather-sunset-predictor/src/services/
scp -i "$SSH_KEY" "$LOCAL/src/components/"*.js $REMOTE:~/weather-sunset-predictor/src/components/
scp -i "$SSH_KEY" "$LOCAL/styles/"*.css $REMOTE:~/weather-sunset-predictor/styles/ 2>/dev/null || true

echo "🔄 重启后端..."
ssh -i "$SSH_KEY" $REMOTE "
  # 杀掉旧进程（ubuntu 用户权限范围内）
  kill \$(ps aux | grep 'node index' | grep -v grep | awk '{print \$2}') 2>/dev/null || true
  # root 起的进程用 sudo kill
  sudo kill \$(sudo ps aux | grep 'node index' | grep -v grep | awk '{print \$2}') 2>/dev/null || true
  sleep 2
  # 用 root 的 node（v22）启动，sudo 继承环境变量需要 -E
  cd ~/weather-sunset-predictor/server
  sudo bash -c 'cd /home/ubuntu/weather-sunset-predictor/server && nohup node index.js > /tmp/ws-backend.log 2>&1 &'
  sleep 3
  curl -s http://localhost:3000/health
"

echo "✅ 部署完成"
