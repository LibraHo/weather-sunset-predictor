/**
 * WindyAPIService - Windy API 服务
 * 
 * 负责与 Windy Point Forecast API 通信，获取天气数据
 */

import WeatherData from '../models/WeatherData.js';

class WindyAPIService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.windy.com/api/point-forecast/v2';
  }

  /**
   * 获取指定位置的天气数据
   * @param {number} lat - 纬度
   * @param {number} lon - 经度
   * @param {number} hours - 预测小时数（默认168小时/7天）
   * @returns {Promise<WeatherData[]>} 天气数据数组（最多168小时预测）
   */
  async fetchWeatherData(lat, lon, hours = 168) {
    if (!this.apiKey) {
      throw new Error('API密钥未设置');
    }

    // 验证坐标
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      throw new Error('无效的坐标');
    }

    // 验证小时数（Windy API 最多支持 168 小时）
    if (hours < 1 || hours > 168) {
      throw new Error('预测小时数必须在1到168之间');
    }

    const requestBody = {
      lat: lat,
      lon: lon,
      model: 'gfs',
      // Task 12.2: 添加新气象参数 - precip（降水）、wind_direction（风向）、mclouds（中云）、hclouds（高云）
      parameters: ['temp', 'rh', 'clouds', 'wind', 'pressure', 'visibility', 'lclouds', 'precip', 'wind_direction', 'mclouds', 'hclouds'],
      levels: ['surface'],
      key: this.apiKey
    };

    try {
      console.log('[WindyAPIService] 发送请求到 Windy API:', { lat, lon, hours, parameters: requestBody.parameters });
      
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        await this.handleAPIError(response);
      }

      const data = await response.json();
      console.log('[WindyAPIService] 收到响应:', data);

      return this.parseWeatherData(data);
    } catch (error) {
      if (error.message.includes('API')) {
        throw error;
      }
      console.error('[WindyAPIService] 网络错误:', error);
      throw new Error('网络连接失败，请检查网络设置');
    }
  }

  /**
   * 处理 API 错误响应
   * @param {Response} response - Fetch 响应对象
   */
  async handleAPIError(response) {
    let errorMessage = '未知错误';
    
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch (e) {
      // 无法解析错误响应
    }

    switch (response.status) {
      case 401:
        throw new Error('API密钥无效，请检查您的密钥');
      case 403:
        throw new Error('API访问被拒绝，请检查您的权限');
      case 429:
        throw new Error('API请求次数超限，请稍后再试');
      case 500:
      case 502:
      case 503:
        throw new Error('Windy服务暂时不可用，请稍后再试');
      default:
        throw new Error(`API请求失败: ${errorMessage}`);
    }
  }

  /**
   * 解析 Windy API 响应数据
   * @param {Object} data - API 响应数据
   * @returns {WeatherData[]} 天气数据数组
   */
  parseWeatherData(data) {
    if (!data || !data.ts || !data['temp-surface']) {
      throw new Error('API返回数据格式错误');
    }

    const timestamps = data.ts;
    const temps = data['temp-surface'];
    const humidity = data['rh-surface'] || [];
    const clouds = data['clouds-surface'] || [];
    const windU = data['wind_u-surface'] || [];
    const windV = data['wind_v-surface'] || [];
    const pressure = data['pressure-surface'] || [];
    const visibility = data['visibility-surface'] || [];
    const lowClouds = data['lclouds-surface'] || [];
    const midClouds = data['mclouds-surface'] || [];
    const highClouds = data['hclouds-surface'] || [];
    const precipitation = data['precip-surface'] || [];
    const windDirectionData = data['wind_direction-surface'] || [];

    const weatherDataArray = [];

    for (let i = 0; i < timestamps.length; i++) {
      // 计算风速（从 u 和 v 分量）
      const windSpeed = Math.sqrt(
        Math.pow(windU[i] || 0, 2) + Math.pow(windV[i] || 0, 2)
      ) * 3.6; // 转换为 km/h

      // 获取风向：优先使用API提供的wind_direction，否则从u和v分量计算
      let windDirection = windDirectionData[i];
      if (windDirection === undefined && windU[i] !== undefined && windV[i] !== undefined) {
        windDirection = (Math.atan2(windU[i], windV[i]) * 180 / Math.PI + 180) % 360;
      } else if (windDirection === undefined) {
        windDirection = 0;
      }

      const weatherData = new WeatherData(
        timestamps[i],
        temps[i],
        humidity[i] || 0,
        clouds[i] || 0,
        windSpeed,
        pressure[i] || 1013,
        visibility[i] || 10,
        lowClouds[i] || 0,
        precipitation[i] || 0,
        windDirection,
        highClouds[i] || 0,
        midClouds[i] || 0
      );

      weatherDataArray.push(weatherData);
    }

    console.log(`[WindyAPIService] 解析了 ${weatherDataArray.length} 条天气数据`);
    return weatherDataArray;
  }

  /**
   * 验证 API 密钥
   * @returns {Promise<boolean>} 密钥是否有效
   */
  async validateAPIKey() {
    try {
      // 使用一个已知的坐标测试 API
      await this.fetchWeatherData(39.9042, 116.4074); // 北京
      return true;
    } catch (error) {
      if (error.message.includes('API密钥无效')) {
        return false;
      }
      // 其他错误（如网络错误）不代表密钥无效
      throw error;
    }
  }
}

export default WindyAPIService;
