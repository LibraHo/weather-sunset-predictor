import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

describe('mini-program firecloud simulator page', () => {
  test('registers native page files and menu routes', () => {
    const appJson = JSON.parse(read('miniprogram/app.json'));
    const homeWxml = read('miniprogram/pages/home/index.wxml');
    const homeJs = read('miniprogram/pages/home/index.js');
    const topbarWxml = read('miniprogram/components/app-topbar/index.wxml');
    const topbarJs = read('miniprogram/components/app-topbar/index.js');

    expect(appJson.pages).toContain('pages/simulator/index');
    for (const extension of ['js', 'wxml', 'wxss', 'json']) {
      expect(exists(`miniprogram/pages/simulator/index.${extension}`)).toBe(true);
    }
    expect(homeWxml).toContain('data-target="simulator"');
    expect(homeJs).toContain("simulator: '/pages/simulator/index'");
    expect(topbarWxml).toContain('data-target="simulator"');
    expect(topbarJs).toContain("simulator: '/pages/simulator/index'");
  });

  test('exposes simulator canvas, views, and physical cloud controls', () => {
    const wxml = read('miniprogram/pages/simulator/index.wxml');
    const js = read('miniprogram/pages/simulator/index.js');
    const wxss = read('miniprogram/pages/simulator/index.wxss');

    expect(wxml).toContain('simulator-page');
    expect(wxml).toContain('canvas-id="firecloudSimulatorCanvas"');
    expect(wxml).toContain('simulator-canvas');
    expect(wxml).toContain('data-mode="sunrise"');
    expect(wxml).toContain('data-mode="sunset"');
    expect(wxml).toContain('data-view="crossSection"');
    expect(wxml).toContain('data-view="facingSun"');
    expect(wxml).toContain('bindtap="selectMode"');
    expect(wxml).toContain('bindtap="selectViewMode"');
    expect(wxml).toContain('bindchange="updateTimeOffset"');
    expect(wxml).toContain('bindinput="updateCloudField"');
    for (const field of ['distanceKm', 'baseHeightM', 'topHeightM', 'coverage', 'widthKm', 'opticalDepth']) {
      expect(wxml).toContain(`data-field="${field}"`);
    }

    expect(js).toContain('DEFAULT_SIMULATOR_CLOUDS');
    expect(js).toContain('simulateFirecloudProfile');
    expect(js).toContain('renderSimulator');
    expect(js).toContain('drawCrossSectionView');
    expect(js).toContain('drawFacingSunView');
    expect(js).toContain('drawOvalStroke');
    expect(js).toContain('bezierCurveTo');
    expect(js).toContain('alwaysDarkCount');
    expect(js).toContain('widthKm');
    expect(wxss).toContain('.simulator-radar-card');
    expect(wxss).toContain('.simulator-control-grid');
    expect(wxss).toContain('.simulator-cloud-row');
  });
});
