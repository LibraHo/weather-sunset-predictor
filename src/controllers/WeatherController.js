/**
 * WeatherController - 天气数据控制器
 *
 * 负责获取和管理天气数据，包括缓存逻辑
 * 支持7天概览和24小时详细视图（需求11）
 * 需求：14 - 多语言支持
 */

import WeatherData from '../models/WeatherData.js';
import WindyAPIService from '../services/WindyAPIService.js';
import MockWindyAPIService from '../services/MockWindyAPIService.js';
import UnitConverter from '../utils/UnitConverter.js';
import WindyMapService from '../services/WindyMapService.js';
import MockWindyMapService from '../services/MockWindyMapService.js';
import RadarCompass from '../components/RadarCompass.js';
import RadarChartService from '../services/RadarChartService.js';
import FireCloudOverlayService from '../services/FireCloudOverlayService.js';
import SunsetPredictionService from '../services/SunsetPredictionService.js';
import PredictionAPIService from '../services/PredictionAPIService.js';
import { loadConfig } from '../../config.api.js';
import i18n from '../i18n.js';
import toastService from '../services/ToastService.js';
import ChartRenderController from './ChartRenderController.js';
import ChinaSpotsOverlay from '../services/ChinaSpotsOverlay.js';
import ChinaRasterOverlayManager from '../services/ChinaRasterOverlayManager.js';
import ChinaMapCanvas from '../components/ChinaMapCanvas.js';
import { compactLocationName } from '../utils/LocationName.js';

function isManualTestLocation(location) {
  return (location?.name || '').trim().toLowerCase() === 'test';
}

function generateManualTestWeatherData(hours = 168) {
  const start = Date.now() - (Date.now() % 3600000);
  const data = Array.from({ length: hours }, (_, i) => {
    const hour = new Date(start + i * 3600000).getHours();
    const daylight = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
    const wave = Math.sin(i / 5);
    const highClouds = Math.round(25 + Math.random() * 60);
    const midClouds = Math.round(15 + Math.random() * 55);
    const lowClouds = Math.round(Math.random() * 45);
    const cloudCover = Math.max(highClouds, midClouds, lowClouds);
    const item = new WeatherData(
      start + i * 3600000,
      18 + daylight * 10 + wave * 3 + Math.random() * 2,
      Math.round(45 + Math.random() * 40),
      cloudCover,
      Math.round(4 + Math.random() * 18),
      Math.round(1002 + Math.random() * 16),
      12 + Math.random() * 28,
      lowClouds,
      Math.random() < 0.12 ? Math.random() * 2 : 0,
      Math.round(Math.random() * 360),
      highClouds,
      midClouds
    );
    item.weatherCode = cloudCover > 70 ? 3 : (cloudCover > 35 ? 2 : 1);
    item.shortwaveRadiation = Math.round(daylight * (350 + Math.random() * 450));
    item.aerosolOpticalDepth = Number((0.08 + Math.random() * 0.18).toFixed(3));
    item.timezone = 'Asia/Shanghai';
    item.providerMeta = { name: 'manual-test', weatherModel: 'random-ui-test', timezone: 'Asia/Shanghai' };
    item.isManualTestCity = true;
    return item;
  });
  data.providerMeta = { name: 'manual-test', weatherModel: 'random-ui-test', timezone: 'Asia/Shanghai', dataQuality: 'mock' };
  return data;
}

function generateManualTestRadarData(type = 'sunset') {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].map((dir, index) => {
    const phase = index / 8 * Math.PI * 2;
    const high = Math.round(35 + Math.random() * 45 + Math.max(0, Math.sin(phase)) * 18);
    const mid = Math.round(22 + Math.random() * 42 + Math.max(0, Math.cos(phase)) * 14);
    const low = Math.round(5 + Math.random() * 34);
    const score = Math.max(0, Math.min(100, Math.round(high * 0.55 + mid * 0.35 - low * 0.28 + 18 + Math.random() * 10)));
    return {
      dir,
      score,
      dist: 50,
      cloudLayers: {
        low: Math.max(0, Math.min(100, low)),
        mid: Math.max(0, Math.min(100, mid)),
        high: Math.max(0, Math.min(100, high))
      }
    };
  });

  return {
    dirs,
    sunAzimuths: type === 'sunrise'
      ? { sunrise: 72 + Math.random() * 26 }
      : { sunset: 250 + Math.random() * 38 }
  };
}

const RADAR_EVENT_ROLLOVER_MS = 45 * 60 * 1000;
const radarSunService = new SunsetPredictionService();

function getNextRadarEventDate(location, type = 'sunset', now = new Date()) {
  const safeType = type === 'sunrise' ? 'sunrise' : 'sunset';
  const base = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  const timezone = location?.timezone || location?.timeZone || null;

  for (let offset = 0; offset <= 2; offset += 1) {
    const candidate = new Date(base);
    candidate.setDate(base.getDate() + offset);

    try {
      const eventTime = safeType === 'sunrise'
        ? radarSunService.getSunriseTime(candidate, location.lat, location.lon, { timezone })
        : radarSunService.getSunsetTime(candidate, location.lat, location.lon, { timezone });

      if (eventTime instanceof Date && !Number.isNaN(eventTime.getTime())
        && eventTime.getTime() + RADAR_EVENT_ROLLOVER_MS > base.getTime()) {
        return candidate;
      }
    } catch (_) {
      break;
    }
  }

  const fallback = new Date(base);
  fallback.setDate(base.getDate() + 1);
  return fallback;
}

/**
 * 中国火烧云地图固定使用栅格等值渲染
 */
export function createChinaOverlayManager() {
  console.log('[WeatherController] fixed mode=raster → ChinaRasterOverlayManager');
  return new ChinaRasterOverlayManager();
}
export const CHINA_RENDER_MODE_KEY = 'china_render_mode';
export const CHINA_RENDER_MODE_DEFAULT = 'raster';
import { isInMainlandChina, isMainlandChinaLocation, MAINLAND_BOUNDS } from '../utils/mainlandChinaRegion.js';
// 暂时禁用 ChartService 导入，使用内联简化版本

class WeatherController {
  constructor(storageService, apiKey, useMockAPI = true, _useProxy = false) {
    this.storageService = storageService;
    this.useMockAPI = useMockAPI;
    this.i18n = i18n; // 需求14：添加i18n实例

    // 读取单位设置
    this.tempUnit = localStorage.getItem('temp_unit') || 'celsius';
    this.windUnit = localStorage.getItem('wind_unit') || 'kmh';

    if (useMockAPI) {
      this.windyAPIService = new MockWindyAPIService(apiKey || 'mock-api-key');
    } else {
      // 固定使用后端代理模式
      const initConfig = loadConfig();
      const proxyURL = initConfig.proxy?.url || 'http://localhost:3000';
      this.windyAPIService = new WindyAPIService(null, { proxyURL });
    }

    // 任务18：初始化Windy地图服务
    if (!useMockAPI) {
      // 后端代理模式：使用真实Windy地图服务，API Key将在initializeAndShowMap中从后端获取
      this.windyMapService = new WindyMapService(''); // 临时使用空key，稍后从后端获取
    } else {
      // 纯Mock模式：不初始化地图
      this.windyMapService = null;
    }

    // Phase 18：雷达罗盘
    this._radarCompass = new RadarCompass({ size: 300 });
    this.surroundingData = null; // 兼容旧引用

    // 需求22 Phase 2：初始化后端预测 API 服务
    const apiConfig = loadConfig();
    this.useBackendSurrounding = apiConfig.features.USE_BACKEND_SURROUNDING || false;
    if (this.useBackendSurrounding) {
      const baseURL = apiConfig.proxy?.url || 'http://localhost:3000';
      this.predictionAPIService = new PredictionAPIService(baseURL);
      console.log('[WeatherController] 后端周边预测 API 已启用');
    } else {
      this.predictionAPIService = null;
    }

    // 任务20 + 26.6：初始化火烧云覆盖层服务（Phase 6 Leaflet 重构）
    this.fireCloudOverlayService = new FireCloudOverlayService();
    this.fireCloudOverlayEnabled = false; // 覆盖层开关状态
    this.currentOverlayType = 'sunset'; // 当前覆盖层类型 (sunrise/sunset)

    // 配置覆盖层服务的后端 URL
    const overlayBaseURL = apiConfig.proxy?.url || 'http://localhost:3000';
    this.fireCloudOverlayService.setBackendURL(overlayBaseURL);

    this.chartRenderController = new ChartRenderController({
      i18n: this.i18n,
      getConvertedTemp: (value) => this.getConvertedTemp(value),
      getConvertedWindSpeed: (value) => this.getConvertedWindSpeed(value)
    });
    this.chartService = this.chartRenderController.createChartService(this.tempUnit, this.windUnit);

    this.currentWeatherData = null;
    this.currentLocation = null;

    // 需求11：视图状态管理
    this.currentView = 'overview'; // 'overview', 'hourly', 'glow' 或 'map'
    this.selectedDay = 'today'; // 'today' 或 'tomorrow'
    this.selectedParameter = 'temp'; // 'temp', 'precip', 'humidity', 'wind', 'pressure', 'clouds'
    this.isMapInitialized = false; // 任务18：地图初始化状态

    // Phase 16：中国火烧云地图固定使用栅格等值渲染
    this.chinaSpotsOverlayManager = createChinaOverlayManager();
    // 兼容旧引用，指向管理器当前激活的叠加层
    this.chinaSpotsOverlay = null; // 稍后在 initChinaSpotsMap() 中设置
  }

  /**
   * 设置 API 密钥
   * @param {string} apiKey - Windy API 密钥
   */
  setAPIKey(apiKey) {
    if (this.useMockAPI) {
      this.windyAPIService = new MockWindyAPIService(apiKey);
    } else {
      // 后端代理模式固定，apiKey 由后端管理
      const cfg = loadConfig();
      const proxyURL = cfg.proxy?.url || 'http://localhost:3000';
      this.windyAPIService = new WindyAPIService(null, { proxyURL });
    }
  }

  /**
   * 获取天气数据
   * @param {Location} location - 位置对象
   * @param {boolean} forceRefresh - 是否强制刷新（忽略缓存）
   * @returns {Promise<WeatherData[]>} 天气数据数组
   */
  async fetchWeather(location, forceRefresh = false) {
    if (!this.windyAPIService) {
      throw new Error('API密钥未设置，请先配置API密钥');
    }

    if (!location || !location.isValid()) {
      throw new Error('无效的位置信息');
    }

    if (isManualTestLocation(location)) {
      const weatherData = generateManualTestWeatherData();
      this.currentWeatherData = weatherData;
      this.currentLocation = location;
      return weatherData;
    }

    // 检查缓存（如果不是强制刷新）
    if (!forceRefresh) {
      const cachedData = this.storageService.getCachedWeatherData(location);
      if (cachedData) {
        const cacheHasAerosolData = Array.isArray(cachedData)
          && cachedData.some(item => item?.aerosolOpticalDepth != null);

        if (cacheHasAerosolData) {
          console.log('[WeatherController] 使用缓存的天气数据');
          this.currentWeatherData = cachedData;
          this.currentLocation = location;
          return cachedData;
        }

        console.log('[WeatherController] 缓存缺少气溶胶数据，刷新天气数据');
      }
    }

    try {
      console.log('[WeatherController] 从 API 获取天气数据');
      const weatherData = await this.windyAPIService.fetchWeatherData(
        location.lat,
        location.lon
      );

      // 缓存数据
      this.storageService.cacheWeatherData(location, weatherData);

      this.currentWeatherData = weatherData;
      this.currentLocation = location;

      return weatherData;
    } catch (error) {
      console.error('[WeatherController] 获取天气数据失败:', error);
      throw error;
    }
  }

  /**
   * 更新天气显示
   * @param {WeatherData[]} weatherData - 天气数据数组
   * @param {Object} location - 位置对象（可选）
   */
  updateWeatherDisplay(weatherData, location = null) {
    if (!weatherData || weatherData.length === 0) {
      this.showError(this.i18n.t('weather.noData'));
      return;
    }

    // 数据源 badge
    const meta = weatherData.providerMeta;
    const badgeEl = document.getElementById('data-source-badge');
    if (badgeEl) {
      if (meta) {
        const modelText = {
          ecmwf_ifs025: 'ECMWF IFS 025',
          gfs_seamless: 'GFS Seamless',
          best_match: 'Best Match'
        }[meta.weatherModel] || meta.weatherModel || 'Open-Meteo';
        badgeEl.textContent = `📡 ${modelText}`;
        badgeEl.title = meta.cloudSource || `Open-Meteo ${modelText}`;
        badgeEl.style.color = 'var(--color-text-light)';
      } else {
        badgeEl.textContent = '📡 Open-Meteo';
        badgeEl.style.color = 'var(--color-text-light)';
      }
    }

    const currentWeather = this._getCurrentWeatherPoint(weatherData);

    // 更新位置
    const locationEl = document.getElementById('weather-location');
    if (locationEl) {
      locationEl.textContent = location?.name
        ? compactLocationName(location.name)
        : this.i18n.t('weather.currentLocation');
    }

    // 更新主要天气信息
    const tempMainEl = document.getElementById('current-temp-main');
    if (tempMainEl) {
      tempMainEl.textContent = this.getConvertedTemp(currentWeather.temp).toFixed(1);
    }

    // 更新温度单位
    const tempUnitEl = document.getElementById('current-temp-unit');
    if (tempUnitEl) {
      tempUnitEl.textContent = this.tempUnit === 'fahrenheit' ? '°F' : '°C';
    }

    // 更新天气图标
    const iconMainEl = document.getElementById('weather-icon-main');
    if (iconMainEl) {
      const icon = this._getWeatherIcon(currentWeather.cloudCover, 0);
      iconMainEl.innerHTML = icon;
    }

    // 更新天气描述
    const descEl = document.getElementById('weather-description');
    if (descEl) {
      const desc = this._getWeatherDescription(currentWeather.cloudCover, currentWeather.temp);
      descEl.textContent = desc;
    }

    // 更新详细信息网格
    const elements = {
      humidity: document.getElementById('current-humidity'),
      cloudCover: document.getElementById('current-cloud-cover'),
      windSpeed: document.getElementById('current-wind-speed'),
      windDirectionIcon: document.getElementById('current-wind-direction-icon'),
      windDirectionText: document.getElementById('current-wind-direction-text'),
      pressure: document.getElementById('current-pressure'),
      visibility: document.getElementById('current-visibility'),
      aerosol: document.getElementById('current-aerosol'),
      precipitation: document.getElementById('current-precipitation')
    };

    if (elements.humidity) {
      elements.humidity.textContent = currentWeather.humidity != null ? `${currentWeather.humidity.toFixed(0)}%` : '--';
    }
    if (elements.cloudCover) {
      elements.cloudCover.textContent = currentWeather.cloudCover != null ? `${currentWeather.cloudCover.toFixed(0)}%` : '--';
    }
    if (elements.windSpeed) {
      elements.windSpeed.textContent = this.formatWindSpeed(currentWeather.windSpeed);
    }
    const normalizedDirection = this._normalizeWindDirection(currentWeather.windDirection);
    if (elements.windDirectionIcon) {
      elements.windDirectionIcon.style.transform = `rotate(${this._getWindFlowDirection(normalizedDirection)}deg)`;
    }
    if (elements.windDirectionText) {
      elements.windDirectionText.textContent = this._getWindDirectionLabel(normalizedDirection);
    }
    if (elements.pressure) {
      elements.pressure.textContent = currentWeather.pressure != null ? `${currentWeather.pressure.toFixed(0)} hPa` : '--';
    }
    if (elements.visibility) {
      elements.visibility.textContent = currentWeather.visibility != null ? `${currentWeather.visibility.toFixed(1)} km` : '--';
    }
    if (elements.aerosol) {
      const aerosol = this._getDisplayAerosolOpticalDepth(weatherData, currentWeather);
      elements.aerosol.textContent = aerosol.value != null
        ? `${aerosol.isFallback ? '≈' : ''}${Number(aerosol.value).toFixed(2)}`
        : '--';
      elements.aerosol.title = aerosol.value != null
        ? `AOD ${Number(aerosol.value).toFixed(2)}${aerosol.isFallback ? ' · 当前小时缺少 AOD，使用邻近时次数据' : ''}`
        : '';
    }
    if (elements.precipitation) {
      elements.precipitation.textContent = currentWeather.precipitation != null
        ? `${Number(currentWeather.precipitation).toFixed(1)} mm`
        : '--';
    }

    // 显示天气数据容器
    const weatherDataContainer = document.getElementById('weather-data');
    if (weatherDataContainer) {
      weatherDataContainer.classList.remove('hidden');
      weatherDataContainer.style.display = 'block';
    }

    // 显示天气部分
    const weatherSection = document.getElementById('weather-section');
    if (weatherSection) {
      weatherSection.classList.remove('hidden');
    }

    // 需求11：自动渲染7天概览（默认视图）
    this.renderWeeklyOverview(weatherData);

    // 任务18.3.1：位置联动 - 更新地图位置
    if (location && this.windyMapService && this.isMapInitialized) {
      this.windyMapService.moveTo(location.lat, location.lon);
      console.log('[WeatherController] 地图已移动到:', location.name);
    }

    console.log('[WeatherController] 天气显示已更新');
  }

  /**
   * 显示错误消息
   * @param {string} message - 错误消息
   */
  showError(message) {
    const errorElement = document.getElementById('weather-error');
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = 'block';

      // 3秒后自动隐藏
      setTimeout(() => {
        errorElement.style.display = 'none';
      }, 3000);
    }
  }

  /**
   * 获取当前天气数据
   * @returns {WeatherData[]} 当前天气数据
   */
  getCurrentWeatherData() {
    return this.currentWeatherData;
  }

  _getCurrentWeatherPoint(weatherData, now = Date.now()) {
    if (!Array.isArray(weatherData) || weatherData.length === 0) {
      return null;
    }

    const nowMs = Number(now);
    if (!Number.isFinite(nowMs)) {
      return weatherData[0];
    }

    return weatherData.reduce((best, item) => {
      const timestamp = Number(item?.timestamp);
      if (!Number.isFinite(timestamp)) {
        return best;
      }

      const bestTimestamp = Number(best?.timestamp);
      if (!Number.isFinite(bestTimestamp)) {
        return item;
      }

      const diff = Math.abs(timestamp - nowMs);
      const bestDiff = Math.abs(bestTimestamp - nowMs);
      if (diff < bestDiff) return item;
      if (diff === bestDiff && timestamp <= nowMs && bestTimestamp > nowMs) return item;
      return best;
    }, weatherData[0]);
  }

  _getDisplayAerosolOpticalDepth(weatherData, currentWeather, now = Date.now()) {
    const directValue = this._pickAerosolOpticalDepth(currentWeather);
    if (directValue != null) return { value: directValue, isFallback: false };

    if (!Array.isArray(weatherData) || weatherData.length === 0) {
      return { value: null, isFallback: false };
    }

    const targetTime = Number.isFinite(Number(currentWeather?.timestamp))
      ? Number(currentWeather.timestamp)
      : Number(now);

    let best = null;
    let bestDiff = Infinity;
    for (const item of weatherData) {
      const value = this._pickAerosolOpticalDepth(item);
      if (value == null) continue;

      const timestamp = Number(item?.timestamp);
      const diff = Number.isFinite(timestamp) && Number.isFinite(targetTime)
        ? Math.abs(timestamp - targetTime)
        : 0;
      if (diff < bestDiff) {
        best = value;
        bestDiff = diff;
      }
    }

    return { value: best, isFallback: best != null };
  }

  _pickAerosolOpticalDepth(weatherPoint) {
    const value = weatherPoint?.aerosolOpticalDepth
      ?? weatherPoint?.aod
      ?? weatherPoint?.aerosol_optical_depth;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  /**
   * 获取当前位置
   * @returns {Location} 当前位置
   */
  getCurrentLocation() {
    return this.currentLocation;
  }

  // ========== 需求11：天气界面优化方法 ==========

  /**
   * 渲染7天概览
   * @param {WeatherData[]} weatherData - 天气数据数组（168小时）
   */
  renderWeeklyOverview(weatherData) {
    if (!weatherData || weatherData.length === 0) {
      console.error('[WeatherController] 没有天气数据可显示');
      return;
    }

    const weeklyCards = document.getElementById('weekly-cards');
    if (!weeklyCards) {
      console.error('[WeatherController] 找不到 #weekly-cards 容器');
      return;
    }

    // 清空现有内容
    weeklyCards.innerHTML = '';

    // 按日历日期分组数据（基于时间戳，兼容任意时间间隔）
    const dayMap = new Map();
    for (const dataPoint of weatherData) {
      const date = new Date(dataPoint.timestamp);
      const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, []);
      }
      dayMap.get(dateKey).push(dataPoint);
    }
    const dailyData = Array.from(dayMap.values()).slice(0, 7);

    // 为每一天创建卡片
    dailyData.forEach((dayData, index) => {
      const card = this._createDayCard(dayData, index);
      weeklyCards.appendChild(card);
    });

    // 更新概览按钮标题，反映实际天数
    const overviewBtn = document.getElementById('overview-btn');
    if (overviewBtn) {
      overviewBtn.textContent = this.i18n.t('weather.daysOverview', { days: dailyData.length });
    }

    console.log(`[WeatherController] 渲染了 ${dailyData.length} 天的概览`);
  }

  /**
   * 创建单日天气卡片
   * @param {WeatherData[]} dayData - 一天的天气数据
   * @param {number} dayIndex - 天数索引（0=今天，1=明天，等等）
   * @returns {HTMLElement} 卡片元素
   */
  _formatDayOfMonthLabel(date, locale) {
    const rawDay = new Intl.DateTimeFormat(locale, { day: 'numeric' }).format(date).trim();

    if (locale.startsWith('zh')) {
      return rawDay.endsWith('日') ? rawDay : `${rawDay}日`;
    }

    if (locale.startsWith('en')) {
      const dayNum = Number.parseInt(rawDay, 10);
      if (Number.isNaN(dayNum)) return rawDay;

      const mod100 = dayNum % 100;
      const suffix = (mod100 >= 11 && mod100 <= 13)
        ? 'TH'
        : ({ 1: 'ST', 2: 'ND', 3: 'RD' }[dayNum % 10] || 'TH');

      return `${dayNum}${suffix}`;
    }

    return rawDay;
  }

  _createDayCard(dayData, dayIndex) {
    const card = document.createElement('div');
    card.className = 'day-card';

    // 计算日期
    const date = new Date(dayData[0].timestamp);

    // 使用i18n翻译日期标签
    const locale = this.i18n?.currentLanguage || 'zh-CN';
    const dayOfMonthLabel = this._formatDayOfMonthLabel(date, locale);

    let dayPrefix;
    if (dayIndex === 0) {
      dayPrefix = this.i18n.t('time.today');
    } else if (dayIndex === 1) {
      dayPrefix = this.i18n.t('time.tomorrow');
    } else {
      dayPrefix = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date);
    }

    const dayDateLabel = `(${dayOfMonthLabel})`;

    // 计算最高/最低温度
    const temps = dayData.map(d => d.temp);
    const maxTemp = Math.max(...temps);
    const minTemp = Math.min(...temps);

    // 计算平均云量（用于天气图标）
    const avgCloudCover = dayData.reduce((sum, d) => sum + d.cloudCover, 0) / dayData.length;

    // 计算降水概率（假设降水量>0.1mm表示有降水）
    const precipCount = dayData.filter(d => d.precipitation > 0.1).length;
    const precipProb = Math.round((precipCount / dayData.length) * 100);

    const maxWindSpeed = Math.max(...dayData.map(d => d.windSpeed ?? 0));
    const avgWindDirection = dayData.reduce((sum, d) => sum + this._normalizeWindDirection(d.windDirection), 0) / dayData.length;
    const avgWindFlowDirection = this._getWindFlowDirection(avgWindDirection);

    // 选择天气图标
    const weatherIcon = this._getWeatherIcon(avgCloudCover, precipProb);

    const directionLabel = this._getWindDirectionLabel(avgWindDirection);

    // UI 精修 64.11.5：预报卡重排（图标化横排 + 温度相对条）
    card.innerHTML = `
      <div class="day-label" aria-label="${dayPrefix} ${dayDateLabel}">
        <span class="day-label-primary">${dayPrefix}</span>
        <span class="day-label-date">${dayDateLabel}</span>
      </div>
      <div class="weather-icon">${weatherIcon}</div>
      <div class="temp-range-inline" aria-label="温度范围：${minTemp.toFixed(0)}°C 至 ${maxTemp.toFixed(0)}°C">
        <span class="min-temp">${minTemp.toFixed(0)}°</span>
        <span class="temp-range-sep">~</span>
        <span class="max-temp">${maxTemp.toFixed(0)}°</span>
      </div>
      <div class="day-meta-inline" role="list" aria-label="天气详细信息">
        <div class="day-meta-chip day-meta-precip" role="listitem" aria-label="降水概率：${precipProb}%">
          <span class="icon day-meta-svg-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3.5 6.8 10.2a6.4 6.4 0 1 0 10.4 0L12 3.5Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.2 16.2c.65 1.15 1.58 1.78 2.8 1.78" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></span>
          <span class="value">${precipProb}%</span>
        </div>
        <div class="day-meta-chip day-meta-wind" role="listitem" aria-label="风速：${this.formatWindSpeed(maxWindSpeed)}，风向：${directionLabel}">
          <span class="icon day-meta-svg-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 8h11.5a2.5 2.5 0 1 0-2.5-2.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M3 12h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M3 16h12.5a2.5 2.5 0 1 1-2.5 2.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></span>
          <span class="value">${this.formatWindSpeed(maxWindSpeed)}</span>
          <span class="icon day-wind-direction-icon" style="transform: rotate(${avgWindFlowDirection.toFixed(0)}deg);" aria-hidden="true">↑</span>
        </div>
      </div>
    `;

    // 点击卡片切换到详细视图
    card.addEventListener('click', () => {
      this.selectedDay = dayIndex === 0 ? 'today' : 'tomorrow';
      this.switchView('hourly');
    });

    return card;
  }


  /**
   * 规范化风向角度，确保在0-360度区间内
   * @param {number} direction - 风向角度
   * @returns {number} 规范化角度
   */
  _normalizeWindDirection(direction) {
    if (!Number.isFinite(direction)) {
      return 0;
    }

    const normalized = direction % 360;
    return normalized >= 0 ? normalized : normalized + 360;
  }


  /**
   * 将角度映射为八方位编码
   * @param {number} direction - 风向角度
   * @returns {string} 方位编码
   */
  _getWindDirectionCode(direction) {
    const normalized = this._normalizeWindDirection(direction);
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(normalized / 45) % directions.length;
    return directions[index];
  }

  _getWindFlowDirection(direction) {
    return (this._normalizeWindDirection(direction) + 180) % 360;
  }

  /**
   * 获取风向文字
   * @param {number} direction - 风向角度
   * @returns {string} 风向文字
   */
  _getWindDirectionLabel(direction) {
    const directionCode = this._getWindDirectionCode(direction);
    const key = `surrounding.directions.${directionCode}`;
    return this.i18n?.t ? this.i18n.t(key) : directionCode;
  }

  _t(key, fallback = '') {
    if (this.i18n?.t) {
      const translated = this.i18n.t(key);
      if (translated && translated !== key) return translated;
    }
    return fallback;
  }

  _formatTemplate(template, values = {}) {
    return String(template).replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? '');
  }

  /**
   * 获取天气图标
   * @param {number} cloudCover - 云量百分比
   * @param {number} precipProb - 降水概率
   * @returns {string} 图标emoji
   */
  _getWeatherIcon(cloudCover, precipProb) {
    const type = precipProb > 50
      ? 'rain'
      : cloudCover > 70
        ? 'cloud'
        : cloudCover > 30
          ? 'partly-cloudy'
          : 'sunny';
    return this._renderWeatherSvgIcon(type);
  }

  _renderWeatherSvgIcon(type) {
    const sun = '<circle class="weather-svg-sun" cx="12" cy="12" r="4.4"/><path class="weather-svg-ray" d="M12 2.6v2.1M12 19.3v2.1M4.9 4.9l1.5 1.5M17.6 17.6l1.5 1.5M2.6 12h2.1M19.3 12h2.1M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5"/>';
    const cloud = '<path class="weather-svg-cloud" d="M7.2 17.4h9.2a4.1 4.1 0 0 0 .4-8.2 5.3 5.3 0 0 0-10.1 1.5 3.4 3.4 0 0 0 .5 6.7Z"/>';
    const rain = '<path class="weather-svg-rain" d="M8.2 20.4l1.1-2.1M12 21l1.1-2.1M15.8 20.4l1.1-2.1"/>';

    const body = type === 'sunny'
      ? sun
      : type === 'cloud'
        ? cloud
        : type === 'rain'
          ? `${cloud}${rain}`
          : `<g transform="translate(-2 -2) scale(.82)">${sun}</g><g transform="translate(2 1)">${cloud}</g>`;

    return `<svg class="weather-icon-svg weather-icon-${type}" viewBox="0 0 24 24" role="img" aria-label="weather icon" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
  }

  /**
   * 获取天气描述
   * @param {number} cloudCover - 云量百分比
   * @param {number} temp - 温度
   * @returns {string} 天气描述
   */
  _getWeatherDescription(cloudCover, temp) {
    if (cloudCover > 70) return this.i18n.t('weather.overcast');
    if (cloudCover > 30) return this.i18n.t('weather.cloudy');
    if (cloudCover > 10) return this.i18n.t('weather.partlyCloudy');
    return this.i18n.t('weather.clear');
  }

  /**
   * 渲染24小时详细预报
   * @param {WeatherData[]} weatherData - 天气数据数组
   * @param {string} day - 'today' 或 'tomorrow'
   */
  renderHourlyForecast(weatherData, day) {
    if (!weatherData || weatherData.length === 0) {
      console.error('[WeatherController] 没有天气数据可显示');
      return;
    }

    // 根据选择的日期提取并重采样为连续24小时数据
    const hourlyData = this.buildContinuous24HourData(weatherData, day);

    if (hourlyData.length === 0) {
      console.error('[WeatherController] 没有足够的数据显示24小时预报');
      return;
    }

    // 根据选择的参数渲染对应图表
    this.chartRenderController.renderParameterChart(hourlyData, this.selectedParameter, this.chartService);

    console.log(`[WeatherController] 渲染了 ${day} 的 ${this.selectedParameter} 图表`);
  }

  /**
   * 构建连续的24小时数据（按时间排序 + 必要时线性插值）
   * 兼容后端返回 1h / 3h 间隔数据，避免曲线出现异常跳变
   * @param {WeatherData[]} weatherData - 原始天气数据
   * @param {string} day - 'today' 或 'tomorrow'
   * @returns {Array<Object>} 24条按小时连续的数据
   */
  buildContinuous24HourData(weatherData, day) {
    if (!Array.isArray(weatherData) || weatherData.length === 0) {
      return [];
    }

    const oneHourMs = 60 * 60 * 1000;
    const numericFields = [
      'temp', 'humidity', 'cloudCover', 'windSpeed', 'pressure',
      'visibility', 'lowClouds', 'precipitation', 'windDirection', 'highClouds', 'midClouds'
    ];

    // 先按时间升序，避免后端或缓存返回乱序数据导致折线"来回跳”
    const sorted = [...weatherData]
      .filter(item => item && Number.isFinite(item.timestamp))
      .sort((a, b) => a.timestamp - b.timestamp);

    if (sorted.length === 0) {
      return [];
    }

    // 修复：24小时图必须从“当前小时”起算，而不是固定切片
    // today: 从当前小时开始 24h；tomorrow: 从当前小时+24h 开始 24h
    const now = Date.now();
    const currentHourStart = Math.floor(now / oneHourMs) * oneHourMs;
    const targetStart = day === 'tomorrow'
      ? currentHourStart + (24 * oneHourMs)
      : currentHourStart;

    const hourlyData = [];
    for (let i = 0; i < 24; i++) {
      const targetTs = targetStart + (i * oneHourMs);
      const interpolated = this.interpolateWeatherPoint(sorted, targetTs, numericFields);
      interpolated.timestamp = targetTs;
      // 透传时区元信息供图表按目标城市时区显示
      if (sorted[0]?.timezone) {
        interpolated.timezone = sorted[0].timezone;
      }
      hourlyData.push(interpolated);
    }

    return hourlyData;
  }

  /**
   * 对目标时间做线性插值，获取平滑天气点
   * @param {WeatherData[]} sortedData - 已按时间升序数据
   * @param {number} targetTs - 目标时间戳
   * @param {string[]} numericFields - 需要插值的数值字段
   * @returns {Object} 插值后的天气点
   */
  interpolateWeatherPoint(sortedData, targetTs, numericFields) {
    if (sortedData.length === 1) {
      return { ...sortedData[0] };
    }

    let left = sortedData[0];
    let right = sortedData[sortedData.length - 1];

    for (let i = 0; i < sortedData.length; i++) {
      if (sortedData[i].timestamp <= targetTs) {
        left = sortedData[i];
      }
      if (sortedData[i].timestamp >= targetTs) {
        right = sortedData[i];
        break;
      }
    }

    if (left.timestamp === right.timestamp) {
      return { ...left };
    }

    const ratio = (targetTs - left.timestamp) / (right.timestamp - left.timestamp);
    const interpolated = { ...left };

    numericFields.forEach(field => {
      const leftValue = left[field];
      const rightValue = right[field];

      if (Number.isFinite(leftValue) && Number.isFinite(rightValue)) {
        interpolated[field] = leftValue + ((rightValue - leftValue) * ratio);
      }
    });

    return interpolated;
  }

  /**
   * 切换视图（概览/详细/3天朝晚霞/地图）
   * @param {string} view - 'overview', 'hourly', 'glow' 或 'map'
   */
  switchView(view) {
    this.currentView = view;

    const overviewView = document.getElementById('weekly-overview');
    const hourlyView = document.getElementById('hourly-forecast');
    const mapView = document.getElementById('map-forecast');
    const glowView = document.getElementById('three-day-glow');
    const overviewBtn = document.getElementById('overview-btn');
    const hourlyBtn = document.getElementById('hourly-btn');
    const glowBtn = document.getElementById('three-day-glow-btn');
    const mapBtn = document.getElementById('map-btn');

    // 隐藏所有视图
    if (overviewView) overviewView.classList.add('hidden');
    if (hourlyView) hourlyView.classList.add('hidden');
    if (mapView) mapView.classList.add('hidden');
    if (glowView) glowView.classList.add('hidden');

    // 移除所有按钮的active状态
    if (overviewBtn) overviewBtn.classList.remove('active');
    if (hourlyBtn) hourlyBtn.classList.remove('active');
    if (glowBtn) glowBtn.classList.remove('active');
    if (mapBtn) mapBtn.classList.remove('active');

    if (view === 'overview') {
      if (overviewView) overviewView.classList.remove('hidden');
      if (overviewBtn) overviewBtn.classList.add('active');

      // 渲染概览
      if (this.currentWeatherData) {
        this.renderWeeklyOverview(this.currentWeatherData);
      }
    } else if (view === 'hourly') {
      if (hourlyView) hourlyView.classList.remove('hidden');
      if (hourlyBtn) hourlyBtn.classList.add('active');

      // 渲染详细预报
      if (this.currentWeatherData) {
        this.renderHourlyForecast(this.currentWeatherData, this.selectedDay);
      }
    } else if (view === 'glow') {
      if (glowView) glowView.classList.remove('hidden');
      if (glowBtn) glowBtn.classList.add('active');

      const forecastTimeline = document.getElementById('forecast-timeline');
      const forecastLoading = document.getElementById('forecast-loading');
      if (forecastTimeline?.dataset.loaded !== 'true' && forecastLoading) {
        forecastLoading.classList.remove('hidden');
      }
    } else if (view === 'map') {
      // 任务18：切换到地图视图
      if (mapView) mapView.classList.remove('hidden');
      if (mapBtn) mapBtn.classList.add('active');

      // 初始化并显示地图
      this.initializeAndShowMap();
    }

    console.log(`[WeatherController] 切换到 ${view} 视图`);
  }

  /**
   * 任务18：初始化并显示地图
   */
  async initializeAndShowMap() {
    if (!this.windyMapService) {
      const mapError = document.getElementById('map-error');
      const mapLoading = document.getElementById('map-loading');
      if (mapLoading) mapLoading.classList.add('hidden');

      if (mapError) {
        mapError.textContent = this.i18n.t('errors.mockModeMapNotSupported') || '地图功能仅在真实API模式下可用。请配置有效的Windy API密钥。';
        mapError.classList.remove('hidden');
      }
      console.warn('[WeatherController] Windy地图服务未初始化（mock模式）');
      return;
    }

    if (this.isMapInitialized) {
      // 地图已初始化，移动到当前位置
      if (this.currentLocation) {
        this.windyMapService.moveTo(this.currentLocation.lat, this.currentLocation.lon, 8);
      }
      return;
    }

    const mapLoading = document.getElementById('map-loading');
    const mapError = document.getElementById('map-error');

    try {
      // 显示加载指示器
      if (mapLoading) mapLoading.classList.remove('hidden');
      if (mapError) mapError.classList.add('hidden');

      // 从后端获取地图专用的API Key
      let mapApiKey = this.windyMapService.apiKey; // 默认使用前端配置的key

      // 从后端获取地图API Key
      if (this.windyAPIService && this.windyAPIService.proxyURL) {
        try {
          console.log('[WeatherController] 从后端获取地图API Key...');
          const proxyURL = this.windyAPIService.proxyURL || 'http://localhost:3000';
          const response = await fetch(`${proxyURL}/api/config/map-key`);
          if (response.ok) {
            const data = await response.json();
            mapApiKey = data.mapKey;
            console.log('[WeatherController] 成功获取地图API Key');
            // 更新WindyMapService的API Key
            this.windyMapService.apiKey = mapApiKey;
          } else {
            console.warn('[WeatherController] 无法从后端获取地图API Key，使用前端配置的Key');
          }
        } catch (error) {
          console.warn('[WeatherController] 获取地图API Key失败，使用前端配置的Key:', error.message);
        }
      }

      // 初始化地图
      const mapOptions = {
        lat: this.currentLocation ? this.currentLocation.lat : 35.6762,
        lon: this.currentLocation ? this.currentLocation.lon : 139.6503,
        zoom: 6
      };

      await this.windyMapService.initializeMap('map-container', mapOptions);
      this.isMapInitialized = true;

      // 隐藏加载指示器
      if (mapLoading) mapLoading.classList.add('hidden');

      // 任务18.3.3：初始化时间显示
      const currentTime = this.windyMapService.getTimestamp();
      if (currentTime) {
        this.updateMapTimeDisplay(currentTime);
      }

      // 初始化后渲染默认图层（风速）
      this._renderWeatherLayerOnMap('wind');

      console.log('[WeatherController] 地图初始化成功');
    } catch (error) {
      console.error('[WeatherController] 地图初始化失败:', error);

      // 隐藏加载指示器，显示错误
      if (mapLoading) mapLoading.classList.add('hidden');
      if (mapError) {
        mapError.textContent = this.i18n.t('errors.mapInitFailed', { error: error.message }) || `地图加载失败: ${error.message}`;
        mapError.classList.remove('hidden');
      }
    }
  }

  /**
   * 切换参数
   * @param {string} parameter - 参数类型
   */
  switchParameter(parameter) {
    this.selectedParameter = parameter;

    // 更新按钮状态
    const buttons = document.querySelectorAll('.parameter-selector button');
    buttons.forEach(btn => {
      if (btn.dataset.param === parameter) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // 重新渲染图表
    if (this.currentWeatherData) {
      this.renderHourlyForecast(this.currentWeatherData, this.selectedDay);
    }

    console.log(`[WeatherController] 切换到 ${parameter} 参数`);
  }

  /**
   * 切换日期
   * @param {string} day - 'today' 或 'tomorrow'
   */
  switchDay(day) {
    this.selectedDay = day;

    // 更新按钮状态
    const todayBtn = document.getElementById('today-btn');
    const tomorrowBtn = document.getElementById('tomorrow-btn');

    if (day === 'today') {
      if (todayBtn) todayBtn.classList.add('active');
      if (tomorrowBtn) tomorrowBtn.classList.remove('active');
    } else {
      if (todayBtn) todayBtn.classList.remove('active');
      if (tomorrowBtn) tomorrowBtn.classList.add('active');
    }

    // 重新渲染图表
    if (this.currentWeatherData) {
      this.renderHourlyForecast(this.currentWeatherData, day);
    }

    console.log(`[WeatherController] 切换到 ${day}`);
  }

  /**
   * 任务18.3.2：切换地图图层
   * @param {string} layer - 'wind', 'temp', 'clouds', 'rain'
   */
  switchMapLayer(layer) {
    // 更新按钮状态
    const layerButtons = document.querySelectorAll('.layer-btn');
    layerButtons.forEach(btn => {
      if (btn.dataset.layer === layer) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // 更改地图叠加层并渲染气象数据点
    if (this.windyMapService && this.isMapInitialized) {
      this.windyMapService.changeOverlay(layer);
      this._renderWeatherLayerOnMap(layer);
      console.log(`[WeatherController] 地图图层已切换到: ${layer}`);
    } else {
      console.log(`[WeatherController] 地图未初始化，无法切换图层`);
    }
  }

  /**
   * 使用现有天气数据在地图上渲染气象数据点
   * @param {string} layer - 'wind', 'temp', 'clouds', 'rain'
   * @private
   */
  _renderWeatherLayerOnMap(layer) {
    if (!this.windyMapService || !this.isMapInitialized) return;

    const dataPoints = [];

    // 图层参数配置：{ key, unit, min, max, label }
    const layerConfig = {
      wind: { key: 'windSpeed', unit: 'km/h', min: 0, max: 80 },
      temp: { key: 'temp', unit: '°C', min: -10, max: 40 },
      clouds: { key: 'cloudCover', unit: '%', min: 0, max: 100 },
      rain: { key: 'precipitation', unit: 'mm', min: 0, max: 20 }
    };

    const cfg = layerConfig[layer];
    if (!cfg) return;

    // 添加中心位置数据点（使用当前天气数据的第一条）
    const centerWeather = Array.isArray(this.currentWeatherData)
      ? this.currentWeatherData[0]
      : this.currentWeatherData;

    if (centerWeather && this.currentLocation) {
      const value = centerWeather[cfg.key] || 0;
      dataPoints.push({
        lat: this.currentLocation.lat,
        lon: this.currentLocation.lon,
        value,
        label: `📍 ${this.currentLocation.name || ''}<br>${value.toFixed(1)} ${cfg.unit}`
      });
    }

    // 添加周边点数据（如果已有周边数据）
    if (this.surroundingData && this.surroundingData.points) {
      this.surroundingData.points.forEach(point => {
        if (point.weatherData && !point.error) {
          const value = point.weatherData[cfg.key] || 0;
          dataPoints.push({
            lat: point.lat,
            lon: point.lon,
            value,
            label: `${point.name}<br>${value.toFixed(1)} ${cfg.unit}`
          });
        }
      });
    }

    if (dataPoints.length === 0) {
      console.log('[WeatherController] 暂无可用气象数据点，图层无法渲染');
      return;
    }

    this.windyMapService.showWeatherDataLayer(dataPoints, layer, {
      min: cfg.min,
      max: cfg.max
    });
  }

  /**
   * 任务18.3.3：设置地图时间到现在
   */
  setMapTimeToNow() {
    if (!this.windyMapService || !this.isMapInitialized) {
      console.log('[WeatherController] 地图未初始化，无法设置时间');
      return;
    }

    const now = Date.now();
    this.windyMapService.setTimestamp(now);
    this.updateMapTimeDisplay(now);
    console.log('[WeatherController] 地图时间已设置为现在');
  }

  /**
   * 任务18.3.3：设置地图时间到日落
   */
  setMapTimeToSunset() {
    if (!this.windyMapService || !this.isMapInitialized) {
      console.log('[WeatherController] 地图未初始化，无法设置时间');
      return;
    }

    // 从当前天气数据中获取日落时间
    if (!this.currentWeatherData || !this.currentWeatherData.sunset) {
      this.showError('无法获取日落时间数据');
      return;
    }

    const sunsetTime = new Date(this.currentWeatherData.sunset).getTime();
    this.windyMapService.setTimestamp(sunsetTime);
    this.updateMapTimeDisplay(sunsetTime);
    console.log('[WeatherController] 地图时间已设置为日:', this.currentWeatherData.sunset);
  }

  /**
   * 任务18.3.3：设置地图时间到日出
   */
  setMapTimeToSunrise() {
    if (!this.windyMapService || !this.isMapInitialized) {
      console.log('[WeatherController] 地图未初始化，无法设置时间');
      return;
    }

    // 从当前天气数据中获取日出时间
    if (!this.currentWeatherData || !this.currentWeatherData.sunrise) {
      this.showError('无法获取日出时间数据');
      return;
    }

    const sunriseTime = new Date(this.currentWeatherData.sunrise).getTime();
    this.windyMapService.setTimestamp(sunriseTime);
    this.updateMapTimeDisplay(sunriseTime);
    console.log('[WeatherController] 地图时间已设置为日出:', this.currentWeatherData.sunrise);
  }

  /**
   * 任务18.3.3：更新地图时间显示
   * @param {number} timestamp - Unix时间戳（毫秒）
   */
  updateMapTimeDisplay(timestamp) {
    const timeDisplay = document.getElementById('map-current-time');
    if (timeDisplay) {
      const date = new Date(timestamp);
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      timeDisplay.textContent = `${hours}:${minutes}`;
    }
  }

  /**
   * 刷新界面文本（语言切换后）
   * 需求：14 - 多语言支持
   */
  refreshUIText() {
    console.log('[WeatherController] 刷新界面文本...');

    // 更新天气区域标题
    const weatherSection = document.getElementById('weather-section');
    if (weatherSection) {
      const title = weatherSection.querySelector('h2');
      if (title) title.textContent = this.i18n.t('weather.title');
    }

    // 更新"使用当前位置"按钮提示
    const currentLocationBtn = document.getElementById('current-location-btn');
    if (currentLocationBtn) {
      currentLocationBtn.setAttribute('aria-label', this.i18n.t('buttons.useCurrentLocation'));
    }

    // 更新"搜索"按钮
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) {
      searchBtn.textContent = this.i18n.t('buttons.search');
    }

    // 更新位置输入框占位符
    const locationInput = document.getElementById('location-input');
    if (locationInput) {
      locationInput.placeholder = this.i18n.t('location.placeholder');
    }

    // 更新视图切换按钮
    const overviewBtn = document.getElementById('overview-btn');
    if (overviewBtn) {
      overviewBtn.textContent = this.i18n.t('charts.overview');
    }

    const hourlyBtn = document.getElementById('hourly-btn');
    if (hourlyBtn) {
      hourlyBtn.textContent = this.i18n.t('charts.hourly');
    }

    const glowBtn = document.getElementById('three-day-glow-btn');
    if (glowBtn) {
      glowBtn.textContent = this.i18n.t('weather.threeDayGlow');
    }

    this.chartService = this.chartRenderController.createChartService(this.tempUnit, this.windUnit);

    // 如果有当前天气数据，重新渲染以更新格式化的日期/时间
    if (this.currentWeatherData) {
      // 根据当前视图重新渲染
      if (this.currentView === 'hourly') {
        // 重新渲染24小时图表
        this.renderHourlyForecast(this.currentWeatherData, this.selectedDay);
      } else if (this.currentView === 'glow') {
        this.switchView('glow');
      } else {
        // 重新渲染概览
        this.renderWeeklyOverview(this.currentWeatherData);
      }
    }
  }

  /**
   * 更新温度单位
   * @param {string} unit - 新的温度单位 ('celsius' | 'fahrenheit')
   */
  updateTemperatureUnit(unit) {
    if (!['celsius', 'fahrenheit'].includes(unit)) {
      console.warn('[WeatherController] Invalid temperature unit:', unit);
      return;
    }

    this.tempUnit = unit;
    localStorage.setItem('temp_unit', unit);

    // 如果有当前天气数据，重新渲染显示
    if (this.currentWeatherData) {
      this.updateWeatherDisplay(this.currentWeatherData, this.currentLocation);
    }
  }

  /**
   * 更新风速单位
   * @param {string} unit - 新的风速单位 ('kmh' | 'ms')
   */
  updateWindUnit(unit) {
    if (!['kmh', 'ms'].includes(unit)) {
      console.warn('[WeatherController] Invalid wind speed unit:', unit);
      return;
    }

    this.windUnit = unit;
    localStorage.setItem('wind_unit', unit);

    // 如果有当前天气数据，重新渲染显示
    if (this.currentWeatherData) {
      this.updateWeatherDisplay(this.currentWeatherData, this.currentLocation);
    }
  }

  /**
   * 获取转换后的温度值
   * @param {number} temp - 原始温度值（摄氏度）
   * @returns {number} 转换后的温度值
   */
  getConvertedTemp(temp) {
    if (this.tempUnit === 'fahrenheit') {
      return UnitConverter.celsiusToFahrenheit(temp, 1);
    }
    return temp;
  }

  /**
   * 获取转换后的风速值
   * @param {number} windSpeed - 原始风速值（公里/小时）
   * @returns {number} 转换后的风速值
   */
  getConvertedWindSpeed(windSpeed) {
    if (this.windUnit === 'ms') {
      return UnitConverter.kmhToMs(windSpeed, 1);
    }
    return windSpeed;
  }

  /**
   * 格式化温度显示（带单位）
   * @param {number} temp - 温度值
   * @returns {string} 格式化后的温度字符串
   */
  formatTemperature(temp) {
    return UnitConverter.formatTemperature(this.getConvertedTemp(temp), this.tempUnit, 1);
  }

  /**
   * 格式化风速显示（带单位）
   * @param {number} windSpeed - 风速值
   * @returns {string} 格式化后的风速字符串
   */
  formatWindSpeed(windSpeed) {
    return UnitConverter.formatWindSpeed(this.getConvertedWindSpeed(windSpeed), this.windUnit, 1);
  }

  // ========== Phase 18：周边火烧云雷达罗盘 ==========

  /**
   * Phase 18：渲染雷达罗盘（需求19 v2）
   */
  async renderRadarCompass(location, predictionType = null) {
    if (!Number.isFinite(location?.lat) || !Number.isFinite(location?.lon)) return;

    const containerId = predictionType
      ? `radar-compass-${predictionType}`
      : 'radar-compass-container';

    // 语言切换后预测卡片会重建，容器可能稍后才出现，增加容器等待重试
    let container = null;
    for (let i = 0; i < 10; i += 1) {
      container = document.getElementById(containerId);
      if (container) break;
      // 指数退避，避免紧循环
      const waitMs = 80 + i * 40;
      // eslint-disable-next-line no-await-in-loop
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }

    if (!container) {
      console.warn(`[WeatherController] 雷达容器不存在: ${containerId}`);
      return;
    }

    container.style.display = 'block';
    {
      const loadingText = this.i18n?.t?.('surrounding.loading') || 'Loading surrounding weather data...';
      container.innerHTML = `
        <div class="radar-compass-loading" role="status" aria-live="polite">
          <div class="spinner radar-compass-loading-spinner" aria-hidden="true"></div>
          <div class="radar-compass-loading-copy">
            <p>${loadingText}</p>
            <div class="loading-progress radar-compass-loading-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="64">
              <div class="loading-progress-fill radar-compass-progress-fill"></div>
            </div>
          </div>
        </div>
      `;
    }

    try {
      let dirs;
      let sunAzimuths = {};
      const radius = 50; // 后端仅接受 50/100/150
      const now = new Date();
      const type = predictionType || (now.getHours() < 12 ? 'sunrise' : 'sunset');
      const radarDate = getNextRadarEventDate(location, type, now);

      if (isManualTestLocation(location)) {
        const manualRadar = generateManualTestRadarData(type);
        this._radarCompass.render(container, { directions: manualRadar.dirs, sunAzimuths: manualRadar.sunAzimuths, predictionType: type });
        return;
      }

      // 优先后端聚合 API（POST /api/prediction/surrounding）
      if (this.predictionAPIService) {
        try {
          const data = await this.predictionAPIService.getSurrounding(
            location.lat,
            location.lon,
            radius,
            type,
            radarDate
          );
          dirs = this._convertSurroundingToRadarDirs(data);
          sunAzimuths = data.sunAzimuths || {};
        } catch (apiError) {
          console.warn('[WeatherController] 后端周边API失败，回退前端逐点请求:', apiError.message);
          dirs = await this._fetchRadarDirsFrontend(location, radius, type, radarDate);
        }
      } else {
        dirs = await this._fetchRadarDirsFrontend(location, radius, type, radarDate);
      }

      this._radarCompass.render(container, { directions: dirs, sunAzimuths, predictionType: type });
    } catch (err) {
      console.error('[WeatherController] 雷达罗盘渲染失败:', err);
      // 不要直接隐藏容器，避免用户误认为功能消失
      container.style.display = 'block';
      container.innerHTML = `<p style="text-align:center;color:var(--color-text-light);font-size:13px;padding:12px 0;">雷达加载超时，稍后自动重试</p>`;
    }
  }

  _convertSurroundingToRadarDirs(json) {
    const L = { N:'北', NE:'东北', E:'东', SE:'东南', S:'南', SW:'西南', W:'西', NW:'西北' };
    return (json.points || json.directions || []).map(p => ({
      dir: p.direction || p.dir,
      label: L[p.direction || p.dir] || (p.direction || p.dir),
      score: Math.round(p.score || p.prediction?.score || 0),
      dist: p.distance || 50,
      cloudLayers: p.cloudLayers || {
        low: p.weatherData?.lowClouds ?? null,
        mid: p.weatherData?.midClouds ?? null,
        high: p.weatherData?.highClouds ?? null,
        cloudBaseHeight: p.weatherData?.cloudBaseHeight ?? null
      }
    }));
  }

  async _fetchRadarDirsFrontend(location, radius = 20, type = 'sunset', date = new Date()) {
    const LABEL = { N:'北', NE:'东北', E:'东', SE:'东南', S:'南', SW:'西南', W:'西', NW:'西北' };
    const base = window._appConfig?.proxyURL || '';
    try {
      // 用后端聚合接口，一次请求返回 8 方向，避免触发 rate limit
      const dateParam = encodeURIComponent(date instanceof Date ? date.toISOString() : String(date));
      const res = await fetch(
        `${base}/api/prediction/directions?lat=${location.lat.toFixed(4)}&lon=${location.lon.toFixed(4)}&type=${type}&radius=${radius}&date=${dateParam}`,
        { signal: AbortSignal.timeout(15000) }
      );
      const json = res.ok ? await res.json() : {};
      if (json.success && Array.isArray(json.data?.directions)) {
        return json.data.directions.map(d => ({
          dir: d.dir,
          label: LABEL[d.dir] || d.dir,
          score: d.score || 0,
          dist: radius,
          cloudLayers: d.cloudLayers || { low: 0, mid: 0, high: 0 }
        }));
      }
    } catch (err) {
      console.warn('[WeatherController] /api/prediction/directions 失败:', err.message);
    }
    // 全部失败时返回空数据
    return Object.keys(LABEL).map(dir => ({ dir, label: LABEL[dir], score: 0, dist: radius, cloudLayers: { low: 0, mid: 0, high: 0 } }));
  }

  /**
   * 任务19（旧）：保留签名避免运行时报错
   * @deprecated 使用 renderRadarCompass 替代
   */
  async fetchSurroundingData(location, radius = this.surroundingRadius) {
    if (!location || !location.lat || !location.lon) {
      console.warn('[WeatherController] 无效的位置，无法获取周边数据');
      return;
    }

    console.log(`[WeatherController] 获取周边火烧云数据，半径: ${radius}km, 使用后端API: ${this.useBackendSurrounding}`);

    // 显示section和加载状态
    const sectionEl = document.getElementById('surrounding-section');
    const loadingEl = document.getElementById('surrounding-loading');
    const errorEl = document.getElementById('surrounding-error');
    const contentEl = document.getElementById('surrounding-content');

    if (sectionEl) sectionEl.classList.remove('hidden');
    if (loadingEl) loadingEl.classList.remove('hidden');
    if (errorEl) errorEl.classList.add('hidden');
    if (contentEl) contentEl.style.display = 'none';

    try {
      let data;

      // 需求22 Phase 2：根据配置选择前端或后端实现，后端失败时自动回退
      if (this.useBackendSurrounding && this.predictionAPIService) {
        try {
          // 优先调用后端 API
          data = await this.predictionAPIService.getSurrounding(
            location.lat,
            location.lon,
            radius,
            'sunset', // 默认晚霞，可根据当前时间调整
            new Date()
          );

          // 转换数据格式以匹配前端期望的结构
          data = this._convertBackendSurroundingData(data, location);
        } catch (backendError) {
          console.warn('[WeatherController] 后端周边预测 API 不可用，回退到前端实现:', backendError.message);
          data = await this._fetchSurroundingFrontend(location, radius);
        }
      } else {
        data = await this._fetchSurroundingFrontend(location, radius);
      }

      this.surroundingData = data;

      // 渲染雷达图
      this.renderSurroundingRadar(data);

      // 任务20：如果覆盖层已启用，生成并显示覆盖层
      if (this.fireCloudOverlayEnabled) {
        await this.updateFireCloudOverlay(location, data);
      }

      // 隐藏加载状态，显示内容
      if (loadingEl) loadingEl.classList.add('hidden');
      if (contentEl) contentEl.style.display = 'block';

      console.log('[WeatherController] 周边火烧云数据获取完成');
    } catch (error) {
      console.error('[WeatherController] 获取周边火烧云数据失败:', error);

      if (loadingEl) loadingEl.classList.add('hidden');
      if (errorEl) {
        errorEl.textContent = this.i18n.t('surrounding.error') || error.message;
        errorEl.classList.remove('hidden');
      }
    } finally {
      // 无论周边数据获取成功或失败，都刷新地图气象数据标记，
      // 防止后端中断时地图保留上一个位置的过期圆圈。
      if (this.windyMapService && this.isMapInitialized) {
        const currentLayer = (this.windyMapService.currentOptions && this.windyMapService.currentOptions.overlay) || 'wind';
        this._renderWeatherLayerOnMap(currentLayer);
      }
    }
  }

  /**
   * 需求22 Phase 2：转换后端周边数据格式为前端期望的结构
   * @param {Object} backendData - 后端返回的数据
   * @param {Object} location - 当前位置对象
   * @returns {Object} 转换后的数据
   * @private
   */
  _convertBackendSurroundingData(backendData, location) {
    return {
      center: location,
      radius: backendData.radius,
      points: backendData.points.map(p => ({
        ...p,
        location: { lat: p.lat, lon: p.lon, name: p.name },
        weatherData: p.weatherData,
        prediction: p.prediction,
        score: p.score
      })),
      timestamp: backendData.timestamp
    };
  }

  /**
   * 前端实现的周边数据获取（后端不可用时的回退）
   * @param {Object} location - 位置对象
   * @param {number} radius - 半径（公里）
   * @returns {Promise<Object>} 周边数据
   * @private
   */
  async _fetchSurroundingFrontend(location, radius) {
    const { default: PredictionController } = await import('./PredictionController.js');
    const predictionController = new PredictionController(this.storageService);

    return await this.surroundingPointsService.getSurroundingData(
      location,
      radius,
      async (loc) => {
        // 使用不修改全局状态的私有方法，避免周边请求覆盖当前位置/天气数据
        const weatherData = await this._fetchWeatherWithoutMutation(loc);
        return this._getCurrentWeatherPoint(weatherData); // 返回当前天气数据
      },
      (weatherData) => {
        if (!weatherData) return null;
        return predictionController.predictionService.calculatePrediction(
          weatherData,
          new Date(),
          location.lat,
          location.lon
        );
      }
    );
  }


  /**
   * 获取指定位置的天气数据，不修改 this.currentWeatherData / this.currentLocation 全局状态。
   * 用于周边采样等需要并行获取多点天气但不应影响主状态的场景。
   * @param {Location} location - 位置对象
   * @returns {Promise<WeatherData[]>} 天气数据数组
   * @private
   */
  async _fetchWeatherWithoutMutation(location) {
    if (!this.windyAPIService) {
      throw new Error('API密钥未设置，请先配置API密钥');
    }

    if (!location || !location.isValid()) {
      throw new Error('无效的位置信息');
    }

    // 先查缓存（只读，不写入全局状态）
    const cachedData = this.storageService.getCachedWeatherData(location);
    if (cachedData) {
      return cachedData;
    }

    const weatherData = await this.windyAPIService.fetchWeatherData(
      location.lat,
      location.lon
    );

    // 写缓存，但不更新 this.currentWeatherData / this.currentLocation
    this.storageService.cacheWeatherData(location, weatherData);

    return weatherData;
  }

  /**
   * 任务19：渲染周边火烧云雷达图
   * @param {Object} data - 周边数据对象
   */
  renderSurroundingRadar(data) {
    if (!data || !data.points) {
      console.warn('[WeatherController] 无周边数据可渲染');
      return;
    }

    // 准备雷达图数据
    const points = data.points.map(p => ({
      label: p.label,
      name: p.name,
      distance: p.distance,
      score: p.score || 0
    }));

    // 渲染雷达图（传入容器ID而不是canvas ID）
    const success = this.radarChartService.renderRadarChart('radar-chart-container', points, {
      width: 280,
      height: 280,
      radius: 100,
      showLabels: true,
      showScores: true,
      showDistance: false,  // 紧凑模式下不显示距离
      onClick: (point, index) => this.handleSurroundingPointClick(point, index)
    });

    if (success) {
      // 显示推荐观赏方向
      this.renderBestDirections(data.points);
    }
  }

  /**
   * 任务19：渲染推荐观赏方向
   * @param {Object[]} points - 周边点数据数组
   */
  renderBestDirections(points) {
    const container = document.getElementById('best-directions-list');
    if (!container) return;

    // 筛选评分>=60的点
    const bestPoints = points.filter(p => p.score >= 60).sort((a, b) => b.score - a.score);

    if (bestPoints.length === 0) {
      container.innerHTML = `<p style="color: var(--color-text-light);">${this._t('weatherMap.surroundingFair', '当前周边区域火烧云观赏条件一般')}</p>`;
      return;
    }

    container.innerHTML = bestPoints.map((p, index) => {
      let qualityClass = '';
      let qualityText = '';

      if (p.score >= 80) {
        qualityClass = 'color: var(--color-excellent, var(--color-success));';
        qualityText = this._t('weatherMap.quality.excellent', '优秀');
      } else if (p.score >= 60) {
        qualityClass = 'color: var(--color-good, var(--color-warning));';
        qualityText = this._t('weatherMap.quality.good', '良好');
      }

      const scoreLabel = this._formatTemplate(this._t('weatherMap.scoreWithQuality', '{{score}}分 - {{quality}}'), {
        score: p.score,
        quality: qualityText
      });

      return `
        <div class="direction-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--color-border); cursor: pointer;" data-index="${index}">
          <span>${p.name} (${p.label})</span>
          <span style="${qualityClass} font-weight: 600;">${scoreLabel}</span>
        </div>
      `;
    }).join('');

    // 绑定点击事件
    container.querySelectorAll('.direction-item').forEach((item, index) => {
      item.addEventListener('click', () => {
        this.handleSurroundingPointClick(bestPoints[index], index);
      });
    });
  }

  /**
   * 任务19：处理周边点点击事件
   * @param {Object} point - 点击的点数据
   * @param {number} index - 点索引
   */
  handleSurroundingPointClick(point, index) {
    console.log('[WeatherController] 点击周边点:', point);

    // 可以在这里添加显示详细信息的功能
    // 例如：显示该方向的详细气象数据、观赏建议等
    toastService.show(this._formatTemplate(this._t('weatherMap.pointToast', '{{name}}方向｜评分: {{score}}分｜距离: {{distance}}公里'), {
      name: point.name,
      score: point.score,
      distance: point.distance
    }), 'info', 5000);
  }

  /**
   * 任务19：设置周边探测半径
   * @param {number} radius - 半径（公里）
   */
  setSurroundingRadius(radius) {
    this.surroundingRadius = radius;
    console.log(`[WeatherController] 周边半径已设置为: ${radius}km`);

    // 如果有当前位置，重新获取周边数据
    if (this.currentLocation) {
      this.fetchSurroundingData(this.currentLocation, radius);
    }
  }

  // ========== 任务20：火烧云覆盖层相关方法 ==========

  /**
   * 任务20：更新火烧云覆盖层
   * @param {Object} location - 中心位置
   * @param {Object} surroundingData - 周边数据（可选，如果未提供则使用当前数据）
   */
  async updateFireCloudOverlay(location, surroundingData = null) {
    if (!this.fireCloudOverlayEnabled) {
      console.log('[WeatherController] 覆盖层未启用，跳过更新');
      return;
    }

    const data = surroundingData || this.surroundingData;
    if (!data || !data.points) {
      console.warn('[WeatherController] 无周边数据，无法生成覆盖层');
      return;
    }

    try {
      console.log('[WeatherController] 更新火烧云覆盖层...');

      // 生成覆盖层
      const overlayData = await this.fireCloudOverlayService.generateOverlay(
        location,
        data.points,
        this.surroundingRadius * 2, // 覆盖层半径扩大到周边半径的2倍
        this.currentOverlayType
      );

      // 在地图上显示覆盖层
      const mapContainer = document.getElementById('map-container');
      if (mapContainer) {
        this.fireCloudOverlayService.displayOnMap(
          this.windyMapService,
          overlayData,
          mapContainer
        );
      }

      console.log('[WeatherController] 火烧云覆盖层更新完成');

      // 更新UI状态
      this.updateOverlayStatus(true);

    } catch (error) {
      console.error('[WeatherController] 更新覆盖层失败:', error);
      this.updateOverlayStatus(false, error.message);
    }
  }

  /**
   * 任务20：切换覆盖层开关
   * @param {boolean} enabled - 是否启用
   */
  async toggleFireCloudOverlay(enabled) {
    this.fireCloudOverlayEnabled = enabled;

    console.log(`[WeatherController] 覆盖层${enabled ? '启用' : '禁用'}`);

    if (enabled) {
      // 启用覆盖层：如果已有周边数据，立即生成并显示
      if (this.surroundingData && this.currentLocation) {
        await this.updateFireCloudOverlay(this.currentLocation);
      } else if (this.currentLocation) {
        // 没有周边数据，先获取周边数据
        await this.fetchSurroundingData(this.currentLocation, this.surroundingRadius);
      }
    } else {
      // 禁用覆盖层：移除现有覆盖层
      this.fireCloudOverlayService.removeOverlay();
    }
  }

  /**
   * 任务20：设置覆盖层类型（朝霞/晚霞）
   * @param {string} type - 类型 ('sunrise' | 'sunset')
   */
  async setOverlayType(type) {
    if (this.currentOverlayType === type) {
      return; // 类型未改变
    }

    this.currentOverlayType = type;
    console.log(`[WeatherController] 覆盖层类型设置为: ${type}`);

    // 如果覆盖层已启用，重新生成覆盖层
    if (this.fireCloudOverlayEnabled && this.currentLocation && this.surroundingData) {
      await this.updateFireCloudOverlay(this.currentLocation);
    }

    if (this._chinaSpotsMapInstance && this.chinaSpotsOverlayManager) {
      this.chinaSpotsOverlayManager.switchPeriod(type);
      const activeOverlay = this.chinaSpotsOverlayManager.getOverlay(type);
      if (activeOverlay) {
        await activeOverlay.loadAndRender(type);
      }
      const count = activeOverlay?.getSpotCount?.() || 0;
      this._setChinaSpotsEmptyState(count === 0);
      this._renderChinaSpotsTimestamp();
      this._renderDualPeriodScorePanel(); // 任务 64.8：更新双卡片高亮
      this._updateChinaSpotsPeriodLabel(type); // 更新时段说明
    }
  }

  /**
   * 任务20：手动刷新覆盖层
   */
  async refreshFireCloudOverlay() {
    if (!this.fireCloudOverlayEnabled) {
      console.log('[WeatherController] 覆盖层未启用，无需刷新');
      return;
    }

    if (this.currentLocation && this.surroundingData) {
      console.log('[WeatherController] 手动刷新覆盖层');

      try {
        // 刷新覆盖层
        await this.fireCloudOverlayService.refresh(
          this.currentLocation,
          this.surroundingData.points,
          this.surroundingRadius * 2,
          this.currentOverlayType
        );

        console.log('[WeatherController] 覆盖层刷新完成');

      } catch (error) {
        console.error('[WeatherController] 刷新覆盖层失败:', error);
        this.updateOverlayStatus(false, error.message);
      }
    }
  }

  /**
   * 任务20：更新覆盖层UI状态
   * @param {boolean} success - 是否成功
   * @param {string} error - 错误消息（可选）
   */
  updateOverlayStatus(success, error = null) {
    const statusEl = document.getElementById('overlay-status');
    const loadingEl = document.getElementById('overlay-loading');

    if (loadingEl) {
      loadingEl.style.display = 'none';
    }

    if (statusEl) {
      if (success) {
        statusEl.innerHTML = `<span style="color: var(--color-success);">✓ ${this._t('overlay.active', '覆盖层已显示')}</span>`;
      } else {
        statusEl.innerHTML = `<span style="color: var(--color-error);">✗ ${error || this._t('overlay.error', '覆盖层生成失败')}</span>`;
      }
    }
  }

  /**
   * 任务20：清除覆盖层缓存
   */
  clearOverlayCache() {
    this.fireCloudOverlayService.clearCache();
    console.log('[WeatherController] 覆盖层缓存已清除');
  }

  // ========== Phase 16：中国火烧云散点地图 ==========

  /**
   * 判断坐标是否在中国境内（粗略边界）
   * @param {number} lat - 纬度
   * @param {number} lon - 经度
   * @returns {boolean}
   */

  _isInChina(lat, lon) {
    return isInMainlandChina(lat, lon);
  }

  _isMainlandChinaLocation(location) {
    return isMainlandChinaLocation(location);
  }

  /**
   * 根据当前位置更新中国火烧云图层显隐。
   * - 中国大陆：展示并初始化/刷新图层
   * - 非中国大陆：隐藏并停止刷新
   * @param {{lat:number, lon:number}|null} location
   */
  async updateChinaSpotsForLocation(location) {
    // china-spots-section 已移至独立地图页，用 china-spots-map 判断存在
    const mapEl = document.getElementById('china-spots-map');
    const tsEl = document.getElementById('china-spots-timestamp');

    if (!mapEl) return;

    if (!location || !this._isMainlandChinaLocation(location)) {
      if (tsEl) tsEl.textContent = '';
      this._setChinaSpotsEmptyState(false);
      this.chinaSpotsOverlayManager?.hide();
      return;
    }

    await this._initChinaSpotsMap();

    // 定位在中国大陆时，地图聚焦到定位地点附近
    if (this._chinaSpotsMapCanvas && typeof this._chinaSpotsMapCanvas.focusOnLocation === 'function') {
      this._chinaSpotsMapCanvas.focusOnLocation(location.lat, location.lon, {
        radiusKm: 280,
        maxZoom: 8,
      });
    }
  }

  /**
   * 任务 64.8：朝/晚霞双时段切换卡片
   *
   * 地图下方仅保留时段切换，不展示分数与点位数。
   */
  _renderDualPeriodScorePanel() {
    // 底部双卡片已由顶部 tab 替代，隐藏此面板
    const panelEl = document.getElementById('china-spots-dual-score');
    if (panelEl) { panelEl.style.display = 'none'; panelEl.classList.add('hidden'); }
    // 不再渲染任何底部切换控件，所有时段切换通过顶部 tab 完成
  }


  _setChinaSpotsEmptyState(show, message = null) {
    const emptyEl = document.getElementById('china-spots-empty');
    if (!emptyEl) return;

    emptyEl.textContent = message || this._t('weatherMap.emptyChinaSpots');
    emptyEl.classList.toggle('hidden', !show);
  }

  _renderChinaSpotsTimestamp() {
    const tsEl = document.getElementById('china-spots-timestamp');
    if (!tsEl) return;

    const activePeriod = this.chinaSpotsOverlayManager?.getActivePeriod?.() || this.currentOverlayType || 'sunset';
    const overlay = this.chinaSpotsOverlayManager?.getOverlay(activePeriod);
    const updatedAt = overlay?.getUpdatedAt?.() || null;
    const updatedTime = updatedAt ? new Date(updatedAt) : null;
    const hasValidTime = updatedTime && !Number.isNaN(updatedTime.getTime());

    const timeLocale = this.i18n?.getLanguage?.() || 'zh-CN';
    tsEl.textContent = hasValidTime
      ? this._formatTemplate(this._t('weatherMap.updatedAt', '更新于 {{time}}'), {
          time: updatedTime.toLocaleTimeString(timeLocale, { hour: '2-digit', minute: '2-digit' })
        })
      : '';
  }

  _setChinaSpotsLayerLoading(show) {
    const loadingEl = document.getElementById('china-spots-layer-loading');
    if (!loadingEl) return;
    loadingEl.classList.toggle('hidden', !show);
  }

  /**
   * 更新火烧云地图时段说明标签
   * @param {string} period - 'sunrise' 或 'sunset'
   */
  _updateChinaSpotsPeriodLabel(period) {
    const labelEl = document.getElementById('china-spots-period-label');
    if (!labelEl) return;

    const now = new Date();
    const timeLocale = this.i18n?.getLanguage?.() || 'zh-CN';
    const todayStr = now.toLocaleDateString(timeLocale, { month: 'short', day: 'numeric' });
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toLocaleDateString(timeLocale, { month: 'short', day: 'numeric' });

    let text = '';
    if (period === 'sunrise') {
      text = this._formatTemplate(this._t('weatherMap.period.sunriseTomorrow', '明天的朝霞'), { date: tomorrowStr });
    } else if (period === 'test') {
      text = this._t('weatherMap.period.testLayer', '测试图层（模拟数据）');
    } else {
      text = this._formatTemplate(this._t('weatherMap.period.sunsetToday', '今天的晚霞'), { date: todayStr });
    }

    labelEl.textContent = text;
  }

  _getChinaSpotsMapOptions() {
    return {
      center: [36, 121],
      zoom: 4,
      minZoom: 3,
      maxZoom: 12,
      zoomControl: true,
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: true,
      touchZoom: true,
      tap: true
    };
  }

  _getChinaMainlandMapBounds() {
    if (typeof window === 'undefined' || !window.L || typeof window.L.latLngBounds !== 'function') {
      return null;
    }

    return window.L.latLngBounds(
      [MAINLAND_BOUNDS.latMin, MAINLAND_BOUNDS.lonMin],
      [MAINLAND_BOUNDS.latMax, MAINLAND_BOUNDS.lonMax]
    );
  }

  /**
   * 初始化并展示中国散点地图（已移至独立地图页面）
   * 仅在位置位于中国境内时调用。
   */
  async _initChinaSpotsMap() {
    const mapEl = document.getElementById('china-spots-map');

    if (!mapEl) {
      console.warn('[WeatherController] 未找到 china-spots-map 元素');
      return;
    }

    // 防止并发初始化（竞态条件保护）
    if (this._chinaSpotsMapInitializing) {
      console.log('[WeatherController] 地图初始化进行中，跳过重复调用');
      return;
    }

    // 检查地图容器是否可见且已有实际尺寸（避免在隐藏/未布局状态下初始化导致 NaN 错误）
    const mapPanel = document.getElementById('tab-panel-map');
    const panelHidden = mapPanel && (mapPanel.classList.contains('hidden') || mapPanel.hidden);
    const sizeNotReady = mapEl.offsetWidth <= 0 || mapEl.offsetHeight <= 0;
    if (panelHidden || sizeNotReady) {
      // 仅在首次和达到上限时打日志，避免刷屏
      const retryCount = (this._chinaSpotsInitRetryCount || 0) + 1;
      this._chinaSpotsInitRetryCount = retryCount;
      if (retryCount === 1 || retryCount === 11) {
        console.log('[WeatherController] 地图面板未就绪，等待用户切换到地图页触发初始化', { panelHidden, sizeNotReady });
      }
      // 标记为待初始化，等面板显示时通过 onMapPanelVisible 回调触发
      this._chinaSpotsMapPendingInit = true;

      // 兜底：低频重试（每5秒一次），防止 tab 切换事件丢失时地图永久空白
      if (retryCount <= 3) {
        setTimeout(() => this._initChinaSpotsMap(), 500);
      } else if (retryCount <= 6) {
        setTimeout(() => this._initChinaSpotsMap(), 2000);
      } else {
        // 超过6次后停止重试，完全依赖 onMapPanelVisible 回调
        // 当用户切到地图 tab 时，HomeTabs.setActiveView 会触发 onMapPanelVisible
      }
      return;
    }

    // 若地图已初始化，直接刷新当前时段数据
    if (this._chinaSpotsMapInstance) {
      this._chinaSpotsMapPendingInit = false;
      this._chinaSpotsInitRetryCount = 0;
      const activeOverlay = this.chinaSpotsOverlayManager?.getOverlay(this.chinaSpotsOverlayManager.getActivePeriod());
      if (!activeOverlay) return;

      await activeOverlay.loadAndRender(this.chinaSpotsOverlayManager.getActivePeriod());
      const count = activeOverlay.getSpotCount();
      this._setChinaSpotsEmptyState(count === 0);
      this._renderChinaSpotsTimestamp();
      return;
    }

    // 设置初始化锁，防止并发执行
    this._chinaSpotsMapInitializing = true;
    this._chinaSpotsMapPendingInit = false;
    this._chinaSpotsInitRetryCount = 0;

    try {
      if (typeof window === 'undefined' || !window.L) {
        console.error('[WeatherController] Leaflet 未加载，跳过中国散点地图初始化');
        return;
      }

      // 支持底图切换：自建 / 高德 / OSM
      console.log('[WeatherController] 初始化地图（ChinaMapCanvas）');
      const isDark = document.body.classList.contains('theme-dark');
      this._chinaSpotsMapCanvas = new ChinaMapCanvas({
        style: isDark ? 'dark' : 'light',
        defaultCenter: [36, 121],
        defaultZoom: 4
      });
      await this._chinaSpotsMapCanvas.init(mapEl);
      const map = this._chinaSpotsMapCanvas.getMap();
      this._chinaSpotsActiveTileLayer = null;

      // 应用地图底图设置
      const tileProvider = localStorage.getItem('map_tile_provider') || 'auto';
      this._chinaSpotsMapCanvas.setTileProvider(tileProvider);

      // 监听底图切换事件
      this._onMapTileProviderChanged = (e) => {
        if (this._chinaSpotsMapCanvas) {
          this._chinaSpotsMapCanvas.setTileProvider(e.detail.provider);
        }
      };
      window.addEventListener('mapTileProviderChanged', this._onMapTileProviderChanged);

      // 将 ChinaMapCanvas 实例挂到地图容器，供 ChinaRasterOverlayManager 同步图例
      map.getContainer()._chinaMapCanvas = this._chinaSpotsMapCanvas;

      // 适配中国范围
      const mainlandBounds = this._getChinaMainlandMapBounds();
      if (mainlandBounds && typeof map.fitBounds === 'function') {
        map.fitBounds(mainlandBounds, { animate: false, padding: [8, 8] });
      }

      this._chinaSpotsMapInstance = map;

      // 使用管理器初始化叠加层，传入 tab 容器
      const tabsContainer = document.getElementById('china-spots-tabs-container');
      this.chinaSpotsOverlayManager.init(map, tabsContainer);

      // 注册时段切换回调：同步时段说明/时间戳/空状态
      if (typeof this.chinaSpotsOverlayManager.onPeriodChange === 'function') {
        this.chinaSpotsOverlayManager.onPeriodChange((period) => {
          this._updateChinaSpotsPeriodLabel(period);
          this._renderChinaSpotsTimestamp();
          const overlay = this.chinaSpotsOverlayManager.getOverlay(period);
          this._setChinaSpotsEmptyState((overlay?.getSpotCount?.() ?? 0) === 0);
        });
      }
      if (typeof this.chinaSpotsOverlayManager.onLoadingChange === 'function') {
        this.chinaSpotsOverlayManager.onLoadingChange((loading) => {
          this._setChinaSpotsLayerLoading(loading);
        });
      }

      // 加载所有时段数据
      await this.chinaSpotsOverlayManager.loadAllPeriods();

      // 更新兼容引用
      this.chinaSpotsOverlay = this.chinaSpotsOverlayManager._getActiveOverlay();

      const count = this.chinaSpotsOverlay.getSpotCount();
      this._setChinaSpotsEmptyState(count === 0);
      this._renderChinaSpotsTimestamp();
      this._renderDualPeriodScorePanel(); // 任务 64.8：朝/晚双卡片并排展示
      this._updateChinaSpotsPeriodLabel(this.chinaSpotsOverlayManager.getActivePeriod()); // 初始化时段说明

      // 强制刷新地图尺寸（解决 hidden 面板初始化后尺寸为0问题）
      setTimeout(() => {
        try { map.invalidateSize({ animate: false }); } catch (_) {}
      }, 200);

      console.log('[WeatherController] 中国散点地图初始化完成');
    } catch (err) {
      console.error('[WeatherController] 初始化中国散点地图失败:', err);
      // 隐藏地图面板
      const mapPanel = document.getElementById('tab-panel-map');
      if (mapPanel) mapPanel.classList.add('hidden');
      this._setChinaSpotsEmptyState(false);
    } finally {
      // 释放初始化锁
      this._chinaSpotsMapInitializing = false;
      this._setChinaSpotsLayerLoading(false);
    }
  }


}

export default WeatherController;
