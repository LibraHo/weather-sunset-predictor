const path = require('node:path');
const ci = require('miniprogram-ci');
const pkg = require('../package.json');

const command = process.argv[2];

if (!['preview', 'upload'].includes(command)) {
  console.error('Usage: npm run mp:preview | npm run mp:upload');
  process.exit(1);
}

const env = process.env;
const appid = env.WECHAT_APPID;
const privateKeyPath = env.WECHAT_PRIVATE_KEY_PATH;
const projectPath = path.resolve(env.WECHAT_PROJECT_PATH || process.cwd());
const version = env.WECHAT_VERSION || pkg.version || '1.0.0';
const desc = env.WECHAT_DESC || `${pkg.name} ${version}`;
const robot = Number(env.WECHAT_ROBOT || 1);

const missing = [];
if (!appid) missing.push('WECHAT_APPID');
if (!privateKeyPath) missing.push('WECHAT_PRIVATE_KEY_PATH');

if (missing.length) {
  console.error(`Missing required env: ${missing.join(', ')}`);
  console.error('Example:');
  console.error('  $env:WECHAT_APPID="wx123"; $env:WECHAT_PRIVATE_KEY_PATH="C:\\keys\\private.wx123.key"; npm run mp:preview');
  process.exit(1);
}

const project = new ci.Project({
  appid,
  type: 'miniProgram',
  projectPath,
  privateKeyPath: path.resolve(privateKeyPath),
  ignores: ['node_modules/**/*'],
});

const commonOptions = {
  project,
  desc,
  setting: {
    useProjectConfig: true,
  },
  robot,
  onProgressUpdate: console.log,
};

(async () => {
  if (command === 'preview') {
    const output = env.WECHAT_QRCODE_OUTPUT || path.join(process.cwd(), 'miniprogram-preview-qrcode.jpg');
    const result = await ci.preview({
      ...commonOptions,
      qrcodeFormat: 'image',
      qrcodeOutputDest: output,
      pagePath: env.WECHAT_PREVIEW_PAGE,
      searchQuery: env.WECHAT_PREVIEW_QUERY,
      scene: env.WECHAT_PREVIEW_SCENE ? Number(env.WECHAT_PREVIEW_SCENE) : undefined,
    });
    console.log(result);
    console.log(`Preview QR code: ${output}`);
    return;
  }

  const result = await ci.upload({
    ...commonOptions,
    version,
  });
  console.log(result);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
