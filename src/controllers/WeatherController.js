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
import SurroundingPointsService from '../services/SurroundingPointsService.js';
import RadarChartService from '../services/RadarChartService.js';
import i18n from '../i18n.js';
// 暂时禁用 ChartService 导入，使用内联简化版本

class WeatherController {
  constructor(storageService, apiKey, useMockAPI = true, useProxy = false) {
    this.storageService = storageService;
    this.useMockAPI = useMockAPI;
    this.useProxy = useProxy; // 任务：后端代理模式
    this.i18n = i18n; // 需求14：添加i18n实例

    // 读取单位设置
    this.tempUnit = localStorage.getItem('temp_unit') || 'celsius';
    this.windUnit = localStorage.getItem('wind_unit') || 'kmh';

    if (useMockAPI) {
      this.windyAPIService = new MockWindyAPIService(apiKey || 'mock-api-key');
    } else {
      // 任务：支持后端代理模式
      // 后端代理模式下不需要真实的API key，使用占位符
      // 直连模式下必须有API key
      if (useProxy) {
        this.windyAPIService = new WindyAPIService('proxy-mode-placeholder', { useProxy });
      } else if (apiKey) {
        this.windyAPIService = new WindyAPIService(apiKey, { useProxy: false });
      } else {
        this.windyAPIService = null;
      }
    }

    // 任务18：初始化Windy地图服务
    // 注意：Windy地图API需要真实API密钥，mock模式和后端代理模式使用模拟实现
    if (useProxy) {
      // 后端代理模式：使用模拟地图服务
      this.windyMapService = new MockWindyMapService();
    } else if (!useMockAPI && apiKey) {
      // 直连模式：使用真实Windy地图服务
      this.windyMapService = new WindyMapService(apiKey);
    } else {
      // Mock模式：不初始化地图
      this.windyMapService = null;
    }

    // 任务19：初始化周边火烧云服务
    this.surroundingPointsService = new SurroundingPointsService();
    this.radarChartService = new RadarChartService();
    this.surroundingRadius = 100; // 默认半径100公里
    this.surroundingData = null;

    // 使用简化的内联 ChartService（使用动态单位）
    this.chartService = {
      renderTemperatureChart: (data, id) => {
        const unit = this.tempUnit === 'fahrenheit' ? '°F' : '°C';
        return this._renderSimpleChart(data, id, 'temp', this.i18n.t('weather.temperature'), unit, '#ff6b6b');
      },
      renderPrecipitationChart: (data, id) => this._renderSimpleChart(data, id, 'precipitation', this.i18n.t('weather.precipitation'), 'mm', '#4dabf7'),
      renderHumidityChart: (data, id) => this._renderSimpleChart(data, id, 'humidity', this.i18n.t('weather.humidity'), '%', '#51cf66'),
      renderWindChart: (data, id) => {
        const unit = this.windUnit === 'ms' ? 'm/s' : 'km/h';
        return this._renderSimpleChart(data, id, 'windSpeed', this.i18n.t('weather.windSpeed'), unit, '#748ffc');
      },
      renderPressureChart: (data, id) => this._renderSimpleChart(data, id, 'pressure', this.i18n.t('weather.pressure'), 'hPa', '#ffa94d'),
      renderCloudChart: (data, id) => this._renderSimpleChart(data, id, 'cloudCover', this.i18n.t('weather.cloudCover'), '%', '#868e96')
    };
    
    this.currentWeatherData = null;
    this.currentLocation = null;

    // 需求11：视图状态管理
    this.currentView = 'overview'; // 'overview', 'hourly' 或 'map'
    this.selectedDay = 'today'; // 'today' 或 'tomorrow'
    this.selectedParameter = 'temp'; // 'temp', 'precip', 'humidity', 'wind', 'pressure', 'clouds'
    this.isMapInitialized = false; // 任务18：地图初始化状态
  }

  /**
   * 设置 API 密钥
   * @param {string} apiKey - Windy API 密钥
   */
  setAPIKey(apiKey) {
    if (this.useMockAPI) {
      this.windyAPIService = new MockWindyAPIService(apiKey);
    } else {
      this.windyAPIService = new WindyAPIService(apiKey);
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

    // 按天分组数据（每24小时一组）
    const dailyData = [];
    for (let i = 0; i < 7 && i * 24 < weatherData.length; i++) {
      const dayData = weatherData.slice(i * 24, (i + 1) * 24);
      if (dayData.length > 0) {
        dailyData.push(dayData);
      }
    }

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

    // 如果天数少于7天，添加提示说明原因
    if (dailyData.length < 7 && weeklyCards) {
      const infoDiv = document.createElement('div');
      infoDiv.className = 'info-message';
      infoDiv.style.cssText = 'margin-top: 10px; padding: 10px; background: #e3f2fd; border-radius: 4px; font-size: 14px; color: #1976d2;';
      infoDiv.innerHTML = this.i18n.t('weather.dataInfo', {
        hours: weatherData.length,
        days: dailyData.length
      });
      weeklyCards.appendChild(infoDiv);
    }

    console.log(`[WeatherController] 渲染了 ${dailyData.length} 天的概览`);
  }

  /**
   * 创建单日天气卡片
   * @param {WeatherData[]} dayData - 一天的天气数据
   * @param {number} dayIndex - 天数索引（0=今天，1=明天，等等）
   * @returns {HTMLElement} 卡片元素
   */
  _createDayCard(dayData, dayIndex) {
    const card = document.createElement('div');
    card.className = 'day-card';

    // 计算日期
    const date = new Date(dayData[0].timestamp);

    // 使用i18n翻译日期标签
    let dayLabel;
    if (dayIndex === 0) {
      dayLabel = this.i18n.t('time.today');
    } else if (dayIndex === 1) {
      dayLabel = this.i18n.t('time.tomorrow');
    } else if (dayIndex === 2) {
      dayLabel = this.i18n.t('time.dayAfterTomorrow');
    } else {
      dayLabel = this.i18n.formatDate(date);
    }

    // 计算最高/最低温度
    const temps = dayData.map(d => d.temp);
    const maxTemp = Math.max(...temps);
    const minTemp = Math.min(...temps);

    // 计算平均云量（用于天气图标）
    const avgCloudCover = dayData.reduce((sum, d) => sum + d.cloudCover, 0) / dayData.length;

    // 计算降水概率（假设降水量>0.1mm表示有降水）
    const precipCount = dayData.filter(d => d.precipitation > 0.1).length;
    const precipProb = Math.round((precipCount / dayData.length) * 100);

    // 选择天气图标
    const weatherIcon = this._getWeatherIcon(avgCloudCover, precipProb);

    // 使用i18n翻译降水概率
    const precipText = this.i18n.t('weather.precipChance', { prob: precipProb });

    card.innerHTML = `
      <div class="day-label">${dayLabel}</div>
      <div class="weather-icon">${weatherIcon}</div>
      <div class="temp-range">
        <span class="max-temp">${maxTemp.toFixed(0)}°</span>
        <span class="temp-separator">/</span>
        <span class="min-temp">${minTemp.toFixed(0)}°</span>
      </div>
      <div class="precip-prob">${precipText}</div>
    `;

    // 点击卡片切换到详细视图
    card.addEventListener('click', () => {
      this.selectedDay = dayIndex === 0 ? 'today' : 'tomorrow';
      this.switchView('hourly');
    });

    return card;
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

    // 根据选择的日期提取24小时数据
    const startIndex = day === 'today' ? 0 : 24;
    const hourlyData = weatherData.slice(startIndex, startIndex + 24);

    if (hourlyData.length === 0) {
      console.error('[WeatherController] 没有足够的数据显示24小时预报');
      return;
    }

    // 根据选择的参数渲染对应图表
    this._renderParameterChart(hourlyData, this.selectedParameter);

    console.log(`[WeatherController] 渲染了 ${day} 的 ${this.selectedParameter} 图表`);
  }

  /**
   * 渲染指定参数的图表
   * @param {WeatherData[]} hourlyData - 24小时天气数据
   * @param {string} parameter - 参数类型
   */
  _renderParameterChart(hourlyData, parameter) {
    const containerId = 'chart-container';

    if (!this.chartService) {
      console.warn('[WeatherController] ChartService 未初始化');
      return;
    }

    switch (parameter) {
      case 'temp':
        this.chartService.renderTemperatureChart(hourlyData, containerId);
        break;
      case 'precip':
        this.chartService.renderPrecipitationChart(hourlyData, containerId);
        break;
      case 'humidity':
        this.chartService.renderHumidityChart(hourlyData, containerId);
        break;
      case 'wind':
        this.chartService.renderWindChart(hourlyData, containerId);
        break;
      case 'pressure':
        this.chartService.renderPressureChart(hourlyData, containerId);
        break;
      case 'clouds':
        this.chartService.renderCloudChart(hourlyData, containerId);
        break;
      default:
        console.error(`[WeatherController] 未知的参数类型: ${parameter}`);
    }
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

      // 如果使用后端代理模式，尝试从后端获取地图API Key
      if (this.windyAPIService && this.windyAPIService.useProxy) {
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

    // 更改地图叠加层
    if (this.windyMapService && this.isMapInitialized) {
      this.windyMapService.changeOverlay(layer);
      console.log(`[WeatherController] 地图图层已切换到: ${layer}`);
    } else {
      console.log(`[WeatherController] 地图未初始化，无法切换图层`);
    }
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
      this.uiManager.showError('无法获取日落时间数据');
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
      this.uiManager.showError('无法获取日出时间数据');
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
   * 渲染简化折线图（内联版本，避免模块导入问题）
   * @private
   */
  _renderSimpleChart(hourlyData, containerId, param, label, unit, color) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // 根据参数类型转换数据值
    const getConvertedValue = (value, param) => {
      if (param === 'temp') {
        return this.getConvertedTemp(value);
      } else if (param === 'windSpeed') {
        return this.getConvertedWindSpeed(value);
      }
      return value;
    };

    const values = hourlyData.map(d => getConvertedValue(d[param], param));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    // 图表尺寸
    const chartWidth = 900;
    const chartHeight = 280;
    const padding = { top: 50, right: 50, bottom: 70, left: 90 };
    const contentWidth = chartWidth - padding.left - padding.right;
    const contentHeight = chartHeight - padding.top - padding.bottom;

    // 生成数据点坐标
    const points = hourlyData.map((d, i) => {
      const value = getConvertedValue(d[param], param);
      const x = padding.left + (i / (hourlyData.length - 1)) * contentWidth;
      const y = padding.top + contentHeight - ((value - min) / range) * contentHeight;
      return { x, y, value, time: new Date(d.timestamp).getHours() };
    });

    // 生成折线路径
    const pathData = points.map((p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      return `L ${p.x} ${p.y}`;
    }).join(' ');

    let html = `<div style="padding: 25px; background: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin: 20px auto; max-width: 95%;">`;
    html += `<h3 style="text-align: center; margin-bottom: 25px; color: ${color}; font-size: 1.5rem;">${label}${this.i18n.t('charts.trend')}</h3>`;

    // SVG图表容器，居中显示
    html += `<div style="display: flex; justify-content: center;">`;
    html += `<svg width="${chartWidth}" height="${chartHeight}" style="max-width: 100%; height: auto;">`;

    // Y轴网格线和标签
    for (let i = 0; i <= 5; i++) {
      const value = min + (range * i) / 5;
      const y = padding.top + contentHeight - (i / 5) * contentHeight;

      // 网格线
      html += `<line x1="${padding.left}" y1="${y}" x2="${chartWidth - padding.right}" y2="${y}" stroke="#e0e0e0" stroke-width="1.5" stroke-dasharray="5,5"/>`;

      // Y轴标签
      html += `<text x="${padding.left - 10}" y="${y + 5}" font-size="13" fill="#555" text-anchor="end" font-weight="500">${value.toFixed(1)} ${unit}</text>`;
    }

    // X轴标签（时间）
    points.forEach((p, i) => {
      if (i % 3 === 0) { // 每3小时显示一次时间标签
        html += `<text x="${p.x}" y="${chartHeight - padding.bottom + 25}" font-size="13" fill="#555" text-anchor="middle" font-weight="500">${p.time}:00</text>`;
      }
    });

    // 折线
    html += `<path d="${pathData}" fill="none" stroke="${color}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`;

    // 数据点和数值标签
    points.forEach((p, i) => {
      // 数据点圆圈
      html += `<circle cx="${p.x}" cy="${p.y}" r="6" fill="${color}" stroke="white" stroke-width="2.5"/>`;

      // 数值标签（在点上方）
      if (i % 3 === 0) { // 每3小时显示一次数值
        html += `<text x="${p.x}" y="${p.y - 12}" font-size="12" fill="${color}" text-anchor="middle" font-weight="700">${p.value.toFixed(1)}</text>`;
      }
    });

    // X轴标题
    html += `<text x="${chartWidth / 2}" y="${chartHeight - 15}" font-size="14" fill="#666" text-anchor="middle" font-weight="600">${this.i18n.t('charts.time')}</text>`;

    // Y轴标题
    html += `<text x="35" y="${chartHeight / 2}" font-size="14" fill="#666" text-anchor="middle" transform="rotate(-90, 35, ${chartHeight / 2})" font-weight="600">${label} (${unit})</text>`;

    html += `</svg>`;
    html += `</div>`; // 关闭SVG容器div
    html += `</div>`; // 关闭外层容器div

    container.innerHTML = html;
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

    // 更新"使用当前位置"按钮
    const currentLocationBtn = document.getElementById('current-location-btn');
    if (currentLocationBtn) {
      currentLocationBtn.textContent = `📍 ${this.i18n.t('buttons.useCurrentLocation')}`;
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

  // ========== 任务19：周边火烧云可视化 ==========

  /**
   * 任务19：获取并显示周边火烧云数据
   * @param {Object} location - 当前位置对象
   * @param {number} radius - 探测半径（公里），默认使用当前设置的半径
   */
  async fetchSurroundingData(location, radius = this.surroundingRadius) {
    if (!location || !location.lat || !location.lon) {
      console.warn('[WeatherController] 无效的位置，无法获取周边数据');
      return;
    }

    console.log(`[WeatherController] 获取周边火烧云数据，半径: ${radius}km`);

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
      // 需要预测控制器来计算评分
      const { default: PredictionController } = await import('./PredictionController.js');
      const predictionController = new PredictionController(this.storageService);

      // 获取周边数据
      const data = await this.surroundingPointsService.getSurroundingData(
        location,
        radius,
        // 天气数据获取函数
        async (loc) => {
          const weatherData = await this.fetchWeather(loc, true);
          return weatherData[0]; // 返回当前天气数据
        },
        // 预测计算函数
        (weatherData) => {
          if (!weatherData) return null;
          // 传递天气数据、当前日期、经纬度
          return predictionController.predictionService.calculatePrediction(
            weatherData,
            new Date(),
            location.lat,
            location.lon
          );
        }
      );

      this.surroundingData = data;

      // 渲染雷达图
      this.renderSurroundingRadar(data);

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
    }
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

    // 渲染雷达图
    const success = this.radarChartService.renderRadarChart('radar-chart', points, {
      width: 400,
      height: 400,
      radius: 150,
      showLabels: true,
      showScores: true,
      showDistance: true,
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
      container.innerHTML = `<p style="color: #666;">${this.i18n.t('surrounding.noData') || '当前周边区域火烧云观赏条件一般'}</p>`;
      return;
    }

    container.innerHTML = bestPoints.map(p => {
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
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border-color, #e0e0e0);">
          <span>${p.name} (${p.label})</span>
          <span style="${qualityClass} font-weight: 600;">${p.score}分 - ${qualityText}</span>
        </div>
      `;
    }).join('');
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
    alert(`${point.name}方向\n评分: ${point.score}分\n距离: ${point.distance}公里`);
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
}

export default WeatherController;
