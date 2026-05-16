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
const PngEncoder = require('../utils/PngEncoder');

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
const RASTER_VISUAL_MIN_SCORE = 40;
const RASTER_FULL_SCORE = 70;
const RASTER_BAND_LEVELS = [40, 45, 50, 55, 60, 65, 70];
const RASTER_PALETTES = {
  sunset: [
    { t: 0.00, r: 255, g: 236, b: 212, a: 0.05 },
    { t: 0.12, r: 255, g: 218, b: 176, a: 0.10 },
    { t: 0.28, r: 255, g: 194, b: 132, a: 0.18 },
    { t: 0.46, r: 255, g: 166, b: 92, a: 0.26 },
    { t: 0.64, r: 248, g: 132, b: 54, a: 0.35 },
    { t: 0.82, r: 235, g: 100, b: 38, a: 0.44 },
    { t: 1.00, r: 218, g: 78, b: 28, a: 0.55 }
  ],
  sunrise: [
    { t: 0.00, r: 255, g: 236, b: 214, a: 0.06 },
    { t: 0.12, r: 255, g: 220, b: 184, a: 0.12 },
    { t: 0.28, r: 255, g: 196, b: 150, a: 0.22 },
    { t: 0.46, r: 255, g: 166, b: 112, a: 0.32 },
    { t: 0.64, r: 248, g: 132, b: 82, a: 0.42 },
    { t: 0.82, r: 236, g: 104, b: 62, a: 0.54 },
    { t: 1.00, r: 222, g: 84, b: 46, a: 0.65 }
  ]
};

function normalizeSpotsPeriod(period) {
  const safe = typeof period === 'string' ? period.toLowerCase() : '';
  return SUPPORTED_PERIODS.includes(safe) ? safe : null;
}

function lerp(start, end, t) {
  return start + (end - start) * t;
}

function smoothstep01(t) {
  const value = clamp(t, 0, 1);
  return value * value * (3 - 2 * value);
}

function samplePalette(t, palette) {
  const value = clamp(t, 0, 1);
  for (let index = 0; index < palette.length - 1; index += 1) {
    const low = palette[index];
    const high = palette[index + 1];
    if (value >= low.t && value <= high.t) {
      const localT = (value - low.t) / (high.t - low.t || 1);
      return {
        r: Math.round(lerp(low.r, high.r, localT)),
        g: Math.round(lerp(low.g, high.g, localT)),
        b: Math.round(lerp(low.b, high.b, localT)),
        a: clamp(lerp(low.a, high.a, localT), 0, 1)
      };
    }
  }
  return palette[palette.length - 1];
}

function scoreToRasterRgba(score, period = 'sunset') {
  if (!Number.isFinite(score) || score < RASTER_VISUAL_MIN_SCORE) return { r: 0, g: 0, b: 0, a: 0 };
  const palette = RASTER_PALETTES[period] || RASTER_PALETTES.sunset;
  const clamped = clamp(score, RASTER_VISUAL_MIN_SCORE, RASTER_FULL_SCORE);
  let bandIndex = 0;
  while (bandIndex < RASTER_BAND_LEVELS.length - 1 && clamped >= RASTER_BAND_LEVELS[bandIndex + 1]) {
    bandIndex += 1;
  }
  const bandLo = RASTER_BAND_LEVELS[bandIndex];
  const bandHi = RASTER_BAND_LEVELS[Math.min(bandIndex + 1, RASTER_BAND_LEVELS.length - 1)];
  const localT = bandHi === bandLo ? 1 : smoothstep01((clamped - bandLo) / (bandHi - bandLo));
  const globalLoT = (bandLo - RASTER_VISUAL_MIN_SCORE) / (RASTER_FULL_SCORE - RASTER_VISUAL_MIN_SCORE);
  const globalHiT = (bandHi - RASTER_VISUAL_MIN_SCORE) / (RASTER_FULL_SCORE - RASTER_VISUAL_MIN_SCORE);
  return samplePalette(lerp(globalLoT, globalHiT, localT), palette);
}

function renderRasterOverlayPng(raster, period) {
  const { width, height, values, noData = -1 } = raster || {};
  if (!width || !height || !Array.isArray(values)) {
    throw new Error('Invalid raster data');
  }
  const rgba = new Uint8Array(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    const score = Number(values[index]);
    const color = score === noData ? { r: 0, g: 0, b: 0, a: 0 } : scoreToRasterRgba(score, period);
    const offset = index * 4;
    rgba[offset] = color.r;
    rgba[offset + 1] = color.g;
    rgba[offset + 2] = color.b;
    rgba[offset + 3] = Math.round(clamp(color.a, 0, 1) * 255);
  }
  return PngEncoder.encode(rgba, width, height);
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

router.get('/china/raster-overlay.png', async (req, res, next) => {
  try {
    const period = normalizeSpotsPeriod(req.query?.period || 'sunset');
    if (!period) {
      return res.status(400).json({
        error: {
          code: 'INVALID_PERIOD',
          message: 'period 浠呮敮鎸?sunrise 鎴?sunset'
        }
      });
    }

    const rawRes = parseFloat(req.query?.resolution);
    const resolution = (!isNaN(rawRes) && rawRes >= 0.1 && rawRes <= 2) ? rawRes : 0.25;
    const raster = await chinaRasterService.getRaster(period, resolution);
    const png = renderRasterOverlayPng(raster, period);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(png);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.normalizeSpotsPeriod = normalizeSpotsPeriod;
module.exports.SUPPORTED_PERIODS = SUPPORTED_PERIODS;
module.exports.renderRasterOverlayPng = renderRasterOverlayPng;
module.exports.scoreToRasterRgba = scoreToRasterRgba;
