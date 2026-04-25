import { jest } from '@jest/globals';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { OpenMeteoProvider } = require('../../../server/services/providers/OpenMeteoProvider.js');

const makeWeatherPayload = () => ({
  timezone: 'Asia/Shanghai',
  utc_offset_seconds: 28800,
  hourly: {
    time: [1700000000, 1700003600],
    temperature_2m: [20, 21],
    relative_humidity_2m: [60, 62],
    cloud_cover: [40, 42],
    cloud_cover_low: [10, 11],
    cloud_cover_mid: [20, 21],
    cloud_cover_high: [30, 31],
    wind_speed_10m: [3, 4],
    wind_direction_10m: [90, 100],
    visibility: [20000, 18000],
    precipitation: [0, 0],
    surface_pressure: [101300, 101200],
    shortwave_radiation: [100, 110],
    direct_radiation: [70, 80],
    diffuse_radiation: [30, 30],
    total_column_integrated_water_vapour: [18, 19]
  }
});

const makeAirPayload = () => ({
  hourly: {
    time: [1700000000, 1700003600],
    aerosol_optical_depth: [0.18, 0.22],
    dust: [3, 4],
    pm2_5: [12, 15],
    pm10: [24, 28],
    us_aqi: [42, 48],
    european_aqi: [30, 35]
  }
});

describe('OpenMeteoProvider air quality merge', () => {
  test('fetchWeatherData merges aerosol and particulate fields by timestamp', async () => {
    const provider = new OpenMeteoProvider();
    provider._getWithRetry = jest.fn(async (_params, _timeout, label) => {
      if (String(label).startsWith('air-quality')) return { data: makeAirPayload() };
      return { data: makeWeatherPayload() };
    });

    const result = await provider.fetchWeatherData(39.9, 116.4, 2, null, 'best_match');

    expect(result.data[0]).toMatchObject({
      aerosolOpticalDepth: 0.18,
      dust: 3,
      pm2_5: 12,
      pm10: 24,
      aqi: 42,
      usAqi: 42,
      europeanAqi: 30
    });
    expect(result.providerMeta.airQualitySource).toBe('openmeteo_air_quality');
  });

  test('fetchWeatherData degrades gracefully when air quality fails', async () => {
    const provider = new OpenMeteoProvider();
    provider._getWithRetry = jest.fn(async (_params, _timeout, label) => {
      if (String(label).startsWith('air-quality')) throw new Error('air quality timeout');
      return { data: makeWeatherPayload() };
    });

    const result = await provider.fetchWeatherData(39.9, 116.4, 2, null, 'best_match');

    expect(result.data[0].aerosolOpticalDepth).toBeUndefined();
    expect(result.providerMeta.unsupportedFields).toContain('air_quality');
    expect(result.providerMeta.degradedReason).toContain('air_quality_unavailable');
  });
});
