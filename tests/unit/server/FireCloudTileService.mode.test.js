import { jest } from '@jest/globals';

let FireCloudTileService;
let gridService;
let originalGetPublicMapCache;

beforeAll(async () => {
  const fireMod = await import('../../../server/services/FireCloudTileService.js');
  FireCloudTileService = fireMod.default || fireMod;
  const gridMod = await import('../../../server/services/GridScoreService.js');
  gridService = gridMod.default || gridMod;
  originalGetPublicMapCache = gridService.getPublicMapCache;
});

afterEach(() => {
  gridService.getPublicMapCache = originalGetPublicMapCache;
});

describe('FireCloudTileService mode policy', () => {
  test('paused mode returns paused grid metadata and does not cache it', async () => {
    gridService.getPublicMapCache = jest.fn()
      .mockReturnValueOnce({
        mode: 'paused',
        status: 'paused',
        cache: null,
        degradedReason: 'DATA_PIPELINE_PAUSED'
      })
      .mockReturnValueOnce({
        mode: 'gfs_cams',
        status: 'ready',
        cache: {
          updatedAt: '2026-05-27T00:00:00.000Z',
          source: 'grid-product-cache',
          degraded: false,
          gridPoints: [{ lat: 40, lon: 116, score: 88 }]
        }
      });
    const service = new FireCloudTileService();

    const paused = await service.getGrid({
      bbox: '115,39,117,41',
      zoom: 6,
      time: 123,
      type: 'sunset'
    });
    const ready = await service.getGrid({
      bbox: '115,39,117,41',
      zoom: 6,
      time: 123,
      type: 'sunset'
    });

    expect(paused.meta).toMatchObject({
      status: 'paused',
      mode: 'paused',
      degraded: true,
      degradedReason: 'DATA_PIPELINE_PAUSED'
    });
    expect(ready.meta).toMatchObject({
      status: 'ready',
      mode: 'gfs_cams',
      source: 'grid-product-cache'
    });
    expect(gridService.getPublicMapCache).toHaveBeenCalledTimes(2);
  });
});
