const fs = require('node:fs');
const path = require('node:path');
const automator = require('miniprogram-automator');

const autoPort = process.env.WECHAT_AUTO_PORT || '9427';
const wsEndpoint = process.env.WECHAT_AUTO_WS || `ws://127.0.0.1:${autoPort}`;
const outDir = path.join(process.cwd(), 'test-results', 'miniprogram-audit');

async function screenshot(miniProgram, name) {
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${name}.png`);
  await miniProgram.screenshot({ path: file });
  console.log(file);
  return file;
}

async function main() {
  const miniProgram = await automator.connect({ wsEndpoint });
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

  if (typeof miniProgram.disconnect === 'function') {
    miniProgram.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
