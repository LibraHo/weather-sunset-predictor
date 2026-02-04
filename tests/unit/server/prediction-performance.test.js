/**
 * 预测 API 性能测试
 * 需求：22 (前后端分离 - Phase 4)
 *
 * 性能要求：
 * - 单点预测 < 500ms
 * - 周边聚合 < 2000ms
 * - 批量预测 < 1000ms
 */

describe('Prediction API Performance', () => {
  let PredictionService;
  let SurroundingService;
  let EnhancedPredictionService;
  let predictionService;
  let surroundingService;

  // 测试用的天气数据
  const mockWeatherData = {
    cloudCover: 50,
    humidity: 60,
    visibility: 10,
    lowCloudCover: 30,
    highClouds: 20,
    midClouds: 40,
    lowClouds: 30
  };

  beforeAll(async () => {
    // 动态导入模块
    PredictionService = (await import('../../../server/services/PredictionService.js')).default;
    SurroundingService = (await import('../../../server/services/SurroundingService.js')).default;
    EnhancedPredictionService = await import('../../../server/services/EnhancedPredictionService.js');

    // 创建服务实例
    predictionService = new PredictionService();
    surroundingService = new SurroundingService(); // 不使用缓存以测试真实性能
  });

  describe('单点预测性能', () => {
    test('基础预测应在500ms内完成', () => {
      const startTime = Date.now();

      const result = predictionService.calculatePrediction(
        mockWeatherData,
        new Date('2024-06-21'),
        40.0,
        116.0,
        'sunset'
      );

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(500);
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('quality');
    });

    test('连续100次预测的平均响应时间应小于100ms', () => {
      const iterations = 100;
      const durations = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();

        predictionService.calculatePrediction(
          mockWeatherData,
          new Date('2024-06-21'),
          40.0,
          116.0,
          'sunset'
        );

        durations.push(Date.now() - startTime);
      }

      const avgDuration = durations.reduce((a, b) => a + b, 0) / iterations;
      const maxDuration = Math.max(...durations);

      console.log(`[Performance] 基础预测 - 平均: ${avgDuration.toFixed(2)}ms, 最大: ${maxDuration}ms`);

      expect(avgDuration).toBeLessThan(100);
      expect(maxDuration).toBeLessThan(500);
    });

    test('仅计算评分（不含时间计算）应在100ms内完成', () => {
      const startTime = Date.now();

      const result = predictionService.calculateScore(mockWeatherData);

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100);
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('quality');
    });
  });

  describe('增强预测性能', () => {
    test('增强预测应在500ms内完成', () => {
      const weatherData = {
        lowClouds: 20,
        midClouds: 50,
        highClouds: 40,
        visibility: 15,
        humidity: 60
      };

      const startTime = Date.now();

      const result = EnhancedPredictionService.calculateEnhancedPrediction(
        weatherData,
        '2024-06-21T18:00:00Z',
        40.0,
        116.0,
        'sunset'
      );

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(500);
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('quality');
    });

    test('批量预测（10天）应在1000ms内完成', () => {
      const weatherDataArray = [];
      for (let i = 0; i < 10; i++) {
        weatherDataArray.push({
          weather: { lowClouds: 20, midClouds: 50, highClouds: 40 },
          date: `2024-06-${21 + i}T18:00:00Z`
        });
      }

      const startTime = Date.now();

      const results = EnhancedPredictionService.calculateBatchEnhancedPredictions(
        weatherDataArray,
        40.0,
        116.0,
        'sunset'
      );

      const duration = Date.now() - startTime;

      console.log(`[Performance] 批量预测（10天）: ${duration}ms`);

      expect(duration).toBeLessThan(1000);
      expect(results).toHaveLength(10);
    });
  });

  describe('周边计算性能（不含网络请求）', () => {
    test('8方向坐标计算应在10ms内完成', () => {
      const startTime = Date.now();

      const points = surroundingService.calculateSurroundingPoints(40.0, 116.0, 100);

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(10);
      expect(points).toHaveLength(8);
    });

    test('连续100次坐标计算的平均响应时间应小于1ms', () => {
      const iterations = 100;
      const durations = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();

        surroundingService.calculateSurroundingPoints(40.0, 116.0, 100);

        durations.push(Date.now() - startTime);
      }

      const avgDuration = durations.reduce((a, b) => a + b, 0) / iterations;

      console.log(`[Performance] 坐标计算 - 平均: ${avgDuration.toFixed(2)}ms`);

      expect(avgDuration).toBeLessThan(1);
    });
  });

  describe('缓存键生成性能', () => {
    test('缓存键生成应在1ms内完成', () => {
      const date = new Date('2024-06-21');
      const iterations = 1000;
      const durations = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();

        surroundingService._getCacheKey(40.0, 116.0, 100, 'sunset', date);

        durations.push(Date.now() - startTime);
      }

      const avgDuration = durations.reduce((a, b) => a + b, 0) / iterations;

      console.log(`[Performance] 缓存键生成 - 平均: ${avgDuration.toFixed(3)}ms`);

      expect(avgDuration).toBeLessThan(1);
    });
  });

  describe('内存占用', () => {
    test('批量预测不应导致内存泄漏', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // 执行100次批量预测
      for (let i = 0; i < 100; i++) {
        const weatherData = {
          lowClouds: 20,
          midClouds: 50,
          highClouds: 40
        };

        EnhancedPredictionService.calculateEnhancedPrediction(
          weatherData,
          '2024-06-21T18:00:00Z',
          40.0,
          116.0,
          'sunset'
        );
      }

      // 强制垃圾回收（如果可用）
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      console.log(`[Performance] 内存增长: ${memoryIncrease.toFixed(2)}MB`);

      // 内存增长应小于100MB（首次加载模块开销较大，只要不持续增长即可）
      expect(memoryIncrease).toBeLessThan(100);
    });
  });

  describe('边界条件性能', () => {
    test('极端天气数据应在500ms内完成', () => {
      const extremeWeatherData = {
        cloudCover: 100,
        humidity: 100,
        visibility: 0,
        lowCloudCover: 100,
        highClouds: 100,
        midClouds: 100,
        lowClouds: 100
      };

      const startTime = Date.now();

      const result = predictionService.calculatePrediction(
        extremeWeatherData,
        new Date('2024-06-21'),
        40.0,
        116.0,
        'sunset'
      );

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(500);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    test('极端坐标（极地）应在500ms内完成', () => {
      const startTime = Date.now();

      const points = surroundingService.calculateSurroundingPoints(89, 0, 100);

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(500);
      expect(points).toHaveLength(8);
    });
  });
});
