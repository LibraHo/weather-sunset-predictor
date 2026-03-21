/**
 * ChinaRasterService 单元测试
 *
 * Mock GridScoreService 以隔离外部依赖。
 */

jest.mock('../../../server/services/GridScoreService', () => ({
  refreshIfStale: jest.fn().mockResolvedValue(undefined),
  getCache: jest.fn()
}));

const gridService = require('../../../server/services/GridScoreService');

// 重置模块缓存，使 ChinaRasterService 使用 mock 的 gridService
let chinaRasterService;

beforeEach(() => {
  jest.resetModules();

  jest.mock('../../../server/services/GridScoreService', () => ({
    refreshIfStale: jest.fn().mockResolvedValue(undefined),
    getCache: jest.fn()
  }));

  chinaRasterService = require('../../../server/services/ChinaRasterService');
});

// 构造假散点数据（覆盖中国几个典型城市）
function makeMockCache(overrides = {}) {
  return {
    updatedAt: new Date().toISOString(),
    gridPoints: [
      { lat: 39.9, lon: 116.4, score: 75 },
      { lat: 31.2, lon: 121.5, score: 60 },
      { lat: 23.1, lon: 113.3, score: 50 },
      { lat: 30.6, lon: 104.1, score: 65 },
      { lat: 43.8, lon: 87.6,  score: 40 }
    ],
    stale: false,
    ...overrides
  };
}

describe('ChinaRasterService.getRaster', () => {
  test('返回正确的顶层字段', async () => {
    const mockGridService = require('../../../server/services/GridScoreService');
    mockGridService.getCache.mockReturnValue(makeMockCache());

    const raster = await chinaRasterService.getRaster('sunset', 0.5);

    expect(raster).toHaveProperty('date');
    expect(raster).toHaveProperty('updatedAt');
    expect(raster).toHaveProperty('period', 'sunset');
    expect(raster).toHaveProperty('resolution', 0.5);
    expect(raster).toHaveProperty('width');
    expect(raster).toHaveProperty('height');
    expect(raster).toHaveProperty('noData', -1);
    expect(raster).toHaveProperty('values');
    expect(raster).toHaveProperty('meta');
    expect(raster.meta.interpolation).toBe('idw');
    expect(raster.meta.source).toBe('china-spots-cache');
    expect(raster.meta.sourcePoints).toBe(5);
  });

  test('values 长度等于 width * height', async () => {
    const mockGridService = require('../../../server/services/GridScoreService');
    mockGridService.getCache.mockReturnValue(makeMockCache());

    const raster = await chinaRasterService.getRaster('sunset', 0.5);
    expect(raster.values.length).toBe(raster.width * raster.height);
  });

  test('width/height 符合预期（0.5° 分辨率，bbox 72-135/18-53）', async () => {
    const mockGridService = require('../../../server/services/GridScoreService');
    mockGridService.getCache.mockReturnValue(makeMockCache());

    const raster = await chinaRasterService.getRaster('sunset', 0.5);
    expect(raster.width).toBe(Math.round((135 - 72) / 0.5));   // 126
    expect(raster.height).toBe(Math.round((53 - 18) / 0.5));   // 70
  });

  test('gridPoints 为空时抛出错误', async () => {
    const mockGridService = require('../../../server/services/GridScoreService');
    mockGridService.getCache.mockReturnValue({ updatedAt: new Date().toISOString(), gridPoints: [] });

    await expect(chinaRasterService.getRaster('sunset', 0.5)).rejects.toThrow('尚未就绪');
  });

  test('gridPoints 均无有效 score 时抛出错误', async () => {
    const mockGridService = require('../../../server/services/GridScoreService');
    mockGridService.getCache.mockReturnValue({
      updatedAt: new Date().toISOString(),
      gridPoints: [
        { lat: 39.9, lon: 116.4, score: null },
        { lat: 31.2, lon: 121.5, score: undefined }
      ]
    });

    await expect(chinaRasterService.getRaster('sunset', 0.5)).rejects.toThrow('无有效散点数据');
  });

  test('缓存未就绪时抛出错误', async () => {
    const mockGridService = require('../../../server/services/GridScoreService');
    mockGridService.getCache.mockReturnValue(null);

    await expect(chinaRasterService.getRaster('sunset', 0.5)).rejects.toThrow('尚未就绪');
  });

  test('period 参数异常时降级为 sunset', async () => {
    const mockGridService = require('../../../server/services/GridScoreService');
    mockGridService.getCache.mockReturnValue(makeMockCache());

    const raster = await chinaRasterService.getRaster('invalid', 0.5);
    expect(raster.period).toBe('sunset');
  });

  test('resolution 参数超出范围时使用默认 0.5', async () => {
    const mockGridService = require('../../../server/services/GridScoreService');
    mockGridService.getCache.mockReturnValue(makeMockCache());

    const raster = await chinaRasterService.getRaster('sunset', 999);
    expect(raster.resolution).toBe(0.5);
  });

  test('缓存命中时不重复调用 gridService.getCache 多次', async () => {
    const mockGridService = require('../../../server/services/GridScoreService');
    mockGridService.getCache.mockReturnValue(makeMockCache());

    // 第一次调用
    await chinaRasterService.getRaster('sunset', 0.5);
    const firstCallCount = mockGridService.getCache.mock.calls.length;

    // 第二次调用应命中缓存
    await chinaRasterService.getRaster('sunset', 0.5);
    const secondCallCount = mockGridService.getCache.mock.calls.length;

    // 缓存命中不应再调用 getCache
    expect(secondCallCount).toBe(firstCallCount);
  });
});
