/**
 * Heatmap Routes - 晚霞评分热力地图 API（Phase 16）
 *
 * GET  /api/heatmap/grid    — 返回缓存的网格评分数据
 * POST /api/heatmap/refresh — 手动触发刷新（频控保护）
 */

const express = require('express');
const router = express.Router();
const gridService = require('../services/GridScoreService');

/**
 * GET /api/heatmap/grid
 * 返回缓存的网格评分，若无缓存则触发一次刷新
 */
router.get('/grid', async (req, res, next) => {
  try {
    const period = req.query.period || 'sunset';
    // 若缓存为空或过期，先刷新
    await gridService.refreshIfStale(undefined, period);

    const cache = gridService.getCache(period);
    if (!cache) {
      return res.status(503).json({
        error: { code: 'GRID_NOT_READY', message: '网格数据尚未就绪，请稍后再试' }
      });
    }

    res.json({
      updatedAt: cache.updatedAt,
      stale: cache.stale,
      count: cache.gridPoints.length,
      gridPoints: cache.gridPoints
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/heatmap/refresh
 * 手动触发刷新，60 分钟内限制一次
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const period = req.body?.period || req.query?.period || 'sunset';
    const result = await gridService.manualRefresh(period);
    if (!result.ok) {
      return res.status(429).json({ error: { code: 'RATE_LIMITED', message: result.message } });
    }
    const cache = gridService.getCache(period);
    res.json({
      period,
      message: result.message,
      updatedAt: cache?.updatedAt,
      count: cache?.gridPoints?.length
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/heatmap/status
 * 返回当前刷新任务状态
 */
router.get('/status', (req, res) => {
  const period = req.query.period || 'sunset';
  res.json(gridService.getJobStatus(period));
});

module.exports = router;
