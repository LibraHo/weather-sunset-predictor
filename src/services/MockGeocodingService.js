/**
 * MockGeocodingService - 模拟地理编码服务
 * 
 * 用于离线测试，不需要网络连接
 * 预设了常见城市的坐标数据
 */

import Location from '../models/Location.js';

class MockGeocodingService {
  constructor() {
    // 预设的城市坐标数据库
    this.cityDatabase = {
      // 中国主要城市
      '北京': { lat: 39.9042, lon: 116.4074, name: '北京市, 中国' },
      'beijing': { lat: 39.9042, lon: 116.4074, name: '北京市, 中国' },
      '上海': { lat: 31.2304, lon: 121.4737, name: '上海市, 中国' },
      'shanghai': { lat: 31.2304, lon: 121.4737, name: '上海市, 中国' },
      '广州': { lat: 23.1291, lon: 113.2644, name: '广州市, 广东省, 中国' },
      'guangzhou': { lat: 23.1291, lon: 113.2644, name: '广州市, 广东省, 中国' },
      '深圳': { lat: 22.5431, lon: 114.0579, name: '深圳市, 广东省, 中国' },
      'shenzhen': { lat: 22.5431, lon: 114.0579, name: '深圳市, 广东省, 中国' },
      '杭州': { lat: 30.2741, lon: 120.1551, name: '杭州市, 浙江省, 中国' },
      'hangzhou': { lat: 30.2741, lon: 120.1551, name: '杭州市, 浙江省, 中国' },
      '成都': { lat: 30.5728, lon: 104.0668, name: '成都市, 四川省, 中国' },
      'chengdu': { lat: 30.5728, lon: 104.0668, name: '成都市, 四川省, 中国' },
      '重庆': { lat: 29.5630, lon: 106.5516, name: '重庆市, 中国' },
      'chongqing': { lat: 29.5630, lon: 106.5516, name: '重庆市, 中国' },
      '武汉': { lat: 30.5928, lon: 114.3055, name: '武汉市, 湖北省, 中国' },
      'wuhan': { lat: 30.5928, lon: 114.3055, name: '武汉市, 湖北省, 中国' },
      '西安': { lat: 34.3416, lon: 108.9398, name: '西安市, 陕西省, 中国' },
      "xi'an": { lat: 34.3416, lon: 108.9398, name: '西安市, 陕西省, 中国' },
      'xian': { lat: 34.3416, lon: 108.9398, name: '西安市, 陕西省, 中国' },
      '南京': { lat: 32.0603, lon: 118.7969, name: '南京市, 江苏省, 中国' },
      'nanjing': { lat: 32.0603, lon: 118.7969, name: '南京市, 江苏省, 中国' },
      '天津': { lat: 39.3434, lon: 117.3616, name: '天津市, 中国' },
      'tianjin': { lat: 39.3434, lon: 117.3616, name: '天津市, 中国' },
      '苏州': { lat: 31.2989, lon: 120.5853, name: '苏州市, 江苏省, 中国' },
      'suzhou': { lat: 31.2989, lon: 120.5853, name: '苏州市, 江苏省, 中国' },
      '青岛': { lat: 36.0671, lon: 120.3826, name: '青岛市, 山东省, 中国' },
      'qingdao': { lat: 36.0671, lon: 120.3826, name: '青岛市, 山东省, 中国' },
      '大连': { lat: 38.9140, lon: 121.6147, name: '大连市, 辽宁省, 中国' },
      'dalian': { lat: 38.9140, lon: 121.6147, name: '大连市, 辽宁省, 中国' },
      '厦门': { lat: 24.4798, lon: 118.0894, name: '厦门市, 福建省, 中国' },
      'xiamen': { lat: 24.4798, lon: 118.0894, name: '厦门市, 福建省, 中国' },
      
      // 国际城市
      'london': { lat: 51.5074, lon: -0.1278, name: 'London, United Kingdom' },
      '伦敦': { lat: 51.5074, lon: -0.1278, name: 'London, United Kingdom' },
      'new york': { lat: 40.7128, lon: -74.0060, name: 'New York, USA' },
      '纽约': { lat: 40.7128, lon: -74.0060, name: 'New York, USA' },
      'tokyo': { lat: 35.6762, lon: 139.6503, name: 'Tokyo, Japan' },
      '东京': { lat: 35.6762, lon: 139.6503, name: 'Tokyo, Japan' },
      'paris': { lat: 48.8566, lon: 2.3522, name: 'Paris, France' },
      '巴黎': { lat: 48.8566, lon: 2.3522, name: 'Paris, France' },
      'sydney': { lat: -33.8688, lon: 151.2093, name: 'Sydney, Australia' },
      '悉尼': { lat: -33.8688, lon: 151.2093, name: 'Sydney, Australia' },
      'singapore': { lat: 1.3521, lon: 103.8198, name: 'Singapore' },
      '新加坡': { lat: 1.3521, lon: 103.8198, name: 'Singapore' },
    };

    console.log('[MockGeocodingService] 已加载，包含', Object.keys(this.cityDatabase).length / 2, '个城市');
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

    const searchKey = locationName.trim().toLowerCase();
    
    // 在数据库中查找
    const cityData = this.cityDatabase[searchKey];
    
    if (cityData) {
      console.log(`[MockGeocodingService] 找到城市: ${cityData.name}`);
      return new Location(cityData.lat, cityData.lon, cityData.name);
    }

    // 模糊搜索：查找包含关键词的城市
    for (const [key, data] of Object.entries(this.cityDatabase)) {
      if (key.includes(searchKey) || searchKey.includes(key)) {
        console.log(`[MockGeocodingService] 模糊匹配到城市: ${data.name}`);
        return new Location(data.lat, data.lon, data.name);
      }
    }

    // 未找到城市
    throw new Error(`无法找到位置"${locationName}"。支持的城市：北京、上海、广州、深圳、杭州、成都等`);
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

    for (const [key, data] of Object.entries(this.cityDatabase)) {
      const distance = this.calculateDistance(lat, lon, data.lat, data.lon);
      if (distance < minDistance) {
        minDistance = distance;
        closestCity = data;
      }
    }

    if (closestCity && minDistance < 100) { // 100km范围内
      return closestCity.name;
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
    const cities = new Set();
    for (const key of Object.keys(this.cityDatabase)) {
      // 只返回中文城市名
      if (/[\u4e00-\u9fa5]/.test(key)) {
        cities.add(key);
      }
    }
    return Array.from(cities).sort();
  }
}

export default MockGeocodingService;
