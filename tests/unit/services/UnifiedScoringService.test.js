/**
 * UnifiedScoringService 单元测试
 *
 * 测试内联进 SunsetPredictionService 的火烧云评分逻辑
 * 通过 _calculateUnifiedScore() 私有方法测试各场景
 */

import SunsetPredictionService from '../../../src/services/SunsetPredictionService.js';

describe('SunsetPredictionService._calculateUnifiedScore', () => {
  let service;

  beforeEach(() => {
    service = new SunsetPredictionService();
  });

  // 场景1：理想火烧云（高中云充足、低云少、无降水、能见度好）
  test('场景1：理想火烧云 - score >= 70，quality 为 good 或 excellent', () => {
    const ideal = {
      highClouds: 50, midClouds: 35, lowClouds: 5,
      visibility: 25, humidity: 55, precipitation: 0,
      cloudCover: 60
    };
    const result = service._calculateUnifiedScore(ideal);
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(['good', 'excellent']).toContain(result.quality);
  });

  // 场景2：晴天（几乎无云）
  test('场景2：晴天无云 - score < 50（缺少云层载体）', () => {
    const clearSky = {
      highClouds: 2, midClouds: 3, lowClouds: 2,
      visibility: 30, humidity: 30, precipitation: 0,
      cloudCover: 5
    };
    const result = service._calculateUnifiedScore(clearSky);
    expect(result.score).toBeLessThan(50);
  });

  // 场景3：暴雨
  test('场景3：暴雨 - score < 20（降水惩罚×0.15）', () => {
    const heavyRain = {
      highClouds: 40, midClouds: 30, lowClouds: 80,
      visibility: 3, humidity: 95, precipitation: 5,
      cloudCover: 95
    };
    const result = service._calculateUnifiedScore(heavyRain);
    expect(result.score).toBeLessThan(20);
    expect(result.breakdown.precipPenalty).toBe(0.15);
  });

  // 场景4：厚低云（低云>70%）
  test('场景4：厚低云 - score < 30（低云惩罚×0.2）', () => {
    const thickLowCloud = {
      highClouds: 50, midClouds: 40, lowClouds: 80,
      visibility: 15, humidity: 60, precipitation: 0,
      cloudCover: 85
    };
    const result = service._calculateUnifiedScore(thickLowCloud);
    expect(result.score).toBeLessThan(30);
    expect(result.breakdown.lowCloudPenalty).toBe(0.2);
  });

  // 场景5：三层云立体分布
  test('场景5：三层云立体分布 - layerDiversity score = 15', () => {
    const layered = {
      highClouds: 40, midClouds: 30, lowClouds: 15,
      visibility: 20, humidity: 55, precipitation: 0,
      cloudCover: 70
    };
    const result = service._calculateUnifiedScore(layered);
    expect(result.breakdown.layerDiversity.score).toBe(15);
    expect(result.breakdown.layerDiversity.layerCount).toBe(3);
  });
});
