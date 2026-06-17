describe('WeatherTimeSampler', () => {
  let sampler;

  beforeAll(async () => {
    const mod = await import('../services/WeatherTimeSampler.js');
    sampler = mod.default || mod;
  });

  test('builds a weighted weather sample from the two bounding hourly rows', () => {
    const hourly = [
      { timestamp: Date.parse('2026-06-05T18:00:00Z'), highClouds: 10, midClouds: 20, lowClouds: 5 },
      { timestamp: Date.parse('2026-06-05T19:00:00Z'), highClouds: 40, midClouds: 60, lowClouds: 0 },
      { timestamp: Date.parse('2026-06-05T20:00:00Z'), highClouds: 80, midClouds: 20, lowClouds: 0 },
      { timestamp: Date.parse('2026-06-05T21:00:00Z'), highClouds: 100, midClouds: 80, lowClouds: 0 }
    ];

    const result = sampler.buildTimeWeightedWeatherSample(
      hourly,
      new Date('2026-06-05T19:15:00Z')
    );

    expect(result.selectedIdx).toBe(1);
    expect(result.weighted.highClouds).toBe(50);
    expect(result.weighted.midClouds).toBe(50);
    expect(result.weighted.timeWeightedSamples).toEqual([
      { timestamp: Date.parse('2026-06-05T19:00:00Z'), weight: 0.75 },
      { timestamp: Date.parse('2026-06-05T20:00:00Z'), weight: 0.25 }
    ]);
    expect(result.weighted.timeWeightedSamples.some(sample => (
      sample.timestamp === Date.parse('2026-06-05T21:00:00Z')
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
