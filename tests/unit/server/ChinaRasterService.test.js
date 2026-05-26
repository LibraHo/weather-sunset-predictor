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
let originalGetBestAvailableCache;
let originalGetPublicMapCache;

beforeAll(async () => {
  // 先加载 GridScoreService 模块保存原始方法
  const gridModule = await import('../../../server/services/GridScoreService.js');
  const gridService = gridModule.default || gridModule;
  originalGetCache = gridService.getCache;
  originalRefreshIfStale = gridService.refreshIfStale;
  originalGetBestAvailableCache = gridService.getBestAvailableCache;
  originalGetPublicMapCache = gridService.getPublicMapCache;
});

beforeEach(async () => {
  // 加载 GridScoreService 并替换方法
  const gridModule = await import('../../../server/services/GridScoreService.js');
  const gridService = gridModule.default || gridModule;

  gridService.getCache = jest.fn();
  gridService.refreshIfStale = jest.fn().mockResolvedValue(undefined);
  gridService.getBestAvailableCache = undefined;
  gridService.getPublicMapCache = jest.fn((period) => {
    const cache = typeof gridService.getBestAvailableCache === 'function'
      ? gridService.getBestAvailableCache(period)
      : gridService.getCache(period);
    return {
      mode: 'hybrid',
      status: cache ? 'ready' : 'not-ready',
      cache: cache && !cache.source
        ? { ...cache, source: 'openmeteo-grid-cache', degraded: true, degradedReason: 'GRID_PRODUCT_CACHE_NOT_READY' }
        : cache,
      degradedReason: cache ? null : 'GRID_PRODUCT_CACHE_NOT_READY'
    };
  });

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
  if (originalGetBestAvailableCache) {
    gridService.getBestAvailableCache = originalGetBestAvailableCache;
  } else {
    delete gridService.getBestAvailableCache;
  }
  if (originalGetPublicMapCache) {
    gridService.getPublicMapCache = originalGetPublicMapCache;
  } else {
    delete gridService.getPublicMapCache;
  }
});

// 构造假散点数据（覆盖中国几个典型城市）
function makeMockCache(overrides = {}) {
  return {
    updatedAt: new Date().toISOString(),
    gridPoints: [
      { lat: 39.9, lon: 116.4, score: 75 },
      { lat: 39.5, lon: 116.0, score: 72 },
      { lat: 40.2, lon: 117.0, score: 68 },
      { lat: 31.2, lon: 121.5, score: 60 },
      { lat: 23.1, lon: 113.3, score: 50 },
      { lat: 30.6, lon: 104.1, score: 65 },
      { lat: 43.8, lon: 87.6,  score: 40 },
      { lat: 25.0, lon: 121.5, score: 58 },
      { lat: 37.6, lon: 127.0, score: 55 },
      { lat: 35.7, lon: 139.7, score: 52 }
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
    expect(raster).toHaveProperty('generatedAt');
    expect(raster).toHaveProperty('sourceUpdatedAt');
    expect(raster).toHaveProperty('period', 'sunset');
    expect(raster).toHaveProperty('resolution', 0.5);
    expect(raster).toHaveProperty('width');
    expect(raster).toHaveProperty('height');
    expect(raster).toHaveProperty('noData', -1);
    expect(raster).toHaveProperty('values');
    expect(raster).toHaveProperty('meta');
    expect(raster.meta.interpolation).toBe('idw');
    expect(raster.meta.source).toBe('openmeteo-grid-cache');
    expect(raster.meta.degraded).toBe(true);
    expect(raster.meta.sourcePoints).toBe(10);
  });

  test('values 长度等于 width * height', async () => {
    const mockGridService = await getMockGridService();
    mockGridService.getCache.mockReturnValue(makeMockCache());

    const raster = await chinaRasterService.getRaster('sunset', 0.5);
    expect(raster.values.length).toBe(raster.width * raster.height);
  });

  test('unsupported South Asia cells stay noData after IDW interpolation', async () => {
    const mockGridService = await getMockGridService();
    mockGridService.getCache.mockReturnValue(makeMockCache());

    const raster = await chinaRasterService.getRaster('sunset', 0.5);
    const sample = (lat, lon) => {
      const col = Math.round((lon - raster.bbox.west) / raster.resolution);
      const row = Math.round((raster.bbox.north - lat) / raster.resolution);
      return raster.values[row * raster.width + col];
    };

    expect(sample(28.5, 77.0)).toBe(raster.noData); // New Delhi area
    expect(sample(27.5, 85.5)).toBe(raster.noData); // Kathmandu area
    expect(raster.values.some(value => Number.isFinite(value) && value !== raster.noData)).toBe(true);
  });

  test('width/height 符合预期（0.5° 分辨率，bbox 72-146/18-53）', async () => {
    const mockGridService = await getMockGridService();
    mockGridService.getCache.mockReturnValue(makeMockCache());

    const raster = await chinaRasterService.getRaster('sunset', 0.5);
    expect(raster.width).toBe(Math.round((146 - 72) / 0.5));   // 148
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
    mockGridService.getBestAvailableCache = jest.fn().mockReturnValue(makeMockCache({
      source: 'grid-product-cache',
      degraded: false,
      updatedAt: '2000-01-01T00:00:00.000Z'
    }));

    const first = await chinaRasterService.getRaster('sunset', 0.5);
    const second = await chinaRasterService.getRaster('sunset', 0.5);

    expect(second).toBe(first);
    expect(first.updatedAt).toBe('2000-01-01T00:00:00.000Z');
    expect(first.sourceUpdatedAt).toBe('2000-01-01T00:00:00.000Z');
    expect(first.generatedAt).not.toBe(first.updatedAt);
    expect(first._cachedAt).toEqual(expect.any(Number));
    expect(mockGridService.refreshIfStale).not.toHaveBeenCalled();
    expect(mockGridService.getBestAvailableCache).toHaveBeenCalledTimes(1);
    expect(mockGridService.getCache).not.toHaveBeenCalled();
  });

  test('getRaster only reads existing grid cache and never triggers backend refresh', async () => {
    const mockGridService = await getMockGridService();
    mockGridService.getCache.mockReturnValue(makeMockCache());

    await chinaRasterService.getRaster('sunset', 0.5);

    expect(mockGridService.refreshIfStale).not.toHaveBeenCalled();
    expect(mockGridService.getCache).toHaveBeenCalledWith('sunset');
  });

  test('warmCache invalidates and rebuilds raster cache from backend-updated grid data', async () => {
    const mockGridService = await getMockGridService();
    mockGridService.getCache.mockReturnValue(makeMockCache());

    const warmed = await chinaRasterService.warmCache('sunset', [0.5]);

    expect(warmed).toHaveLength(1);
    expect(warmed[0].period).toBe('sunset');
    expect(warmed[0].resolution).toBe(0.5);
    expect(mockGridService.refreshIfStale).not.toHaveBeenCalled();
  });

  test('缓存命中时不重复调用 gridService.getCache 多次', async () => {
    const mockGridService = await getMockGridService();
    mockGridService.getCache.mockReturnValue(makeMockCache());

    // 第一次调用
    mockGridService.getBestAvailableCache = jest.fn().mockReturnValue(makeMockCache({
      source: 'grid-product-cache',
      degraded: false,
      updatedAt: '2026-05-26T12:00:00.000Z'
    }));
    await chinaRasterService.getRaster('sunset', 0.5);
    const firstCallCount = mockGridService.getCache.mock.calls.length;

    // 第二次调用应命中缓存
    await chinaRasterService.getRaster('sunset', 0.5);
    const secondCallCount = mockGridService.getCache.mock.calls.length;

    // 缓存命中不应再调用 getCache
    expect(secondCallCount).toBe(firstCallCount);
  });

  test('public raster is cache-first and does not trigger grid refresh when pipeline cache is available', async () => {
    const mockGridService = await getMockGridService();
    mockGridService.getBestAvailableCache = jest.fn().mockReturnValue({
      ...makeMockCache(),
      source: 'grid-product-cache',
      degraded: false
    });
    mockGridService.getCache.mockReturnValue(null);

    const raster = await chinaRasterService.getRaster('sunset', 0.5);

    expect(raster.meta.source).toBe('grid-product-cache');
    expect(mockGridService.getBestAvailableCache).toHaveBeenCalledWith('sunset');
    expect(mockGridService.refreshIfStale).not.toHaveBeenCalled();
  });

  test('degraded raster cache is regenerated when pipeline cache becomes ready', async () => {
    const mockGridService = await getMockGridService();
    mockGridService.getBestAvailableCache = jest.fn()
      .mockReturnValueOnce(makeMockCache({
        source: 'openmeteo-grid-cache',
        degraded: true,
        degradedReason: 'GRID_PRODUCT_CACHE_NOT_READY',
        updatedAt: '2026-05-26T12:00:00.000Z'
      }))
      .mockReturnValueOnce(makeMockCache({
        source: 'grid-product-cache',
        degraded: false,
        updatedAt: '2026-05-26T12:05:00.000Z'
      }));

    const first = await chinaRasterService.getRaster('sunset', 0.5);
    const second = await chinaRasterService.getRaster('sunset', 0.5);

    expect(first.meta.source).toBe('openmeteo-grid-cache');
    expect(first.meta.degraded).toBe(true);
    expect(second).not.toBe(first);
    expect(second.meta.source).toBe('grid-product-cache');
    expect(second.meta.degraded).toBe(false);
    expect(mockGridService.getBestAvailableCache).toHaveBeenCalledTimes(2);
  });
});
