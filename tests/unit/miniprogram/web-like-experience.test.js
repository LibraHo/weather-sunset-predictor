import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('miniprogram web-like experience shell', () => {
  test('home opens with the same primary product destinations as web', () => {
    const wxml = read('miniprogram/pages/home/index.wxml');
    const js = read('miniprogram/pages/home/index.js');
    const wxss = read('miniprogram/pages/home/index.wxss');

    expect(wxml).toContain('app-logo');
    expect(wxml).toContain('home-view-menu-dropdown');
    expect(wxml).toContain('预测功能');
    expect(wxml).toContain('计算方法');
    expect(wxml).toContain('火烧云地图');
    expect(wxml).toContain('分享地图');
    expect(wxml).toContain('上传照片');
    expect(wxml).not.toContain('nav-grid');
    expect(wxml).not.toContain('nav-card');
    expect(js).toContain('toggleHomeMenu()');
    expect(js).toContain('navigateFeature(event)');
    expect(js).toContain("methodology: '/pages/methodology/index'");
    expect(js).toContain("map: `/pages/map/index?period=${this.data.period}`");
    expect(js).toContain("gallery: '/pages/gallery/index'");
    expect(js).toContain("upload: '/pages/upload/index'");
    expect(wxss).toContain('.app-header');
    expect(wxss).toContain('.home-view-menu-dropdown');
    expect(wxss).not.toContain('.nav-grid');
    expect(wxss).not.toContain('.nav-card');
  });

  test('result page keeps users in the Xiake product loop after scoring', () => {
    const wxml = read('miniprogram/pages/result/index.wxml');
    const js = read('miniprogram/pages/result/index.js');
    const wxss = read('miniprogram/pages/result/index.wxss');

    expect(wxml).toContain('页面切换');
    expect(wxml).toContain('计算方法');
    expect(wxml).toContain('火烧云地图');
    expect(wxml).toContain('分享地图');
    expect(wxml).toContain('上传照片');
    expect(js).toContain('navigateExperience(event)');
    expect(js).toContain("methodology: '/pages/methodology/index'");
    expect(js).toContain("map: `/pages/map/index?period=${this.data.prediction?.period || this.data.prediction?.type || 'sunset'}`");
    expect(js).toContain("gallery: '/pages/gallery/index'");
    expect(js).toContain("upload: '/pages/upload/index'");
    expect(wxss).toContain('.result-view-switch');
    expect(wxss).toContain('.switch-options');
    expect(wxss).not.toContain('.dock-grid');
  });

  test('gallery is positioned as a native mini-program map with H5 as secondary fallback', () => {
    const wxml = read('miniprogram/pages/gallery/index.wxml');
    const js = read('miniprogram/pages/gallery/index.js');

    expect(wxml).toContain('在小程序里直接看照片、位置和详情');
    expect(js).toContain('直接在小程序里浏览照片位置、详情和原图');
    expect(wxml).toContain('复制 H5 地图');
  });
});
