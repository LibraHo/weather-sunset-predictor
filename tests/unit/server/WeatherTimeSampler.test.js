import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { buildTimeWeightedWeatherSample } = require('../../../server/services/WeatherTimeSampler');

describe('WeatherTimeSampler', () => {
  test('builds a weighted weather sample from nearby hourly rows', () => {
    const referenceTime = new Date('2026-06-09T11:41:00.000Z');
    const hourly = [
      {
        timestamp: new Date('2026-06-09T09:00:00.000Z').getTime(),
        cloudCover: 58,
        lowClouds: 0,
        midClouds: 29,
        highClouds: 0,
        precipitation: 0
      },
      {
        timestamp: new Date('2026-06-09T11:00:00.000Z').getTime(),
        cloudCover: 47,
        lowClouds: 0,
        midClouds: 23,
        highClouds: 0,
        precipitation: 0
      },
      {
        timestamp: new Date('2026-06-09T12:00:00.000Z').getTime(),
        cloudCover: 9,
        lowClouds: 0,
        midClouds: 5,
        highClouds: 0,
        precipitation: 0
      }
    ];

    const sample = buildTimeWeightedWeatherSample(hourly, referenceTime);

    expect(sample.selected).toBe(hourly[2]);
    expect(sample.selectedIdx).toBe(2);
    expect(sample.weighted.cloudCover).toBeGreaterThan(9);
    expect(sample.weighted.cloudCover).toBeLessThan(47);
    expect(sample.weighted.midClouds).toBeGreaterThan(5);
    expect(sample.weighted.midClouds).toBeLessThan(23);
    expect(sample.weighted.timeWeightedSamples).toHaveLength(2);
  });

  test('falls back to no weighted sample when timestamps are unavailable', () => {
    const referenceTime = new Date('2026-06-09T11:41:00.000Z');
    const sample = buildTimeWeightedWeatherSample([{ cloudCover: 10 }, { cloudCover: 60 }], referenceTime);

    expect(sample.selected).toBe(null);
    expect(sample.weighted).toBe(null);
  });
});
