#!/bin/bash
# 霞客部署脚本 v2
# 流程：本地 git pull → 打 ZIP → scp 推到服务器 → 服务器解压 → 重启

set -e

REMOTE="ubuntu@43.143.237.15"
SSH_KEY="$HOME/.ssh/id_ed25519"
LOCAL="$(cd "$(dirname "$0")" && pwd)"
ZIP_TMP="/tmp/weather-sunset-deploy.zip"
# 确保服务器有 unzip


echo "📦 部署前备份服务器配置..."
bash "$(dirname "$0")/scripts/pre-deploy-backup.sh" || { echo '⚠️ 备份失败，中止部署'; exit 1; }

echo "📦 拉取最新代码..."
git -C "$LOCAL" pull origin main

echo "🗜️  打包代码..."
cd "$LOCAL"
python3 - <<'PYEOF'
import zipfile, os, sys

ROOT = os.getcwd()
OUTPUT = "/tmp/weather-sunset-deploy.zip"
INCLUDE_DIRS = ["src", "server", "styles", "public"]
INCLUDE_FILES = ["index.html", "server.py"]
EXCLUDES = {"server/.env", "__pycache__", "node_modules", ".git"}

def should_exclude(rel_path):
    parts = rel_path.replace("\\", "/").split("/")
    for part in parts:
        if part in EXCLUDES:
            return True
    if rel_path == "server/.env":
        return True
    return False

with zipfile.ZipFile(OUTPUT, "w", zipfile.ZIP_DEFLATED) as zf:
    for fname in INCLUDE_FILES:
        fpath = os.path.join(ROOT, fname)
        if os.path.exists(fpath):
            zf.write(fpath, fname)
    for d in INCLUDE_DIRS:
        dpath = os.path.join(ROOT, d)
        if not os.path.isdir(dpath):
            continue
        for dirpath, dirnames, filenames in os.walk(dpath):
            dirnames[:] = [dn for dn in dirnames if dn not in EXCLUDES]
            for fn in filenames:
                full = os.path.join(dirpath, fn)
                rel = os.path.relpath(full, ROOT)
                if not should_exclude(rel):
                    zf.write(full, rel)

size = os.path.getsize(OUTPUT)
print(f"  → {size//1024}K 打包完成（{OUTPUT}）")
PYEOF

echo "🚀 推送到服务器..."
scp -i "$SSH_KEY" "$ZIP_TMP" $REMOTE:/tmp/ws-deploy.zip

echo "📂 服务器解压..."
ssh -i "$SSH_KEY" $REMOTE "
  set -e
  DEPLOY_DIR=~/weather-sunset-predictor
  # 备份 .env（不被覆盖）
  [ -f \"\$DEPLOY_DIR/server/.env\" ] && cp \"\$DEPLOY_DIR/server/.env\" /tmp/ws-env-backup

  # 解压（覆盖现有文件）
  unzip -o /tmp/ws-deploy.zip -d \"\$DEPLOY_DIR\" > /dev/null

  # 恢复 .env
  [ -f /tmp/ws-env-backup ] && mv /tmp/ws-env-backup \"\$DEPLOY_DIR/server/.env\"

  # 清理
  rm /tmp/ws-deploy.zip
  echo '  → 解压完成'
"

echo "🔄 重启后端..."
ssh -i "$SSH_KEY" $REMOTE <<'RESTART'
set -e

DEPLOY_DIR=~/weather-sunset-predictor
NODE_BIN="/root/.nvm/versions/node/v22.22.0/bin/node"
APP_DIR="$DEPLOY_DIR/server"
APP_ENTRY="index.js"

get_pids() {
  local target_pids=""
  local lines

  for pat in \
    "/usr/local/bin/node .*${APP_ENTRY}$" \
    "$NODE_BIN .*${APP_ENTRY}$" \
    "node .*${APP_DIR}/${APP_ENTRY}$"; do
    lines="$(pgrep -f "$pat" || true)"
    if [ -n "$lines" ]; then
      target_pids="$target_pids\n$lines"
    fi
  done

  printf "%s\n" "$target_pids" | tr ' ' '\n' | awk 'NF{print $1}' | sort -n | uniq
}

echo "  → 查找旧 index.js 进程并安全停止（支持 /usr/local/bin/node 与 nvm node）..."
PIDS="$(get_pids)"

if [ -n "$PIDS" ]; then
  echo "  → 已匹配到进程：$(echo "$PIDS" | tr '\n' ' ')"
  while IFS= read -r pid; do
    [ -z "$pid" ] && continue
    if kill -0 "$pid" 2>/dev/null; then
      kill -TERM "$pid" || true
    fi
  done <<< "$PIDS"

  sleep 2
  REMAIN="$(get_pids)"
  if [ -n "$REMAIN" ]; then
    echo "  → 强制杀死残留进程..."
    while IFS= read -r pid; do
      [ -z "$pid" ] && continue
      if kill -0 "$pid" 2>/dev/null; then
        kill -KILL "$pid" || true
      fi
    done <<< "$REMAIN"
  fi
else
  echo "  → 未检测到旧 index.js 进程"
fi

# 启动后端（固定使用 v22.22.0）
nohup "$NODE_BIN" "$APP_DIR/$APP_ENTRY" >> /tmp/ws-backend.log 2>&1 &
sleep 2

echo "  → 验证进程存活..."
if ! pgrep -af "$NODE_BIN .*${APP_ENTRY}" >/dev/null; then
  echo "❌ 启动失败：未检测到 $NODE_BIN 进程"
  exit 1
fi

echo "  → 健康检查 localhost:3000/health ..."
if curl -fsS --max-time 5 http://127.0.0.1:3000/health >/dev/null; then
  echo "✅ 健康检查通过"
else
  echo "⚠️ 健康检查失败，尝试端口检查..."
  if ss -ltnp 2>/dev/null | grep -q ":3000"; then
    echo "✅ 端口 3000 已监听"
  else
    echo "❌ 端口 3000 未监听"
    exit 1
  fi
fi
RESTART

# 预热 raster 缓存（避免用户首次访问超时）
echo "🔥 预热缓存..."
ssh -i "$SSH_KEY" $REMOTE "
  timeout 30s curl -s -o /dev/null 'http://localhost:3000/api/spots/china/raster?period=sunset&resolution=0.5' || true
  timeout 30s curl -s -o /dev/null 'http://localhost:3000/api/spots/china/raster?period=sunrise&resolution=0.5' || true
  echo '  → 预热完成（超时自动跳过）'
"

# 清理本地临时文件
rm -f "$ZIP_TMP"

echo "✅ 部署完成"
