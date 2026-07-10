import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(process.cwd());
const localeFiles = ['zh-CN', 'zh-TW', 'en-US', 'ja-JP', 'ko-KR', 'vi-VN', 'fr-FR', 'es-ES', 'it-IT', 'ar-SA'];

describe('quality level semantic configuration', () => {
  test('stores thresholds and translation keys without language-specific labels', () => {
    const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/quality-levels.json'), 'utf8'));
    expect(config.levels.map(level => level.min)).toEqual([85, 70, 40, 0]);
    for (const level of config.levels) {
      expect(level.labelKey).toBe(`prediction.${level.key}`);
      expect(level).not.toHaveProperty('labelZh');
      expect(level).not.toHaveProperty('labelEn');
    }
  });

  test.each(localeFiles)('%s resolves every quality label key', async locale => {
    const translations = (await import(`../../src/locales/${locale}.js`)).default;
    for (const key of ['excellent', 'good', 'fair', 'poor']) {
      expect(typeof translations.prediction?.[key]).toBe('string');
      expect(translations.prediction[key].trim()).not.toBe('');
    }
  });
});
