/**
 * Spots Routes - 火烧云散点 API（Phase 16）
 *
 * GET  /api/spots/china          — 返回评分 >= 60 的中国散点数据
 * GET  /api/spots/china/raster   — 返回 IDW 插值后的连续栅格数据
 */

const express = require('express');
const router = express.Router();
const gridService = require('../services/GridScoreService');
const chinaRasterService = require('../services/ChinaRasterService');

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

/**
 * GET /api/spots/china/raster
 *
 * 返回中国大陆火烧云连续栅格（IDW 插值）
 *
 * 查询参数：
 *   period     - 'sunrise' 或 'sunset'（默认 sunset）
 *   resolution - 格距（度），范围 0.1~2，默认 0.5
 *
 * 响应示例：
 * {
 *   date, updatedAt, period, bbox, resolution,
 *   width, height, valueRange, noData,
 *   values: number[],   // row-major，noData=-1
 *   meta: { interpolation, idwPower, sourcePoints, ... }
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

    const rawRes = parseFloat(req.query?.resolution);
    const resolution = (!isNaN(rawRes) && rawRes >= 0.1 && rawRes <= 2) ? rawRes : 0.5;

    const raster = await chinaRasterService.getRaster(period, resolution);
    res.json(raster);
  } catch (err) {
    if (err.message && err.message.includes('尚未就绪')) {
      return res.status(503).json({
        error: { code: 'RASTER_NOT_READY', message: err.message }
      });
    }
    next(err);
  }
});

module.exports = router;
module.exports.normalizeSpotsPeriod = normalizeSpotsPeriod;
module.exports.SUPPORTED_PERIODS = SUPPORTED_PERIODS;
