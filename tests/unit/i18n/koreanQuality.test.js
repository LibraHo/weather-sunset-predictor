const FORBIDDEN_KO_RESIDUE = [
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

describe('requirement 47.6 Korean locale quality', () => {
  test('ko-KR user-visible values do not contain known English fallback residue', async () => {
    const ko = (await import('../../../src/locales/ko-KR.js')).default;
    const offenders = flattenValues(ko)
      .filter(({ value }) => typeof value === 'string' && FORBIDDEN_KO_RESIDUE.some((term) => value.includes(term)))
      .map(({ key, value }) => `${key}: ${value}`);

    expect(offenders).toEqual([]);
  });

  test('primary feature-path Korean copy is localized and readable', async () => {
    const ko = (await import('../../../src/locales/ko-KR.js')).default;

    expect(ko.app.subtitle).toBe('화염구름이 나타나는 최적의 시간 예측');
    expect(ko.home.tabs.apiAccess).toBe('API 연동');
    expect(ko.home.tabs.shareMap).toBe('공유 지도');
    expect(ko.prediction.canvas.aerosol).toBe('에어로졸');
    expect(ko.share.title).toBe('예보 공유');
    expect(ko.share.nativeShare).toBe('다른 공유 방법');
    expect(ko.settings.mapTileProvider).toBe('지도 배경');
    expect(ko.errors.apiKeyInvalid).toBe('유효하지 않은 API 키, 구성을 확인하세요');
  });
});
