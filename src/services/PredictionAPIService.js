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
  async calculate(weatherData, date, lat, lon, type = 'sunset', options = {}) {
    const startTime = Date.now();
    console.log(`[PredictionAPIService] 调用后端预测 API: lat=${lat}, lon=${lon}, type=${type}`);

    try {
      // 构建请求 URL（使用增强算法）
      const url = `${this.baseURL}/api/prediction/enhanced`;

      // 格式化日期为 ISO 字符串
      const dateString = date instanceof Date ? date.toISOString() : date;

      // 构建请求体：主预测保持后端闭环，前端只传地点/时刻/type。
      // 仅当 WEATHER_FETCH_MODE 进入 client/client-fallback 应急路径时，才携带天气数据让后端只负责算分。
      const useClientWeather = options.weatherFetchMode === 'client' || options.clientWeatherFallback === true;
      const requestBody = {
        date: dateString,
        lat: lat,
        lon: lon,
        type: type,
        referenceTime: dateString
      };

      if (useClientWeather) {
        requestBody.weatherData = weatherData;
        requestBody.options = {
          prevHourData: options.prevHourData || weatherData?._prevHourData || null,
          rainedRecently: Boolean(options.rainedRecently),
          remoteCloudData: options.remoteCloudData || null,
          clientWeatherFallback: options.clientWeatherFallback === true
        };
      }

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
    // 转换日期字符串为 Date 对象，缺失时回退到当前时间
    const date = data.date ? new Date(data.date) : new Date();
    const sunsetTime = data.sunsetTime ? new Date(data.sunsetTime) : null;
    const sunriseTime = data.sunriseTime ? new Date(data.sunriseTime) : null;

    // goldenHour / blueHour 可能在旧版后端响应中缺失
    const goldenHour = data.goldenHour
      ? {
          start: new Date(data.goldenHour.start),
          end: new Date(data.goldenHour.end)
        }
      : null;

    const blueHour = data.blueHour
      ? {
          start: new Date(data.blueHour.start),
          end: new Date(data.blueHour.end)
        }
      : null;

    // 创建 SunsetPrediction 对象
    const prediction = new SunsetPrediction(
      date,
      data.score,
      data.quality,
      data.factors || data.breakdown || null,
      sunsetTime,
      sunriseTime,
      data.type,
      goldenHour,
      blueHour,
      data.sunAzimuth,
      data.cloudLayers
    );

    // 保留增强算法明细字段，供前端评分明细弹层使用
    prediction.breakdown = data.breakdown || null;
    prediction.canvasAnalysis = data.canvasAnalysis || null;
    prediction.lightPathAnalysis = data.lightPathAnalysis || null;
    prediction.renderingAnalysis = data.renderingAnalysis || null;
    prediction.aerosolHazeCap = data.aerosolHazeCap || null;
    prediction.highCloudCarrierAdjustment = data.highCloudCarrierAdjustment || null;
    prediction.postRainAdjustment = data.postRainAdjustment || null;
    prediction.thickHighCloudPenalty = data.thickHighCloudPenalty || null;
    prediction.severeWeatherCap = data.severeWeatherCap || null;
    prediction.occlusionAnalysis = data.occlusionAnalysis || null;
    prediction.geometricModel = data.geometricModel || null;
    prediction.cloudThickness = data.cloudThickness || null;
    prediction.aerosolOpticalDepth = data.aerosolOpticalDepth ?? data.breakdown?.aerosolScattering?.aerosolOpticalDepth ?? null;
    prediction.dust = data.dust ?? data.breakdown?.aerosolScattering?.dust ?? null;
    prediction.pm2_5 = data.pm2_5 ?? data.breakdown?.aerosolScattering?.pm2_5 ?? null;
    prediction.pm10 = data.pm10 ?? data.breakdown?.aerosolScattering?.pm10 ?? null;
    prediction.aqi = data.aqi ?? null;
    prediction.remoteCloudData = data.remoteCloudData || null;
    prediction.weatherDataSource = data.weatherDataSource || null;
    prediction.clientWeatherFallback = data.clientWeatherFallback === true;
    prediction.providerMeta = data.providerMeta || null;

    return prediction;
  }

  /**
   * 调用后端周边预测 API
   *
   * @param {number} lat - 中心点纬度
   * @param {number} lon - 中心点经度
   * @param {number} radius - 半径（公里），50/100/150，默认100
   * @param {string} type - 预测类型 ('sunrise' | 'sunset')，默认'sunset'
   * @param {Date|string} date - 预测日期，默认今天
   * @returns {Promise<Object>} 周边预测数据
   * @throws {Error} API 调用失败时抛出错误
   *
   * 需求：22.8 - 前端改为调用后端周边 API
   */
  async getSurrounding(lat, lon, radius = 100, type = 'sunset', date = new Date()) {
    const startTime = Date.now();
    console.log(`[PredictionAPIService] 调用后端周边预测 API: lat=${lat}, lon=${lon}, radius=${radius}, type=${type}`);

    try {
      // 构建请求 URL
      const url = `${this.baseURL}/api/prediction/surrounding`;

      // 格式化日期
      const dateString = date instanceof Date ? date.toISOString() : date;

      // 构建请求体
      const requestBody = {
        lat: lat,
        lon: lon,
        radius: radius,
        type: type,
        date: dateString
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
        throw new Error(result.error?.message || '周边预测计算失败');
      }

      const elapsed = Date.now() - startTime;
      console.log(`[PredictionAPIService] 周边 API 调用成功: ${elapsed}ms, ${result.data.points.length} 个方位`);

      return result.data;

    } catch (error) {
      console.error(`[PredictionAPIService] 周边 API 调用失败:`, error);
      throw new Error(`后端周边预测 API 调用失败: ${error.message}`);
    }
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
