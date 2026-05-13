import { formatPercent, formatVisibility } from '../../utils/format.js';
import { getEnhancedPrediction, getSurroundingPrediction, getThreeDayGlow, scoreToLevel } from '../../services/prediction.js';
import { addFavorite, deleteFavorite, listFavorites } from '../../services/user.js';

const app = getApp();

Page({
  data: {
    hasPrediction: false,
    loading: false,
    prediction: null,
    metrics: [],
    analysisItems: [],
    radar: buildEmptyRadar(),
    threeDayGlow: buildEmptyThreeDayGlow(),
    isFavorite: false
  },

  async onLoad(options = {}) {
    this.loadOptions = options;
    this.setData({ loading: true });

    try {
      const prediction = await this.resolvePrediction(options);
      if (!prediction) {
        this.setData({ hasPrediction: false, loading: false });
        return;
      }

      const normalized = normalizePrediction(prediction, options);
      app.saveLatestPrediction?.(normalized);
      this.setData({
        hasPrediction: true,
        loading: false,
        prediction: normalized,
        metrics: buildMetrics(normalized),
        analysisItems: buildAnalysisItems(normalized),
        radar: buildEmptyRadar({ loading: hasCoordinates(normalized) }),
        threeDayGlow: buildEmptyThreeDayGlow({ loading: hasCoordinates(normalized) }),
        isFavorite: isFavoriteLocation(normalized, app.globalData.favorites || wx.getStorageSync('favoriteLocations') || [])
      });
      this.refreshFavoriteState(normalized);
      this.loadXiakePanels(normalized);
    } catch (error) {
      this.setData({ hasPrediction: false, loading: false });
    }
  },

  async resolvePrediction(options) {
    if (hasShareLocation(options)) {
      return getEnhancedPrediction({
        lat: Number(options.lat),
        lon: Number(options.lon),
        type: options.type || 'sunset',
        date: options.date
      });
    }

    if (options.payload) {
      try {
        return JSON.parse(decodeURIComponent(options.payload));
      } catch (error) {
        // fall through to storage
      }
    }

    return app.globalData.latestPrediction || wx.getStorageSync('latestPrediction') || null;
  },

  async refreshFavoriteState(prediction) {
    try {
      const favorites = await listFavorites();
      app.globalData.favorites = favorites;
      wx.setStorageSync('favoriteLocations', favorites);
      this.setData({ isFavorite: isFavoriteLocation(prediction, favorites) });
    } catch (error) {
      // Local favorite state is enough when offline or unauthenticated.
    }
  },

  async loadXiakePanels(prediction) {
    if (!hasCoordinates(prediction)) return;
    const lat = Number(prediction.lat);
    const lon = Number(prediction.lon);
    const type = prediction.period || prediction.type || 'sunset';
    const date = prediction.date || null;

    const [radarResult, threeDayResult] = await Promise.allSettled([
      getSurroundingPrediction({ lat, lon, type, date, radius: 100 }),
      getThreeDayGlow({ lat, lon })
    ]);

    if (radarResult.status === 'fulfilled') {
      this.setData({ radar: buildRadarView(radarResult.value) });
    } else {
      this.setData({ radar: buildEmptyRadar({ error: '周边云况暂时加载失败，请稍后再试。' }) });
    }

    if (threeDayResult.status === 'fulfilled') {
      this.setData({ threeDayGlow: buildThreeDayGlowView(threeDayResult.value) });
    } else {
      this.setData({ threeDayGlow: buildEmptyThreeDayGlow({ error: '三天预测暂时加载失败，请稍后再试。' }) });
    }
  },

  async toggleFavorite() {
    const prediction = this.data.prediction;
    if (!prediction) return;

    const favorite = buildFavoritePayload(prediction);
    const favorites = app.globalData.favorites || wx.getStorageSync('favoriteLocations') || [];
    const nextIsFavorite = !this.data.isFavorite;
    const nextFavorites = nextIsFavorite
      ? [favorite, ...favorites.filter((item) => !sameLocation(item, favorite))].slice(0, 20)
      : favorites.filter((item) => !sameLocation(item, favorite));

    app.globalData.favorites = nextFavorites;
    wx.setStorageSync('favoriteLocations', nextFavorites);
    this.setData({ isFavorite: nextIsFavorite });

    try {
      if (nextIsFavorite) {
        await addFavorite(favorite);
      } else {
        await deleteFavorite(favorite);
      }
    } catch (error) {
      // Keep optimistic local UX; next page load will reconcile with server when available.
    }
  },

  onShareAppMessage() {
    const prediction = this.data.prediction || {};
    return buildShareMessage(prediction);
  },

  goHome() {
    wx.navigateBack({
      fail() {
        wx.reLaunch({ url: '/pages/home/index' });
      }
    });
  }
});

function hasShareLocation(options = {}) {
  return options.lat !== undefined && options.lon !== undefined;
}

function normalizePrediction(input = {}, options = {}) {
  const period = input.period || input.type || options.type || options.period || 'sunset';
  const day = input.day || options.day || 'today';
  const metrics = input.metrics || input.factors || input.weather || {};
  const locationName = input.locationName || input.location || options.name || '未命名地点';

  return {
    ...input,
    metrics,
    period,
    type: period,
    day,
    date: input.date || options.date || null,
    lat: input.lat ?? input.latitude ?? options.lat ?? input.coordinate?.lat ?? null,
    lon: input.lon ?? input.lng ?? input.longitude ?? options.lon ?? input.coordinate?.lon ?? null,
    locationName,
    score: input.score ?? input.totalScore ?? input.finalScore,
    grade: input.grade || input.quality || input.level,
    periodLabel: period === 'sunrise' ? '朝霞' : '晚霞',
    dayLabel: day === 'tomorrow' ? '明日' : '今日',
    bestWindow: input.bestWindow || input.window || input.timeWindow || '--',
    explanation: input.explanation || input.summary || input.reason || '暂无解释，等待预测服务返回更完整的数据。',
    breakdown: input.breakdown || null,
    canvasAnalysis: input.canvasAnalysis || null,
    lightPathAnalysis: input.lightPathAnalysis || null,
    renderingAnalysis: input.renderingAnalysis || null,
    cloudType: input.cloudType || null,
    algorithm: input.algorithm || null,
    clearSunsetAdvice: input.clearSunsetAdvice || null
  };
}

function buildMetrics(prediction) {
  const metrics = prediction.metrics || {};
  const clouds = prediction.clouds || {};
  const pick = (...keys) => {
    for (const key of keys) {
      const value = metrics[key] ?? clouds[key] ?? prediction[key];
      if (value !== undefined && value !== null && value !== '') return value;
    }
    return '--';
  };

  return [
    { key: 'highCloud', label: '高云', value: formatPercent(pick('highCloud', 'highCloudCover', 'cloudHigh', 'high')) },
    { key: 'midCloud', label: '中云', value: formatPercent(pick('midCloud', 'midCloudCover', 'cloudMid', 'mid')) },
    { key: 'lowCloud', label: '低云', value: formatPercent(pick('lowCloud', 'lowCloudCover', 'cloudLow', 'low')) },
    { key: 'visibility', label: '能见度', value: formatVisibility(pick('visibility', 'visibilityKm')) },
    { key: 'humidity', label: '湿度', value: formatPercent(pick('humidity', 'relativeHumidity')) },
    { key: 'aod', label: 'AOD', value: formatPlain(pick('aod', 'aerosolOpticalDepth')) }
  ];
}

export function buildFavoritePayload(prediction = {}) {
  return {
    name: prediction.locationName || prediction.name || '未命名地点',
    locationName: prediction.locationName || prediction.name || '未命名地点',
    lat: prediction.lat ?? prediction.coordinate?.lat ?? null,
    lon: prediction.lon ?? prediction.coordinate?.lon ?? null,
    type: prediction.period || prediction.type || 'sunset',
    date: prediction.date || null
  };
}

export function buildSharePath(prediction = {}) {
  const favorite = buildFavoritePayload(prediction);
  const params = {
    lat: favorite.lat,
    lon: favorite.lon,
    name: favorite.name,
    type: favorite.type,
    date: favorite.date || prediction.day || ''
  };
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  return `/pages/result/index${query ? `?${query}` : ''}`;
}

export function buildShareMessage(prediction = {}) {
  const name = prediction.locationName || prediction.name || '这个地点';
  const typeLabel = (prediction.period || prediction.type) === 'sunrise' ? '朝霞' : '火烧云';
  const scoreNumber = Number(prediction.score);
  const scoreText = Number.isFinite(scoreNumber) ? `${Math.round(scoreNumber)}分` : '值得一看';

  return {
    title: `霞客｜${name}${typeLabel}评分 ${scoreText}`,
    path: buildSharePath(prediction)
  };
}

export function sameLocation(a = {}, b = {}) {
  const aName = a.locationName || a.name || a.location;
  const bName = b.locationName || b.name || b.location;
  const aLat = Number(a.lat ?? a.latitude ?? a.coordinate?.lat);
  const bLat = Number(b.lat ?? b.latitude ?? b.coordinate?.lat);
  const aLon = Number(a.lon ?? a.lng ?? a.longitude ?? a.coordinate?.lon);
  const bLon = Number(b.lon ?? b.lng ?? b.longitude ?? b.coordinate?.lon);

  if (Number.isFinite(aLat) && Number.isFinite(bLat) && Number.isFinite(aLon) && Number.isFinite(bLon)) {
    return Math.abs(aLat - bLat) < 0.000001 && Math.abs(aLon - bLon) < 0.000001;
  }

  return Boolean(aName && bName && aName === bName);
}

export function isFavoriteLocation(prediction, favorites = []) {
  const target = buildFavoritePayload(prediction);
  return favorites.some((item) => sameLocation(item, target));
}

function formatPlain(value) {
  if (value === '--') return value;
  const number = Number(value);
  return Number.isFinite(number) ? String(Math.round(number * 1000) / 1000) : String(value);
}

function hasCoordinates(prediction = {}) {
  return Number.isFinite(Number(prediction.lat)) && Number.isFinite(Number(prediction.lon));
}

export function buildAnalysisItems(prediction = {}) {
  const canvas = prediction.canvasAnalysis || {};
  const lightPath = prediction.lightPathAnalysis || {};
  const rendering = prediction.renderingAnalysis || {};
  const breakdown = prediction.breakdown || {};

  return [
    {
      key: 'canvas',
      title: '云况画布',
      value: formatScore(canvas.score ?? breakdown.canvasScore),
      tone: levelFromScore(canvas.score ?? breakdown.canvasScore),
      detail: buildCloudCanvasText(canvas, prediction.cloudType)
    },
    {
      key: 'lightPath',
      title: '光路条件',
      value: formatScore(lightPath.score ?? breakdown.lightPathScore),
      tone: levelFromScore(lightPath.score ?? breakdown.lightPathScore),
      detail: buildLightPathText(lightPath)
    },
    {
      key: 'rendering',
      title: '色彩修正',
      value: formatFactor(rendering.factor ?? breakdown.renderingFactor),
      tone: levelFromFactor(rendering.factor ?? breakdown.renderingFactor),
      detail: buildRenderingText(rendering)
    }
  ];
}

function buildCloudCanvasText(canvas = {}, cloudType = null) {
  const cloudLabel = cloudType?.label || cloudType?.type;
  const high = canvas.breakdown?.highClouds;
  const mid = canvas.breakdown?.midClouds;
  const low = canvas.breakdown?.lowClouds;
  const parts = [];
  if (cloudLabel) parts.push(cloudLabel);
  if (high !== undefined || mid !== undefined || low !== undefined) {
    parts.push(`高云 ${formatPercent(high ?? 0)} / 中云 ${formatPercent(mid ?? 0)} / 低云 ${formatPercent(low ?? 0)}`);
  }
  if (canvas.cloudThickness?.thickness) parts.push(`云层厚度 ${canvas.cloudThickness.thickness}`);
  return parts.join('，') || '结合高云、中云、低云结构判断霞光画布。';
}

function buildLightPathText(lightPath = {}) {
  const parts = [];
  if (lightPath.explain) parts.push(lightPath.explain);
  if (Number.isFinite(Number(lightPath.azimuth))) parts.push(`太阳方位 ${Math.round(Number(lightPath.azimuth))}°`);
  if (Number.isFinite(Number(lightPath.occlusionProbability))) parts.push(`遮挡概率 ${formatPercent(Number(lightPath.occlusionProbability) * 100)}`);
  if (lightPath.directionalAnalysis?.reason) parts.push(lightPath.directionalAnalysis.reason);
  return parts.join('，') || '结合太阳高度角、远近云层和地平线遮挡判断光路。';
}

function buildRenderingText(rendering = {}) {
  const breakdown = rendering.breakdown || {};
  const parts = [];
  if (breakdown.visibility) parts.push(`能见度 ${breakdown.visibility}`);
  if (breakdown.humidity) parts.push(`湿度 ${breakdown.humidity}`);
  if (breakdown.aerosol) parts.push(`气溶胶 ${breakdown.aerosol}`);
  if (breakdown.colorTendency) parts.push(`色彩倾向 ${breakdown.colorTendency}`);
  return parts.join('，') || '结合能见度、湿度、空气颗粒物对最终观感做修正。';
}

function formatScore(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${Math.round(number)}分` : '--';
}

function formatFactor(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `x${Math.round(number * 100) / 100}` : '--';
}

function levelFromScore(value) {
  return scoreToLevel(value);
}

function levelFromFactor(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'unknown';
  if (number >= 1) return 'excellent';
  if (number >= 0.85) return 'good';
  if (number >= 0.65) return 'watch';
  return 'weak';
}

function buildEmptyRadar({ loading = false, error = '' } = {}) {
  return { loading, error, points: [], bestDirection: null, hasData: false };
}

export function buildRadarView(surrounding = {}) {
  const points = (surrounding.points || []).map((point) => ({
    ...point,
    scoreText: Number.isFinite(Number(point.score)) ? Math.round(Number(point.score)) : '--',
    cloudText: `高 ${formatPercent(point.highCloud ?? 0)} / 中 ${formatPercent(point.midCloud ?? 0)} / 低 ${formatPercent(point.lowCloud ?? 0)}`
  }));
  return {
    loading: false,
    error: '',
    bestDirection: surrounding.bestDirection || null,
    points: orderRadarPoints(points),
    hasData: points.length > 0
  };
}

function orderRadarPoints(points = []) {
  const order = ['NW', 'N', 'NE', 'W', 'CENTER', 'E', 'SW', 'S', 'SE'];
  const map = new Map(points.map((point) => [point.direction, point]));
  return order.map((direction) => {
    if (direction === 'CENTER') return { key: 'CENTER', direction: '', name: '当前位置', scoreText: '', level: 'center', cloudText: '' };
    return map.get(direction) || { key: direction, direction, name: direction, scoreText: '--', level: 'unknown', cloudText: '暂无数据' };
  });
}

function buildEmptyThreeDayGlow({ loading = false, error = '' } = {}) {
  return { loading, error, days: [], hasData: false };
}

export function buildThreeDayGlowView(days = []) {
  return {
    loading: false,
    error: '',
    days: days.map((day) => ({
      ...day,
      sunriseScoreText: formatGlowScore(day.sunrise?.score),
      sunriseLevel: day.sunrise?.level || scoreToLevel(day.sunrise?.score),
      sunsetScoreText: formatGlowScore(day.sunset?.score),
      sunsetLevel: day.sunset?.level || scoreToLevel(day.sunset?.score)
    })),
    hasData: days.length > 0
  };
}

function formatGlowScore(score) {
  const number = Number(score);
  return Number.isFinite(number) ? Math.round(number) : '--';
}
