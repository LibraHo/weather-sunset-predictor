/**
 * WindyAPIService - Windy API 服务
 *
 * 负责与 Windy Point Forecast API 通信，获取天气数据
 * 通过后端服务器代理调用（无需前端密钥）
 */

import WeatherData from '../models/WeatherData.js';

class WindyAPIService {
  constructor(_apiKey, options = {}) {
    this.proxyURL = options.proxyURL || 'http://localhost:3001'; // 后端代理URL

    console.log(`[WindyAPIService] 初始化后端代理模式`);
    console.log(`[WindyAPIService] 后端代理地址: ${this.proxyURL}`);
  }

  /**
   * 获取指定位置的天气数据
   * @param {number} lat - 纬度
   * @param {number} lon - 经度
   * @param {number} hours - 预测小时数（默认168小时/7天）
   * @returns {Promise<WeatherData[]>} 天气数据数组（最多168小时预测）
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
   * @returns {Promise<WeatherData[]>} 天气数据数组
   */
  async fetchFromProxy(lat, lon, hours) {
    const url = `${this.proxyURL}/api/weather/forecast?lat=${lat}&lon=${lon}&hours=${hours}`;

    console.log('[WindyAPIService] 通过后端代理获取天气数据:', { lat, lon, hours });

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        await this.handleProxyError(response);
      }

      const result = await response.json();
      console.log('[WindyAPIService] 后端代理响应:', result);

      // 解析后端返回的数据
      return this.parseProxyData(result.data);
    } catch (error) {
      if (error.message.includes('API') || error.message.includes('后端') ||
          error.message.includes('参数') || error.message.includes('频繁')) {
        throw error;
      }
      console.error('[WindyAPIService] 后端代理网络错误:', error);
      throw new Error('无法连接到后端服务器，请检查服务器是否运行');
    }
  }

  /**
   * 处理后端代理错误响应
   * @param {Response} response - Fetch 响应对象
   */
  async handleProxyError(response) {
    let errorMessage = '后端服务器错误';

    try {
      const errorData = await response.json();
      errorMessage = errorData.error?.message || errorMessage;
    } catch (e) {
      // 无法解析错误响应
    }

    switch (response.status) {
      case 400:
        throw new Error(`请求参数错误: ${errorMessage}`);
      case 401:
      case 403:
        throw new Error(`Windy API 密钥错误: ${errorMessage}`);
      case 429:
        throw new Error('请求过于频繁，请稍后再试');
      case 500:
      case 502:
      case 503:
        throw new Error('后端服务器暂时不可用，请稍后再试');
      default:
        throw new Error(`后端服务器错误: ${errorMessage}`);
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
      if (error.message.includes('API密钥无效') || error.message.includes('Windy API 密钥错误')) {
        return false;
      }
      // 其他错误（如网络错误）不代表密钥无效
      throw error;
    }
  }
}

export default WindyAPIService;
