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
    test('cloud cover in 30-70% range scores higher than outside range', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 30, max: 70, noNaN: true }),
          fc.oneof(fc.float({ min: 0, max: Math.fround(29.99), noNaN: true }), fc.float({ min: Math.fround(70.01), max: 100, noNaN: true })),
          (optimalCloud, outsideCloud) => {
            fc.pre(Math.abs(optimalCloud - outsideCloud) > 5);
            const optimalScore = service.scoreCloudCover(optimalCloud);
            const outsideScore = service.scoreCloudCover(outsideCloud);
            expect(optimalScore).toBeGreaterThan(outsideScore);
          }
        ),
        { numRuns: 100 }
      );
    });
    test('cloud cover at 50% (center) scores highest', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 100, noNaN: true }),
          (cloudCover) => {
            fc.pre(Math.abs(cloudCover - 50) > 5);
            const centerScore = service.scoreCloudCover(50);
            const otherScore = service.scoreCloudCover(cloudCover);
            expect(centerScore).toBeGreaterThanOrEqual(otherScore);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
  // Property 7: Humidity Optimal Range - Validates: Requirements 5.2
  describe('Property 7: Humidity Optimal Range', () => {
    test('humidity in 30-70% range scores higher than outside range', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 30, max: 70, noNaN: true }),
          fc.oneof(fc.float({ min: 0, max: Math.fround(29.99), noNaN: true }), fc.float({ min: Math.fround(70.01), max: 100, noNaN: true })),
          (optimalHumidity, outsideHumidity) => {
            fc.pre(Math.abs(optimalHumidity - outsideHumidity) > 5);
            const optimalScore = service.scoreHumidity(optimalHumidity);
            const outsideScore = service.scoreHumidity(outsideHumidity);
            expect(optimalScore).toBeGreaterThan(outsideScore);
          }
        ),
        { numRuns: 100 }
      );
    });
    test('humidity at 50% (center) scores highest', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 100, noNaN: true }),
          (humidity) => {
            fc.pre(Math.abs(humidity - 50) > 5);
            const centerScore = service.scoreHumidity(50);
            const otherScore = service.scoreHumidity(humidity);
            expect(centerScore).toBeGreaterThanOrEqual(otherScore);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
  // Property 8: Visibility Score Monotonicity - Validates: Requirements 5.3
  describe('Property 8: Visibility Score Monotonicity', () => {
    test('higher visibility always produces higher or equal score', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 100, noNaN: true }),
          fc.float({ min: 0, max: 100, noNaN: true }),
          (visibilityA, visibilityB) => {
            fc.pre(Math.abs(visibilityA - visibilityB) > Math.fround(0.1));
            const scoreA = service.scoreVisibility(visibilityA);
            const scoreB = service.scoreVisibility(visibilityB);
            if (visibilityA > visibilityB) {
              expect(scoreA).toBeGreaterThanOrEqual(scoreB);
            } else if (visibilityB > visibilityA) {
              expect(scoreB).toBeGreaterThanOrEqual(scoreA);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
    test('visibility score is monotonically increasing', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 100, noNaN: true }),
          fc.float({ min: Math.fround(0.1), max: 10, noNaN: true }),
          (baseVisibility, increment) => {
            const lowerScore = service.scoreVisibility(baseVisibility);
            const higherScore = service.scoreVisibility(baseVisibility + increment);
            expect(higherScore).toBeGreaterThanOrEqual(lowerScore);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
  // Property 9: Low Cloud Score Monotonicity - Validates: Requirements 5.4
  describe('Property 9: Low Cloud Score Monotonicity', () => {
    test('lower low-cloud cover always produces higher or equal score', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 100, noNaN: true }),
          fc.float({ min: 0, max: 100, noNaN: true }),
          (lowCloudA, lowCloudB) => {
            fc.pre(Math.abs(lowCloudA - lowCloudB) > Math.fround(0.1));
            const scoreA = service.scoreLowClouds(lowCloudA);
            const scoreB = service.scoreLowClouds(lowCloudB);
            if (lowCloudA < lowCloudB) {
              expect(scoreA).toBeGreaterThanOrEqual(scoreB);
            } else if (lowCloudB < lowCloudA) {
              expect(scoreB).toBeGreaterThanOrEqual(scoreA);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
    test('low cloud score is monotonically decreasing with cloud cover', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 99, noNaN: true }),
          fc.float({ min: Math.fround(0.1), max: 10, noNaN: true }),
          (baseLowCloud, increment) => {
            fc.pre(baseLowCloud + increment <= 100);
            const higherScore = service.scoreLowClouds(baseLowCloud);
            const lowerScore = service.scoreLowClouds(baseLowCloud + increment);
            expect(higherScore).toBeGreaterThanOrEqual(lowerScore);
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
            const dayDiff = Math.abs(sunsetTime.getDate() - date.getDate());
            expect(dayDiff).toBeLessThanOrEqual(1);
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