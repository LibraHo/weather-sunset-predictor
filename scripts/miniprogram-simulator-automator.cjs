const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const automator = require('miniprogram-automator');

const autoPort = process.env.WECHAT_AUTO_PORT || '9420';
const wsEndpoint = process.env.WECHAT_AUTO_WS || `ws://127.0.0.1:${autoPort}`;
const outputDir = path.resolve(
  process.env.WECHAT_AUTOMATOR_OUTPUT || path.join(os.tmpdir(), `xiake-miniprogram-simulator-${Date.now()}`)
);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function tryScreenshot(miniProgram, fileName, warnings) {
  const output = path.join(outputDir, fileName);
  try {
    await Promise.race([
      miniProgram.screenshot({ path: output }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('screenshot timeout')), 15000)),
    ]);
    return output;
  } catch (error) {
    warnings.push(`Screenshot skipped for ${fileName}: ${error.message}`);
    return null;
  }
}

async function requireElement(page, selector) {
  const element = await page.$(selector);
  assert(element, `Missing mini program element: ${selector}`);
  return element;
}

async function readSimulatorState(page) {
  const data = await page.data();
  return {
    mode: data.mode,
    viewMode: data.viewMode,
    selectedCloudId: data.selectedCloudId,
    selectedCloud: data.selectedCloud,
    summaryText: data.summaryText,
    cloudRows: data.cloudRows,
  };
}

(async () => {
  fs.mkdirSync(outputDir, { recursive: true });

  const miniProgram = await automator.connect({ wsEndpoint });
  const logs = [];
  const warnings = [];
  miniProgram.on('console', (entry) => logs.push(entry));
  miniProgram.on('exception', (entry) => logs.push({ level: 'exception', message: entry && entry.message }));

  try {
    const page = await miniProgram.reLaunch('/pages/simulator/index');
    assert(page, 'Failed to reLaunch pages/simulator/index');
    await page.waitFor('.simulator-page');
    await page.waitFor('#firecloudSimulatorCanvas');

    await requireElement(page, '[data-mode="sunrise"]');
    await requireElement(page, '[data-mode="sunset"]');
    await requireElement(page, '[data-view="crossSection"]');
    await requireElement(page, '[data-view="facingSun"]');
    for (const field of ['distanceKm', 'baseHeightM', 'topHeightM', 'coverage', 'widthKm', 'opticalDepth']) {
      await requireElement(page, `[data-field="${field}"]`);
    }

    const initialScreenshot = await tryScreenshot(miniProgram, '01-simulator-initial.png', warnings);
    const initial = await readSimulatorState(page);
    assert(initial.mode === 'sunset', `Expected default mode sunset, got ${initial.mode}`);
    assert(initial.viewMode === 'crossSection', `Expected default view crossSection, got ${initial.viewMode}`);
    assert(Array.isArray(initial.cloudRows) && initial.cloudRows.length >= 4, 'Expected simulator cloud rows');

    await page.callMethod('selectMode', { currentTarget: { dataset: { mode: 'sunrise' } } });
    await page.callMethod('selectViewMode', { currentTarget: { dataset: { view: 'facingSun' } } });
    await page.waitFor(300);

    await page.callMethod('updateCloudField', {
      currentTarget: { dataset: { field: 'widthKm' } },
      detail: { value: '60' },
    });
    await page.waitFor(300);

    const interactedScreenshot = await tryScreenshot(miniProgram, '02-simulator-interacted.png', warnings);
    const after = await readSimulatorState(page);
    assert(after.mode === 'sunrise', `Expected mode sunrise after tap, got ${after.mode}`);
    assert(after.viewMode === 'facingSun', `Expected facingSun after tap, got ${after.viewMode}`);
    assert(Number(after.selectedCloud && after.selectedCloud.widthKm) === 60, 'Expected selected cloud widthKm to update to 60');
    assert(String(after.summaryText || '').includes('全程黑') || after.cloudRows.some((row) => row.alwaysDark), 'Expected always-dark readout to be available');

    const report = {
      wsEndpoint,
      outputDir,
      screenshots: { initial: initialScreenshot, interacted: interactedScreenshot },
      warnings,
      initial,
      after,
      logs,
    };
    fs.writeFileSync(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
    console.log(`Mini program simulator automation passed: ${outputDir}`);
  } finally {
    if (typeof miniProgram.disconnect === 'function') {
      miniProgram.disconnect();
    } else if (typeof miniProgram.close === 'function') {
      await miniProgram.close();
    }
  }
})().catch((error) => {
  console.error(`Mini program simulator automation failed: ${wsEndpoint}`);
  console.error(error);
  process.exit(1);
});
