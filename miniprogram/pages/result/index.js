import { formatPercent, formatVisibility } from '../../utils/format.js';

const app = getApp();

Page({
  data: {
    hasPrediction: false,
    prediction: null,
    metrics: []
  },

  onLoad(options = {}) {
    const prediction = this.resolvePrediction(options);
    if (!prediction) {
      this.setData({ hasPrediction: false });
      return;
    }

    const normalized = normalizePrediction(prediction, options);
    this.setData({
      hasPrediction: true,
      prediction: normalized,
      metrics: buildMetrics(normalized)
    });
  },

  resolvePrediction(options) {
    if (options.payload) {
      try {
        return JSON.parse(decodeURIComponent(options.payload));
      } catch (error) {
        // fall through to storage
      }
    }

    return app.globalData.latestPrediction || wx.getStorageSync('latestPrediction') || null;
  },

  goHome() {
    wx.navigateBack({
      fail() {
        wx.reLaunch({ url: '/pages/home/index' });
      }
    });
  }
});

function normalizePrediction(input, options = {}) {
  const period = input.period || input.type || options.period || 'sunset';
  const day = input.day || options.day || 'today';
  const metrics = input.metrics || input.factors || input.weather || {};

  return {
    ...input,
    metrics,
    period,
    day,
    locationName: input.locationName || input.location || '未命名地点',
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

function formatPlain(value) {
  if (value === '--') return value;
  const number = Number(value);
  return Number.isFinite(number) ? String(Math.round(number * 1000) / 1000) : String(value);
}
