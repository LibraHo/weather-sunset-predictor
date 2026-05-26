/**
 * Prediction Routes - 预测 API 路由
 *
 * 需求：22 (前后端分离)
 *
 * 端点：
 * - POST /api/prediction/calculate - 基础单点预测 (Phase 1)
 * - POST /api/prediction/enhanced - 增强版单点预测 (Phase 3)
 * - POST /api/prediction/enhanced/batch - 增强版批量预测 (Phase 3)
 *
 * 错误响应格式统一为：{ error: { code: 'CODE', message: '...' } }
 */

const express = require('express');
const router = express.Router();
const PredictionService = require('../services/PredictionService.js');
const EnhancedPredictionService = require('../services/EnhancedPredictionService.js');
const SurroundingService = require('../services/SurroundingService.js');
const CacheService = require('../services/CacheService.js');
const cacheConfig = require('../config/cacheConfig.js');
const orchestrator = require('../services/ProviderOrchestrator');
const SunCalculator = require('../utils/SunCalculator.js');
const { startProfile, profileDurationMs, logProfile } = require('../utils/ProfileLogger');

// 创建服务实例（使用统一TTL配置）
const predictionService = new PredictionService();
const cacheService = new CacheService({ defaultTTL: cacheConfig.ttl.DEFAULT });
const surroundingService = new SurroundingService({ cacheService });

const CLOSED_LOOP_WEATHER_CACHE_TTL_SECONDS = 120;
const inFlightWeatherFetches = new Map();

function closedLoopWeatherCacheKey(lat, lon, hours = 168) {
  return `closed-loop-weather:${Number(lat).toFixed(4)}:${Number(lon).toFixed(4)}:${hours}`;
}

async function fetchClosedLoopWeatherData(lat, lon, hours = 168, fetchOptions = {}) {
  const key = closedLoopWeatherCacheKey(lat, lon, hours);
  const cached = await cacheService.get(key);
  if (cached) {
    return cached;
  }

  if (inFlightWeatherFetches.has(key)) {
    return inFlightWeatherFetches.get(key);
  }

  const pending = orchestrator.fetchWeatherData(lat, lon, hours, undefined, fetchOptions)
    .then(async (weatherResponse) => {
      await cacheService.set(key, weatherResponse, CLOSED_LOOP_WEATHER_CACHE_TTL_SECONDS);
      return weatherResponse;
    })
    .finally(() => {
      inFlightWeatherFetches.delete(key);
    });

  inFlightWeatherFetches.set(key, pending);
  return pending;
}

// 服务器退出时释放定时器，避免 Node.js 进程无法正常退出
process.once('exit', () => cacheService.destroy());
process.once('SIGINT', () => { cacheService.destroy(); process.exit(0); });
process.once('SIGTERM', () => { cacheService.destroy(); process.exit(0); });

// ========== 统一错误响应辅助函数 ==========

/**
 * 返回标准化错误响应
 * @param {import('express').Response} res
 * @param {number} status - HTTP 状态码
 * @param {string} code - 错误代码
 * @param {string} message - 错误信息
 */
function errorResponse(res, status, code, message) {
  return res.status(status).json({ success: false, error: { code, message } });
}

function normalizeWeatherProviderError(error) {
  const message = String(error?.message || 'Weather provider unavailable');
  const lower = message.toLowerCase();
  if (error?.code === 'NO_WEATHER_DATA') {
    return { status: 503, code: 'WEATHER_PROVIDER_UNAVAILABLE', message };
  }
  if (lower.includes('429') || lower.includes('rate') || lower.includes('频繁')) {
    return { status: 429, code: 'WEATHER_RATE_LIMITED', message };
  }
  if (lower.includes('quota') || lower.includes('daily limit') || lower.includes('配额')) {
    return { status: 429, code: 'WEATHER_QUOTA_EXCEEDED', message };
  }
  if (lower.includes('timeout') || lower.includes('超时') || lower.includes('econnaborted')) {
    return { status: 504, code: 'WEATHER_UPSTREAM_TIMEOUT', message };
  }
  if (lower.includes('open-meteo') || lower.includes('weather') || lower.includes('provider')) {
    return { status: 503, code: 'WEATHER_PROVIDER_UNAVAILABLE', message };
  }
  return null;
}


// ========== 请求验证中间件 ==========

/**
 * 验证基础预测请求参数
 */
function validatePredictionRequest(req, res, next) {
  const { weatherData, date, lat, lon, type } = req.body;

  if (weatherData !== undefined && (!weatherData || typeof weatherData !== 'object')) {
    return errorResponse(res, 400, 'INVALID_WEATHER_DATA', 'weatherData must be an object when provided');
  }

  if (!date) {
    return errorResponse(res, 400, 'MISSING_DATE', 'date is required');
  }

  if (typeof lat !== 'number' || lat < -90 || lat > 90) {
    return errorResponse(res, 400, 'INVALID_LATITUDE', 'lat must be a number between -90 and 90');
  }

  if (typeof lon !== 'number' || lon < -180 || lon > 180) {
    return errorResponse(res, 400, 'INVALID_LONGITUDE', 'lon must be a number between -180 and 180');
  }

  if (!type || !['sunrise', 'sunset'].includes(type)) {
    return errorResponse(res, 400, 'INVALID_TYPE', 'type must be "sunrise" or "sunset"');
  }

  next();
}

function selectHourlyAt(hourly, referenceTime) {
  const rows = Array.isArray(hourly) ? hourly : [];
  if (!rows.length) return { selected: null, selectedIdx: -1 };
  const refTs = referenceTime instanceof Date && !isNaN(referenceTime.getTime())
    ? referenceTime.getTime()
    : Date.now();
  let selectedIdx = 0;
  let selected = rows[0];
  rows.forEach((row, idx) => {
    if (Math.abs((row.timestamp || 0) - refTs) < Math.abs((selected.timestamp || 0) - refTs)) {
      selected = row;
      selectedIdx = idx;
    }
  });
  return { selected, selectedIdx };
}

function buildWeatherDataFromHourly(selected, hourly, selectedIdx) {
  let recentPrecipitation6h = 0;
  let recentRainHours = 0;
  for (let i = Math.max(0, selectedIdx - 6); i <= selectedIdx; i += 1) {
    const precipitation = Number(hourly[i]?.precipitation || 0);
    recentPrecipitation6h += precipitation;
    if (precipitation > 0) recentRainHours += 1;
  }

  let prevHourData = null;
  for (let offset = 1; offset <= 2 && selectedIdx - offset >= 0; offset += 1) {
    const prev = hourly[selectedIdx - offset];
    if (prev && prev.shortwaveRadiation != null && prev.shortwaveRadiation > 50) {
      prevHourData = prev;
      break;
    }
  }

  return {
    weatherData: {
      cloudCover: selected.cloudCover || 0,
      humidity: selected.humidity || 0,
      visibility: selected.visibility || 10,
      lowCloudCover: selected.lowClouds || selected.cloudCover || 0,
      temp: selected.temp || 0,
      windSpeed: selected.windSpeed || 0,
      windDirection: selected.windDirection || 0,
      pressure: selected.pressure || 1013,
      precipitation: selected.precipitation || 0,
      recentPrecipitation6h,
      recentRainHours,
      lowClouds: selected.lowClouds || 0,
      midClouds: selected.midClouds || 0,
      highClouds: selected.highClouds || 0,
      cloudBaseHeight: selected.cloudBaseHeight ?? null,
      cape: selected.cape ?? null,
      weatherCode: selected.weatherCode ?? null,
      shortwaveRadiation: selected.shortwaveRadiation ?? null,
      directRadiation: selected.directRadiation ?? null,
      diffuseRadiation: selected.diffuseRadiation ?? null,
      waterVapourColumn: selected.waterVapourColumn ?? null,
      aerosolOpticalDepth: selected.aerosolOpticalDepth ?? null,
      dust: selected.dust ?? null,
      pm2_5: selected.pm2_5 ?? null,
      pm10: selected.pm10 ?? null,
      aqi: selected.aqi ?? null,
    },
    prevHourData,
    rainedRecently: recentPrecipitation6h >= 0.2
  };
}

async function buildClosedLoopPredictionInput({
  lat,
  lon,
  date,
  type,
  referenceTime,
  weatherResponseOverride = null,
  includeRemoteCloudData = true,
  forecastHours = 168,
  weatherFetchOptions = {}
}) {
  const timings = {};
  const targetDate = date ? new Date(date) : new Date();
  if (!(targetDate instanceof Date) || isNaN(targetDate.getTime())) {
    throw new Error('Invalid date');
  }

  const referenceProfile = startProfile();
  let refTime = referenceTime ? new Date(referenceTime) : null;
  if (!(refTime instanceof Date) || isNaN(refTime.getTime())) {
    refTime = type === 'sunrise'
      ? SunCalculator.getSunriseTime(targetDate, lat, lon)
      : SunCalculator.getSunsetTime(targetDate, lat, lon);
  }
  timings.referenceMs = profileDurationMs(referenceProfile);

  const weatherFetchProfile = startProfile();
  const weatherResponse = weatherResponseOverride || await fetchClosedLoopWeatherData(lat, lon, forecastHours, weatherFetchOptions);
  timings.weatherFetchMs = profileDurationMs(weatherFetchProfile);
  const hourly = Array.isArray(weatherResponse.data) ? weatherResponse.data : [];
  if (!hourly.length) {
    const error = new Error('No weather data available');
    error.code = 'NO_WEATHER_DATA';
    throw error;
  }

  const { selected, selectedIdx } = selectHourlyAt(hourly, refTime);
  const built = buildWeatherDataFromHourly(selected, hourly, selectedIdx);
  const azimuth = EnhancedPredictionService.calculateSolarAzimuth(refTime, lat, lon);
  let remoteCloudData = null;
  const remoteCloudProfile = startProfile();
  if (includeRemoteCloudData) {
    try {
      remoteCloudData = await surroundingService.getSolarDirectionLightPathSamples({
        lat, lon, date: targetDate, type, azimuth, referenceTime: refTime
      });
      logProfile('prediction.closedLoop', 'remote_cloud', remoteCloudProfile, {
        status: 'ok',
        lat,
        lon,
        type,
        samples: Array.isArray(remoteCloudData?.samples) ? remoteCloudData.samples.length : 0,
        errors: Array.isArray(remoteCloudData?.errors) ? remoteCloudData.errors.length : 0,
        cacheHit: remoteCloudData?.cache?.hit === true
      });
      timings.remoteCloudMs = profileDurationMs(remoteCloudProfile);
    } catch (error) {
      logProfile('prediction.closedLoop', 'remote_cloud', remoteCloudProfile, {
        status: 'error',
        lat,
        lon,
        type,
        error: error.message
      });
      throw error;
    }
  } else {
    logProfile('prediction.closedLoop', 'remote_cloud', remoteCloudProfile, {
      status: 'skipped',
      lat,
      lon,
      type,
      reason: 'includeRemoteCloudData=false'
    });
    timings.remoteCloudMs = 0;
  }

  return {
    ...built,
    referenceTime: refTime,
    providerMeta: weatherResponse.providerMeta || null,
    remoteCloudData,
    source: includeRemoteCloudData ? 'backend_closed_loop' : 'backend_closed_loop_fast',
    profileTimings: timings,
    timings
  };
}

function buildEnhancedPredictionResponse({ closedLoop, lat, lon, type, options = {} }) {
  const scoringProfile = startProfile();
  let result;
  try {
    result = EnhancedPredictionService.calculateEnhancedPrediction(
      closedLoop.weatherData,
      closedLoop.referenceTime,
      lat,
      lon,
      type,
      {
        ...options,
        prevHourData: closedLoop.prevHourData,
        rainedRecently: closedLoop.rainedRecently,
        remoteCloudData: closedLoop.remoteCloudData
      }
    );
    logProfile('prediction.closedLoop', 'scoring', scoringProfile, {
      status: 'ok',
      lat,
      lon,
      type,
      score: result.score,
      quality: result.quality,
      source: closedLoop.source || 'backend_closed_loop',
      hasRemoteCloudData: Boolean(closedLoop.remoteCloudData)
    });
    if (closedLoop.profileTimings) {
      closedLoop.profileTimings.calculateMs = profileDurationMs(scoringProfile);
    }
  } catch (error) {
    logProfile('prediction.closedLoop', 'scoring', scoringProfile, {
      status: 'error',
      lat,
      lon,
      type,
      source: closedLoop.source || 'backend_closed_loop',
      hasRemoteCloudData: Boolean(closedLoop.remoteCloudData),
      error: error.message
    });
    throw error;
  }

  return {
    ...result,
    // @deprecated - 使用 lightPathAnalysis.score 替代
    lightPathScore: result.lightPathAnalysis?.score ?? null,
    // @deprecated - 使用 canvasAnalysis.score 替代
    canvasScore: result.canvasAnalysis?.score ?? null,
    // @deprecated - 使用 breakdown.baseScore 替代
    baseScore: result.breakdown?.baseScore ?? null,
    cloudLayers: {
      low: closedLoop.weatherData.lowClouds,
      mid: closedLoop.weatherData.midClouds,
      high: closedLoop.weatherData.highClouds,
    },
    providerMeta: closedLoop.providerMeta,
    weatherDataSource: closedLoop.source || 'backend_closed_loop',
    clientWeatherFallback: closedLoop.clientWeatherFallback === true,
    referenceTime: closedLoop.referenceTime.toISOString(),
    weatherData: closedLoop.weatherData,
    remoteCloudData: closedLoop.remoteCloudData,
    profileTimings: closedLoop.profileTimings || null,
    diagnostics: {
      timings: {
        ...(closedLoop.timings || closedLoop.profileTimings || {}),
        calculateMs: closedLoop.profileTimings?.calculateMs ?? null
      }
    }
  };
}

function parseFiniteNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeGatewayPeriod(value) {
  return value === 'sunrise' || value === 'sunset' ? value : 'sunset';
}

function parseGatewayDate(value) {
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0, 0);
    }
  }
  const parsed = value ? new Date(value) : new Date();
  if (parsed instanceof Date && !Number.isNaN(parsed.getTime())) {
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  }
  return null;
}

function formatDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function buildGatewayPredictionItems({ startDate, days, lat, lon, timezone }) {
  const items = [];
  for (let i = 0; i < days; i += 1) {
    const day = addDays(startDate, i);
    const dateKey = formatDateKey(day);
    for (const type of ['sunrise', 'sunset']) {
      const referenceTime = type === 'sunrise'
        ? SunCalculator.getSunriseTime(day, lat, lon, { timezone })
        : SunCalculator.getSunsetTime(day, lat, lon, { timezone });
      if (!referenceTime) continue;
      items.push({
        id: `${type}:${referenceTime.getTime()}`,
        dayIndex: i,
        date: dateKey,
        dateKey,
        type,
        referenceTime: referenceTime.toISOString()
      });
    }
  }
  return items;
}

function buildGatewayWeatherPayload(weatherResponse, referenceTime = new Date()) {
  const hourly = Array.isArray(weatherResponse?.data) ? weatherResponse.data : [];
  const current = selectHourlyAt(hourly, referenceTime).selected;
  return {
    current,
    hourly,
    hours: hourly.length,
    daily: weatherResponse?.daily || [],
    providerMeta: weatherResponse?.providerMeta || null
  };
}

function groupGatewayPredictions({ predictions, items, startDate, days, period }) {
  const byId = new Map(predictions.map(item => [item.id, item]));
  const byDate = [];
  for (let i = 0; i < days; i += 1) {
    const dateKey = formatDateKey(addDays(startDate, i));
    const dayItems = items.filter(item => item.dateKey === dateKey);
    const sunriseItem = dayItems.find(item => item.type === 'sunrise');
    const sunsetItem = dayItems.find(item => item.type === 'sunset');
    byDate.push({
      date: dateKey,
      sunrise: sunriseItem ? byId.get(sunriseItem.id) || null : null,
      sunset: sunsetItem ? byId.get(sunsetItem.id) || null : null
    });
  }

  const today = byDate[0] || {};
  return {
    currentPeriod: period,
    current: today[period] || today.sunset || today.sunrise || null,
    sunrise: today.sunrise || null,
    sunset: today.sunset || null,
    list: predictions,
    byDate
  };
}

/**
 * 验证周边预测请求参数
 */
function validateSurroundingRequest(req, res, next) {
  const { lat, lon, radius, type } = req.body;

  if (typeof lat !== 'number' || lat < -90 || lat > 90) {
    return errorResponse(res, 400, 'INVALID_LATITUDE', 'lat must be a number between -90 and 90');
  }

  if (typeof lon !== 'number' || lon < -180 || lon > 180) {
    return errorResponse(res, 400, 'INVALID_LONGITUDE', 'lon must be a number between -180 and 180');
  }

  if (radius !== undefined && ![50, 100, 150].includes(radius)) {
    return errorResponse(res, 400, 'INVALID_RADIUS', 'radius must be 50, 100, or 150 kilometers');
  }

  if (type !== undefined && !['sunrise', 'sunset'].includes(type)) {
    return errorResponse(res, 400, 'INVALID_TYPE', 'type must be "sunrise" or "sunset"');
  }

  next();
}

/**
 * 验证批量预测请求参数
 */
function validateBatchRequest(req, res, next) {
  const { weatherDataArray, lat, lon, type } = req.body;

  if (!Array.isArray(weatherDataArray) || weatherDataArray.length === 0) {
    return errorResponse(res, 400, 'INVALID_WEATHER_DATA_ARRAY', 'weatherDataArray must be a non-empty array');
  }

  if (weatherDataArray.length > 30) {
    return errorResponse(res, 400, 'TOO_MANY_ITEMS', 'Maximum 30 items allowed per batch request');
  }

  for (let i = 0; i < weatherDataArray.length; i++) {
    const item = weatherDataArray[i];
    if (!item.weather || typeof item.weather !== 'object') {
      return errorResponse(res, 400, 'INVALID_WEATHER_DATA',
        `weatherDataArray[${i}].weather is required and must be an object`);
    }
    if (!item.date) {
      return errorResponse(res, 400, 'MISSING_DATE', `weatherDataArray[${i}].date is required`);
    }
  }

  if (typeof lat !== 'number' || lat < -90 || lat > 90) {
    return errorResponse(res, 400, 'INVALID_LATITUDE', 'lat must be a number between -90 and 90');
  }

  if (typeof lon !== 'number' || lon < -180 || lon > 180) {
    return errorResponse(res, 400, 'INVALID_LONGITUDE', 'lon must be a number between -180 and 180');
  }

  if (!type || !['sunrise', 'sunset'].includes(type)) {
    return errorResponse(res, 400, 'INVALID_TYPE', 'type must be "sunrise" or "sunset"');
  }

  next();
}

function validateClosedLoopBatchRequest(req, res, next) {
  const { items, lat, lon } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return errorResponse(res, 400, 'INVALID_ITEMS', 'items must be a non-empty array');
  }

  if (items.length > 12) {
    return errorResponse(res, 400, 'TOO_MANY_ITEMS', 'Maximum 12 closed-loop prediction items allowed');
  }

  if (typeof lat !== 'number' || lat < -90 || lat > 90) {
    return errorResponse(res, 400, 'INVALID_LATITUDE', 'lat must be a number between -90 and 90');
  }

  if (typeof lon !== 'number' || lon < -180 || lon > 180) {
    return errorResponse(res, 400, 'INVALID_LONGITUDE', 'lon must be a number between -180 and 180');
  }

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i] || {};
    if (!item.date) {
      return errorResponse(res, 400, 'MISSING_DATE', `items[${i}].date is required`);
    }
    if (!item.type || !['sunrise', 'sunset'].includes(item.type)) {
      return errorResponse(res, 400, 'INVALID_TYPE', `items[${i}].type must be "sunrise" or "sunset"`);
    }
  }

  next();
}

// ========== API 端点 ==========

/**
 * GET /api/prediction/home
 * Page-level gateway for the home prediction surface.
 *
 * The web app and miniprogram can consume this single payload so weather,
 * current sunrise/sunset cards, and the multi-day glow strip come from the
 * same backend weather snapshot and scoring path.
 */
router.get('/home', async (req, res) => {
  const totalProfile = startProfile();
  try {
    const lat = parseFiniteNumber(req.query.lat);
    const lon = parseFiniteNumber(req.query.lon);
    if (lat === null || lat < -90 || lat > 90) {
      return errorResponse(res, 400, 'INVALID_LATITUDE', 'lat must be a number between -90 and 90');
    }
    if (lon === null || lon < -180 || lon > 180) {
      return errorResponse(res, 400, 'INVALID_LONGITUDE', 'lon must be a number between -180 and 180');
    }

    const startDate = parseGatewayDate(req.query.date);
    if (!startDate) {
      return errorResponse(res, 400, 'INVALID_DATE', 'date must be a valid date');
    }

    const period = normalizeGatewayPeriod(req.query.period || req.query.type);
    const days = Math.max(1, Math.min(parseInt(req.query.days, 10) || 3, 4));
    const includeRemoteCloudData = String(req.query.includeRemoteCloudData || 'true') !== 'false';
    const forecastHours = Math.max(24, Math.min(parseInt(req.query.hours, 10) || 168, 168));

    const weatherFetchProfile = startProfile();
    const weatherResponse = await fetchClosedLoopWeatherData(lat, lon, forecastHours);
    const weatherFetchMs = profileDurationMs(weatherFetchProfile);
    const timezone = weatherResponse?.providerMeta?.timezone || null;
    const items = buildGatewayPredictionItems({ startDate, days, lat, lon, timezone });
    const predictions = new Array(items.length);

    const calculateItem = async (item, index) => {
      const closedLoop = await buildClosedLoopPredictionInput({
        lat,
        lon,
        date: item.date,
        type: item.type,
        referenceTime: item.referenceTime,
        weatherResponseOverride: weatherResponse,
        includeRemoteCloudData,
        forecastHours
      });
      return {
        id: item.id,
        date: item.date,
        dateKey: item.dateKey,
        dayIndex: item.dayIndex,
        ...buildEnhancedPredictionResponse({
          closedLoop,
          lat,
          lon,
          type: item.type,
          options: { includeRemoteCloudData }
        })
      };
    };

    const BATCH_SIZE = 2;
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      const rows = await Promise.all(batch.map((item, offset) => calculateItem(item, i + offset)));
      rows.forEach((row, offset) => {
        predictions[i + offset] = row;
      });
    }

    const groupedPredictions = groupGatewayPredictions({ predictions, items, startDate, days, period });
    const data = {
      location: {
        lat,
        lon,
        name: typeof req.query.name === 'string' ? req.query.name : null
      },
      request: {
        date: formatDateKey(startDate),
        period,
        days,
        includeRemoteCloudData
      },
      weather: buildGatewayWeatherPayload(weatherResponse, new Date()),
      predictions: groupedPredictions,
      source: {
        api: 'prediction-home-gateway',
        weatherProvider: weatherResponse?.providerMeta?.name || null,
        weatherCache: weatherResponse?.providerMeta?.cache || null
      },
      profile: {
        weatherFetchMs,
        totalMs: profileDurationMs(totalProfile)
      }
    };

    res.json({ success: true, data });
  } catch (error) {
    console.error('[PredictionRoute] Home gateway error:', error);
    const providerError = normalizeWeatherProviderError(error);
    if (providerError) {
      return errorResponse(res, providerError.status, providerError.code, providerError.message);
    }
    errorResponse(res, 500, 'PREDICTION_HOME_GATEWAY_ERROR', error.message);
  }
});

/**
 * POST /api/prediction/calculate
 * 基础单点火烧云预测 (Phase 1)
 *
 * 需求：22.1 - 核心预测算法后端化
 *
 * Request Body:
 * {
 *   weatherData: { cloudCover, humidity, visibility, lowCloudCover, highClouds, midClouds, lowClouds },
 *   date: "2024-06-21T18:00:00Z",
 *   lat: 40.0,
 *   lon: 116.0,
 *   type: "sunset" | "sunrise"
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     date: "...",
 *     score: 75,
 *     quality: "excellent",
 *     factors: { cloudCover: {...}, humidity: {...}, visibility: {...}, lowClouds: {...} },
 *     sunsetTime: "...",
 *     sunriseTime: "...",
 *     type: "sunset",
 *     goldenHour: { start: "...", end: "..." },
 *     blueHour: { start: "...", end: "..." },
 *     sunAzimuth: 280,
 *     cloudLayers: { high: 30, mid: 50, low: 10, description: "..." }
 *   }
 * }
 */
router.post('/calculate', validatePredictionRequest, (req, res) => {
  try {
    const { weatherData, date, lat, lon, type } = req.body;

    console.log(`[PredictionRoute] Basic prediction request: lat=${lat}, lon=${lon}, type=${type}`);

    const result = predictionService.calculatePrediction(weatherData, date, lat, lon, type);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[PredictionRoute] Basic prediction error:', error);
    errorResponse(res, 500, 'PREDICTION_ERROR', error.message);
  }
});

/**
 * POST /api/prediction/enhanced
 * 增强版单点火烧云预测 (Phase 3)
 *
 * Request Body:
 * {
 *   weatherData: { lowClouds, midClouds, highClouds, visibility, humidity, aqi },
 *   date: "2024-06-21T18:00:00Z",
 *   lat: 40.0,
 *   lon: 116.0,
 *   type: "sunset" | "sunrise",
 *   options: {
 *     remoteCloudData: { near: { totalCloud }, far: { totalCloud } },
 *     rainedRecently: false
 *   }
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: { score, quality, status, icon, ... }
 * }
 */
router.post('/enhanced', validatePredictionRequest, async (req, res) => {
  const totalProfile = startProfile();
  try {
    const { weatherData, date, lat, lon, type, options = {}, referenceTime } = req.body;
    const fastClosedLoop = options.fast === true;
    const forecastHours = Math.max(24, Math.min(Number(options.forecastHours) || (fastClosedLoop ? 48 : 168), 168));
    const includeRemoteCloudData = options.includeRemoteCloudData === true || (!fastClosedLoop && options.includeRemoteCloudData !== false);
    const weatherFetchOptions = fastClosedLoop
      ? { includeAirQuality: false, maxRetries: 1, timeoutMs: 5000 }
      : {};

    console.log(`[PredictionRoute] Enhanced ${weatherData ? 'legacy-weather' : 'closed-loop'} prediction request: lat=${lat}, lon=${lon}, type=${type}`);

    const closedLoop = weatherData
      ? {
          weatherData,
          referenceTime: new Date(date),
          providerMeta: null,
          prevHourData: options.prevHourData || null,
          rainedRecently: Boolean(options.rainedRecently),
          remoteCloudData: options.remoteCloudData || null,
          source: options.clientWeatherFallback ? 'client_weather_fallback' : 'client_weather_legacy',
          clientWeatherFallback: options.clientWeatherFallback === true
        }
      : await buildClosedLoopPredictionInput({
          lat,
          lon,
          date,
          type,
          referenceTime,
          includeRemoteCloudData,
          forecastHours,
          weatherFetchOptions
        });

    const compatResult = buildEnhancedPredictionResponse({ closedLoop, lat, lon, type, options });
    const profileTimings = closedLoop.profileTimings || {};
    compatResult.diagnostics = compatResult.diagnostics || {};
    compatResult.diagnostics.timings = {
      ...(compatResult.diagnostics.timings || {}),
      totalMs: profileDurationMs(totalProfile)
    };
    const aggregateProfile = {
      referenceMs: profileTimings.referenceMs ?? null,
      weatherFetchMs: profileTimings.weatherFetchMs ?? null,
      remoteCloudMs: profileTimings.remoteCloudMs ?? null,
      calculateMs: profileTimings.calculateMs ?? null,
      totalMs: compatResult.diagnostics.timings.totalMs,
      lat,
      lon,
      type,
      source: closedLoop.source || 'backend_closed_loop',
      weatherCache: closedLoop.providerMeta?.cache || null,
      remoteCloudCacheHit: closedLoop.remoteCloudData?.cache?.hit === true
    };
    console.info('[BackendProfileAggregate]', JSON.stringify(aggregateProfile));

    res.json({
      success: true,
      data: compatResult
    });

  } catch (error) {
    console.error('[PredictionRoute] Enhanced prediction error:', error);
    const providerError = normalizeWeatherProviderError(error);
    if (providerError) {
      return errorResponse(res, providerError.status, providerError.code, providerError.message);
    }
    errorResponse(res, 500, 'PREDICTION_ERROR', error.message);
  }
});

/**
 * POST /api/prediction/enhanced/closed-loop/batch
 * 后端闭环批量预测：前端只提交地点 + 多个 date/type/referenceTime，后端只拉一次天气并复用。
 */
router.post('/enhanced/closed-loop/batch', validateClosedLoopBatchRequest, async (req, res) => {
  try {
    const { items, lat, lon, options = {} } = req.body;
    const includeRemoteCloudData = options.includeRemoteCloudData === true;
    console.log(`[PredictionRoute] Closed-loop batch prediction request: ${items.length} items, lat=${lat}, lon=${lon}`);

    const weatherResponse = await fetchClosedLoopWeatherData(lat, lon, 168);
    const data = new Array(items.length);
    const calculateItem = async (item, index) => {
      const closedLoop = await buildClosedLoopPredictionInput({
        lat,
        lon,
        date: item.date,
        type: item.type,
        referenceTime: item.referenceTime,
        weatherResponseOverride: weatherResponse,
        includeRemoteCloudData
      });
      return {
        id: item.id ?? index,
        ...buildEnhancedPredictionResponse({
          closedLoop,
          lat,
          lon,
          type: item.type,
          options: item.options || options
        })
      };
    };

    // 小批量并发：同一地点 8 条朝/晚霞预测通常会触发光路采样。
    // 2 条一批能降低冷启动等待，同时避免一次性放大远端天气请求压力。
    const BATCH_SIZE = 2;
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map((item, offset) => calculateItem(item, i + offset)));
      batchResults.forEach((result, offset) => {
        data[i + offset] = result;
      });
    }

    res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error('[PredictionRoute] Closed-loop batch prediction error:', error);
    const providerError = normalizeWeatherProviderError(error);
    if (providerError) {
      return errorResponse(res, providerError.status, providerError.code, providerError.message);
    }
    errorResponse(res, 500, 'BATCH_CLOSED_LOOP_PREDICTION_ERROR', error.message);
  }
});

/**
 * POST /api/prediction/enhanced/batch
 * 增强版批量火烧云预测（多天）
 *
 * Request Body:
 * {
 *   weatherDataArray: [
 *     { weather: {...}, date: "...", rainedRecently: false },
 *     ...
 *   ],
 *   lat: 40.0,
 *   lon: 116.0,
 *   type: "sunset" | "sunrise"
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: [ { score, quality, ... }, ... ]
 * }
 */
router.post('/enhanced/batch', validateBatchRequest, (req, res) => {
  try {
    const { weatherDataArray, lat, lon, type } = req.body;

    console.log(`[PredictionRoute] Batch prediction request: ${weatherDataArray.length} items, type=${type}`);

    const results = EnhancedPredictionService.calculateBatchEnhancedPredictions(
      weatherDataArray,
      lat,
      lon,
      type
    );

    res.json({
      success: true,
      data: results,
      count: results.length
    });

  } catch (error) {
    console.error('[PredictionRoute] Batch prediction error:', error);
    errorResponse(res, 500, 'BATCH_PREDICTION_ERROR', error.message);
  }
});

/**
 * POST /api/prediction/canvas
 * 单独的画布评分（本地云况）
 *
 * Request Body:
 * {
 *   weatherData: { lowClouds, midClouds, highClouds }
 * }
 */
router.post('/canvas', (req, res) => {
  try {
    const { weatherData } = req.body;

    if (!weatherData || typeof weatherData !== 'object') {
      return errorResponse(res, 400, 'INVALID_WEATHER_DATA', 'weatherData is required and must be an object');
    }

    const result = EnhancedPredictionService.scoreCloudCanvas(weatherData);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[PredictionRoute] Canvas score error:', error);
    errorResponse(res, 500, 'CANVAS_SCORE_ERROR', error.message);
  }
});

/**
 * POST /api/prediction/rendering
 * 单独的渲染评分（画质修正）
 *
 * Request Body:
 * {
 *   weatherData: { visibility, humidity, aqi },
 *   rainedRecently: false
 * }
 */
router.post('/rendering', (req, res) => {
  try {
    const { weatherData, rainedRecently = false } = req.body;

    if (!weatherData || typeof weatherData !== 'object') {
      return errorResponse(res, 400, 'INVALID_WEATHER_DATA', 'weatherData is required and must be an object');
    }

    const result = EnhancedPredictionService.scoreRendering(weatherData, rainedRecently);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[PredictionRoute] Rendering score error:', error);
    errorResponse(res, 500, 'RENDERING_SCORE_ERROR', error.message);
  }
});

/**
 * POST /api/prediction/surrounding
 * 周边8方向火烧云预测聚合 (Phase 2)
 *
 * 需求：22.6, 22.7 - 周边采样聚合 API
 *
 * Request Body:
 * {
 *   lat: 40.0,
 *   lon: 116.0,
 *   radius: 100,          // 可选，50/100/150，默认100
 *   type: "sunset" | "sunrise",  // 可选，默认"sunset"
 *   date: "2024-06-21"    // 可选，默认今天
 * }
 */
router.post('/surrounding', validateSurroundingRequest, async (req, res) => {
  try {
    const { lat, lon, radius = 100, type = 'sunset', date } = req.body;

    console.log(`[PredictionRoute] Surrounding prediction request: lat=${lat}, lon=${lon}, radius=${radius}, type=${type}`);

    const result = await surroundingService.getSurroundingPredictions({
      lat,
      lon,
      radius,
      type,
      date
    });

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[PredictionRoute] Surrounding prediction error:', error);
    errorResponse(res, 500, 'SURROUNDING_PREDICTION_ERROR', error.message);
  }
});

/**
 * GET /api/prediction?lat=&lon=&type=
 * 快速单点预测（供雷达罗盘前端回退使用）
 * 内部先取天气数据，再用 EnhancedPredictionService 计算，返回包含 cloudLayers 的完整结果
 */
router.get('/', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    const type = req.query.type || 'sunset';

    if (isNaN(lat) || isNaN(lon)) {
      return errorResponse(res, 400, 'INVALID_PARAMS', 'lat and lon are required');
    }

    const now = new Date();
    const weatherResponse = await orchestrator.fetchWeatherData(lat, lon, 24);
    const hourly = Array.isArray(weatherResponse.data) ? weatherResponse.data : [];

    if (!hourly.length) {
      return errorResponse(res, 500, 'NO_WEATHER_DATA', 'No weather data available');
    }

    // 取最接近当前时刻的天气数据
    const nowTs = now.getTime();
    const selected = hourly.reduce((closest, current) => {
      return Math.abs((current.timestamp || 0) - nowTs) < Math.abs((closest.timestamp || 0) - nowTs)
        ? current : closest;
    }, hourly[0]);

    const weatherData = {
      cloudCover: selected.cloudCover || 0,
      humidity: selected.humidity || 0,
      visibility: selected.visibility || 10,
      lowClouds: selected.lowClouds || 0,
      midClouds: selected.midClouds || 0,
      highClouds: selected.highClouds || 0,
      lowCloudCover: selected.lowClouds || 0,
      precipitation: selected.precipitation || 0,
      shortwaveRadiation: selected.shortwaveRadiation ?? null,
      directRadiation: selected.directRadiation ?? null,
      diffuseRadiation: selected.diffuseRadiation ?? null,
      waterVapourColumn: selected.waterVapourColumn ?? null,
      aerosolOpticalDepth: selected.aerosolOpticalDepth ?? null,
      dust: selected.dust ?? null,
      pm2_5: selected.pm2_5 ?? null,
      pm10: selected.pm10 ?? null,
      aqi: selected.aqi ?? null,
    };

    // 找到 selected 之前 1-2 小时的数据（用于云厚辐射比）
    let prevHourData = null;
    const selectedIdx = hourly.indexOf(selected);
    for (let offset = 1; offset <= 2 && selectedIdx - offset >= 0; offset++) {
      const prev = hourly[selectedIdx - offset];
      if (prev && prev.shortwaveRadiation != null && prev.shortwaveRadiation > 50) {
        prevHourData = prev;
        break;
      }
    }

    const prediction = EnhancedPredictionService.calculateEnhancedPrediction(
      weatherData, now, lat, lon, type, { prevHourData }
    );

    // 雷达罗盘依赖 cloudLayers 字段，EnhancedPredictionService 不返回，手动补上
    prediction.cloudLayers = {
      low: weatherData.lowClouds,
      mid: weatherData.midClouds,
      high: weatherData.highClouds,
    };
    prediction.aerosolOpticalDepth = weatherData.aerosolOpticalDepth;
    prediction.dust = weatherData.dust;
    prediction.pm2_5 = weatherData.pm2_5;
    prediction.pm10 = weatherData.pm10;
    prediction.aqi = weatherData.aqi;

    res.json({
      success: true,
      data: prediction
    });
  } catch (error) {
    console.error('[PredictionRoute] GET prediction error:', error);
    errorResponse(res, 500, 'PREDICTION_ERROR', error.message);
  }
});

/**
 * GET /api/prediction/directions?lat=&lon=&type=&radius=
 * 一次返回 8 个方向的预测（雷达罗盘专用），避免前端发 8 个请求触发 rate limit
 */
router.get('/directions', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    const type = req.query.type || 'sunset';
    const radius = parseFloat(req.query.radius) || 20;

    if (isNaN(lat) || isNaN(lon)) {
      return errorResponse(res, 400, 'INVALID_PARAMS', 'lat and lon are required');
    }

    const DIRS = [
      { dir: 'N',  angle: 0   },
      { dir: 'NE', angle: 45  },
      { dir: 'E',  angle: 90  },
      { dir: 'SE', angle: 135 },
      { dir: 'S',  angle: 180 },
      { dir: 'SW', angle: 225 },
      { dir: 'W',  angle: 270 },
      { dir: 'NW', angle: 315 },
    ];
    const R = 6371;
    const now = new Date();

    const results = await Promise.allSettled(DIRS.map(async (d) => {
      const rad  = d.angle * Math.PI / 180;
      const dLat = (radius / R) * Math.cos(rad) * (180 / Math.PI);
      const dLon = (radius / R) * Math.sin(rad) / Math.cos(lat * Math.PI / 180) * (180 / Math.PI);
      const pLat = lat + dLat;
      const pLon = lon + dLon;

      const weatherResponse = await orchestrator.fetchWeatherData(pLat, pLon, 24);
      const hourly = Array.isArray(weatherResponse.data) ? weatherResponse.data : [];
      if (!hourly.length) throw new Error('no weather data');

      const nowTs = now.getTime();
      const selected = hourly.reduce((c, x) =>
        Math.abs((x.timestamp || 0) - nowTs) < Math.abs((c.timestamp || 0) - nowTs) ? x : c
      , hourly[0]);

      const weatherData = {
        cloudCover: selected.cloudCover || 0,
        humidity: selected.humidity || 0,
        visibility: selected.visibility || 10,
        lowClouds: selected.lowClouds || 0,
        midClouds: selected.midClouds || 0,
        highClouds: selected.highClouds || 0,
        lowCloudCover: selected.lowClouds || 0,
        precipitation: selected.precipitation || 0,
        shortwaveRadiation: selected.shortwaveRadiation ?? null,
        directRadiation: selected.directRadiation ?? null,
        diffuseRadiation: selected.diffuseRadiation ?? null,
        waterVapourColumn: selected.waterVapourColumn ?? null,
        aerosolOpticalDepth: selected.aerosolOpticalDepth ?? null,
        dust: selected.dust ?? null,
        pm2_5: selected.pm2_5 ?? null,
        pm10: selected.pm10 ?? null,
        aqi: selected.aqi ?? null,
      };

      // 找到 selected 之前 1-2 小时的数据
      let prevHourData = null;
      const selectedIdx = hourly.indexOf(selected);
      for (let offset = 1; offset <= 2 && selectedIdx - offset >= 0; offset++) {
        const prev = hourly[selectedIdx - offset];
        if (prev && prev.shortwaveRadiation != null && prev.shortwaveRadiation > 50) {
          prevHourData = prev;
          break;
        }
      }

      const prediction = EnhancedPredictionService.calculateEnhancedPrediction(
        weatherData, now, pLat, pLon, type, { prevHourData }
      );

      return {
        dir: d.dir,
        score: Math.round(prediction.score || 0),
        cloudLayers: {
          low: weatherData.lowClouds,
          mid: weatherData.midClouds,
          high: weatherData.highClouds,
        },
        aerosolOpticalDepth: weatherData.aerosolOpticalDepth,
        dust: weatherData.dust,
        pm2_5: weatherData.pm2_5,
        pm10: weatherData.pm10,
        aqi: weatherData.aqi
      };
    }));

    const directions = results.map((r, i) =>
      r.status === 'fulfilled'
        ? r.value
        : { dir: DIRS[i].dir, score: 0, cloudLayers: { low: 0, mid: 0, high: 0 } }
    );

    res.json({ success: true, data: { directions } });
  } catch (error) {
    console.error('[PredictionRoute] GET /directions error:', error);
    errorResponse(res, 500, 'DIRECTIONS_ERROR', error.message);
  }
});

module.exports = router;
