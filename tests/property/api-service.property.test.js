/**
 * Property-Based Tests for API Service
 * Feature: weather-sunset-predictor, Properties: 3, 4
 */
import fc from 'fast-check';
import { jest } from '@jest/globals';
import WindyAPIService from '../../src/services/WindyAPIService.js';

// Mock fetch globally
global.fetch = jest.fn(() => Promise.resolve({
  ok: true,
  json: () => Promise.resolve({})
}));

describe('WindyAPIService - Property-Based Tests', () => {
  let service;

  beforeEach(() => {
    service = new WindyAPIService('test-api-key');
    global.fetch.mockClear();
  });

  // Property 3: API Request Format Completeness - Validates: Requirements 3.2, 3.3
  describe('Property 3: API Request Format Completeness', () => {
    test('request includes required fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.float({ min: -90, max: 90, noNaN: true }),
          fc.float({ min: -180, max: 180, noNaN: true }),
          fc.integer({ min: 1, max: 168 }),
          async (lat, lon, hours) => {
            global.fetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                ts: [Date.now()],
                'temp-surface': [283.15],
                'rh-surface': [50],
                'wind_u-surface': [5],
                'wind_v-surface': [3],
                'pressure-surface': [1013],
                'lclouds-surface': [30],
                'mclouds-surface': [20],
                'hclouds-surface': [10]
              })
            });

            await service.fetchWeatherData(lat, lon, hours);

            expect(global.fetch).toHaveBeenCalledWith(
              service.baseURL,
              expect.objectContaining({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: expect.stringContaining('"lat"')
              })
            );
          }
        ),
        { numRuns: 20 }
      );
    });

    test('request hours parameter is validated in valid range', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.float({ min: -90, max: 90, noNaN: true }),
          fc.float({ min: -180, max: 180, noNaN: true }),
          fc.integer({ min: -100, max: 300 }),
          async (lat, lon, hours) => {
            global.fetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                ts: [Date.now()],
                'temp-surface': [283.15],
                'rh-surface': [50],
                'wind_u-surface': [5],
                'wind_v-surface': [3],
                'pressure-surface': [1013],
                'lclouds-surface': [30],
                'mclouds-surface': [20],
                'hclouds-surface': [10]
              })
            });

            if (hours < 1 || hours > 168) {
              await expect(service.fetchWeatherData(lat, lon, hours)).rejects.toThrow('必须在1到168之间');
            } else {
              await expect(service.fetchWeatherData(lat, lon, hours)).resolves.toBeDefined();
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    test('invalid coordinates throw validation error', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.double({ min: -200, max: -90.1, noNaN: true, noDefaultInfinity: true }),
            fc.double({ min: 90.1, max: 200, noNaN: true, noDefaultInfinity: true })
          ),
          fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
          async (invalidLat, lon) => {
            await expect(service.fetchWeatherData(invalidLat, lon, 24)).rejects.toThrow('无效的坐标');
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  // Property 4: Weather Data Parsing Completeness - Validates: Requirements 3.4
  describe('Property 4: Weather Data Parsing Completeness', () => {
    test('valid API response produces valid weather data array', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              temp: fc.double({ min: 273.15, max: 320, noNaN: true, noDefaultInfinity: true }),
              humidity: fc.float({ min: 0, max: 100, noNaN: true }),
              windU: fc.float({ min: -50, max: 50, noNaN: true }),
              windV: fc.float({ min: -50, max: 50, noNaN: true }),
              pressure: fc.float({ min: 900, max: 1100, noNaN: true }),
              lowClouds: fc.float({ min: 0, max: 100, noNaN: true }),
              midClouds: fc.float({ min: 0, max: 100, noNaN: true }),
              highClouds: fc.float({ min: 0, max: 100, noNaN: true })
            }),
            { minLength: 1, maxLength: 24 }
          ),
          async (weatherParams) => {
            const timestamps = weatherParams.map((_, i) => Date.now() + i * 3600000);
            global.fetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                ts: timestamps,
                'temp-surface': weatherParams.map(p => p.temp),
                'rh-surface': weatherParams.map(p => p.humidity),
                'wind_u-surface': weatherParams.map(p => p.windU),
                'wind_v-surface': weatherParams.map(p => p.windV),
                'pressure-surface': weatherParams.map(p => p.pressure),
                'lclouds-surface': weatherParams.map(p => p.lowClouds),
                'mclouds-surface': weatherParams.map(p => p.midClouds),
                'hclouds-surface': weatherParams.map(p => p.highClouds)
              })
            });

            const result = await service.fetchWeatherData(39.9042, 116.4074, 24);
            expect(result).toHaveLength(weatherParams.length);
            expect(result.every(data => data && typeof data.temp === 'number')).toBe(true);
            expect(result.every(data => data.isValid())).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });

    test('temperature is converted from Kelvin to Celsius', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.double({ min: 273.15, max: 320, noNaN: true, noDefaultInfinity: true }),
          async (tempKelvin) => {
            global.fetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                ts: [Date.now()],
                'temp-surface': [tempKelvin],
                'rh-surface': [50],
                'wind_u-surface': [5],
                'wind_v-surface': [3],
                'pressure-surface': [1013],
                'lclouds-surface': [30],
                'mclouds-surface': [20],
                'hclouds-surface': [10]
              })
            });

            const result = await service.fetchWeatherData(39.9042, 116.4074, 1);
            expect(result[0].temp).toBeCloseTo(tempKelvin - 273.15, 1);
          }
        ),
        { numRuns: 30 }
      );
    });

    test('cloud cover is calculated as average of low, mid, high clouds', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.float({ min: 0, max: 100, noNaN: true }),
          fc.float({ min: 0, max: 100, noNaN: true }),
          fc.float({ min: 0, max: 100, noNaN: true }),
          async (low, mid, high) => {
            global.fetch.mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                ts: [Date.now()],
                'temp-surface': [283.15],
                'rh-surface': [50],
                'wind_u-surface': [5],
                'wind_v-surface': [3],
                'pressure-surface': [1013],
                'lclouds-surface': [low],
                'mclouds-surface': [mid],
                'hclouds-surface': [high]
              })
            });

            const result = await service.fetchWeatherData(39.9042, 116.4074, 1);
            expect(result[0].cloudCover).toBeCloseTo((low + mid + high) / 3, 1);
          }
        ),
        { numRuns: 30 }
      );
    });

    test('missing optional fields default to safe values', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ts: [Date.now()],
          'temp-surface': [283.15],
          'rh-surface': [50],
          'wind_u-surface': [5],
          'wind_v-surface': [3],
          'pressure-surface': [1013],
          'lclouds-surface': [30],
          'mclouds-surface': [20],
          'hclouds-surface': [10]
        })
      });

      const result = await service.fetchWeatherData(39.9042, 116.4074, 1);
      expect(result[0].visibility).toBeDefined();
      expect(result[0].precipitation).toBeDefined();
      expect(result[0].windDirection).toBeDefined();
    });
  });
});
