import { getApiConfig, request } from './api.js';

export const FIRECLOUD_LEGENDS = {
  sunset: [
    { key: 'below', score: 0, label: '<40', color: 'rgba(255,255,255,0.08)', markerColor: '#475569' },
    { key: 'low', score: 40, label: '40', color: 'rgba(255,230,210,0.14)', markerColor: '#f8d7a5' },
    { key: 'mid', score: 50, label: '50', color: 'rgba(255,185,150,0.22)', markerColor: '#ffc069' },
    { key: 'high', score: 60, label: '60', color: 'rgba(248,132,54,0.36)', markerColor: '#ff9a3d' },
    { key: 'peak', score: 70, label: '70+', color: 'rgba(218,78,28,0.55)', markerColor: '#ff8a2a' }
  ],
  sunrise: [
    { key: 'below', score: 0, label: '<40', color: 'rgba(255,255,255,0.08)', markerColor: '#475569' },
    { key: 'low', score: 40, label: '40', color: 'rgba(255,230,210,0.18)', markerColor: '#f7c6d0' },
    { key: 'mid', score: 50, label: '50', color: 'rgba(255,185,150,0.30)', markerColor: '#ffadc2' },
    { key: 'high', score: 60, label: '60', color: 'rgba(248,132,82,0.46)', markerColor: '#ff7c99' },
    { key: 'peak', score: 70, label: '70+', color: 'rgba(218,78,28,0.65)', markerColor: '#ff6b8a' }
  ]
};

const TEST_FIRECLOUD_SPOTS = [
  { name: '北京', lat: 39.9042, lon: 116.4074, score: 72 },
  { name: '上海', lat: 31.2304, lon: 121.4737, score: 66 },
  { name: '广州', lat: 23.1291, lon: 113.2644, score: 58 },
  { name: '成都', lat: 30.5728, lon: 104.0668, score: 54 },
  { name: '札幌', lat: 43.0618, lon: 141.3545, score: 69 },
  { name: '东京', lat: 35.6762, lon: 139.6503, score: 63 },
  { name: '大阪', lat: 34.6937, lon: 135.5023, score: 52 },
  { name: '首尔', lat: 37.5665, lon: 126.9780, score: 61 },
  { name: '釜山', lat: 35.1796, lon: 129.0756, score: 49 }
];

const FIRECLOUD_RASTER_BBOX = { west: 72, east: 146, south: 18, north: 53 };
const FIRECLOUD_RASTER_NO_DATA = -1;
const FIRECLOUD_RASTER_VISUAL_MIN = 40;
const FIRECLOUD_RASTER_FULL = 70;
const FIRECLOUD_RASTER_BANDS = [40, 45, 50, 55, 60, 65, 70];
const FIRECLOUD_RASTER_PALETTES = {
  sunset: [
    { t: 0.00, r: 255, g: 236, b: 212, a: 0.05 },
    { t: 0.12, r: 255, g: 218, b: 176, a: 0.10 },
    { t: 0.28, r: 255, g: 194, b: 132, a: 0.18 },
    { t: 0.46, r: 255, g: 166, b: 92, a: 0.26 },
    { t: 0.64, r: 248, g: 132, b: 54, a: 0.35 },
    { t: 0.82, r: 235, g: 100, b: 38, a: 0.44 },
    { t: 1.00, r: 218, g: 78, b: 28, a: 0.55 }
  ],
  sunrise: [
    { t: 0.00, r: 255, g: 236, b: 214, a: 0.06 },
    { t: 0.12, r: 255, g: 220, b: 184, a: 0.12 },
    { t: 0.28, r: 255, g: 196, b: 150, a: 0.22 },
    { t: 0.46, r: 255, g: 166, b: 112, a: 0.32 },
    { t: 0.64, r: 248, g: 132, b: 82, a: 0.42 },
    { t: 0.82, r: 236, g: 104, b: 62, a: 0.54 },
    { t: 1.00, r: 222, g: 84, b: 46, a: 0.65 }
  ]
};

export async function getChinaFirecloudSpots({ period = 'sunset' } = {}) {
  try {
    const response = await request('/api/spots/china', {
      method: 'GET',
      query: { period }
    });
    const normalized = normalizeChinaFirecloudSpots(response?.data || response, { period });
    return normalized.spots.length ? normalized : buildTestFirecloudSpotData(period, 'empty-response');
  } catch (error) {
    return buildTestFirecloudSpotData(period, 'request-failed');
  }
}

export async function getChinaFirecloudRaster({ period = 'sunset', resolution = 0.25 } = {}) {
  try {
    const response = await request('/api/spots/china/raster', {
      method: 'GET',
      query: { period, resolution }
    });
    const normalized = normalizeChinaFirecloudRaster(response?.data || response, { period, resolution });
    return normalized.validCellCount ? normalized : buildTestFirecloudRaster(period, 'empty-raster', { resolution });
  } catch (error) {
    return buildTestFirecloudRaster(period, 'request-failed', { resolution });
  }
}

export function buildRasterGroundOverlay(raster = {}, { period = 'sunset', resolution = 0.25, opacity = 0.92 } = {}) {
  const bbox = normalizeRasterBbox(raster.bbox) || { ...FIRECLOUD_RASTER_BBOX };
  return {
    id: 1,
    src: buildRasterOverlayImageUrl({ period: raster.period || period, resolution }),
    bounds: {
      southwest: { latitude: bbox.south, longitude: bbox.west },
      northeast: { latitude: bbox.north, longitude: bbox.east }
    },
    opacity,
    visible: true,
    zIndex: 1
  };
}

export function buildRasterOverlayImageUrl({ period = 'sunset', resolution = 0.25 } = {}) {
  const { baseUrl } = getApiConfig();
  const query = `period=${encodeURIComponent(period)}&resolution=${encodeURIComponent(resolution)}&v=${Date.now()}`;
  return joinUrl(baseUrl, `/api/spots/china/raster-overlay.png?${query}`);
}

export function getFirecloudLegend(period = 'sunset') {
  return (FIRECLOUD_LEGENDS[period] || FIRECLOUD_LEGENDS.sunset).map((item) => ({ ...item }));
}

export function normalizeChinaFirecloudSpots(data = {}, options = {}) {
  const period = data.period || options.period || 'sunset';
  const spots = Array.isArray(data.spots) ? data.spots : [];
  return {
    period,
    date: data.date || '',
    updatedAt: data.updatedAt || data.sourceUpdatedAt || '',
    isFallback: Boolean(data.isFallback),
    fallbackReason: data.fallbackReason || '',
    spots: spots
      .map((spot, index) => normalizeSpot(spot, index, period))
      .filter((spot) => spot.hasLocation)
  };
}

export function normalizeChinaFirecloudRaster(data = {}, options = {}) {
  const period = data.period || options.period || 'sunset';
  const resolution = numberOrNull(data.resolution) || numberOrNull(options.resolution) || 1;
  const bbox = normalizeRasterBbox(data.bbox) || { ...FIRECLOUD_RASTER_BBOX };
  const width = Math.max(0, Math.floor(Number(data.width) || Math.ceil((bbox.east - bbox.west) / resolution)));
  const height = Math.max(0, Math.floor(Number(data.height) || Math.ceil((bbox.north - bbox.south) / resolution)));
  const noData = numberOrNull(data.noData) ?? FIRECLOUD_RASTER_NO_DATA;
  const values = Array.isArray(data.values) ? data.values.map((value) => numberOrNull(value) ?? noData) : [];
  const expectedLength = width * height;
  const normalizedValues = expectedLength && values.length >= expectedLength ? values.slice(0, expectedLength) : values;
  return {
    period,
    date: data.date || '',
    updatedAt: data.updatedAt || data.sourceUpdatedAt || '',
    generatedAt: data.generatedAt || '',
    isFallback: Boolean(data.isFallback),
    fallbackReason: data.fallbackReason || '',
    bbox,
    resolution,
    width,
    height,
    noData,
    values: normalizedValues,
    validCellCount: countVisibleRasterCells(normalizedValues, noData)
  };
}

export function buildTestFirecloudSpotData(period = 'sunset', reason = 'manual-test') {
  const adjusted = TEST_FIRECLOUD_SPOTS.map((spot, index) => ({
    ...spot,
    score: period === 'sunrise' ? Math.max(40, spot.score - (index % 3) * 4) : spot.score
  }));
  return normalizeChinaFirecloudSpots({
    period,
    updatedAt: new Date().toISOString(),
    isFallback: true,
    fallbackReason: reason,
    spots: adjusted
  }, { period });
}

export function buildTestFirecloudRaster(period = 'sunset', reason = 'manual-test', options = {}) {
  const source = buildTestFirecloudSpotData(period, reason).spots;
  const resolution = numberOrNull(options.resolution) || 1;
  const bbox = { ...FIRECLOUD_RASTER_BBOX };
  const width = Math.ceil((bbox.east - bbox.west) / resolution);
  const height = Math.ceil((bbox.north - bbox.south) / resolution);
  const values = [];
  for (let row = 0; row < height; row += 1) {
    const lat = bbox.north - (row + 0.5) * resolution;
    for (let col = 0; col < width; col += 1) {
      const lon = bbox.west + (col + 0.5) * resolution;
      const score = interpolateScore(source, lat, lon);
      values.push(score >= FIRECLOUD_RASTER_VISUAL_MIN ? Math.round(score * 10) / 10 : FIRECLOUD_RASTER_NO_DATA);
    }
  }
  return normalizeChinaFirecloudRaster({
    period,
    updatedAt: new Date().toISOString(),
    generatedAt: new Date().toISOString(),
    isFallback: true,
    fallbackReason: reason,
    bbox,
    resolution,
    width,
    height,
    noData: FIRECLOUD_RASTER_NO_DATA,
    values
  }, { period, resolution });
}

export function buildSpotMarkers(spots = [], period = 'sunset') {
  return spots.map((spot, index) => ({
    id: spot.markerId || index + 1,
    latitude: spot.lat,
    longitude: spot.lon,
    title: `${spot.scoreText}分`,
    callout: {
      content: `${spot.scoreText}分`,
      color: '#ffffff',
      fontSize: 12,
      borderRadius: 10,
      bgColor: scoreToFirecloudMarkerColor(spot.score, period),
      padding: 7,
      display: 'BYCLICK'
    }
  }));
}

export function buildRasterPolygons(raster = {}, period = 'sunset') {
  const { bbox, width, height, values = [], noData = FIRECLOUD_RASTER_NO_DATA } = raster;
  if (!bbox || !width || !height || !Array.isArray(values)) return [];
  const latStep = (bbox.north - bbox.south) / height;
  const lonStep = (bbox.east - bbox.west) / width;
  const polygons = [];

  for (let row = 0; row < height; row += 1) {
    const north = bbox.north - row * latStep;
    const south = north - latStep;
    for (let col = 0; col < width; col += 1) {
      const score = Number(values[row * width + col]);
      if (!Number.isFinite(score) || score === noData || score < FIRECLOUD_RASTER_VISUAL_MIN) continue;
      const west = bbox.west + col * lonStep;
      const east = west + lonStep;
      polygons.push({
        id: row * width + col + 1,
        points: [
          { latitude: north, longitude: west },
          { latitude: north, longitude: east },
          { latitude: south, longitude: east },
          { latitude: south, longitude: west }
        ],
        fillColor: scoreToRasterLayerHexColor(score, period),
        strokeColor: '#00000000',
        strokeWidth: 0,
        zIndex: Math.max(1, Math.round(score))
      });
    }
  }

  return polygons;
}

function normalizeSpot(spot = {}, index = 0, period = 'sunset') {
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
    level: scoreToMapLevel(score),
    color: scoreToFirecloudColor(score, period),
    quality: spot.quality || qualityFromScore(score),
    name: spot.name || spot.locationName || inferSpotName(lat, lon)
  };
}

export function scoreToMapLevel(score) {
  const value = numberOrNull(score);
  if (value === null) return 'unknown';
  if (value >= 70) return 'peak';
  if (value >= 60) return 'high';
  if (value >= 50) return 'mid';
  if (value >= 40) return 'low';
  return 'below';
}

export function scoreToFirecloudColor(score, period = 'sunset') {
  const level = scoreToMapLevel(score);
  const item = getFirecloudLegend(period).find((legend) => legend.key === level);
  return item?.color || FIRECLOUD_LEGENDS.sunset[0].color;
}

export function scoreToFirecloudMarkerColor(score, period = 'sunset') {
  const level = scoreToMapLevel(score);
  const item = getFirecloudLegend(period).find((legend) => legend.key === level);
  return item?.markerColor || FIRECLOUD_LEGENDS.sunset[0].markerColor;
}

export function scoreToRasterLayerColor(score, period = 'sunset') {
  const value = numberOrNull(score);
  if (value === null || value < FIRECLOUD_RASTER_VISUAL_MIN) return 'rgba(0,0,0,0)';
  const palette = FIRECLOUD_RASTER_PALETTES[period] || FIRECLOUD_RASTER_PALETTES.sunset;
  const clamped = clamp(value, FIRECLOUD_RASTER_VISUAL_MIN, FIRECLOUD_RASTER_FULL);
  let bandIndex = 0;
  while (bandIndex < FIRECLOUD_RASTER_BANDS.length - 1 && clamped >= FIRECLOUD_RASTER_BANDS[bandIndex + 1]) {
    bandIndex += 1;
  }
  const bandLo = FIRECLOUD_RASTER_BANDS[bandIndex];
  const bandHi = FIRECLOUD_RASTER_BANDS[Math.min(bandIndex + 1, FIRECLOUD_RASTER_BANDS.length - 1)];
  const localT = bandHi === bandLo ? 1 : smoothstep01((clamped - bandLo) / (bandHi - bandLo));
  const globalLoT = (bandLo - FIRECLOUD_RASTER_VISUAL_MIN) / (FIRECLOUD_RASTER_FULL - FIRECLOUD_RASTER_VISUAL_MIN);
  const globalHiT = (bandHi - FIRECLOUD_RASTER_VISUAL_MIN) / (FIRECLOUD_RASTER_FULL - FIRECLOUD_RASTER_VISUAL_MIN);
  const color = samplePalette(lerp(globalLoT, globalHiT, localT), palette);
  return `rgba(${color.r},${color.g},${color.b},${roundAlpha(color.a)})`;
}

export function scoreToRasterLayerHexColor(score, period = 'sunset') {
  const value = numberOrNull(score);
  if (value === null || value < FIRECLOUD_RASTER_VISUAL_MIN) return '#00000000';
  const palette = FIRECLOUD_RASTER_PALETTES[period] || FIRECLOUD_RASTER_PALETTES.sunset;
  const clamped = clamp(value, FIRECLOUD_RASTER_VISUAL_MIN, FIRECLOUD_RASTER_FULL);
  let bandIndex = 0;
  while (bandIndex < FIRECLOUD_RASTER_BANDS.length - 1 && clamped >= FIRECLOUD_RASTER_BANDS[bandIndex + 1]) {
    bandIndex += 1;
  }
  const bandLo = FIRECLOUD_RASTER_BANDS[bandIndex];
  const bandHi = FIRECLOUD_RASTER_BANDS[Math.min(bandIndex + 1, FIRECLOUD_RASTER_BANDS.length - 1)];
  const localT = bandHi === bandLo ? 1 : smoothstep01((clamped - bandLo) / (bandHi - bandLo));
  const denominator = FIRECLOUD_RASTER_FULL - FIRECLOUD_RASTER_VISUAL_MIN || 1;
  const globalLoT = (bandLo - FIRECLOUD_RASTER_VISUAL_MIN) / denominator;
  const globalHiT = (bandHi - FIRECLOUD_RASTER_VISUAL_MIN) / denominator;
  const color = samplePalette(lerp(globalLoT, globalHiT, localT), palette);
  return rgbaToHexColor(color);
}

function qualityFromScore(score) {
  const level = scoreToMapLevel(score);
  if (level === 'peak') return '顶级';
  if (level === 'high') return '较好';
  if (level === 'mid' || level === 'low') return '可观赏';
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

function normalizeRasterBbox(bbox = {}) {
  const west = numberOrNull(bbox.west);
  const east = numberOrNull(bbox.east);
  const south = numberOrNull(bbox.south);
  const north = numberOrNull(bbox.north);
  if ([west, east, south, north].some((value) => value === null)) return null;
  if (east <= west || north <= south) return null;
  return { west, east, south, north };
}

function joinUrl(baseUrl = '', path = '') {
  if (/^https?:\/\//i.test(path)) return path;
  const base = String(baseUrl || '').replace(/\/$/, '');
  const suffix = String(path || '').startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

function countVisibleRasterCells(values = [], noData = FIRECLOUD_RASTER_NO_DATA) {
  return values.reduce((count, value) => (
    Number.isFinite(value) && value !== noData && value >= FIRECLOUD_RASTER_VISUAL_MIN ? count + 1 : count
  ), 0);
}

function interpolateScore(spots, lat, lon) {
  let numerator = 0;
  let denominator = 0;
  for (const spot of spots) {
    const distance = Math.max(0.1, Math.hypot((spot.lat - lat) * 1.15, spot.lon - lon));
    if (distance > 10) continue;
    const weight = 1 / (distance ** 2);
    numerator += weight * Number(spot.score);
    denominator += weight;
  }
  return denominator ? numerator / denominator : FIRECLOUD_RASTER_NO_DATA;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(start, end, t) {
  return start + (end - start) * t;
}

function smoothstep01(t) {
  const value = clamp(t, 0, 1);
  return value * value * (3 - 2 * value);
}

function samplePalette(t, palette) {
  const value = clamp(t, 0, 1);
  for (let index = 0; index < palette.length - 1; index += 1) {
    const low = palette[index];
    const high = palette[index + 1];
    if (value >= low.t && value <= high.t) {
      const localT = (value - low.t) / (high.t - low.t || 1);
      return {
        r: Math.round(lerp(low.r, high.r, localT)),
        g: Math.round(lerp(low.g, high.g, localT)),
        b: Math.round(lerp(low.b, high.b, localT)),
        a: clamp(lerp(low.a, high.a, localT), 0, 1)
      };
    }
  }
  return palette[palette.length - 1];
}

function roundAlpha(value) {
  return Math.round(value * 1000) / 1000;
}

function rgbaToHexColor(color = {}) {
  const toHex = (value) => clamp(Math.round(Number(value) || 0), 0, 255).toString(16).padStart(2, '0').toUpperCase();
  const alpha = clamp(Number(color.a) || 0, 0, 1);
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}${toHex(alpha * 255)}`;
}

export default {
  getChinaFirecloudSpots,
  getChinaFirecloudRaster,
  normalizeChinaFirecloudSpots,
  normalizeChinaFirecloudRaster,
  buildTestFirecloudSpotData,
  buildTestFirecloudRaster,
  getFirecloudLegend,
  buildSpotMarkers,
  buildRasterGroundOverlay,
  buildRasterOverlayImageUrl,
  buildRasterPolygons,
  scoreToMapLevel,
  scoreToFirecloudColor,
  scoreToFirecloudMarkerColor,
  scoreToRasterLayerColor,
  scoreToRasterLayerHexColor
};
