/**
 * Spots Routes - 火烧云散点 API（Phase 16）
 *
 * GET  /api/spots/china  — 返回评分 >= 60 的中国散点数据
 */

const express = require('express');
const router = express.Router();
const gridService = require('../services/GridScoreService');

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
