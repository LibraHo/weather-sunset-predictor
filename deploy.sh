#!/usr/bin/env bash
# 霞客部署脚本 v5.1
# 流程：本地 git pull → rsync 安全同步 → 安全重启 → 健康检查

set -euo pipefail

REMOTE="ubuntu@43.143.237.15"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
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

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      ;;
    --ssh-key)
      if [[ -z "${2-}" ]]; then
        echo "❌ --ssh-key 缺少参数"
        exit 1
      fi
      SSH_KEY="$2"
      shift
      ;;
    *)
      ;;
  esac
  shift
done

if [[ "$DRY_RUN" != "true" ]]; then
  require_cmd rsync
  require_cmd ssh
  require_cmd git
fi

require_non_empty "LOCAL" "$LOCAL"
require_non_empty "REMOTE" "$REMOTE"
require_non_empty "SSH_KEY" "$SSH_KEY"

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
  bash "$LOCAL/scripts/pre-deploy-backup.sh" --ssh-key "$SSH_KEY" || { echo '⚠️ 备份失败，中止部署'; exit 1; }
fi

log "📦 拉取最新代码..."
if [[ "$DRY_RUN" == "true" ]]; then
  log "  [dry-run] 跳过 git pull"
else
  git -C "$LOCAL" pull origin main
fi

log "🚀 同步到服务器（排除运行时文件）..."
RSYNC_EXCLUDES=(
  --exclude='.git/'
  --exclude='node_modules/'
  --exclude='server/node_modules/'
  --exclude='.env'
  --exclude='server/.env'
  --exclude='.xiake/'
  --exclude='__pycache__/'
  --exclude='coverage/'
  --exclude='uploads/'
  --exclude='server/uploads/'
  --exclude='log/'
  --exclude='server/log/'
  --exclude='cache/'
  --exclude='server/cache/'
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
  echo "  rsync -e \"ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no\" --dry-run ${RSYNC_OPTS[*]} \"${LOCAL}/\" \"${REMOTE}:~/weather-sunset-predictor/\""
else
  rsync -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no" \
    "${RSYNC_OPTS[@]}" "$LOCAL/" "$REMOTE:~/weather-sunset-predictor/"
fi

log "🔄 重启服务并健康检查..."
if [[ "$DRY_RUN" == "true" ]]; then
  log "  [dry-run] 跳过重启与线上检查"
else
  ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$REMOTE" <<'RESTART'
set -euo pipefail

DEPLOY_DIR="$HOME/weather-sunset-predictor"
APP_DIR="$DEPLOY_DIR/server"
APP_ENTRY="index.js"
NODE_BIN=""

resolve_node() {
  local candidates=(
    "/usr/local/bin/node"
    "$(command -v node 2>/dev/null || true)"
    "$HOME/.nvm/versions/node/v22.22.0/bin/node"
    "$(ls -dt /root/.nvm/versions/node/*/bin/node 2>/dev/null | head -n 1 || true)"
  )

  local candidate=""
  for candidate in "${candidates[@]}"; do
    if [ -n "$candidate" ] && [ -x "$candidate" ]; then
      NODE_BIN="$candidate"
      return 0
    fi
  done

  echo "❌ 未找到可执行 Node 二进制"
  return 1
}

resolve_node || exit 1

APP_ENV_FILE="$APP_DIR/.env"

resolve_port() {
  local port=""
  if [ -f "$APP_ENV_FILE" ]; then
    port="$(awk -F= '/^PORT=/{gsub(/^[ \t\"\x27]+|[ \t\"\x27]+$/, "", $2); print $2}' "$APP_ENV_FILE" | tail -n 1)"
  fi
  if [ -n "$port" ] && [ "$port" -eq "$port" ] 2>/dev/null; then
    echo "$port"
  else
    echo 3000
  fi
}

stop_pid() {
  local sig="$1"
  local pid="$2"

  if ! kill -0 "$pid" 2>/dev/null; then
    return 0
  fi

  # 先尝试普通 kill
  if kill -s "$sig" "$pid" 2>/dev/null; then
    return 0
  fi

  # 若失败（如 root 进程），尝试 sudo
  if sudo kill -s "$sig" "$pid" 2>/dev/null; then
    return 0
  fi

  return 1
}

if [ -z "$DEPLOY_DIR" ] || [ -z "$APP_DIR" ] || [ -z "$APP_ENTRY" ]; then
  echo "❌ 重启变量不能为空"
  exit 1
fi

APP_PORT="$(resolve_port)"

get_pids() {
  local target_pids=""
  local lines

  for pat in \
    "/usr/local/bin/node .*${APP_ENTRY}$" \
    "$NODE_BIN .*${APP_ENTRY}$" \
    "node .*${APP_DIR}/${APP_ENTRY}$" \
    "node .*weather-sunset-predictor/server/${APP_ENTRY}$"; do
    lines="$(pgrep -f "$pat" || true)"
    if [ -n "$lines" ]; then
      target_pids="$target_pids
$lines"
    fi
  done

  printf "%s\n" "$target_pids" | tr ' ' '\n' | awk 'NF{print $1}' | sort -n | uniq
}

echo "  → 查找旧 index.js 进程并安全停止..."
PIDS="$(get_pids)"

if [ -n "$PIDS" ]; then
  echo "  → 已匹配到进程：$(echo "$PIDS" | tr '\n' ' ')"
  while IFS= read -r pid; do
    [ -z "$pid" ] && continue
    stop_pid TERM "$pid" || true
  done <<< "$PIDS"

  sleep 2
  REMAIN="$(get_pids)"
  if [ -n "$REMAIN" ]; then
    echo "  → 强制杀死残留进程..."
    while IFS= read -r pid; do
      [ -z "$pid" ] && continue
      stop_pid KILL "$pid" || true
    done <<< "$REMAIN"
  fi
else
  echo "  → 未检测到旧 index.js 进程"
fi

cd "$APP_DIR"
nohup sudo "$NODE_BIN" "$APP_DIR/$APP_ENTRY" >> /home/ubuntu/ws-backend.log 2>&1 &
sleep 5

echo "  → 验证进程存活..."
if ! pgrep -af "$NODE_BIN .*${APP_ENTRY}" >/dev/null; then
  echo "❌ 启动失败：未检测到 $NODE_BIN 进程"
  exit 1
fi

echo "  → 健康检查 localhost:${APP_PORT}/health ..."
if curl -fsS --max-time 5 "http://127.0.0.1:${APP_PORT}/health" >/dev/null; then
  echo "✅ 本地健康检查通过"
else
  echo "⚠️ 健康检查失败，尝试端口检查..."
  if ss -ltnp 2>/dev/null | grep -q ":${APP_PORT}"; then
    echo "✅ 端口 ${APP_PORT} 已监听"
  else
    echo "❌ 端口 ${APP_PORT} 未监听"
    exit 1
  fi
fi
RESTART

  log "🌐 外部站点健康检查..."
  HTTP=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$REMOTE" "curl -s -o /dev/null -w '%{http_code}' https://sunset.bjhyc.online")
  if [[ "$HTTP" != "200" ]]; then
    echo "⚠️ 外部域名返回 $HTTP"
    exit 1
  fi

  log "  ✅ 健康检查通过（$HTTP）"
fi

log "✅ 部署完成"
