const automator = require('miniprogram-automator');

const autoPort = process.env.WECHAT_AUTO_PORT || '9420';
const wsEndpoint = process.env.WECHAT_AUTO_WS || `ws://127.0.0.1:${autoPort}`;

(async () => {
  const miniProgram = await automator.connect({ wsEndpoint });
  console.log(`Connected to WeChat DevTools automation: ${wsEndpoint}`);

  if (typeof miniProgram.disconnect === 'function') {
    await miniProgram.disconnect();
    return;
  }

  if (typeof miniProgram.close === 'function') {
    await miniProgram.close();
  }
})().catch((error) => {
  console.error(`Could not connect to WeChat DevTools automation: ${wsEndpoint}`);
  console.error(error);
  process.exit(1);
});
