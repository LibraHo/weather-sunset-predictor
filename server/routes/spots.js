/**
 * Spots Routes - 火烧云散点 API（Phase 16）
 *
 * GET  /api/spots/china          — 返回评分 >= 60 的中国散点数据
 * GET  /api/spots/china/raster   — 返回中国区域连续栅格数据（IDW 插值）
 */

const express = require('express');
const router = express.Router();
const gridService = require('../services/GridScoreService');
const IDWInterpolator = require('../utils/IDWInterpolator');

const SUPPORTED_PERIODS = ['sunrise', 'sunset'];

function normalizeSpotsPeriod(period) {
  const safe = typeof period === 'string' ? period.toLowerCase() : '';
  return SUPPORTED_PERIODS.includes(safe) ? safe : null;
}

/**
 * GET /api/spots/china
 * 从 GridScoreService 缓存中返回评分 >= 60 的散点数据
 */
router.get('/china', async (req, res, next) => {
  try {
    const period = normalizeSpotsPeriod(req.query?.period || 'sunset');
    if (!period) {
      return res.status(400).json({
        error: {
          code: 'INVALID_PERIOD',
          message: 'period 仅支持 sunrise 或 sunset'
        }
      });
    }

    await gridService.refreshIfStale(undefined, period);

    const cache = gridService.getCache(period);
    if (!cache) {
      return res.status(503).json({
        error: { code: 'GRID_NOT_READY', message: '网格数据尚未就绪，请稍后再试' }
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const spots = cache.gridPoints
      .filter(p => typeof p.score === 'number' && p.score >= 60)
      .map(p => ({
        lat: p.lat,
        lon: p.lon,
        score: p.score,
        quality: p.score >= 80 ? '顶级' : '优质'
      }))
      .sort((a, b) => b.score - a.score);

    res.json({
      updatedAt: cache.updatedAt,
      date: today,
      period,
      spots
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.normalizeSpotsPeriod = normalizeSpotsPeriod;
module.exports.SUPPORTED_PERIODS = SUPPORTED_PERIODS;

/**
 * GET /api/spots/china/raster
 * 返回中国区域连续栅格数据（IDW 插值）
 *
 * Response 格式：
 * {
 *   date: "2026-03-21",
 *   updatedAt: "2026-03-21T00:00:00.000Z",
 *   bbox: { west, south, east, north },
 *   resolution: 0.5,
 *   width: 127,
 *   height: 71,
 *   valueRange: [0, 100],
 *   noData: -1,
 *   values: [ ... row-major ... ],
 *   meta: { interpolation, ... }
 * }
 */
router.get('/china/raster', async (req, res, next) => {
  try {
    const period = normalizeSpotsPeriod(req.query?.period || 'sunset');
    if (!period) {
      return res.status(400).json({
        error: {
          code: 'INVALID_PERIOD',
          message: 'period 仅支持 sunrise 或 sunset'
        }
      });
    }

    // 解析分辨率参数
    const resolution = parseFloat(req.query?.resolution || '0.5');
    if (isNaN(resolution) || resolution < 0.1 || resolution > 2.0) {
      return res.status(400).json({
        error: {
          code: 'INVALID_RESOLUTION',
          message: 'resolution 必须在 0.1 到 2.0 之间（度）'
        }
      });
    }

    await gridService.refreshIfStale(undefined, period);

    const cache = gridService.getCache(period);
    if (!cache) {
      return res.status(503).json({
        error: { code: 'GRID_NOT_READY', message: '网格数据尚未就绪，请稍后再试' }
      });
    }

    const today = new Date().toISOString().slice(0, 10);

    // 中国大陆边界（从 GridScoreService 获取）
    const bbox = {
      west: gridService.CHINA_BOUNDS.lonMin,
      south: gridService.CHINA_BOUNDS.latMin,
      east: gridService.CHINA_BOUNDS.lonMax,
      north: gridService.CHINA_BOUNDS.latMax
    };

    // 创建 IDW 插值器
    const interpolator = new IDWInterpolator({
      power: 2,
      maxRadiusKm: 350,
      minNeighbors: 3
    });

    // 过滤有效的评分点
    const validPoints = cache.gridPoints.filter(p =>
      typeof p.score === 'number' && !isNaN(p.score) && p.score !== null && p.score >= 0
    );

    if (validPoints.length === 0) {
      return res.status(503).json({
        error: { code: 'NO_VALID_POINTS', message: '暂无有效评分点' }
      });
    }

    // 执行 IDW 插值
    const { width, height, values, meta } = interpolator.interpolate(
      validPoints,
      bbox,
      resolution
    );

    // 计算 valueRange
    const validValues = values.filter(v => v !== -1);
    const valueRange = validValues.length > 0
      ? [Math.min(...validValues), Math.max(...validValues)]
      : [0, 0];

    // 返回 Grid Raster 格式
    res.json({
      date: today,
      updatedAt: cache.updatedAt,
      bbox,
      resolution,
      width,
      height,
      valueRange,
      noData: -1,
      values,
      meta: {
        period,
        interpolation: 'IDW',
        idwPower: meta.power,
        sourcePoints: meta.sourcePoints,
        cacheAge: Date.now() - new Date(cache.updatedAt).getTime()
      }
    });
  } catch (err) {
    console.error('[Spots Routes] /china/raster 错误:', err);
    next(err);
  }
});

module.exports = router;
module.exports.normalizeSpotsPeriod = normalizeSpotsPeriod;
module.exports.SUPPORTED_PERIODS = SUPPORTED_PERIODS;
