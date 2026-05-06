/**
 * BackendGeocodingService - 通过后端代理进行地理编码
 *
 * 将地理编码请求通过后端服务器转发，支持多个提供商：
 * - auto:     自动模式（国内优先高德，失败回退 Open-Meteo，显式返回 fallback 信息）
 * - nominatim: OpenStreetMap Nominatim（免费，全球可用）
 * - gaode:    高德地图（中国大陆优化，需要 API Key）
 * - openmeteo: Open-Meteo Geocoding（全球可用，免 Key）
 *
 * 需求：24 - 中国国内可用的定位服务方案
 */

import Location from '../models/Location.js';

const MANUAL_TEST_CITY = {
  displayName: 'test',
  enName: 'test',
  lat: 0,
  lon: 0,
  countryCode: 'CN',
  provider: 'manual-test'
};

function isManualTestQuery(query) {
  return typeof query === 'string' && query.trim().toLowerCase() === 'test';
}

class BackendGeocodingService {
  /**
   * @param {Object} options
   * @param {string} options.proxyURL   - 后端服务器地址，默认 http://localhost:3000
   * @param {string} options.provider   - 地理编码提供商: 'auto' | 'nominatim' | 'gaode' | 'openmeteo'
   * @param {string} [options.apiKey]   - 提供商 API Key（gaode 必填）
   */
  constructor(options = {}) {
    this.proxyURL = options.proxyURL || 'http://localhost:3000';
    this.provider = options.provider || 'nominatim';
    this.apiKey = options.apiKey || '';

    console.log(`[BackendGeocodingService] 初始化: provider=${this.provider}, proxy=${this.proxyURL}`);
  }

  /**
   * 将位置名称转换为坐标
   *
   * @param {string} locationName - 位置名称
   * @returns {Promise<Location>} - Location 对象
   * @throws {Error}
   *
   * 需求：24
   */
  async geocode(locationName) {
    if (!locationName || typeof locationName !== 'string' || !locationName.trim()) {
      throw new Error('位置名称不能为空');
    }

    if (isManualTestQuery(locationName)) {
      const location = new Location(MANUAL_TEST_CITY.lat, MANUAL_TEST_CITY.lon, MANUAL_TEST_CITY.displayName);
      location.countryCode = MANUAL_TEST_CITY.countryCode;
      location.regionCode = null;
      return location;
    }

    const url = new URL(`${this.proxyURL}/api/geocoding/search`);
    url.searchParams.set('q', locationName.trim());
    url.searchParams.set('provider', this.provider);
    if (this.apiKey) {
      url.searchParams.set('key', this.apiKey);
    }

    let response;
    try {
      response = await fetch(url.toString(), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      throw new Error('无法连接到后端服务器，请检查服务器是否运行');
    }

    if (response.status === 400) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error?.message || '请求参数有误');
    }
    if (!response.ok) {
      throw new Error(`地理编码服务不可用（状态码：${response.status}）`);
    }

    const data = await response.json();
    if (!data.results || data.results.length === 0) {
      throw new Error(`无法找到位置"${locationName}"，请尝试更具体的地名`);
    }

    const first = data.results[0];
    const location = new Location(first.lat, first.lon, first.name);
    location.countryCode = (first.countryCode || '').toUpperCase() || null;
    location.regionCode = first.regionCode || null;
    if (!location.isValid()) {
      throw new Error('返回的坐标无效');
    }
    return location;
  }

  /**
   * 获取用户当前 GPS 位置，并通过反向地理编码获取地名
   *
   * @returns {Promise<Location>}
   *
   * 需求：24
   */
  async getCurrentLocation() {
    if (!navigator.geolocation) {
      throw new Error('您的浏览器不支持地理定位功能');
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;

            let locationName = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
            try {
              const name = await this.reverseGeocode(lat, lon);
              if (name) locationName = name;
            } catch (_) {
              // 反向地理编码失败不影响主流程
            }

            const location = new Location(lat, lon, locationName);
            if (!location.isValid()) {
              reject(new Error('获取的位置坐标无效'));
              return;
            }
            resolve(location);
          } catch (err) {
            reject(new Error(`处理位置数据失败：${err.message}`));
          }
        },
        (error) => {
          switch (error.code) {
            case error.PERMISSION_DENIED:
              reject(new Error('位置权限被拒绝，请在浏览器设置中允许位置访问'));
              break;
            case error.POSITION_UNAVAILABLE:
              reject(new Error('位置信息不可用，请检查设备的定位服务是否开启'));
              break;
            case error.TIMEOUT:
              reject(new Error('获取位置超时，请重试'));
              break;
            default:
              reject(new Error(`获取位置失败：${error.message}`));
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }

  /**
   * 搜索城市候选列表
   *
   * @param {string} query - 搜索关键词
   * @param {number} limit - 返回结果数量限制，默认 8
   * @returns {Promise<Array<{displayName, enName, lat, lon, countryCode}>>}
   */
  async searchCities(query, limit = 8) {
    if (!query || typeof query !== 'string' || !query.trim()) {
      return [];
    }

    if (isManualTestQuery(query)) {
      return [{ ...MANUAL_TEST_CITY }].slice(0, limit);
    }

    const url = new URL(`${this.proxyURL}/api/geocoding/search`);
    url.searchParams.set('q', query.trim());
    url.searchParams.set('provider', this.provider);
    url.searchParams.set('limit', limit.toString());
    if (this.apiKey) {
      url.searchParams.set('key', this.apiKey);
    }

    try {
      const response = await fetch(url.toString(), {
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      if (!data.results || data.results.length === 0) {
        return [];
      }

      return data.results.map(item => ({
        displayName: item.name,
        enName: item.name,
        lat: item.lat,
        lon: item.lon,
        countryCode: (item.countryCode || '').toUpperCase() || null
      }));
    } catch (err) {
      console.warn('[BackendGeocodingService] searchCities failed:', err.message);
      return [];
    }
  }

  /**
   * 反向地理编码：坐标 → 地名
   *
   * @param {number} lat
   * @param {number} lon
   * @returns {Promise<string>}
   */
  async reverseGeocode(lat, lon) {
    const url = new URL(`${this.proxyURL}/api/geocoding/reverse`);
    url.searchParams.set('lat', lat.toString());
    url.searchParams.set('lon', lon.toString());
    url.searchParams.set('provider', this.provider);
    if (this.apiKey) {
      url.searchParams.set('key', this.apiKey);
    }

    const response = await fetch(url.toString(), {
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`反向地理编码失败（状态码：${response.status}）`);
    }

    const data = await response.json();
    return data.name || null;
  }
}

export default BackendGeocodingService;
