/**
 * WindyAPIService - 天气 API 服务
 *
 * 负责与后端服务器通信，获取天气数据。
 * 后端通过 ProviderOrchestrator 调度具体的供应商。
 */

import WeatherData from '../models/WeatherData.js';
import { loadConfig } from '../../config.api.js';
import OpenMeteoClientWeatherService from './OpenMeteoClientWeatherService.js';

class WindyAPIService {
  constructor(_apiKey, options = {}) {
    this.proxyURL = options.proxyURL || 'http://localhost:3000'; // 后端代理URL
    this.timeout = options.timeout || 15000;
    this.featureFlagTimeout = options.featureFlagTimeout || 5000;
    this.clientWeatherService = new OpenMeteoClientWeatherService();

    console.log(`[WindyAPIService] 初始化后端代理模式`);
    console.log(`[WindyAPIService] 后端代理地址: ${this.proxyURL}`);
  }

  _createTimeoutError() {
    const error = new Error('Request timeout, please retry');
    error.code = 'WEATHER_UPSTREAM_TIMEOUT';
    return error;
  }

  _isAbortError(error) {
    return error?.name === 'AbortError' || error?.code === 20;
  }

  async _fetchWithTimeout(url, options = {}, timeoutMs = this.timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal
      });
    } catch (error) {
      if (this._isAbortError(error)) {
        throw this._createTimeoutError();
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 获取指定位置的天气数据
   * @param {number} lat - 纬度
   * @param {number} lon - 经度
   * @param {number} hours - 预测小时数（默认168小时/7天）
   * @returns {Promise<WeatherData[] & {providerMeta: Object}>} 天气数据数组（最多168小时预测），附带 providerMeta 属性
   */
  async fetchWeatherData(lat, lon, hours = 168) {
    // 验证坐标
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      throw new Error('无效的坐标');
    }

    // 验证小时数
    if (hours < 1 || hours > 168) {
      throw new Error('预测小时数必须在1到168之间');
    }

    const config = loadConfig();
    const mode = config.weatherFetchMode || 'backend';
    const weatherModel = localStorage.getItem('weather_model') || 'ecmwf_ifs025';

    if (mode === 'client') {
      console.warn('[WindyAPIService] WEATHER_FETCH_MODE=client，浏览器直接获取天气数据');
      return this.clientWeatherService.fetchWeatherData(lat, lon, hours, weatherModel);
    }

    try {
      return await this.fetchFromProxy(lat, lon, hours);
    } catch (error) {
      if (mode === 'client-fallback' && this._isWeatherFallbackEligible(error)) {
        console.warn('[WindyAPIService] 后端天气数据不可用，切换到浏览器 fallback:', error.message);
        return this.clientWeatherService.fetchWeatherData(lat, lon, hours, weatherModel);
      }
      throw error;
    }
  }


  _isWeatherFallbackEligible(error) {
    const code = String(error?.code || '').toLowerCase();
    const message = String(error?.message || '').toLowerCase();
    return code === 'weather_rate_limited'
      || code === 'weather_quota_exceeded'
      || code === 'weather_upstream_timeout'
      || code === 'weather_provider_unavailable'
      || message.includes('429')
      || message.includes('rate')
      || message.includes('quota')
      || message.includes('timeout')
      || message.includes('超时')
      || message.includes('频繁')
      || message.includes('weather_rate_limited')
      || message.includes('weather_quota_exceeded')
      || message.includes('weather_upstream_timeout')
      || message.includes('weather_provider_unavailable');
  }

  /**
   * 通过后端代理获取天气数据
   * @param {number} lat - 纬度
   * @param {number} lon - 经度
   * @param {number} hours - 预测小时数
   * @returns {Promise<WeatherData[] & {providerMeta: Object}>} 天气数据数组，附带 providerMeta 属性
   */
  async fetchFromProxy(lat, lon, hours) {
    const weatherModel = localStorage.getItem('weather_model') || 'ecmwf_ifs025';
    const url = `${this.proxyURL}/api/weather/forecast?lat=${lat}&lon=${lon}&hours=${hours}&model=${encodeURIComponent(weatherModel)}`;

    console.log('[WindyAPIService] 通过后端代理获取天气数据:', { lat, lon, hours, weatherModel });

    // Phase15 任务63.4：仅当后端 windyEnabled=true 时透传用户 Key
    const headers = {};
    if (this._windyEnabled !== false) {
      // 懒加载 feature flags（已缓存则直接用）
      if (this._windyEnabled === undefined) {
        try {
          const featResp = await this._fetchWithTimeout(
            `${this.proxyURL}/api/config/features`,
            {},
            this.featureFlagTimeout
          );
          const flags = featResp.ok ? await featResp.json() : {};
          this._windyEnabled = flags.windyEnabled === true;
        } catch {
          this._windyEnabled = false;
        }
      }
      if (this._windyEnabled) {
        const userKey = localStorage.getItem('user_windy_api_key');
        if (userKey) headers['X-Windy-API-Key'] = userKey;
      }
    }

    try {
      const response = await this._fetchWithTimeout(url, { headers });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const backendError = new Error(errorData.error?.message || `后端请求失败: ${response.status}`);
        backendError.code = errorData.error?.code || null;
        backendError.status = response.status;
        throw backendError;
      }

      const result = await response.json();
      console.log('[WindyAPIService] 后端代理响应 providerMeta:', result.providerMeta);

      // 解析后端返回的数据
      const dataArray = this.parseProxyData(result.data, result.providerMeta);
      // 附加 providerMeta 到数组对象上（兼容现有结构，同时暴露元数据）
      if (result.providerMeta) {
        dataArray.providerMeta = result.providerMeta;
      }
      return dataArray;
    } catch (error) {
      if (error.code ||
          error.message.includes('后端') ||
          error.message.includes('参数') ||
          error.message.includes('超时') ||
          error.message.includes('频繁')) {
        throw error;
      }
      console.error('[WindyAPIService] 后端代理网络错误:', error);
      throw new Error('无法连接到后端服务器，请检查服务器是否运行');
    }
  }

  /**
   * 解析后端代理返回的数据
   * @param {Array} data - 后端返回的天气数据数组
   * @returns {WeatherData[]} 天气数据数组
   */
  parseProxyData(data, providerMeta = null) {
    if (!Array.isArray(data)) {
      throw new Error('后端返回数据格式错误');
    }

    const timezone = providerMeta?.timezone || null;

    const weatherDataArray = data.map(item => {
      const wd = new WeatherData(
        item.timestamp,
        item.temp,
        item.humidity,
        item.cloudCover,
        item.windSpeed,
        item.pressure,
        item.visibility ?? 10,
        item.lowClouds ?? 0,
        item.precipitation ?? 0,
        item.windDirection ?? 0,
        item.highClouds ?? 0,
        item.midClouds ?? 0
      );
      // 非侵入式附加，用于图表按目标城市时区显示
      if (timezone) wd.timezone = timezone;
      wd.aerosolOpticalDepth = item.aerosolOpticalDepth ?? null;
      wd.dust = item.dust ?? null;
      wd.pm2_5 = item.pm2_5 ?? null;
      wd.pm10 = item.pm10 ?? null;
      wd.aqi = item.aqi ?? null;
      wd.shortwaveRadiation = item.shortwaveRadiation ?? null;
      wd.directRadiation = item.directRadiation ?? null;
      wd.diffuseRadiation = item.diffuseRadiation ?? null;
      return wd;
    });

    console.log(`[WindyAPIService] 从后端代理解析了 ${weatherDataArray.length} 条天气数据`);
    return weatherDataArray;
  }

  /**
   * 验证连接（通过后端代理）
   * @returns {Promise<boolean>} 连接是否正常
   */
  async validateAPIKey() {
    try {
      // 使用一个已知的坐标测试代理连接
      await this.fetchWeatherData(39.9042, 116.4074); // 北京
      return true;
    } catch (error) {
      // 网络错误不代表密钥无效
      throw error;
    }
  }
}

export default WindyAPIService;
