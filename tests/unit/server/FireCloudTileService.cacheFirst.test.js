import { jest } from '@jest/globals';

let FireCloudTileService;
let orchestrator;
let gridService;
let originalFetchWeatherData;
let originalGetBestAvailableCache;
let originalGetPublicMapCache;

beforeAll(async () => {
  const serviceMod = await import('../../../server/services/FireCloudTileService.js');
  FireCloudTileService = serviceMod.default || serviceMod;
  const orchestratorMod = await import('../../../server/services/ProviderOrchestrator.js');
  orchestrator = orchestratorMod.default || orchestratorMod;
  const gridMod = await import('../../../server/services/GridScoreService.js');
  gridService = gridMod.default || gridMod;
  originalFetchWeatherData = orchestrator.fetchWeatherData;
  originalGetBestAvailableCache = gridService.getBestAvailableCache;
  originalGetPublicMapCache = gridService.getPublicMapCache;
});

afterEach(() => {
  orchestrator.fetchWeatherData = originalFetchWeatherData;
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

describe('FireCloudTileService cache-first map path', () => {
  test('getGrid samples cached pipeline scores and never calls the weather orchestrator', async () => {
    orchestrator.fetchWeatherData = jest.fn().mockRejectedValue(new Error('external download should not run'));
    gridService.getBestAvailableCache = jest.fn().mockReturnValue({
      updatedAt: '2026-05-26T12:00:00.000Z',
      source: 'grid-product-cache',
      degraded: false,
      gridPoints: [
        { lat: 30, lon: 110, score: 70 },
        { lat: 31, lon: 111, score: 80 },
        { lat: 32, lon: 112, score: 90 }
      ]
    });
    gridService.getPublicMapCache = jest.fn(type => ({
      mode: 'hybrid',
      status: 'ready',
      cache: gridService.getBestAvailableCache(type)
    }));

    const service = new FireCloudTileService();
    const grid = await service.getGrid({
      bbox: '109,29,113,33',
      zoom: 4,
      time: 1779800000000,
      type: 'sunset'
    });

    expect(grid.meta.source).toBe('grid-product-cache');
    expect(grid.meta.status).toBe('ready');
    expect(grid.values.flat().some(value => value > 0)).toBe(true);
    expect(gridService.getBestAvailableCache).toHaveBeenCalledWith('sunset');
    expect(gridService.getPublicMapCache).toHaveBeenCalledWith('sunset');
    expect(orchestrator.fetchWeatherData).not.toHaveBeenCalled();
  });

  test('getGrid returns a degraded no-data grid when pipeline cache is missing', async () => {
    orchestrator.fetchWeatherData = jest.fn().mockRejectedValue(new Error('external download should not run'));
    gridService.getBestAvailableCache = jest.fn().mockReturnValue(null);
    gridService.getPublicMapCache = jest.fn(type => ({
      mode: 'hybrid',
      status: 'not-ready',
      cache: gridService.getBestAvailableCache(type),
      degradedReason: 'GRID_PRODUCT_CACHE_NOT_READY'
    }));

    const service = new FireCloudTileService();
    const grid = await service.getGrid({
      bbox: '109,29,113,33',
      zoom: 4,
      time: 1779800000000,
      type: 'sunset'
    });

    expect(grid.meta.status).toBe('not-ready');
    expect(grid.meta.degraded).toBe(true);
    expect(grid.values.flat().every(value => value === 0)).toBe(true);
    expect(orchestrator.fetchWeatherData).not.toHaveBeenCalled();
  });

  test('does not cache not-ready grids so new pipeline products are visible immediately', async () => {
    orchestrator.fetchWeatherData = jest.fn().mockRejectedValue(new Error('external download should not run'));
    gridService.getBestAvailableCache = jest.fn()
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({
        updatedAt: '2026-05-26T12:05:00.000Z',
        source: 'grid-product-cache',
        degraded: false,
        gridPoints: [{ lat: 30, lon: 110, score: 88 }]
      });
    gridService.getPublicMapCache = jest.fn(type => {
      const cache = gridService.getBestAvailableCache(type);
      return {
        mode: 'hybrid',
        status: cache ? 'ready' : 'not-ready',
        cache,
        degradedReason: cache ? null : 'GRID_PRODUCT_CACHE_NOT_READY'
      };
    });

    const service = new FireCloudTileService();
    const params = {
      bbox: '109,29,113,33',
      zoom: 4,
      time: 1779800000000,
      type: 'sunset'
    };

    const first = await service.getGrid(params);
    const second = await service.getGrid(params);

    expect(first.meta.status).toBe('not-ready');
    expect(second.meta.status).toBe('ready');
    expect(second.values.flat().some(value => value > 0)).toBe(true);
    expect(gridService.getBestAvailableCache).toHaveBeenCalledTimes(2);
    expect(gridService.getPublicMapCache).toHaveBeenCalledTimes(2);
  });

  test('does not cache PNG tiles rendered from not-ready grids', async () => {
    orchestrator.fetchWeatherData = jest.fn().mockRejectedValue(new Error('external download should not run'));
    gridService.getBestAvailableCache = jest.fn()
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({
        updatedAt: '2026-05-26T12:05:00.000Z',
        source: 'grid-product-cache',
        degraded: false,
        gridPoints: [{ lat: 30, lon: 110, score: 92 }]
      });
    gridService.getPublicMapCache = jest.fn(type => {
      const cache = gridService.getBestAvailableCache(type);
      return {
        mode: 'hybrid',
        status: cache ? 'ready' : 'not-ready',
        cache,
        degradedReason: cache ? null : 'GRID_PRODUCT_CACHE_NOT_READY'
      };
    });

    const service = new FireCloudTileService();
    const params = {
      z: 4,
      x: 12,
      y: 6,
      time: 1779800000000,
      type: 'sunset'
    };

    const first = await service.getTilePng(params);
    const second = await service.getTilePng(params);

    expect(first.equals(second)).toBe(false);
    expect(gridService.getBestAvailableCache).toHaveBeenCalledTimes(2);
    expect(gridService.getPublicMapCache).toHaveBeenCalledTimes(2);
  });
});
