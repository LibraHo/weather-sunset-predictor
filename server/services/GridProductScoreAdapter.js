'use strict';

const GridProductCacheService = require('./GridProductCacheService');
const { calculateEnhancedPrediction } = require('./EnhancedPredictionService');
const SunCalculator = require('../utils/SunCalculator');

const REQUIRED_GFS_FIELDS = [
  'TCDC',
  'LCDC',
  'MCDC',
  'HCDC',
  'RH',
  'VIS',
  'APCP',
  'DSWRF',
  'PWAT',
  'UGRD',
  'VGRD'
];
const MAX_AEROSOL_WEATHER_TIME_DELTA_MS = 18 * 60 * 60 * 1000;
const EVENT_PASSED_BUFFER_MS = 30 * 60 * 1000;
const MAP_REFERENCE_POINT = {
  lat: 39.9042,
  lon: 116.4074,
  timezone: 'Asia/Shanghai'
};

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

function visibilityKm(value) {
  const number = toNumber(value);
  if (number === null) return null;
  return number > 1000 ? number / 1000 : number;
}

function windSpeedFromFields(weather) {
  const u = firstFinite(weather.UGRD, weather.u10, weather.windU);
  const v = firstFinite(weather.VGRD, weather.v10, weather.windV);
  if (u !== null && v !== null) return Math.sqrt(u * u + v * v);
  return firstFinite(weather.windSpeed, weather.wind_speed);
}

function pointKey(point) {
  const lat = toNumber(point?.lat);
  const lon = toNumber(point?.lon);
  if (lat === null || lon === null) return null;
  return `${lat.toFixed(4)},${lon.toFixed(4)}`;
}

function productTimestamp(product) {
  for (const value of [product?.validTime, product?.createdAt]) {
    const time = new Date(value).getTime();
    if (Number.isFinite(time)) return time;
  }
  return null;
}

function isCompatibleAerosolProduct(weatherProduct, aerosolProduct) {
  if (!aerosolProduct) return false;
  const weatherTime = productTimestamp(weatherProduct);
  const aerosolTime = productTimestamp(aerosolProduct);
  if (weatherTime === null || aerosolTime === null) return false;
  return Math.abs(weatherTime - aerosolTime) <= MAX_AEROSOL_WEATHER_TIME_DELTA_MS;
}

function nextMapEventTime(period, now = new Date()) {
  const safePeriod = period === 'sunrise' ? 'sunrise' : 'sunset';
  const getter = safePeriod === 'sunrise'
    ? SunCalculator.getSunriseTime
    : SunCalculator.getSunsetTime;
  for (let offset = 0; offset <= 3; offset += 1) {
    const event = getter(
      targetLocalDate(now, MAP_REFERENCE_POINT.timezone, offset),
      MAP_REFERENCE_POINT.lat,
      MAP_REFERENCE_POINT.lon,
      { timezone: MAP_REFERENCE_POINT.timezone }
    );
    if (now.getTime() <= event.getTime() + EVENT_PASSED_BUFFER_MS) return event;
  }
  return getter(
    targetLocalDate(now, MAP_REFERENCE_POINT.timezone, 4),
    MAP_REFERENCE_POINT.lat,
    MAP_REFERENCE_POINT.lon,
    { timezone: MAP_REFERENCE_POINT.timezone }
  );
}

function targetLocalDate(now, timeZone, dayOffset = 0) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(now);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return new Date(Number(values.year), Number(values.month) - 1, Number(values.day) + dayOffset, 12, 0, 0, 0);
  } catch (_) {
    return new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
  }
}

function missingRequiredGfsFields(weather) {
  return REQUIRED_GFS_FIELDS.filter(field => !isFiniteNumber(weather?.[field]));
}

function weatherDataFromPoint(point) {
  const weather = point?.weather || {};
  const aerosol = point?.aerosol || {};
  const missing = missingRequiredGfsFields(weather);
  if (missing.length > 0) {
    return { weatherData: null, missing };
  }

  const precipitation = firstFinite(weather.APCP, weather.precipitation);
  const windSpeed = windSpeedFromFields(weather);
  const aerosolOpticalDepth = firstFinite(
    aerosol.aod550,
    aerosol.total_aerosol_optical_depth_550nm,
    aerosol.AOD550
  );

  const weatherData = {
    cloudCover: firstFinite(weather.TCDC, weather.cloudCover),
    lowClouds: firstFinite(weather.LCDC, weather.lowClouds),
    midClouds: firstFinite(weather.MCDC, weather.midClouds),
    highClouds: firstFinite(weather.HCDC, weather.highClouds),
    humidity: firstFinite(weather.RH, weather.humidity),
    visibility: visibilityKm(firstFinite(weather.VIS, weather.visibility)),
    precipitation,
    recentPrecipitation6h: precipitation,
    shortwaveRadiation: firstFinite(weather.DSWRF, weather.shortwaveRadiation),
    waterVapourColumn: firstFinite(weather.PWAT, weather.waterVapourColumn),
    windSpeed
  };

  if (aerosolOpticalDepth !== null) {
    weatherData.aerosolOpticalDepth = aerosolOpticalDepth;
  }

  return { weatherData, missing: [] };
}

function scoreFromFields(point, period) {
  const explicit = clampScore(point?.score ?? point?.firecloudScore);
  if (explicit !== null) return explicit;

  const { weatherData, missing } = weatherDataFromPoint(point);
  if (!weatherData) {
    point._missingRequiredFields = missing;
    return null;
  }

  const date = point.validTime || point.sourceMeta?.weather?.validTime || new Date().toISOString();
  try {
    const result = calculateEnhancedPrediction(weatherData, date, point.lat, point.lon, period);
    point._predictionBreakdown = result.breakdown || null;
    point._predictionQuality = result.quality || null;
    point._predictionWeatherData = weatherData;
    return clampScore(result.score);
  } catch (err) {
    point._scoreError = err.message;
    return null;
  }
}

class GridProductScoreAdapter {
  constructor(options = {}) {
    this.cacheService = options.cacheService || new GridProductCacheService(options);
    this.now = options.now || null;
  }

  getScoreCache(period = 'sunset') {
    const safePeriod = period === 'sunrise' ? 'sunrise' : 'sunset';
    const targetTime = nextMapEventTime(safePeriod, new Date(this.now || Date.now()));
    const weatherProduct = this._getClosestProduct({
      source: 'gfs',
      productType: 'weather_grid',
      targetTime
    });
    const latestAerosolProduct = this._getClosestProduct({
      source: 'cams',
      productType: 'aerosol_grid',
      targetTime: weatherProduct?.validTime || targetTime
    });

    if (!weatherProduct) return null;
    const aerosolProduct = isCompatibleAerosolProduct(weatherProduct, latestAerosolProduct)
      ? latestAerosolProduct
      : null;
    const missingAerosol = !aerosolProduct;

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

    if (aerosolProduct) {
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
    }

    const gridPoints = Array.from(merged.values())
      .map(point => {
        const scoringPoint = {
          ...point,
          score: isFiniteNumber(point._weatherScore) ? point._weatherScore : point._aerosolScore
        };
        const score = scoreFromFields(scoringPoint, safePeriod);
        return {
          lat: point.lat,
          lon: point.lon,
          score,
          quality: scoringPoint._predictionQuality || (score === null ? 'no-data' : 'pipeline-cache'),
          weather: point.weather,
          aerosol: point.aerosol,
          sourceMeta: clone(point.sourceMeta || {}),
          breakdown: scoringPoint._predictionBreakdown || null,
          missingRequiredFields: scoringPoint._missingRequiredFields || undefined,
          scoreError: scoringPoint._scoreError || undefined
        };
      })
      .filter(point => Number.isFinite(point.score));

    if (gridPoints.length === 0) return null;

    const updatedAt = this._latestCreatedAt(weatherProduct, aerosolProduct);
    return {
      updatedAt,
      period: safePeriod,
      gridPoints,
      stale: false,
      source: 'grid-product-cache',
      degraded: missingAerosol,
      degradedReason: missingAerosol ? 'CAMS_AEROSOL_CACHE_NOT_READY' : null,
      meta: {
        products: {
          weather: this._productMeta(weatherProduct),
          aerosol: aerosolProduct ? this._productMeta(aerosolProduct) : null
        },
        targetTime: targetTime.toISOString(),
        referencePoint: clone(MAP_REFERENCE_POINT)
      }
    };
  }

  _getClosestProduct({ source, productType, targetTime }) {
    const targetTs = new Date(targetTime).getTime();
    const entries = this.cacheService.listManifest().products
      .filter(item => {
        if (source && item.source !== source) return false;
        if (productType && item.productType !== productType) return false;
        return Number.isFinite(productTimestamp(item));
      })
      .sort((a, b) => {
        const aDiff = Math.abs(productTimestamp(a) - targetTs);
        const bDiff = Math.abs(productTimestamp(b) - targetTs);
        if (aDiff !== bDiff) return aDiff - bDiff;
        return productTimestamp(b) - productTimestamp(a);
      });
    return entries.length > 0 ? this.cacheService.readProduct(entries[0].productId) : null;
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

  _latestCreatedAt(...products) {
    const times = products
      .map(product => product?.createdAt)
      .map(value => new Date(value).getTime())
      .filter(Number.isFinite);
    if (times.length > 0) {
      return new Date(Math.max(...times)).toISOString();
    }
    return new Date(this.now || Date.now()).toISOString();
  }
}

module.exports = GridProductScoreAdapter;
