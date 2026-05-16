const path = require('node:path');
const { spawn } = require('node:child_process');
const { assertWechatDevToolsCli } = require('./wechat-devtools-path.cjs');

const cliPath = assertWechatDevToolsCli();
const defaultProjectPath = path.join(process.cwd(), 'miniprogram');
const projectPath = path.resolve(
  process.env.WECHAT_PROJECT_PATH
    || (require('node:fs').existsSync(path.join(defaultProjectPath, 'project.config.json')) ? defaultProjectPath : process.cwd())
);
const autoPort = process.env.WECHAT_AUTO_PORT || '9420';
const args = ['auto', '--project', projectPath, '--auto-port', autoPort];

console.log(`Starting WeChat DevTools automation on ws://127.0.0.1:${autoPort}`);
console.log(`Project: ${projectPath}`);

const command = `call "${cliPath}" ${args.map((arg) => `"${String(arg).replace(/"/g, '""')}"`).join(' ')}`;
const child = spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/c', command], {
  cwd: projectPath,
  stdio: 'inherit',
  shell: false,
  windowsVerbatimArguments: true,
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`WeChat DevTools automation exited with signal ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 0);
});
