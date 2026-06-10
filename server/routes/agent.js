/**
 * Agent API Routes
 *
 * 受控接口说明：
 * - 提供 forecast / explain / geocode / map-summary 能力
 * - 所有接口均要求有效 token（除文档/健康类接口外）
 */

'use strict';

const express = require('express');
const router = express.Router();
const EnhancedPredictionService = require('../services/EnhancedPredictionService');
const orchestrator = require('../services/ProviderOrchestrator');
const ApiTokenService = require('../services/ApiTokenService');
const createAgentAuth = require('../middleware/agentAuth');
const apiAuditLog = require('../services/ApiAgentAuditLog');
const geocodingRoute = require('./geocoding');
const gridScoreService = require('../services/GridScoreService');
const geocodingPrivate = geocodingRoute._private || {};

const VALID_TYPES = new Set(['sunrise', 'sunset']);
const VALID_DETAILS = new Set(['simple', 'full']);
const apiTokenService = new ApiTokenService();

const OPENAPI_DOC = {
  openapi: '3.0.3',
  info: {
    title: 'Xiake Agent API',
    version: '1.0.0',
    description: '霞客 Agent 接口：forecast / explain / geocode（需 token 鉴权），用于火烧云预报与地理位置解析。'
  },
  servers: [{ url: '/api' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'Token'
      }
    }
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/api/agent/forecast': {
      get: {
        summary: '火烧云预测',
        parameters: [
          { in: 'query', name: 'lat', required: false, schema: { type: 'number', minimum: -90, maximum: 90 } },
          { in: 'query', name: 'lon', required: false, schema: { type: 'number', minimum: -180, maximum: 180 } },
          { in: 'query', name: 'location', required: false, schema: { type: 'string' } },
          { in: 'query', name: 'type', required: false, schema: { type: 'string', enum: ['sunrise', 'sunset'] } },
          { in: 'query', name: 'date', required: false, schema: { type: 'string' } },
          { in: 'query', name: 'detail', required: false, schema: { type: 'string', enum: ['simple', 'full'] } }
        ],
        responses: { 200: { description: 'OK' }, 400: { description: '请求参数错误' }, 401: { description: '鉴权失败' }, 403: { description: '权限不足/配额' }, 429: { description: '配额超限' }, 500: { description: '服务错误' } }
      }
    },
    '/api/agent/explain': {
      get: {
        summary: '解释性预测',
        parameters: [
          { in: 'query', name: 'lat', required: false, schema: { type: 'number', minimum: -90, maximum: 90 } },
          { in: 'query', name: 'lon', required: false, schema: { type: 'number', minimum: -180, maximum: 180 } },
          { in: 'query', name: 'location', required: false, schema: { type: 'string' } },
          { in: 'query', name: 'type', required: false, schema: { type: 'string', enum: ['sunrise', 'sunset'] } },
          { in: 'query', name: 'date', required: false, schema: { type: 'string' } }
        ],
        responses: { 200: { description: 'OK' }, 400: { description: '请求参数错误' }, 401: { description: '鉴权失败' }, 403: { description: '权限不足/配额' }, 429: { description: '配额超限' }, 500: { description: '服务错误' } }
      }
    },
    '/api/agent/geocode': {
      get: {
        summary: '地理编码',
        parameters: [
          { in: 'query', name: 'q', required: true, schema: { type: 'string' } },
          { in: 'query', name: 'limit', required: false, schema: { type: 'integer', minimum: 1, maximum: 20 } }
        ],
        responses: { 200: { description: 'OK' }, 400: { description: '请求参数错误' }, 401: { description: '鉴权失败' }, 403: { description: '权限不足/配额' }, 404: { description: '未找到地点' }, 429: { description: '配额超限' }, 500: { description: '服务错误' } }
      }
    },
    '/api/agent/map-summary': {
      get: {
        summary: '区域火烧云地图摘要',
        parameters: [
          { in: 'query', name: 'bbox', required: false, schema: { type: 'string', description: 'west,south,east,north' } },
          { in: 'query', name: 'type', required: false, schema: { type: 'string', enum: ['sunrise', 'sunset'] } },
          { in: 'query', name: 'threshold', required: false, schema: { type: 'number', minimum: 0, maximum: 100 } },
          { in: 'query', name: 'limit', required: false, schema: { type: 'integer', minimum: 1, maximum: 50 } }
        ],
        responses: { 200: { description: 'OK' }, 400: { description: '请求参数错误' }, 401: { description: '鉴权失败' }, 403: { description: '权限不足/配额' }, 429: { description: '配额超限' }, 503: { description: '地图缓存未就绪' }, 500: { description: '服务错误' } }
      }
    }
  }
};


function errorResponse(res, status, code, message, extra = null) {
  return res.status(status).json({
    success: false,
    error: { code, message },
    ...(extra ? { ...(extra || {}) } : {})
  });
}

function parseCoordinate(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function parseBbox(value) {
  if (!value) return null;
  const parts = String(value).split(',').map((item) => Number(item.trim()));
  if (parts.length !== 4 || parts.some((item) => !Number.isFinite(item))) return NaN;
  const [west, south, east, north] = parts;
  if (west < -180 || east > 180 || south < -90 || north > 90 || west >= east || south >= north) return NaN;
  return { west, south, east, north };
}

function pointInBbox(point, bbox) {
  if (!bbox) return true;
  return point.lon >= bbox.west && point.lon <= bbox.east && point.lat >= bbox.south && point.lat <= bbox.north;
}

function scoreQuality(score) {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

function buildMapSummary({ cache, type, bbox, threshold, limit }) {
  const points = (Array.isArray(cache?.gridPoints) ? cache.gridPoints : [])
    .filter((point) => Number.isFinite(point.score) && point.score >= threshold && pointInBbox(point, bbox))
    .sort((a, b) => b.score - a.score);

  const scores = points.map((point) => point.score);
  const averageScore = scores.length
    ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1))
    : 0;
  const maxScore = scores.length ? Number(Math.max(...scores).toFixed(1)) : 0;
  const topPoints = points.slice(0, limit).map((point) => ({
    lat: Number(point.lat),
    lon: Number(point.lon),
    score: Number(Number(point.score).toFixed(1)),
    quality: point.quality || scoreQuality(point.score)
  }));

  return {
    success: true,
    data: {
      type,
      bbox,
      threshold,
      updatedAt: cache.updatedAt,
      summary: {
        matchingPoints: points.length,
        averageScore,
        maxScore,
        quality: scoreQuality(maxScore)
      },
      topPoints,
      meta: {
        source: 'GridScoreService cache',
        limited: points.length > limit,
        limit,
        generatedAt: new Date().toISOString()
      }
    }
  };
}

function parseForecastDate(input, now = new Date()) {
  const value = (input || 'today').toString().trim().toLowerCase();
  const base = new Date(now);
  base.setHours(0, 0, 0, 0);

  if (value === 'today') return base;
  if (value === 'tomorrow') {
    base.setDate(base.getDate() + 1);
    return base;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function selectWeatherForDate(hourly, forecastDate, type) {
  if (!Array.isArray(hourly) || hourly.length === 0) return null;

  const target = new Date(forecastDate);
  target.setHours(type === 'sunrise' ? 6 : 18, 0, 0, 0);
  const targetTs = target.getTime();

  return hourly.reduce((closest, item) => {
    const itemTs = Number(item.timestamp) || new Date(item.time || item.date || 0).getTime();
    const closestTs = Number(closest.timestamp) || new Date(closest.time || closest.date || 0).getTime();
    return Math.abs(itemTs - targetTs) < Math.abs(closestTs - targetTs) ? item : closest;
  }, hourly[0]);
}

function normalizeWeatherData(selected = {}) {
  return {
    cloudCover: selected.cloudCover || 0,
    humidity: selected.humidity || 0,
    visibility: selected.visibility || 10,
    lowClouds: selected.lowClouds || 0,
    midClouds: selected.midClouds || 0,
    highClouds: selected.highClouds || 0,
    lowCloudCover: selected.lowClouds ?? selected.lowCloudCover ?? 0,
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
}

function buildViewingWindow(prediction, type) {
  const date = prediction?.date ? new Date(prediction.date) : null;
  const duration = prediction?.geometricModel?.durationMin;
  if (!date || Number.isNaN(date.getTime())) return null;

  const offsetBefore = type === 'sunrise' ? -35 : -25;
  const offsetAfter = Number.isFinite(duration) ? Math.max(15, Math.round(duration)) : 35;
  const start = new Date(date.getTime() + offsetBefore * 60 * 1000);
  const end = new Date(date.getTime() + offsetAfter * 60 * 1000);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    description: type === 'sunrise' ? '日出前后观测窗口' : '日落前后观测窗口'
  };
}

function buildSummary(prediction, type) {
  const score = Math.round(Number(prediction.score) || 0);
  const label = type === 'sunrise' ? '朝霞' : '晚霞';
  if (prediction?.aerosolHazeCap?.level === 'extreme') return `${label}受沙尘/灰幕严重压制，虽然可能有高云，但不建议专门等待。`;
  if (prediction?.aerosolHazeCap?.applied) return `${label}有灰幕风险，高云多也可能只呈现暗淡局部色彩。`;
  if (prediction?.highCloudCarrierAdjustment?.applied && score >= 60) return `${label}高云载体清晰、低云遮挡少，有较好观赏机会。`;
  if (score >= 75) return `${label}条件很好，值得重点关注。`;
  if (score >= 55) return `${label}有一定机会，建议到时观察云层和通透度。`;
  if (score >= 35) return `${label}机会一般，条件存在明显限制。`;
  return `${label}机会较低，不建议专门等待。`;
}

function buildAgentForecastResponse({ location, prediction, weatherData, type, detail, forecastDate }) {
  const base = {
    success: true,
    data: {
      location,
      type,
      date: forecastDate.toISOString().slice(0, 10),
      score: Math.round(Number(prediction.score) || 0),
      quality: prediction.quality,
      bestViewingWindow: buildViewingWindow(prediction, type),
      summary: buildSummary(prediction, type),
      warnings: [],
      meta: {
        detail,
        generatedAt: new Date().toISOString(),
        algorithm: 'EnhancedPredictionService',
        dataSource: 'Open-Meteo'
      }
    }
  };

  if (detail === 'full') {
    base.data.factors = {
      cloudCover: weatherData.cloudCover,
      lowClouds: weatherData.lowClouds,
      midClouds: weatherData.midClouds,
      highClouds: weatherData.highClouds,
      humidity: weatherData.humidity,
      visibility: weatherData.visibility,
      precipitation: weatherData.precipitation,
      aerosolOpticalDepth: weatherData.aerosolOpticalDepth,
      pm2_5: weatherData.pm2_5,
      pm10: weatherData.pm10,
      aqi: weatherData.aqi
    };
    base.data.explanation = {
      status: prediction.status,
      description: prediction.description,
      cloudType: prediction.cloudType,
      geometricModel: prediction.geometricModel,
      cloudThickness: prediction.cloudThickness,
      thickHighCloudPenalty: prediction.thickHighCloudPenalty,
      aerosolHazeCap: prediction.aerosolHazeCap,
      highCloudCarrierAdjustment: prediction.highCloudCarrierAdjustment,
      scoreBeforeOcclusion: prediction.scoreBeforeOcclusion
    };
  }

  return base;
}

async function geocodeLocation(query) {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', query);
  url.searchParams.set('count', '1');
  url.searchParams.set('language', 'zh');
  url.searchParams.set('format', 'json');

  const response = await fetch(url);
  if (!response.ok) throw new Error(`geocoding failed: ${response.status}`);
  const payload = await response.json();
  const first = payload?.results?.[0];
  if (!first) return null;

  return {
    name: first.name,
    country: first.country,
    countryCode: first.country_code,
    admin1: first.admin1,
    lat: Number(first.latitude),
    lon: Number(first.longitude),
    provider: 'openmeteo'
  };
}


function toExplainFactorRelations(prediction) {
  const breakdown = prediction?.breakdown || {};
  return [
    { name: 'canvasScore', weight: 0.4, value: Number(breakdown.canvasScore ?? prediction?.canvasAnalysis?.score ?? 0), reason: '近地面云况（高/中/低云）' },
    { name: 'lightPathScore', weight: 0.6, value: Number(breakdown.lightPathScore ?? prediction?.lightPathAnalysis?.score ?? 0), reason: '光路路径几何与透射特征' },
    { name: 'renderingFactor', weight: 1, value: Number(breakdown.renderingFactor ?? prediction?.renderingAnalysis?.factor ?? 1), reason: '颗粒物与降水后的视觉修正系数' }
  ];
}

function buildAgentExplainResponse({ location, prediction, weatherData, type, date, forecastDate }) {
  const factorRelations = toExplainFactorRelations(prediction);
  const constraints = [];
  if (!prediction) {
    constraints.push({ code: 'UNKNOWN', reason: '缺少预测底层数据' });
  }
  if (prediction?.geometricModel && prediction.geometricModel.feasible === false) {
    constraints.push({ code: 'GEOMETRIC_BLOCK', reason: prediction.geometricModel.reason || '当前日照角度/太阳高度导致观测几何受限' });
  }
  if (prediction?.cloudThickness?.reasons?.length) {
    constraints.push({ code: 'CLOUD_THICKNESS', reason: prediction.cloudThickness.reasons.join('; ') });
  }
  if (prediction?.aerosolHazeCap?.applied) {
    constraints.push({ code: 'AEROSOL_HAZE_CAP', reason: prediction.aerosolHazeCap.reason });
  }
  if (prediction?.highCloudCarrierAdjustment?.applied) {
    constraints.push({ code: 'HIGH_CLOUD_CARRIER_FLOOR', reason: prediction.highCloudCarrierAdjustment.reason });
  }
  if (prediction?.occlusion && prediction.occlusion.ratio != null && prediction.occlusion.ratio > 0) {
    constraints.push({ code: 'SOLAR_OCCLUSION', reason: `遮挡系数 ${(prediction.occlusion.ratio * 100).toFixed(1)}%` });
  }

  const maxScore = factorRelations.reduce((sum, item) => sum + (Number(item.value) || 0) * (item.weight > 1 ? 1 : item.weight), 0);
  const naturalLanguage = buildSummary(prediction, type);

  return {
    success: true,
    data: {
      location,
      type,
      date: forecastDate.toISOString().slice(0, 10),
      score: Number(prediction?.score || 0),
      quality: prediction?.quality,
      scoreComposition: {
        baseScore: Number(prediction?.breakdown?.baseScore || 0),
        renderedScore: Number(prediction?.breakdown?.unclampedFinalScore || 0),
        finalCap: 100,
        estimatedMax: Number((maxScore || 0).toFixed(1))
      },
      factorRelations,
      constraints,
      explanation: {
        status: prediction?.status,
        description: prediction?.description,
        narrative: naturalLanguage,
        cloudType: prediction?.cloudType,
        geometricModel: prediction?.geometricModel,
        cloudThickness: prediction?.cloudThickness,
        thickHighCloudPenalty: prediction?.thickHighCloudPenalty,
        aerosolHazeCap: prediction?.aerosolHazeCap,
        highCloudCarrierAdjustment: prediction?.highCloudCarrierAdjustment,
        weatherSnapshot: {
          cloudCover: weatherData.cloudCover,
          humidity: weatherData.humidity,
          visibility: weatherData.visibility,
          lowClouds: weatherData.lowClouds,
          midClouds: weatherData.midClouds,
          highClouds: weatherData.highClouds
        }
      }
    }
  };
}

function normalizeOpenMeteoItem(item = {}, fallbackName = '') {
  if (!item || typeof item !== 'object') return null;
  const lat = Number(item.latitude);
  const lon = Number(item.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return {
    name: item.name || fallbackName,
    standardized: item.name || fallbackName,
    country: item.country || null,
    countryCode: item.country_code || item.countryCode || null,
    admin1: item.admin1 || null,
    lat,
    lon,
    provider: 'openmeteo',
    type: item.type || null,
    population: item.population || 0
  };
}

async function geocodeQueryCandidates(query, limit = 10) {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', query);
  url.searchParams.set('count', String(Math.max(1, Math.min(20, Number(limit) || 10))));
  url.searchParams.set('language', 'zh');
  url.searchParams.set('format', 'json');
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`geocoding upstream failed: ${response.status}`);
  }
  const payload = await response.json();
  return Array.isArray(payload?.results)
    ? payload.results.map((item, index) => normalizeOpenMeteoItem(item, `result-${index + 1}`)).filter(Boolean)
    : [];
}

function buildGeocodeConfidence(rankScore) {
  const normalized = Number(rankScore);
  if (!Number.isFinite(normalized) || normalized <= 0) return 0.01;
  return Number(Math.min(1, normalized / 500).toFixed(3));
}

async function searchAgentGeocode(query, limit = 10) {
  const rawQuery = String(query || '').trim();
  const limitNum = Math.max(1, Math.min(20, Number(limit) || 10));
  if (!rawQuery) return [];

  const variants = Array.isArray(geocodingPrivate.getQueryVariants)
    ? geocodingPrivate.getQueryVariants(rawQuery)
    : [rawQuery];
  const rawResults = [];
  const seen = new Set();
  for (const v of variants) {
    const normalizedVariant = String(v || '').trim();
    if (!normalizedVariant) continue;
    const results = await geocodeQueryCandidates(normalizedVariant, limitNum);
    for (const result of results) {
      const key = `${result.lat.toFixed(5)},${result.lon.toFixed(5)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rawResults.push(result);
    }
  }

  const ranked = Array.isArray(geocodingPrivate.rankGeocodingResults)
    ? geocodingPrivate.rankGeocodingResults(rawQuery, rawResults)
    : rawResults;
  return ranked.slice(0, limitNum).map((item) => ({
    ...item,
    confidence: buildGeocodeConfidence(item.rankScore),
    rankReason: item.rankReason || 'default'
  }));
}


function getClientIp(req) {
  const forwarded = req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip']);
  if (forwarded) {
    return String(forwarded).split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

function logAudit(req, endpoint, status, elapsedMs, errorCode = null) {
  apiAuditLog.add({
    tokenId: req.agentToken?.id || null,
    endpoint,
    status,
    elapsedMs,
    ip: getClientIp(req),
    userAgent: req.headers['user-agent'],
    errorCode
  });
}

router.get('/forecast', createAgentAuth({ scope: 'forecast:read', apiTokenService, auditLogger: apiAuditLog }), async (req, res) => {
  const startedAt = Date.now();
  let location;
  let type;
  let detail;
  let forecastDate;
  try {
    type = (req.query.type || 'sunset').toString();
    detail = (req.query.detail || 'simple').toString();

    if (!VALID_TYPES.has(type)) {
      throw { status: 400, code: 'INVALID_TYPE', message: 'type must be sunrise or sunset' };
    }
    if (!VALID_DETAILS.has(detail)) {
      throw { status: 400, code: 'INVALID_DETAIL', message: 'detail must be simple or full' };
    }

    forecastDate = parseForecastDate(req.query.date);
    if (!forecastDate) {
      throw { status: 400, code: 'INVALID_DATE', message: 'date must be today, tomorrow, or YYYY-MM-DD' };
    }

    let lat = parseCoordinate(req.query.lat);
    let lon = parseCoordinate(req.query.lon);

    if (lat !== null || lon !== null) {
      if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
        throw { status: 400, code: 'INVALID_COORDINATES', message: 'lat/lon are invalid' };
      }
      location = { name: req.query.location || `${lat},${lon}`, lat, lon, provider: 'coordinates' };
    } else if (req.query.location) {
      location = await geocodeLocation(req.query.location.toString());
      if (!location) {
        throw { status: 404, code: 'LOCATION_NOT_FOUND', message: 'location not found' };
      }
      lat = location.lat;
      lon = location.lon;
    } else {
      throw { status: 400, code: 'MISSING_LOCATION', message: 'location or lat/lon is required' };
    }

    const weatherResponse = await orchestrator.fetchWeatherData(lat, lon, 168);
    const hourly = Array.isArray(weatherResponse.data) ? weatherResponse.data : [];
    const selected = selectWeatherForDate(hourly, forecastDate, type);
    if (!selected) {
      throw { status: 502, code: 'WEATHER_UNAVAILABLE', message: 'weather data unavailable' };
    }

    const weatherData = normalizeWeatherData(selected);
    const prediction = EnhancedPredictionService.calculateEnhancedPrediction(weatherData, forecastDate, lat, lon, type);
    const elapsedMs = Date.now() - startedAt;
    logAudit(req, '/api/agent/forecast', 200, elapsedMs, null);

    return res.json(buildAgentForecastResponse({ location, prediction, weatherData, type, detail, forecastDate }));
  } catch (error) {
    const status = Number.isFinite(error?.status) ? error.status : 500;
    const code = error?.code || 'AGENT_FORECAST_ERROR';
    const elapsedMs = Date.now() - startedAt;
    const errMessage = error?.message || 'forecast failed';
    logAudit(req, '/api/agent/forecast', status, elapsedMs, code);

    console.error('[AgentRoute] forecast error:', code, errMessage);

    return errorResponse(res, status, code, errMessage);
  }
});


router.get('/explain', createAgentAuth({ scopeAny: ['explain:read', 'forecast:read'], apiTokenService, auditLogger: apiAuditLog }), async (req, res) => {
  const startedAt = Date.now();
  let location;
  try {
    const type = (req.query.type || 'sunset').toString();
    let lat = parseCoordinate(req.query.lat);
    let lon = parseCoordinate(req.query.lon);

    if (!VALID_TYPES.has(type)) {
      throw { status: 400, code: 'INVALID_TYPE', message: 'type must be sunrise or sunset' };
    }

    const forecastDate = parseForecastDate(req.query.date);
    if (!forecastDate) {
      throw { status: 400, code: 'INVALID_DATE', message: 'date must be today, tomorrow, or YYYY-MM-DD' };
    }

    if (lat !== null || lon !== null) {
      if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
        throw { status: 400, code: 'INVALID_COORDINATES', message: 'lat/lon are invalid' };
      }
      location = { name: req.query.location || `${lat},${lon}`, lat, lon, provider: 'coordinates' };
    } else if (req.query.location) {
      const searched = await geocodeLocation(req.query.location.toString());
      if (!searched) {
        throw { status: 404, code: 'LOCATION_NOT_FOUND', message: 'location not found' };
      }
      location = searched;
      lat = searched.lat;
      lon = searched.lon;
    } else {
      throw { status: 400, code: 'MISSING_LOCATION', message: 'location or lat/lon is required' };
    }

    const weatherResponse = await orchestrator.fetchWeatherData(lat, lon, 168);
    const hourly = Array.isArray(weatherResponse.data) ? weatherResponse.data : [];
    const selected = selectWeatherForDate(hourly, forecastDate, type);
    if (!selected) {
      throw { status: 502, code: 'WEATHER_UNAVAILABLE', message: 'weather data unavailable' };
    }

    const weatherData = normalizeWeatherData(selected);
    const prediction = EnhancedPredictionService.calculateEnhancedPrediction(weatherData, forecastDate, lat, lon, type);
    const elapsedMs = Date.now() - startedAt;
    logAudit(req, '/api/agent/explain', 200, elapsedMs, null);
    return res.json(buildAgentExplainResponse({ location, prediction, weatherData, type, forecastDate, date: forecastDate.toISOString() }));
  } catch (error) {
    const status = Number.isFinite(error?.status) ? error.status : 500;
    const code = error?.code || 'AGENT_EXPLAIN_ERROR';
    const errMessage = error?.message || 'explain failed';
    const elapsedMs = Date.now() - startedAt;
    logAudit(req, '/api/agent/explain', status, elapsedMs, code);
    console.error('[AgentRoute] explain error:', code, errMessage);
    return errorResponse(res, status, code, errMessage);
  }
});

router.get('/geocode', createAgentAuth({ scope: 'geocode:read', apiTokenService, auditLogger: apiAuditLog }), async (req, res) => {
  const startedAt = Date.now();
  try {
    const q = req.query.q ? req.query.q.toString().trim() : '';
    if (!q) {
      throw { status: 400, code: 'INVALID_PARAMS', message: 'q is required' };
    }
    const limit = parseInt(req.query.limit, 10) || 10;
    const candidates = await searchAgentGeocode(q, limit);
    if (!candidates.length) {
      const elapsedMs = Date.now() - startedAt;
      logAudit(req, '/api/agent/geocode', 404, elapsedMs, 'LOCATION_NOT_FOUND');
      return errorResponse(res, 404, 'LOCATION_NOT_FOUND', 'location not found');
    }
    const top = candidates[0];
    const elapsedMs = Date.now() - startedAt;
    logAudit(req, '/api/agent/geocode', 200, elapsedMs, null);
    return res.json({ success: true, data: { query: q, top, results: candidates } });
  } catch (error) {
    const status = Number.isFinite(error?.status) ? error.status : 500;
    const code = error?.code || 'AGENT_GEOCODE_ERROR';
    const errMessage = error?.message || 'geocode failed';
    const elapsedMs = Date.now() - startedAt;
    logAudit(req, '/api/agent/geocode', status, elapsedMs, code);
    console.error('[AgentRoute] geocode error:', code, errMessage);
    return errorResponse(res, status, code, errMessage);
  }
});

router.get('/map-summary', createAgentAuth({ scopeAny: ['map:read', 'forecast:read'], apiTokenService, auditLogger: apiAuditLog }), async (req, res) => {
  const startedAt = Date.now();
  try {
    const type = (req.query.type || 'sunset').toString();
    if (!VALID_TYPES.has(type)) {
      throw { status: 400, code: 'INVALID_TYPE', message: 'type must be sunrise or sunset' };
    }

    const bbox = parseBbox(req.query.bbox);
    if (Number.isNaN(bbox)) {
      throw { status: 400, code: 'INVALID_BBOX', message: 'bbox must be west,south,east,north' };
    }

    const rawThreshold = req.query.threshold === undefined ? 40 : Number(req.query.threshold);
    if (!Number.isFinite(rawThreshold) || rawThreshold < 0 || rawThreshold > 100) {
      throw { status: 400, code: 'INVALID_THRESHOLD', message: 'threshold must be 0-100' };
    }
    const threshold = Number(rawThreshold.toFixed(1));

    const rawLimit = req.query.limit === undefined ? 10 : Number(req.query.limit);
    if (!Number.isFinite(rawLimit) || rawLimit < 1 || rawLimit > 50) {
      throw { status: 400, code: 'INVALID_LIMIT', message: 'limit must be 1-50' };
    }
    const limit = Math.floor(rawLimit);

    const cache = gridScoreService.getCache(type);
    if (!cache || !Array.isArray(cache.gridPoints)) {
      throw { status: 503, code: 'MAP_CACHE_NOT_READY', message: 'map score cache is not ready' };
    }

    const elapsedMs = Date.now() - startedAt;
    logAudit(req, '/api/agent/map-summary', 200, elapsedMs, null);
    return res.json(buildMapSummary({ cache, type, bbox, threshold, limit }));
  } catch (error) {
    const status = Number.isFinite(error?.status) ? error.status : 500;
    const code = error?.code || 'AGENT_MAP_SUMMARY_ERROR';
    const errMessage = error?.message || 'map summary failed';
    const elapsedMs = Date.now() - startedAt;
    logAudit(req, '/api/agent/map-summary', status, elapsedMs, code);
    console.error('[AgentRoute] map-summary error:', code, errMessage);
    return errorResponse(res, status, code, errMessage);
  }
});

router.get('/openapi.json', (req, res) => {
  res.set('Cache-Control', 'no-store');
  return res.json(OPENAPI_DOC);
});

module.exports = router;
module.exports._private = {
  parseForecastDate,
  selectWeatherForDate,
  normalizeWeatherData,
  buildAgentForecastResponse,
  geocodeLocation,
  buildAgentExplainResponse,
  toExplainFactorRelations,
  normalizeOpenMeteoItem,
  buildGeocodeConfidence,
  geocodeQueryCandidates,
  searchAgentGeocode,
  parseBbox,
  buildMapSummary,
  OPENAPI_DOC
};
