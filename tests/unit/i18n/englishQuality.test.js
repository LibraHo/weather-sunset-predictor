const CJK = /[\u4e00-\u9fff]/;

function flattenValues(value, prefix = '', out = []) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      flattenValues(child, prefix ? `${prefix}.${key}` : key, out);
    }
    return out;
  }

  out.push({ key: prefix, value });
  return out;
}

describe('requirement 47.4 English locale quality', () => {
  test('en-US user-visible locale values do not fall back to Chinese', async () => {
    const en = (await import('../../../src/locales/en-US.js')).default;
    const offenders = flattenValues(en)
      .filter(({ value }) => typeof value === 'string' && CJK.test(value))
      .map(({ key, value }) => `${key}: ${value}`);

    expect(offenders).toEqual([]);
  });

  test('primary feature-path English copy is natural and consistent', async () => {
    const en = (await import('../../../src/locales/en-US.js')).default;

    expect(en.home.tabs.apiAccess).toBe('API Access');
    expect(en.home.tabs.shareMap).toBe('Share Map');
    expect(en.home.menu.ariaLabel).toBe('Switch home view');
    expect(en.prediction.canvas.aerosol).toBe('Aerosol');
    expect(en.share.nativeShare).toBe('More sharing options');
    expect(en.settings.mapTileProvider).toBe('Map Basemap');
    expect(en.errors.apiKeyInvalid).toBe('Invalid API key, please check configuration');
  });
});
