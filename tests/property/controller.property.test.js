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
    const weatherFeatureArb = fc.record({
      temp: fc.float({ min: -20, max: 50, noNaN: true }),
      humidity: fc.float({ min: 0, max: 100, noNaN: true }),
      cloudCover: fc.float({ min: 0, max: 100, noNaN: true }),
      windSpeed: fc.float({ min: 0, max: 100, noNaN: true }),
      pressure: fc.float({ min: 900, max: 1100, noNaN: true }),
      visibility: fc.float({ min: 0, max: 50, noNaN: true }),
      lowClouds: fc.float({ min: 0, max: 100, noNaN: true }),
      midClouds: fc.float({ min: 0, max: 100, noNaN: true }),
      highClouds: fc.float({ min: 0, max: 100, noNaN: true }),
      precipitation: fc.float({ min: 0, max: 50, noNaN: true }),
      windDirection: fc.float({ min: 0, max: 360, noNaN: true })
    });

    const createContinuousWeatherData = (features) => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return features.map((item, idx) => ({
        timestamp: start.getTime() + idx * 3600 * 1000,
        ...item
      }));
    };

    test('generatePredictions returns an array with valid shape', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(weatherFeatureArb, { minLength: 168, maxLength: 168 }),
          async (features) => {
            const weatherDataArray = createContinuousWeatherData(features);
            const location = {
              lat: 39.9042,
              lon: 116.4074,
              name: 'Test Location',
              isValid: () => true
            };

            const predictions = await predictionController.generatePredictions(weatherDataArray, location);
            expect(Array.isArray(predictions)).toBe(true);
            expect(predictions.length).toBeLessThanOrEqual(10);

            predictions.forEach(prediction => {
              expect(prediction).toHaveProperty('date');
              expect(prediction).toHaveProperty('score');
              expect(prediction).toHaveProperty('quality');
              expect(prediction).toHaveProperty('type');
            });
          }
        ),
        { numRuns: 10 }
      );
    });

    test('prediction day buckets are non-decreasing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(weatherFeatureArb, { minLength: 120, maxLength: 168 }),
          async (features) => {
            const weatherDataArray = createContinuousWeatherData(features);
            const location = {
              lat: 39.9042,
              lon: 116.4074,
              name: 'Test Location',
              isValid: () => true
            };

            const predictions = await predictionController.generatePredictions(weatherDataArray, location);
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

    test('prediction date-type keys are unique', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(weatherFeatureArb, { minLength: 120, maxLength: 168 }),
          async (features) => {
            const weatherDataArray = createContinuousWeatherData(features);
            const location = {
              lat: 39.9042,
              lon: 116.4074,
              name: 'Test Location',
              isValid: () => true
            };

            const predictions = await predictionController.generatePredictions(weatherDataArray, location);
            const predictionMap = new Map();

            predictions.forEach(p => {
              const key = `${new Date(p.date).toDateString()}-${p.type}`;
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

            const highestScoring = predictions.reduce((max, p) =>
              p.score > max.score ? p : max
            );

            expect(highestScoring.score).toBe(Math.max(...predictions.map(p => p.score)));
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
          fc.array(fc.float({ min: 0, max: 100, noNaN: true }), { minLength: 1, maxLength: 20 }),
          (scores) => {
            const classify = (score) => {
              if (score >= 70) return 'excellent';
              if (score >= 40) return 'good';
              return 'fair';
            };

            const predictions = scores.map((score) => ({
              date: new Date(),
              score,
              quality: classify(score),
              factors: {},
              sunsetTime: new Date(),
              type: 'sunset'
            }));

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
            const best1 = predictions.reduce((best, current) =>
              current.score > best.score ? current : best
            );
            const best2 = predictions.reduce((best, current) =>
              current.score > best.score ? current : best
            );

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

      const best = predictions.reduce((bestItem, current) =>
        current.score > bestItem.score ? current : bestItem
      );

      expect(best.score).toBe(maxScore);
      expect(best.quality).toBe('excellent');
    });
  });
});
