import { jest } from '@jest/globals';
import express from 'express';
import { TextEncoder, TextDecoder } from 'node:util';

if (!global.TextEncoder) {
  global.TextEncoder = TextEncoder;
}

if (!global.TextDecoder) {
  global.TextDecoder = TextDecoder;
}

describe('Spots API Integration', () => {
  let app;
  let request;
  let gridService;
  let originalRefreshIfStale;
  let originalGetCache;
  let originalGetBestAvailableCache;
  let originalGetPublicMapCache;
  let chinaRasterService;

  beforeAll(async () => {
    const supertestModule = await import('supertest');
    request = supertestModule.default || supertestModule;

    const gridServiceModule = await import('../../../server/services/GridScoreService.js');
    gridService = gridServiceModule.default || gridServiceModule;

    originalRefreshIfStale = gridService.refreshIfStale;
    originalGetCache = gridService.getCache;
    originalGetBestAvailableCache = gridService.getBestAvailableCache;
    originalGetPublicMapCache = gridService.getPublicMapCache;

    const rasterServiceModule = await import('../../../server/services/ChinaRasterService.js');
    chinaRasterService = rasterServiceModule.default || rasterServiceModule;

    const spotsRouterModule = await import('../../../server/routes/spots.js');
    const spotsRouter = spotsRouterModule.default || spotsRouterModule;

    app = express();
    app.use(express.json());
    app.use('/api/spots', spotsRouter);
    app.use((err, req, res, next) => {
      res.status(500).json({ error: err.message });
    });
  });

  afterAll(() => {
    if (gridService) {
      gridService.refreshIfStale = originalRefreshIfStale;
      gridService.getCache = originalGetCache;
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
    }
  });

  test('GET /api/spots/china 返回评分>=40 且按分数降序', async () => {
    const updatedAt = '2026-03-20T00:00:00.000Z';

    gridService.refreshIfStale = jest.fn(async () => {});
    gridService.getCache = jest.fn(() => null);
    gridService.getBestAvailableCache = jest.fn(() => ({
      updatedAt,
      source: 'grid-product-cache',
      degraded: false,
      gridPoints: [
        { lat: 39.9, lon: 116.4, score: 58 },
        { lat: 31.2, lon: 121.5, score: 83 },
        { lat: 30.6, lon: 104.1, score: 60 },
        { lat: 22.5, lon: 114.1, score: null }
      ]
    }));
    gridService.getPublicMapCache = jest.fn(period => ({
      mode: 'hybrid',
      status: 'ready',
      cache: gridService.getBestAvailableCache(period)
    }));

    const res = await request(app).get('/api/spots/china').expect(200);

    expect(gridService.refreshIfStale).not.toHaveBeenCalled();
    expect(gridService.getBestAvailableCache).toHaveBeenCalledWith('sunset');
    expect(gridService.getPublicMapCache).toHaveBeenCalledWith('sunset');
    expect(res.body.updatedAt).toBe(updatedAt);
    expect(res.body.source).toBe('grid-product-cache');
    expect(res.body.degraded).toBe(false);
    // 业务当前阈值 MIN_SPOT_SCORE=40，58 分也应被包含
    expect(res.body.spots).toEqual([
      { lat: 31.2, lon: 121.5, score: 83, quality: '高分' },
      { lat: 30.6, lon: 104.1, score: 60, quality: '可观赏' },
      { lat: 39.9, lon: 116.4, score: 58, quality: '可观赏' }
    ]);
  });

  test('GET /api/spots/china 缓存未就绪时返回 503', async () => {
    gridService.refreshIfStale = jest.fn(async () => {});
    gridService.getCache = jest.fn(() => null);
    gridService.getBestAvailableCache = jest.fn(() => null);
    gridService.getPublicMapCache = jest.fn(period => ({
      mode: 'hybrid',
      status: 'not-ready',
      cache: gridService.getBestAvailableCache(period),
      degradedReason: 'GRID_PRODUCT_CACHE_NOT_READY'
    }));

    const res = await request(app).get('/api/spots/china').expect(503);

    expect(gridService.refreshIfStale).not.toHaveBeenCalled();
    expect(res.body.error).toMatchObject({
      code: 'GRID_NOT_READY'
    });
  });

  test('GET /api/spots/china/raster returns paused pipeline errors as 503', async () => {
    chinaRasterService.invalidateCache?.('all');
    gridService.refreshIfStale = jest.fn(async () => {});
    gridService.getCache = jest.fn(() => null);
    gridService.getPublicMapCache = jest.fn(() => ({
      mode: 'paused',
      status: 'paused',
      cache: null,
      degradedReason: 'DATA_PIPELINE_PAUSED'
    }));

    const res = await request(app).get('/api/spots/china/raster').expect(503);

    expect(gridService.refreshIfStale).not.toHaveBeenCalled();
    expect(res.body.error).toMatchObject({
      code: 'DATA_PIPELINE_PAUSED',
      status: 'paused',
      mode: 'paused'
    });
  });
});
