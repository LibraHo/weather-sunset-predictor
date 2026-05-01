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

log "🚀 同步到服务器（优先 rsync；缺失时 tar/scp fallback）..."
if [[ "$DRY_RUN" == "true" ]]; then
  log "  [dry-run] 跳过远端运行时目录权限修复"
else
  log "  → 修复远端运行时目录权限（避免 root-owned node_modules 阻塞同步）..."
  ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$REMOTE" <<'PREP_REMOTE'
set -euo pipefail
DEPLOY_DIR="$HOME/weather-sunset-predictor"
[ -n "$DEPLOY_DIR" ] || { echo "ERROR: DEPLOY_DIR empty"; exit 1; }
if [ -d "$DEPLOY_DIR" ]; then
  sudo chown -R "$USER:$USER" "$DEPLOY_DIR/server/node_modules" 2>/dev/null || true
  sudo chown "$USER:$USER" "$DEPLOY_DIR" "$DEPLOY_DIR/server" 2>/dev/null || true
fi
PREP_REMOTE
fi
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

sync_with_rsync() {
  rsync -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no" \
    "${RSYNC_OPTS[@]}" "$LOCAL/" "$REMOTE:~/weather-sunset-predictor/"
}

sync_with_tar_fallback() {
  local archive manifest remote_archive remote_manifest
  archive="/tmp/weather-sunset-deploy.tar.gz"
  manifest="/tmp/weather-sunset-deploy.manifest"
  remote_archive="/tmp/weather-sunset-deploy.tar.gz"
  remote_manifest="/tmp/weather-sunset-deploy.manifest"

  git -C "$LOCAL" archive --format=tar.gz --output="$archive" HEAD
  git -C "$LOCAL" ls-files | sort > "$manifest"

  scp -i "$SSH_KEY" -o StrictHostKeyChecking=no "$archive" "$manifest" "$REMOTE:/tmp/"
  ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$REMOTE" <<'TAR_SYNC'
set -euo pipefail
DEPLOY_DIR="$HOME/weather-sunset-predictor"
REMOTE_ARCHIVE="/tmp/weather-sunset-deploy.tar.gz"
REMOTE_MANIFEST="/tmp/weather-sunset-deploy.manifest"
OLD_MANIFEST="$DEPLOY_DIR/.deploy-manifest"
[ -n "$DEPLOY_DIR" ] || { echo "ERROR: DEPLOY_DIR empty"; exit 1; }
mkdir -p "$DEPLOY_DIR"

# Delete files that existed in the previous fallback manifest but no longer exist in the new one.
# Protected runtime paths are never removed here.
if [ -f "$OLD_MANIFEST" ]; then
  comm -23 "$OLD_MANIFEST" "$REMOTE_MANIFEST" | while IFS= read -r rel; do
    case "$rel" in
      ""|/*|*".."*|.env|server/.env|node_modules/*|server/node_modules/*|.xiake/*|uploads/*|server/uploads/*|log/*|server/log/*|cache/*|server/cache/*)
        continue
        ;;
    esac
    if [ -f "$DEPLOY_DIR/$rel" ]; then
      rm -f "$DEPLOY_DIR/$rel"
    fi
  done
fi

tar -xzf "$REMOTE_ARCHIVE" -C "$DEPLOY_DIR"
cp "$REMOTE_MANIFEST" "$OLD_MANIFEST"
TAR_SYNC
}

if [[ "$DRY_RUN" == "true" ]]; then
  log "  [dry-run] 传输预览："
  echo "  rsync -e \"ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no\" --dry-run ${RSYNC_OPTS[*]} \"${LOCAL}/\" \"${REMOTE}:~/weather-sunset-predictor/\""
  echo "  [fallback if rsync missing] git archive HEAD -> scp tar + manifest -> remote extract"
else
  if command -v rsync >/dev/null; then
    sync_with_rsync
  else
    require_cmd scp
    require_cmd tar
    log "  ⚠️ 本地缺少 rsync，自动改用 tar/scp fallback"
    sync_with_tar_fallback
  fi
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

node_major_version() {
  local node_bin="$1"
  sudo "$node_bin" -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || true
}

resolve_node() {
  local candidates=(
    "/usr/local/bin/node"
    "$HOME/.nvm/versions/node/v22.22.0/bin/node"
    "$(ls -dt /root/.nvm/versions/node/*/bin/node 2>/dev/null | head -n 1 || true)"
    "$(command -v node 2>/dev/null || true)"
  )

  local candidate="" major=""
  for candidate in "${candidates[@]}"; do
    [ -n "$candidate" ] || continue

    # /usr/local/bin/node points into /root/.nvm on this server; ubuntu cannot execute it
    # directly, but sudo can. Check with sudo because deployment starts node with sudo.
    if sudo test -x "$candidate" 2>/dev/null; then
      major="$(node_major_version "$candidate")"
      if [ -n "$major" ] && [ "$major" -ge 18 ] 2>/dev/null; then
        NODE_BIN="$candidate"
        echo "  → 使用 Node: $NODE_BIN (major=$major)"
        return 0
      fi
      echo "  → 跳过 Node: $candidate (major=${major:-unknown}, 需要 >=18)"
    fi
  done

  echo "❌ 未找到可执行且版本 >=18 的 Node 二进制"
  return 1
}

resolve_node || exit 1

APP_ENV_FILE="$APP_DIR/.env"

resolve_port() {
  local port=""
  if [ -f "$APP_ENV_FILE" ]; then
    port="$(awk -F= '/^PORT=/{print $2}' "$APP_ENV_FILE" | tail -n 1 | tr -d "[:space:]\"'")"
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
if [ ! -d "$APP_DIR/node_modules/express" ]; then
  echo "  → 依赖缺失，安装生产依赖..."
  NPM_BIN="$(dirname "$NODE_BIN")/npm"
  if ! sudo test -x "$NPM_BIN" 2>/dev/null; then
    NPM_BIN="$(command -v npm 2>/dev/null || true)"
  fi
  if [ -z "$NPM_BIN" ]; then
    echo "❌ 未找到 npm，无法安装后端依赖"
    exit 1
  fi
  sudo "$NPM_BIN" install --omit=dev
  sudo chown -R "$USER:$USER" "$APP_DIR/node_modules" 2>/dev/null || true
fi
nohup sudo "$NODE_BIN" "$APP_DIR/$APP_ENTRY" >> /home/ubuntu/ws-backend.log 2>&1 &
sleep 5

echo "  → 验证进程存活..."
if ! pgrep -af "${NODE_BIN} .*${APP_ENTRY}|node .*weather-sunset-predictor/server/${APP_ENTRY}" >/dev/null; then
  echo "❌ 启动失败：未检测到目标 Node 进程"
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
