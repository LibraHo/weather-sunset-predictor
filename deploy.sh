#!/usr/bin/env bash
# 霞客部署脚本 v4
# 流程：本地 git pull → rsync 同步 → 重启服务 → 健康检查

set -euo pipefail

REMOTE="ubuntu@43.143.237.15"
SSH_KEY="$HOME/.ssh/id_ed25519"
LOCAL="$(cd "$(dirname "$0")" && pwd)"
DRY_RUN=false

log() {
  echo "[$(date '+%F %T')] $*"
}

require_cmd() {
  command -v "$1" >/dev/null || { echo "❌ 缺少依赖: $1"; exit 1; }
}

require_non_empty() {
  local name="$1" value="$2"
  if [[ -z "$value" ]]; then
    echo "❌ 变量为空: $name"
    exit 1
  fi
}

for arg in "$@"; do
  if [[ "$arg" == "--dry-run" ]]; then
    DRY_RUN=true
  fi
done

if [[ "$DRY_RUN" != "true" ]]; then
  require_cmd rsync
  require_cmd ssh
fi

require_non_empty "LOCAL" "$LOCAL"
require_non_empty "REMOTE" "$REMOTE"

if [[ "$DRY_RUN" == "true" ]]; then
  log "🔎 进入 dry-run 模式（不执行远端写操作，仅预览）"
fi

log "🧩 部署前自检..."
[[ -d "$LOCAL/server" ]] || { echo "❌ 未找到 server 目录"; exit 1; }
[[ -f "$LOCAL/server/index.js" ]] || { echo "❌ 未找到 server/index.js"; exit 1; }
log "  ✅ 本地路径: $LOCAL"

log "📦 部署前备份服务器配置..."
if [[ "$DRY_RUN" == "true" ]]; then
  log "  [dry-run] 跳过备份（仅演练）"
else
  bash "$(dirname "$0")/scripts/pre-deploy-backup.sh" || { echo '⚠️ 备份失败，中止部署'; exit 1; }
fi

log "📦 拉取最新代码..."
if [[ "$DRY_RUN" == "true" ]]; then
  log "  [dry-run] 跳过 git pull"
else
  git -C "$LOCAL" pull origin main
fi

log "🚀 同步到服务器（排除 node_modules/.env/.xiake）..."
RSYNC_EXCLUDES=(
  --exclude='.git/'
  --exclude='node_modules/'
  --exclude='server/node_modules/'
  --exclude='.env'
  --exclude='server/.env'
  --exclude='.xiake/'
  --exclude='__pycache__/'
)
RSYNC_OPTS=(
  -az
  --progress
  --delete
  --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r
  "${RSYNC_EXCLUDES[@]}"
)

if [[ "$DRY_RUN" == "true" ]]; then
  log "  [dry-run] 传输预览："
  echo "  rsync -e \"ssh -i $SSH_KEY -o StrictHostKeyChecking=no\" ${RSYNC_OPTS[*]} --dry-run \"$LOCAL/\" \"$REMOTE:~/weather-sunset-predictor/\""
else
  rsync -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no" \
    "${RSYNC_OPTS[@]}" "$LOCAL/" "$REMOTE:~/weather-sunset-predictor/"
fi

log "🔄 重启服务并健康检查..."
if [[ "$DRY_RUN" == "true" ]]; then
  log "  [dry-run] 跳过重启与线上检查"
else
  ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$REMOTE" '
set -euo pipefail
DEPLOY_DIR="$HOME/weather-sunset-predictor"

if [ -z "$DEPLOY_DIR" ]; then
  echo "错误: DEPLOY_DIR 不能为空"
  exit 1
fi

systemctl restart sunset-backend 2>/dev/null || {
  pkill -f "weather-sunset-predictor/server/index.js" 2>/dev/null || true
  sleep 2
  cd "$DEPLOY_DIR/server"
  nohup /usr/local/bin/node index.js >> /tmp/ws-backend.log 2>&1 &
}

sleep 6
HTTP_CODE="$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/health)"
if [ "$HTTP_CODE" != "200" ]; then
  echo "⚠️ 本地健康检查返回 $HTTP_CODE"
  exit 1
fi
' 

  log "🌐 外部站点健康检查..."
  HTTP=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$REMOTE" "curl -s -o /dev/null -w '%{http_code}' https://sunset.bjhyc.online")
  if [ "$HTTP" != "200" ]; then
    echo "⚠️ 外部域名返回 $HTTP"
    exit 1
  fi

  log "  ✅ 健康检查通过（$HTTP）"
fi

log "✅ 部署完成"