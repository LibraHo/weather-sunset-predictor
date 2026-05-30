/**
 * ChinaRasterService - 东亚火烧云连续栅格服务
 *
 * 职责：
 * 1. 从 GridScoreService 拿到缓存散点（score >= 0 的所有点）
 * 2. 使用 IDW 插值生成 0.5° 分辨率栅格
 * 3. 缓存插值结果（15分钟 TTL，随散点缓存联动）
 *
 * 输出格式（符合 firecloud-continuous-overlay-research.md 设计）：
 * {
 *   date, updatedAt, bbox, resolution,
 *   width, height, valueRange, noData,
 *   values: number[],  // row-major
 *   meta: { interpolation, idwPower, source }
 * }
 */

const { IdwInterpolator } = require('../utils/IdwInterpolator');
const gridService = require('./GridScoreService');
const { isSupportedFirecloudRegion } = require('../utils/SupportedFirecloudRegion');

// 东亚渲染覆盖范围：包含中国大陆、台湾、韩国、日本
const EAST_ASIA_BBOX = {
  west: 72,
  east: 146,
  south: 18,
  north: 53
};

const DEFAULT_RESOLUTION = 0.5; // 度
const NO_DATA_VALUE = -1;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 分钟

const IDW_OPTIONS = {
  power: 2,
  maxRadiusKm: 350,
  minNeighbors: 3
};

function getSpotsCache(period) {
  if (typeof gridService.getPublicMapCache === 'function') {
    const result = gridService.getPublicMapCache(period);
    if (result.cache) return result.cache;
    return {
      _notReady: true,
      mode: result.mode || null,
      status: result.status || 'not-ready',
      degradedReason: result.degradedReason || null,
      gridPoints: []
    };
  }
  return typeof gridService.getBestAvailableCache === 'function'
    ? gridService.getBestAvailableCache(period)
    : gridService.getCache(period);
}

function getSourceSignature(spotsCache) {
  if (!spotsCache) return 'missing';
  return [
    spotsCache.source || 'unknown',
    spotsCache.updatedAt || '',
    spotsCache.degraded === true ? 'degraded' : 'ready',
    spotsCache.degradedReason || '',
    Array.isArray(spotsCache.gridPoints) ? spotsCache.gridPoints.length : 0
  ].join('|');
}

class ChinaRasterService {
  constructor() {
    this._cache = {
      sunrise: {},
      sunset: {}
    };
    if (typeof gridService.onRefreshComplete === 'function') {
      gridService.onRefreshComplete(({ period }) => {
        this.warmCache(period).catch(err => {
          console.warn(`[ChinaRasterService] raster cache warm failed (${period}):`, err.message);
        });
      });
    }
  }

  _getResolutionKey(resolution) {
    return String(resolution);
  }

  /**
   * 获取栅格数据（优先读缓存）
   * @param {'sunrise'|'sunset'} period
   * @param {number} [resolution=0.5]
   * @returns {Promise<Object>} 栅格响应对象
   */
  async getRaster(period = 'sunset', resolution = DEFAULT_RESOLUTION) {
    const safePeriod = ['sunrise', 'sunset'].includes(period) ? period : 'sunset';
    const safeRes = typeof resolution === 'number' && resolution > 0 && resolution <= 2
      ? resolution
      : DEFAULT_RESOLUTION;

    // 先检查本地缓存：TTL 必须基于服务端生成时间，而不是天气数据 updatedAt
    // updatedAt 是预报数据时间，可能来自昨晚；若用它计算 age，会导致缓存永远过期，接口每次重新 IDW 插值。
    let spotsCache = null;
    const resolutionKey = this._getResolutionKey(safeRes);
    const cached = this._cache[safePeriod]?.[resolutionKey];
    if (cached && cached.resolution === safeRes && cached._cachedAt) {
      const age = Date.now() - cached._cachedAt;
      if (age < CACHE_TTL_MS) {
        if (cached.meta?.degraded !== true) {
          return cached;
        }

        spotsCache = getSpotsCache(safePeriod);
        if (getSourceSignature(spotsCache) === cached._sourceSignature) {
          return cached;
        }
      }
    }

    // Public map reads are cache-first. They must not start Open-Meteo refreshes.
    if (!spotsCache) {
      spotsCache = getSpotsCache(safePeriod);
    }

    if (spotsCache?._notReady) {
      const err = new Error(spotsCache.status === 'paused' ? 'data pipeline is paused' : '散点数据尚未就绪，请稍后重试');
      err.code = spotsCache.status === 'paused' ? 'DATA_PIPELINE_PAUSED' : 'RASTER_NOT_READY';
      err.mode = spotsCache.mode || null;
      err.status = spotsCache.status || 'not-ready';
      err.degradedReason = spotsCache.degradedReason || null;
      throw err;
    }

    if (!spotsCache || !spotsCache.gridPoints || spotsCache.gridPoints.length === 0) {
      throw new Error('散点数据尚未就绪，请稍后重试');
    }

    const points = spotsCache.gridPoints.filter(
      p => typeof p.score === 'number' && p.score >= 0
    ).map(p => ({ lat: p.lat, lon: p.lon, score: p.score }));

    if (points.length === 0) {
      throw new Error('无有效散点数据用于插值');
    }

    // IDW 插值
    const idw = new IdwInterpolator(IDW_OPTIONS);
    const { width, height, values } = idw.interpolateGrid(points, {
      ...EAST_ASIA_BBOX,
      resolution: safeRes
    });

    const maskedValues = values.map((value, index) => {
      const row = Math.floor(index / width);
      const col = index % width;
      const lat = EAST_ASIA_BBOX.north - (row + 0.5) * safeRes;
      const lon = EAST_ASIA_BBOX.west + (col + 0.5) * safeRes;
      return isSupportedFirecloudRegion(lat, lon) ? value : NO_DATA_VALUE;
    });

    const generatedAt = new Date().toISOString();
    const sourceUpdatedAt = spotsCache.updatedAt || null;
    const today = generatedAt.slice(0, 10);
    const raster = {
      date: today,
      // updatedAt is the raster/cache generation time shown in UI. The source
      // timestamp can be a forecast valid time in the future, so keep it as metadata.
      updatedAt: generatedAt,
      generatedAt,
      sourceUpdatedAt,
      period: safePeriod,
      bbox: EAST_ASIA_BBOX,
      resolution: safeRes,
      width,
      height,
      valueRange: [0, 100],
      noData: NO_DATA_VALUE,
      values: maskedValues,
      _cachedAt: Date.now(),
      _sourceSignature: getSourceSignature(spotsCache),
      meta: {
        interpolation: 'idw',
        idwPower: IDW_OPTIONS.power,
        maxRadiusKm: IDW_OPTIONS.maxRadiusKm,
        minNeighbors: IDW_OPTIONS.minNeighbors,
        sourcePoints: points.length,
        source: spotsCache.source || 'east-asia-spots-cache',
        degraded: spotsCache.degraded === true,
        degradedReason: spotsCache.degradedReason || null
      }
    };

    if (!this._cache[safePeriod]) {
      this._cache[safePeriod] = {};
    }
    this._cache[safePeriod][resolutionKey] = raster;
    return raster;
  }

  async warmCache(period = 'sunset', resolutions = [0.25, 0.5]) {
    const safePeriod = ['sunrise', 'sunset'].includes(period) ? period : 'sunset';
    this.invalidateCache(safePeriod);
    const warmed = [];
    for (const resolution of resolutions) {
      warmed.push(await this.getRaster(safePeriod, resolution));
    }
    return warmed;
  }

  /**
   * 使缓存失效（供测试或手动刷新调用）
   * @param {'sunrise'|'sunset'|'all'} period
   */
  invalidateCache(period = 'all') {
    if (period === 'all') {
      this._cache.sunrise = {};
      this._cache.sunset = {};
    } else {
      this._cache[period] = {};
    }
  }
}

module.exports = new ChinaRasterService();
