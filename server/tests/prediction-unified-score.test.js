describe('PredictionService Unified Scoring (Backend)', () => {
  let PredictionService;
  let service;

  beforeAll(async () => {
    PredictionService = (await import('../services/PredictionService.js')).default;
    service = new PredictionService();
  });

  test('理想场景：应得到高分且 quality=excellent', () => {
    const weatherData = {
      highClouds: 50,
      midClouds: 35,
      lowClouds: 10,
      visibility: 25,
      humidity: 55,
      precipitation: 0
    };

    const result = service.calculateScore(weatherData);

    expect(result.score).toBeGreaterThan(85);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.quality).toBe('excellent');
    expect(result.factors.cloudCover.score).toBeCloseTo(result.breakdown.cloudStructure.score, 6);
    expect(result.factors.humidity.score).toBeCloseTo(result.breakdown.transparency.humidityScore, 6);
    expect(result.factors.visibility.score).toBeCloseTo(result.breakdown.transparency.visibilityScore, 6);
    expect(result.factors.lowClouds.score).toBeCloseTo(result.breakdown.cloudStructure.lowCloudBonus, 6);
  });

  test('晴天缺云：应中低分且 quality=poor', () => {
    const weatherData = {
      highClouds: 5,
      midClouds: 5,
      lowClouds: 5,
      visibility: 30,
      humidity: 45,
      precipitation: 0
    };

    const result = service.calculateScore(weatherData);

    expect(result.score).toBeGreaterThan(20);
    expect(result.score).toBeLessThan(40);
    expect(result.quality).toBe('poor');
  });

  test('暴雨场景：乘性惩罚后应显著降分且 quality=poor', () => {
    const weatherData = {
      highClouds: 50,
      midClouds: 35,
      lowClouds: 30,
      visibility: 4,
      humidity: 90,
      precipitation: 6
    };

    const result = service.calculateScore(weatherData);

    expect(result.score).toBeGreaterThan(5);
    expect(result.score).toBeLessThan(20);
    expect(result.quality).toBe('poor');
    expect(result.breakdown.precipPenalty).toBe(0.15);
  });

  test('厚低云（lowCloudCover兼容）：应触发低云惩罚且 quality=poor', () => {
    const weatherData = {
      highClouds: 45,
      midClouds: 35,
      lowCloudCover: 80,
      visibility: 12,
      humidity: 60,
      precipitation: 0
    };

    const scoreOnly = service.calculateScore(weatherData);
    const prediction = service.calculatePrediction(
      weatherData,
      new Date('2026-06-21T00:00:00.000Z'),
      39.9,
      116.4,
      'sunset'
    );

    expect(scoreOnly.breakdown.lowCloudPenalty).toBe(0.2);
    expect(scoreOnly.score).toBeGreaterThan(10);
    expect(scoreOnly.score).toBeLessThan(30);
    expect(scoreOnly.quality).toBe('poor');

    // calculatePrediction 和 calculateScore 应使用同一算法
    expect(prediction.score).toBeCloseTo(scoreOnly.score, 8);
    expect(prediction.quality).toBe(scoreOnly.quality);
    expect(prediction.factors.lowClouds.value).toBe(80);
    expect(prediction).toHaveProperty('sunsetTime');
    expect(prediction).toHaveProperty('sunriseTime');
    expect(prediction.type).toBe('sunset');
  });
});
