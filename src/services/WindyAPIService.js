/**
 * WindyAPIService - 天气 API 服务
 *
 * 负责与后端服务器通信，获取天气数据。
 * 后端通过 ProviderOrchestrator 调度具体的供应商。
 */

import WeatherData from '../models/WeatherData.js';

class WindyAPIService {
  constructor(_apiKey, options = {}) {
    this.proxyURL = options.proxyURL || 'http://localhost:3000'; // 后端代理URL

    console.log(`[WindyAPIService] 初始化后端代理模式`);
    console.log(`[WindyAPIService] 后端代理地址: ${this.proxyURL}`);
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

    return this.fetchFromProxy(lat, lon, hours);
  }

  /**
   * 通过后端代理获取天气数据
   * @param {number} lat - 纬度
   * @param {number} lon - 经度
   * @param {number} hours - 预测小时数
   * @returns {Promise<WeatherData[] & {providerMeta: Object}>} 天气数据数组，附带 providerMeta 属性
   */
  async fetchFromProxy(lat, lon, hours) {
    const url = `${this.proxyURL}/api/weather/forecast?lat=${lat}&lon=${lon}&hours=${hours}`;

    console.log('[WindyAPIService] 通过后端代理获取天气数据:', { lat, lon, hours });

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`后端请求失败: ${response.status}`);
      }

      const result = await response.json();
      console.log('[WindyAPIService] 后端代理响应 providerMeta:', result.providerMeta);

      // 解析后端返回的数据
      const dataArray = this.parseProxyData(result.data);
      // 附加 providerMeta 到数组对象上（兼容现有结构，同时暴露元数据）
      if (result.providerMeta) {
        dataArray.providerMeta = result.providerMeta;
      }
      return dataArray;
    } catch (error) {
      if (error.message.includes('后端') ||
          error.message.includes('参数') ||
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
  parseProxyData(data) {
    if (!Array.isArray(data)) {
      throw new Error('后端返回数据格式错误');
    }

    const weatherDataArray = data.map(item => {
      return new WeatherData(
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
