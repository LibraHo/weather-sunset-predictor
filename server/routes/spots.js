/**
 * Spots Routes - 火烧云散点 API（Phase 16）
 *
 * GET  /api/spots/china          — 返回评分 >= 40 的中国散点数据
 * GET  /api/spots/china/raster   — 返回 IDW 插值后的连续栅格数据
 */

const express = require('express');
const router = express.Router();
const gridService = require('../services/GridScoreService');
const chinaRasterService = require('../services/ChinaRasterService');
const chinaRasterOverlayImageService = require('../services/ChinaRasterOverlayImageService');
const { isSupportedFirecloudRegion } = require('../utils/SupportedFirecloudRegion');
const { getQualityConfig, getQualityLevel } = require('../config/qualityLevels');
const {
  renderRasterOverlayPng,
  scoreToRasterRgba
} = require('../services/ChinaRasterOverlayImageService');

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sampleRasterScore(raster, lat, lon) {
  if (!raster || !Array.isArray(raster.values) || !raster.bbox) return null;

  const { bbox, width, height, values, noData = -1 } = raster;
  const { west, east, south, north } = bbox;
  if (![lat, lon, width, height].every(Number.isFinite)) return null;
  if (lon < west || lon > east || lat < south || lat > north) return null;

  const x = ((lon - west) / (east - west)) * (width - 1);
  const y = ((north - lat) / (north - south)) * (height - 1);

  const col = clamp(Math.round(x), 0, width - 1);
  const row = clamp(Math.round(y), 0, height - 1);
  const score = values[row * width + col];

  return (typeof score === 'number' && score !== noData && score >= 0) ? score : null;
}

const SUPPORTED_PERIODS = ['sunrise', 'sunset'];
const MIN_SPOT_SCORE = 40;

function normalizeSpotsPeriod(period) {
  const safe = typeof period === 'string' ? period.toLowerCase() : '';
  return SUPPORTED_PERIODS.includes(safe) ? safe : null;
}

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

function isRasterNotReadyError(err) {
  const message = String(err?.message || '');
  return err?.code === 'RASTER_NOT_READY'
    || err?.code === 'DATA_PIPELINE_PAUSED'
    || message.includes('尚未就绪');
}

function rasterNotReadyError(err) {
  const code = err?.code === 'DATA_PIPELINE_PAUSED' ? 'DATA_PIPELINE_PAUSED' : 'RASTER_NOT_READY';
  return {
    code,
    message: err?.message || (code === 'DATA_PIPELINE_PAUSED' ? 'data pipeline is paused' : 'raster data is not ready'),
    mode: err?.mode || null,
    status: err?.status || (code === 'DATA_PIPELINE_PAUSED' ? 'paused' : 'not-ready'),
    degradedReason: err?.degradedReason || null
  };
}

/**
 * GET /api/spots/china
 * 从 GridScoreService 缓存中返回评分 >= 40 的散点数据
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

    const modeResult = readPublicMapCache(period);
    const cache = modeResult.cache;
    if (!cache) {
      return res.status(503).json({ error: notReadyError(modeResult) });
    }

    const today = new Date().toISOString().slice(0, 10);
    const spots = cache.gridPoints
      .filter(p => typeof p.score === 'number' && p.score >= MIN_SPOT_SCORE && isSupportedFirecloudRegion(p.lat, p.lon))
      .map(p => {
        const quality = getQualityLevel(p.score);
        return {
          lat: p.lat,
          lon: p.lon,
          score: p.score,
          quality,
          qualityLabelKey: getQualityConfig(quality).labelKey
        };
      })
      .sort((a, b) => b.score - a.score);

    res.json({
      updatedAt: cache.updatedAt,
      date: today,
      period,
      mode: modeResult.mode || null,
      source: cache.source || 'openmeteo-grid-cache',
      degraded: cache.degraded === true,
      degradedReason: cache.degradedReason || null,
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

    const rawLat = parseFloat(req.query?.lat);
    const rawLon = parseFloat(req.query?.lon);
    if (Number.isFinite(rawLat) && Number.isFinite(rawLon)) {
      const score = sampleRasterScore(raster, rawLat, rawLon);
      return res.json({
        ...raster,
        lat: rawLat,
        lon: rawLon,
        score
      });
    }

    res.json(raster);
  } catch (err) {
    if (isRasterNotReadyError(err)) {
      return res.status(503).json({ error: rasterNotReadyError(err) });
    }
    next(err);
  }
});

router.get('/china/raster-overlay.png', async (req, res, next) => {
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
    const resolution = (!isNaN(rawRes) && rawRes >= 0.1 && rawRes <= 2) ? rawRes : 0.25;
    const overlay = await chinaRasterOverlayImageService.getOverlayPng(period, resolution);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('X-Firecloud-Raster-Updated-At', overlay.rasterUpdatedAt || '');
    res.send(overlay.png);
  } catch (err) {
    if (isRasterNotReadyError(err)) {
      return res.status(503).json({ error: rasterNotReadyError(err) });
    }
    next(err);
  }
});

module.exports = router;
module.exports.normalizeSpotsPeriod = normalizeSpotsPeriod;
module.exports.SUPPORTED_PERIODS = SUPPORTED_PERIODS;
module.exports.renderRasterOverlayPng = renderRasterOverlayPng;
module.exports.scoreToRasterRgba = scoreToRasterRgba;
