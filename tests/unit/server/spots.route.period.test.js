describe('spots route period normalize', () => {
  let normalizeSpotsPeriod;

  beforeAll(async () => {
    const mod = await import('../../../server/routes/spots.js');
    normalizeSpotsPeriod = mod.normalizeSpotsPeriod;
  });

  test('支持 sunrise/sunset', () => {
    expect(normalizeSpotsPeriod('sunrise')).toBe('sunrise');
    expect(normalizeSpotsPeriod('sunset')).toBe('sunset');
  });

  test('非法 period 返回 null', () => {
    expect(normalizeSpotsPeriod('noon')).toBeNull();
    expect(normalizeSpotsPeriod('')).toBeNull();
    expect(normalizeSpotsPeriod(null)).toBeNull();
  });
});
