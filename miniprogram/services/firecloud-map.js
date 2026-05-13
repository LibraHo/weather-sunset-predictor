import { request } from './api.js';
import { scoreToLevel } from './prediction.js';

export const FIRECLOUD_LEGENDS = {
  sunset: [
    { key: 'below', label: '<40', color: '#f8d7a5' },
    { key: 'low', label: '40', color: '#ffc069' },
    { key: 'mid', label: '50', color: '#ffa94d' },
    { key: 'high', label: '60', color: '#ff9a3d' },
    { key: 'peak', label: '70+', color: '#ff8a2a' }
  ],
  sunrise: [
    { key: 'below', label: '<30', color: '#f7c6d0' },
    { key: 'low', label: '30', color: '#ffadc2' },
    { key: 'mid', label: '40', color: '#ff94ad' },
    { key: 'high', label: '55', color: '#ff7c99' },
    { key: 'peak', label: '70+', color: '#ff6b8a' }
  ]
};

export async function getChinaFirecloudSpots({ period = 'sunset' } = {}) {
  const response = await request('/api/spots/china', {
    method: 'GET',
    query: { period }
  });
  return normalizeChinaFirecloudSpots(response?.data || response);
}

export function getFirecloudLegend(period = 'sunset') {
  return (FIRECLOUD_LEGENDS[period] || FIRECLOUD_LEGENDS.sunset).map((item) => ({ ...item }));
}

export function normalizeChinaFirecloudSpots(data = {}) {
  const spots = Array.isArray(data.spots) ? data.spots : [];
  return {
    period: data.period || 'sunset',
    date: data.date || '',
    updatedAt: data.updatedAt || data.sourceUpdatedAt || '',
    spots: spots
      .map((spot, index) => normalizeSpot(spot, index))
      .filter((spot) => spot.hasLocation)
  };
}

function normalizeSpot(spot = {}, index = 0) {
  const lat = numberOrNull(spot.lat ?? spot.latitude);
  const lon = numberOrNull(spot.lon ?? spot.lng ?? spot.longitude);
  const score = numberOrNull(spot.score);
  return {
    id: spot.id || `${lat},${lon},${index}`,
    markerId: index + 1,
    lat,
    lon,
    hasLocation: lat !== null && lon !== null,
    score,
    scoreText: score !== null ? String(Math.round(score)) : '--',
    level: scoreToLevel(score),
    quality: spot.quality || qualityFromScore(score),
    name: spot.name || spot.locationName || inferSpotName(lat, lon)
  };
}

export function buildSpotMarkers(spots = []) {
  return spots.map((spot, index) => ({
    id: spot.markerId || index + 1,
    latitude: spot.lat,
    longitude: spot.lon,
    title: `${spot.scoreText}分`,
    width: markerSize(spot.score),
    height: markerSize(spot.score),
    zIndex: spots.length - index,
    callout: {
      content: `${spot.scoreText}分`,
      color: '#ffffff',
      fontSize: 12,
      borderRadius: 10,
      bgColor: markerColor(spot.level),
      padding: 7,
      display: 'BYCLICK'
    }
  }));
}

function markerSize(score) {
  const value = Number(score);
  if (Number.isFinite(value) && value >= 85) return 34;
  if (Number.isFinite(value) && value >= 70) return 31;
  return 28;
}

function markerColor(level) {
  if (level === 'excellent') return '#f97316';
  if (level === 'good') return '#fb923c';
  if (level === 'watch') return '#0e7490';
  return '#475569';
}

function qualityFromScore(score) {
  const level = scoreToLevel(score);
  if (level === 'excellent') return '顶级';
  if (level === 'good') return '较好';
  if (level === 'watch') return '可观赏';
  return '偏弱';
}

function inferSpotName(lat, lon) {
  if (lat === null || lon === null) return '地图点位';
  return `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export default {
  getChinaFirecloudSpots,
  normalizeChinaFirecloudSpots,
  getFirecloudLegend,
  buildSpotMarkers
};
