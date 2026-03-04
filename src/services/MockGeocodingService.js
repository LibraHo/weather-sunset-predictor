/**
 * MockGeocodingService - 模拟地理编码服务
 * 
 * 用于离线测试，不需要网络连接
 * 预设了常见城市的坐标数据
 */

import Location from '../models/Location.js';
import { CITY_DATABASE, getCityDisplayName } from '../data/cityDatabase.js';

class MockGeocodingService {
  constructor() {
    this.cityDatabase = CITY_DATABASE;
    console.log('[MockGeocodingService] 已加载，包含', this.cityDatabase.length, '个城市');
  }

  normalizeQuery(query) {
    return query.trim().toLowerCase();
  }

  searchCities(query, limit = 8) {
    const normalized = this.normalizeQuery(query);
    if (!normalized) {
      return [];
    }

    return this.cityDatabase
      .map(city => {
        const tokens = [city.zhName, city.enName, ...(city.aliases || [])].map(v => v.toLowerCase());
        let score = 0;
        for (const token of tokens) {
          if (token === normalized) score = Math.max(score, 100);
          else if (token.startsWith(normalized)) score = Math.max(score, 70);
          else if (token.includes(normalized)) score = Math.max(score, 40);
        }
        return { city, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || a.city.enName.localeCompare(b.city.enName))
      .slice(0, limit)
      .map(item => ({ ...item.city, displayName: getCityDisplayName(item.city) }));
  }


  /**
   * 将位置名称转换为坐标（模拟版本）
   * 
   * @param {string} locationName - 位置名称
   * @returns {Promise<Location>} - Location对象
   * @throws {Error} - 如果位置未找到
   */
  async geocode(locationName) {
    // 模拟网络延迟
    await this.simulateDelay(300);

    if (!locationName || typeof locationName !== 'string' || locationName.trim() === '') {
      throw new Error('位置名称不能为空');
    }

    const cityData = this.searchCities(locationName, 1)[0];

    if (cityData) {
      console.log(`[MockGeocodingService] 找到城市: ${cityData.displayName}`);
      return new Location(cityData.lat, cityData.lon, cityData.displayName);
    }

    // 未找到城市
    throw new Error(`无法找到位置\"${locationName}\"。请尝试输入主要城市中英文名称`);
  }

  /**
   * 获取用户当前位置（使用浏览器地理定位API）
   * 
   * @returns {Promise<Location>} - Location对象
   */
  async getCurrentLocation() {
    // 检查浏览器是否支持Geolocation API
    if (!navigator.geolocation) {
      throw new Error('您的浏览器不支持地理定位功能');
    }

    try {
      // 尝试获取真实的地理位置
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      const { latitude, longitude } = position.coords;
      console.log(`[MockGeocodingService] 获取到真实位置: ${latitude}, ${longitude}`);

      // 反向地理编码获取位置名称
      const locationName = await this.reverseGeocode(latitude, longitude);

      return new Location(latitude, longitude, locationName);

    } catch (error) {
      console.warn('[MockGeocodingService] 无法获取真实位置，使用默认位置:', error.message);
      
      // 如果获取失败，返回北京作为默认位置
      await this.simulateDelay(500);
      return new Location(39.9042, 116.4074, '北京市, 中国（默认位置）');
    }
  }

  /**
   * 反向地理编码（模拟版本）
   * 
   * @param {number} lat - 纬度
   * @param {number} lon - 经度
   * @returns {Promise<string>} - 位置名称
   */
  async reverseGeocode(lat, lon) {
    // 模拟网络延迟
    await this.simulateDelay(300);

    // 查找最接近的城市
    let closestCity = null;
    let minDistance = Infinity;

    for (const data of this.cityDatabase) {
      const distance = this.calculateDistance(lat, lon, data.lat, data.lon);
      if (distance < minDistance) {
        minDistance = distance;
        closestCity = data;
      }
    }

    if (closestCity && minDistance < 100) { // 100km范围内
      return getCityDisplayName(closestCity);
    }

    return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  }

  /**
   * 计算两点之间的距离（简化版本，单位：km）
   * 
   * @param {number} lat1 - 纬度1
   * @param {number} lon1 - 经度1
   * @param {number} lat2 - 纬度2
   * @param {number} lon2 - 经度2
   * @returns {number} - 距离（km）
   * @private
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // 地球半径（km）
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * 角度转弧度
   * @private
   */
  toRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * 模拟网络延迟
   * 
   * @param {number} ms - 延迟毫秒数
   * @returns {Promise<void>}
   * @private
   */
  simulateDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取支持的城市列表
   * 
   * @returns {Array<string>} - 城市名称列表
   */
  getSupportedCities() {
    return this.cityDatabase.map(city => city.zhName).sort();
  }
}

export default MockGeocodingService;
