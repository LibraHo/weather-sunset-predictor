/**
 * GeocodingService - 地理编码服务
 * 
 * 负责将位置名称转换为坐标，以及获取用户当前位置
 * 
 * 需求：2.2, 2.3, 2.4, 2.5
 */

import Location from '../models/Location.js';

class GeocodingService {
  constructor() {
    // 使用OpenStreetMap的Nominatim API作为地理编码服务
    // 这是一个免费的服务，不需要API密钥
    this.geocodingBaseURL = 'https://nominatim.openstreetmap.org';
  }

  /**
   * 将位置名称转换为坐标
   * 
   * @param {string} locationName - 位置名称（城市、地址等）
   * @returns {Promise<Location>} - Location对象
   * @throws {Error} - 如果位置无法解析或服务不可用
   * 
   * 需求：2.2, 2.5
   */
  async geocode(locationName) {
    if (!locationName || typeof locationName !== 'string' || locationName.trim() === '') {
      throw new Error('位置名称不能为空');
    }

    try {
      // 构造Nominatim API请求
      const url = new URL(`${this.geocodingBaseURL}/search`);
      url.searchParams.append('q', locationName.trim());
      url.searchParams.append('format', 'json');
      url.searchParams.append('limit', '1');
      url.searchParams.append('addressdetails', '1');

      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'WeatherSunsetPredictor/1.0' // Nominatim要求设置User-Agent
        }
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('地理编码服务请求过于频繁，请稍后再试');
        }
        throw new Error(`地理编码服务不可用（状态码：${response.status}）`);
      }

      const data = await response.json();

      if (!data || data.length === 0) {
        throw new Error(`无法找到位置"${locationName}"，请尝试更具体的地名`);
      }

      const result = data[0];
      const lat = parseFloat(result.lat);
      const lon = parseFloat(result.lon);
      
      // 使用返回的显示名称，如果没有则使用原始输入
      const displayName = result.display_name || locationName;

      // 创建Location对象
      const location = new Location(lat, lon, displayName);

      // 验证坐标有效性
      if (!location.isValid()) {
        throw new Error('返回的坐标无效');
      }

      return location;

    } catch (error) {
      // 如果是我们自己抛出的错误，直接传递
      if (error.message.includes('位置名称') || 
          error.message.includes('无法找到') || 
          error.message.includes('服务不可用') ||
          error.message.includes('请求过于频繁') ||
          error.message.includes('坐标无效')) {
        throw error;
      }

      // 网络错误或其他未知错误
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('网络连接失败，请检查网络设置');
      }

      throw new Error(`地理编码失败：${error.message}`);
    }
  }

  /**
   * 获取用户当前GPS位置
   * 
   * @returns {Promise<Location>} - Location对象
   * @throws {Error} - 如果位置权限被拒绝或服务不可用
   * 
   * 需求：2.3, 2.4, 2.5
   */
  async getCurrentLocation() {
    // 检查浏览器是否支持Geolocation API
    if (!navigator.geolocation) {
      throw new Error('您的浏览器不支持地理定位功能');
    }

    return new Promise((resolve, reject) => {
      const options = {
        enableHighAccuracy: true, // 请求高精度位置
        timeout: 10000,           // 10秒超时
        maximumAge: 0             // 不使用缓存的位置
      };

      navigator.geolocation.getCurrentPosition(
        // 成功回调
        async (position) => {
          try {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;

            // 尝试反向地理编码获取位置名称
            let locationName = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
            
            try {
              const reverseGeocodedName = await this.reverseGeocode(lat, lon);
              if (reverseGeocodedName) {
                locationName = reverseGeocodedName;
              }
            } catch (reverseError) {
              // 反向地理编码失败不影响主流程，使用坐标作为名称
              console.warn('反向地理编码失败:', reverseError.message);
            }

            const location = new Location(lat, lon, locationName);

            if (!location.isValid()) {
              reject(new Error('获取的位置坐标无效'));
              return;
            }

            resolve(location);

          } catch (error) {
            reject(new Error(`处理位置数据失败：${error.message}`));
          }
        },
        // 错误回调
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
        options
      );
    });
  }

  /**
   * 反向地理编码：将坐标转换为位置名称
   * 
   * @param {number} lat - 纬度
   * @param {number} lon - 经度
   * @returns {Promise<string>} - 位置名称
   * @private
   */
  async reverseGeocode(lat, lon) {
    try {
      const url = new URL(`${this.geocodingBaseURL}/reverse`);
      url.searchParams.append('lat', lat.toString());
      url.searchParams.append('lon', lon.toString());
      url.searchParams.append('format', 'json');
      url.searchParams.append('addressdetails', '1');

      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'WeatherSunsetPredictor/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`反向地理编码失败（状态码：${response.status}）`);
      }

      const data = await response.json();

      if (!data || !data.display_name) {
        throw new Error('反向地理编码返回数据无效');
      }

      return data.display_name;

    } catch (error) {
      // 反向地理编码失败不应该阻止主流程
      throw error;
    }
  }
}

export default GeocodingService;
