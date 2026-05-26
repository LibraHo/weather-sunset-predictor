'use strict';

const CacheService = require('./CacheService');
const cacheConfig = require('../config/cacheConfig');
const gridService = require('./GridScoreService');
const PngEncoder = require('../utils/PngEncoder');

const TILE_SIZE = 256;

function scoreToRGBA(score, alpha = 0.75) {
  const a = Math.round(alpha * 255);
  if (score < 20) return [80, 80, 80, Math.round(a * 0.15)];
  if (score < 35) return [150, 120, 80, Math.round(a * 0.3)];
  if (score < 50) return [255, 200, 50, Math.round(a * 0.55)];
  if (score < 65) return [255, 140, 20, Math.round(a * 0.7)];
  if (score < 80) return [230, 60, 10, Math.round(a * 0.85)];
  return [180, 10, 10, a];
}

function tileToBbox(z, x, y) {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  const north = (Math.atan(Math.sinh(n)) * 180) / Math.PI;
  const n2 = Math.PI - (2 * Math.PI * (y + 1)) / Math.pow(2, z);
  const south = (Math.atan(Math.sinh(n2)) * 180) / Math.PI;
  const west = (x / Math.pow(2, z)) * 360 - 180;
  const east = ((x + 1) / Math.pow(2, z)) * 360 - 180;
  return { west, south, east, north };
}

function nearestScore(points, lat, lon) {
  let bestScore = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const point of points) {
    if (!Number.isFinite(point?.score)) continue;
    const dLat = Number(point.lat) - lat;
    const dLon = Number(point.lon) - lon;
    const distance = dLat * dLat + dLon * dLon;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestScore = Math.round(point.score);
    }
  }
  return bestScore;
}

class FireCloudTileService {
  constructor() {
    this.cacheService = new CacheService({ defaultTTL: cacheConfig.ttl.FIRECLOUD_OVERLAY });
  }

  async getGrid({ bbox, zoom = 6, time = Date.now(), type = 'sunset' }) {
    const key = cacheConfig.buildKey('FIRECLOUD_GRID', `${bbox}_${zoom}_${time}_${type}`);
    const cached = await this.cacheService.get(key);
    if (cached) return cached;

    const [west, south, east, north] = bbox.split(',').map(Number);
    const cols = Math.min(32, Math.max(8, Math.round(zoom * 3)));
    const rows = cols;
    const cellWidth = (east - west) / cols;
    const cellHeight = (north - south) / rows;
    const values = Array.from({ length: rows }, () => new Array(cols).fill(0));

    const modeResult = typeof gridService.getPublicMapCache === 'function'
      ? gridService.getPublicMapCache(type)
      : { mode: 'hybrid', status: 'ready', cache: (typeof gridService.getBestAvailableCache === 'function' ? gridService.getBestAvailableCache(type) : gridService.getCache(type)) };
    const scoreCache = modeResult.cache;
    const sourcePoints = Array.isArray(scoreCache?.gridPoints)
      ? scoreCache.gridPoints.filter(point => Number.isFinite(point?.score))
      : [];

    if (sourcePoints.length > 0) {
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const lat = south + (y + 0.5) * cellHeight;
          const lon = west + (x + 0.5) * cellWidth;
          values[y][x] = nearestScore(sourcePoints, lat, lon);
        }
      }
    }

    const payload = {
      type: 'FeatureCollection',
      meta: {
        source: scoreCache?.source || 'grid-product-cache',
        mode: modeResult.mode || null,
        status: sourcePoints.length > 0 ? 'ready' : (modeResult.status || 'not-ready'),
        degraded: sourcePoints.length === 0 || scoreCache?.degraded === true,
        degradedReason: sourcePoints.length > 0
          ? (scoreCache?.degradedReason || null)
          : (modeResult.degradedReason || 'GRID_PRODUCT_CACHE_NOT_READY'),
        zoom,
        time: Number(time),
        predictionType: type,
        bbox: { west, south, east, north },
        resolution: { rows, cols, cellWidth, cellHeight },
        sourcePoints: sourcePoints.length,
        updatedAt: scoreCache?.updatedAt || null
      },
      values
    };

    if (sourcePoints.length > 0) {
      await this.cacheService.set(key, payload);
    }
    return payload;
  }

  async getTilePng({ z, x, y, time = Date.now(), type = 'sunset' }) {
    const key = cacheConfig.buildKey('FIRECLOUD_TILE', `${z}_${x}_${y}_${time}_${type}`);
    const cached = await this.cacheService.get(key);
    if (cached) return Buffer.from(cached, 'base64');

    const { west, south, east, north } = tileToBbox(z, x, y);
    const bbox = `${west},${south},${east},${north}`;
    const grid = await this.getGrid({ bbox, zoom: z, time, type });
    const { rows, cols } = grid.meta.resolution;
    const { values } = grid;
    const rgba = new Uint8Array(TILE_SIZE * TILE_SIZE * 4);

    for (let py = 0; py < TILE_SIZE; py++) {
      for (let px = 0; px < TILE_SIZE; px++) {
        const gx = Math.min(cols - 1, Math.floor((px / TILE_SIZE) * cols));
        const gy = Math.min(rows - 1, Math.floor((py / TILE_SIZE) * rows));
        const score = values[gy]?.[gx] ?? 0;
        const [r, g, b, a] = scoreToRGBA(score);
        const idx = (py * TILE_SIZE + px) * 4;
        rgba[idx] = r;
        rgba[idx + 1] = g;
        rgba[idx + 2] = b;
        rgba[idx + 3] = a;
      }
    }

    const pngBuffer = PngEncoder.encode(rgba, TILE_SIZE, TILE_SIZE);
    if (grid.meta?.status === 'ready' && grid.meta?.sourcePoints > 0) {
      await this.cacheService.set(key, pngBuffer.toString('base64'));
    }
    return pngBuffer;
  }
}

module.exports = FireCloudTileService;
