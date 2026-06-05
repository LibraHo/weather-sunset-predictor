describe('WeatherTimeSampler', () => {
  let sampler;

  beforeAll(async () => {
    const mod = await import('../services/WeatherTimeSampler.js');
    sampler = mod.default || mod;
  });

  test('builds a weighted weather sample from nearby hourly rows', () => {
    const hourly = [
      { timestamp: Date.parse('2026-06-05T04:00:00Z'), highClouds: 0, midClouds: 10, lowClouds: 5 },
      { timestamp: Date.parse('2026-06-05T05:00:00Z'), highClouds: 9, midClouds: 0, lowClouds: 0 },
      { timestamp: Date.parse('2026-06-05T06:00:00Z'), highClouds: 40, midClouds: 15, lowClouds: 0 },
      { timestamp: Date.parse('2026-06-05T07:00:00Z'), highClouds: 81, midClouds: 30, lowClouds: 0 }
    ];

    const result = sampler.buildTimeWeightedWeatherSample(
      hourly,
      new Date('2026-06-05T04:47:00Z')
    );

    expect(result.selectedIdx).toBe(1);
    expect(result.weighted.highClouds).toBeGreaterThan(9);
    expect(result.weighted.highClouds).toBeLessThan(40);
    expect(result.weighted.midClouds).toBeGreaterThan(0);
    expect(result.weighted.timeWeightedSamples).toHaveLength(3);
    expect(result.weighted.timeWeightedSamples.some(sample => (
      sample.timestamp === Date.parse('2026-06-05T07:00:00Z')
    ))).toBe(false);
  });

  test('falls back to closest row when no finite timestamps are available', () => {
    const result = sampler.buildTimeWeightedWeatherSample(
      [{ highClouds: 15 }, { highClouds: 60 }],
      new Date('2026-06-05T04:47:00Z')
    );

    expect(result.selected).toBe(null);
    expect(result.weighted).toBe(null);
  });
});
