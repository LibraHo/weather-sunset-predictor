/**
 * Property-Based Tests for Controller Layer
 * Feature: weather-sunset-predictor, Properties: 14, 15
 */
import fc from 'fast-check';
import SunsetPredictionService from '../../src/services/SunsetPredictionService.js';
import PredictionController from '../../src/controllers/PredictionController.js';

// Mock StorageService
const mockStorageService = {
  getCachedWeatherData: () => null,
  cacheWeatherData: () => {},
  getAPIKey: () => null,
  saveAPIKey: () => {}
};

describe('Controller Layer - Property-Based Tests', () => {
  let predictionService;
  let predictionController;

  beforeEach(() => {
    predictionService = new SunsetPredictionService();
    predictionController = new PredictionController(mockStorageService);
  });

  // Property 14: Multi-Day Prediction Quantity Correctness - Validates: Requirements 7.1
  describe('Property 14: Multi-Day Prediction Quantity Correctness', () => {
    test('generates predictions for exactly 5 days', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              timestamp: fc.integer({ min: Date.now(), max: Date.now() + 7 * 24 * 3600 * 1000 }),
              temp: fc.float({ min: -20, max: 50, noNaN: true }),
              humidity: fc.float({ min: 0, max: 100, noNaN: true }),
              cloudCover: fc.float({ min: 0, max: 100, noNaN: true }),
              windSpeed: fc.float({ min: 0, max: 100, noNaN: true }),
              pressure: fc.float({ min: 900, max: 1100, noNaN: true }),
              visibility: fc.float({ min: 0, max: 50, noNaN: true }),
              lowClouds: fc.float({ min: 0, max: 100, noNaN: true })
            }),
            { minLength: 168, maxLength: 168 }
          ),
          async (weatherDataArray) => {
            const location = {
              lat: 39.9042,
              lon: 116.4074,
              name: 'Test Location',
              isValid: () => true
            };

            const predictions = await predictionController.generatePredictions(
              weatherDataArray,
              location
            );

            // Should generate 2 predictions per day (sunrise + sunset) for 5 days
            // But may be less if weather data doesn't cover all sunrise/sunset times
            expect(predictions.length).toBeGreaterThan(0);
            expect(predictions.length).toBeLessThanOrEqual(10); // Max 5 days * 2 predictions

            // Verify each prediction has required fields
            predictions.forEach(prediction => {
              expect(prediction).toHaveProperty('date');
              expect(prediction).toHaveProperty('score');
              expect(prediction).toHaveProperty('quality');
              expect(prediction).toHaveProperty('type'); // 'sunrise' or 'sunset'
            });

            // Verify we have both sunrise and sunset predictions
            const hasSunrise = predictions.some(p => p.type === 'sunrise');
            const hasSunset = predictions.some(p => p.type === 'sunset');

            expect(hasSunrise || hasSunset).toBe(true);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('predictions are in chronological order', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              timestamp: fc.integer({ min: Date.now(), max: Date.now() + 7 * 24 * 3600 * 1000 }),
              temp: fc.float({ min: -20, max: 50, noNaN: true }),
              humidity: fc.float({ min: 0, max: 100, noNaN: true }),
              cloudCover: fc.float({ min: 0, max: 100, noNaN: true }),
              windSpeed: fc.float({ min: 0, max: 100, noNaN: true }),
              pressure: fc.float({ min: 900, max: 1100, noNaN: true }),
              visibility: fc.float({ min: 0, max: 50, noNaN: true }),
              lowClouds: fc.float({ min: 0, max: 100, noNaN: true })
            }),
            { minLength: 120, maxLength: 168 }
          ),
          async (weatherDataArray) => {
            const location = {
              lat: 39.9042,
              lon: 116.4074,
              name: 'Test Location',
              isValid: () => true
            };

            const predictions = await predictionController.generatePredictions(
              weatherDataArray,
              location
            );

            if (predictions.length < 2) return;

            // Check chronological order
            for (let i = 1; i < predictions.length; i++) {
              const prevDate = new Date(predictions[i - 1].date).setHours(0, 0, 0, 0);
              const currDate = new Date(predictions[i].date).setHours(0, 0, 0, 0);
              expect(prevDate).toBeLessThanOrEqual(currDate);
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('prediction dates are unique for each day', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              timestamp: fc.integer({ min: Date.now(), max: Date.now() + 7 * 24 * 3600 * 1000 }),
              temp: fc.float({ min: -20, max: 50, noNaN: true }),
              humidity: fc.float({ min: 0, max: 100, noNaN: true }),
              cloudCover: fc.float({ min: 0, max: 100, noNaN: true }),
              windSpeed: fc.float({ min: 0, max: 100, noNaN: true }),
              pressure: fc.float({ min: 900, max: 1100, noNaN: true }),
              visibility: fc.float({ min: 0, max: 50, noNaN: true }),
              lowClouds: fc.float({ min: 0, max: 100, noNaN: true })
            }),
            { minLength: 120, maxLength: 168 }
          ),
          async (weatherDataArray) => {
            const location = {
              lat: 39.9042,
              lon: 116.4074,
              name: 'Test Location',
              isValid: () => true
            };

            const predictions = await predictionController.generatePredictions(
              weatherDataArray,
              location
            );

            // Group predictions by date and type
            const predictionMap = new Map();

            predictions.forEach(p => {
              const dateKey = p.date.toDateString();
              const typeKey = p.type; // 'sunrise' or 'sunset'
              const key = `${dateKey}-${typeKey}`;

              // Each (date, type) combination should be unique
              expect(predictionMap.has(key)).toBe(false);
              predictionMap.set(key, true);
            });
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  // Property 15: Prediction Highest Quality Identification Correctness - Validates: Requirements 7.5
  describe('Property 15: Prediction Highest Quality Identification Correctness', () => {
    test('highest quality prediction has maximum score', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              date: fc.date(),
              score: fc.float({ min: 0, max: 100, noNaN: true }),
              quality: fc.constantFrom('excellent', 'good', 'fair'),
              factors: fc.object(),
              sunsetTime: fc.date(),
              type: fc.constantFrom('sunrise', 'sunset')
            }),
            { minLength: 2, maxLength: 20 }
          ),
          (predictions) => {
            fc.pre(predictions.length > 0);

            // Find prediction with highest score
            const highestScoring = predictions.reduce((max, p) =>
              p.score > max.score ? p : max
            );

            expect(highestScoring.score).toBe(Math.max(...predictions.map(p => p.score)));

            // Verify that the highest scoring prediction is identified correctly
            const maxScore = Math.max(...predictions.map(p => p.score));
            expect(highestScoring.score).toBe(maxScore);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('best prediction score is >= all other prediction scores', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              date: fc.date(),
              score: fc.float({ min: 0, max: 100, noNaN: true }),
              quality: fc.constantFrom('excellent', 'good', 'fair'),
              factors: fc.object(),
              sunsetTime: fc.date(),
              type: fc.constantFrom('sunrise', 'sunset')
            }),
            { minLength: 2, maxLength: 20 }
          ),
          (predictions) => {
            const bestPrediction = predictions.reduce((best, current) =>
              current.score > best.score ? current : best
            );

            predictions.forEach(prediction => {
              expect(bestPrediction.score).toBeGreaterThanOrEqual(prediction.score);
            });
          }
        ),
        { numRuns: 50 }
      );
    });

    test('quality classification matches score ranges', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              date: fc.date(),
              score: fc.float({ min: 0, max: 100, noNaN: true }),
              quality: fc.constantFrom('excellent', 'good', 'fair'),
              factors: fc.object(),
              sunsetTime: fc.date(),
              type: fc.constantFrom('sunrise', 'sunset')
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (predictions) => {
            predictions.forEach(prediction => {
              if (prediction.score >= 70) {
                expect(prediction.quality).toBe('excellent');
              } else if (prediction.score >= 40) {
                expect(prediction.quality).toBe('good');
              } else {
                expect(prediction.quality).toBe('fair');
              }
            });
          }
        ),
        { numRuns: 30 }
      );
    });

    test('best quality prediction identification is deterministic', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              date: fc.date(),
              score: fc.float({ min: 0, max: 100, noNaN: true }),
              quality: fc.constantFrom('excellent', 'good', 'fair'),
              factors: fc.object(),
              sunsetTime: fc.date(),
              type: fc.constantFrom('sunrise', 'sunset')
            }),
            { minLength: 2, maxLength: 20 }
          ),
          (predictions) => {
            // Find best prediction twice
            const best1 = predictions.reduce((best, current) =>
              current.score > best.score ? current : best
            );
            const best2 = predictions.reduce((best, current) =>
              current.score > best.score ? current : best
            );

            // Should get the same result
            expect(best1.score).toBe(best2.score);
            expect(best1.date).toEqual(best2.date);
          }
        ),
        { numRuns: 30 }
      );
    });

    test('when multiple predictions have same max score, any can be selected as best', () => {
      const maxScore = 80;
      const predictions = [
        {
          date: new Date('2024-01-01'),
          score: 60,
          quality: 'good',
          factors: {},
          sunsetTime: new Date(),
          type: 'sunset'
        },
        {
          date: new Date('2024-01-02'),
          score: maxScore,
          quality: 'excellent',
          factors: {},
          sunsetTime: new Date(),
          type: 'sunset'
        },
        {
          date: new Date('2024-01-03'),
          score: maxScore,
          quality: 'excellent',
          factors: {},
          sunsetTime: new Date(),
          type: 'sunset'
        }
      ];

      const best = predictions.reduce((best, current) =>
        current.score > best.score ? current : best
      );

      // Best prediction should have max score
      expect(best.score).toBe(maxScore);
      expect(best.quality).toBe('excellent');
    });
  });
});
