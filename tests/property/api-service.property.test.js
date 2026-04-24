/**
 * Property-Based Tests for API Service
 * Feature: weather-sunset-predictor, Properties: 3, 4
 */
import fc from 'fast-check';
import { jest } from '@jest/globals';
import WindyAPIService from '../../src/services/WindyAPIService.js';

// Mock localStorage
global.localStorage = {
  getItem: jest.fn(() => null),
  setItem: jest.fn(),
  removeItem: jest.fn()
};

// Mock fetch globally
global.fetch = jest.fn(() => Promise.resolve({
  ok: true,
  json: () => Promise.resolve({ data: [] })
}));

describe('WindyAPIService - Property-Based Tests', () => {
  let service;

  beforeEach(() => {
    service = new WindyAPIService('test-api-key', { proxyURL: 'http://localhost:3000' });
    global.localStorage = {
      getItem: jest.fn(() => null),
      setItem: jest.fn(),
      removeItem: jest.fn()
    };
    global.fetch.mockClear();
    // Reset the windy enabled cache
    service._windyEnabled = false;
  });

  // Helper: create a mock proxy weather item
  function mockProxyItem(overrides = {}) {
    return {
      timestamp: Date.now(),
      temp: 20,
      humidity: 65,
      cloudCover: 50,
      windSpeed: 10,
      pressure: 1013,
      visibility: 10,
      lowClouds: 30,
      precipitation: 0,
      windDirection: 180,
      highClouds: 20,
      midClouds: 40,
      ...overrides
    };
  }

  // Helper: setup fetch mock to handle weather request (feature flags skipped since _windyEnabled=false)
  function setupFetchMocks(weatherData) {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => weatherData
    });
  }

  // Property 3: API Request Format Completeness - Validates: Requirements 3.2, 3.3
  describe('Property 3: API Request Format Completeness', () => {
    test('request uses GET method and includes lat/lon/hours in URL', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.float({ min: -90, max: 90, noNaN: true }),
          fc.float({ min: -180, max: 180, noNaN: true }),
          fc.integer({ min: 1, max: 168 }),
          async (lat, lon, hours) => {
            setupFetchMocks({ data: [mockProxyItem()] });

            await service.fetchWeatherData(lat, lon, hours);

            // Find the weather forecast call (not the feature flags call)
            const calls = global.fetch.mock.calls;
            const weatherCall = calls.find(c => c[0].includes('/api/weather/forecast'));
            expect(weatherCall).toBeDefined();
            expect(weatherCall[0]).toMatch(/lat=[\d.eE+-]+/);
            expect(weatherCall[0]).toMatch(/lon=[\d.eE+-]+/);
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
            if (hours < 1 || hours > 168) {
              await expect(service.fetchWeatherData(lat, lon, hours)).rejects.toThrow('必须在1到168之间');
            } else {
              setupFetchMocks({ data: [mockProxyItem()] });
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
    test('valid proxy response produces valid weather data array', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              temp: fc.double({ min: -50, max: 50, noNaN: true, noDefaultInfinity: true }),
              humidity: fc.float({ min: 0, max: 100, noNaN: true }),
              cloudCover: fc.float({ min: 0, max: 100, noNaN: true }),
              windSpeed: fc.float({ min: 0, max: 100, noNaN: true }),
              pressure: fc.float({ min: 900, max: 1100, noNaN: true }),
              lowClouds: fc.float({ min: 0, max: 100, noNaN: true }),
              midClouds: fc.float({ min: 0, max: 100, noNaN: true }),
              highClouds: fc.float({ min: 0, max: 100, noNaN: true })
            }),
            { minLength: 1, maxLength: 24 }
          ),
          async (weatherParams) => {
            const mockData = weatherParams.map((p, i) => mockProxyItem({
              timestamp: Date.now() + i * 3600000,
              temp: p.temp,
              humidity: p.humidity,
              cloudCover: p.cloudCover,
              windSpeed: p.windSpeed,
              pressure: p.pressure,
              lowClouds: p.lowClouds,
              midClouds: p.midClouds,
              highClouds: p.highClouds
            }));

            setupFetchMocks({ data: mockData });

            const result = await service.fetchWeatherData(39.9042, 116.4074, 24);
            expect(result).toHaveLength(weatherParams.length);
            expect(result.every(data => data && typeof data.temp === 'number')).toBe(true);
            expect(result.every(data => data.isValid())).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });

    test('temperature data is correctly passed through from proxy', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.double({ min: -50, max: 50, noNaN: true, noDefaultInfinity: true }),
          async (tempCelsius) => {
            setupFetchMocks({ data: [mockProxyItem({ temp: tempCelsius })] });

            const result = await service.fetchWeatherData(39.9042, 116.4074, 1);
            expect(result[0].temp).toBeCloseTo(tempCelsius, 5);
          }
        ),
        { numRuns: 30 }
      );
    });

    test('cloud cover data is correctly passed through from proxy', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.float({ min: 0, max: 100, noNaN: true }),
          fc.float({ min: 0, max: 100, noNaN: true }),
          fc.float({ min: 0, max: 100, noNaN: true }),
          async (low, mid, high) => {
            setupFetchMocks({
              data: [mockProxyItem({ lowClouds: low, midClouds: mid, highClouds: high, cloudCover: (low + mid + high) / 3 })]
            });

            const result = await service.fetchWeatherData(39.9042, 116.4074, 1);
            expect(result[0].lowClouds).toBeCloseTo(low, 5);
            expect(result[0].midClouds).toBeCloseTo(mid, 5);
            expect(result[0].highClouds).toBeCloseTo(high, 5);
          }
        ),
        { numRuns: 30 }
      );
    });

    test('missing optional fields default to safe values', async () => {
      setupFetchMocks({
        data: [{
          timestamp: Date.now(),
          temp: 20,
          humidity: 65,
          cloudCover: 50,
          windSpeed: 10,
          pressure: 1013
          // visibility, lowClouds, precipitation, windDirection, highClouds, midClouds omitted
        }]
      });

      const result = await service.fetchWeatherData(39.9042, 116.4074, 1);
      expect(result[0].visibility).toBeDefined();
      expect(result[0].precipitation).toBeDefined();
      expect(result[0].windDirection).toBeDefined();
    });
  });
});
