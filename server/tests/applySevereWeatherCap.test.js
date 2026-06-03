/**
 * applySevereWeatherCap 回归测试
 *
 * 验证修复：总云量>=85 不再一刀切封顶35分
 * 改为：低云遮挡主导时才重罚
 */

const { applySevereWeatherCap } = require('../services/EnhancedPredictionService.js');

describe('applySevereWeatherCap regression', () => {
  test('Case A: 高云主导、低云低 - 不应被 cap35', () => {
    const weatherData = {
      cloudCover: 90,
      lowClouds: 15,
      midClouds: 30,
      highClouds: 85,
      precipitation: 0,
      weatherCode: 0
    };
    const result = applySevereWeatherCap(75, weatherData);
    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.reason).toBeNull();
  });

  test('Case B: 低云高+总云量高 - 应继续被 cap35', () => {
    const weatherData = {
      cloudCover: 90,
      lowClouds: 75,
      midClouds: 20,
      highClouds: 10,
      precipitation: 0,
      weatherCode: 0
    };
    const result = applySevereWeatherCap(75, weatherData);
    expect(result.score).toBeLessThanOrEqual(35);
    expect(result.reason).not.toBeNull();
  });

  test('Case C: 低云主导（>=60）且总云量>=85 - 应被 cap35', () => {
    const weatherData = {
      cloudCover: 85,
      lowClouds: 60,
      midClouds: 20,
      highClouds: 15,
      precipitation: 0,
      weatherCode: 0
    };
    const result = applySevereWeatherCap(80, weatherData);
    expect(result.score).toBeLessThanOrEqual(35);
    expect(result.reason).not.toBeNull();
  });

  test('Case D: 总云量高但低云<60 - 不应被 cap35', () => {
    const weatherData = {
      cloudCover: 88,
      lowClouds: 55,
      midClouds: 70,
      highClouds: 20,
      precipitation: 0,
      weatherCode: 0
    };
    const result = applySevereWeatherCap(70, weatherData);
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.reason).toBeNull();
  });

  test('Case E: 降水场景（低云>40）- 应被 cap45', () => {
    const weatherData = {
      cloudCover: 70,
      lowClouds: 50,       // >40 才触发降水封顶
      midClouds: 30,
      highClouds: 20,
      precipitation: 1.0,
      weatherCode: 61
    };
    const result = applySevereWeatherCap(80, weatherData);
    expect(result.score).toBeLessThanOrEqual(45);
    expect(result.reason).not.toBeNull();
  });

  test('Case F: 雨雪码（低云>40）- 应被 cap45', () => {
    const weatherData = {
      cloudCover: 60,
      lowClouds: 50,       // >40 才触发降水封顶
      midClouds: 20,
      highClouds: 10,
      precipitation: 0,
      weatherCode: 71
    };
    const result = applySevereWeatherCap(80, weatherData);
    expect(result.score).toBeLessThanOrEqual(45);
    expect(result.reason).not.toBeNull();
  });

  test('Case G: 低云>中高云（多云层但低云主导）- 应被 cap35', () => {
    const weatherData = {
      cloudCover: 90,
      lowClouds: 50,
      midClouds: 30,
      highClouds: 20,
      precipitation: 0,
      weatherCode: 0
    };
    const result = applySevereWeatherCap(75, weatherData);
    expect(result.score).toBeLessThanOrEqual(35);
    expect(result.reason).not.toBeNull();
  });

  test('Case H: 总云量高+低能见度但低云很少 - 只应保守 cap35，不应 cap15', () => {
    const weatherData = {
      cloudCover: 100,
      lowClouds: 2,
      midClouds: 84,
      highClouds: 72,
      visibility: 5,
      precipitation: 0.4,
      recentPrecipitation6h: 1.2,
      recentRainHours: 3,
      weatherCode: null
    };
    const result = applySevereWeatherCap(80, weatherData);
    expect(result.score).toBe(35);
    expect(result.reason).toBe('overcast_low_visibility_cap_35');
  });
});
