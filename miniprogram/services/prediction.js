import { request } from './api.js';

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function pick(source, keys) {
  for (const key of keys) {
    if (source && source[key] !== undefined && source[key] !== null) return source[key];
  }
  return null;
}

const AOD_KEYS = ['aod', 'aerosolOpticalDepth', 'aerosol_optical_depth'];

function pickAod(source) {
  return numberOrNull(pick(source, AOD_KEYS));
}

function parseTimeMs(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

export function resolveAodDisplay(source = {}, options = {}) {
  const current = pickAod(source);
  if (current !== null) {
    return { value: current, approximate: false, hint: '', sourceTime: null };
  }

  const hourly = Array.isArray(source.hourly)
    ? source.hourly
    : (Array.isArray(source.weatherData?.hourly) ? source.weatherData.hourly : []);
  const candidates = hourly
    .map((item) => ({
      value: pickAod(item),
      time: item.time || item.date || item.timestamp || item.key || null
    }))
    .filter((item) => item.value !== null);
  if (!candidates.length) return { value: null, approximate: false, hint: '', sourceTime: null };

  const targetMs = parseTimeMs(options.referenceTime || source.referenceTime || source.eventTime || source.date);
  if (targetMs === null) {
    const first = candidates[0];
    return { value: first.value, approximate: true, hint: '邻近时次', sourceTime: first.time };
  }

  const nearest = candidates.reduce((best, item) => {
    const itemMs = parseTimeMs(item.time);
    if (itemMs === null) return best;
    const distance = Math.abs(itemMs - targetMs);
    return !best || distance < best.distance ? { ...item, distance } : best;
  }, null);
  const fallback = nearest || candidates[0];
  return { value: fallback.value, approximate: true, hint: '邻近时次', sourceTime: fallback.time };
}

function pickWeatherSource(source = {}) {
  const weather = source.weatherData || source.weather || source.currentWeather || source.current_weather || {};
  if (Array.isArray(weather)) return weather[0] || {};
  return weather.current || weather.currentWeather || weather.current_weather || weather;
}

function normalizeVisibility(value) {
  const num = numberOrNull(value);
  if (num === null) return null;
  return num > 1000 ? Number((num / 1000).toFixed(1)) : num;
}

function normalizeWeatherData(weather = {}, source = {}) {
  const temp = pick(weather, ['temp', 'temperature', 'temperature_2m']) ?? pick(source, ['temp', 'temperature', 'temperature_2m']);
  const humidity = pick(weather, ['humidity', 'relativeHumidity', 'relative_humidity_2m']) ?? pick(source, ['humidity', 'relativeHumidity', 'relative_humidity_2m']);
  const pressure = pick(weather, ['pressure', 'surfacePressure', 'surface_pressure']) ?? pick(source, ['pressure', 'surfacePressure', 'surface_pressure']);
  const visibility = pick(weather, ['visibility']) ?? pick(source, ['visibility']);
  const windSpeed = pick(weather, ['windSpeed', 'wind_speed_10m', 'windspeed']) ?? pick(source, ['windSpeed', 'wind_speed_10m', 'windspeed']);
  const windDirection = pick(weather, ['windDirection', 'wind_direction_10m', 'winddirection']) ?? pick(source, ['windDirection', 'wind_direction_10m', 'winddirection']);
  const precipitation = pick(weather, ['precipitation', 'precip', 'rain', 'showers']) ?? pick(source, ['precipitation', 'precip', 'rain', 'showers']);
  const aod = pick(weather, ['aod', 'aerosolOpticalDepth', 'aerosol_optical_depth', 'aqi']) ?? pick(source, ['aod', 'aerosolOpticalDepth', 'aerosol_optical_depth', 'aqi']);

  return {
    ...weather,
    temp: numberOrNull(temp),
    humidity: numberOrNull(humidity),
    pressure: numberOrNull(pressure),
    visibility: normalizeVisibility(visibility),
    aod: numberOrNull(aod),
    aerosolOpticalDepth: numberOrNull(aod),
    windSpeed: numberOrNull(windSpeed),
    windDirection,
    precipitation: numberOrNull(precipitation),
    cloudCover: numberOrNull(pick(weather, ['cloudCover', 'cloud_cover']) ?? pick(source, ['cloudCover', 'cloud_cover'])),
    highClouds: numberOrNull(pick(weather, ['highClouds', 'highCloud', 'cloud_cover_high'])),
    midClouds: numberOrNull(pick(weather, ['midClouds', 'midCloud', 'cloud_cover_mid'])),
    lowClouds: numberOrNull(pick(weather, ['lowClouds', 'lowCloud', 'lowCloudCover', 'cloud_cover_low'])),
    provider: weather.provider || source.provider || source.providerMeta?.name || null,
    providerMeta: weather.providerMeta || source.providerMeta || null,
    hourly: weather.hourly || source.hourly || [],
    daily: weather.daily || source.daily || [],
    glow: weather.glow || source.glow || []
  };
}

export function normalizePrediction(data = {}) {
  const source = data?.data && !data.score ? data.data : data;
  const weather = pickWeatherSource(source);
  const normalizedWeather = normalizeWeatherData(weather, source);
  const clouds = source.cloudLayers || source.clouds || {};
  const bestWindow = source.bestWindow || source.bestViewingWindow || source.goldenHour || source.timeAnalysis?.bestWindow || source.referenceTime || source.date || null;
  const summary = source.summary || {
    quality: source.quality || null,
    status: source.status || null,
    score: numberOrNull(source.score),
    description: source.description || '',
    advice: source.advice || ''
  };

  return {
    score: numberOrNull(source.score),
    quality: source.quality || source.status || null,
    bestWindow,
    lat: numberOrNull(source.lat ?? source.latitude ?? source.location?.lat),
    lon: numberOrNull(source.lon ?? source.lng ?? source.longitude ?? source.location?.lon),
    clouds: {
      high: numberOrNull(pick(clouds, ['high', 'highClouds', 'cloud_cover_high']) ?? normalizedWeather.highClouds),
      mid: numberOrNull(pick(clouds, ['mid', 'midClouds', 'cloud_cover_mid']) ?? normalizedWeather.midClouds),
      low: numberOrNull(pick(clouds, ['low', 'lowClouds', 'lowCloudCover', 'cloud_cover_low']) ?? normalizedWeather.lowClouds)
    },
    visibility: normalizedWeather.visibility,
    humidity: normalizedWeather.humidity,
    aod: normalizedWeather.aod,
    weatherData: normalizedWeather,
    type: source.type || null,
    referenceTime: source.referenceTime || null,
    date: source.date || source.referenceTime || null,
    description: source.description || '',
    advice: source.advice || '',
    breakdown: source.breakdown || null,
    scoringV2: source.scoringV2 || source.breakdown?.scoringV2 || null,
    canvasAnalysis: source.canvasAnalysis || null,
    lightPathAnalysis: source.lightPathAnalysis || null,
    renderingAnalysis: source.renderingAnalysis || null,
    layerBrightness: source.layerBrightness || source.breakdown?.layerBrightness || null,
    layerBrightnessAdjustment: source.layerBrightnessAdjustment || source.breakdown?.layerBrightnessAdjustment || null,
    cloudThickness: source.cloudThickness || null,
    thickHighCloudPenalty: source.thickHighCloudPenalty || null,
    aerosolHazeCap: source.aerosolHazeCap || null,
    highCloudCarrierAdjustment: source.highCloudCarrierAdjustment || null,
    postRainAdjustment: source.postRainAdjustment || null,
    severeWeatherCap: source.severeWeatherCap || null,
    occlusionAnalysis: source.occlusionAnalysis || null,
    geometricModel: source.geometricModel || null,
    algorithm: source.algorithm || null,
    cloudType: source.cloudType || null,
    clearSunsetAdvice: source.clearSunsetAdvice || null,
    summary,
    explanation: typeof summary === 'string' ? summary : (summary.description || source.description || source.advice || '')
  };
}

export async function getEnhancedPrediction({ lat, lon, type = 'sunset', date, referenceTime } = {}) {
  const data = { lat, lon, type, date };
  if (referenceTime) data.referenceTime = referenceTime;

  const response = await request('/api/prediction/enhanced', {
    method: 'POST',
    timeout: 20000,
    data
  });
  return normalizePrediction(response?.data || response);
}

export async function getEnhancedPredictionBatch({ lat, lon, items = [], includeRemoteCloudData = true } = {}) {
  const response = await request('/api/prediction/enhanced/closed-loop/batch', {
    method: 'POST',
    timeout: 30000,
    data: {
      lat,
      lon,
      options: { includeRemoteCloudData },
      items
    }
  });
  const rows = Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : []);
  return rows.map((item, index) => normalizePrediction({
    ...item,
    type: item.type || items[index]?.type || null,
    date: item.date || items[index]?.date || item.referenceTime || null
  }));
}

export async function getWeatherForecast({ lat, lon, hours = 168 } = {}) {
  const response = await request('/api/weather/forecast', {
    method: 'GET',
    params: { lat, lon, hours },
    timeout: 12000
  });
  return normalizeWeatherForecast(response?.data ? response : (response || {}));
}

export async function getSiteState() {
  const response = await request('/api/config/site-state', {
    method: 'GET',
    timeout: 8000
  });
  const source = response?.data || response || {};
  return {
    siteClosed: source.siteClosed === true,
    weatherPredictionClosed: source.weatherPredictionClosed === true,
    shareMapAvailable: source.shareMapAvailable !== false,
    firecloudMapAvailable: source.firecloudMapAvailable !== false
  };
}

export function normalizeWeatherForecast(response = {}) {
  const data = Array.isArray(response.data) ? response.data : [];
  const current = response.current || data[0] || {};
  const providerMeta = response.providerMeta || current.providerMeta || null;
  const weather = normalizeWeatherData(current, {
    providerMeta,
    provider: providerMeta?.name,
    hourly: data,
    daily: response.daily || [],
    glow: response.glow || []
  });
  return {
    ...weather,
    location: response.location || null,
    providerMeta,
    provider: weather.provider || providerMeta?.name || 'Open-Meteo',
    hourly: data,
    daily: response.daily || [],
    glow: response.glow || []
  };
}

export async function getHomeGateway({
  lat,
  lon,
  date,
  period = 'sunset',
  days = 3,
  includeRemoteCloudData = true
} = {}) {
  const response = await request('/api/prediction/home', {
    method: 'GET',
    params: {
      lat,
      lon,
      date,
      period,
      days,
      includeRemoteCloudData: includeRemoteCloudData ? 'true' : 'false'
    },
    timeout: 30000
  });
  const source = response?.data || response || {};
  const weatherSource = source.weather || {};
  const weather = normalizeWeatherForecast({
    current: weatherSource.current,
    data: weatherSource.hourly || weatherSource.data || [],
    daily: weatherSource.daily || [],
    providerMeta: weatherSource.providerMeta || null
  });
  const sunrise = source.predictions?.sunrise ? normalizePrediction(source.predictions.sunrise) : null;
  const sunset = source.predictions?.sunset ? normalizePrediction(source.predictions.sunset) : null;
  const current = source.predictions?.current ? normalizePrediction(source.predictions.current) : (period === 'sunrise' ? sunrise : sunset);

  return {
    ...source,
    weather,
    predictions: {
      ...(source.predictions || {}),
      current,
      sunrise,
      sunset
    },
    predictionCards: {
      ...(sunrise ? { sunrise } : {}),
      ...(sunset ? { sunset } : {})
    },
    threeDayGlow: Array.isArray(source.predictions?.byDate)
      ? source.predictions.byDate.map((day) => ({
          date: day.date,
          sunrise: day.sunrise ? compactPrediction(normalizePrediction(day.sunrise), 'sunrise') : null,
          sunset: day.sunset ? compactPrediction(normalizePrediction(day.sunset), 'sunset') : null
        }))
      : []
  };
}

export function normalizeSurroundingPrediction(data = {}) {
  const source = data?.data || data;
  const points = Array.isArray(source.points)
    ? source.points
    : (Array.isArray(source.directions) ? source.directions : []);

  return {
    center: source.center || null,
    radius: source.radius || null,
    type: source.type || null,
    date: source.date || null,
    bestDirection: source.bestDirection || null,
    points: points.map((point) => {
      const prediction = point.prediction || {};
      const cloudLayers = point.cloudLayers || prediction.cloudLayers || {};
      const weather = point.weatherData || point.weather || prediction.weatherData || prediction.weather || {};
      const score = numberOrNull(point.score ?? prediction.score);
      return {
        key: point.direction || point.label || point.name,
        direction: point.direction || point.label || '',
        name: point.name || point.label || point.direction || '',
        angle: numberOrNull(point.angle),
        score,
        level: scoreToLevel(score),
        quality: point.quality || prediction.quality || prediction.status || null,
        highCloud: numberOrNull(cloudLayers.high ?? cloudLayers.highClouds ?? point.highCloud ?? point.highClouds ?? prediction.highCloud ?? prediction.highClouds ?? weather.highCloud ?? weather.highClouds),
        midCloud: numberOrNull(cloudLayers.mid ?? cloudLayers.midClouds ?? point.midCloud ?? point.midClouds ?? prediction.midCloud ?? prediction.midClouds ?? weather.midCloud ?? weather.midClouds),
        lowCloud: numberOrNull(cloudLayers.low ?? cloudLayers.lowClouds ?? cloudLayers.lowCloudCover ?? point.lowCloud ?? point.lowClouds ?? point.lowCloudCover ?? prediction.lowCloud ?? prediction.lowClouds ?? prediction.lowCloudCover ?? weather.lowCloud ?? weather.lowClouds ?? weather.lowCloudCover),
        error: point.error || null
      };
    })
  };
}

export async function getSurroundingPrediction({ lat, lon, type = 'sunset', date, radius = 100 } = {}) {
  const response = await request('/api/prediction/surrounding', {
    method: 'POST',
    data: { lat, lon, type, date, radius }
  });
  return normalizeSurroundingPrediction(response?.data || response);
}

export async function getThreeDayGlow({ lat, lon } = {}) {
  const days = buildThreeDayDates();
  const items = days.flatMap((day) => [
    { id: `${day.key}:sunrise`, type: 'sunrise', date: day.date },
    { id: `${day.key}:sunset`, type: 'sunset', date: day.date }
  ]);
  const predictions = await getEnhancedPredictionBatch({ lat, lon, items, includeRemoteCloudData: true });
  const byKey = new Map();
  predictions.forEach((prediction, index) => {
    const item = items[index] || {};
    byKey.set(item.id, prediction);
  });

  return days.map((day) => {
    const sunrise = byKey.get(`${day.key}:sunrise`) || {};
    const sunset = byKey.get(`${day.key}:sunset`) || {};
    return {
      ...day,
      sunrise: compactPrediction(sunrise, 'sunrise'),
      sunset: compactPrediction(sunset, 'sunset')
    };
  });
}

export function buildThreeDayDates(baseDate = new Date()) {
  return Array.from({ length: 3 }, (_, index) => {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + index);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return {
      key: `${yyyy}-${mm}-${dd}`,
      date: `${yyyy}-${mm}-${dd}`,
      label: index === 0 ? '今天' : (index === 1 ? '明天' : '后天')
    };
  });
}

function compactPrediction(prediction = {}, type) {
  const score = numberOrNull(prediction.score);
  return {
    type,
    score,
    level: scoreToLevel(score),
    quality: prediction.quality || null,
    bestWindow: prediction.bestWindow || null
  };
}

export function scoreToLevel(score) {
  const value = numberOrNull(score);
  if (value === null) return 'unknown';
  if (value >= 85) return 'excellent';
  if (value >= 70) return 'good';
  if (value >= 40) return 'watch';
  return 'weak';
}

export default {
  getHomeGateway,
  getEnhancedPrediction,
  getEnhancedPredictionBatch,
  getWeatherForecast,
  getSurroundingPrediction,
  getThreeDayGlow,
  normalizeWeatherForecast,
  normalizePrediction,
  normalizeSurroundingPrediction,
  buildThreeDayDates,
  scoreToLevel
};
