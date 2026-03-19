/**
 * SurroundingService - 周边采样聚合服务（后端版）
 *
 * 计算并获取周边8个方位的火烧云预测数据
 * 复用前端 SurroundingPointsService 逻辑，迁移到后端
 *
 * 需求：22 (前后端分离 - Phase 2)
 * @author Backend Migration v1.0
 */

const orchestrator = require('./ProviderOrchestrator');
const PredictionService = require('./PredictionService.js');
const EnhancedPredictionService = require('./EnhancedPredictionService.js');
const SunCalculator = require('../utils/SunCalculator.js');
const cacheConfig = require('../config/cacheConfig.js');

// ========== 服务类定义 ==========

class SurroundingService {
  /**
   * 创建周边采样服务实例
   *
   * @param {Object} options - 配置选项
   * @param {Object} options.cacheService - 缓存服务实例（可选）
   */
  constructor(options = {}) {
    // 方位常量
    this.DIRECTIONS = {
      N: { name: '北', angle: 0, label: 'N' },
      NE: { name: '东北', angle: 45, label: 'NE' },
      E: { name: '东', angle: 90, label: 'E' },
      SE: { name: '东南', angle: 135, label: 'SE' },
      S: { name: '南', angle: 180, label: 'S' },
      SW: { name: '西南', angle: 225, label: 'SW' },
      W: { name: '西', angle: 270, label: 'W' },
      NW: { name: '西北', angle: 315, label: 'NW' }
    };

    this.cacheService = options.cacheService || null;
    this.predictionService = new PredictionService();
  }

  /**
   * 计算周边8个方位的坐标点
   *
   * @param {number} centerLat - 中心点纬度
   * @param {number} centerLon - 中心点经度
   * @param {number} radius - 半径（公里）
   * @returns {Object[]} 8个方位的坐标点
   *
   * 需求：22.6 - 周边8方向坐标计算
   */
  calculateSurroundingPoints(centerLat, centerLon, radius = 100) {
    const points = [];

    // 地球半径（公里）
    const EARTH_RADIUS = 6371;

    Object.entries(this.DIRECTIONS).forEach(([key, direction]) => {
      // 将角度转换为弧度
      const angleRad = (direction.angle * Math.PI) / 180;

      // 计算目标点的纬度
      const latRad = (centerLat * Math.PI) / 180;
      const dLat = (radius * Math.cos(angleRad)) / EARTH_RADIUS;
      const targetLatRad = latRad + dLat;

      // 计算目标点的经度（考虑纬度影响）
      const dLon = (radius * Math.sin(angleRad)) / (EARTH_RADIUS * Math.cos(latRad));
      const targetLonRad = (centerLon * Math.PI) / 180 + dLon;

      // 转换回度数
      let targetLat = (targetLatRad * 180) / Math.PI;
      let targetLon = (targetLonRad * 180) / Math.PI;

      // 纬度夹紧到 [-90, 90]，极地附近点退化为极点
      targetLat = Math.max(-90, Math.min(90, targetLat));

      // 经度归一化到 [-180, 180]（穿越本初子午线 / 日界线）
      if (targetLon > 180) targetLon -= 360;
      else if (targetLon < -180) targetLon += 360;

      points.push({
        direction: key,
        name: direction.name,
        angle: direction.angle,
        label: direction.label,
        lat: targetLat,
        lon: targetLon,
        distance: radius
      });
    });

    console.log(`[SurroundingService] 计算了${points.length}个周边点，半径${radius}公里`);
    return points;
  }

  /**
   * 获取周边点的火烧云预测数据（带缓存）
   *
   * @param {Object} params - 请求参数
   * @param {number} params.lat - 中心点纬度
   * @param {number} params.lon - 中心点经度
   * @param {number} params.radius - 半径（公里），默认100
   * @param {string} params.type - 预测类型：'sunrise' 或 'sunset'，默认'sunset'
   * @param {Date|string} params.date - 预测日期，默认今天
   * @returns {Promise<Object>} 周边点预测数据
   *
   * 需求：22.6, 22.7 - 周边8方向并行获取和预测聚合
   */
  async getSurroundingPredictions(params) {
    const { lat, lon, radius = 50, type = 'sunset', date = new Date() } = params;

    // ========== 参数验证 ==========

    if (typeof lat !== 'number' || lat < -90 || lat > 90) {
      throw new Error('纬度必须在-90到90之间');
    }

    if (typeof lon !== 'number' || lon < -180 || lon > 180) {
      throw new Error('经度必须在-180到180之间');
    }

    if (![50, 100, 150].includes(radius)) {
      // 宽松兼容，不抛出错误，直接使用传入值
      console.warn(`[SurroundingService] 非标准半径 ${radius}km，继续执行`);
    }

    if (!['sunrise', 'sunset'].includes(type)) {
      throw new Error('预测类型必须是 sunrise 或 sunset');
    }

    // 转换日期
    let targetDate = date;
    if (typeof date === 'string') {
      targetDate = new Date(date);
    }
    if (!(targetDate instanceof Date) || isNaN(targetDate.getTime())) {
      throw new Error('无效的日期对象');
    }

    // ========== 检查缓存 ==========

    if (this.cacheService) {
      const cacheKey = this._getCacheKey(lat, lon, radius, type, targetDate);
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        console.log('[SurroundingService] 使用缓存数据');
        return cached;
      }
    }

    // ========== 计算周边点 ==========

    const points = this.calculateSurroundingPoints(lat, lon, radius);

    // ========== 并行获取所有点的天气数据和预测 ==========

    console.log('[SurroundingService] 开始获取周边点气象数据和预测...');

    const promises = points.map(async (point) => {
      try {
        // 获取天气数据
        const weatherResponse = await orchestrator.fetchWeatherData(point.lat, point.lon, 24);

        // 按类型选择参考时刻：朝霞用日出时刻，晚霞用日落时刻
        const referenceTime = type === 'sunrise'
          ? SunCalculator.getSunriseTime(targetDate, point.lat, point.lon)
          : SunCalculator.getSunsetTime(targetDate, point.lat, point.lon);

        // 取与参考时刻最接近的小时数据（而不是固定 data[0]）
        const hourly = Array.isArray(weatherResponse.data) ? weatherResponse.data : [];
        if (hourly.length === 0) {
          throw new Error('天气数据为空');
        }

        let selectedWeather = hourly[0];
        if (referenceTime instanceof Date && !isNaN(referenceTime.getTime())) {
          const refTs = referenceTime.getTime();
          selectedWeather = hourly.reduce((closest, current) => {
            const cDiff = Math.abs((closest.timestamp || 0) - refTs);
            const nDiff = Math.abs((current.timestamp || 0) - refTs);
            return nDiff < cDiff ? current : closest;
          }, hourly[0]);
        }

        // 标准化天气数据格式（对齐前端WeatherData模型）
        const weatherData = {
          cloudCover: selectedWeather.cloudCover || 0,
          humidity: selectedWeather.humidity || 0,
          visibility: selectedWeather.visibility || 10,
          lowCloudCover: selectedWeather.lowClouds || selectedWeather.cloudCover || 0,
          temp: selectedWeather.temp || 0,
          windSpeed: selectedWeather.windSpeed || 0,
          windDirection: selectedWeather.windDirection || 0,
          pressure: selectedWeather.pressure || 1013,
          precipitation: selectedWeather.precipitation || 0,
          lowClouds: selectedWeather.lowClouds || 0,
          midClouds: selectedWeather.midClouds || 0,
          highClouds: selectedWeather.highClouds || 0,
          cloudBaseHeight: selectedWeather.cloudBaseHeight ?? null,
          cape: selectedWeather.cape ?? null,
          weatherCode: selectedWeather.weatherCode ?? null
        };

        // 使用增强版预测服务（与主页面评分一致）
        const prediction = EnhancedPredictionService.calculateEnhancedPrediction(
          weatherData,
          targetDate,
          point.lat,
          point.lon,
          type
        );

        return {
          ...point,
          weatherData: weatherData,
          prediction: prediction,
          score: prediction.score,
          quality: prediction.quality,
          cloudLayers: {
            low: weatherData.lowClouds,
            mid: weatherData.midClouds,
            high: weatherData.highClouds,
            cloudBaseHeight: weatherData.cloudBaseHeight
          },
          error: null
        };
      } catch (error) {
        console.warn(`[SurroundingService] 获取${point.name}方向数据失败:`, error.message);
        return {
          ...point,
          weatherData: null,
          prediction: null,
          score: 0,
          quality: 'unknown',
          error: error.message
        };
      }
    });

    // 等待所有请求完成，同时设置全局超时（防止单个挂起请求拖慢整体响应）
    const GLOBAL_TIMEOUT_MS = 20000; // 20 秒：8 方向各自 10s axios 超时，留出余量
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('周边预测请求超时（超过20秒）')), GLOBAL_TIMEOUT_MS)
    );

    const results = await Promise.race([
      Promise.all(promises),
      timeoutPromise
    ]);

    // ========== 找出最佳方向 ==========

    const validResults = results.filter(r => !r.error);
    const bestDirection = validResults.length > 0
      ? validResults.reduce((best, current) =>
          current.score > best.score ? current : best
        )
      : null;

    // ========== 计算日出/日落方位角 ==========
    const sunriseTime = SunCalculator.getSunriseTime(targetDate, lat, lon);
    const sunsetTime = SunCalculator.getSunsetTime(targetDate, lat, lon);
    const sunriseAzimuth = sunriseTime ? SunCalculator.getSunAzimuth(targetDate, sunriseTime, lat, lon) : null;
    const sunsetAzimuth = sunsetTime ? SunCalculator.getSunAzimuth(targetDate, sunsetTime, lat, lon) : null;

    // ========== 组装结果 ==========

    const data = {
      center: {
        lat: lat,
        lon: lon
      },
      radius: radius,
      type: type,
      date: targetDate,
      sunAzimuths: {
        sunrise: sunriseAzimuth,
        sunset: sunsetAzimuth,
        south: 180
      },
      points: results,
      bestDirection: bestDirection ? {
        direction: bestDirection.direction,
        name: bestDirection.name,
        score: bestDirection.score,
        quality: bestDirection.quality,
        cloudLayers: bestDirection.cloudLayers || null,
        location: {
          lat: bestDirection.lat,
          lon: bestDirection.lon
        }
      } : null,
      timestamp: Date.now()
    };

    // ========== 缓存结果 ==========

    if (this.cacheService) {
      const cacheKey = this._getCacheKey(lat, lon, radius, type, targetDate);
      await this.cacheService.set(cacheKey, data, cacheConfig.getTTL('SURROUNDING'));
    }

    console.log('[SurroundingService] 周边预测数据获取完成');
    return data;
  }

  /**
   * 生成缓存键
   *
   * @param {number} lat - 纬度
   * @param {number} lon - 经度
   * @param {number} radius - 半径
   * @param {string} type - 预测类型
   * @param {Date} date - 日期
   * @returns {string} 缓存键
   * @private
   */
  _getCacheKey(lat, lon, radius, type, date) {
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    return `surrounding_${lat.toFixed(2)}_${lon.toFixed(2)}_${radius}_${type}_${dateStr}`;
  }
}

// ========== 导出 ==========

module.exports = SurroundingService;
