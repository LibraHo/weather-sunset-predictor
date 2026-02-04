/**
 * PredictionAPIService - 后端预测 API 客户端
 *
 * 调用后端预测 API，获取火烧云预测结果
 *
 * 需求：22 (前后端分离 - Phase 1)
 */

import SunsetPrediction from '../models/SunsetPrediction.js';

class PredictionAPIService {
  /**
   * 创建 API 服务实例
   *
   * @param {string} baseURL - 后端 API 基础 URL
   */
  constructor(baseURL = 'http://localhost:3000') {
    this.baseURL = baseURL;
    this.timeout = 10000; // 10秒超时
  }

  /**
   * 调用后端基础预测 API
   *
   * @param {Object} weatherData - 天气数据对象
   * @param {Date} date - 预测日期
   * @param {number} lat - 纬度
   * @param {number} lon - 经度
   * @param {string} type - 预测类型 ('sunrise' | 'sunset')
   * @returns {Promise<SunsetPrediction>} 预测结果对象
   * @throws {Error} API 调用失败时抛出错误
   *
   * 需求：22.4 - 前端改为调用后端 API
   */
  async calculate(weatherData, date, lat, lon, type = 'sunset') {
    const startTime = Date.now();
    console.log(`[PredictionAPIService] 调用后端预测 API: lat=${lat}, lon=${lon}, type=${type}`);

    try {
      // 构建请求 URL
      const url = `${this.baseURL}/api/prediction/calculate`;

      // 格式化日期为 ISO 字符串
      const dateString = date instanceof Date ? date.toISOString() : date;

      // 构建请求体
      const requestBody = {
        weatherData: {
          cloudCover: weatherData.cloudCover,
          humidity: weatherData.humidity,
          visibility: weatherData.visibility,
          lowCloudCover: weatherData.lowCloudCover,
          highClouds: weatherData.highClouds || 0,
          midClouds: weatherData.midClouds || 0,
          lowClouds: weatherData.lowClouds || 0
        },
        date: dateString,
        lat: lat,
        lon: lon,
        type: type
      };

      // 发送请求
      const response = await this._fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      // 解析响应
      const result = await response.json();

      // 检查响应状态
      if (!result.success) {
        throw new Error(result.error?.message || '预测计算失败');
      }

      // 转换为 SunsetPrediction 模型
      const prediction = this._convertToPrediction(result.data);

      const elapsed = Date.now() - startTime;
      console.log(`[PredictionAPIService] API 调用成功: ${elapsed}ms, score=${prediction.score}`);

      return prediction;

    } catch (error) {
      console.error(`[PredictionAPIService] API 调用失败:`, error);
      throw new Error(`后端预测 API 调用失败: ${error.message}`);
    }
  }

  /**
   * 带超时的 fetch 请求
   *
   * @param {string} url - 请求 URL
   * @param {Object} options - fetch 选项
   * @returns {Promise<Response>} fetch 响应
   * @private
   */
  async _fetchWithTimeout(url, options) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      // 检查 HTTP 状态码
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return response;

    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 将后端响应转换为前端 SunsetPrediction 模型
   *
   * @param {Object} data - 后端返回的预测数据
   * @returns {SunsetPrediction} 预测对象
   * @private
   */
  _convertToPrediction(data) {
    // 转换日期字符串为 Date 对象
    const date = new Date(data.date);
    const sunsetTime = new Date(data.sunsetTime);
    const sunriseTime = new Date(data.sunriseTime);
    const goldenHour = {
      start: new Date(data.goldenHour.start),
      end: new Date(data.goldenHour.end)
    };
    const blueHour = {
      start: new Date(data.blueHour.start),
      end: new Date(data.blueHour.end)
    };

    // 创建 SunsetPrediction 对象
    return new SunsetPrediction(
      date,
      data.score,
      data.quality,
      data.factors,
      sunsetTime,
      sunriseTime,
      data.type,
      goldenHour,
      blueHour,
      data.sunAzimuth,
      data.cloudLayers
    );
  }

  /**
   * 检查后端 API 可用性
   *
   * @returns {Promise<boolean>} API 是否可用
   */
  async checkHealth() {
    try {
      const response = await fetch(`${this.baseURL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5秒超时
      });
      return response.ok;
    } catch (error) {
      console.warn(`[PredictionAPIService] 健康检查失败:`, error.message);
      return false;
    }
  }
}

// ========== 导出 ==========

export default PredictionAPIService;
