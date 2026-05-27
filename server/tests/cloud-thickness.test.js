/**
 * 云厚评估模块测试（Phase 22）
 * 适配 Jest：避免 process.exit，使用 expect 断言
 */
const { assessCloudThickness } = require('../services/EnhancedPredictionService');

describe('assessCloudThickness', () => {
  test('厚云幕：直射比低 + 水汽高 + 阴天码', () => {
    const result = assessCloudThickness({
      shortwaveRadiation: 100,
      directRadiation: 10,
      diffuseRadiation: 80,
      waterVapourColumn: 8.0,
      cloudCover: 100,
      weatherCode: 3
    });
    expect(result.thickness).toBe('thick');
    expect(result.modifier).toBe(0.7);
    expect(result.evidence.diffusePressure).toBe(0);
  });

  test('薄卷云：直射比高 + 水汽低', () => {
    const result = assessCloudThickness({
      shortwaveRadiation: 500,
      directRadiation: 380,
      diffuseRadiation: 100,
      waterVapourColumn: 2.0,
      cloudCover: 80,
      weatherCode: 2
    });
    expect(result.thickness).toBe('thin');
    expect(result.modifier).toBeGreaterThanOrEqual(1.0);
  });

  test('无数据：降级', () => {
    const result = assessCloudThickness({
      cloudCover: 60
    });
    expect(result.thickness).toBe('unknown');
    expect(result.modifier).toBe(1.0);
  });

  test('适中：直射比中等 + 水汽中等', () => {
    const result = assessCloudThickness({
      shortwaveRadiation: 300,
      directRadiation: 150,
      diffuseRadiation: 120,
      waterVapourColumn: 4.0,
      cloudCover: 60,
      weatherCode: 2
    });
    // waterIndex = 4.0 * 60/100 = 2.4 < 2.5 → low signal → score leans thin
    expect(result.thickness).toBe('thin');
    expect(result.modifier).toBeGreaterThanOrEqual(1.0);
  });
});
