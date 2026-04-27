import fs from 'fs';
import path from 'path';

describe('home menu i18n guard', () => {
  test('all home menu entries with Chinese fallback must have data-i18n', () => {
    const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
    const menuMatch = html.match(/<div id="home-view-menu-dropdown"[\s\S]*?<\/div>/);
    expect(menuMatch).toBeTruthy();

    const menuHtml = menuMatch[0];
    const entryRegex = /<(button|a)\b[^>]*class="[^"]*home-view-option[^"]*"[^>]*>[\s\S]*?<\/\1>/g;
    const entries = menuHtml.match(entryRegex) || [];
    expect(entries.length).toBeGreaterThan(0);

    const offenders = entries.filter(entry => /[\u4e00-\u9fff]/.test(entry) && !/\bdata-i18n=/.test(entry));
    expect(offenders).toEqual([]);
  });

  test('share map menu key exists in primary locales', async () => {
    const en = (await import('../../../src/locales/en-US.js')).default;
    const zh = (await import('../../../src/locales/zh-CN.js')).default;
    expect(en.home.tabs.shareMap).toBe('Share Map');
    expect(zh.home.tabs.shareMap).toBe('分享地图');
  });
});
