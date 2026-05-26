'use strict';

const express = require('express');
const router = express.Router();
const gridService = require('../services/GridScoreService');

function readPublicMapCache(period) {
  if (typeof gridService.getPublicMapCache === 'function') {
    return gridService.getPublicMapCache(period);
  }
  const cache = typeof gridService.getBestAvailableCache === 'function'
    ? gridService.getBestAvailableCache(period)
    : gridService.getCache(period);
  return { mode: 'hybrid', status: cache ? 'ready' : 'not-ready', cache };
}

function notReadyError(modeResult) {
  return {
    code: modeResult.status === 'paused' ? 'DATA_PIPELINE_PAUSED' : 'GRID_NOT_READY',
    message: modeResult.status === 'paused' ? 'data pipeline is paused' : 'grid data is not ready',
    mode: modeResult.mode || null,
    status: modeResult.status || 'not-ready',
    degradedReason: modeResult.degradedReason || null
  };
}

router.get('/grid', async (req, res, next) => {
  try {
    const period = req.query.period || 'sunset';
    const modeResult = readPublicMapCache(period);
    const cache = modeResult.cache;
    if (!cache) {
      return res.status(503).json({ error: notReadyError(modeResult) });
    }

    res.json({
      updatedAt: cache.updatedAt,
      stale: cache.stale,
      count: cache.gridPoints.length,
      mode: modeResult.mode || null,
      source: cache.source || 'openmeteo-grid-cache',
      degraded: cache.degraded === true,
      degradedReason: cache.degradedReason || null,
      gridPoints: cache.gridPoints
    });
  } catch (err) {
    next(err);
  }
});

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

router.get('/status', (req, res) => {
  const period = req.query.period || 'sunset';
  res.json(gridService.getJobStatus(period));
});

module.exports = router;
