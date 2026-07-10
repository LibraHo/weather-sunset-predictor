import SunsetPrediction from '../../../src/models/SunsetPrediction.js';

describe('SunsetPrediction', () => {
  test('getQualityLabel 应覆盖评分阈值分支', () => {
    expect(new SunsetPrediction(new Date(), 85, 'excellent', {}, new Date()).getQualityLabel()).toBe('顶级');
    expect(new SunsetPrediction(new Date(), 70, 'good', {}, new Date()).getQualityLabel()).toBe('高分');
    expect(new SunsetPrediction(new Date(), 40, 'fair', {}, new Date()).getQualityLabel()).toBe('可观赏');
    expect(new SunsetPrediction(new Date(), 39, 'poor', {}, new Date()).getQualityLabel()).toBe('低概率');
  });

  test('toJSON 与 fromJSON 应正确处理可选字段和默认 type', () => {
    const date = new Date('2026-01-01T12:00:00.000Z');
    const sunsetTime = new Date('2026-01-01T10:00:00.000Z');
    const original = new SunsetPrediction(
      date,
      82,
      'excellent',
      { clouds: 80 },
      sunsetTime,
      null,
      undefined,
      null,
      null,
      null,
      null
    );

    const json = original.toJSON();
    const restored = SunsetPrediction.fromJSON(json);

    expect(restored.date.toISOString()).toBe(date.toISOString());
    expect(restored.sunsetTime.toISOString()).toBe(sunsetTime.toISOString());
    expect(restored.sunriseTime).toBeNull();
    expect(restored.type).toBe('sunset');
    expect(restored.goldenHour).toBeNull();
    expect(restored.cloudLayers).toBeNull();
  });

  test('fromJSON 在 null/undefined 字段下应保持健壮', () => {
    const parsed = SunsetPrediction.fromJSON({
      date: '2026-01-01T00:00:00.000Z',
      score: 45,
      quality: 'good',
      factors: null,
      sunsetTime: '2026-01-01T09:00:00.000Z',
      sunriseTime: undefined,
      type: null,
      goldenHour: undefined,
      blueHour: null,
      sunAzimuth: undefined,
      cloudLayers: undefined
    });

    expect(parsed.factors).toBeNull();
    expect(parsed.type).toBe('sunset');
    expect(parsed.sunriseTime).toBeNull();
    expect(parsed.blueHour).toBeNull();
  });
});
