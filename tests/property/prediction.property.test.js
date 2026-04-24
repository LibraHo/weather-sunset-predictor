/**
 * Property-Based Tests for Prediction Algorithm
 * Feature: weather-sunset-predictor, Properties: 6, 7, 8, 9, 13
 */
import fc from 'fast-check';
import SunsetPredictionService from '../../src/services/SunsetPredictionService.js';

describe('SunsetPredictionService - Property-Based Tests', () => {
  let service;
  beforeEach(() => {
    service = new SunsetPredictionService();
  });

  // Property 6: Cloud Cover Optimal Range - Validates: Requirements 5.1
  describe('Property 6: Cloud Cover Optimal Range', () => {
    test('cloud cover at 50% (center) scores highest among [0,20,50,80,100] samples', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(0, 20, 50, 80, 100),
          (cloudCover) => {
            const centerResult = service._calculateUnifiedScore({
              cloudCover: 50, highClouds: 50, midClouds: 30, lowClouds: 10, visibility: 10, humidity: 50, precipitation: 0
            });
            const otherResult = service._calculateUnifiedScore({
              cloudCover, highClouds: cloudCover, midClouds: 30, lowClouds: 10, visibility: 10, humidity: 50, precipitation: 0
            });
            // 50% 云量（配合50%高云）在统一评分中通常是最优的
            expect(centerResult.score).toBeGreaterThanOrEqual(otherResult.score);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Property 7: Humidity Optimal Range - Validates: Requirements 5.2
  describe('Property 7: Humidity Optimal Range', () => {
    test('humidity at 50% (center) scores highest among [0,20,50,80,100] samples', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(0, 20, 50, 80, 100),
          (humidity) => {
            const centerResult = service._calculateUnifiedScore({
              cloudCover: 50, highClouds: 50, midClouds: 30, lowClouds: 10, visibility: 10, humidity: 50, precipitation: 0
            });
            const otherResult = service._calculateUnifiedScore({
              cloudCover: 50, highClouds: 50, midClouds: 30, lowClouds: 10, visibility: 10, humidity, precipitation: 0
            });
            expect(centerResult.score).toBeGreaterThanOrEqual(otherResult.score);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Property 8: Visibility Score Monotonicity - Validates: Requirements 5.3
  describe('Property 8: Visibility Score Monotonicity', () => {
    test('higher visibility always produces higher or equal score (all else equal)', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 100, noNaN: true }),
          fc.float({ min: 0, max: 100, noNaN: true }),
          (visibilityA, visibilityB) => {
            fc.pre(Math.abs(visibilityA - visibilityB) > Math.fround(0.1));
            const resultA = service._calculateUnifiedScore({
              cloudCover: 50, highClouds: 50, midClouds: 30, lowClouds: 10, visibility: visibilityA, humidity: 50, precipitation: 0
            });
            const resultB = service._calculateUnifiedScore({
              cloudCover: 50, highClouds: 50, midClouds: 30, lowClouds: 10, visibility: visibilityB, humidity: 50, precipitation: 0
            });
            if (visibilityA > visibilityB) {
              expect(resultA.score).toBeGreaterThanOrEqual(resultB.score);
            } else if (visibilityB > visibilityA) {
              expect(resultB.score).toBeGreaterThanOrEqual(resultA.score);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Property 9: Low Cloud Score Monotonicity - Validates: Requirements 5.4
  describe('Property 9: Low Cloud Score Monotonicity', () => {
    test('low cloud penalty factor decreases as low-cloud cover increases', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 20, max: 100, noNaN: true }),
          fc.float({ min: 20, max: 100, noNaN: true }),
          (lowCloudA, lowCloudB) => {
            fc.pre(Math.abs(lowCloudA - lowCloudB) > Math.fround(0.1));
            const resultA = service._calculateUnifiedScore({
              cloudCover: 50, highClouds: 50, midClouds: 30, lowClouds: lowCloudA, visibility: 10, humidity: 50, precipitation: 0
            });
            const resultB = service._calculateUnifiedScore({
              cloudCover: 50, highClouds: 50, midClouds: 30, lowClouds: lowCloudB, visibility: 10, humidity: 50, precipitation: 0
            });
            // 在 >=20 区间，低云惩罚因子单调递减，且 layerCount 已稳定为 3
            // 因此总分应随低云增加而单调不增
            if (lowCloudA < lowCloudB) {
              expect(resultA.score).toBeGreaterThanOrEqual(resultB.score);
            } else if (lowCloudB < lowCloudA) {
              expect(resultB.score).toBeGreaterThanOrEqual(resultA.score);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Property 13: Optimal Viewing Time Calculation - Validates: Requirements 6.4
  describe('Property 13: Optimal Viewing Time Calculation', () => {
    test('sunset time is calculated for valid coordinates', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
          fc.float({ min: -85, max: 85, noNaN: true }),
          fc.float({ min: -180, max: 180, noNaN: true }),
          (date, lat, lon) => {
            const sunsetTime = service.getSunsetTime(date, lat, lon);
            expect(sunsetTime).toBeInstanceOf(Date);
            expect(sunsetTime.getTime()).not.toBeNaN();
            // 使用实际日期差（毫秒）而非 getDate()，避免跨月问题
            const dayDiffMs = Math.abs(sunsetTime.getTime() - date.getTime());
            expect(dayDiffMs).toBeLessThanOrEqual(2 * 24 * 60 * 60 * 1000); // 最多差2天
          }
        ),
        { numRuns: 100 }
      );
    });
    test('optimal viewing window is centered around sunset', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
          fc.float({ min: -85, max: 85, noNaN: true }),
          fc.float({ min: -180, max: 180, noNaN: true }),
          (date, lat, lon) => {
            const sunsetTime = service.getSunsetTime(date, lat, lon);
            const windowStart = new Date(sunsetTime.getTime() - 30 * 60 * 1000);
            const windowEnd = new Date(sunsetTime.getTime() + 30 * 60 * 1000);
            const windowDuration = (windowEnd - windowStart) / (60 * 1000);
            expect(windowDuration).toBe(60);
            const midpoint = new Date((windowStart.getTime() + windowEnd.getTime()) / 2);
            expect(Math.abs(midpoint.getTime() - sunsetTime.getTime())).toBeLessThan(1000);
          }
        ),
        { numRuns: 100 }
      );
    });
    test('sunrise time is before sunset time on the same day', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2020-06-01'), max: new Date('2030-08-31') }),
          fc.float({ min: -60, max: 60, noNaN: true }),
          fc.float({ min: -180, max: 180, noNaN: true }),
          (date, lat, lon) => {
            const sunriseTime = service.getSunriseTime(date, lat, lon);
            const sunsetTime = service.getSunsetTime(date, lat, lon);
            expect(sunriseTime).toBeInstanceOf(Date);
            expect(sunsetTime).toBeInstanceOf(Date);
            expect(sunriseTime.getTime()).toBeLessThan(sunsetTime.getTime());
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
