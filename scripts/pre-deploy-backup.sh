#!/bin/bash
# 部署前自动备份服务器关键配置
# 用法：bash scripts/pre-deploy-backup.sh [--ssh-key <path>] [--dry-run]
set -e

REMOTE="ubuntu@43.143.237.15"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
DRY_RUN=false

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

TIMESTAMP=$(date +%Y%m%d-%H%M%S)

echo "📦 备份服务器配置..."

if [[ "$DRY_RUN" == "true" ]]; then
  echo "  [dry-run] 跳过 SSH 执行，仅预览："
  echo "  ssh -i ${SSH_KEY} ${REMOTE} bash -s <<'REMOTE_SCRIPT'"
  exit 0
fi

ssh -i "$SSH_KEY" "$REMOTE" bash -s <<REMOTE_SCRIPT
set -e
DEPLOY_DIR="\$HOME/weather-sunset-predictor"
BACKUP_DIR="\$HOME/.xiake-backup/${TIMESTAMP}"

mkdir -p "\$BACKUP_DIR"

# 备份 .env
[ -f "\$DEPLOY_DIR/server/.env" ] && cp "\$DEPLOY_DIR/server/.env" "\$BACKUP_DIR/.env" && echo '  ✅ .env 已备份'

# 备份 schedule-config
[ -f "\$HOME/.xiake/schedule-config.json" ] && cp "\$HOME/.xiake/schedule-config.json" "\$BACKUP_DIR/schedule-config.json" && echo '  ✅ schedule-config 已备份'

# 备份 grid-cache
[ -f "\$HOME/.xiake/grid-cache.json" ] && cp "\$HOME/.xiake/grid-cache.json" "\$BACKUP_DIR/grid-cache.json" && echo '  ✅ grid-cache 已备份'

# 备份 job-state
[ -f "\$HOME/.xiake/grid-job-state.json" ] && cp "\$HOME/.xiake/grid-job-state.json" "\$BACKUP_DIR/grid-job-state.json" && echo '  ✅ job-state 已备份'

# 保留最近 10 份备份
ls -dt "\$HOME/.xiake-backup"/*/ 2>/dev/null | tail -n +11 | xargs rm -rf 2>/dev/null || true

echo '✅ 备份完成'
ls -la "\$BACKUP_DIR/"
REMOTE_SCRIPT
