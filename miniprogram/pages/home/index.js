import { searchLocations } from '../../services/geocoding.js';
import { getEnhancedPrediction } from '../../services/prediction.js';
import { addRecentLocation, listRecentLocations } from '../../services/user.js';
import { applyPageSettings, readAppSettings, saveAppSettings as persistAppSettings } from '../../utils/app-settings.js';
import { buildRadarCloudGradients, paintRadarCloudCanvas } from '../../utils/radar-cloud-field.js';

const app = getApp();

Page({
  data: {
    locationText: '',
    coordinate: null,
    period: 'sunset',
    day: 'today',
    loading: false,
    locating: false,
    homeMenuOpen: false,
    settingsOpen: false,
    interfaceLanguage: 'zh-CN',
    themeMode: 'system',
    resolvedThemeMode: 'light',
    weatherView: 'overview',
    weatherDay: 'today',
    weatherParameter: 'temp',
    errorMessage: '',
    weatherPreview: buildDefaultWeatherPreview(),
    predictionPreview: buildDefaultPredictionPreview(),
    recentQueries: [],
    favorites: []
  },

  onLoad(options = {}) {
    this.predictionService = options.predictionService || this.predictionService || null;
    this.applySavedSettings();
    if (options.weatherTest === '1' || options.test === 'weather') {
      this.setData({
        weatherPreview: buildTestWeatherPreview(),
        predictionPreview: buildPredictionPreviewForPeriod(this.data.period)
      }, () => {
        this.paintPredictionRadarCloudField();
      });
    }
    this.refreshSavedLists();
  },

  onShow() {
    this.applySavedSettings();
    this.refreshSavedLists();
    this.paintPredictionRadarCloudField();
  },

  onUnload() {
    if (this.radarPaintTimer) {
      clearTimeout(this.radarPaintTimer);
      this.radarPaintTimer = null;
    }
  },

  refreshSavedLists() {
    const recent = app.globalData.recentQueries || wx.getStorageSync('recentQueries') || [];
    const favorites = app.globalData.favorites || wx.getStorageSync('favoriteLocations') || [];
    this.setData({
      recentQueries: decorateRecentQueries(recent),
      favorites
    });

    this.refreshRemoteRecentQueries();
  },

  async refreshRemoteRecentQueries() {
    if (this.refreshingRemoteRecent) return;
    this.refreshingRemoteRecent = true;
    try {
      const recent = await listRecentLocations();
      if (recent.length) {
        app.globalData.recentQueries = recent.slice(0, 5);
        wx.setStorageSync('recentQueries', app.globalData.recentQueries);
        this.setData({ recentQueries: decorateRecentQueries(app.globalData.recentQueries) });
      }
    } catch (error) {
      // Remote history is optional; local recent queries keep the page useful offline.
    } finally {
      this.refreshingRemoteRecent = false;
    }
  },

  onLocationChange(event) {
    this.setData({ locationText: event.detail.value, coordinate: null, errorMessage: '' });
  },

  selectPeriod(event) {
    this.setData({ period: event.currentTarget.dataset.value });
  },

  selectDay(event) {
    this.setData({ day: event.currentTarget.dataset.value });
  },

  selectPredictionPreviewPeriod(event) {
    const value = event.currentTarget.dataset.value;
    if (!['sunrise', 'sunset'].includes(value)) return;
    this.setData({
      period: value,
      predictionPreview: buildPredictionPreviewForPeriod(value)
    }, () => {
      this.paintPredictionRadarCloudField();
    });
  },
  switchWeatherView(event) {
    const view = event.currentTarget.dataset.view;
    if (!['overview', 'hourly', 'glow'].includes(view)) return;
    this.setData({ weatherView: view });
  },

  switchWeatherDay(event) {
    const day = event.currentTarget.dataset.day;
    if (!['today', 'tomorrow'].includes(day)) return;
    this.setData({
      weatherDay: day,
      weatherPreview: refreshWeatherHourlyView(this.data.weatherPreview, day, this.data.weatherParameter)
    });
  },

  switchWeatherParameter(event) {
    const parameter = event.currentTarget.dataset.param;
    if (!['temp', 'precip', 'humidity', 'wind', 'pressure', 'clouds'].includes(parameter)) return;
    this.setData({
      weatherParameter: parameter,
      weatherPreview: refreshWeatherHourlyView(this.data.weatherPreview, this.data.weatherDay, parameter)
    });
  },

  toggleHomeMenu() {
    this.setData({ homeMenuOpen: !this.data.homeMenuOpen });
  },

  openSettings() {
    this.setData({ homeMenuOpen: false, settingsOpen: true });
  },

  toggleSettings() {
    this.setData({
      homeMenuOpen: false,
      settingsOpen: !this.data.settingsOpen
    });
  },

  closeSettings() {
    this.setData({ settingsOpen: false });
  },

  navigateFeature(event) {
    const target = event.currentTarget.dataset.target;
    if (target === 'settings') {
      this.openSettings();
      return;
    }
    const routes = {
      forecast: '',
      methodology: '/pages/methodology/index',
      map: `/pages/map/index?period=${this.data.period}`,
      gallery: '/pages/gallery/index',
      api: '/pages/methodology/index?section=api',
      upload: '/pages/upload/index'
    };
    const url = routes[target];
    this.setData({ homeMenuOpen: false });
    if (!url) return;
    wx.navigateTo({ url });
  },

  selectInterfaceLanguage(event) {
    const value = event.currentTarget.dataset.value;
    if (!['zh-CN', 'en-US'].includes(value)) return;
    this.saveAppSettings({ interfaceLanguage: value });
  },

  selectThemeMode(event) {
    const value = event.currentTarget.dataset.value;
    if (!['system', 'light', 'dark'].includes(value)) return;
    this.saveAppSettings({ themeMode: value });
  },

  applySavedSettings() {
    applyPageSettings(this);
  },

  saveAppSettings(patch = {}) {
    const settings = persistAppSettings(patch, this.data);
    this.setData(settings);
  },

  onAppSettingsChange(event) {
    this.setData(event.detail || readAppSettings());
  },

  async useHistory(event) {
    const index = event.currentTarget.dataset.index;
    const item = this.data.recentQueries[index] || null;
    const location = event.currentTarget.dataset.location;
    const lat = toNumberOrNull(event.currentTarget.dataset.lat);
    const lon = toNumberOrNull(event.currentTarget.dataset.lon);
    if (item) {
      this.setData({
        locationText: item.locationName || item.name || location,
        coordinate: item.lat !== null && item.lon !== null ? { lat: item.lat, lon: item.lon } : item.coordinate || null,
        period: item.type || item.period || this.data.period,
        day: item.day || this.data.day,
        errorMessage: ''
      });
      await this.onSearch();
      return;
    }
    if (location) {
      this.setData({
        locationText: location,
        coordinate: lat !== null && lon !== null ? { lat, lon } : null,
        errorMessage: ''
      });
      await this.onSearch();
    }
  },

  async onUseCurrentLocation() {
    if (this.data.locating) return;
    this.setData({ locating: true, errorMessage: '' });

    try {
      const res = await wxPromise(wx.getLocation, { type: 'wgs84' });
      const locationText = '当前位置';
      this.setData({
        coordinate: { lat: res.latitude, lon: res.longitude },
        locationText
      });
      await this.onSearch();
    } catch (error) {
      this.setData({ errorMessage: '无法获取当前位置，请检查定位权限或手动输入地点。' });
    } finally {
      this.setData({ locating: false });
    }
  },

  async onSearch() {
    const locationText = (this.data.locationText || '').trim();
    if (isWeatherTestLocation(locationText)) {
      this.setData({
        weatherPreview: buildTestWeatherPreview(),
        predictionPreview: buildPredictionPreviewForPeriod(this.data.period),
        errorMessage: '',
        loading: false
      }, () => {
        this.paintPredictionRadarCloudField();
      });
      return;
    }

    if (!locationText && !this.data.coordinate) {
      this.setData({ errorMessage: '先输入地点，或使用当前位置。' });
      return;
    }

    this.setData({ loading: true, errorMessage: '' });

    try {
      const resolvedLocation = await this.resolveLocation(locationText);
      const query = {
        location: resolvedLocation.name,
        locationName: resolvedLocation.name,
        coordinate: { lat: resolvedLocation.lat, lon: resolvedLocation.lon },
        period: this.data.period,
        day: this.data.day
      };
      const raw = await this.callPredictionService(query);
      const prediction = normalizePrediction(raw, query);
      app.rememberQuery(query);
      this.recordRecentLocation(query);
      app.saveLatestPrediction(prediction);

      this.setData({
        ...buildHomePredictionSurface(prediction, query),
        weatherView: 'overview',
        weatherDay: query.day,
        weatherParameter: 'temp'
      }, () => {
        this.paintPredictionRadarCloudField();
      });
    } catch (error) {
      this.setData({ errorMessage: friendlyError(error) });
    } finally {
      this.setData({ loading: false });
    }
  },

  paintPredictionRadarCloudField({ force = false } = {}) {
    const directions = this.data.predictionPreview?.radar?.directions || [];
    if (!directions.length) return;
    const signature = directions.map((item) => [
      item.direction,
      item.scoreText,
      item.highCloud,
      item.midCloud,
      item.lowCloud,
      item.cloudText
    ].map((value) => value ?? '').join(':')).join('|');
    if (!force && signature && signature === this.lastRadarPaintSignature) return;
    this.lastRadarPaintSignature = signature;
    if (this.radarPaintTimer) clearTimeout(this.radarPaintTimer);
    this.radarPaintTimer = setTimeout(() => {
      this.radarPaintTimer = null;
      paintRadarCloudCanvas('homeRadarCloudField', directions, { page: this });
    }, 80);
  },

  async resolveLocation(locationText) {
    if (this.data.coordinate) {
      return {
        name: locationText || '当前位置',
        lat: this.data.coordinate.lat,
        lon: this.data.coordinate.lon
      };
    }

    const results = await searchLocations(locationText, 1);
    if (!results.length) {
      throw new Error('LOCATION_NOT_FOUND');
    }

    return results[0];
  },

  callPredictionService(query) {
    const services = app.services || {};
    const candidates = [
      this.predictionService,
      services.prediction,
      services.predictionService,
      services.sunsetPrediction,
      services.sunsetPredictionService
    ].filter(Boolean);

    const methodNames = ['predict', 'query', 'getPrediction', 'getSunsetPrediction', 'generatePrediction'];
    for (const service of candidates) {
      for (const name of methodNames) {
        if (typeof service[name] === 'function') {
          return service[name](query);
        }
      }
      if (typeof service === 'function') {
        return service(query);
      }
    }

    const date = resolvePredictionDate(query.day);
    return getEnhancedPrediction({
      lat: query.coordinate.lat,
      lon: query.coordinate.lon,
      type: query.period,
      date
    });
  },

  async recordRecentLocation(query) {
    try {
      await addRecentLocation(buildRecentLocation(query));
    } catch (error) {
      // Local app.rememberQuery already captured the interaction.
    }
  }
});

export function buildRecentLocation(query = {}) {
  return {
    name: query.locationName || query.location || '当前位置',
    locationName: query.locationName || query.location || '当前位置',
    lat: query.coordinate?.lat ?? query.lat,
    lon: query.coordinate?.lon ?? query.lon,
    type: query.period || query.type || 'sunset',
    day: query.day || 'today',
    date: resolvePredictionDate(query.day)
  };
}

export function buildDefaultWeatherPreview() {
  return {
    visible: false,
    title: '天气信息',
    description: '查询后先看当前天气，再进入预测结果。',
    badge: '7天概览',
    location: '--',
    icon: '☁',
    iconType: 'cloud',
    iconSrc: '/assets/icons/weather-cloud.svg',
    condition: '--',
    temperature: '--',
    temperatureUnit: '°C',
    windSpeed: '--',
    windDirection: '--',
    weekly: [],
    hourly: [],
    hourlyChart: [],
    hourlyView: buildWeatherHourlyViewModel([], 'temp'),
    glow: [],
    weeklyTab: '7天概览',
    hourlyTab: '24小时预报',
    glowTab: '3天朝晚霞',
    metrics: [
      { key: 'humidity', icon: '◇', label: '湿度', value: '--' },
      { key: 'cloud', icon: '☁', label: '云量', value: '--' },
      { key: 'pressure', icon: '≡', label: '气压', value: '--' },
      { key: 'visibility', icon: '◎', label: '能见度', value: '--' },
      { key: 'aerosol', icon: '∴', label: '气溶胶', value: '--' },
      { key: 'precipitation', icon: '◌', label: '降水', value: '--' }
    ],
    note: '3天朝晚霞趋势会跟随查询结果一起查看'
  };
}

export function buildTestWeatherPreview() {
  return buildWeatherPreview({
    provider: 'test',
    highClouds: 62,
    midClouds: 54,
    lowClouds: 43,
    humidity: 72,
    visibility: 13.2,
    windDirection: '西',
    windSpeed: 11,
    pressure: 1007,
    aod: 0.11,
    temp: 19.9,
    precipitation: 0,
    location: 'TEST',
    condition: '多云'
  });
}

export function buildDefaultPredictionPreview() {
  return {
    icon: '☼',
    dateLabel: '今日',
    periodKey: 'sunset',
    periodLabel: '晚霞',
    conclusion: '输入地点后生成结论、评分、最佳时间窗和形成条件分析。',
    score: '--',
    scoreLabel: '等待查询',
    scoreDesc: '与网页 test 预测卡保持同一阅读顺序',
    eventTimeLabel: '日落时间',
    mainTime: '--:--',
    bestViewingTime: '--',
    directionLabel: '太阳方向',
    direction: '--',
    clouds: [
      { key: 'high', label: '高云', value: 0 },
      { key: 'mid', label: '中云', value: 0 },
      { key: 'low', label: '低云', value: 0 }
    ],
    analysis: [
      {
        key: 'carrier',
        title: '云层载体',
        status: '待判断',
        tone: 'fair',
        desc: '查询后判断中高云是否能承接霞光。'
      },
      {
        key: 'lightPath',
        title: '光路条件',
        status: '待判断',
        tone: 'fair',
        desc: '查询后判断太阳方向是否有遮挡。'
      },
      {
        key: 'rendering',
        title: '空气显色',
        status: '待判断',
        tone: 'fair',
        desc: '查询后结合能见度、湿度和气溶胶判断颜色表现。'
      }
    ]
  };
}

export function buildTestPredictionPreview() {
  return {
    icon: '☼',
    dateLabel: '今日',
    periodKey: 'sunset',
    periodLabel: '晚霞',
    conclusion: '高云较充足、低云较少，具备可观赏的晚霞基础。',
    score: 76,
    scoreLabel: '高分 Strong',
    scoreDesc: '观赏条件不错',
    eventTimeLabel: '日落时间',
    mainTime: '18:58',
    bestViewingTime: '18:28-19:18',
    directionLabel: '日落方向',
    direction: '西偏北',
    clouds: [
      { key: 'high', label: '高云', value: 62 },
      { key: 'mid', label: '中云', value: 36 },
      { key: 'low', label: '低云', value: 8 }
    ],
    analysis: [
      {
        key: 'carrier',
        title: '云层载体',
        status: '较好',
        tone: 'good',
        desc: '中高云能承接日落光线，是今天主要的显色画布。'
      },
      {
        key: 'lightPath',
        title: '光路条件',
        status: '较好',
        tone: 'good',
        desc: '低云较少，太阳方向相对通透，光线有机会照到云底。'
      },
      {
        key: 'rendering',
        title: '空气显色',
        status: '一般',
        tone: 'fair',
        desc: '湿度和 AOD 适中，颜色表现主要看临近日落时段云层变化。'
      }
    ]
  };
}

export function buildPredictionPreviewForPeriod(period = 'sunset') {
  if (period === 'sunrise') {
    return buildCompletePredictionPreview({
      icon: '☼',
      dateLabel: '今日',
      periodKey: 'sunrise',
      periodLabel: '朝霞',
      conclusion: '东侧中高云较合适，低云遮挡偏少，具备可观赏的朝霞基础。',
      score: 58,
      scoreLabel: '可观 Watch',
      scoreDesc: '建议提前观察',
      eventTimeLabel: '日出时间',
      mainTime: '05:04',
      bestViewingTime: '04:42-05:22',
      directionLabel: '日出方向',
      direction: '东偏北',
      clouds: [
        { key: 'high', label: '高云', value: 38 },
        { key: 'mid', label: '中云', value: 48 },
        { key: 'low', label: '低云', value: 14 }
      ]
    });
  }

  return buildCompletePredictionPreview(buildTestPredictionPreview());
}

export function buildHomePredictionSurface(prediction = {}, query = {}) {
  const weather = buildWeatherFromPrediction(prediction, query);
  return {
    weatherPreview: buildWeatherPreview(weather),
    predictionPreview: buildPredictionPreviewFromPrediction(prediction, query)
  };
}

export function buildPredictionPreviewFromPrediction(prediction = {}, query = {}) {
  const period = prediction.period || prediction.type || query.period || 'sunset';
  const periodLabel = period === 'sunrise' ? '朝霞' : '晚霞';
  const clouds = extractCloudLayers(prediction);
  const weather = buildWeatherFromPrediction(prediction, query);
  const score = Number(prediction.score ?? prediction.totalScore ?? prediction.finalScore);
  const preview = {
    dateLabel: prediction.day === 'tomorrow' || query.day === 'tomorrow' ? '明日' : '今日',
    periodKey: period,
    periodLabel,
    eventTimeLabel: period === 'sunrise' ? '日出时间' : '日落时间',
    mainTime: compactBestTime(prediction.mainTime || prediction.eventTime || prediction.referenceTime || prediction.bestWindow || prediction.date),
    bestViewingTime: formatBestWindow(prediction.bestWindow || prediction.window || prediction.timeWindow || prediction.goldenHour || prediction.referenceTime || prediction.date),
    directionLabel: period === 'sunrise' ? '日出方向' : '日落方向',
    direction: prediction.direction || prediction.sunDirection || prediction.lightPathAnalysis?.directionalAnalysis?.direction || (period === 'sunrise' ? '东偏北' : '西偏北'),
    score: Number.isFinite(score) ? Math.round(score) : '--',
    scoreLabel: prediction.scoreLabel || buildScoreLabel(score),
    scoreDesc: prediction.scoreDesc || (Number.isFinite(score) && score >= 70 ? '观赏条件不错' : '建议提前观察'),
    conclusion: humanizePredictionConclusion(
      prediction.conclusion || prediction.explanation || prediction.summary?.description,
      score,
      periodLabel
    ),
    clouds: [
      { key: 'high', label: '高云', value: toDisplayNumber(clouds.high) },
      { key: 'mid', label: '中云', value: toDisplayNumber(clouds.mid) },
      { key: 'low', label: '低云', value: toDisplayNumber(clouds.low) }
    ],
    visibility: weather.visibility,
    humidity: weather.humidity,
    aod: weather.aod ?? weather.aerosolOpticalDepth
  };
  return buildCompletePredictionPreview(preview);
}

function humanizePredictionConclusion(value, score, periodLabel = '霞光') {
  if (value && typeof value === 'object') {
    return humanizePredictionConclusion(value.description || value.text || value.label || value.key || value.code, score, periodLabel);
  }

  const text = String(value || '').trim();
  const internalTokens = {
    conditions_excellent: '火烧云条件很强，云层和光路都比较配合。',
    excellent_conditions: '火烧云条件很强，云层和光路都比较配合。',
    conditions_good: '火烧云条件可以关注，建议结合临近日落前云况再判断。',
    good_conditions: '火烧云条件可以关注，建议结合临近日落前云况再判断。',
    conditions_fair: '火烧云条件一般，适合顺路观察，不建议专程追霞。',
    fair_conditions: '火烧云条件一般，适合顺路观察，不建议专程追霞。',
    conditions_low: '火烧云条件偏弱，普通日落效果还要看实时天气和视野。',
    low_conditions: '火烧云条件偏弱，普通日落效果还要看实时天气和视野。',
    conditions_poor: '火烧云条件偏弱，普通日落效果还要看实时天气和视野。',
    poor_conditions: '火烧云条件偏弱，普通日落效果还要看实时天气和视野。'
  };
  if (internalTokens[text]) return internalTokens[text];
  if (/^[a-z]+_[a-z0-9_]+$/i.test(text)) return buildScoreConclusion(score, periodLabel);
  return text || buildScoreConclusion(score, periodLabel);
}

function buildScoreConclusion(score, periodLabel = '霞光') {
  const number = Number(score);
  if (!Number.isFinite(number)) return `${periodLabel}条件已根据实时天气完成评估。`;
  if (number >= 85) return '火烧云条件很强，值得重点关注。';
  if (number >= 70) return '火烧云条件不错，有较好的观赏基础。';
  if (number >= 40) return '火烧云条件一般，需要结合临近云况观察。';
  return '火烧云条件偏弱，不建议只凭当前评分专程追霞。';
}

export function buildWeatherPreview(weather = {}) {
  const highCloud = weather.highClouds ?? weather.highCloud ?? weather.clouds?.high;
  const midCloud = weather.midClouds ?? weather.midCloud ?? weather.clouds?.mid;
  const lowCloud = weather.lowClouds ?? weather.lowCloud ?? weather.clouds?.low;
  const cloudAverage = averageNumber([highCloud, midCloud, lowCloud, weather.cloudCover]);
  const provider = weather.provider || weather.providerMeta?.name || 'test';
  const windSpeed = formatWindSpeedValue(weather.windSpeed);
  const hourly = buildWeatherHourlyPreview(weather);
  const hourlyView = buildWeatherHourlyViewModel(hourly, 'temp');
  const windDirection = weather.windDirection || '风向';
  return {
    sourceWeather: weather,
    visible: true,
    title: '天气信息',
    description: provider === 'test' ? `${provider} 天气测试数据，用于先验收天气卡片 UI。` : `${provider} 天气数据，用于评估当前火烧云条件。`,
    badge: provider === 'test' ? 'TEST' : '7天概览',
    location: weather.location || weather.locationName || '当前位置',
    icon: weather.icon || getWeatherPreviewIcon(cloudAverage),
    iconType: weather.iconType || getWeatherPreviewIconType(cloudAverage, weather.precipitation ?? weather.precipitationProbability),
    iconSrc: `/assets/icons/weather-${weather.iconType || getWeatherPreviewIconType(cloudAverage, weather.precipitation ?? weather.precipitationProbability)}.svg`,
    condition: weather.condition || getWeatherPreviewCondition(cloudAverage),
    temperature: formatTemperatureValue(weather.temp ?? weather.temperature),
    temperatureUnit: '°C',
    windSpeed,
    windDirection,
    weekly: buildWeatherWeeklyPreview(weather),
    hourly,
    hourlyChart: hourlyView.chart,
    hourlyView,
    glow: buildWeatherGlowPreview(weather),
    weeklyTab: '7天概览',
    hourlyTab: '24小时预报',
    glowTab: '3天朝晚霞',
    metrics: [
      { key: 'humidity', icon: '◇', label: '湿度', value: formatPercentValue(weather.humidity) },
      { key: 'cloud', icon: '☁', label: '云量', value: formatPercentValue(cloudAverage) },
      { key: 'pressure', icon: '≡', label: '气压', value: formatNumberValue(weather.pressure, 'hPa') },
      { key: 'visibility', icon: '◎', label: '能见度', value: formatDistanceValue(weather.visibility) },
      { key: 'aerosol', icon: '∴', label: '气溶胶', value: formatNumberValue(weather.aod ?? weather.aerosolOpticalDepth, '') },
      { key: 'precipitation', icon: '◌', label: '降水', value: formatNumberValue(weather.precipitation, 'mm') }
    ],
    note: `高 ${formatPercentValue(highCloud)} / 中 ${formatPercentValue(midCloud)} / 低 ${formatPercentValue(lowCloud)} · ${windDirection} ${windSpeed}`
  };
}

export function buildWeatherHourlyPreview(weather = {}, day = 'today') {
  const source = Array.isArray(weather.hourly) ? weather.hourly : [];
  if (source.length) {
    const offset = day === 'tomorrow' ? 24 : 0;
    const window = source.slice(offset, offset + 24);
    return (window.length ? window : source.slice(0, 24)).map((item, index) => ({
      key: item.key || item.time || `hour-${index}`,
      time: item.timeLabel || compactHour(item.time || item.date || item.timestamp) || `${index}:00`,
      temp: formatTemperatureValue(item.temp ?? item.temperature),
      precip: formatNumberRaw(item.precipitation ?? item.precip ?? 0),
      humidity: formatPercentValue(item.humidity),
      humidityValue: formatNumberRaw(item.humidity),
      cloud: formatPercentValue(item.cloudCover ?? item.clouds),
      cloudValue: formatNumberRaw(item.cloudCover ?? item.clouds),
      wind: formatWindSpeedValue(item.windSpeed ?? item.wind),
      windValue: formatNumberRaw(item.windSpeed ?? item.wind),
      pressure: formatNumberRaw(item.pressure)
    }));
  }

  const baseTemp = Number(weather.temp ?? weather.temperature);
  const temp = Number.isFinite(baseTemp) ? baseTemp : 19.9;
  return Array.from({ length: 24 }, (_, index) => {
    const hour = index;
    const daylight = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
    const tempValue = temp + daylight * 6 - 2 + Math.sin(index / 3) * 1.4;
    const cloudValue = (weather.cloudCover ?? weather.midClouds ?? 53) + Math.sin(index / 2) * 10;
    const humidityValue = (weather.humidity ?? 72) - daylight * 18 + Math.cos(index / 4) * 4;
    const windValue = (weather.windSpeed ?? 11) + (index % 5) - 2;
    return {
      key: `test-hour-${day}-${hour}`,
      time: `${String(hour).padStart(2, '0')}:00`,
      temp: formatTemperatureValue(tempValue),
      precip: formatNumberRaw(index % 9 === 0 ? 0.4 : 0),
      humidity: formatPercentValue(humidityValue),
      humidityValue: formatNumberRaw(humidityValue),
      cloud: formatPercentValue(cloudValue),
      cloudValue: formatNumberRaw(cloudValue),
      wind: formatWindSpeedValue(windValue),
      windValue: formatNumberRaw(windValue),
      pressure: formatNumberRaw((weather.pressure ?? 1007) + Math.sin(index / 5) * 3)
    };
  });
}

export function buildWeatherHourlyChart(weather = {}) {
  return buildWeatherHourlyViewModel(buildWeatherHourlyPreview(weather), 'temp').chart;
}

export function buildWeatherHourlyViewModel(hourly = [], parameter = 'temp') {
  const parameterConfig = getWeatherParameterConfig();
  const config = parameterConfig[parameter] || parameterConfig.temp;
  const values = hourly.map((item) => getHourlyParameterValue(item, parameter)).filter(Number.isFinite);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const span = Math.max(1, max - min);
  const count = Math.max(1, hourly.length - 1);
  const inset = 8;
  const plotWidth = 100 - inset * 2;

  const chart = hourly.map((item, index) => {
    const value = getHourlyParameterValue(item, parameter);
    const normalized = Number.isFinite(value) ? (value - min) / span : 0.5;
    const x = Math.round((inset + (index / count) * plotWidth) * 10) / 10;
    const y = Math.round(82 - normalized * 58);
    return {
      key: item.key,
      time: item.time,
      value,
      valueText: formatHourlyParameterValue(value, config.unit),
      left: x,
      top: y,
      barHeight: Math.max(10, Math.round(normalized * 54) + 12),
      labelVisible: index % 4 === 0 || index === hourly.length - 1
    };
  });

  const chartSegments = chart.slice(0, -1).map((item, index) => {
    const next = chart[index + 1];
    const dx = next.left - item.left;
    const dy = next.top - item.top;
    return {
      key: `${item.key}-${next.key}`,
      left: item.left,
      top: item.top,
      width: Math.max(1, Math.round(Math.sqrt(dx * dx + dy * dy))),
      rotate: Math.round(Math.atan2(dy, dx) * 180 / Math.PI)
    };
  });

  return {
    selected: parameter,
    label: config.label,
    unit: config.unit,
    parameters: Object.keys(parameterConfig).map((key) => ({ key, ...parameterConfig[key] })),
    dayOptions: [
      { key: 'today', label: '今天' },
      { key: 'tomorrow', label: '明天' }
    ],
    chart,
    chartSegments,
    axisLabels: [max, min + span / 2, min].map((value, index) => ({
      key: `axis-${index}`,
      value: formatHourlyParameterValue(value, config.unit)
    })),
    weatherStrip: hourly.filter((_, index) => index % 4 === 0).map((item) => ({
      key: item.key,
      time: item.time,
      text: item.cloud
    }))
  };
}

function getWeatherParameterConfig() {
  return {
    temp: { label: '温度', unit: '°C', icon: '℃' },
    precip: { label: '降水', unit: 'mm', icon: '∿' },
    humidity: { label: '湿度', unit: '%', icon: '◇' },
    wind: { label: '风速', unit: 'km/h', icon: '≈' },
    pressure: { label: '气压', unit: 'hPa', icon: '≡' },
    clouds: { label: '云量', unit: '%', icon: '☁' }
  };
}

function refreshWeatherHourlyView(preview = {}, day = 'today', parameter = 'temp') {
  const hourly = buildWeatherHourlyPreview(preview.sourceWeather || {}, day);
  const fallbackHourly = hourly.length ? hourly : (preview.hourly || []);
  const hourlyView = buildWeatherHourlyViewModel(fallbackHourly, parameter);
  return {
    ...preview,
    hourly: fallbackHourly,
    hourlyChart: hourlyView.chart,
    hourlyView
  };
}

function getHourlyParameterValue(item = {}, parameter = 'temp') {
  const value = {
    temp: item.temp,
    precip: item.precip,
    humidity: item.humidityValue ?? item.humidity,
    wind: item.windValue ?? item.wind,
    pressure: item.pressure,
    clouds: item.cloudValue ?? item.cloud
  }[parameter];
  return Number(String(value).replace(/[^0-9.-]/g, ''));
}

function formatHourlyParameterValue(value, unit) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '--';
  const rounded = unit === 'mm' ? Math.round(number * 10) / 10 : Math.round(number);
  return `${rounded}${unit}`;
}

function formatNumberRaw(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 10) / 10 : 0;
}

export function buildPredictionAnalysisGroups(input = {}) {
  const high = Number(input.high ?? 62);
  const mid = Number(input.mid ?? 36);
  const low = Number(input.low ?? 8);
  const visibility = Number(input.visibility ?? 13);
  const humidity = Number(input.humidity ?? 72);
  const aod = Number(input.aod ?? 0.11);
  return [
    { key: 'carrier', title: '云层载体', status: high >= 50 || mid >= 30 ? '较好' : '一般', tone: high >= 50 || mid >= 30 ? 'good' : 'fair', desc: `高云 ${Math.round(high)}%、中云 ${Math.round(mid)}%，有可染色云层基础。` },
    { key: 'lightPath', title: '光路条件', status: low <= 25 ? '较好' : '一般', tone: low <= 25 ? 'good' : 'fair', desc: `低云 ${Math.round(low)}%，太阳方向相对通透，光线有机会照到云底。` },
    { key: 'rendering', title: '空气显色', status: visibility >= 10 && humidity < 85 ? '较好' : '一般', tone: visibility >= 10 && humidity < 85 ? 'good' : 'fair', desc: `能见度 ${Math.round(visibility)}km、湿度 ${Math.round(humidity)}%、AOD ${aod.toFixed(2)}。` },
    { key: 'limits', title: '限制因素', status: low > 45 ? '需警惕' : '较少', tone: low > 45 ? 'warning' : 'good', desc: low > 45 ? '低云偏多可能遮挡太阳方向。' : '降水和厚低云限制不明显。' }
  ];
}

export function buildPredictionRadarPreview(period = 'sunset') {
  if (period === 'sunrise') {
    const directions = withRadarCloudFields([
      { direction: 'N', name: '北', scoreText: '51', level: 'watch', cloudText: '高 22% / 中 35% / 低 18%' },
      { direction: 'NE', name: '东北', scoreText: '58', level: 'watch', cloudText: '高 30% / 中 48% / 低 14%' },
      { direction: 'E', name: '东', scoreText: '62', level: 'watch', cloudText: '高 38% / 中 52% / 低 12%' },
      { direction: 'SE', name: '东南', scoreText: '55', level: 'watch', cloudText: '高 34% / 中 46% / 低 16%' },
      { direction: 'S', name: '南', scoreText: '44', level: 'watch', cloudText: '高 18% / 中 32% / 低 26%' },
      { direction: 'SW', name: '西南', scoreText: '39', level: 'weak', cloudText: '高 14% / 中 26% / 低 32%' },
      { direction: 'W', name: '西', scoreText: '36', level: 'weak', cloudText: '高 12% / 中 24% / 低 36%' },
      { direction: 'NW', name: '西北', scoreText: '43', level: 'watch', cloudText: '高 18% / 中 30% / 低 24%' }
    ]);
    return {
      directions,
      cloudGradients: buildRadarCloudGradients(directions)
    };
  }

  const directions = withRadarCloudFields([
      { direction: 'N', name: '北', scoreText: '62', level: 'watch', cloudText: '高 28% / 中 44% / 低 12%' },
      { direction: 'NE', name: '东北', scoreText: '68', level: 'watch', cloudText: '高 34% / 中 48% / 低 10%' },
      { direction: 'E', name: '东', scoreText: '58', level: 'watch', cloudText: '高 22% / 中 39% / 低 18%' },
      { direction: 'SE', name: '东南', scoreText: '52', level: 'watch', cloudText: '高 18% / 中 34% / 低 24%' },
      { direction: 'S', name: '南', scoreText: '49', level: 'weak', cloudText: '高 16% / 中 30% / 低 28%' },
      { direction: 'SW', name: '西南', scoreText: '74', level: 'good', cloudText: '高 62% / 中 36% / 低 8%' },
      { direction: 'W', name: '西', scoreText: '76', level: 'good', cloudText: '高 64% / 中 36% / 低 8%' },
      { direction: 'NW', name: '西北', scoreText: '69', level: 'watch', cloudText: '高 55% / 中 38% / 低 12%' }
    ]);
  return {
    directions,
    cloudGradients: buildRadarCloudGradients(directions)
  };
}

function buildCompletePredictionPreview(preview = {}) {
  return {
    ...preview,
    analysis: buildPredictionAnalysisGroups({
      high: preview.clouds?.[0]?.value,
      mid: preview.clouds?.[1]?.value,
      low: preview.clouds?.[2]?.value,
      visibility: preview.visibility,
      humidity: preview.humidity,
      aod: preview.aod
    }),
    radar: buildPredictionRadarFromClouds(preview.periodKey, preview.clouds)
  };
}

function buildPredictionRadarFromClouds(period = 'sunset', clouds = []) {
  const high = Number(clouds.find((item) => item.key === 'high')?.value);
  const mid = Number(clouds.find((item) => item.key === 'mid')?.value);
  const low = Number(clouds.find((item) => item.key === 'low')?.value);
  if (![high, mid, low].every(Number.isFinite)) return buildPredictionRadarPreview(period);

  const names = {
    N: '北', NE: '东北', E: '东', SE: '东南', S: '南', SW: '西南', W: '西', NW: '西北'
  };
  const weights = period === 'sunrise'
    ? { N: 0.74, NE: 0.92, E: 1, SE: 0.9, S: 0.72, SW: 0.58, W: 0.52, NW: 0.62 }
    : { N: 0.72, NE: 0.62, E: 0.56, SE: 0.62, S: 0.72, SW: 0.92, W: 1, NW: 0.9 };
  const directions = withRadarCloudFields(Object.entries(weights).map(([direction, weight]) => {
    const h = clampPercent(high * weight + mid * (1 - weight) * 0.22);
    const m = clampPercent(mid * (0.82 + weight * 0.18));
    const l = clampPercent(low * (1.08 - weight * 0.14));
    const score = Math.round(h * 0.62 + m * 0.28 - l * 0.18 + 18);
    return {
      direction,
      name: names[direction],
      scoreText: String(clampPercent(score)),
      level: score >= 70 ? 'good' : (score >= 40 ? 'watch' : 'weak'),
      cloudText: `高 ${Math.round(h)}% / 中 ${Math.round(m)}% / 低 ${Math.round(l)}%`
    };
  }));
  return {
    directions,
    cloudGradients: buildRadarCloudGradients(directions)
  };
}

export function buildWeatherGlowPreview(weather = {}) {
  if (Array.isArray(weather.glow) && weather.glow.length) {
    return weather.glow.map((item, index) => ({
      key: item.key || item.date || `glow-${index}`,
      label: item.label || item.date || `D${index + 1}`,
      sunrise: item.sunrise ?? item.sunriseScore ?? '--',
      sunset: item.sunset ?? item.sunsetScore ?? '--',
      summary: item.summary || item.condition || ''
    }));
  }

  const cloudAverage = averageNumber([
    weather.highClouds ?? weather.clouds?.high,
    weather.midClouds ?? weather.clouds?.mid,
    weather.lowClouds ?? weather.clouds?.low,
    weather.cloudCover
  ]);
  const base = Number.isFinite(Number(cloudAverage)) ? Math.round(cloudAverage) : 53;
  return [
    { key: 'today', label: 'Today', sunrise: Math.max(0, base - 8), sunset: Math.min(100, base + 18), summary: 'High / mid / low cloud mix' },
    { key: 'tomorrow', label: 'Tomorrow', sunrise: Math.max(0, base - 3), sunset: Math.min(100, base + 12), summary: 'Watch the western horizon' },
    { key: 'day-3', label: 'Day 3', sunrise: Math.max(0, base - 12), sunset: Math.min(100, base + 6), summary: 'Medium confidence' }
  ];
}

export function isWeatherTestLocation(value = '') {
  return String(value).trim().toLowerCase() === 'test';
}

function buildWeatherWeeklyPreview(weather = {}) {
  if (Array.isArray(weather.weekly) && weather.weekly.length) {
    return weather.weekly.map((item, index) => ({
      key: item.key || item.date || `day-${index}`,
      label: item.label || item.day || item.date || `D${index + 1}`,
      condition: item.condition || item.summary || weather.condition || '--',
      temp: item.temp || formatTempRange(item.minTemp ?? item.tempMin, item.maxTemp ?? item.tempMax),
      precip: formatPercentValue(item.precip ?? item.precipitationProbability),
      wind: formatWindSpeedValue(item.windSpeed ?? item.wind)
    }));
  }

  return [
    { key: 'today', label: '今天', condition: '多云', temp: '15° / 31°', precip: '8%', wind: '21 km/h' },
    { key: 'tomorrow', label: '明天', condition: '多云', temp: '15° / 32°', precip: '6%', wind: '19 km/h' },
    { key: 'sat', label: '周六', condition: '局部多云', temp: '15° / 28°', precip: '14%', wind: '24 km/h' },
    { key: 'sun', label: '周日', condition: '晴间多云', temp: '17° / 27°', precip: '10%', wind: '18 km/h' },
    { key: 'mon', label: '周一', condition: '少云', temp: '16° / 31°', precip: '5%', wind: '16 km/h' },
    { key: 'tue', label: '周二', condition: '多云', temp: '16° / 32°', precip: '7%', wind: '20 km/h' },
    { key: 'wed', label: '周三', condition: '晴', temp: '16° / 29°', precip: '4%', wind: '17 km/h' }
  ];
}

function formatTempRange(min, max) {
  const minNum = Number(min);
  const maxNum = Number(max);
  if (!Number.isFinite(minNum) || !Number.isFinite(maxNum)) return '--';
  return `${Math.round(minNum)}° / ${Math.round(maxNum)}°`;
}

function decorateRecentQueries(recent = []) {
  return recent.map((item) => ({
    ...item,
    locationName: item.locationName || item.name || item.location,
    periodLabel: (item.period || item.type) === 'sunrise' ? '朝霞' : '晚霞',
    dayLabel: item.day === 'tomorrow' ? '明日' : '今日'
  }));
}

function formatPercentValue(value) {
  if (value === null || value === undefined || value === '') return '--';
  const num = Number(value);
  return Number.isFinite(num) ? `${Math.round(num)}%` : '--';
}

function formatDistanceValue(value) {
  if (value === null || value === undefined || value === '') return '--';
  const num = Number(value);
  return Number.isFinite(num) ? `${num.toFixed(num >= 10 ? 0 : 1)} km` : '--';
}

function formatWindSpeedValue(speed) {
  if (speed === null || speed === undefined || speed === '') return '--';
  const speedNum = Number(speed);
  return Number.isFinite(speedNum) ? `${Math.round(speedNum)} km/h` : '--';
}

function formatWindValue(direction, speed) {
  return `${direction || '风向'} ${formatWindSpeedValue(speed)}`;
}

function formatNumberValue(value, unit) {
  if (value === null || value === undefined || value === '') return '--';
  const num = Number(value);
  if (!Number.isFinite(num)) return '--';
  return `${num}${unit ? ` ${unit}` : ''}`;
}

function formatTemperatureValue(value) {
  if (value === null || value === undefined || value === '') return '--';
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(1) : '--';
}

function averageNumber(values) {
  const valid = values.map(Number).filter(Number.isFinite);
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function getWeatherPreviewIcon(cloudCover) {
  const value = Number(cloudCover);
  if (!Number.isFinite(value)) return '☁';
  if (value < 25) return '☀';
  if (value < 65) return '⛅';
  return '☁';
}

function getWeatherPreviewIconType(cloudCover, precipitation = 0) {
  const precip = Number(precipitation);
  const value = Number(cloudCover);
  if (Number.isFinite(precip) && precip > 0.5) return 'rain';
  if (!Number.isFinite(value)) return 'cloud';
  if (value < 25) return 'sunny';
  if (value < 65) return 'partly-cloudy';
  return 'cloud';
}

function getWeatherPreviewCondition(cloudCover) {
  const value = Number(cloudCover);
  if (!Number.isFinite(value)) return '--';
  if (value < 25) return '晴';
  if (value < 65) return '多云';
  return '阴';
}

function buildWeatherFromPrediction(prediction = {}, query = {}) {
  const weather = prediction.weatherData || prediction.weather || {};
  const metrics = prediction.metrics || {};
  const clouds = extractCloudLayers(prediction);
  return {
    ...weather,
    location: prediction.locationName || prediction.location || query.locationName || query.location,
    provider: weather.provider || prediction.provider || prediction.providerMeta?.name || 'Open-Meteo',
    providerMeta: weather.providerMeta || prediction.providerMeta,
    temp: weather.temp ?? weather.temperature ?? metrics.temp ?? metrics.temperature ?? prediction.temperature,
    humidity: weather.humidity ?? metrics.humidity ?? prediction.humidity,
    pressure: weather.pressure ?? metrics.pressure ?? prediction.pressure,
    visibility: weather.visibility ?? metrics.visibility ?? prediction.visibility,
    aod: weather.aod ?? weather.aerosolOpticalDepth ?? metrics.aod ?? prediction.aod,
    windSpeed: weather.windSpeed ?? metrics.windSpeed ?? prediction.windSpeed,
    windDirection: weather.windDirection ?? metrics.windDirection ?? prediction.windDirection,
    precipitation: weather.precipitation ?? metrics.precipitation ?? prediction.precipitation,
    highClouds: clouds.high,
    midClouds: clouds.mid,
    lowClouds: clouds.low,
    cloudCover: weather.cloudCover ?? metrics.cloudCover ?? prediction.cloudCover,
    hourly: weather.hourly || prediction.hourly || [],
    daily: weather.daily || prediction.daily || [],
    glow: weather.glow || prediction.glow || []
  };
}

function extractCloudLayers(prediction = {}) {
  const weather = prediction.weatherData || prediction.weather || {};
  const metrics = prediction.metrics || {};
  const clouds = prediction.clouds || prediction.cloudLayers || {};
  return {
    high: firstFinite(clouds.high, clouds.highClouds, metrics.highCloud, metrics.highClouds, weather.highClouds, weather.highCloud, prediction.highCloud, prediction.highClouds),
    mid: firstFinite(clouds.mid, clouds.midClouds, metrics.midCloud, metrics.midClouds, weather.midClouds, weather.midCloud, prediction.midCloud, prediction.midClouds),
    low: firstFinite(clouds.low, clouds.lowClouds, clouds.lowCloudCover, metrics.lowCloud, metrics.lowClouds, weather.lowClouds, weather.lowCloudCover, prediction.lowCloud, prediction.lowClouds)
  };
}

function firstFinite(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function toDisplayNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : 0;
}

function buildScoreLabel(score) {
  const number = Number(score);
  if (!Number.isFinite(number)) return '--';
  if (number >= 85) return '极佳 Excellent';
  if (number >= 70) return '高分 Strong';
  if (number >= 40) return '可观 Watch';
  return '较弱 Weak';
}

function compactBestTime(value) {
  if (!value) return '--';
  if (typeof value === 'string' && value.includes('-')) return value.split('-')[0].trim();
  if (typeof value === 'object') return compactDateTime(value.start || value.from || value.time);
  return compactDateTime(value);
}

function withRadarCloudFields(directions = []) {
  return directions.map((item) => {
    const values = parseCloudText(item.cloudText);
    return {
      ...item,
      highCloud: item.highCloud ?? values.high,
      midCloud: item.midCloud ?? values.mid,
      lowCloud: item.lowCloud ?? values.low
    };
  });
}

function parseCloudText(text = '') {
  const matches = String(text).match(/\d+(?:\.\d+)?/g) || [];
  return {
    high: Number(matches[0] ?? 0),
    mid: Number(matches[1] ?? 0),
    low: Number(matches[2] ?? 0)
  };
}

function clampPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function wxPromise(fn, options) {
  return new Promise((resolve, reject) => {
    fn({ ...options, success: resolve, fail: reject });
  });
}

function normalizePrediction(raw = {}, query) {
  const data = raw.prediction || raw.data || raw;
  const clouds = data.clouds || data.cloudLayers || {};
  const summary = data.summary || {};
  const explanation = typeof summary === 'string'
    ? summary
    : (summary.description || data.description || data.advice || '已完成查分，建议结合实时天气、视野和临近时段云况判断。');

  return {
    ...data,
    locationName: data.locationName || data.location || query.locationName,
    lat: data.lat ?? data.latitude ?? query.coordinate?.lat,
    lon: data.lon ?? data.lng ?? data.longitude ?? query.coordinate?.lon,
    period: data.period || data.type || query.period,
    day: data.day || query.day,
    score: data.score ?? data.totalScore ?? data.finalScore,
    grade: data.grade || data.quality || data.level,
    bestWindow: formatBestWindow(data.bestWindow || data.window || data.timeWindow || data.referenceTime || data.date),
    explanation,
    weatherData: data.weatherData || data.weather || {},
    clouds,
    metrics: {
      ...(data.metrics || data.factors || data.weather || {}),
      highCloud: clouds.high,
      midCloud: clouds.mid,
      lowCloud: clouds.low,
      visibility: data.visibility,
      humidity: data.humidity,
      aod: data.aod
    }
  };
}

function friendlyError(error) {
  if (error && error.message === 'LOCATION_NOT_FOUND') return '没有找到这个地点，请换个更具体的名称。';
  if (error && error.code === 'GEOCODING_RATE_LIMIT') return '地点搜索太频繁了，稍后再试。';
  return '查分失败，请换个地点或稍后再试。';
}

function resolvePredictionDate(day) {
  const date = new Date();
  if (day === 'tomorrow') date.setDate(date.getDate() + 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${d}`;
}

function toNumberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatBestWindow(value) {
  if (!value) return '日出/日落前后';
  if (typeof value === 'string') return compactDateTime(value);
  const start = value.start || value.from;
  const end = value.end || value.to;
  if (start && end) return `${compactDateTime(start)} - ${compactDateTime(end)}`;
  return '日出/日落前后';
}

function compactDateTime(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${hour}:${minute}`;
}

function compactHour(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 5);
  return `${String(date.getHours()).padStart(2, '0')}:00`;
}
