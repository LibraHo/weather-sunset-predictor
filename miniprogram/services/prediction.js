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
    clouds: {
      high: numberOrNull(pick(clouds, ['high', 'highClouds']) ?? weather.highClouds),
      mid: numberOrNull(pick(clouds, ['mid', 'midClouds']) ?? weather.midClouds),
      low: numberOrNull(pick(clouds, ['low', 'lowClouds', 'lowCloudCover']) ?? weather.lowClouds ?? weather.lowCloudCover)
    },
    visibility: numberOrNull(source.visibility ?? weather.visibility),
    humidity: numberOrNull(source.humidity ?? weather.humidity),
    aod: numberOrNull(source.aod ?? source.aerosolOpticalDepth ?? weather.aod ?? weather.aerosolOpticalDepth ?? weather.aqi),
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

export default { getEnhancedPrediction, normalizePrediction };
