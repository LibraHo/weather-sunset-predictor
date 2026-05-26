import express from 'express';
import { jest } from '@jest/globals';
import { TextDecoder, TextEncoder } from 'util';

let request;
let gridService;
let originalRefreshIfStale;
let originalGetCache;
let originalGetBestAvailableCache;
let originalGetPublicMapCache;

beforeAll(async () => {
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
  request = (await import('supertest')).default;
  const gridMod = await import('../../../server/services/GridScoreService.js');
  gridService = gridMod.default || gridMod;
  originalRefreshIfStale = gridService.refreshIfStale;
  originalGetCache = gridService.getCache;
  originalGetBestAvailableCache = gridService.getBestAvailableCache;
  originalGetPublicMapCache = gridService.getPublicMapCache;
});

afterEach(() => {
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
});

async function makeApp() {
  const routeMod = await import(`../../../server/routes/heatmap.js?case=${Date.now()}-${Math.random()}`);
  const app = express();
  app.use(express.json());
  app.use('/api/heatmap', routeMod.default || routeMod);
  return app;
}

describe('heatmap public grid route', () => {
  test('GET /grid reads best available cache without triggering refresh', async () => {
    gridService.refreshIfStale = jest.fn().mockResolvedValue(undefined);
    gridService.getCache = jest.fn().mockReturnValue(null);
    gridService.getBestAvailableCache = jest.fn().mockReturnValue({
      updatedAt: '2026-05-26T12:00:00.000Z',
      stale: false,
      source: 'grid-product-cache',
      degraded: false,
      gridPoints: [{ lat: 40, lon: 116, score: 82 }]
    });
    gridService.getPublicMapCache = jest.fn(period => ({
      mode: 'hybrid',
      status: 'ready',
      cache: gridService.getBestAvailableCache(period)
    }));

    const res = await request(await makeApp())
      .get('/api/heatmap/grid')
      .query({ period: 'sunset' })
      .expect(200);

    expect(res.body).toMatchObject({
      updatedAt: '2026-05-26T12:00:00.000Z',
      count: 1,
      source: 'grid-product-cache',
      degraded: false
    });
    expect(gridService.getBestAvailableCache).toHaveBeenCalledWith('sunset');
    expect(gridService.getPublicMapCache).toHaveBeenCalledWith('sunset');
    expect(gridService.refreshIfStale).not.toHaveBeenCalled();
  });

  test('GET /grid returns not-ready when no cache exists and still does not refresh', async () => {
    gridService.refreshIfStale = jest.fn().mockResolvedValue(undefined);
    gridService.getCache = jest.fn().mockReturnValue(null);
    gridService.getBestAvailableCache = jest.fn().mockReturnValue(null);
    gridService.getPublicMapCache = jest.fn(period => ({
      mode: 'hybrid',
      status: 'not-ready',
      cache: gridService.getBestAvailableCache(period),
      degradedReason: 'GRID_PRODUCT_CACHE_NOT_READY'
    }));

    const res = await request(await makeApp())
      .get('/api/heatmap/grid')
      .expect(503);

    expect(res.body.error.code).toBe('GRID_NOT_READY');
    expect(gridService.refreshIfStale).not.toHaveBeenCalled();
  });
});
