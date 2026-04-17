#!/bin/bash
# 部署前自动备份服务器关键配置
# 用法：bash scripts/pre-deploy-backup.sh
set -e

REMOTE="ubuntu@43.143.237.15"
DEPLOY_DIR="~/weather-sunset-predictor"
BACKUP_DIR="~/.xiake-backup/$(date +%Y%m%d-%H%M%S)"

echo "📦 备份服务器配置到 $BACKUP_DIR ..."

ssh "$REMOTE" "
  set -e
  mkdir -p $BACKUP_DIR

  # 备份 .env
  [ -f \"$DEPLOY_DIR/server/.env\" ] && cp \"$DEPLOY_DIR/server/.env\" \"$BACKUP_DIR/.env\" && echo '  ✅ .env 已备份'

  # 备份 schedule-config
  [ -f ~/.xiake/schedule-config.json ] && cp ~/.xiake/schedule-config.json \"$BACKUP_DIR/schedule-config.json\" && echo '  ✅ schedule-config 已备份'

  # 备份 grid-cache
  [ -f ~/.xiake/grid-cache.json ] && cp ~/.xiake/grid-cache.json \"$BACKUP_DIR/grid-cache.json\" && echo '  ✅ grid-cache 已备份'

  # 保留最近 10 份备份
  ls -dt ~/.xiake-backup/*/ | tail -n +11 | xargs rm -rf 2>/dev/null || true

  echo '✅ 备份完成'
  ls -la \"$BACKUP_DIR/\"
"
