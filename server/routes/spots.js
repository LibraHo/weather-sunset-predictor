/**
 * Spots Routes - 火烧云散点 API（Phase 16）
 *
 * GET  /api/spots/china  — 返回评分 >= 60 的中国散点数据
 */

const express = require('express');
const router = express.Router();
const gridService = require('../services/GridScoreService');

/**
 * GET /api/spots/china
 * 从 GridScoreService 缓存中返回所有采样点，前端自行决定渲染逻辑
 */
router.get('/china', async (req, res, next) => {
  try {
    await gridService.refreshIfStale();

    const cache = gridService.getCache();
    if (!cache) {
      return res.status(503).json({
        error: { code: 'GRID_NOT_READY', message: '网格数据尚未就绪，请稍后再试' }
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const spots = cache.gridPoints
      .filter(p => p.score != null)
      .map(p => ({
        lat: p.lat,
        lon: p.lon,
        score: p.score,
        quality: p.score >= 80 ? '顶级' : p.score >= 60 ? '优质' : p.score >= 40 ? '良好' : '一般'
      }));

    res.json({
      updatedAt: cache.updatedAt,
      date: today,
      spots
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
