/**
 * Property-Based Tests for Storage Service
 * Feature: weather-sunset-predictor, Properties: 1, 16
 */
import fc from 'fast-check';
import StorageService from '../../src/services/StorageService.js';

// Mock localStorage for testing
const mockLocalStorage = {
  store: {},
  getItem: function(key) {
    return this.store[key] || null;
  },
  setItem: function(key, value) {
    this.store[key] = String(value);
  },
  removeItem: function(key) {
    delete this.store[key];
  },
  clear: function() {
    this.store = {};
  }
};

// Mock localStorage globally
global.localStorage = mockLocalStorage;

describe('StorageService - Property-Based Tests', () => {
  let service;

  beforeEach(() => {
    // Clear localStorage before each test
    mockLocalStorage.clear();
    service = new StorageService();
  });

  // Property 1: API Key Storage Round-Trip Consistency - Validates: Requirements 1.2
  describe('Property 1: API Key Storage Round-Trip Consistency', () => {
    test('saved API key can be retrieved unchanged', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 100 }),
          (apiKey) => {
            fc.pre(apiKey.trim().length > 0);

            service.saveAPIKey(apiKey);
            const retrievedKey = service.getAPIKey();

            expect(retrievedKey).toBe(apiKey);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('API key storage is idempotent', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 100 }),
          (apiKey) => {
            fc.pre(apiKey.trim().length > 0);

            service.saveAPIKey(apiKey);
            service.saveAPIKey(apiKey); // Save twice
            const retrievedKey = service.getAPIKey();

            expect(retrievedKey).toBe(apiKey);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('removing API key returns null on next retrieval', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 100 }),
          (apiKey) => {
            fc.pre(apiKey.trim().length > 0);

            service.saveAPIKey(apiKey);
            expect(service.getAPIKey()).toBe(apiKey);

            service.removeAPIKey();
            expect(service.getAPIKey()).toBeNull();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  // Property 16: Cache Expiration Behavior Correctness - Validates: Requirements 9.4, 9.5
  describe('Property 16: Cache Expiration Behavior Correctness', () => {
    test('cached data is retrievable within cache duration', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -90, max: 90, noNaN: true }),
          fc.float({ min: -180, max: 180, noNaN: true }),
          fc.array(fc.jsonValue(), { minLength: 1, maxLength: 10 }),
          (lat, lon, weatherData) => {
            const location = {
              lat,
              lon,
              name: 'Test Location',
              isValid: () => true
            };

            const currentTime = Date.now();
            service.cacheWeatherData(location, weatherData, currentTime);

            // Retrieve immediately (should be valid)
            const cachedData = service.getCachedWeatherData(location);

            expect(cachedData).not.toBeNull();
            const normalize = (value) => JSON.parse(JSON.stringify(value));
            expect(normalize(cachedData)).toEqual(normalize(weatherData));
          }
        ),
        { numRuns: 50 }
      );
    });

    test('cached data expires after cache duration', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -90, max: 90, noNaN: true }),
          fc.float({ min: -180, max: 180, noNaN: true }),
          fc.array(fc.jsonValue(), { minLength: 1, maxLength: 10 }),
          (lat, lon, weatherData) => {
            const location = {
              lat,
              lon,
              name: 'Test Location',
              isValid: () => true
            };

            const oldTimestamp = Date.now() - service.CACHE_DURATION - 1000; // 1 second past expiration
            service.cacheWeatherData(location, weatherData, oldTimestamp);

            // Try to retrieve expired data
            const cachedData = service.getCachedWeatherData(location);

            expect(cachedData).toBeNull();
          }
        ),
        { numRuns: 50 }
      );
    });

    test('cache key generation is consistent for same location', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -90, max: 90, noNaN: true }),
          fc.float({ min: -180, max: 180, noNaN: true }),
          fc.array(fc.jsonValue(), { minLength: 1, maxLength: 10 }),
          (lat, lon, weatherData) => {
            const location = {
              lat,
              lon,
              name: 'Test Location',
              isValid: () => true
            };

            service.cacheWeatherData(location, weatherData);
            const cachedData1 = service.getCachedWeatherData(location);
            const cachedData2 = service.getCachedWeatherData(location);

            // 统一 -0 / 0 表示，避免 JSON 序列化后符号位差异导致的误报
            const normalize = (value) => JSON.parse(JSON.stringify(value));

            expect(normalize(cachedData1)).toEqual(normalize(weatherData));
            expect(normalize(cachedData2)).toEqual(normalize(weatherData));
            expect(normalize(cachedData1)).toEqual(normalize(cachedData2));
          }
        ),
        { numRuns: 50 }
      );
    });

    test('cache respects location precision (4 decimal places)', () => {
      fc.assert(
        fc.property(
          // Use integer coords (in 0.01 units) to avoid float rounding edge cases
          fc.integer({ min: -9000, max: 9000 }),
          fc.integer({ min: -18000, max: 18000 }),
          (latInt, lonInt) => {
            const lat = latInt / 100; // e.g. 3912 -> 39.12
            const lon = lonInt / 100;

            const location1 = {
              lat,
              lon,
              name: 'Location 1',
              isValid: () => true
            };

            // Add tiny offset that won't change toFixed(4)
            const location2 = {
              lat: lat + 0.00001,
              lon: lon + 0.00001,
              name: 'Location 2',
              isValid: () => true
            };

            const weatherData = [{ temp: 25 }];
            service.cacheWeatherData(location1, weatherData);

            // Should retrieve same data due to rounding
            const cachedData = service.getCachedWeatherData(location2);
            expect(cachedData).not.toBeNull();
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
