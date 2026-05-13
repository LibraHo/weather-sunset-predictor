const path = require('node:path');
const { spawn } = require('node:child_process');
const { assertWechatDevToolsCli } = require('./wechat-devtools-path.cjs');

const cliPath = assertWechatDevToolsCli();
const args = process.argv.slice(2);
const projectPath = process.env.WECHAT_PROJECT_PATH && path.resolve(process.env.WECHAT_PROJECT_PATH);

if (args.length === 0) {
  console.log(`Using WeChat DevTools CLI: ${cliPath}`);
  console.log('Pass CLI arguments after --, for example: npm run mp:devtools -- --help');
}

const child = spawn(cliPath, args, {
  cwd: projectPath || process.cwd(),
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`WeChat DevTools CLI exited with signal ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 0);
});
