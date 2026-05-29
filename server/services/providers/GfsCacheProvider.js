'use strict';

const os = require('os');
const path = require('path');

const BaseWeatherProvider = require('./BaseWeatherProvider');
const GridProductCacheService = require('../GridProductCacheService');

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function kelvinToCelsius(value) {
  const number = finite(value);
  if (number === null) return null;
  return number > 150 ? Math.round((number - 273.15) * 100) / 100 : number;
}

function metersToKm(value) {
  const number = finite(value);
  if (number === null) return null;
  return number > 1000 ? Math.round((number / 1000) * 100) / 100 : number;
}

function windDirectionFromUv(u, v) {
  const uNum = finite(u);
  const vNum = finite(v);
  if (uNum === null || vNum === null) return null;
  return Math.round((Math.atan2(uNum, vNum) * 180 / Math.PI + 180) % 360);
}

function pointDistanceSq(a, b) {
  return (Number(a.lat) - Number(b.lat)) ** 2 + (Number(a.lon) - Number(b.lon)) ** 2;
}

function timestampOf(value) {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

class GfsCacheProvider extends BaseWeatherProvider {
  constructor(options = {}) {
    super('gfs_cache');
    this.dataDir = options.dataDir || process.env.GFS_CACHE_DATA_DIR || path.join(os.homedir(), '.xiake');
    this.cacheService = options.cacheService || new GridProductCacheService({ dataDir: this.dataDir });
    this.maxPointDistanceDeg = Number(options.maxPointDistanceDeg || process.env.GFS_CACHE_MAX_POINT_DISTANCE_DEG || 1);
    this.now = options.now || null;
  }

  async fetchWeatherData(lat, lon, hours = 168) {
    const startTime = Date.now();
    const products = this._loadProducts();
    if (products.length === 0) {
      const err = new Error('GFS cache has no current weather products');
      err.code = 'GFS_CACHE_EMPTY_OR_STALE';
      throw err;
    }

    const data = [];
    const target = { lat: Number(lat), lon: Number(lon) };
    const limit = Math.max(1, Number(hours) || 168);

    for (const product of products) {
      const item = this._weatherItemFromProduct(product, target);
      if (item) data.push(item);
      if (data.length >= limit) break;
    }

    if (data.length === 0) {
      const err = new Error('GFS cache has no nearby weather points');
      err.code = 'GFS_CACHE_NO_NEARBY_POINT';
      throw err;
    }

    return {
      hours: data.length,
      data,
      providerMeta: {
        name: this.name,
        latency: Date.now() - startTime,
        timezone: 'UTC',
        weatherModel: 'gfs_cache',
        models: ['gfs_cache'],
        cloudSource: 'NOAA GFS cache',
        dataQuality: 'pipeline-cache',
        unsupportedFields: ['air_quality', 'directRadiation', 'diffuseRadiation', 'pressure'],
        degradedReason: data.length < limit ? ['gfs_cache_partial_window'] : []
      }
    };
  }

  async fetchWeatherDataBatch(points, hours = 24) {
    const result = {};
    for (const point of points || []) {
      result[`${point.lat},${point.lon}`] = await this.fetchWeatherData(point.lat, point.lon, hours);
    }
    return result;
  }

  _loadProducts() {
    const manifest = this.cacheService.listManifest();
    const minValidTime = new Date(this.now || Date.now()).getTime() - 2 * 60 * 60 * 1000;
    const latestByValidTime = new Map();

    for (const product of manifest.products
      .filter(item => item.source === 'gfs' && item.productType === 'weather_grid')
      .map(item => this.cacheService.readProduct(item.productId))
      .filter(Boolean)) {
      const validTime = timestampOf(product.validTime || product.createdAt);
      if (validTime < minValidTime) continue;
      const key = String(validTime);
      const existing = latestByValidTime.get(key);
      if (!existing || this._productFreshness(product) > this._productFreshness(existing)) {
        latestByValidTime.set(key, product);
      }
    }

    return Array.from(latestByValidTime.values())
      .sort((a, b) => timestampOf(a.validTime || a.createdAt) - timestampOf(b.validTime || b.createdAt));
  }

  _productFreshness(product) {
    return Math.max(timestampOf(product.createdAt), timestampOf(product.cycle));
  }

  _weatherItemFromProduct(product, target) {
    const nearest = this._nearestPoint(product.points || [], target);
    if (!nearest) return null;
    const values = nearest.weather || {};
    const u = finite(values.UGRD);
    const v = finite(values.VGRD);
    const windSpeed = u === null || v === null ? null : Math.round(Math.sqrt(u ** 2 + v ** 2) * 100) / 100;
    const cloudCover = finite(values.TCDC);
    const humidity = finite(values.RH);
    const precipitation = finite(values.APCP) ?? finite(values.PRATE) ?? 0;

    return {
      timestamp: new Date(product.validTime || product.createdAt || Date.now()).getTime(),
      temp: kelvinToCelsius(values.TMP),
      humidity,
      cloudCover: cloudCover ?? 0,
      windSpeed,
      windDirection: windDirectionFromUv(u, v),
      visibility: metersToKm(values.VIS),
      precipitation,
      lowClouds: finite(values.LCDC) ?? 0,
      midClouds: finite(values.MCDC) ?? 0,
      highClouds: finite(values.HCDC) ?? 0,
      pressure: null,
      shortwaveRadiation: finite(values.DSWRF),
      directRadiation: null,
      diffuseRadiation: null,
      waterVapourColumn: finite(values.PWAT),
      providerPoint: { lat: nearest.lat, lon: nearest.lon },
      providerForecastHour: product.forecastHour
    };
  }

  _nearestPoint(points, target) {
    let best = null;
    let bestDistance = Infinity;
    for (const point of points) {
      if (!Number.isFinite(Number(point.lat)) || !Number.isFinite(Number(point.lon))) continue;
      const distance = pointDistanceSq(point, target);
      if (distance < bestDistance) {
        best = point;
        bestDistance = distance;
      }
    }
    if (!best || Math.sqrt(bestDistance) > this.maxPointDistanceDeg) return null;
    return best;
  }
}

module.exports = new GfsCacheProvider();
module.exports.GfsCacheProvider = GfsCacheProvider;
