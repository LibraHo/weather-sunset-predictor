import { formatPercent, formatVisibility } from '../../utils/format.js';
import { getEnhancedPrediction, getSurroundingPrediction, getThreeDayGlow, scoreToLevel } from '../../services/prediction.js';
import { addFavorite, deleteFavorite, listFavorites } from '../../services/user.js';
import { buildRadarCloudGradients, paintRadarCloudCanvas } from '../../utils/radar-cloud-field.js';
import { applyPageSettings, readAppSettings } from '../../utils/app-settings.js';

const app = getApp();

Page({
  data: {
    hasPrediction: false,
    loading: false,
    activePeriod: 'sunset',
    periodCards: {},
    prediction: null,
    metrics: [],
    analysisItems: [],
    scoreLedger: buildScoreLedger(),
    radar: buildEmptyRadar(),
    threeDayGlow: buildEmptyThreeDayGlow(),
    isFavorite: false,
    themeMode: 'system',
    resolvedThemeMode: 'light'
  },

  async onLoad(options = {}) {
    this.applySavedSettings();
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
        activePeriod: normalized.period,
        periodCards: { [normalized.period]: normalized },
        prediction: normalized,
        metrics: buildMetrics(normalized),
        analysisItems: buildAnalysisItems(normalized),
        scoreLedger: buildScoreLedger(normalized),
        radar: buildEmptyRadar({ loading: hasCoordinates(normalized) }),
        threeDayGlow: buildEmptyThreeDayGlow({ loading: hasCoordinates(normalized) }),
        isFavorite: isFavoriteLocation(normalized, app.globalData.favorites || wx.getStorageSync('favoriteLocations') || [])
      });
      this.refreshFavoriteState(normalized);
      this.loadXiakePanels(normalized);
      this.prefetchAlternatePeriod(normalized);
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

  async loadXiakePanelsUncached(prediction) {
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
      const radar = buildRadarView(radarResult.value);
      this.setData({ radar }, () => {
        this.paintRadarCloudField(radar);
      });
    } else {
      this.setData({ radar: buildEmptyRadar({ error: '周边云况暂时加载失败，请稍后再试。' }) });
    }

    if (threeDayResult.status === 'fulfilled') {
      this.setData({ threeDayGlow: buildThreeDayGlowView(threeDayResult.value) });
    } else {
      this.setData({ threeDayGlow: buildEmptyThreeDayGlow({ error: '三天预测暂时加载失败，请稍后再试。' }) });
    }
  },

  async loadXiakePanels(prediction) {
    if (!hasCoordinates(prediction)) return;
    const lat = Number(prediction.lat);
    const lon = Number(prediction.lon);
    const type = prediction.period || prediction.type || 'sunset';
    const date = prediction.date || null;
    const radarKey = buildPanelCacheKey({ lat, lon, type, date });
    this.radarPanelCache = this.radarPanelCache || {};

    if (this.radarPanelCache[radarKey]) {
      const radar = this.radarPanelCache[radarKey];
      this.setData({ radar }, () => {
        this.paintRadarCloudField(radar);
      });
    } else {
      this.setData({ radar: buildEmptyRadar({ loading: true }) });
    }

    if (this.threeDayGlowCache) {
      this.setData({ threeDayGlow: this.threeDayGlowCache });
    } else {
      this.setData({ threeDayGlow: buildEmptyThreeDayGlow({ loading: true }) });
    }

    const radarPromise = this.radarPanelCache[radarKey]
      ? Promise.resolve(this.radarPanelCache[radarKey])
      : this.getRadarPanelPromise({ lat, lon, type, date, radarKey });
    const threeDayPromise = this.threeDayGlowCache
      ? Promise.resolve(this.threeDayGlowCache)
      : this.getThreeDayGlowPromise({ lat, lon });

    const [radarResult, threeDayResult] = await Promise.allSettled([radarPromise, threeDayPromise]);

    if (radarResult.status === 'fulfilled') {
      const radar = radarResult.value;
      this.radarPanelCache[radarKey] = radar;
      this.setData({ radar }, () => {
        this.paintRadarCloudField(radar);
      });
    } else {
      this.setData({ radar: buildEmptyRadar({ error: '周边云况暂时加载失败，请稍后再试。' }) });
    }

    if (threeDayResult.status === 'fulfilled') {
      this.threeDayGlowCache = threeDayResult.value;
      this.setData({ threeDayGlow: threeDayResult.value });
    } else {
      this.setData({ threeDayGlow: buildEmptyThreeDayGlow({ error: '三天预测暂时加载失败，请稍后再试。' }) });
    }
  },

  getRadarPanelPromise({ lat, lon, type, date, radarKey }) {
    this.radarPanelCache = this.radarPanelCache || {};
    this.radarPanelPromises = this.radarPanelPromises || {};
    if (this.radarPanelCache[radarKey]) return Promise.resolve(this.radarPanelCache[radarKey]);
    if (!this.radarPanelPromises[radarKey]) {
      this.radarPanelPromises[radarKey] = getSurroundingPrediction({ lat, lon, type, date, radius: 100 })
        .then((value) => {
          const radar = buildRadarView(value);
          this.radarPanelCache[radarKey] = radar;
          return radar;
        })
        .finally(() => {
          delete this.radarPanelPromises[radarKey];
        });
    }
    return this.radarPanelPromises[radarKey];
  },

  getThreeDayGlowPromise({ lat, lon }) {
    if (this.threeDayGlowCache) return Promise.resolve(this.threeDayGlowCache);
    if (!this.threeDayGlowPromise) {
      this.threeDayGlowPromise = getThreeDayGlow({ lat, lon })
        .then((value) => {
          const threeDayGlow = buildThreeDayGlowView(value);
          this.threeDayGlowCache = threeDayGlow;
          return threeDayGlow;
        })
        .finally(() => {
          this.threeDayGlowPromise = null;
        });
    }
    return this.threeDayGlowPromise;
  },

  async prefetchXiakePanels(prediction) {
    if (!hasCoordinates(prediction)) return;
    const lat = Number(prediction.lat);
    const lon = Number(prediction.lon);
    const type = prediction.period || prediction.type || 'sunset';
    const date = prediction.date || null;
    const radarKey = buildPanelCacheKey({ lat, lon, type, date });
    await Promise.allSettled([
      this.getRadarPanelPromise({ lat, lon, type, date, radarKey }),
      this.getThreeDayGlowPromise({ lat, lon })
    ]);
  },

  async prefetchAlternatePeriod(prediction = this.data.prediction) {
    if (!hasCoordinates(prediction)) return;
    const currentPeriod = prediction.period || prediction.type || 'sunset';
    const nextPeriod = currentPeriod === 'sunrise' ? 'sunset' : 'sunrise';
    if (this.data.periodCards[nextPeriod]) return;
    this.periodCardPromises = this.periodCardPromises || {};
    if (this.periodCardPromises[nextPeriod]) return this.periodCardPromises[nextPeriod];

    this.periodCardPromises[nextPeriod] = (async () => {
      const requested = buildPredictionPeriodRequest(prediction, nextPeriod);
      const fetched = await getEnhancedPrediction(requested);
      const normalized = normalizePrediction(fetched, requested);
      this.setData({
        periodCards: {
          ...this.data.periodCards,
          [nextPeriod]: normalized
        }
      });
      this.prefetchXiakePanels(normalized);
      return normalized;
    })()
      .catch((error) => {
        // The visible card remains usable; the explicit toggle can retry.
        return null;
      })
      .finally(() => {
        delete this.periodCardPromises[nextPeriod];
      });

    return this.periodCardPromises[nextPeriod];
  },

  paintRadarCloudField(radar = this.data.radar) {
    const directions = radar?.directions || [];
    if (!directions.length) return;
    setTimeout(() => {
      paintRadarCloudCanvas('resultRadarCloudField', directions, { page: this });
    }, 0);
  },

  onShow() {
    this.applySavedSettings();
  },

  applySavedSettings() {
    applyPageSettings(this);
  },

  onAppSettingsChange(event) {
    this.setData(event.detail || readAppSettings());
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

  async selectResultPeriod(event) {
    const period = event.currentTarget.dataset.period;
    if (!['sunrise', 'sunset'].includes(period) || period === this.data.activePeriod) return;

    const nextPrediction = this.data.periodCards[period];
    if (nextPrediction) {
      this.setData(buildResultPeriodState(nextPrediction), () => {
        this.loadXiakePanels(nextPrediction);
      });
      return;
    }

    const pendingPeriodPromise = this.periodCardPromises ? this.periodCardPromises[period] : null;
    if (pendingPeriodPromise) {
      this.setData({ activePeriod: period, loading: true });
      const prefetchedPrediction = await pendingPeriodPromise;
      if (this.data.activePeriod !== period) return;
      if (prefetchedPrediction) {
        this.setData({
          ...buildResultPeriodState(prefetchedPrediction),
          loading: false,
          periodCards: {
            ...this.data.periodCards,
            [period]: prefetchedPrediction
          }
        }, () => {
          this.loadXiakePanels(prefetchedPrediction);
        });
        return;
      }
    }

    const current = this.data.prediction || {};
    if (!hasCoordinates(current)) {
      this.setData({ activePeriod: period });
      return;
    }

    this.setData({
      activePeriod: period,
      loading: true,
      radar: buildEmptyRadar({ loading: true })
    });

    try {
      const requested = buildPredictionPeriodRequest(current, period);
      const fetched = await getEnhancedPrediction(requested);
      const normalized = normalizePrediction(fetched, requested);
      if (this.data.activePeriod !== period) return;
      this.setData({
        ...buildResultPeriodState(normalized),
        loading: false,
        periodCards: {
          ...this.data.periodCards,
          [period]: normalized
        },
        radar: buildEmptyRadar({ loading: hasCoordinates(normalized) })
      }, () => {
        this.loadXiakePanels(normalized);
      });
    } catch (error) {
      this.setData({ loading: false });
    }
  },

  onShareAppMessage() {
    const prediction = this.data.prediction || {};
    return buildShareMessage(prediction);
  },

  navigateExperience(event) {
    const target = event.currentTarget.dataset.target;
    const routes = {
      map: `/pages/map/index?period=${this.data.prediction?.period || this.data.prediction?.type || 'sunset'}`,
      methodology: '/pages/methodology/index',
      gallery: '/pages/gallery/index',
      api: '/pages/methodology/index?section=api',
      upload: '/pages/upload/index'
    };
    const url = routes[target];
    if (url) wx.navigateTo({ url });
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
    explanation: humanizeExplanation(input.explanation || input.summary || input.reason, input.score ?? input.totalScore ?? input.finalScore),
    breakdown: input.breakdown || null,
    canvasAnalysis: input.canvasAnalysis || null,
    lightPathAnalysis: input.lightPathAnalysis || null,
    renderingAnalysis: input.renderingAnalysis || null,
    cloudType: input.cloudType || null,
    algorithm: input.algorithm || null,
    clearSunsetAdvice: input.clearSunsetAdvice || null
  };
}

export function buildPredictionPeriodRequest(prediction = {}, period = 'sunset') {
  return {
    lat: Number(prediction.lat ?? prediction.latitude ?? prediction.coordinate?.lat),
    lon: Number(prediction.lon ?? prediction.lng ?? prediction.longitude ?? prediction.coordinate?.lon),
    type: period,
    date: prediction.date || prediction.referenceTime || null
  };
}

export function buildResultPeriodState(prediction = {}) {
  const normalized = normalizePrediction(prediction, { type: prediction.period || prediction.type || 'sunset' });
  return {
    activePeriod: normalized.period,
    prediction: normalized,
    metrics: buildMetrics(normalized),
    analysisItems: buildAnalysisItems(normalized),
    scoreLedger: buildScoreLedger(normalized)
  };
}

function buildMetrics(prediction) {
  const metrics = prediction.metrics || {};
  const clouds = prediction.clouds || {};
  const weather = prediction.weatherData || prediction.weather || {};
  const pick = (...keys) => {
    for (const key of keys) {
      const value = metrics[key] ?? clouds[key] ?? weather[key] ?? prediction[key];
      if (value !== undefined && value !== null && value !== '') return value;
    }
    return '--';
  };

  return [
    { key: 'temp', label: '温度', value: formatTemperature(pick('temp', 'temperature', 'temperature_2m')) },
    { key: 'wind', label: '风速', value: formatWindSpeed(pick('windSpeed', 'wind', 'wind_speed_10m')) },
    { key: 'windDirection', label: '风向', value: formatWindDirection(pick('windDirection', 'windDeg', 'wind_direction_10m')) },
    { key: 'highCloud', label: '高云', value: formatPercent(pick('highCloud', 'highCloudCover', 'cloudHigh', 'high')) },
    { key: 'midCloud', label: '中云', value: formatPercent(pick('midCloud', 'midCloudCover', 'cloudMid', 'mid')) },
    { key: 'lowCloud', label: '低云', value: formatPercent(pick('lowCloud', 'lowCloudCover', 'cloudLow', 'low')) },
    { key: 'visibility', label: '能见度', value: formatVisibility(pick('visibility', 'visibilityKm')) },
    { key: 'humidity', label: '湿度', value: formatPercent(pick('humidity', 'relativeHumidity')) },
    { key: 'pressure', label: '气压', value: formatWithUnit(pick('pressure', 'surfacePressure', 'surface_pressure'), 'hPa') },
    { key: 'precipitation', label: '降水', value: formatWithUnit(pick('precipitation', 'precip', 'rain', 'showers'), 'mm') },
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

function formatTemperature(value) {
  if (value === '--') return value;
  const number = Number(value);
  return Number.isFinite(number) ? `${Math.round(number * 10) / 10}°C` : '--';
}

function formatWithUnit(value, unit) {
  if (value === '--') return value;
  const number = Number(value);
  return Number.isFinite(number) ? `${Math.round(number * 10) / 10} ${unit}` : '--';
}

function formatWindSpeed(value) {
  return formatWithUnit(value, 'km/h');
}

function formatWindDirection(value) {
  if (value === '--') return value;
  const number = Number(value);
  return Number.isFinite(number) ? `${Math.round(number)}°` : String(value || '--');
}

function hasCoordinates(prediction = {}) {
  return Number.isFinite(Number(prediction.lat)) && Number.isFinite(Number(prediction.lon));
}

function buildPanelCacheKey({ lat, lon, type, date } = {}) {
  const latKey = Number.isFinite(Number(lat)) ? Number(lat).toFixed(4) : '';
  const lonKey = Number.isFinite(Number(lon)) ? Number(lon).toFixed(4) : '';
  return `${latKey}:${lonKey}:${type || 'sunset'}:${date || ''}`;
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

export function buildScoreLedger(prediction = {}) {
  const canvas = prediction.canvasAnalysis || {};
  const lightPath = prediction.lightPathAnalysis || {};
  const rendering = prediction.renderingAnalysis || {};
  const breakdown = prediction.breakdown || {};
  const finalScore = prediction.score ?? prediction.totalScore ?? prediction.finalScore;
  const canvasScore = canvas.score ?? breakdown.canvasScore;
  const lightPathScore = lightPath.score ?? breakdown.lightPathScore;
  const baseScore = breakdown.baseScore;
  const renderingFactor = rendering.factor ?? breakdown.renderingFactor;
  const renderedScore = breakdown.renderedScore ?? finalScore;

  const summary = Number.isFinite(Number(finalScore))
    ? `${Math.round(Number(finalScore))} 分：由云层载体、光路和显色条件综合计算`
    : '等待评分数据后展示完整解释';

  return {
    summary,
    steps: [
      {
        key: 'cloudCarrier',
        label: '载体',
        result: formatScore(canvasScore),
        expression: '可被染色的云面或薄雾载体',
        detail: buildCloudCanvasText(canvas, prediction.cloudType),
        tone: levelFromScore(canvasScore)
      },
      {
        key: 'lightPath',
        label: '光路',
        result: formatScore(lightPathScore),
        expression: '阳光是否能打到云层',
        detail: buildLightPathText(lightPath),
        tone: levelFromScore(lightPathScore)
      },
      {
        key: 'baseScore',
        label: '基础分',
        result: formatScore(baseScore),
        expression: buildBaseScoreExpression(canvasScore, lightPathScore, baseScore),
        detail: '对齐网页版：载体占主要权重，光路用于修正可见染色机会',
        tone: levelFromScore(baseScore)
      },
      {
        key: 'rendering',
        label: '显色修正',
        result: formatScore(renderedScore),
        expression: buildRenderingExpression(baseScore, renderingFactor, renderedScore),
        detail: buildRenderingText(rendering),
        tone: levelFromFactor(renderingFactor)
      },
      {
        key: 'final',
        label: '最终分',
        result: formatScore(finalScore),
        expression: '结合天气和能见度后的展示结果',
        detail: humanizeExplanation(prediction.explanation || prediction.summary || prediction.reason, finalScore),
        tone: 'final'
      }
    ]
  };
}

function buildBaseScoreExpression(canvasScore, lightPathScore, baseScore) {
  if (Number.isFinite(Number(canvasScore)) && Number.isFinite(Number(lightPathScore)) && Number.isFinite(Number(baseScore))) {
    return `${roundOne(canvasScore)}×80% + ${roundOne(lightPathScore)}×20% = ${roundOne(baseScore)}`;
  }
  return '画布 + 光路';
}

function buildRenderingExpression(baseScore, renderingFactor, renderedScore) {
  if (Number.isFinite(Number(baseScore)) && Number.isFinite(Number(renderingFactor)) && Number.isFinite(Number(renderedScore))) {
    return `${roundOne(baseScore)} × 显色系数 ${roundTwo(renderingFactor)} = ${roundOne(renderedScore)}`;
  }
  return '天气通透度修正';
}

function roundOne(value) {
  return String(Math.round(Number(value) * 10) / 10);
}

function roundTwo(value) {
  return String(Math.round(Number(value) * 100) / 100);
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
  const directions = orderRadarDirections(points);
  return {
    loading: false,
    error: '',
    bestDirection: surrounding.bestDirection || null,
    points: orderRadarPoints(points),
    directions,
    rings: buildRadarRings(),
    cloudGradients: buildRadarCloudGradients(directions),
    sunEvents: buildRadarSunEvents(surrounding),
    bestItems: directions
      .filter((item) => item.scoreText !== '--')
      .sort((a, b) => Number(b.scoreText) - Number(a.scoreText))
      .slice(0, 3),
    hasData: points.length > 0
  };
}

export function buildRadarRings() {
  return [
    { key: 'low', label: '低云', className: 'low' },
    { key: 'mid', label: '中云', className: 'mid' },
    { key: 'high', label: '高云', className: 'high' }
  ];
}

export function buildRadarSunEvents(surrounding = {}) {
  const type = surrounding.type || surrounding.period || 'sunset';
  return [{
    key: type,
    type,
    label: type === 'sunrise' ? '日出' : '日落',
    left: type === 'sunrise' ? 72 : 18,
    top: type === 'sunrise' ? 30 : 58
  }];
}

function orderRadarDirections(points = []) {
  const order = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const map = new Map(points.map((point) => [point.direction, point]));
  return order.map((direction) => map.get(direction) || {
    key: direction,
    direction,
    name: direction,
    scoreText: '--',
    level: 'unknown',
    cloudText: '暂无数据'
  });
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

function humanizeExplanation(value, score) {
  if (value && typeof value === 'object') {
    return value.description || value.text || value.label || humanizeExplanation(value.key || value.code, score);
  }

  const text = String(value || '').trim();
  const internalTokens = {
    conditions_excellent: '火烧云条件很强，云层和光路都比较配合。',
    conditions_good: '火烧云条件可以关注，建议结合临近日落前云况再判断。',
    conditions_fair: '火烧云条件一般，适合顺路观察，不建议专程追霞。',
    conditions_low: '火烧云条件偏弱，普通日落效果还要看实时天气和视野。',
    conditions_poor: '火烧云条件偏弱，普通日落效果还要看实时天气和视野。'
  };
  if (internalTokens[text]) return internalTokens[text];
  if (/^[a-z]+_[a-z0-9_]+$/i.test(text)) {
    return scoreToHumanSummary(score);
  }
  return text || scoreToHumanSummary(score);
}

function scoreToHumanSummary(score) {
  const number = Number(score);
  if (!Number.isFinite(number)) return '暂无解释，等待预测服务返回更完整的数据。';
  if (number >= 85) return '火烧云条件很强，适合重点关注。';
  if (number >= 70) return '火烧云条件较好，可以关注临近时段云况。';
  if (number >= 40) return '火烧云条件一般，适合顺路观察。';
  return '火烧云条件偏弱，不建议专程追霞。';
}
