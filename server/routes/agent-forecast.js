const express = require('express');
const router = express.Router();

const BackendGeocodingService = require('../services/BackendGeocodingService');
const orchestrator = require('../services/ProviderOrchestrator');
const SunCalculator = require('../utils/SunCalculator');
const EnhancedPredictionService = require('../services/EnhancedPredictionService');
const { buildTimeWeightedWeatherSample } = require('../services/WeatherTimeSampler');

function errorResponse(res, status, code, message, extra = null) {
  const body = {
    error: {
      code,
      message
    }
  };

  if (extra && Object.keys(extra).length > 0) {
    body.error.details = extra;
  }

  return res.status(status).json(body);
}

function parseDateParam(value) {
  if (!value || value === 'today') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  if (value === 'tomorrow') {
    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }

  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function pickClosestWeather(hourly = [], targetTs) {
  const sample = buildTimeWeightedWeatherSample(hourly, targetTs);
  return sample.weighted || sample.selected;
}

function normalizeWeatherForPrediction(weather = {}, providerMeta = {}) {
  return {
    cloudCover: weather.cloudCover ?? 0,
    humidity: weather.humidity ?? 0,
    visibility: weather.visibility ?? 10,
    lowClouds: weather.lowClouds ?? weather.lowCloudCover ?? 0,
    midClouds: weather.midClouds ?? 0,
    highClouds: weather.highClouds ?? 0,
    lowCloudCover: weather.lowClouds ?? weather.lowCloudCover ?? 0,
    precipitation: weather.precipitation ?? 0,
    shortwaveRadiation: weather.shortwaveRadiation ?? null,
    directRadiation: weather.directRadiation ?? null,
    diffuseRadiation: weather.diffuseRadiation ?? null,
    waterVapourColumn: weather.waterVapourColumn ?? null,
    aerosolOpticalDepth: weather.aerosolOpticalDepth ?? null,
    dust: weather.dust ?? null,
    pm2_5: weather.pm2_5 ?? null,
    pm10: weather.pm10 ?? null,
    aqi: weather.aqi ?? null,
    weatherCode: weather.weatherCode ?? null,
    weather: weather.weather ?? null,
    weatherMain: weather.weatherMain ?? null,
    weatherText: weather.weatherText ?? null,
    weatherDescription: weather.weatherDescription ?? null,
    condition: weather.condition ?? null,
    windSpeed: weather.windSpeed ?? 0,
    windDirection: weather.windDirection ?? 0,
    pressure: weather.pressure ?? 1013,
    timezone: weather.timezone || providerMeta.timezone || null,
    utcOffsetSeconds: weather.utcOffsetSeconds ?? providerMeta.utcOffsetSeconds ?? null
  };
}

function buildResponse(detail, payload) {
  const base = {
    location: payload.location,
    score: payload.score,
    quality: payload.quality,
    bestViewingWindow: payload.bestViewingWindow,
    summary: payload.summary,
    explanation: {
      status: payload.status,
      description: payload.description,
      advice: payload.advice
    },
    warnings: payload.warnings,
    factors: payload.factors,
    meta: payload.meta
  };

  if (detail === 'full') {
    base.explanation = {
      ...base.explanation,
      cloudType: payload.cloudType,
      geometricModel: payload.geometricModel,
      timeAnalysis: payload.timeAnalysis,
      severeWeatherCap: payload.severeWeatherCap,
      scoreBeforeOcclusion: payload.scoreBeforeOcclusion,
      breakdown: payload.breakdown
    };

    base.factors = {
      ...base.factors,
      canvasAnalysis: payload.canvasAnalysis,
      lightPathAnalysis: payload.lightPathAnalysis,
      renderingAnalysis: payload.renderingAnalysis,
      cloudThickness: payload.cloudThickness,
      thickHighCloudPenalty: payload.thickHighCloudPenalty,
      aerosolHazeCap: payload.aerosolHazeCap,
      highCloudCarrierAdjustment: payload.highCloudCarrierAdjustment
    };
  }

  return base;
}

router.get('/forecast', async (req, res) => {
  try {
    const { location, lat, lon, type = 'sunset', date, detail = 'full' } = req.query;

    if (!['sunrise', 'sunset'].includes(type)) {
      return errorResponse(res, 400, 'INVALID_TYPE', 'type must be "sunrise" or "sunset"');
    }

    if (detail !== 'simple' && detail !== 'full') {
      return errorResponse(res, 400, 'INVALID_DETAIL', 'detail must be "simple" or "full"');
    }

    const targetDate = parseDateParam(date);
    if (!targetDate) {
      return errorResponse(res, 400, 'INVALID_DATE', 'date must be today, tomorrow, or a valid ISO date');
    }

    let resolved = {
      lat: Number(lat),
      lon: Number(lon),
      source: 'coordinates'
    };

    if (location && typeof location === 'string' && location.trim()) {
      try {
        const provider = process.env.GEOCODING_PROVIDER || 'nominatim';
        const geocoder = new BackendGeocodingService({ provider });
        const geocodeResult = await geocoder.geocode(location.trim());

        if (!geocodeResult || !Number.isFinite(Number(geocodeResult.lat)) || !Number.isFinite(Number(geocodeResult.lon))) {
          return errorResponse(res, 400, 'INVALID_LOCATION', 'Unable to resolve location');
        }

        resolved = {
          name: geocodeResult.name || location.trim(),
          lat: Number(geocodeResult.lat),
          lon: Number(geocodeResult.lon),
          source: `geocoding:${provider}`,
          provider: geocodeResult.provider || provider
        };
      } catch (geoError) {
        return errorResponse(res, 502, 'GEOCODING_ERROR', geoError.message || 'Failed to resolve location');
      }
    } else if (Number.isNaN(resolved.lat) || Number.isNaN(resolved.lon)) {
      return errorResponse(res, 400, 'INVALID_PARAMS', 'Either location or lat/lon is required');
    }

    if (resolved.lat < -90 || resolved.lat > 90 || resolved.lon < -180 || resolved.lon > 180) {
      return errorResponse(res, 400, 'INVALID_COORDINATES', 'lat must be between -90 and 90, lon between -180 and 180');
    }

    let weatherResponse;
    try {
      weatherResponse = await orchestrator.fetchWeatherData(resolved.lat, resolved.lon, 24);
    } catch (weatherError) {
      return errorResponse(res, 503, 'WEATHER_FORECAST_ERROR', weatherError.message || 'Failed to fetch weather data', {
        providerErrorCode: weatherError.code || 'WEATHER_FETCH_FAILED'
      });
    }

    const targetTimezone = weatherResponse?.providerMeta?.timezone || null;
    const timezoneOptions = { timezone: targetTimezone };
    const referenceTime = type === 'sunrise'
      ? SunCalculator.getSunriseTime(targetDate, resolved.lat, resolved.lon, timezoneOptions)
      : SunCalculator.getSunsetTime(targetDate, resolved.lat, resolved.lon, timezoneOptions);
    const bestWindow = SunCalculator.getGoldenHour(referenceTime, type);

    const hourly = Array.isArray(weatherResponse?.data) ? weatherResponse.data : [];
    const referenceTs = referenceTime.getTime();
    const selectedWeatherRaw = pickClosestWeather(hourly, referenceTs);

    if (!selectedWeatherRaw) {
      return errorResponse(res, 502, 'NO_WEATHER_DATA', 'No weather data available for forecast calculation');
    }

    const weatherData = normalizeWeatherForPrediction(selectedWeatherRaw, weatherResponse?.providerMeta || {});

    let prediction;
    try {
      prediction = EnhancedPredictionService.calculateEnhancedPrediction(
        weatherData,
        referenceTime,
        resolved.lat,
        resolved.lon,
        type
      );
    } catch (predictError) {
      return errorResponse(res, 502, 'PREDICTION_ERROR', predictError.message || 'Failed to generate forecast');
    }

    const warnings = [];
    if (prediction.severeWeatherCap?.reason) {
      warnings.push(prediction.severeWeatherCap.reason);
    }
    if (prediction.cloudThickness?.thickness) {
      warnings.push(`cloud_thickness:${prediction.cloudThickness.thickness}`);
    }
    if (!prediction.timeAnalysis?.inWindow) {
      warnings.push('outside_optimal_window');
    }

    const payload = {
      location: {
        name: resolved.name || null,
        lat: resolved.lat,
        lon: resolved.lon,
        source: resolved.source
      },
      score: prediction.score,
      quality: prediction.quality,
      bestViewingWindow: {
        referenceTime: referenceTime.toISOString(),
        start: bestWindow.start.toISOString(),
        end: bestWindow.end.toISOString(),
        type
      },
      summary: {
        quality: prediction.quality,
        status: prediction.status,
        score: prediction.score,
        description: prediction.description,
        advice: prediction.advice
      },
      explanation: {
        details: detail === 'full' ? prediction.description : null,
        status: prediction.status,
        description: prediction.description,
        advice: prediction.advice
      },
      factors: {
        quality: prediction.quality,
        score: prediction.score,
        weatherSamplesUsed: [
          weatherData.cloudCover,
          weatherData.humidity,
          weatherData.visibility
        ]
      },
      warnings,
      status: prediction.status,
      description: prediction.description,
      advice: prediction.advice,
      meta: {
        requested: {
          query: {
            location: location || null,
            lat: Number.isFinite(Number(lat)) ? Number(lat) : null,
            lon: Number.isFinite(Number(lon)) ? Number(lon) : null,
            type,
            date: targetDate.toISOString().slice(0, 10),
            detail
          },
          requestedAt: new Date().toISOString()
        },
        forecastDate: targetDate.toISOString(),
        timezone: targetTimezone,
        providerMeta: weatherResponse?.providerMeta || null,
        providerName: weatherResponse?.providerMeta?.name || null,
        source: resolved.source,
        hasLocationInput: Boolean(location)
      },
      canvasAnalysis: prediction.canvasAnalysis,
      lightPathAnalysis: prediction.lightPathAnalysis,
      renderingAnalysis: prediction.renderingAnalysis,
      cloudThickness: prediction.cloudThickness,
      thickHighCloudPenalty: prediction.thickHighCloudPenalty,
      aerosolHazeCap: prediction.aerosolHazeCap,
      highCloudCarrierAdjustment: prediction.highCloudCarrierAdjustment,
      timeAnalysis: prediction.timeAnalysis,
      geometricModel: prediction.geometricModel,
      severeWeatherCap: prediction.severeWeatherCap,
      scoreBeforeOcclusion: prediction.scoreBeforeOcclusion,
      breakdown: prediction.breakdown
    };

    const data = buildResponse(detail, payload);

    return res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('[AgentForecastRoute] Unhandled error:', error);
    return errorResponse(res, 500, 'INTERNAL_ERROR', error.message || '服务器内部错误');
  }
});

module.exports = router;
