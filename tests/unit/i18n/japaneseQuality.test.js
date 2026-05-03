const FORBIDDEN_JA_RESIDUE = [
  '最佳',
  'Share Prediction',
  'Save Image',
  'Copy Link',
  'More Share',
  'Link Copied'
];

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

describe('requirement 47.5 Japanese locale quality', () => {
  test('ja-JP user-visible values do not contain known Chinese/English fallback residue', async () => {
    const ja = (await import('../../../src/locales/ja-JP.js')).default;
    const offenders = flattenValues(ja)
      .filter(({ value }) => typeof value === 'string' && FORBIDDEN_JA_RESIDUE.some((term) => value.includes(term)))
      .map(({ key, value }) => `${key}: ${value}`);

    expect(offenders).toEqual([]);
  });

  test('primary feature-path Japanese copy is localized and readable', async () => {
    const ja = (await import('../../../src/locales/ja-JP.js')).default;

    expect(ja.app.subtitle).toBe('夕焼け雲のベストタイミングを予測');
    expect(ja.home.tabs.apiAccess).toBe('API接続');
    expect(ja.home.tabs.shareMap).toBe('共有マップ');
    expect(ja.prediction.canvas.aerosol).toBe('エアロゾル');
    expect(ja.share.title).toBe('予測を共有');
    expect(ja.share.nativeShare).toBe('その他の共有方法');
    expect(ja.settings.mapTileProvider).toBe('地図ベースマップ');
    expect(ja.errors.apiKeyInvalid).toBe('無効なAPIキーです。設定を確認してください');
  });
});
