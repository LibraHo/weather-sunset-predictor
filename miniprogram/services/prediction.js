import { request } from './api.js';

function numberOrNull(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function pick(source, keys) {
  for (const key of keys) {
    if (source && source[key] !== undefined && source[key] !== null) return source[key];
  }
  return null;
}

export function normalizePrediction(data = {}) {
  const source = data?.data && !data.score ? data.data : data;
  const weather = source.weatherData || source.weather || {};
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
      high: numberOrNull(pick(clouds, ['high', 'highClouds']) ?? weather.highClouds),
      mid: numberOrNull(pick(clouds, ['mid', 'midClouds']) ?? weather.midClouds),
      low: numberOrNull(pick(clouds, ['low', 'lowClouds', 'lowCloudCover']) ?? weather.lowClouds ?? weather.lowCloudCover)
    },
    visibility: numberOrNull(source.visibility ?? weather.visibility),
    humidity: numberOrNull(source.humidity ?? weather.humidity),
    aod: numberOrNull(source.aod ?? source.aerosolOpticalDepth ?? weather.aod ?? weather.aerosolOpticalDepth ?? weather.aqi),
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

export async function getEnhancedPrediction({ lat, lon, type = 'sunset', date } = {}) {
  const response = await request('/api/prediction/enhanced', {
    method: 'POST',
    data: { lat, lon, type, date, referenceTime: date }
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
      const score = numberOrNull(point.score ?? prediction.score);
      return {
        key: point.direction || point.label || point.name,
        direction: point.direction || point.label || '',
        name: point.name || point.label || point.direction || '',
        angle: numberOrNull(point.angle),
        score,
        level: scoreToLevel(score),
        quality: point.quality || prediction.quality || prediction.status || null,
        highCloud: numberOrNull(cloudLayers.high ?? point.weatherData?.highClouds),
        midCloud: numberOrNull(cloudLayers.mid ?? point.weatherData?.midClouds),
        lowCloud: numberOrNull(cloudLayers.low ?? point.weatherData?.lowClouds),
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
