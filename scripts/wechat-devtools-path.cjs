const fs = require('node:fs');

const candidates = [
  process.env.WECHAT_DEVTOOLS_CLI,
  'D:\\Program Files (x86)\\\u5fae\u4fe1web\u5f00\u53d1\u8005\u5de5\u5177\\cli.bat',
  'D:\\Program Files\\\u5fae\u4fe1web\u5f00\u53d1\u8005\u5de5\u5177\\cli.bat',
  'D:\\Program Files (x86)\\\u5fae\u4fe1\u5f00\u53d1\u8005\u5de5\u5177\\cli.bat',
  'D:\\Program Files\\\u5fae\u4fe1\u5f00\u53d1\u8005\u5de5\u5177\\cli.bat',
  'C:\\Program Files (x86)\\Tencent\\\u5fae\u4fe1web\u5f00\u53d1\u8005\u5de5\u5177\\cli.bat',
  'C:\\Program Files\\Tencent\\\u5fae\u4fe1web\u5f00\u53d1\u8005\u5de5\u5177\\cli.bat',
  'C:\\Program Files (x86)\\Tencent\\\u5fae\u4fe1\u5f00\u53d1\u8005\u5de5\u5177\\cli.bat',
  'C:\\Program Files\\Tencent\\\u5fae\u4fe1\u5f00\u53d1\u8005\u5de5\u5177\\cli.bat',
  'C:\\Program Files (x86)\\Tencent\\\u5fae\u4fe1web\u5f00\u53d1\u8005\u5de5\u5177\\\u5fae\u4fe1\u5f00\u53d1\u8005\u5de5\u5177.exe',
  'C:\\Program Files\\Tencent\\\u5fae\u4fe1web\u5f00\u53d1\u8005\u5de5\u5177\\\u5fae\u4fe1\u5f00\u53d1\u8005\u5de5\u5177.exe',
  'C:\\Program Files (x86)\\Tencent\\\u5fae\u4fe1\u5f00\u53d1\u8005\u5de5\u5177\\\u5fae\u4fe1\u5f00\u53d1\u8005\u5de5\u5177.exe',
  'C:\\Program Files\\Tencent\\\u5fae\u4fe1\u5f00\u53d1\u8005\u5de5\u5177\\\u5fae\u4fe1\u5f00\u53d1\u8005\u5de5\u5177.exe',
].filter(Boolean);

function resolveWechatDevToolsCli() {
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function assertWechatDevToolsCli() {
  const cliPath = resolveWechatDevToolsCli();

  if (!cliPath) {
    console.error('WeChat DevTools CLI was not found.');
    console.error('Install WeChat DevTools, enable Settings > Security > Service Port, then set:');
    console.error('  $env:WECHAT_DEVTOOLS_CLI="C:\\path\\to\\WeChatDevTools\\cli.bat"');
    process.exit(1);
  }

  return cliPath;
}

module.exports = {
  assertWechatDevToolsCli,
  resolveWechatDevToolsCli,
};
