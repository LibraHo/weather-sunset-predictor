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
ssh -i "$SSH_KEY" $REMOTE "sudo systemctl restart sunset-backend 2>/dev/null || (sudo fuser -k 3000/tcp 2>/dev/null; sleep 2; sudo bash -c 'cd /home/ubuntu/weather-sunset-predictor/server && nohup /usr/local/bin/node index.js >> /tmp/ws-backend.log 2>&1 &')"
sleep 6
ssh -i "$SSH_KEY" $REMOTE "curl -s http://localhost:3000/health"

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
