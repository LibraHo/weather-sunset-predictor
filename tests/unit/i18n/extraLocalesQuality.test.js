const EXTRA_LOCALES = ['zh-TW', 'fr-FR', 'vi-VN'];

function flattenEntries(value, prefix = '', out = []) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      flattenEntries(child, prefix ? `${prefix}.${key}` : key, out);
    }
    return out;
  }

  out.push({ key: prefix, value });
  return out;
}

describe('extra supported locale quality', () => {
  test('zh-TW/fr-FR/vi-VN include every zh-CN user-visible key without extra schema drift', async () => {
    const zh = (await import('../../../src/locales/zh-CN.js')).default;
    const requiredKeys = flattenEntries(zh).map(({ key }) => key).sort();

    for (const locale of EXTRA_LOCALES) {
      const mod = await import(`../../../src/locales/${locale}.js`);
      const localeKeys = flattenEntries(mod.default).map(({ key }) => key).sort();
      const keySet = new Set(localeKeys);
      const missing = requiredKeys.filter((key) => !keySet.has(key));
      const extra = localeKeys.filter((key) => !requiredKeys.includes(key));

      expect(missing).toEqual([]);
      expect(extra).toEqual([]);
    }
  });

  test('French and Vietnamese values do not fall back to CJK UI copy', async () => {
    const cjkPattern = /[\u3400-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/;

    for (const locale of ['fr-FR', 'vi-VN']) {
      const mod = await import(`../../../src/locales/${locale}.js`);
      const offenders = flattenEntries(mod.default)
        .filter(({ value }) => typeof value === 'string' && cjkPattern.test(value))
        .map(({ key, value }) => `${locale}.${key}: ${value}`);

      expect(offenders).toEqual([]);
    }
  });

  test('newly requested locales have localized critical feature copy', async () => {
    const zhTW = (await import('../../../src/locales/zh-TW.js')).default;
    const fr = (await import('../../../src/locales/fr-FR.js')).default;
    const vi = (await import('../../../src/locales/vi-VN.js')).default;

    expect(zhTW.app.apiKeyRequired).toBe('請輸入 API 金鑰');
    expect(zhTW.settings.mapTileProvider).toBe('地圖底圖');
    expect(zhTW.prediction.cloudThickness.moderateDesc).toBe('雲層厚度適中，有利於呈現層次。');

    expect(fr.app.apiKeyRequired).toBe('Veuillez saisir une clé API');
    expect(fr.settings.mapTileProvider).toBe('Fond de carte');
    expect(fr.prediction.cloudThickness.moderateDesc).toBe('Épaisseur équilibrée, favorable aux dégradés.');

    expect(vi.app.apiKeyRequired).toBe('Vui lòng nhập khóa API');
    expect(vi.settings.mapTileProvider).toBe('Nền bản đồ');
    expect(vi.prediction.cloudThickness.moderateDesc).toBe('Độ dày cân bằng, thuận lợi cho các lớp màu.');
  });
});
