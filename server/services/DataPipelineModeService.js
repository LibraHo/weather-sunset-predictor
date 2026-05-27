'use strict';

const DataPipelineConfigService = require('./DataPipelineConfigService');

const VALID_MODES = new Set(['openmeteo', 'gfs_cams', 'hybrid', 'cache_only', 'paused']);
const MIN_PUBLIC_PIPELINE_POINTS = 100;

function withLegacyFallback(cache, degradedReason) {
  if (!cache) return null;
  return {
    ...cache,
    source: cache.source || 'openmeteo-grid-cache',
    degraded: true,
    degradedReason
  };
}

function withOpenMeteoCache(cache) {
  if (!cache) return null;
  return {
    ...cache,
    source: cache.source || 'openmeteo-grid-cache',
    degraded: cache.degraded === true,
    degradedReason: cache.degradedReason || null
  };
}

function pointCount(cache) {
  return Array.isArray(cache?.gridPoints) ? cache.gridPoints.length : 0;
}

function isSparsePipelineCache(cache) {
  return pointCount(cache) > 0 && pointCount(cache) < MIN_PUBLIC_PIPELINE_POINTS;
}

class DataPipelineModeService {
  constructor(options = {}) {
    this.configService = options.configService || new DataPipelineConfigService();
  }

  getMode() {
    const mode = this.configService.getConfig()?.mode || 'gfs_cams';
    return VALID_MODES.has(mode) ? mode : 'gfs_cams';
  }

  getPublicMapCache(gridService, period = 'sunset') {
    const mode = this.getMode();
    const base = {
      mode,
      status: 'not-ready',
      cache: null,
      allowPublicRefresh: false,
      degradedReason: null
    };

    if (mode === 'openmeteo') {
      const cache = withOpenMeteoCache(gridService.getCache(period));
      return cache
        ? { ...base, status: 'ready', cache }
        : { ...base, degradedReason: 'OPENMETEO_GRID_CACHE_NOT_READY' };
    }

    const pipelineCache = typeof gridService.getPipelineCache === 'function'
      ? gridService.getPipelineCache(period)
      : null;
    if (pipelineCache) {
      if (mode === 'hybrid' && isSparsePipelineCache(pipelineCache)) {
        const legacyCache = withLegacyFallback(gridService.getCache(period), 'GRID_PRODUCT_CACHE_SPARSE');
        if (legacyCache && pointCount(legacyCache) > pointCount(pipelineCache)) {
          return { ...base, status: 'ready', cache: legacyCache, degradedReason: 'GRID_PRODUCT_CACHE_SPARSE' };
        }
      }

      return {
        ...base,
        status: mode === 'paused' ? 'paused' : 'ready',
        cache: {
          ...pipelineCache,
          degraded: mode === 'paused' ? true : pipelineCache.degraded === true,
          degradedReason: mode === 'paused' ? 'DATA_PIPELINE_PAUSED' : pipelineCache.degradedReason || null
        },
        degradedReason: mode === 'paused' ? 'DATA_PIPELINE_PAUSED' : null
      };
    }

    if (mode === 'paused') {
      const legacyCache = withLegacyFallback(gridService.getCache(period), 'DATA_PIPELINE_PAUSED');
      return legacyCache
        ? { ...base, status: 'paused', cache: legacyCache, degradedReason: 'DATA_PIPELINE_PAUSED' }
        : { ...base, status: 'paused', degradedReason: 'DATA_PIPELINE_PAUSED' };
    }

    if (mode === 'gfs_cams') {
      return { ...base, degradedReason: 'GRID_PRODUCT_CACHE_NOT_READY' };
    }

    const legacyCache = withLegacyFallback(
      gridService.getCache(period),
      mode === 'cache_only' ? 'CACHE_ONLY_PIPELINE_CACHE_NOT_READY' : 'GRID_PRODUCT_CACHE_NOT_READY'
    );
    if (legacyCache) {
      return { ...base, status: 'ready', cache: legacyCache };
    }

    return {
      ...base,
      degradedReason: mode === 'cache_only' ? 'CACHE_ONLY_CACHE_NOT_READY' : 'GRID_PRODUCT_CACHE_NOT_READY'
    };
  }
}

module.exports = DataPipelineModeService;
