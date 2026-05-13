import { searchLocations } from '../../services/geocoding.js';
import { getEnhancedPrediction } from '../../services/prediction.js';
import { addRecentLocation, listRecentLocations } from '../../services/user.js';

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
    defaultPeriod: 'sunset',
    defaultDay: 'today',
    weatherView: 'overview',
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
        predictionPreview: buildTestPredictionPreview()
      });
    }
    this.refreshSavedLists();
  },

  onShow() {
    this.refreshSavedLists();
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
      predictionPreview: {
        ...this.data.predictionPreview,
        periodKey: value,
        periodLabel: value === 'sunrise' ? '朝霞' : '晚霞',
        eventTimeLabel: value === 'sunrise' ? '日出时间' : '日落时间',
        directionLabel: value === 'sunrise' ? '日出方向' : '日落方向'
      }
    });
  },

  switchWeatherView(event) {
    const view = event.currentTarget.dataset.view;
    if (!['overview', 'hourly', 'glow'].includes(view)) return;
    this.setData({ weatherView: view });
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

  selectDefaultPeriod(event) {
    const value = event.currentTarget.dataset.value || 'sunset';
    this.saveSettings({ defaultPeriod: value });
  },

  selectDefaultDay(event) {
    const value = event.currentTarget.dataset.value || 'today';
    this.saveSettings({ defaultDay: value });
  },

  resetSettings() {
    this.saveSettings({ defaultPeriod: 'sunset', defaultDay: 'today' });
  },

  applySavedSettings() {
    const settings = readHomeSettings();
    this.setData({
      defaultPeriod: settings.defaultPeriod,
      defaultDay: settings.defaultDay,
      period: settings.defaultPeriod,
      day: settings.defaultDay
    });
  },

  saveSettings(patch = {}) {
    const settings = {
      defaultPeriod: patch.defaultPeriod || this.data.defaultPeriod || 'sunset',
      defaultDay: patch.defaultDay || this.data.defaultDay || 'today'
    };
    wx.setStorageSync('homeSettings', settings);
    this.setData({
      ...settings,
      period: settings.defaultPeriod,
      day: settings.defaultDay
    });
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
        predictionPreview: buildTestPredictionPreview(),
        errorMessage: '',
        loading: false
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

      wx.navigateTo({
        url: `/pages/result/index?source=latest&period=${query.period}&day=${query.day}`
      });
    } catch (error) {
      this.setData({ errorMessage: friendlyError(error) });
    } finally {
      this.setData({ loading: false });
    }
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
    dateLabel: 'TEST',
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

export function buildWeatherPreview(weather = {}) {
  const highCloud = weather.highClouds ?? weather.highCloud ?? weather.clouds?.high;
  const midCloud = weather.midClouds ?? weather.midCloud ?? weather.clouds?.mid;
  const lowCloud = weather.lowClouds ?? weather.lowCloud ?? weather.clouds?.low;
  const cloudAverage = averageNumber([highCloud, midCloud, lowCloud, weather.cloudCover]);
  const provider = weather.provider || weather.providerMeta?.name || 'test';
  const windSpeed = formatWindSpeedValue(weather.windSpeed);
  const windDirection = weather.windDirection || '风向';
  return {
    visible: true,
    title: '天气信息',
    description: `${provider} 天气测试数据，用于先验收天气卡片 UI。`,
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
    hourly: buildWeatherHourlyPreview(weather),
    hourlyChart: buildWeatherHourlyChart(weather),
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

export function buildWeatherHourlyPreview(weather = {}) {
  const source = Array.isArray(weather.hourly) ? weather.hourly : [];
  if (source.length) {
    return source.slice(0, 24).map((item, index) => ({
      key: item.key || item.time || `hour-${index}`,
      time: item.timeLabel || compactHour(item.time || item.date || item.timestamp) || `${index}:00`,
      temp: formatTemperatureValue(item.temp ?? item.temperature),
      humidity: formatPercentValue(item.humidity),
      cloud: formatPercentValue(item.cloudCover ?? item.clouds),
      wind: formatWindSpeedValue(item.windSpeed ?? item.wind)
    }));
  }

  const baseTemp = Number(weather.temp ?? weather.temperature);
  const temp = Number.isFinite(baseTemp) ? baseTemp : 19.9;
  return [0, 3, 6, 9, 12, 15, 18, 21].map((hour, index) => ({
    key: `test-hour-${hour}`,
    time: `${String(hour).padStart(2, '0')}:00`,
    temp: formatTemperatureValue(temp + Math.sin(index / 2) * 3),
    humidity: formatPercentValue((weather.humidity ?? 72) - index),
    cloud: formatPercentValue((weather.cloudCover ?? weather.midClouds ?? 53) + (index % 3) * 3),
    wind: formatWindSpeedValue((weather.windSpeed ?? 11) + (index % 2))
  }));
}

export function buildWeatherHourlyChart(weather = {}) {
  const hourly = buildWeatherHourlyPreview(weather);
  const temps = hourly.map((item) => Number(item.temp)).filter(Number.isFinite);
  const min = temps.length ? Math.min(...temps) : 0;
  const max = temps.length ? Math.max(...temps) : 1;
  const span = Math.max(1, max - min);
  const count = Math.max(1, hourly.length - 1);

  return hourly.map((item, index) => {
    const temp = Number(item.temp);
    const normalized = Number.isFinite(temp) ? (temp - min) / span : 0.5;
    const x = Math.round((index / count) * 100);
    const y = Math.round(82 - normalized * 58);
    return {
      key: item.key,
      time: item.time,
      temp: item.temp,
      left: x,
      top: y,
      barHeight: Math.max(10, Math.round(normalized * 54) + 12)
    };
  });
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
  const num = Number(value);
  return Number.isFinite(num) ? `${Math.round(num)}%` : '--';
}

function formatDistanceValue(value) {
  const num = Number(value);
  return Number.isFinite(num) ? `${num.toFixed(num >= 10 ? 0 : 1)} km` : '--';
}

function formatWindSpeedValue(speed) {
  const speedNum = Number(speed);
  return Number.isFinite(speedNum) ? `${Math.round(speedNum)} km/h` : '--';
}

function formatWindValue(direction, speed) {
  return `${direction || '风向'} ${formatWindSpeedValue(speed)}`;
}

function formatNumberValue(value, unit) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '--';
  return `${num}${unit ? ` ${unit}` : ''}`;
}

function formatTemperatureValue(value) {
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

function readHomeSettings() {
  const settings = wx.getStorageSync('homeSettings') || {};
  const defaultPeriod = settings.defaultPeriod === 'sunrise' ? 'sunrise' : 'sunset';
  const defaultDay = settings.defaultDay === 'tomorrow' ? 'tomorrow' : 'today';
  return { defaultPeriod, defaultDay };
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
