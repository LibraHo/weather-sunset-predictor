const axios = require('axios');
const https = require('https');

/**
 * Windy API 服务（Legacy）
 * 任务53.2：已从主链路摘除，仅用于 emergency fallback。
 */

const WINDY_API_URL = 'https://api.windy.com/api/point-forecast/v2';

class WindyService {
  constructor() {
    this.apiKey = process.env.WINDY_API_KEY;
    if (!this.apiKey) {
      console.warn('⚠️  警告: WINDY_API_KEY 环境变量未设置');
    }
  }

  /**
   * 获取天气数据（Legacy fallback）
   * @param {number} lat - 纬度
   * @param {number} lon - 经度
   * @param {number} hours - 预测小时数（默认168，即7天）
   * @returns {Promise<Object>} Windy API 响应数据
   */
  async fetchWeatherData(lat, lon, hours = 168) {
    // 验证输入参数
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      throw new Error('无效的坐标参数');
    }

    if (lat < -90 || lat > 90) {
      throw new Error('纬度必须在 -90 到 90 之间');
    }

    if (lon < -180 || lon > 180) {
      throw new Error('经度必须在 -180 到 180 之间');
    }

    if (hours < 1 || hours > 168) {
      throw new Error('小时数必须在 1 到 168 之间');
    }

    try {
      const effectiveApiKey = this.apiKey;

      const requestBody = {
        lat,
        lon,
        model: 'gfs',
        parameters: [
          'temp',
          'rh',
          'wind',
          'pressure',
          'lclouds',
          'mclouds',
          'hclouds',
          'convPrecip',
          'cape'
        ],
        levels: ['surface'],
        key: effectiveApiKey
      };

      console.log(`[Windy API] 请求天气数据: lat=${lat}, lon=${lon}, hours=${hours}`);

      const apiData = await this.requestWindyData(requestBody);
      const parsedData = this.parseWindyResponse(apiData);
      const requestedHours = Math.min(hours, parsedData.hours);
      return {
        hours: requestedHours,
        data: parsedData.data.slice(0, requestedHours)
      };
    } catch (error) {
      console.error('[Windy API] 请求失败:', error.message);

      // 处理不同类型的错误
      if (error.response) {
        // API 返回了错误响应
        const { status, data } = error.response;

        if (status === 401 || status === 403) {
          throw new Error('Windy API 密钥无效或已过期');
        } else if (status === 429) {
          throw new Error('Windy API 请求过于频繁，请稍后再试');
        } else if (status >= 500) {
          throw new Error('Windy API 服务器错误，请稍后再试');
        } else {
          throw new Error(`Windy API 错误: ${data.message || '未知错误'}`);
        }
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('请求超时，请检查网络连接');
      } else if (error.code === 'ECONNREFUSED') {
        throw new Error('无法连接到 Windy API，请检查网络');
      } else {
        throw error;
      }
    }
  }


  async requestWindyData(requestBody) {
    try {
      const response = await axios.post(WINDY_API_URL, requestBody, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10秒超时
      });
      return response.data;
    } catch (error) {
      // 某些代理环境下 axios 可能出现重定向循环，回退到 Node.js https（不经过命令行，避免敏感参数泄漏）
      if (error.code === 'ERR_FR_TOO_MANY_REDIRECTS' || error.code === 'ENETUNREACH') {
        console.warn(`[Windy API] axios 请求失败(${error.code})，尝试使用 https 回退`);
        return this._httpsPost(WINDY_API_URL, requestBody);
      }
      throw error;
    }
  }

  /**
   * 使用 Node.js 内置 https 模块发送 POST 请求（不经过命令行，API Key 不会暴露给 ps）
   * @param {string} url - 请求 URL
   * @param {Object} body - 请求体对象
   * @returns {Promise<Object>} 解析后的响应体
   * @private
   */
  _httpsPost(url, body) {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const bodyStr = JSON.stringify(body);

      const options = {
        hostname: parsed.hostname,
        path: parsed.pathname + (parsed.search || ''),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr)
        },
        timeout: 15000
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`[Windy API] https 回退：响应解析失败 - ${e.message}`));
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('[Windy API] https 回退：请求超时'));
      });

      req.on('error', (e) => {
        reject(new Error(`[Windy API] https 回退：请求失败 - ${e.message}`));
      });

      req.write(bodyStr);
      req.end();
    });
  }

  /**
   * 解析 Windy API 响应数据
   * @param {Object} data - Windy API 原始响应数据
   * @returns {Object} 解析后的天气数据
   */
  parseWindyResponse(data) {
    if (!data || !data.ts) {
      throw new Error('无效的 Windy API 响应数据');
    }

    // 提取时间戳
    const timestamps = data.ts;
    const hours = timestamps.length;

    // 构造天气数据数组
    const weatherData = timestamps.map((timestamp, index) => {
      const lowClouds = this.getValue(data, 'lclouds-surface', index) || 0;
      const midClouds = this.getValue(data, 'mclouds-surface', index) || 0;
      const highClouds = this.getValue(data, 'hclouds-surface', index) || 0;
      // 计算总云量：取三层云量的最大值或加权平均
      const cloudCover = Math.min(100, Math.max(lowClouds, midClouds, highClouds, (lowClouds + midClouds + highClouds) / 3));
      
      // 温度转换：Windy API 返回开尔文，转换为摄氏度
      const tempKelvin = this.getValue(data, 'temp-surface', index);
      const tempCelsius = tempKelvin !== null ? tempKelvin - 273.15 : null;
      
      // 气压转换：Windy API 返回帕斯卡，转换为百帕
      const pressurePa = this.getValue(data, 'pressure-surface', index);
      const pressureHPa = pressurePa !== null ? pressurePa / 100 : null;
      
      return {
        timestamp,
        temp: tempCelsius,
        humidity: this.getValue(data, 'rh-surface', index),
        cloudCover: cloudCover,
        windSpeed: this.calculateWindSpeed(
          this.getValue(data, 'wind_u-surface', index),
          this.getValue(data, 'wind_v-surface', index)
        ),
        windDirection: this.calculateWindDirection(
          this.getValue(data, 'wind_u-surface', index),
          this.getValue(data, 'wind_v-surface', index)
        ),
        pressure: pressureHPa,
        visibility: this.estimateVisibility(
          this.getValue(data, 'rh-surface', index),
          this.getValue(data, 'convPrecip-surface', index) || 0,
          Math.min(100, Math.max(lowClouds, midClouds, highClouds, (lowClouds + midClouds + highClouds) / 3))
        ),
        precipitation: this.getValue(data, 'convPrecip-surface', index) || 0,
        lowClouds: lowClouds,
        midClouds: midClouds,
        highClouds: highClouds
      };
    });

    return {
      hours,
      data: weatherData
    };
  }

  /**
   * 从响应数据中安全地获取值
   */
  getValue(data, key, index) {
    if (data[key] && typeof data[key][index] !== 'undefined') {
      return data[key][index];
    }
    return null;
  }

  /**
   * 根据湿度、降水和云量估算能见度（km）
   *
   * Windy Point Forecast API 不提供能见度字段，此方法使用
   * 气象学经验规则从可用数据推算：
   * - 有降水：5 km
   * - 湿度 > 90%（接近饱和）：8 km
   * - 湿度 > 80% 且厚云：10 km
   * - 湿度 > 70%：15 km
   * - 其余晴好条件：20 km
   *
   * @param {number|null} humidity - 相对湿度（0-100）
   * @param {number} precipitation - 降水量（mm/h）
   * @param {number} cloudCover - 总云量（0-100）
   * @returns {number} 估算能见度（km）
   */
  estimateVisibility(humidity, precipitation, cloudCover) {
    const rh = humidity ?? 50;
    const precip = precipitation ?? 0;
    const cloud = cloudCover ?? 0;

    if (precip > 0.1) return 5;          // 降水时能见度较差
    if (rh > 90) return 8;               // 接近饱和，可能有雾
    if (rh > 80 && cloud > 70) return 10; // 高湿 + 厚云
    if (rh > 70) return 15;              // 湿度较高
    return 20;                           // 晴好条件
  }

  /**
   * 计算风速（从 u 和 v 分量）
   */
  calculateWindSpeed(u, v) {
    if (u === null || v === null) return null;
    return Math.sqrt(u * u + v * v);
  }

  /**
   * 计算风向（从 u 和 v 分量）
   */
  calculateWindDirection(u, v) {
    if (u === null || v === null) return null;
    const direction = Math.atan2(u, v) * (180 / Math.PI);
    return (direction + 360) % 360;
  }
}

// 同时导出类（便于依赖注入和单元测试实例化）和默认单例（供现有调用方使用）
const defaultInstance = new WindyService();
module.exports = defaultInstance;
module.exports.WindyService = WindyService;
