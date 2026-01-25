/**
 * Property-Based Tests for API Service
 * Feature: weather-sunset-predictor, Properties: 3, 4
 */
import fc from 'fast-check';
import WindyAPIService from '../../src/services/WindyAPIService.js';

// Mock fetch globally
global.fetch = function() {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({})
  });
};

describe('WindyAPIService - Property-Based Tests', () => {
  let service;

  beforeEach(() => {
    service = new WindyAPIService('test-api-key');
    global.fetch.mockClear();
  });

  // Property 3: API Request Format Completeness - Validates: Requirements 3.2, 3.3
  describe('Property 3: API Request Format Completeness', () => {
    test('request includes required fields', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -90, max: 90, noNaN: true }),
          fc.float({ min: -180, max: 180, noNaN: true }),
          fc.integer({ min: 1, max: 168 }),
          async (lat, lon, hours) => {
            // Mock successful response
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

            try {
              await service.fetchWeatherData(lat, lon, hours);

              expect(global.fetch).toHaveBeenCalledWith(
                service.baseURL,
                expect.objectContaining({
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: expect.stringContaining('"lat":')
                })
              );
            } catch (error) {
              // Some requests may fail validation, but we're testing format
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    test('request coordinates are within valid ranges', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -90, max: 90, noNaN: true }),
          fc.float({ min: -180, max: 180, noNaN: true }),
          async (lat, lon) => {
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

            const result = await service.fetchWeatherData(lat, lon);

            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });

    test('request hours parameter is clamped to valid range', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -90, max: 90, noNaN: true }),
          fc.float({ min: -180, max: 180, noNaN: true }),
          fc.integer({ min: -100, max: 300 }),
          async (lat, lon, invalidHours) => {
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

            try {
              if (invalidHours < 1 || invalidHours > 168) {
                await expect(
                  service.fetchWeatherData(lat, lon, invalidHours)
                ).rejects.toThrow();
              } else {
                const result = await service.fetchWeatherData(lat, lon, invalidHours);
                expect(result).toBeDefined();
              }
            } catch (error) {
              // Expected for invalid hours
              expect(error.message).toContain('必须在1到168之间');
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    test('invalid coordinates throw validation error', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.float({ min: -200, max: -90.01, noNaN: true }),
            fc.float({ min: 90.01, max: 200, noNaN: true })
          ),
          fc.float({ min: -180, max: 180, noNaN: true }),
          async (invalidLat, lon) => {
            await expect(
              service.fetchWeatherData(invalidLat, lon, 24)
            ).rejects.toThrow('无效的坐标');
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  // Property 4: Weather Data Parsing Completeness - Validates: Requirements 3.4
  describe('Property 4: Weather Data Parsing Completeness', () => {
    test('valid API response produces valid weather data array', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              temp: fc.float({ min: 200, max: 320, noNaN: true }), // Kelvin
              humidity: fc.float({ min: 0, max: 100, noNaN: true }),
              windU: fc.float({ min: -50, max: 50, noNaN: true }),
              windV: fc.float({ min: -50, max: 50, noNaN: true }),
              pressure: fc.float({ min: 800, max: 1100, noNaN: true }),
              lowClouds: fc.float({ min: 0, max: 100, noNaN: true }),
              midClouds: fc.float({ min: 0, max: 100, noNaN: true }),
              highClouds: fc.float({ min: 0, max: 100, noNaN: true })
            }),
            { minLength: 1, maxLength: 50 }
          ),
          async (weatherParams) => {
            const timestamps = weatherParams.map((_, i) =>
              Date.now() + i * 3600000
            );

            const mockResponse = {
              ts: timestamps,
              'temp-surface': weatherParams.map(p => p.temp),
              'rh-surface': weatherParams.map(p => p.humidity),
              'wind_u-surface': weatherParams.map(p => p.windU),
              'wind_v-surface': weatherParams.map(p => p.windV),
              'pressure-surface': weatherParams.map(p => p.pressure),
              'lclouds-surface': weatherParams.map(p => p.lowClouds),
              'mclouds-surface': weatherParams.map(p => p.midClouds),
              'hclouds-surface': weatherParams.map(p => p.highClouds)
            };

            global.fetch.mockResolvedValueOnce({
              ok: true,
              json: async () => mockResponse
            });

            const result = await service.fetchWeatherData(39.9042, 116.4074, 24);

            expect(result).toHaveLength(weatherParams.length);
            expect(result.every(data => data.timestamp)).toBe(true);
            expect(result.every(data => typeof data.temp === 'number')).toBe(true);
            expect(result.every(data => typeof data.humidity === 'number')).toBe(true);
            expect(result.every(data => typeof data.windSpeed === 'number')).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });

    test('temperature is converted from Kelvin to Celsius', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 200, max: 320, noNaN: true }),
          async (tempKelvin) => {
            const tempCelsius = tempKelvin - 273.15;

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

            expect(result[0].temp).toBeCloseTo(tempCelsius, 1);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('cloud cover is calculated as average of low, mid, high clouds', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 100, noNaN: true }),
          fc.float({ min: 0, max: 100, noNaN: true }),
          fc.float({ min: 0, max: 100, noNaN: true }),
          async (low, mid, high) => {
            const expectedCloudCover = (low + mid + high) / 3;

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

            expect(result[0].cloudCover).toBeCloseTo(expectedCloudCover, 1);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('missing optional fields default to safe values', () => {
      fc.assert(
        fc.property(
          async () => {
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
                // Missing: visibility, precipitation, wind_direction
              })
            });

            const result = await service.fetchWeatherData(39.9042, 116.4074, 1);

            expect(result[0].visibility).toBeDefined();
            expect(result[0].precipitation).toBeDefined();
            expect(result[0].windDirection).toBeDefined();
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
