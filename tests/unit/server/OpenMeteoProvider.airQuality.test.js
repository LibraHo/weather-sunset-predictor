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
    surface_pressure: [1013, 1012],
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
    expect(result.data[0].pressure).toBe(1013);
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

  test('fetchWeatherDataBatch merges aerosol fields for every grid point', async () => {
    const provider = new OpenMeteoProvider();
    const payloads = [
      makeWeatherPayload(),
      {
        ...makeWeatherPayload(),
        hourly: {
          ...makeWeatherPayload().hourly,
          cloud_cover_high: [70, 72]
        }
      }
    ];
    const airPayloads = [
      makeAirPayload(),
      {
        hourly: {
          ...makeAirPayload().hourly,
          aerosol_optical_depth: [0.58, 0.61],
          dust: [12, 14],
          pm2_5: [36, 39],
          pm10: [66, 70]
        }
      }
    ];

    provider._getWithRetry = jest.fn(async (_params, _timeout, label) => {
      if (String(label).startsWith('air-quality-batch')) {
        return { data: airPayloads };
      }
      return { data: payloads };
    });

    const result = await provider.fetchWeatherDataBatch([
      { lat: 32, lon: 119 },
      { lat: 31, lon: 118 }
    ], 2, 'best_match');

    expect(result['32,119'].data[0]).toMatchObject({
      aerosolOpticalDepth: 0.18,
      dust: 3,
      pm2_5: 12,
      pm10: 24
    });
    expect(result['31,118'].data[0]).toMatchObject({
      aerosolOpticalDepth: 0.58,
      dust: 12,
      pm2_5: 36,
      pm10: 66
    });
    expect(result['32,119'].providerMeta.airQualitySource).toBe('openmeteo_air_quality');
    expect(result['31,118'].providerMeta.airQualitySource).toBe('openmeteo_air_quality');
  });

  test('fetchWeatherDataBatch degrades every point when batch air quality fails', async () => {
    const provider = new OpenMeteoProvider();
    provider._getWithRetry = jest.fn(async (_params, _timeout, label) => {
      if (String(label).startsWith('air-quality-batch')) throw new Error('air batch timeout');
      return { data: [makeWeatherPayload(), makeWeatherPayload()] };
    });

    const result = await provider.fetchWeatherDataBatch([
      { lat: 32, lon: 119 },
      { lat: 31, lon: 118 }
    ], 2, 'best_match');

    expect(result['32,119'].data[0].aerosolOpticalDepth).toBeUndefined();
    expect(result['31,118'].data[0].aerosolOpticalDepth).toBeUndefined();
    expect(result['32,119'].providerMeta.unsupportedFields).toContain('air_quality');
    expect(result['31,118'].providerMeta.degradedReason).toContain('air_quality_unavailable');
  });

  test('fetchWeatherDataBatch can skip air quality when only cloud samples are needed', async () => {
    const provider = new OpenMeteoProvider();
    provider._getWithRetry = jest.fn(async (params, _timeout, label) => {
      if (String(label).startsWith('air-quality-batch')) throw new Error('air quality should be skipped');
      expect(params.hourly).toBe('relative_humidity_2m,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,precipitation,weather_code');
      return { data: [makeWeatherPayload(), makeWeatherPayload()] };
    });

    const result = await provider.fetchWeatherDataBatch([
      { lat: 32, lon: 119 },
      { lat: 31, lon: 118 }
    ], 2, 'best_match', { includeAirQuality: false, fields: 'lightPath' });

    expect(provider._getWithRetry).toHaveBeenCalledTimes(1);
    expect(result['32,119'].data[0].highClouds).toEqual(expect.any(Number));
    expect(result['31,118'].providerMeta.airQualitySource).toBeUndefined();
  });
});
