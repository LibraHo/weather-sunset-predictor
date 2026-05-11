import { formatPercent, formatVisibility } from '../../utils/format.js';
import { getEnhancedPrediction } from '../../services/prediction.js';
import { addFavorite, deleteFavorite, listFavorites } from '../../services/user.js';

const app = getApp();

Page({
  data: {
    hasPrediction: false,
    loading: false,
    prediction: null,
    metrics: [],
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
        isFavorite: isFavoriteLocation(normalized, app.globalData.favorites || wx.getStorageSync('favoriteLocations') || [])
      });
      this.refreshFavoriteState(normalized);
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
    explanation: input.explanation || input.summary || input.reason || '暂无解释，等待预测服务返回更完整的数据。'
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
