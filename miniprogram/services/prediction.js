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
    date: source.date || source.referenceTime || null,
    description: source.description || '',
    advice: source.advice || '',
    breakdown: source.breakdown || null,
    canvasAnalysis: source.canvasAnalysis || null,
    lightPathAnalysis: source.lightPathAnalysis || null,
    renderingAnalysis: source.renderingAnalysis || null,
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
  const rows = await Promise.all(days.map(async (day) => {
    const [sunrise, sunset] = await Promise.all([
      getEnhancedPrediction({ lat, lon, type: 'sunrise', date: day.date }),
      getEnhancedPrediction({ lat, lon, type: 'sunset', date: day.date })
    ]);
    return {
      ...day,
      sunrise: compactPrediction(sunrise, 'sunrise'),
      sunset: compactPrediction(sunset, 'sunset')
    };
  }));
  return rows;
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
  getEnhancedPrediction,
  getSurroundingPrediction,
  getThreeDayGlow,
  normalizePrediction,
  normalizeSurroundingPrediction,
  buildThreeDayDates,
  scoreToLevel
};
