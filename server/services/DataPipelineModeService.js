'use strict';

const DataPipelineConfigService = require('./DataPipelineConfigService');

const VALID_MODES = new Set(['openmeteo', 'gfs_cams', 'hybrid', 'cache_only', 'paused']);

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

    if (mode === 'paused') {
      return {
        ...base,
        status: 'paused',
        degradedReason: 'DATA_PIPELINE_PAUSED'
      };
    }

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
      return {
        ...base,
        status: 'ready',
        cache: {
          ...pipelineCache,
          degraded: pipelineCache.degraded === true,
          degradedReason: pipelineCache.degradedReason || null
        }
      };
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
