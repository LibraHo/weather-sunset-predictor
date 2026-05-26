'use strict';

import { jest } from '@jest/globals';

let DataPipelineModeService;

beforeAll(async () => {
  const mod = await import('../../../server/services/DataPipelineModeService.js');
  DataPipelineModeService = mod.default || mod;
});

function makeGridService({ pipeline = null, legacy = null } = {}) {
  return {
    getPipelineCache: jest.fn(() => pipeline),
    getCache: jest.fn(() => legacy),
    getBestAvailableCache: jest.fn(() => {
      if (pipeline) return pipeline;
      if (!legacy) return null;
      return {
        ...legacy,
        source: 'openmeteo-grid-cache',
        degraded: true,
        degradedReason: 'GRID_PRODUCT_CACHE_NOT_READY'
      };
    }),
    refreshIfStale: jest.fn()
  };
}

function makeConfigService(mode) {
  return {
    getConfig: jest.fn(() => ({ mode }))
  };
}

function makeCache(source) {
  return {
    updatedAt: '2026-05-27T00:00:00.000Z',
    source,
    gridPoints: [{ lat: 39.9, lon: 116.4, score: 72 }]
  };
}

describe('DataPipelineModeService', () => {
  test('openmeteo mode reads only legacy Open-Meteo grid cache', () => {
    const pipeline = makeCache('gfs-cams-grid-product');
    const legacy = makeCache('openmeteo-grid-cache');
    const gridService = makeGridService({ pipeline, legacy });
    const service = new DataPipelineModeService({ configService: makeConfigService('openmeteo') });

    const result = service.getPublicMapCache(gridService, 'sunset');

    expect(result.cache).toMatchObject({ source: 'openmeteo-grid-cache', degraded: false });
    expect(gridService.getCache).toHaveBeenCalledWith('sunset');
    expect(gridService.getPipelineCache).not.toHaveBeenCalled();
    expect(gridService.refreshIfStale).not.toHaveBeenCalled();
  });

  test('gfs_cams mode reads only pipeline products and never falls back to legacy cache', () => {
    const legacy = makeCache('openmeteo-grid-cache');
    const gridService = makeGridService({ pipeline: null, legacy });
    const service = new DataPipelineModeService({ configService: makeConfigService('gfs_cams') });

    const result = service.getPublicMapCache(gridService, 'sunset');

    expect(result.cache).toBeNull();
    expect(result.status).toBe('not-ready');
    expect(result.degradedReason).toBe('GRID_PRODUCT_CACHE_NOT_READY');
    expect(gridService.getPipelineCache).toHaveBeenCalledWith('sunset');
    expect(gridService.getCache).not.toHaveBeenCalled();
    expect(gridService.refreshIfStale).not.toHaveBeenCalled();
  });

  test('hybrid mode reads pipeline first and uses legacy as degraded fallback', () => {
    const legacy = makeCache('openmeteo-grid-cache');
    const gridService = makeGridService({ pipeline: null, legacy });
    const service = new DataPipelineModeService({ configService: makeConfigService('hybrid') });

    const result = service.getPublicMapCache(gridService, 'sunset');

    expect(result.cache).toMatchObject({
      source: 'openmeteo-grid-cache',
      degraded: true,
      degradedReason: 'GRID_PRODUCT_CACHE_NOT_READY'
    });
    expect(gridService.getPipelineCache).toHaveBeenCalledWith('sunset');
    expect(gridService.getCache).toHaveBeenCalledWith('sunset');
    expect(gridService.refreshIfStale).not.toHaveBeenCalled();
  });

  test('cache_only mode reads existing caches without allowing public refresh', () => {
    const pipeline = makeCache('gfs-cams-grid-product');
    const legacy = makeCache('openmeteo-grid-cache');
    const gridService = makeGridService({ pipeline, legacy });
    const service = new DataPipelineModeService({ configService: makeConfigService('cache_only') });

    const result = service.getPublicMapCache(gridService, 'sunset');

    expect(result.cache).toMatchObject({ source: 'gfs-cams-grid-product', degraded: false });
    expect(result.allowPublicRefresh).toBe(false);
    expect(gridService.getPipelineCache).toHaveBeenCalledWith('sunset');
    expect(gridService.getCache).not.toHaveBeenCalled();
    expect(gridService.refreshIfStale).not.toHaveBeenCalled();
  });

  test('paused mode returns paused not-ready status without reading or refreshing caches', () => {
    const pipeline = makeCache('gfs-cams-grid-product');
    const legacy = makeCache('openmeteo-grid-cache');
    const gridService = makeGridService({ pipeline, legacy });
    const service = new DataPipelineModeService({ configService: makeConfigService('paused') });

    const result = service.getPublicMapCache(gridService, 'sunset');

    expect(result.cache).toBeNull();
    expect(result.status).toBe('paused');
    expect(result.degradedReason).toBe('DATA_PIPELINE_PAUSED');
    expect(gridService.getPipelineCache).not.toHaveBeenCalled();
    expect(gridService.getCache).not.toHaveBeenCalled();
    expect(gridService.refreshIfStale).not.toHaveBeenCalled();
  });
});
