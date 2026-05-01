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
});
