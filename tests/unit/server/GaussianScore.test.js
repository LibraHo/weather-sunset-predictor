/**
 * GaussianScore 单元测试
 *
 * 测试高斯评分函数工具的各项功能
 *
 * 需求：22.3, 26.1.7
 */

// 使用动态 import 加载 CommonJS 模块
let GaussianScore;

beforeAll(async () => {
  GaussianScore = await import('../../../server/utils/GaussianScore.js');
});

describe('GaussianScore', () => {
  describe('gaussian', () => {
    it('should return amplitude at mean value', () => {
      const result = GaussianScore.gaussian(50, 50, 20, 100);
      expect(result).toBeCloseTo(100, 5);
    });

    it('should return lower values away from mean', () => {
      const atMean = GaussianScore.gaussian(50, 50, 20, 100);
      const awayFromMean = GaussianScore.gaussian(70, 50, 20, 100);
      expect(awayFromMean).toBeLessThan(atMean);
    });

    it('should be symmetric around mean', () => {
      const below = GaussianScore.gaussian(30, 50, 20, 100);
      const above = GaussianScore.gaussian(70, 50, 20, 100);
      expect(below).toBeCloseTo(above, 5);
    });

    it('should use default amplitude of 100', () => {
      const result = GaussianScore.gaussian(50, 50, 20);
      expect(result).toBeCloseTo(100, 5);
    });
  });

  describe('scoreCloudCover', () => {
    it('should return maximum score at optimal value (50%)', () => {
      const score = GaussianScore.scoreCloudCover(50);
      expect(score).toBeCloseTo(100, 0);
    });

    it('should return high scores in optimal range (30-70%)', () => {
      const score30 = GaussianScore.scoreCloudCover(30);
      const score70 = GaussianScore.scoreCloudCover(70);
      expect(score30).toBeGreaterThan(50);
      expect(score70).toBeGreaterThan(50);
    });

    it('should return low scores at extremes', () => {
      const score0 = GaussianScore.scoreCloudCover(0);
      const score100 = GaussianScore.scoreCloudCover(100);
      expect(score0).toBeLessThan(20);
      expect(score100).toBeLessThan(20);
    });

    it('should return 0 for invalid inputs', () => {
      expect(GaussianScore.scoreCloudCover(-1)).toBe(0);
      expect(GaussianScore.scoreCloudCover(101)).toBe(0);
      expect(GaussianScore.scoreCloudCover('invalid')).toBe(0);
      expect(GaussianScore.scoreCloudCover(null)).toBe(0);
    });

    it('should return scores in 0-100 range', () => {
      for (let i = 0; i <= 100; i += 10) {
        const score = GaussianScore.scoreCloudCover(i);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('scoreHumidity', () => {
    it('should return maximum score at optimal value (50%)', () => {
      const score = GaussianScore.scoreHumidity(50);
      expect(score).toBeCloseTo(100, 0);
    });

    it('should return high scores in optimal range (30-70%)', () => {
      const score40 = GaussianScore.scoreHumidity(40);
      const score60 = GaussianScore.scoreHumidity(60);
      expect(score40).toBeGreaterThan(70);
      expect(score60).toBeGreaterThan(70);
    });

    it('should return low scores at extremes', () => {
      const score0 = GaussianScore.scoreHumidity(0);
      const score100 = GaussianScore.scoreHumidity(100);
      expect(score0).toBeLessThan(20);
      expect(score100).toBeLessThan(20);
    });

    it('should return 0 for invalid inputs', () => {
      expect(GaussianScore.scoreHumidity(-1)).toBe(0);
      expect(GaussianScore.scoreHumidity(101)).toBe(0);
      expect(GaussianScore.scoreHumidity(undefined)).toBe(0);
    });
  });

  describe('scoreVisibility', () => {
    it('should return 0 for visibility 0', () => {
      expect(GaussianScore.scoreVisibility(0)).toBe(0);
    });

    it('should return increasing scores for higher visibility', () => {
      const score5 = GaussianScore.scoreVisibility(5);
      const score10 = GaussianScore.scoreVisibility(10);
      const score20 = GaussianScore.scoreVisibility(20);
      const score30 = GaussianScore.scoreVisibility(30);

      expect(score10).toBeGreaterThan(score5);
      expect(score20).toBeGreaterThan(score10);
      expect(score30).toBeGreaterThan(score20);
    });

    it('should approach 100 for very high visibility', () => {
      const score50 = GaussianScore.scoreVisibility(50);
      expect(score50).toBeGreaterThan(90);
    });

    it('should return 0 for invalid inputs', () => {
      expect(GaussianScore.scoreVisibility(-1)).toBe(0);
      expect(GaussianScore.scoreVisibility('invalid')).toBe(0);
    });

    it('should return approximately 49 for 10km visibility', () => {
      const score = GaussianScore.scoreVisibility(10);
      expect(score).toBeCloseTo(49, 0);
    });
  });

  describe('scoreLowClouds', () => {
    it('should return 100 for 0% low clouds', () => {
      const score = GaussianScore.scoreLowClouds(0);
      expect(score).toBeCloseTo(100, 0);
    });

    it('should return decreasing scores for more low clouds', () => {
      const score0 = GaussianScore.scoreLowClouds(0);
      const score20 = GaussianScore.scoreLowClouds(20);
      const score50 = GaussianScore.scoreLowClouds(50);
      const score100 = GaussianScore.scoreLowClouds(100);

      expect(score20).toBeLessThan(score0);
      expect(score50).toBeLessThan(score20);
      expect(score100).toBeLessThan(score50);
    });

    it('should return very low score for 100% low clouds', () => {
      const score = GaussianScore.scoreLowClouds(100);
      expect(score).toBeLessThan(2);
    });

    it('should return 0 for invalid inputs', () => {
      expect(GaussianScore.scoreLowClouds(-1)).toBe(0);
      expect(GaussianScore.scoreLowClouds(101)).toBe(0);
    });
  });

  describe('calculateWeightedScore', () => {
    it('should calculate correct weighted score', () => {
      const scores = {
        cloudCover: 100,
        humidity: 100,
        visibility: 100,
        lowClouds: 100
      };
      const result = GaussianScore.calculateWeightedScore(scores);
      expect(result).toBe(100);
    });

    it('should handle partial scores', () => {
      const scores = {
        cloudCover: 100,
        humidity: 0,
        visibility: 0,
        lowClouds: 0
      };
      const result = GaussianScore.calculateWeightedScore(scores);
      // cloudCover weight is 0.35, so 100 * 0.35 = 35
      expect(result).toBe(35);
    });

    it('should use custom weights if provided', () => {
      const scores = {
        cloudCover: 100,
        humidity: 0,
        visibility: 0,
        lowClouds: 0
      };
      const customWeights = {
        cloudCover: 1.0,
        humidity: 0,
        visibility: 0,
        lowClouds: 0
      };
      const result = GaussianScore.calculateWeightedScore(scores, customWeights);
      expect(result).toBe(100);
    });

    it('should handle missing scores', () => {
      const scores = {
        cloudCover: 80
      };
      const result = GaussianScore.calculateWeightedScore(scores);
      // Only cloudCover contributes: 80 * 0.35 = 28
      expect(result).toBe(28);
    });
  });

  describe('getQualityLevel', () => {
    it('should return excellent for score >= 70', () => {
      expect(GaussianScore.getQualityLevel(70)).toBe('excellent');
      expect(GaussianScore.getQualityLevel(85)).toBe('excellent');
      expect(GaussianScore.getQualityLevel(100)).toBe('excellent');
    });

    it('should return good for score 40-69', () => {
      expect(GaussianScore.getQualityLevel(40)).toBe('good');
      expect(GaussianScore.getQualityLevel(55)).toBe('good');
      expect(GaussianScore.getQualityLevel(69)).toBe('good');
    });

    it('should return fair for score < 40', () => {
      expect(GaussianScore.getQualityLevel(0)).toBe('fair');
      expect(GaussianScore.getQualityLevel(20)).toBe('fair');
      expect(GaussianScore.getQualityLevel(39)).toBe('fair');
    });
  });

  describe('calculateAllScores', () => {
    it('should calculate all scores from weather data', () => {
      const weatherData = {
        cloudCover: 50,
        humidity: 50,
        visibility: 20,
        lowCloudCover: 10
      };
      const scores = GaussianScore.calculateAllScores(weatherData);

      expect(scores.cloudCover).toBeCloseTo(100, 0);
      expect(scores.humidity).toBeCloseTo(100, 0);
      expect(scores.visibility).toBeGreaterThan(70);
      expect(scores.lowClouds).toBeGreaterThan(50);
    });

    it('should use cloudCover as fallback for lowCloudCover', () => {
      const weatherData = {
        cloudCover: 30,
        humidity: 50,
        visibility: 10
        // lowCloudCover not provided
      };
      const scores = GaussianScore.calculateAllScores(weatherData);

      // lowClouds should use cloudCover value
      const expectedLowClouds = GaussianScore.scoreLowClouds(30);
      expect(scores.lowClouds).toBeCloseTo(expectedLowClouds, 5);
    });

    it('should handle missing data', () => {
      const weatherData = {};
      const scores = GaussianScore.calculateAllScores(weatherData);

      // All should be 0 or calculated from 0
      expect(scores.cloudCover).toBeDefined();
      expect(scores.humidity).toBeDefined();
      expect(scores.visibility).toBeDefined();
      expect(scores.lowClouds).toBeDefined();
    });
  });

  describe('calculatePredictionScore', () => {
    it('should return complete prediction result', () => {
      const weatherData = {
        cloudCover: 50,
        humidity: 50,
        visibility: 30,
        lowCloudCover: 5
      };
      const result = GaussianScore.calculatePredictionScore(weatherData);

      expect(result).toHaveProperty('scores');
      expect(result).toHaveProperty('totalScore');
      expect(result).toHaveProperty('quality');
    });

    it('should return excellent quality for optimal conditions', () => {
      const weatherData = {
        cloudCover: 50,
        humidity: 50,
        visibility: 30,
        lowCloudCover: 0
      };
      const result = GaussianScore.calculatePredictionScore(weatherData);

      expect(result.quality).toBe('excellent');
      expect(result.totalScore).toBeGreaterThanOrEqual(70);
    });

    it('should return fair quality for poor conditions', () => {
      const weatherData = {
        cloudCover: 0,
        humidity: 100,
        visibility: 1,
        lowCloudCover: 80
      };
      const result = GaussianScore.calculatePredictionScore(weatherData);

      expect(result.quality).toBe('fair');
      expect(result.totalScore).toBeLessThan(40);
    });
  });

  describe('DEFAULT_WEIGHTS', () => {
    it('should have correct weight values', () => {
      expect(GaussianScore.DEFAULT_WEIGHTS.cloudCover).toBe(0.35);
      expect(GaussianScore.DEFAULT_WEIGHTS.humidity).toBe(0.25);
      expect(GaussianScore.DEFAULT_WEIGHTS.visibility).toBe(0.20);
      expect(GaussianScore.DEFAULT_WEIGHTS.lowClouds).toBe(0.20);
    });

    it('should have weights that sum to 1', () => {
      const sum =
        GaussianScore.DEFAULT_WEIGHTS.cloudCover +
        GaussianScore.DEFAULT_WEIGHTS.humidity +
        GaussianScore.DEFAULT_WEIGHTS.visibility +
        GaussianScore.DEFAULT_WEIGHTS.lowClouds;
      expect(sum).toBeCloseTo(1.0, 5);
    });
  });
});
