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
const { isSupportedFirecloudRegion } = require('../utils/SupportedFirecloudRegion');

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

    await gridService.refreshIfStale(undefined, period);

    const cache = gridService.getCache(period);
    if (!cache) {
      return res.status(503).json({
        error: { code: 'GRID_NOT_READY', message: '网格数据尚未就绪，请稍后再试' }
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const spots = cache.gridPoints
      .filter(p => typeof p.score === 'number' && p.score >= MIN_SPOT_SCORE && isSupportedFirecloudRegion(p.lat, p.lon))
      .map(p => ({

        lat: p.lat,
        lon: p.lon,
        score: p.score,
        quality: p.score >= 80 ? '顶级' : (p.score >= 60 ? '优质' : '可观赏')
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
