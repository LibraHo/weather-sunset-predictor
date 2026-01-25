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
      // Windy API GFS 模型支持的参数
      // 使用 convPrecip 代替 precip，使用cape 作为额外参数
      parameters: ['temp', 'rh', 'wind', 'pressure', 'lclouds', 'convPrecip', 'mclouds', 'hclouds', 'cape', 'gh'],
      levels: ['surface'],
      key: this.apiKey
      // 注意：Windy Point Forecast API 不接受 hours 参数
      // API 返回固定的小时数（通常为80小时，取决于Windy服务器）
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
    // clouds 不再使用，用 lclouds/mclouds/hclouds 计算总云量
    const windU = data['wind_u-surface'] || [];
    const windV = data['wind_v-surface'] || [];
    const pressure = data['pressure-surface'] || [];

    // Windy API 返回的温度是开尔文，需要转换为摄氏度
    // K = C + 273.15
    const tempsCelsius = temps.map(tempKelvin => {
      const tempC = tempKelvin - 273.15;
      return tempC;
    });

    // Windy API 返回的时间戳可能是秒为单位，需要转换为毫秒
    const timestampsMs = timestamps.map(ts => {
      // 如果时间戳小于某个阈值（比如10000000000秒=1970年后的某个时间），则认为是秒为单位
      // 10000000000秒 = 1970年后的约317年
      // 10000000000毫秒 = 1970年后的约115天
      if (ts < 10000000000) {
        return ts * 1000; // 转换为毫秒
      }
      return ts; // 已经是毫秒
    });

    // Windy API 返回的气压可能是kPa或Pa为单位，需要转换为hPa
    const pressureHPa = pressure.map(p => {
      // 如果气压值在 80-120 范围，可能是kPa，需要乘以10转换为hPa
      // 例如：101 kPa -> 1010 hPa（接近标准大气压1013 hPa）
      if (p >= 80 && p <= 150) {
        return p * 10; // kPa -> hPa
      }
      // 如果气压值 > 10000，很可能是Pa，需要除以100转换为hPa
      if (p > 10000) {
        return p / 100; // Pa -> hPa
      }
      return p; // 已经是hPa
    });
    // visibility 和 wind_direction 不在 API 返回中
    const visibility = data['visibility-surface'] || [];
    const lowClouds = data['lclouds-surface'] || [];
    const midClouds = data['mclouds-surface'] || [];
    const highClouds = data['hclouds-surface'] || [];
    // convPrecip 是 convective precipitation（对流降水）
    const precipitation = data['convPrecip-surface'] || [];
    const windDirectionData = data['wind_direction-surface'] || [];
    const cape = data['cape-surface'] || []; // 不用于预测，但记录一下

    const weatherDataArray = [];

    for (let i = 0; i < timestamps.length; i++) {
      // 计算总云量（低+中+高层云的平均值）
      const cloudCover = ((lowClouds[i] || 0) + (midClouds[i] || 0) + (highClouds[i] || 0)) / 3;

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
        timestampsMs[i], // 使用转换后的毫秒时间戳
        tempsCelsius[i], // 使用转换后的摄氏度
        humidity[i] || 0,
        cloudCover, // 使用计算的总云量
        windSpeed,
        pressureHPa[i] || 1013, // 使用转换后的hPa气压
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
    console.log(`[WindyAPIService] 第一条数据时间: ${new Date(timestampsMs[0]).toLocaleString('zh-CN')}`);
    console.log(`[WindyAPIService] 最后一条数据时间: ${new Date(timestampsMs[timestampsMs.length - 1]).toLocaleString('zh-CN')}`);
    console.log(`[WindyAPIService] 气压样本: ${pressureHPa.slice(0, 3).map(p => `${p} hPa`).join(', ')}`);
    console.log(`[WindyAPIService] 温度样本 (开尔文 -> 摄氏度):`, temps.slice(0, 5).map((k, i) => `${k}K -> ${tempsCelsius[i].toFixed(1)}°C`));
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
