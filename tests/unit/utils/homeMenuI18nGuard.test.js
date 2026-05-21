import fs from 'fs';
import path from 'path';

describe('home menu i18n guard', () => {
  test('share map menu item uses data-i18n and key exists in all locales', () => {
    const html = fs.readFileSync(path.resolve('index.html'), 'utf8');
    expect(html).toContain('data-view="gallery" data-i18n="home.tabs.shareMap"');

    for (const locale of fs.readdirSync(path.resolve('src/locales')).filter(file => file.endsWith('.js') && file !== 'index.js')) {
      const source = fs.readFileSync(path.resolve('src/locales', locale), 'utf8');
      expect(source).toMatch(/["']?shareMap["']?\s*:/);
    }
  });

  test('API access panel is in the shared HomeTabs frame and has locale keys', () => {
    const html = fs.readFileSync(path.resolve('index.html'), 'utf8');
    expect(html).toContain('data-view="api" data-i18n="home.tabs.apiAccess"');
    expect(html).toContain('id="tab-panel-api"');

    const requiredKeys = [
      'apiAccess', 'kicker', 'intro', 'openApiSpec', 'admin', 'quickStart',
      'step1', 'step2', 'step3', 'restrictions', 'restrictionText',
      'endpoints', 'endpointsIntro', 'forecastDesc', 'explainDesc', 'geocodeDesc', 'mapSummaryDesc'
    ];

    for (const locale of fs.readdirSync(path.resolve('src/locales')).filter(file => file.endsWith('.js') && file !== 'index.js')) {
      const source = fs.readFileSync(path.resolve('src/locales', locale), 'utf8');
      for (const key of requiredKeys) {
        expect(source).toMatch(new RegExp(`["']?${key}["']?\\s*:`));
      }
    }
  });

  test('new API access page copy is maintained in zh-CN/zh-TW/en-US and falls back to English elsewhere', async () => {
    const en = (await import('../../../src/locales/en-US.js')).default.home.apiAccess;
    const zhCN = (await import('../../../src/locales/zh-CN.js')).default.home.apiAccess;
    const zhTW = (await import('../../../src/locales/zh-TW.js')).default.home.apiAccess;

    expect(zhCN.intro).toContain('霞客 Agent API');
    expect(zhTW.intro).toContain('霞客 Agent API');
    expect(en.intro).toContain('Sunset Voyager');

    for (const locale of ['ja-JP', 'ko-KR', 'es-ES', 'fr-FR', 'vi-VN', 'it-IT', 'ar-SA']) {
      const mod = await import(`../../../src/locales/${locale}.js`);
      expect(mod.default.home.apiAccess).toEqual(en);
    }
  });
});
