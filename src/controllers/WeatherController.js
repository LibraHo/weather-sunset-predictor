/**
 * WeatherController - 天气数据控制器
 * 
 * 负责获取和管理天气数据，包括缓存逻辑
 * 支持7天概览和24小时详细视图（需求11）
 */

import WindyAPIService from '../services/WindyAPIService.js';
import MockWindyAPIService from '../services/MockWindyAPIService.js';
// 暂时禁用 ChartService 导入，使用内联简化版本

class WeatherController {
  constructor(storageService, apiKey, useMockAPI = true) {
    this.storageService = storageService;
    this.useMockAPI = useMockAPI;
    
    if (useMockAPI) {
      this.windyAPIService = new MockWindyAPIService(apiKey || 'mock-api-key');
    } else {
      this.windyAPIService = apiKey ? new WindyAPIService(apiKey) : null;
    }
    
    // 使用简化的内联 ChartService
    this.chartService = {
      renderTemperatureChart: (data, id) => this._renderSimpleChart(data, id, '温度', '°C', '#ff6b6b'),
      renderPrecipitationChart: (data, id) => this._renderSimpleChart(data, id, '降水', 'mm', '#4dabf7'),
      renderHumidityChart: (data, id) => this._renderSimpleChart(data, id, '湿度', '%', '#51cf66'),
      renderWindChart: (data, id) => this._renderSimpleChart(data, id, '风速', 'km/h', '#748ffc'),
      renderPressureChart: (data, id) => this._renderSimpleChart(data, id, '气压', 'hPa', '#ffa94d'),
      renderCloudChart: (data, id) => this._renderSimpleChart(data, id, '云量', '%', '#868e96')
    };
    
    this.currentWeatherData = null;
    this.currentLocation = null;
    
    // 需求11：视图状态管理
    this.currentView = 'overview'; // 'overview' 或 'hourly'
    this.selectedDay = 'today'; // 'today' 或 'tomorrow'
    this.selectedParameter = 'temp'; // 'temp', 'precip', 'humidity', 'wind', 'pressure', 'clouds'
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
   */
  updateWeatherDisplay(weatherData) {
    if (!weatherData || weatherData.length === 0) {
      this.showError('没有可用的天气数据');
      return;
    }

    // 获取当前天气（第一个数据点）
    const currentWeather = weatherData[0];

    // 更新 UI 元素
    const elements = {
      temp: document.getElementById('current-temp'),
      humidity: document.getElementById('current-humidity'),
      cloudCover: document.getElementById('current-cloud-cover'),
      windSpeed: document.getElementById('current-wind-speed'),
      pressure: document.getElementById('current-pressure'),
      visibility: document.getElementById('current-visibility')
    };

    if (elements.temp) {
      elements.temp.textContent = `${currentWeather.temp.toFixed(1)}°C`;
    }
    if (elements.humidity) {
      elements.humidity.textContent = `${currentWeather.humidity.toFixed(0)}%`;
    }
    if (elements.cloudCover) {
      elements.cloudCover.textContent = `${currentWeather.cloudCover.toFixed(0)}%`;
    }
    if (elements.windSpeed) {
      elements.windSpeed.textContent = `${currentWeather.windSpeed.toFixed(1)} km/h`;
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
    const dayNames = ['今天', '明天', '后天'];
    const dayLabel = dayIndex < 3 ? dayNames[dayIndex] : date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });

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

    card.innerHTML = `
      <div class="day-label">${dayLabel}</div>
      <div class="weather-icon">${weatherIcon}</div>
      <div class="temp-range">
        <span class="max-temp">${maxTemp.toFixed(0)}°</span>
        <span class="temp-separator">/</span>
        <span class="min-temp">${minTemp.toFixed(0)}°</span>
      </div>
      <div class="precip-prob">${precipProb}% 降水</div>
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
   * 切换视图（概览/详细）
   * @param {string} view - 'overview' 或 'hourly'
   */
  switchView(view) {
    this.currentView = view;

    const overviewView = document.getElementById('weekly-overview');
    const hourlyView = document.getElementById('hourly-forecast');
    const overviewBtn = document.getElementById('overview-btn');
    const hourlyBtn = document.getElementById('hourly-btn');

    if (view === 'overview') {
      if (overviewView) overviewView.classList.remove('hidden');
      if (hourlyView) hourlyView.classList.add('hidden');
      if (overviewBtn) overviewBtn.classList.add('active');
      if (hourlyBtn) hourlyBtn.classList.remove('active');

      // 渲染概览
      if (this.currentWeatherData) {
        this.renderWeeklyOverview(this.currentWeatherData);
      }
    } else {
      if (overviewView) overviewView.classList.add('hidden');
      if (hourlyView) hourlyView.classList.remove('hidden');
      if (overviewBtn) overviewBtn.classList.remove('active');
      if (hourlyBtn) hourlyBtn.classList.add('active');

      // 渲染详细预报
      if (this.currentWeatherData) {
        this.renderHourlyForecast(this.currentWeatherData, this.selectedDay);
      }
    }

    console.log(`[WeatherController] 切换到 ${view} 视图`);
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
   * 渲染简化图表（内联版本，避免模块导入问题）
   * @private
   */
  _renderSimpleChart(hourlyData, containerId, label, unit, color) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const paramMap = {
      '温度': 'temp',
      '降水': 'precipitation', 
      '湿度': 'humidity',
      '风速': 'windSpeed',
      '气压': 'pressure',
      '云量': 'cloudCover'
    };

    const param = paramMap[label];
    const values = hourlyData.map(d => d[param]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    let html = `<div style="padding: 20px; background: #f8f9fa; border-radius: 8px;">`;
    html += `<h3 style="text-align: center; margin-bottom: 20px; color: ${color};">${label}变化</h3>`;
    html += `<div style="display: flex; justify-content: space-between; align-items: flex-end; height: 200px; border-bottom: 2px solid #dee2e6; padding: 0 10px;">`;
    
    hourlyData.forEach((d, i) => {
      const value = d[param];
      const height = ((value - min) / range) * 180;
      const time = new Date(d.timestamp).getHours();
      
      html += `<div style="flex: 1; display: flex; flex-direction: column; align-items: center; margin: 0 2px;">`;
      html += `<div style="font-size: 10px; color: #666; margin-bottom: 5px;">${value.toFixed(1)}</div>`;
      html += `<div style="width: 100%; background: ${color}; height: ${height}px; border-radius: 4px 4px 0 0; opacity: 0.8;"></div>`;
      if (i % 3 === 0) {
        html += `<div style="font-size: 11px; color: #666; margin-top: 5px;">${time}:00</div>`;
      }
      html += `</div>`;
    });
    
    html += `</div>`;
    html += `<div style="text-align: center; margin-top: 10px; color: #666;">单位: ${unit}</div>`;
    html += `</div>`;
    
    container.innerHTML = html;
  }
}

export default WeatherController;
