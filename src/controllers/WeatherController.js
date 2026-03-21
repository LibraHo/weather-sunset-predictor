/**
 * WeatherController - 天气数据控制器
 *
 * 负责获取和管理天气数据，包括缓存逻辑
 * 支持7天概览和24小时详细视图（需求11）
 * 需求：14 - 多语言支持
 */

import WindyAPIService from '../services/WindyAPIService.js';
import MockWindyAPIService from '../services/MockWindyAPIService.js';
import UnitConverter from '../utils/UnitConverter.js';
import WindyMapService from '../services/WindyMapService.js';
import MockWindyMapService from '../services/MockWindyMapService.js';
import RadarCompass from '../components/RadarCompass.js';
import RadarChartService from '../services/RadarChartService.js';
import FireCloudOverlayService from '../services/FireCloudOverlayService.js';
import PredictionAPIService from '../services/PredictionAPIService.js';
import { loadConfig } from '../../config.api.js';
import i18n from '../i18n.js';
import toastService from '../services/ToastService.js';
import ChartRenderController from './ChartRenderController.js';
import ChinaSpotsOverlay from '../services/ChinaSpotsOverlay.js';
import ChinaSpotsOverlayManager from '../services/ChinaSpotsOverlayManager.js';
import ChinaRasterOverlayManager from '../services/ChinaRasterOverlayManager.js';

/**
 * 任务 64.13：渲染模式 feature flag
 *
 * localStorage key: `china_render_mode`
 * 合法值: `'raster'` | `'spots'`（缺省 → 默认值）
 * 默认值：`'raster'`（启用像素级 IDW 栅格，视觉更连续）
 *
 * 可通过浏览器控制台运行时切换：
 *   localStorage.setItem('china_render_mode', 'spots'); location.reload();
 *   localStorage.setItem('china_render_mode', 'raster'); location.reload();
 */
export const CHINA_RENDER_MODE_KEY = 'china_render_mode';
export const CHINA_RENDER_MODE_DEFAULT = 'raster';

/**
 * 根据 localStorage feature flag 构造对应的叠加层管理器
 * @returns {ChinaRasterOverlayManager|ChinaSpotsOverlayManager}
 */
export function createChinaOverlayManager() {
  const mode = (typeof localStorage !== 'undefined'
    ? localStorage.getItem(CHINA_RENDER_MODE_KEY)
    : null) ?? CHINA_RENDER_MODE_DEFAULT;
  if (mode === 'spots') {
    console.log('[WeatherController] china_render_mode=spots → ChinaSpotsOverlayManager');
    return new ChinaSpotsOverlayManager();
  }
  console.log('[WeatherController] china_render_mode=raster → ChinaRasterOverlayManager');
  return new ChinaRasterOverlayManager();
}
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
    this.currentView = 'overview'; // 'overview', 'hourly' 或 'map'
    this.selectedDay = 'today'; // 'today' 或 'tomorrow'
    this.selectedParameter = 'temp'; // 'temp', 'precip', 'humidity', 'wind', 'pressure', 'clouds'
    this.isMapInitialized = false; // 任务18：地图初始化状态

    // Phase 16：中国散点地图覆盖层（64.13：feature flag 决定 Manager 类型）
    // 默认使用 ChinaRasterOverlayManager（IDW 像素级栅格），可通过
    //   localStorage.setItem('china_render_mode', 'spots') 切换为散点版
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

    // 检查缓存（如果不是强制刷新）
    if (!forceRefresh) {
      const cachedData = this.storageService.getCachedWeatherData(location);
      if (cachedData) {
        console.log('[WeatherController] 使用缓存的天气数据');
        this.currentWeatherData = cachedData;
        this.currentLocation = location;
        return cachedData;
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

    // 获取当前天气（第一个数据点）
    const currentWeather = weatherData[0];

    // 更新位置
    const locationEl = document.getElementById('weather-location');
    if (locationEl) {
      locationEl.textContent = location && location.name ? location.name : this.i18n.t('weather.currentLocation');
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
      iconMainEl.textContent = icon;
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
      visibility: document.getElementById('current-visibility')
    };

    if (elements.humidity) {
      elements.humidity.textContent = `${currentWeather.humidity.toFixed(0)}%`;
    }
    if (elements.cloudCover) {
      elements.cloudCover.textContent = `${currentWeather.cloudCover.toFixed(0)}%`;
    }
    if (elements.windSpeed) {
      elements.windSpeed.textContent = this.formatWindSpeed(currentWeather.windSpeed);
    }
    const normalizedDirection = this._normalizeWindDirection(currentWeather.windDirection);
    if (elements.windDirectionIcon) {
      elements.windDirectionIcon.style.transform = `rotate(${normalizedDirection}deg)`;
    }
    if (elements.windDirectionText) {
      elements.windDirectionText.textContent = this._getWindDirectionLabel(normalizedDirection);
    }
    if (elements.pressure) {
      elements.pressure.textContent = `${currentWeather.pressure.toFixed(0)} hPa`;
    }
    if (elements.visibility) {
      elements.visibility.textContent = `${currentWeather.visibility.toFixed(1)} km`;
    }

    // 显示天气数据容器
    const weatherDataContainer = document.getElementById('weather-data');
    if (weatherDataContainer) {
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
      <div class="temp-bar-container">
        <div class="temp-bar" role="progressbar" aria-label="温度范围：${minTemp.toFixed(0)}°C 至 ${maxTemp.toFixed(0)}°C"></div>
        <div class="temp-bar-labels">
          <span class="min-temp">${minTemp.toFixed(0)}°</span>
          <span class="max-temp">${maxTemp.toFixed(0)}°</span>
        </div>
      </div>
      <div class="day-meta-icons-row" role="list" aria-label="天气详细信息">
        <div class="day-meta-icon" role="listitem" aria-label="降水概率：${precipProb}%">
          <span class="icon" aria-hidden="true">💧</span>
          <span class="value">${precipProb}%</span>
        </div>
        <div class="day-meta-icon" role="listitem" aria-label="风速：${this.formatWindSpeed(maxWindSpeed)}">
          <span class="icon" aria-hidden="true">💨</span>
          <span class="value">${this.formatWindSpeed(maxWindSpeed)}</span>
        </div>
        <div class="day-meta-icon" role="listitem" aria-label="风向：${directionLabel}">
          <span class="icon day-wind-direction-icon" style="transform: rotate(${avgWindDirection.toFixed(0)}deg);" aria-hidden="true">↑</span>
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

  /**
   * 获取天气图标
   * @param {number} cloudCover - 云量百分比
   * @param {number} precipProb - 降水概率
   * @returns {string} 图标emoji
   */
  _getWeatherIcon(cloudCover, precipProb) {
    if (precipProb > 50) return '🌧️';
    if (cloudCover > 70) return '☁️';
    if (cloudCover > 30) return '⛅';
    return '☀️';
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
   * 切换视图（概览/详细/地图）
   * @param {string} view - 'overview', 'hourly' 或 'map'
   */
  switchView(view) {
    this.currentView = view;

    const overviewView = document.getElementById('weekly-overview');
    const hourlyView = document.getElementById('hourly-forecast');
    const mapView = document.getElementById('map-forecast');
    const overviewBtn = document.getElementById('overview-btn');
    const hourlyBtn = document.getElementById('hourly-btn');
    const mapBtn = document.getElementById('map-btn');

    // 隐藏所有视图
    if (overviewView) overviewView.classList.add('hidden');
    if (hourlyView) hourlyView.classList.add('hidden');
    if (mapView) mapView.classList.add('hidden');

    // 移除所有按钮的active状态
    if (overviewBtn) overviewBtn.classList.remove('active');
    if (hourlyBtn) hourlyBtn.classList.remove('active');
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

    this.chartService = this.chartRenderController.createChartService(this.tempUnit, this.windUnit);

    // 如果有当前天气数据，重新渲染以更新格式化的日期/时间
    if (this.currentWeatherData) {
      // 根据当前视图重新渲染
      if (this.currentView === 'hourly') {
        // 重新渲染24小时图表
        this.renderHourlyForecast(this.currentWeatherData, this.selectedDay);
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
    const container = predictionType
      ? document.getElementById(`radar-compass-${predictionType}`)
      : document.getElementById('radar-compass-container');

    if (!container || !location?.lat || !location?.lon) return;

    container.style.display = 'block';
    container.innerHTML = '<p style="text-align:center;color:var(--color-text-light,#aaa);font-size:13px;padding:12px 0;">加载周边数据中…</p>';

    try {
      let dirs;
      let sunAzimuths = {};
      const radius = 20;
      const now = new Date();
      const type = predictionType || (now.getHours() < 12 ? 'sunrise' : 'sunset');

      // 优先后端聚合 API（POST /api/prediction/surrounding）
      if (this.predictionAPIService) {
        try {
          const data = await this.predictionAPIService.getSurrounding(
            location.lat,
            location.lon,
            radius,
            type,
            now
          );
          dirs = this._convertSurroundingToRadarDirs(data);
          sunAzimuths = data.sunAzimuths || {};
        } catch (apiError) {
          console.warn('[WeatherController] 后端周边API失败，回退前端逐点请求:', apiError.message);
          dirs = await this._fetchRadarDirsFrontend(location, radius, type);
        }
      } else {
        dirs = await this._fetchRadarDirsFrontend(location, radius, type);
      }

      this._radarCompass.render(container, { directions: dirs, sunAzimuths, predictionType: type });
    } catch (err) {
      console.error('[WeatherController] 雷达罗盘渲染失败:', err);
      container.style.display = 'none';
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

  async _fetchRadarDirsFrontend(location, radius = 100, type = 'sunset') {
    const DIRS = [
      {dir:'N', label:'北', b:0}, {dir:'NE', label:'东北', b:45},
      {dir:'E', label:'东', b:90}, {dir:'SE', label:'东南', b:135},
      {dir:'S', label:'南', b:180}, {dir:'SW', label:'西南', b:225},
      {dir:'W', label:'西', b:270}, {dir:'NW', label:'西北', b:315},
    ];
    const R = 6371;
    const base = window._appConfig?.proxyURL || 'http://localhost:3000';
    const results = await Promise.allSettled(DIRS.map(async d => {
      const rad  = d.b * Math.PI / 180;
      const dLat = (radius / R) * Math.cos(rad) * (180 / Math.PI);
      const dLon = (radius / R) * Math.sin(rad) / Math.cos(location.lat * Math.PI / 180) * (180 / Math.PI);
      const res  = await fetch(
        `${base}/api/prediction?lat=${(location.lat+dLat).toFixed(4)}&lon=${(location.lon+dLon).toFixed(4)}&type=${type}`,
        { signal: AbortSignal.timeout(8000) }
      );
      const json = res.ok ? await res.json() : {};
      return { dir: d.dir, label: d.label, score: Math.round(json.score||0), dist: radius };
    }));
    return results.map((r,i) =>
      r.status === 'fulfilled' ? r.value : { dir: DIRS[i].dir, label: DIRS[i].label, score: 0, dist: radius }
    );
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
        return weatherData[0]; // 返回当前天气数据
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
      container.innerHTML = `<p style="color: var(--color-text-light);">${this.i18n.t('surrounding.noData') || '当前周边区域火烧云观赏条件一般'}</p>`;
      return;
    }

    container.innerHTML = bestPoints.map((p, index) => {
      let qualityClass = '';
      let qualityText = '';

      if (p.score >= 80) {
        qualityClass = 'color: #4caf50;';
        qualityText = this.i18n.t('surrounding.legend.excellent') || '优秀';
      } else if (p.score >= 60) {
        qualityClass = 'color: #ffc107;';
        qualityText = this.i18n.t('surrounding.legend.good') || '良好';
      }

      return `
        <div class="direction-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border-color, #e0e0e0); cursor: pointer;" data-index="${index}">
          <span>${p.name} (${p.label})</span>
          <span style="${qualityClass} font-weight: 600;">${p.score}分 - ${qualityText}</span>
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
    toastService.show(`${point.name}方向｜评分: ${point.score}分｜距离: ${point.distance}公里`, 'info', 5000);
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
        statusEl.innerHTML = `<span style="color: var(--color-success, #4caf50);">✓ ${this.i18n.t('overlay.active') || '覆盖层已显示'}</span>`;
      } else {
        statusEl.innerHTML = `<span style="color: var(--color-error, #f44336);">✗ ${error || (this.i18n.t('overlay.error') || '覆盖层生成失败')}</span>`;
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
    const section = document.getElementById('china-spots-section');
    const tsEl = document.getElementById('china-spots-timestamp');

    if (!section) return;

    if (!location || !this._isMainlandChinaLocation(location)) {
      section.classList.add('hidden');
      if (tsEl) tsEl.textContent = '';
      this._setChinaSpotsEmptyState(false);
      this.chinaSpotsOverlayManager?.hide();
      return;
    }

    await this._initChinaSpotsMap();
  }

  /**
   * 任务 64.8：朝/晚霞双时段分数并行展示
   *
   * 在地图下方渲染两张并排的评分卡片，分别显示朝霞和晚霞当前位置的
   * 最高评分及覆盖点位数量，方便用户无需切换 tab 即可对比两段时光。
   */
  _renderDualPeriodScorePanel() {
    const panelEl = document.getElementById('china-spots-dual-score');
    if (!panelEl || !this.chinaSpotsOverlayManager) return;

    const periods = [
      { key: 'sunrise', label: '朝霞', emoji: '🌄' },
      { key: 'sunset',  label: '晚霞', emoji: '🌅' },
    ];

    const cards = periods.map(({ key, label, emoji }) => {
      const overlay = this.chinaSpotsOverlayManager.getOverlay(key);
      const count   = overlay?.getSpotCount?.()   ?? 0;
      const maxScore = overlay?.getMaxScore?.()    ?? null;
      const isActive = this.chinaSpotsOverlayManager.getActivePeriod() === key;

      const scoreText = (maxScore !== null && maxScore > 0)
        ? `${Math.round(maxScore)} 分`
        : '暂无数据';
      const countText = count > 0 ? `${count} 个点位` : '—';

      const borderColor = isActive
        ? (key === 'sunrise' ? '#ff9a5c' : '#ff6b35')
        : 'rgba(255,255,255,0.12)';
      const bgGradient = isActive
        ? (key === 'sunrise'
            ? 'linear-gradient(135deg,rgba(255,180,80,0.18) 0%,rgba(255,130,50,0.08) 100%)'
            : 'linear-gradient(135deg,rgba(255,120,40,0.22) 0%,rgba(200,60,20,0.08) 100%)')
        : 'rgba(0,0,0,0.25)';

      return `
        <div class="china-spots-score-card${isActive ? ' active' : ''}"
             data-period="${key}"
             style="
               flex:1;
               padding:10px 12px;
               border-radius:10px;
               border:1px solid ${borderColor};
               background:${bgGradient};
               backdrop-filter:blur(4px);
               cursor:pointer;
               transition:border-color 0.2s, background 0.2s;
             ">
          <div style="font-size:20px; margin-bottom:4px;">${emoji}</div>
          <div style="font-size:12px; color:var(--color-text-light); margin-bottom:2px;">${label}</div>
          <div style="font-size:18px; font-weight:700; color:${isActive ? '#ffaa55' : 'var(--color-text)'};">
            ${scoreText}
          </div>
          <div style="font-size:11px; color:var(--color-text-light); margin-top:2px;">${countText}</div>
        </div>`;
    });

    panelEl.innerHTML = cards.join('');
    panelEl.style.display = 'grid';
    panelEl.classList.remove('hidden');

    // 点击卡片切换时段
    panelEl.querySelectorAll('.china-spots-score-card').forEach(card => {
      card.addEventListener('click', () => {
        const period = card.dataset.period;
        if (period && this.chinaSpotsOverlayManager) {
          this.chinaSpotsOverlayManager.switchPeriod(period);
          this._renderDualPeriodScorePanel(); // 重渲染高亮
        }
      });
    });
  }

  _setChinaSpotsEmptyState(show, message = '今日暂无可见火烧云点位') {
    const emptyEl = document.getElementById('china-spots-empty');
    if (!emptyEl) return;

    emptyEl.textContent = message;
    emptyEl.classList.toggle('hidden', !show);
  }

  _renderChinaSpotsTimestamp() {
    const tsEl = document.getElementById('china-spots-timestamp');
    if (!tsEl) return;

    const activeOverlay = this.chinaSpotsOverlayManager?.getOverlay(
      this.chinaSpotsOverlayManager?.getActivePeriod() || 'sunset'
    );
    const count = activeOverlay?.getSpotCount?.() || 0;
    const updatedAt = activeOverlay?.getUpdatedAt?.() || null;

    if (count === 0) {
      tsEl.textContent = updatedAt
        ? '今日数据，更新于 ' + new Date(updatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        : '今日数据';
      return;
    }

    tsEl.textContent = updatedAt
      ? '今日数据，更新于 ' + new Date(updatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      : '今日数据';
  }

  _getChinaSpotsMapOptions() {
    return {
      center: [35, 105],
      zoom: 5,
      minZoom: 5,
      maxZoom: 5,
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
      tap: false
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
   * 初始化并展示中国散点地图（嵌入预测卡片底部）
   * 仅在位置位于中国境内时调用。
   */
  async _initChinaSpotsMap() {
    const section = document.getElementById('china-spots-section');
    const mapEl = document.getElementById('china-spots-map');
    const tabsContainer = document.getElementById('china-spots-tabs-container');

    if (!section || !mapEl || !tabsContainer) {
      console.warn('[WeatherController] 未找到 china-spots-section 元素');
      return;
    }

    // 显示区域
    section.classList.remove('hidden');

    // 若地图已初始化，直接刷新当前时段数据
    if (this._chinaSpotsMapInstance) {
      const activeOverlay = this.chinaSpotsOverlayManager?.getOverlay(this.chinaSpotsOverlayManager.getActivePeriod());
      if (!activeOverlay) return;

      await activeOverlay.loadAndRender(this.chinaSpotsOverlayManager.getActivePeriod());
      const count = activeOverlay.getSpotCount();
      this._setChinaSpotsEmptyState(count === 0);
      this._renderChinaSpotsTimestamp();
      return;
    }

    try {
      if (typeof window === 'undefined' || !window.L) {
        console.error('[WeatherController] Leaflet 未加载，跳过中国散点地图初始化');
        return;
      }

      // 初始化 Leaflet 地图（静态中国范围，不可拖拽/缩放）
      const mapOptions = this._getChinaSpotsMapOptions();
      const map = window.L.map(mapEl, mapOptions);

      const mainlandBounds = this._getChinaMainlandMapBounds();
      if (mainlandBounds) {
        if (typeof map.fitBounds === 'function') {
          map.fitBounds(mainlandBounds, { animate: false, padding: [8, 8] });
        }
        if (typeof map.setMaxBounds === 'function') {
          map.setMaxBounds(mainlandBounds);
        }
      }

      // 地图底图：根据设置选择（auto/gaode/osm）
      const mapTileSetting = localStorage.getItem('map_tile_provider') || 'auto';
      const isChina = this._isInChina(
        this.currentLocation?.lat ?? 35,
        this.currentLocation?.lon ?? 105
      );
      const useGaode = mapTileSetting === 'gaode' || (mapTileSetting === 'auto' && isChina);

      if (useGaode) {
        // 高德瓦片走后端代理，避免浏览器直连受限
        window.L.tileLayer('/api/tiles/gaode/{z}/{x}/{y}', {
          maxZoom: 10,
          attribution: '© 高德地图'
        }).addTo(map);
      } else {
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 10,
          subdomains: 'abc',
          attribution: '© OpenStreetMap contributors'
        }).addTo(map);
      }

      this._chinaSpotsMapInstance = map;

      // 使用管理器初始化叠加层
      this.chinaSpotsOverlayManager.init(map, tabsContainer);

      // 加载所有时段数据
      await this.chinaSpotsOverlayManager.loadAllPeriods();

      // 更新兼容引用
      this.chinaSpotsOverlay = this.chinaSpotsOverlayManager._getActiveOverlay();

      const count = this.chinaSpotsOverlay.getSpotCount();
      this._setChinaSpotsEmptyState(count === 0);
      this._renderChinaSpotsTimestamp();
      this._renderDualPeriodScorePanel(); // 任务 64.8：朝/晚双卡片并排展示

      console.log('[WeatherController] 中国散点地图初始化完成');
    } catch (err) {
      console.error('[WeatherController] 初始化中国散点地图失败:', err);
      if (section) section.classList.add('hidden');
      this._setChinaSpotsEmptyState(false);
    }
  }


}

export default WeatherController;
