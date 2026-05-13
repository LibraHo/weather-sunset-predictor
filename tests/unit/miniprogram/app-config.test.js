import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

describe('miniprogram app configuration', () => {
  test('registers MVP pages without exposing admin pages', () => {
    const appJson = readJson('miniprogram/app.json');

    expect(appJson.pages).toEqual([
      'pages/home/index',
      'pages/methodology/index',
      'pages/result/index',
      'pages/gallery/index',
      'pages/upload/index'
    ]);
    expect(appJson.pages.some((page) => page.includes('admin'))).toBe(false);
  });

  test('declares location privacy info for wx.getLocation usage', () => {
    const appJson = readJson('miniprogram/app.json');

    expect(appJson.requiredPrivateInfos).toContain('getLocation');
    expect(appJson.permission?.['scope.userLocation']?.desc).toContain('朝霞/晚霞预测');
  });

  test('keeps production domain validation enabled in project config', () => {
    const projectConfig = readJson('miniprogram/project.config.json');

    expect(projectConfig.setting.urlCheck).toBe(true);
    expect(projectConfig.libVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
