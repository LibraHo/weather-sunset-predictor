/**
 * SurroundingPointsService - 周边点位服务
 *
 * 计算并获取周边8个方位的气象数据，用于周边火烧云可视化
 * 需求：19.1, 19.2, 19.3
 */

import Location from '../models/Location.js';

class SurroundingPointsService {
  constructor() {
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

    // 缓存（30分钟有效期）
    this.cache = new Map();
    this.CACHE_DURATION = 30 * 60 * 1000; // 30分钟
  }

  /**
   * 计算周边8个方位的坐标点
   * @param {number} centerLat - 中心点纬度
   * @param {number} centerLon - 中心点经度
   * @param {number} radius - 半径（公里）
   * @returns {Object[]} 8个方位的坐标点
   *
   * 需求：19.1, 19.2, 19.15
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
      const targetLat = (targetLatRad * 180) / Math.PI;
      const targetLon = (targetLonRad * 180) / Math.PI;

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

    console.log(`[SurroundingPointsService] 计算了${points.length}个周边点，半径${radius}公里`);
    return points;
  }

  /**
   * 生成缓存键
   * @param {number} lat - 纬度
   * @param {number} lon - 经度
   * @param {number} radius - 半径
   * @returns {string} 缓存键
   * @private
   */
  _getCacheKey(lat, lon, radius) {
    return `surrounding_${lat.toFixed(2)}_${lon.toFixed(2)}_${radius}`;
  }

  /**
   * 检查缓存是否有效
   * @param {Object} cacheItem - 缓存项
   * @returns {boolean} 是否有效
   * @private
   */
  _isCacheValid(cacheItem) {
    if (!cacheItem || !cacheItem.timestamp) {
      return false;
    }
    const now = Date.now();
    return (now - cacheItem.timestamp) < this.CACHE_DURATION;
  }

  /**
   * 获取周边点的气象数据（带缓存）
   * @param {Object} centerLocation - 中心位置 {lat, lon, name}
   * @param {number} radius - 半径（公里），默认100
   * @param {Function} weatherDataFetcher - 天气数据获取函数 (location) => Promise<WeatherData>
   * @param {Function} predictionCalculator - 预测计算函数 (weatherData) => Prediction
   * @returns {Promise<Object>} 周边点数据
   *
   * 需求：19.1, 19.3, 19.9
   */
  async getSurroundingData(centerLocation, radius = 100, weatherDataFetcher, predictionCalculator) {
    const { lat, lon } = centerLocation;
    const cacheKey = this._getCacheKey(lat, lon, radius);

    // 检查缓存
    const cached = this.cache.get(cacheKey);
    if (cached && this._isCacheValid(cached)) {
      console.log('[SurroundingPointsService] 使用缓存数据');
      return cached.data;
    }

    // 计算周边点
    const points = this.calculateSurroundingPoints(lat, lon, radius);

    // 并行获取所有点的天气数据和预测
    console.log('[SurroundingPointsService] 开始获取周边点气象数据...');

    const promises = points.map(async (point) => {
      try {
        // 构造位置对象
        const location = new Location(point.lat, point.lon, point.name);

        // 获取天气数据
        const weatherData = await weatherDataFetcher(location);

        // 计算预测评分
        const prediction = predictionCalculator(weatherData);

        return {
          ...point,
          location: location,
          weatherData: weatherData,
          prediction: prediction,
          score: prediction ? prediction.score : 0,
          error: null
        };
      } catch (error) {
        console.warn(`[SurroundingPointsService] 获取${point.name}方向数据失败:`, error.message);
        return {
          ...point,
          location: null,
          weatherData: null,
          prediction: null,
          score: 0,
          error: error.message
        };
      }
    });

    // 等待所有请求完成
    const results = await Promise.all(promises);

    // 组装结果
    const data = {
      center: centerLocation,
      radius: radius,
      points: results,
      timestamp: Date.now()
    };

    // 缓存结果
    this.cache.set(cacheKey, {
      timestamp: Date.now(),
      data: data
    });

    console.log('[SurroundingPointsService] 周边数据获取完成');
    return data;
  }

  /**
   * 清除所有缓存
   */
  clearCache() {
    this.cache.clear();
    console.log('[SurroundingPointsService] 缓存已清除');
  }

  /**
   * 清除过期缓存
   */
  clearExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (!this._isCacheValid(value)) {
        this.cache.delete(key);
      }
    }
    console.log('[SurroundingPointsService] 过期缓存已清除');
  }
}

export default SurroundingPointsService;
