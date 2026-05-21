import { Client } from '/tmp/openclaw-ssh2/node_modules/ssh2/lib/index.js';
import fs from 'fs';
import { execFileSync } from 'child_process';

const LOCAL = process.cwd();
const HOST = '43.143.237.15';
const USER = 'ubuntu';
const KEY = `${process.env.HOME}/.ssh/id_ed25519`;
const archive = '/tmp/weather-sunset-deploy.tar.gz';
const manifest = '/tmp/weather-sunset-deploy.manifest';

execFileSync('git', ['-C', LOCAL, 'archive', '--format=tar.gz', `--output=${archive}`, 'HEAD'], { stdio: 'inherit' });
const files = execFileSync('git', ['-C', LOCAL, 'ls-files'], { encoding: 'utf8' }).trim().split('\n').sort().join('\n') + '\n';
fs.writeFileSync(manifest, files);

const conn = new Client();
function connect() {
  return new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect({
      host: HOST,
      username: USER,
      privateKey: fs.readFileSync(KEY),
      readyTimeout: 20000,
    });
  });
}
function execRemote(command, label) {
  return new Promise((resolve, reject) => {
    console.log(`\n[remote] ${label}`);
    conn.exec(command, { pty: false }, (err, stream) => {
      if (err) return reject(err);
      let out = '', errOut = '';
      stream.on('close', (code) => {
        if (out.trim()) console.log(out.trim());
        if (errOut.trim()) console.error(errOut.trim());
        if (code === 0) resolve(out);
        else reject(new Error(`${label} failed with code ${code}`));
      });
      stream.on('data', d => { out += d.toString(); });
      stream.stderr.on('data', d => { errOut += d.toString(); });
    });
  });
}
function upload(local, remote) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      console.log(`[sftp] ${local} -> ${remote}`);
      sftp.fastPut(local, remote, err2 => {
        sftp.end();
        err2 ? reject(err2) : resolve();
      });
    });
  });
}

const prep = String.raw`set -euo pipefail
DEPLOY_DIR="$HOME/weather-sunset-predictor"
[ -n "$DEPLOY_DIR" ] || { echo "ERROR: DEPLOY_DIR empty"; exit 1; }
if [ -d "$DEPLOY_DIR" ]; then
  sudo chown -R "$USER:$USER" "$DEPLOY_DIR/server/node_modules" 2>/dev/null || true
  sudo chown "$USER:$USER" "$DEPLOY_DIR" "$DEPLOY_DIR/server" 2>/dev/null || true
fi`;

const tarSync = String.raw`set -euo pipefail
DEPLOY_DIR="$HOME/weather-sunset-predictor"
REMOTE_ARCHIVE="/tmp/weather-sunset-deploy.tar.gz"
REMOTE_MANIFEST="/tmp/weather-sunset-deploy.manifest"
OLD_MANIFEST="$DEPLOY_DIR/.deploy-manifest"
[ -n "$DEPLOY_DIR" ] || { echo "ERROR: DEPLOY_DIR empty"; exit 1; }
mkdir -p "$DEPLOY_DIR"
if [ -f "$OLD_MANIFEST" ]; then
  SORTED_OLD_MANIFEST="/tmp/weather-sunset-deploy.old.manifest.sorted"
  SORTED_REMOTE_MANIFEST="/tmp/weather-sunset-deploy.manifest.sorted"
  LC_ALL=C sort -u "$OLD_MANIFEST" > "$SORTED_OLD_MANIFEST"
  LC_ALL=C sort -u "$REMOTE_MANIFEST" > "$SORTED_REMOTE_MANIFEST"
  LC_ALL=C comm -23 "$SORTED_OLD_MANIFEST" "$SORTED_REMOTE_MANIFEST" | while IFS= read -r rel; do
    case "$rel" in
      ""|/*|*".."*|.env|server/.env|node_modules/*|server/node_modules/*|.xiake/*|uploads/*|server/uploads/*|log/*|server/log/*|cache/*|server/cache/*)
        continue ;;
    esac
    if [ -f "$DEPLOY_DIR/$rel" ]; then rm -f "$DEPLOY_DIR/$rel"; fi
  done
fi
tar -xzf "$REMOTE_ARCHIVE" -C "$DEPLOY_DIR"
cp "$REMOTE_MANIFEST" "$OLD_MANIFEST"`;

const restart = String.raw`set -euo pipefail
DEPLOY_DIR="$HOME/weather-sunset-predictor"
APP_DIR="$DEPLOY_DIR/server"
APP_ENTRY="index.js"
NODE_BIN=""
node_major_version() { local node_bin="$1"; sudo "$node_bin" -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || true; }
resolve_node() {
  for candidate in "/usr/local/bin/node" "$HOME/.nvm/versions/node/v22.22.0/bin/node" "$(command -v node 2>/dev/null || true)"; do
    [ -n "$candidate" ] || continue
    major="$(node_major_version "$candidate")"
    if [ -n "$major" ] && [ "$major" -ge 18 ] 2>/dev/null; then
      NODE_BIN="$candidate"
      echo "使用 Node: $NODE_BIN (major=$major)"
      return 0
    fi
    echo "跳过 Node: $candidate (major=$major, 需要 >=18)"
  done
  root_node="$(sudo sh -lc 'ls -dt /root/.nvm/versions/node/*/bin/node 2>/dev/null | head -n 1' || true)"
  if [ -n "$root_node" ]; then
    major="$(node_major_version "$root_node")"
    if [ -n "$major" ] && [ "$major" -ge 18 ] 2>/dev/null; then NODE_BIN="$root_node"; echo "使用 Node: $NODE_BIN (major=$major)"; return 0; fi
  fi
  echo "未找到可执行且版本 >=18 的 Node 二进制"; return 1
}
resolve_node
APP_ENV_FILE="$APP_DIR/.env"
# 确保 .env 文件存在并包含 SERVER_TOKEN_SECRET
if [ ! -f "$APP_ENV_FILE" ] || ! grep -q '^SERVER_TOKEN_SECRET=' "$APP_ENV_FILE"; then
  sudo touch "$APP_ENV_FILE"
  sudo chown "$USER:$USER" "$APP_ENV_FILE"
  if ! grep -q '^SERVER_TOKEN_SECRET=' "$APP_ENV_FILE"; then
    NEW_SECRET="$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-f0-9' | head -c64)"
    echo "SERVER_TOKEN_SECRET=$NEW_SECRET" >> "$APP_ENV_FILE"
    echo "[deploy] 已生成 SERVER_TOKEN_SECRET"
  fi
fi
resolve_port() { local port=""; if [ -f "$APP_ENV_FILE" ]; then port="$(awk -F= '/^PORT=/{print $2}' "$APP_ENV_FILE" | tail -n 1 | tr -d '[:space:]"'"'"'')"; fi; if [ -n "$port" ] && [ "$port" -eq "$port" ] 2>/dev/null; then echo "$port"; else echo 3000; fi; }
APP_PORT="$(resolve_port)"
get_pids() {
  ps -eo pid=,comm=,args= | awk -v app_dir="$APP_DIR" -v app_entry="$APP_ENTRY" '
    ($2 == "node" || $2 == "sudo") && (index($0, app_dir "/" app_entry) > 0 || $0 ~ ("node[[:space:]]+" app_entry "($|[[:space:]])")) { print $1 }
  ' | while IFS= read -r pid; do
    [ -n "$pid" ] || continue
    cwd="$(sudo readlink "/proc/$pid/cwd" 2>/dev/null || true)"
    args="$(ps -p "$pid" -o args= 2>/dev/null || true)"
    if [ "$cwd" = "$APP_DIR" ] || printf '%s' "$args" | grep -Fq "$APP_DIR/$APP_ENTRY"; then
      echo "$pid"
    fi
  done | sort -n | uniq || true
}
stop_pid() { local sig="$1" pid="$2"; kill -s "$sig" "$pid" 2>/dev/null || sudo kill -s "$sig" "$pid" 2>/dev/null || true; }
echo "查找旧 index.js 进程并安全停止..."
PIDS="$(get_pids)"
if [ -n "$PIDS" ]; then
  echo "已匹配到进程：$(echo "$PIDS" | tr '\n' ' ')"
  while IFS= read -r pid; do [ -z "$pid" ] || stop_pid TERM "$pid"; done <<< "$PIDS"
  sleep 2
  REMAIN="$(get_pids)"
  if [ -n "$REMAIN" ]; then while IFS= read -r pid; do [ -z "$pid" ] || stop_pid KILL "$pid"; done <<< "$REMAIN"; fi
else echo "未检测到旧 index.js 进程"; fi
cd "$APP_DIR"
missing_deps=""
[ -d "$APP_DIR/node_modules/express" ] || missing_deps="$missing_deps express"
[ -d "$APP_DIR/node_modules/sharp" ] || missing_deps="$missing_deps sharp"
if [ -n "$missing_deps" ]; then
  echo "依赖缺失($missing_deps)，安装生产依赖..."
  NPM_BIN="$(dirname "$NODE_BIN")/npm"
  if ! sudo test -x "$NPM_BIN" 2>/dev/null; then NPM_BIN="$(command -v npm 2>/dev/null || true)"; fi
  [ -n "$NPM_BIN" ] || { echo "未找到 npm"; exit 1; }
  sudo "$NPM_BIN" install --omit=dev
  sudo chown -R "$USER:$USER" "$APP_DIR/node_modules" 2>/dev/null || true
fi
nohup sudo "$NODE_BIN" "$APP_DIR/$APP_ENTRY" >> /home/ubuntu/ws-backend.log 2>&1 &
sleep 5
pgrep -af "node .*weather-sunset-predictor/server/index.js" >/dev/null || { echo "启动失败：未检测到目标 Node 进程"; exit 1; }
curl -fsS --max-time 5 "http://127.0.0.1:$APP_PORT/health" >/dev/null && echo "本地健康检查通过"`;

try {
  await connect();
  await execRemote(prep, 'prep permissions');
  await upload(archive, '/tmp/weather-sunset-deploy.tar.gz');
  await upload(manifest, '/tmp/weather-sunset-deploy.manifest');
  await execRemote(tarSync, 'extract archive');
  await execRemote(restart, 'restart and local health');
  await execRemote("curl -s -o /dev/null -w '%{http_code}' https://sunset.bjhyc.online", 'external health');
} finally {
  conn.end();
}
