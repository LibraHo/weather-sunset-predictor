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

function makeCacheWithPoints(source, count) {
  return {
    updatedAt: '2026-05-27T00:00:00.000Z',
    source,
    gridPoints: Array.from({ length: count }, (_, index) => ({
      lat: 20 + index * 0.1,
      lon: 100 + index * 0.1,
      score: 60
    }))
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

  test('hybrid mode falls back when pipeline product is too sparse for public maps', () => {
    const pipeline = makeCacheWithPoints('grid-product-cache', 1);
    const legacy = makeCacheWithPoints('openmeteo-grid-cache', 1012);
    const gridService = makeGridService({ pipeline, legacy });
    const service = new DataPipelineModeService({ configService: makeConfigService('hybrid') });

    const result = service.getPublicMapCache(gridService, 'sunset');

    expect(result.cache).toMatchObject({
      source: 'openmeteo-grid-cache',
      degraded: true,
      degradedReason: 'GRID_PRODUCT_CACHE_SPARSE'
    });
    expect(result.status).toBe('ready');
    expect(result.degradedReason).toBe('GRID_PRODUCT_CACHE_SPARSE');
    expect(result.cache.gridPoints).toHaveLength(1012);
    expect(gridService.getPipelineCache).toHaveBeenCalledWith('sunset');
    expect(gridService.getCache).toHaveBeenCalledWith('sunset');
    expect(gridService.refreshIfStale).not.toHaveBeenCalled();
  });

  test('hybrid mode keeps sparse pipeline product when no better legacy cache exists', () => {
    const pipeline = makeCacheWithPoints('grid-product-cache', 1);
    const gridService = makeGridService({ pipeline, legacy: null });
    const service = new DataPipelineModeService({ configService: makeConfigService('hybrid') });

    const result = service.getPublicMapCache(gridService, 'sunset');

    expect(result.cache).toMatchObject({ source: 'grid-product-cache', degraded: false });
    expect(result.cache.gridPoints).toHaveLength(1);
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

  test('paused mode reads existing pipeline cache but still forbids refreshes', () => {
    const pipeline = makeCache('gfs-cams-grid-product');
    const legacy = makeCache('openmeteo-grid-cache');
    const gridService = makeGridService({ pipeline, legacy });
    const service = new DataPipelineModeService({ configService: makeConfigService('paused') });

    const result = service.getPublicMapCache(gridService, 'sunset');

    expect(result.cache).toMatchObject({
      source: 'gfs-cams-grid-product',
      degraded: true,
      degradedReason: 'DATA_PIPELINE_PAUSED'
    });
    expect(result.status).toBe('paused');
    expect(result.degradedReason).toBe('DATA_PIPELINE_PAUSED');
    expect(gridService.getPipelineCache).toHaveBeenCalledWith('sunset');
    expect(gridService.getCache).not.toHaveBeenCalled();
    expect(gridService.refreshIfStale).not.toHaveBeenCalled();
  });

  test('paused mode falls back to existing legacy cache and never starts refreshes', () => {
    const legacy = makeCache('openmeteo-grid-cache');
    const gridService = makeGridService({ pipeline: null, legacy });
    const service = new DataPipelineModeService({ configService: makeConfigService('paused') });

    const result = service.getPublicMapCache(gridService, 'sunset');

    expect(result.cache).toMatchObject({
      source: 'openmeteo-grid-cache',
      degraded: true,
      degradedReason: 'DATA_PIPELINE_PAUSED'
    });
    expect(result.status).toBe('paused');
    expect(gridService.getPipelineCache).toHaveBeenCalledWith('sunset');
    expect(gridService.getCache).toHaveBeenCalledWith('sunset');
    expect(gridService.refreshIfStale).not.toHaveBeenCalled();
  });
});
