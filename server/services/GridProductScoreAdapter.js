'use strict';

const GridProductCacheService = require('./GridProductCacheService');
const { calculateEnhancedPrediction } = require('./EnhancedPredictionService');

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
    const weatherProduct = this.cacheService.getLatestProduct({
      source: 'gfs',
      productType: 'weather_grid'
    });
    const aerosolProduct = this.cacheService.getLatestProduct({
      source: 'cams',
      productType: 'aerosol_grid'
    });

    if (!weatherProduct) return null;
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
        const score = scoreFromFields(scoringPoint, period === 'sunrise' ? 'sunrise' : 'sunset');
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

    const updatedAt = this._latestTimestamp(weatherProduct, aerosolProduct);
    return {
      updatedAt,
      period: period === 'sunrise' ? 'sunrise' : 'sunset',
      gridPoints,
      stale: false,
      source: 'grid-product-cache',
      degraded: missingAerosol,
      degradedReason: missingAerosol ? 'CAMS_AEROSOL_CACHE_NOT_READY' : null,
      meta: {
        products: {
          weather: this._productMeta(weatherProduct),
          aerosol: aerosolProduct ? this._productMeta(aerosolProduct) : null
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
