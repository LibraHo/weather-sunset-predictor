import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import zhCN from '../../../src/locales/zh-CN.js';
import zhTW from '../../../src/locales/zh-TW.js';
import enUS from '../../../src/locales/en-US.js';
import jaJP from '../../../src/locales/ja-JP.js';
import koKR from '../../../src/locales/ko-KR.js';
import viVN from '../../../src/locales/vi-VN.js';
import frFR from '../../../src/locales/fr-FR.js';
import esES from '../../../src/locales/es-ES.js';
import itIT from '../../../src/locales/it-IT.js';
import arSA from '../../../src/locales/ar-SA.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const indexHtml = fs.readFileSync(path.resolve(__dirname, '../../../index.html'), 'utf8');

const CHINESE_CHAR_RE = /[\u4e00-\u9fff]/;

describe('home menu i18n hardcoded Chinese guard', () => {
  test('gallery menu item has data-i18n key', () => {
    const html = new DOMParser().parseFromString(indexHtml, 'text/html');
    const galleryOption = html.querySelector('[data-view="gallery"]');

    expect(galleryOption).toBeTruthy();
    expect(galleryOption.getAttribute('data-i18n')).toBe('home.tabs.shareMap');
  });

  test('home menu locale entries include shareMap for all supported languages', () => {
    const localeMap = {
      'zh-CN': zhCN,
      'zh-TW': zhTW,
      'en-US': enUS,
      'ja-JP': jaJP,
      'ko-KR': koKR,
      'vi-VN': viVN,
      'fr-FR': frFR,
      'es-ES': esES,
      'it-IT': itIT,
      'ar-SA': arSA,
    };

    for (const localeData of Object.values(localeMap)) {
      const shareMapLabel = localeData?.home?.tabs?.shareMap;

      expect(shareMapLabel).toBeDefined();
      expect(typeof shareMapLabel).toBe('string');
      expect(shareMapLabel.trim().length).toBeGreaterThan(0);
    }
  });

  test('home menu user-visible text without data-i18n should not be hardcoded Chinese', () => {
    const html = new DOMParser().parseFromString(indexHtml, 'text/html');
    const menu = html.getElementById('home-view-menu-dropdown');
    expect(menu).toBeTruthy();

    const menuOptions = menu.querySelectorAll('button, a');
    const offenders = Array.from(menuOptions).filter((el) => {
      if (el.hasAttribute('data-i18n')) {
        return false;
      }
      const text = el.textContent?.trim() ?? '';
      if (!text) {
        return false;
      }

      return CHINESE_CHAR_RE.test(text);
    });

    expect(offenders).toEqual([]);
  });
});
