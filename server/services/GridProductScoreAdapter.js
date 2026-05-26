'use strict';

const GridProductCacheService = require('./GridProductCacheService');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clampScore(value) {
  const number = toNumber(value);
  if (number === null) return null;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function firstFinite(...values) {
  for (const value of values) {
    const number = toNumber(value);
    if (number !== null) return number;
  }
  return null;
}

function pointKey(point) {
  const lat = toNumber(point?.lat);
  const lon = toNumber(point?.lon);
  if (lat === null || lon === null) return null;
  return `${lat.toFixed(4)},${lon.toFixed(4)}`;
}

function scoreFromFields(point) {
  const explicit = clampScore(point?.score ?? point?.firecloudScore);
  if (explicit !== null) return explicit;

  const weather = point?.weather || {};
  const aerosol = point?.aerosol || {};
  const totalCloud = firstFinite(
    weather.total_cloud_cover,
    weather.totalCloudCover,
    weather.cloud_cover,
    weather.cloudCover,
    weather.TCDC
  );
  const highCloud = firstFinite(
    weather.high_cloud_cover,
    weather.highCloudCover,
    weather.HCDC
  );
  const humidity = firstFinite(
    weather.relative_humidity,
    weather.relativeHumidity,
    weather.RH
  );
  const aod = firstFinite(
    aerosol.aod550,
    aerosol.total_aerosol_optical_depth_550nm,
    aerosol.AOD550
  );

  let score = 45;
  if (totalCloud !== null) score += Math.max(0, 25 - Math.abs(totalCloud - 55) * 0.45);
  if (highCloud !== null) score += Math.max(0, 20 - Math.abs(highCloud - 70) * 0.3);
  if (humidity !== null) score += humidity > 85 ? -12 : (humidity > 35 && humidity < 75 ? 8 : 0);
  if (aod !== null) score += aod <= 0.35 ? 7 : (aod > 0.8 ? -12 : 0);
  return clampScore(score);
}

class GridProductScoreAdapter {
  constructor(options = {}) {
    this.cacheService = options.cacheService || new GridProductCacheService(options);
    this.now = options.now || null;
  }

  getScoreCache(period = 'sunset') {
    const weatherProduct = this.cacheService.getLatestProduct({
      source: 'gfs',
      productType: 'weather_grid'
    });
    const aerosolProduct = this.cacheService.getLatestProduct({
      source: 'cams',
      productType: 'aerosol_grid'
    });

    if (!weatherProduct || !aerosolProduct) return null;

    const merged = new Map();
    for (const point of weatherProduct.points || []) {
      const key = pointKey(point);
      if (!key) continue;
      merged.set(key, {
        lat: Number(point.lat),
        lon: Number(point.lon),
        weather: clone(point.weather || {}),
        aerosol: {},
        _weatherScore: point.score ?? point.firecloudScore,
        sourceMeta: {
          weather: this._pointSourceMeta(weatherProduct, point)
        }
      });
    }

    for (const point of aerosolProduct.points || []) {
      const key = pointKey(point);
      if (!key) continue;
      const existing = merged.get(key) || {
        lat: Number(point.lat),
        lon: Number(point.lon),
        weather: {},
        aerosol: {}
      };
      existing.aerosol = clone(point.aerosol || {});
      existing._aerosolScore = point.score ?? point.firecloudScore;
      existing.sourceMeta = {
        ...(existing.sourceMeta || {}),
        aerosol: this._pointSourceMeta(aerosolProduct, point)
      };
      merged.set(key, existing);
    }

    const gridPoints = Array.from(merged.values())
      .map(point => {
        const score = scoreFromFields({
          ...point,
          score: isFiniteNumber(point._weatherScore) ? point._weatherScore : point._aerosolScore
        });
        return {
          lat: point.lat,
          lon: point.lon,
          score,
          quality: score === null ? 'no-data' : 'pipeline-cache',
          weather: point.weather,
          aerosol: point.aerosol,
          sourceMeta: clone(point.sourceMeta || {}),
          breakdown: null
        };
      })
      .filter(point => Number.isFinite(point.score));

    if (gridPoints.length === 0) return null;

    const updatedAt = this._latestTimestamp(weatherProduct, aerosolProduct);
    return {
      updatedAt,
      period: period === 'sunrise' ? 'sunrise' : 'sunset',
      gridPoints,
      stale: false,
      source: 'grid-product-cache',
      degraded: false,
      meta: {
        products: {
          weather: this._productMeta(weatherProduct),
          aerosol: this._productMeta(aerosolProduct)
        }
      }
    };
  }

  _productMeta(product) {
    return {
      productId: product.productId,
      source: product.source,
      productType: product.productType,
      cycle: product.cycle || null,
      forecastHour: Number.isFinite(product.forecastHour) ? product.forecastHour : null,
      validTime: product.validTime || null,
      createdAt: product.createdAt || null,
      bbox: clone(product.grid?.bbox || null),
      resolution: product.grid?.resolution ?? null,
      sourceMeta: clone(product.sourceMeta || {}),
      pointCount: Array.isArray(product.points) ? product.points.length : 0
    };
  }

  _pointSourceMeta(product, point) {
    return {
      source: product.source,
      productType: product.productType,
      cycle: product.cycle || null,
      forecastHour: Number.isFinite(product.forecastHour) ? product.forecastHour : null,
      forecastHours: Array.isArray(product.forecastHours) ? product.forecastHours.slice() : null,
      validTime: product.validTime || null,
      bbox: clone(product.grid?.bbox || null),
      resolution: product.grid?.resolution ?? null,
      productId: product.productId || null,
      productSourceMeta: clone(product.sourceMeta || {}),
      pointSourceMeta: clone(point.sourceMeta || {})
    };
  }

  _latestTimestamp(...products) {
    const times = products
      .flatMap(product => [product?.createdAt, product?.validTime])
      .map(value => new Date(value).getTime())
      .filter(Number.isFinite);
    if (times.length > 0) {
      return new Date(Math.max(...times)).toISOString();
    }
    return new Date(this.now || Date.now()).toISOString();
  }
}

module.exports = GridProductScoreAdapter;
