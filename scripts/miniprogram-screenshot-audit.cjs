const fs = require('node:fs');
const path = require('node:path');
const automator = require('miniprogram-automator');

const autoPort = process.env.WECHAT_AUTO_PORT || '9427';
const wsEndpoint = process.env.WECHAT_AUTO_WS || `ws://127.0.0.1:${autoPort}`;
const outDir = path.join(process.cwd(), 'test-results', 'miniprogram-audit');
const screenshotTimeoutMs = Number(process.env.MINIPROGRAM_SCREENSHOT_TIMEOUT_MS || 15000);

async function screenshot(miniProgram, name) {
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${name}.png`);
  await withTimeout(
    miniProgram.screenshot({ path: file }),
    screenshotTimeoutMs,
    `Timed out capturing ${name}.png after ${screenshotTimeoutMs}ms. ` +
      'WeChat DevTools App.captureScreenshot did not respond; retry after updating/restarting DevTools.'
  );
  console.log(file);
  return file;
}

async function main() {
  const miniProgram = await automator.connect({ wsEndpoint });
  try {
    await miniProgram.reLaunch('/pages/home/index?weatherTest=1');
    let page = await miniProgram.currentPage();
    await page.waitFor(1200);

    await page.setData({
      themeMode: 'dark',
      resolvedThemeMode: 'dark'
    });
    await page.waitFor(500);

    page = await miniProgram.currentPage();
    await page.setData({
      weatherView: 'hourly',
      weatherDay: 'today',
      weatherParameter: 'temp',
      themeMode: 'dark',
      resolvedThemeMode: 'dark'
    });
    await page.waitFor(500);
    await miniProgram.pageScrollTo(760);
    await page.waitFor(500);
    await screenshot(miniProgram, 'home-hourly-dark');

    await page.setData({ weatherView: 'glow' });
    await page.waitFor(500);
    await miniProgram.pageScrollTo(760);
    await page.waitFor(500);
    await screenshot(miniProgram, 'home-glow-dark');

    await miniProgram.pageScrollTo(620);
    await page.waitFor(500);
    await screenshot(miniProgram, 'home-prediction-dark');
  } finally {
    if (typeof miniProgram.disconnect === 'function') {
      miniProgram.disconnect();
    }
  }
}

function withTimeout(promise, timeoutMs, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
