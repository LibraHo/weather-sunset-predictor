/**
 * Property-Based Tests for Data Models
 * Feature: weather-sunset-predictor, Properties: 2, 10
 */
import fc from 'fast-check';
import Location from '../../src/models/Location.js';
import SunsetPrediction from '../../src/models/SunsetPrediction.js';

describe('Data Models - Property-Based Tests', () => {
  // Property 2: Location Coordinate Validity - Validates: Requirements 2.2
  describe('Property 2: Location Coordinate Validity', () => {
    test('valid coordinates pass validation', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -90, max: 90, noNaN: true }),
          fc.float({ min: -180, max: 180, noNaN: true }),
          fc.string(),
          (lat, lon, name) => {
            const location = new Location(lat, lon, name);
            expect(location.isValid()).toBe(true);
            expect(location.lat).toBe(lat);
            expect(location.lon).toBe(lon);
            expect(location.name).toBe(name);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('coordinates outside valid ranges fail validation', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -180, max: Math.fround(-90.01), noNaN: true }),
          fc.float({ min: -360, max: 360, noNaN: true }),
          (invalidLat, lon) => {
            const location = new Location(invalidLat, lon, 'Invalid');
            expect(location.isValid()).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('coordinates outside valid ranges fail validation (upper bound)', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(90.01), max: 180, noNaN: true }),
          fc.float({ min: -360, max: 360, noNaN: true }),
          (invalidLat, lon) => {
            const location = new Location(invalidLat, lon, 'Invalid');
            expect(location.isValid()).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('longitude outside valid ranges fails validation', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -90, max: 90, noNaN: true }),
          fc.oneof(
            fc.float({ min: -360, max: Math.fround(-180.01), noNaN: true }),
            fc.float({ min: Math.fround(180.01), max: 360, noNaN: true })
          ),
          (lat, invalidLon) => {
            const location = new Location(lat, invalidLon, 'Invalid');
            expect(location.isValid()).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('boundary values are valid', () => {
      const boundaryCoords = [
        [-90, -180], // Minimum latitude and longitude
        [-90, 180],
        [90, -180],
        [90, 180],  // Maximum latitude and longitude
        [0, 0],     // Equator and Prime Meridian
        [-90, 0],
        [90, 0],
        [0, -180],
        [0, 180]
      ];

      boundaryCoords.forEach(([lat, lon]) => {
        const location = new Location(lat, lon, 'Boundary');
        expect(location.isValid()).toBe(true);
      });
    });
  });

  // Property 10: Prediction Score Range and Classification Correctness - Validates: Requirements 5.5, 5.6, 5.7, 5.8
  describe('Property 10: Prediction Score Range and Classification Correctness', () => {
    test('prediction scores are always within 0-100 range', () => {
      fc.assert(
        fc.property(
          fc.date(),
          fc.float({ min: 0, max: 100, noNaN: true }),
          fc.constantFrom('excellent', 'good', 'fair'),
          fc.object(),
          fc.date(),
          (date, score, quality, factors, sunsetTime) => {
            const prediction = new SunsetPrediction(
              date,
              score,
              quality,
              factors,
              sunsetTime
            );

            expect(prediction.score).toBeGreaterThanOrEqual(0);
            expect(prediction.score).toBeLessThanOrEqual(100);
            expect(prediction.date).toEqual(date);
            expect(prediction.quality).toBe(quality);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('quality labels match score thresholds', () => {
      fc.assert(
        fc.property(
          fc.date(),
          fc.float({ min: 0, max: 100, noNaN: true }),
          fc.object(),
          fc.date(),
          (date, score, factors, sunsetTime) => {
            // Determine expected quality
            let expectedQuality;
            if (score >= 70) {
              expectedQuality = 'excellent';
            } else if (score >= 40) {
              expectedQuality = 'good';
            } else {
              expectedQuality = 'fair';
            }

            const prediction = new SunsetPrediction(
              date,
              score,
              expectedQuality,
              factors,
              sunsetTime
            );

            expect(prediction.getQualityLabel()).toBe(
              score >= 70 ? '优秀' :
              score >= 40 ? '良好' : '一般'
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    test('excellent quality requires score >= 70', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 70, max: 100, noNaN: true }),
          (score) => {
            const prediction = new SunsetPrediction(
              new Date(),
              score,
              'excellent',
              {},
              new Date()
            );

            expect(prediction.getQualityLabel()).toBe('优秀');
            expect(prediction.score).toBeGreaterThanOrEqual(70);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('good quality requires score in [40, 70)', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 40, max: Math.fround(69.99), noNaN: true }),
          (score) => {
            const prediction = new SunsetPrediction(
              new Date(),
              score,
              'good',
              {},
              new Date()
            );

            expect(prediction.getQualityLabel()).toBe('良好');
            expect(prediction.score).toBeGreaterThanOrEqual(40);
            expect(prediction.score).toBeLessThan(70);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('fair quality requires score < 40', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: Math.fround(39.99), noNaN: true }),
          (score) => {
            const prediction = new SunsetPrediction(
              new Date(),
              score,
              'fair',
              {},
              new Date()
            );

            expect(prediction.getQualityLabel()).toBe('一般');
            expect(prediction.score).toBeLessThan(40);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('optimal viewing window is 60 minutes centered on reference time', () => {
      // Use constrained dates to avoid overflow at Date epoch limits
      const safeDate = fc.date({ min: new Date('2000-01-01'), max: new Date('2100-01-01') });
      fc.assert(
        fc.property(
          safeDate,
          fc.float({ min: 0, max: 100, noNaN: true }),
          fc.object(),
          safeDate,
          fc.constantFrom('sunrise', 'sunset'),
          (date, score, factors, referenceTime, type) => {
            const prediction = new SunsetPrediction(
              date,
              score,
              'good',
              factors,
              type === 'sunset' ? referenceTime : null,
              type === 'sunrise' ? referenceTime : null,
              type
            );

            const window = prediction.getOptimalViewingWindow();
            const windowDuration = (window.end - window.start) / (60 * 1000);

            expect(windowDuration).toBe(60);

            const midpoint = new Date((window.start.getTime() + window.end.getTime()) / 2);
            const timeDiff = Math.abs(midpoint.getTime() - referenceTime.getTime());

            expect(timeDiff).toBeLessThan(1000); // Within 1 second
          }
        ),
        { numRuns: 50 }
      );
    });

    test('sun azimuth should only show when score > 70', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 100, noNaN: true }),
          fc.float({ min: 0, max: 360, noNaN: true }),
          (score, azimuth) => {
            const prediction = new SunsetPrediction(
              new Date(),
              score,
              score >= 70 ? 'excellent' : 'good',
              {},
              new Date(),
              null,
              'sunset',
              null,
              null,
              azimuth
            );

            const shouldShow = prediction.shouldShowAzimuth();

            if (score > 70) {
              expect(shouldShow).toBe(true);
            } else {
              expect(shouldShow).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
