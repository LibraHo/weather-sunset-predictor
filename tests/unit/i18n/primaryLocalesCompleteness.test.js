const PRIMARY_LOCALES = ['en-US', 'ja-JP', 'ko-KR', 'es-ES'];

function flattenKeys(value, prefix = '', out = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    if (prefix) out.push(prefix);
    return out;
  }

  for (const key of Object.keys(value)) {
    flattenKeys(value[key], prefix ? `${prefix}.${key}` : key, out);
  }
  return out;
}

describe('primary locale completeness', () => {
  test('en-US/ja-JP/ko-KR/es-ES include every zh-CN user-visible key', async () => {
    const zh = (await import('../../../src/locales/zh-CN.js')).default;
    const requiredKeys = flattenKeys(zh).sort();

    for (const locale of PRIMARY_LOCALES) {
      const mod = await import(`../../../src/locales/${locale}.js`);
      const keys = new Set(flattenKeys(mod.default));
      const missing = requiredKeys.filter((key) => !keys.has(key));
      expect(missing).toEqual([]);
    }
  });
});
