/**
 * ChinaRasterService 单元测试
 *
 * Mock GridScoreService 以隔离外部依赖。
 * 使用动态 import + 原型替换兼容 ESM 环境。
 */

import { jest } from '@jest/globals';

let chinaRasterService;
let originalGetCache;
let originalRefreshIfStale;

beforeAll(async () => {
  // 先加载 GridScoreService 模块保存原始方法
  const gridModule = await import('../../../server/services/GridScoreService.js');
  const gridService = gridModule.default || gridModule;
  originalGetCache = gridService.getCache;
  originalRefreshIfStale = gridService.refreshIfStale;
});

beforeEach(async () => {
  // 加载 GridScoreService 并替换方法
  const gridModule = await import('../../../server/services/GridScoreService.js');
  const gridService = gridModule.default || gridModule;

  gridService.getCache = jest.fn();
  gridService.refreshIfStale = jest.fn().mockResolvedValue(undefined);

  // 重新加载 ChinaRasterService 以使用新的 mock
  const rasterModule = await import('../../../server/services/ChinaRasterService.js');
  chinaRasterService = rasterModule.default || rasterModule;
  // 清除内部缓存，避免测试间互相污染
  if (chinaRasterService.invalidateCache) {
    chinaRasterService.invalidateCache('all');
  }
});

afterEach(async () => {
  // 恢复原始方法
  const gridModule = await import('../../../server/services/GridScoreService.js');
  const gridService = gridModule.default || gridModule;
  gridService.getCache = originalGetCache;
  gridService.refreshIfStale = originalRefreshIfStale;
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

async function getMockGridService() {
  const gridModule = await import('../../../server/services/GridScoreService.js');
  return gridModule.default || gridModule;
}

describe('ChinaRasterService.getRaster', () => {
  test('返回正确的顶层字段', async () => {
    const mockGridService = await getMockGridService();
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
    const mockGridService = await getMockGridService();
    mockGridService.getCache.mockReturnValue(makeMockCache());

    const raster = await chinaRasterService.getRaster('sunset', 0.5);
    expect(raster.values.length).toBe(raster.width * raster.height);
  });

  test('width/height 符合预期（0.5° 分辨率，bbox 72-135/18-53）', async () => {
    const mockGridService = await getMockGridService();
    mockGridService.getCache.mockReturnValue(makeMockCache());

    const raster = await chinaRasterService.getRaster('sunset', 0.5);
    expect(raster.width).toBe(Math.round((135 - 72) / 0.5));   // 126
    expect(raster.height).toBe(Math.round((53 - 18) / 0.5));   // 70
  });

  test('gridPoints 为空时抛出错误', async () => {
    const mockGridService = await getMockGridService();
    mockGridService.getCache.mockReturnValue({ updatedAt: new Date().toISOString(), gridPoints: [] });

    await expect(chinaRasterService.getRaster('sunset', 0.5)).rejects.toThrow('尚未就绪');
  });

  test('gridPoints 均无有效 score 时抛出错误', async () => {
    const mockGridService = await getMockGridService();
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
    const mockGridService = await getMockGridService();
    mockGridService.getCache.mockReturnValue(null);

    await expect(chinaRasterService.getRaster('sunset', 0.5)).rejects.toThrow('尚未就绪');
  });

  test('period 参数异常时降级为 sunset', async () => {
    const mockGridService = await getMockGridService();
    mockGridService.getCache.mockReturnValue(makeMockCache());

    const raster = await chinaRasterService.getRaster('invalid', 0.5);
    expect(raster.period).toBe('sunset');
  });

  test('resolution 参数超出范围时使用默认 0.5', async () => {
    const mockGridService = await getMockGridService();
    mockGridService.getCache.mockReturnValue(makeMockCache());

    const raster = await chinaRasterService.getRaster('sunset', 999);
    expect(raster.resolution).toBe(0.5);
  });



  test('缓存 TTL 基于生成时间而不是天气数据 updatedAt', async () => {
    const mockGridService = await getMockGridService();
    mockGridService.getCache.mockReturnValue(makeMockCache({ updatedAt: '2000-01-01T00:00:00.000Z' }));

    const first = await chinaRasterService.getRaster('sunset', 0.5);
    const second = await chinaRasterService.getRaster('sunset', 0.5);

    expect(second).toBe(first);
    expect(first.updatedAt).toBe('2000-01-01T00:00:00.000Z');
    expect(first._cachedAt).toEqual(expect.any(Number));
    expect(mockGridService.refreshIfStale).toHaveBeenCalledTimes(1);
    expect(mockGridService.getCache).toHaveBeenCalledTimes(1);
  });

  test('缓存命中时不重复调用 gridService.getCache 多次', async () => {
    const mockGridService = await getMockGridService();
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
