import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { buildTimeWeightedWeatherSample, selectHourlyAt, toEpochMs } = require('../../../server/services/WeatherTimeSampler');

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
      },
      {
        timestamp: new Date('2026-06-09T13:00:00.000Z').getTime(),
        cloudCover: 100,
        lowClouds: 100,
        midClouds: 100,
        highClouds: 100,
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
    expect(sample.weighted.timeWeightedSamples).toEqual([
      {
        timestamp: new Date('2026-06-09T11:00:00.000Z').getTime(),
        weight: 0.317
      },
      {
        timestamp: new Date('2026-06-09T12:00:00.000Z').getTime(),
        weight: 0.683
      }
    ]);
  });

  test('uses only the two adjacent hourly rows around sunset time', () => {
    const referenceTime = new Date('2026-06-10T11:41:00.000Z');
    const hourly = [
      {
        timestamp: new Date('2026-06-10T10:00:00.000Z').getTime(),
        cloudCover: 0,
        highClouds: 0
      },
      {
        timestamp: new Date('2026-06-10T11:00:00.000Z').getTime(),
        cloudCover: 60,
        highClouds: 80
      },
      {
        timestamp: new Date('2026-06-10T12:00:00.000Z').getTime(),
        cloudCover: 90,
        highClouds: 100
      },
      {
        timestamp: new Date('2026-06-10T13:00:00.000Z').getTime(),
        cloudCover: 10,
        highClouds: 10
      }
    ];

    const sample = buildTimeWeightedWeatherSample(hourly, referenceTime);

    expect(sample.weighted.timeWeightedSamples).toEqual([
      {
        timestamp: new Date('2026-06-10T11:00:00.000Z').getTime(),
        weight: 0.317
      },
      {
        timestamp: new Date('2026-06-10T12:00:00.000Z').getTime(),
        weight: 0.683
      }
    ]);
    expect(sample.weighted.highClouds).toBe(93.667);
  });

  test('falls back to no weighted sample when timestamps are unavailable', () => {
    const referenceTime = new Date('2026-06-09T11:41:00.000Z');
    const sample = buildTimeWeightedWeatherSample([{ cloudCover: 10 }, { cloudCover: 60 }], referenceTime);

    expect(sample.selected).toBe(null);
    expect(sample.weighted).toBe(null);
  });

  test('parses epoch timestamp strings before Date strings', () => {
    const beforeTs = new Date('2026-06-10T11:00:00.000Z').getTime();
    const afterTs = new Date('2026-06-10T12:00:00.000Z').getTime();
    const referenceTime = new Date('2026-06-10T11:41:00.000Z');
    const hourly = [
      { timestamp: String(beforeTs), cloudCover: 60 },
      { timestamp: String(afterTs), cloudCover: 90 }
    ];

    expect(toEpochMs(String(beforeTs))).toBe(beforeTs);
    expect(selectHourlyAt(hourly, referenceTime).selected).toBe(hourly[1]);
    expect(buildTimeWeightedWeatherSample(hourly, referenceTime).weighted.cloudCover).toBe(80.5);
  });

  test('ignores null optional metrics instead of averaging them as zero', () => {
    const referenceTime = new Date('2026-06-10T11:30:00.000Z');
    const hourly = [
      {
        timestamp: new Date('2026-06-10T11:00:00.000Z').getTime(),
        cloudCover: 40,
        pressure: null,
        directRadiation: null,
        aerosolOpticalDepth: 0.4
      },
      {
        timestamp: new Date('2026-06-10T12:00:00.000Z').getTime(),
        cloudCover: 80,
        pressure: 1008,
        directRadiation: 120,
        aerosolOpticalDepth: null
      }
    ];

    const sample = buildTimeWeightedWeatherSample(hourly, referenceTime);

    expect(sample.weighted.cloudCover).toBe(60);
    expect(sample.weighted.pressure).toBe(1008);
    expect(sample.weighted.directRadiation).toBe(120);
    expect(sample.weighted.aerosolOpticalDepth).toBe(0.4);
  });
});
