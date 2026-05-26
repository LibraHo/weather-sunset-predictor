/**
 * LightPathV2Service 单元测试
 * 需求：35，任务：58.1, 58.3（坏样本回放）
 */

let scoreLightPathV2;

beforeAll(async () => {
  const mod = await import('../../../server/services/LightPathV2Service.js');
  scoreLightPathV2 = mod.scoreLightPathV2;
});

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

  // 3. 低云主导的满天云 → 光路受遮挡
  test('低云主导的 cloudCover=90 应触发 overcast_cap_40', () => {
    const result = scoreLightPathV2({
      solarElevation: 2,
      lowClouds: 80,
      midClouds: 40,
      highClouds: 30,
      cloudBaseHeight: 700,
      cloudCover: 90,
      precipitation: 0,
      convPrecip: 0,
      weatherCode: null
    });
    expect(result.score).toBeLessThanOrEqual(40);
    expect(result.capReason).toBe('overcast_cap_40');
  });

  test('中高云主导且低云很少时，不应仅因 cloudCover=100 压低光路', () => {
    const result = scoreLightPathV2({
      solarElevation: 6,
      lowClouds: 0,
      midClouds: 45,
      highClouds: 100,
      cloudBaseHeight: null,
      cloudCover: 100,
      precipitation: 0,
      convPrecip: 0,
      weatherCode: 3
    });

    expect(result.capReason).toBeNull();
    expect(result.score).toBeGreaterThan(40);
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
    expect(result.samples).toHaveLength(4);
    expect(result.samples.map(sample => sample.distanceKm)).toEqual([25, 50, 75, 100]);
  });
});


describe('坏样本回放（任务58.3）', () => {
  test('Val Thorens 雨夹雪场景：cloudCover=100, lowClouds=96, precipitation=2, weatherCode=85 → score <= 10', () => {
    const result = scoreLightPathV2({
      solarElevation: 5,
      solarAzimuth: 250,
      lowClouds: 96, midClouds: 72, highClouds: 0,
      cloudCover: 100,
      precipitation: 2, convPrecip: 0,
      weatherCode: 85,
      cloudBaseHeight: 830
    });
    expect(result.score).toBeLessThanOrEqual(10);
    expect(result.capReason).toBe('overcast_cap_40');
  });

  test('北京高云画布：cloudCover=100, highClouds=100, lowClouds=0 → 不应按低云阴天处理', () => {
    const result = scoreLightPathV2({
      solarElevation: 10,
      solarAzimuth: 260,
      lowClouds: 0, midClouds: 0, highClouds: 100,
      cloudCover: 100,
      precipitation: 0, convPrecip: 0,
      weatherCode: 3,
      cloudBaseHeight: null
    });
    expect(result.score).toBeGreaterThan(40);
    expect(result.capReason).toBeNull();
  });
});
