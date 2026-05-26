import express from 'express';
import { jest } from '@jest/globals';
import { TextDecoder, TextEncoder } from 'util';

let request;
let gridService;
let originalGetPublicMapCache;
let originalRefreshIfStale;

beforeAll(async () => {
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
  request = (await import('supertest')).default;
  const gridMod = await import('../../../server/services/GridScoreService.js');
  gridService = gridMod.default || gridMod;
  originalGetPublicMapCache = gridService.getPublicMapCache;
  originalRefreshIfStale = gridService.refreshIfStale;
});

afterEach(() => {
  gridService.getPublicMapCache = originalGetPublicMapCache;
  gridService.refreshIfStale = originalRefreshIfStale;
});

async function makeApp() {
  const routeMod = await import(`../../../server/routes/heatmap.js?mode=${Date.now()}-${Math.random()}`);
  const app = express();
  app.use(express.json());
  app.use('/api/heatmap', routeMod.default || routeMod);
  return app;
}

describe('heatmap mode policy', () => {
  test('paused mode returns paused not-ready without public refresh', async () => {
    gridService.refreshIfStale = jest.fn();
    gridService.getPublicMapCache = jest.fn(() => ({
      mode: 'paused',
      status: 'paused',
      cache: null,
      degradedReason: 'DATA_PIPELINE_PAUSED'
    }));

    const res = await request(await makeApp())
      .get('/api/heatmap/grid')
      .query({ period: 'sunset' })
      .expect(503);

    expect(res.body.error).toMatchObject({
      code: 'DATA_PIPELINE_PAUSED',
      status: 'paused'
    });
    expect(gridService.getPublicMapCache).toHaveBeenCalledWith('sunset');
    expect(gridService.refreshIfStale).not.toHaveBeenCalled();
  });

  test('gfs_cams mode not-ready does not fall back or refresh on the route', async () => {
    gridService.refreshIfStale = jest.fn();
    gridService.getPublicMapCache = jest.fn(() => ({
      mode: 'gfs_cams',
      status: 'not-ready',
      cache: null,
      degradedReason: 'GRID_PRODUCT_CACHE_NOT_READY'
    }));

    const res = await request(await makeApp())
      .get('/api/heatmap/grid')
      .query({ period: 'sunset' })
      .expect(503);

    expect(res.body.error).toMatchObject({
      code: 'GRID_NOT_READY',
      mode: 'gfs_cams',
      degradedReason: 'GRID_PRODUCT_CACHE_NOT_READY'
    });
    expect(gridService.refreshIfStale).not.toHaveBeenCalled();
  });
});
