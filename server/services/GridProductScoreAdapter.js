'use strict';

const GridProductCacheService = require('./GridProductCacheService');
const {
  calculateMapSimplifiedPrediction,
  calculateSolarAzimuth
} = require('./EnhancedPredictionService');
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
const EARTH_RADIUS_KM = 6371;
const DIRECTIONAL_NEIGHBOR_STEPS = [1, 2];
const DIRECTIONAL_NEIGHBOR_WEIGHTS = [0.72, 0.28];

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
    const result = calculateMapSimplifiedPrediction(weatherData, date, point.lat, point.lon, period);
    point._predictionBreakdown = result.breakdown || null;
    point._predictionQuality = result.quality || null;
    point._predictionScoringContext = result.scoringContext || null;
    point._predictionMapSimplifiedScoring = result.mapSimplifiedScoring || null;
    point._predictionWeatherData = weatherData;
    return clampScore(result.score);
  } catch (err) {
    point._scoreError = err.message;
    return null;
  }
}

function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

function radToDeg(rad) {
  return (rad * 180) / Math.PI;
}

function distanceKm(a, b) {
  const lat1 = degToRad(Number(a.lat));
  const lat2 = degToRad(Number(b.lat));
  const dLat = lat2 - lat1;
  const dLon = degToRad(Number(b.lon) - Number(a.lon));
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

function destinationPoint(lat, lon, bearingDeg, distance) {
  const angular = distance / EARTH_RADIUS_KM;
  const bearing = degToRad(bearingDeg);
  const lat1 = degToRad(lat);
  const lon1 = degToRad(lon);
  const sinLat1 = Math.sin(lat1);
  const cosLat1 = Math.cos(lat1);
  const sinAngular = Math.sin(angular);
  const cosAngular = Math.cos(angular);

  const lat2 = Math.asin(
    sinLat1 * cosAngular + cosLat1 * sinAngular * Math.cos(bearing)
  );
  const lon2 = lon1 + Math.atan2(
    Math.sin(bearing) * sinAngular * cosLat1,
    cosAngular - sinLat1 * Math.sin(lat2)
  );

  return {
    lat: radToDeg(lat2),
    lon: ((radToDeg(lon2) + 540) % 360) - 180
  };
}

function estimateGridStepKm(points, productResolution) {
  const resolution = toNumber(productResolution);
  if (resolution !== null && resolution > 0) {
    return Math.max(18, resolution * 111);
  }

  const sample = points.slice(0, 60);
  let min = Infinity;
  for (let i = 0; i < sample.length; i += 1) {
    for (let j = i + 1; j < sample.length; j += 1) {
      const d = distanceKm(sample[i], sample[j]);
      if (d > 1 && d < min) min = d;
    }
  }
  return Number.isFinite(min) ? min : 55;
}

function coordinateKey(lat, lon) {
  return `${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`;
}

function uniqueSorted(values) {
  return Array.from(new Set(
    values
      .map(Number)
      .filter(Number.isFinite)
      .map(value => value.toFixed(4))
  ))
    .map(Number)
    .sort((a, b) => a - b);
}

function buildGridLookup(points) {
  const byCoordinate = new Map();
  for (const point of points) {
    byCoordinate.set(coordinateKey(point.lat, point.lon), point);
  }
  return {
    byCoordinate,
    lats: uniqueSorted(points.map(point => point.lat)),
    lons: uniqueSorted(points.map(point => point.lon))
  };
}

function closestCandidateIndexes(values, target, radius = 1) {
  if (!values.length) return [];
  let low = 0;
  let high = values.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (values[mid] < target) low = mid + 1;
    else high = mid;
  }
  const indexes = new Set();
  for (let offset = -radius; offset <= radius; offset += 1) {
    const index = low + offset;
    if (index >= 0 && index < values.length) indexes.add(index);
  }
  return Array.from(indexes);
}

function nearestIndexedPoint(lookup, target, toleranceKm, excludedKey) {
  if (!lookup) return null;
  let nearest = null;
  let nearestDistance = Infinity;
  const latIndexes = closestCandidateIndexes(lookup.lats, target.lat, 1);
  const lonIndexes = closestCandidateIndexes(lookup.lons, target.lon, 1);
  for (const latIndex of latIndexes) {
    for (const lonIndex of lonIndexes) {
      const candidate = lookup.byCoordinate.get(coordinateKey(lookup.lats[latIndex], lookup.lons[lonIndex]));
      if (!candidate || pointKey(candidate) === excludedKey) continue;
      const d = distanceKm(candidate, target);
      if (d < nearestDistance) {
        nearest = candidate;
        nearestDistance = d;
      }
    }
  }
  return nearest && nearestDistance <= toleranceKm
    ? { point: nearest, distanceKm: nearestDistance }
    : null;
}

function upperCarrierFromWeather(weather) {
  return Number(weather?.HCDC || 0) * 0.65 + Number(weather?.MCDC || 0) * 0.35;
}

function directionalBlockFromWeather(weather) {
  const low = Number(weather?.LCDC || 0);
  const mid = Number(weather?.MCDC || 0);
  const high = Number(weather?.HCDC || 0);
  return low * 0.75 + Math.max(0, mid - high) * 0.25;
}

function weightedMetric(items, getter) {
  let total = 0;
  let weightTotal = 0;
  for (const item of items) {
    const value = Number(getter(item));
    if (!Number.isFinite(value)) continue;
    total += value * item.weight;
    weightTotal += item.weight;
  }
  return weightTotal > 0 ? total / weightTotal : null;
}

function buildDirectionalContext(point, gridLookup, date, period, gridStepKm) {
  const lat = toNumber(point.lat);
  const lon = toNumber(point.lon);
  if (lat === null || lon === null) return null;

  let azimuth = null;
  try {
    azimuth = calculateSolarAzimuth(new Date(date), lat, lon);
  } catch (_) {
    azimuth = period === 'sunrise' ? 90 : 270;
  }
  if (!Number.isFinite(Number(azimuth))) {
    azimuth = period === 'sunrise' ? 90 : 270;
  }

  const key = pointKey(point);
  const toleranceKm = Math.max(20, gridStepKm * 0.7);
  const neighbors = DIRECTIONAL_NEIGHBOR_STEPS
    .map((step, index) => {
      const target = destinationPoint(lat, lon, azimuth, gridStepKm * step);
      const match = nearestIndexedPoint(gridLookup, target, toleranceKm, key);
      if (!match) return null;
      return {
        ...match,
        step,
        weight: DIRECTIONAL_NEIGHBOR_WEIGHTS[index] || 0,
        upperCarrier: upperCarrierFromWeather(match.point.weather),
        blockRisk: directionalBlockFromWeather(match.point.weather)
      };
    })
    .filter(Boolean);

  if (neighbors.length === 0) {
    return {
      applied: false,
      reason: 'no_directional_neighbor',
      azimuth: parseFloat(Number(azimuth).toFixed(1)),
      neighborCount: 0
    };
  }

  return {
    applied: true,
    reason: 'gfs_cams_directional_neighbor_grid',
    azimuth: parseFloat(Number(azimuth).toFixed(1)),
    neighborCount: neighbors.length,
    gridStepKm: parseFloat(gridStepKm.toFixed(1)),
    directionalUpperCarrier: parseFloat(weightedMetric(neighbors, item => item.upperCarrier).toFixed(1)),
    directionalBlockRisk: parseFloat(weightedMetric(neighbors, item => item.blockRisk).toFixed(1)),
    nearestNeighborKm: parseFloat(Math.min(...neighbors.map(item => item.distanceKm)).toFixed(1)),
    samples: neighbors.map(item => ({
      lat: item.point.lat,
      lon: item.point.lon,
      step: item.step,
      distanceKm: parseFloat(item.distanceKm.toFixed(1)),
      weight: item.weight,
      upperCarrier: parseFloat(item.upperCarrier.toFixed(1)),
      blockRisk: parseFloat(item.blockRisk.toFixed(1))
    }))
  };
}

function applyDirectionalMapScoring(baseScore, weather, context) {
  if (!context?.applied || !Number.isFinite(baseScore)) {
    return {
      score: baseScore,
      adjustment: { applied: false, reason: context?.reason || 'directional_context_unavailable' }
    };
  }

  const localUpperCarrier = upperCarrierFromWeather(weather);
  const localLow = Number(weather?.LCDC || 0);
  const precipitation = Number(weather?.APCP || weather?.precipitation || 0);
  const directionalUpper = Number(context.directionalUpperCarrier || 0);
  const directionalBlock = Number(context.directionalBlockRisk || 0);
  const metrics = {
    localUpperCarrier: parseFloat(localUpperCarrier.toFixed(1)),
    localLowCloud: parseFloat(localLow.toFixed(1)),
    directionalUpperCarrier: parseFloat(directionalUpper.toFixed(1)),
    directionalBlockRisk: parseFloat(directionalBlock.toFixed(1))
  };

  if (precipitation > 0.2 || localLow >= 55) {
    const score = Math.min(baseScore, localLow >= 75 ? 35 : 45);
    return {
      score,
      adjustment: {
        applied: score !== baseScore,
        reason: 'local_low_cloud_or_precip_blocks_map_directional_lift',
        originalScore: baseScore,
        adjustedScore: score,
        metrics
      }
    };
  }

  if (localUpperCarrier < 18) {
    return {
      score: baseScore,
      adjustment: {
        applied: false,
        reason: 'local_canvas_too_weak_for_directional_map_lift',
        metrics
      }
    };
  }

  if (directionalBlock >= 60) {
    const score = Math.min(baseScore, 48);
    return {
      score,
      adjustment: {
        applied: score !== baseScore,
        reason: 'directional_neighbor_blocked_corridor',
        originalScore: baseScore,
        adjustedScore: score,
        metrics
      }
    };
  }

  if (directionalUpper < 45) {
    return {
      score: baseScore,
      adjustment: {
        applied: false,
        reason: 'directional_neighbor_upper_cloud_too_weak',
        metrics
      }
    };
  }

  const trendScore = clampScore(
    28
    + localUpperCarrier * 0.28
    + directionalUpper * 0.44
    - directionalBlock * 0.18
  );
  const cappedTrendScore = Math.min(trendScore, 78);
  const score = Math.max(baseScore, cappedTrendScore);

  return {
    score,
    adjustment: {
      applied: score !== baseScore,
      reason: score !== baseScore
        ? 'directional_neighbor_upper_cloud_lift'
        : 'directional_neighbor_no_score_change',
      originalScore: baseScore,
      adjustedScore: score,
      trendScore: cappedTrendScore,
      metrics
    }
  };
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

    const mergedPoints = Array.from(merged.values());
    const gridStepKm = estimateGridStepKm(mergedPoints, weatherProduct.grid?.resolution);
    const gridLookup = buildGridLookup(mergedPoints);
    const gridPoints = mergedPoints
      .map(point => {
        const scoringPoint = {
          ...point,
          score: isFiniteNumber(point._weatherScore) ? point._weatherScore : point._aerosolScore
        };
        const score = scoreFromFields(scoringPoint, safePeriod);
        const date = point.sourceMeta?.weather?.validTime || weatherProduct.validTime || new Date().toISOString();
        const directionalContext = score !== null
          ? buildDirectionalContext(point, gridLookup, date, safePeriod, gridStepKm)
          : null;
        const directionalScore = score !== null
          ? applyDirectionalMapScoring(score, point.weather, directionalContext)
          : { score, adjustment: null };
        return {
          lat: point.lat,
          lon: point.lon,
          score: directionalScore.score,
          quality: scoringPoint._predictionQuality || (score === null ? 'no-data' : 'pipeline-cache'),
          weather: point.weather,
          aerosol: point.aerosol,
          sourceMeta: clone(point.sourceMeta || {}),
          breakdown: scoringPoint._predictionBreakdown || null,
          scoringContext: score === null ? null : 'map_grid_directional',
          mapSimplifiedScoring: scoringPoint._predictionMapSimplifiedScoring || null,
          mapDirectionalScoring: directionalContext ? {
            ...directionalContext,
            adjustment: directionalScore.adjustment
          } : null,
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
