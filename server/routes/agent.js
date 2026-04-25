const express = require('express');
const router = express.Router();
const EnhancedPredictionService = require('../services/EnhancedPredictionService');
const orchestrator = require('../services/ProviderOrchestrator');
const createAgentAuth = require('../middleware/agentAuth');

const VALID_TYPES = new Set(['sunrise', 'sunset']);
const VALID_DETAILS = new Set(['simple', 'full']);

function errorResponse(res, status, code, message) {
  return res.status(status).json({ success: false, error: { code, message } });
}

function parseCoordinate(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
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
    lowCloudCover: selected.lowClouds || selected.lowCloudCover || 0,
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

router.get('/forecast', createAgentAuth({ scope: 'forecast:read' }), async (req, res) => {
  try {
    const type = (req.query.type || 'sunset').toString();
    const detail = (req.query.detail || 'simple').toString();

    if (!VALID_TYPES.has(type)) {
      return errorResponse(res, 400, 'INVALID_TYPE', 'type must be sunrise or sunset');
    }
    if (!VALID_DETAILS.has(detail)) {
      return errorResponse(res, 400, 'INVALID_DETAIL', 'detail must be simple or full');
    }

    const forecastDate = parseForecastDate(req.query.date);
    if (!forecastDate) {
      return errorResponse(res, 400, 'INVALID_DATE', 'date must be today, tomorrow, or YYYY-MM-DD');
    }

    let lat = parseCoordinate(req.query.lat);
    let lon = parseCoordinate(req.query.lon);
    let location;

    if (lat !== null || lon !== null) {
      if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
        return errorResponse(res, 400, 'INVALID_COORDINATES', 'lat/lon are invalid');
      }
      location = { name: req.query.location || `${lat},${lon}`, lat, lon, provider: 'coordinates' };
    } else if (req.query.location) {
      location = await geocodeLocation(req.query.location.toString());
      if (!location) return errorResponse(res, 404, 'LOCATION_NOT_FOUND', 'location not found');
      lat = location.lat;
      lon = location.lon;
    } else {
      return errorResponse(res, 400, 'MISSING_LOCATION', 'location or lat/lon is required');
    }

    const weatherResponse = await orchestrator.fetchWeatherData(lat, lon, 168);
    const hourly = Array.isArray(weatherResponse.data) ? weatherResponse.data : [];
    const selected = selectWeatherForDate(hourly, forecastDate, type);
    if (!selected) return errorResponse(res, 502, 'WEATHER_UNAVAILABLE', 'weather data unavailable');

    const weatherData = normalizeWeatherData(selected);
    const prediction = EnhancedPredictionService.calculateEnhancedPrediction(weatherData, forecastDate, lat, lon, type);

    return res.json(buildAgentForecastResponse({ location, prediction, weatherData, type, detail, forecastDate }));
  } catch (error) {
    console.error('[AgentRoute] forecast error:', error);
    return errorResponse(res, 500, 'AGENT_FORECAST_ERROR', error.message);
  }
});

module.exports = router;
module.exports._private = {
  parseForecastDate,
  selectWeatherForDate,
  normalizeWeatherData,
  buildAgentForecastResponse,
  geocodeLocation
};
