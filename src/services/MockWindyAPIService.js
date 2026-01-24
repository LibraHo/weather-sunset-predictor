/**
 * MockWindyAPIService - 模拟 Windy API 服务
 * 用于离线测试，不需要真实的 API 密钥和网络连接
 */

import WeatherData from '../models/WeatherData.js';

class MockWindyAPIService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    console.log('[MockWindyAPIService] 使用模拟 Windy API 服务（离线模式）');
  }

  async fetchWeatherData(lat, lon, hours = 168) {
    // 模拟网络延迟
    await this.simulateDelay(500, 1000);

    console.log(`[MockWindyAPIService] 生成模拟天气数据: lat=${lat}, lon=${lon}, hours=${hours}`);

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      throw new Error('无效的坐标');
    }

    // 验证小时数（Windy API 最多支持 168 小时）
    if (hours < 1 || hours > 168) {
      throw new Error('预测小时数必须在1到168之间');
    }

    // 生成指定小时数的天气数据（默认168小时/7天）
    const weatherDataArray = [];
    const now = Date.now();
    const hourInMs = 3600000;

    for (let i = 0; i < hours; i++) {
      const timestamp = now + (i * hourInMs);
      const weatherData = this.generateWeatherData(timestamp, i);
      weatherDataArray.push(weatherData);
    }

    return weatherDataArray;
  }

  generateWeatherData(timestamp, hourOffset) {
    const date = new Date(timestamp);
    const hour = date.getHours();
    const month = date.getMonth() + 1; // 1-12
    
    // 根据月份确定季节基准温度（北半球）
    let seasonalBaseTemp;
    if (month >= 12 || month <= 2) {
      // 冬季：-5°C 到 5°C
      seasonalBaseTemp = 0;
    } else if (month >= 3 && month <= 5) {
      // 春季：10°C 到 20°C
      seasonalBaseTemp = 15;
    } else if (month >= 6 && month <= 8) {
      // 夏季：25°C 到 35°C
      seasonalBaseTemp = 30;
    } else {
      // 秋季：10°C 到 20°C
      seasonalBaseTemp = 15;
    }
    
    // 温度：白天高，夜间低（日变化约8-12度）
    const isDaytime = hour >= 6 && hour <= 18;
    const dailyVariation = Math.sin((hour - 6) / 12 * Math.PI) * 6; // -6 到 +6
    const temp = seasonalBaseTemp + dailyVariation + (Math.random() - 0.5) * 3;

    // 湿度：早晚高，中午低
    const baseHumidity = 60 + Math.sin((hour - 6) / 12 * Math.PI) * 20;
    const humidity = Math.max(30, Math.min(90, baseHumidity + (Math.random() - 0.5) * 10));

    // 云量：傍晚时分可能有适合的云量
    const isEvening = hour >= 16 && hour <= 19;
    let cloudCover;
    if (isEvening) {
      cloudCover = 40 + Math.random() * 30;
    } else {
      cloudCover = Math.random() * 100;
    }

    const lowClouds = Math.random() * 40;
    const midClouds = Math.random() * 50;
    const highClouds = Math.random() * 30;
    const windSpeed = isDaytime ? 10 + Math.random() * 15 : 5 + Math.random() * 10;
    const windDirection = Math.random() * 360;
    const pressure = 1013 + (Math.random() - 0.5) * 20;
    const visibility = cloudCover < 50 ? 15 + Math.random() * 10 : 5 + Math.random() * 10;
    const precipitation = Math.random() < 0.3 ? Math.random() * 5 : 0; // 30%概率有降水

    return new WeatherData(
      timestamp,
      temp,
      humidity,
      cloudCover,
      windSpeed,
      pressure,
      visibility,
      lowClouds,
      precipitation,
      windDirection,
      highClouds,
      midClouds
    );
  }

  async simulateDelay(min, max) {
    const delay = min + Math.random() * (max - min);
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  async validateAPIKey() {
    await this.simulateDelay(300, 500);
    console.log('[MockWindyAPIService] API 密钥验证通过（模拟）');
    return true;
  }
}

export default MockWindyAPIService;
