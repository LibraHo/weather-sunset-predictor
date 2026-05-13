const automator = require('miniprogram-automator');

const autoPort = process.env.WECHAT_AUTO_PORT || '9422';
const wsEndpoint = process.env.WECHAT_AUTO_WS || `ws://127.0.0.1:${autoPort}`;

async function probe(miniProgram, targetPath) {
  await miniProgram.reLaunch(targetPath);
  const page = await miniProgram.currentPage();
  await page.waitFor(1000);
  return readHomeState(page, targetPath);
}

async function probeTestInput(miniProgram) {
  await miniProgram.reLaunch('/pages/home/index');
  const page = await miniProgram.currentPage();
  await page.waitFor(1000);

  if (typeof page.setData === 'function') {
    await page.setData({ locationText: 'test' });
  } else if (typeof page.callMethod === 'function') {
    await page.callMethod('onLocationChange', { detail: { value: 'test' } });
  }

  if (typeof page.callMethod === 'function') {
    await page.callMethod('onSearch');
  }

  await page.waitFor(1000);
  return readHomeState(page, 'input:test');
}

async function readHomeState(page, targetPath) {
  const data = await page.data();
  const selectors = [
    '.home-topbar',
    '.location-search',
    '.home-web-spacer',
    '.home-footer-card',
    '.home-weather-preview'
  ];
  const found = {};

  for (const selector of selectors) {
    try {
      const element = await page.$(selector);
      found[selector] = Boolean(element);
    } catch {
      found[selector] = false;
    }
  }

  return {
    targetPath,
    route: page.path,
    weatherVisible: Boolean(data.weatherPreview?.visible),
    metricCount: data.weatherPreview?.metrics?.length || 0,
    locationText: data.locationText,
    found
  };
}

(async () => {
  const miniProgram = await automator.connect({ wsEndpoint });
  const results = [
    await probe(miniProgram, '/pages/home/index'),
    await probe(miniProgram, '/pages/home/index?weatherTest=1'),
    await probeTestInput(miniProgram)
  ];

  console.log(JSON.stringify(results, null, 2));

  if (typeof miniProgram.disconnect === 'function') {
    await miniProgram.disconnect();
    return;
  }

  if (typeof miniProgram.close === 'function') {
    await miniProgram.close();
  }
})().catch((error) => {
  console.error(`Could not probe mini-program home through ${wsEndpoint}`);
  console.error(error);
  process.exit(1);
});
