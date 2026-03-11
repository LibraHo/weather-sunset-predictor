/**
 * LightPathV2Service 单元测试
 * 需求：35，任务：58
 */

const { scoreLightPathV2 } = require('../../../server/services/LightPathV2Service');

describe('LightPathV2Service', () => {
  // 1. 太阳高度角为负 → 低分
  test('太阳高度角为负时，应返回低分', () => {
    const result = scoreLightPathV2({
      solarElevation: -10,
      lowClouds: 50,
      midClouds: 50,
      highClouds: 20,
      cloudBaseHeight: 1000,
      cloudCover: 60,
      precipitation: 0,
      convPrecip: 0,
      weatherCode: null
    });
    expect(result.score).toBeLessThan(40);
    expect(result).toHaveProperty('occlusionProbability');
    expect(result).toHaveProperty('samples');
  });

  // 2. 晴天低云 → 高分
  test('晴天低云少时，应返回高分', () => {
    const result = scoreLightPathV2({
      solarElevation: 3,
      lowClouds: 5,
      midClouds: 10,
      highClouds: 20,
      cloudBaseHeight: 3000,
      cloudCover: 20,
      precipitation: 0,
      convPrecip: 0,
      weatherCode: null
    });
    expect(result.score).toBeGreaterThan(60);
    expect(result.capReason).toBeNull();
  });

  // 3. cloudCover=90 → 触发 overcast_cap_40
  test('cloudCover=90 应触发 overcast_cap_40', () => {
    const result = scoreLightPathV2({
      solarElevation: 2,
      lowClouds: 80,
      midClouds: 80,
      highClouds: 80,
      cloudBaseHeight: 700,
      cloudCover: 90,
      precipitation: 0,
      convPrecip: 0,
      weatherCode: null
    });
    expect(result.score).toBeLessThanOrEqual(40);
    expect(result.capReason).toBe('overcast_cap_40');
  });

  // 4. precipitation=1 → 触发 precipitation_cap_50
  test('precipitation=1 应触发 precipitation_cap_50', () => {
    const result = scoreLightPathV2({
      solarElevation: 3,
      lowClouds: 30,
      midClouds: 30,
      highClouds: 10,
      cloudBaseHeight: 1500,
      cloudCover: 50,
      precipitation: 1,
      convPrecip: 0,
      weatherCode: null
    });
    expect(result.score).toBeLessThanOrEqual(50);
    expect(result.capReason).toBe('precipitation_cap_50');
  });

  // 5. 云底高度缺失 → 不崩溃
  test('云底高度缺失时不应崩溃', () => {
    expect(() => {
      const result = scoreLightPathV2({
        solarElevation: 2,
        lowClouds: 20,
        midClouds: 30,
        highClouds: 10,
        cloudBaseHeight: null,
        cloudCover: 40,
        precipitation: 0,
        convPrecip: 0,
        weatherCode: null
      });
      expect(result).toHaveProperty('score');
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    }).not.toThrow();
  });

  // 6. Val Thorens 坏样本
  test('Val Thorens 坏样本：cloudCover=100, precipitation=2, weatherCode=85 → score <= 10', () => {
    const result = scoreLightPathV2({
      solarElevation: -2,
      lowClouds: 100,
      midClouds: 100,
      highClouds: 80,
      cloudBaseHeight: 500,
      cloudCover: 100,
      precipitation: 2,
      convPrecip: 1,
      weatherCode: 85
    });
    expect(result.score).toBeLessThanOrEqual(10);
  });

  // 额外：输出结构完整性
  test('输出结构应包含所有必要字段', () => {
    const result = scoreLightPathV2({
      solarElevation: 1,
      lowClouds: 20,
      midClouds: 30,
      highClouds: 10,
      cloudBaseHeight: 2000,
      cloudCover: 40,
      precipitation: 0,
      convPrecip: 0,
      weatherCode: null
    });
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('occlusionProbability');
    expect(result).toHaveProperty('samples');
    expect(result).toHaveProperty('capReason');
    expect(result).toHaveProperty('explain');
    expect(Array.isArray(result.samples)).toBe(true);
    expect(result.samples).toHaveLength(3);
  });
});
