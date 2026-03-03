/**
 * BackendGeocodingService - 后端地理编码服务
 *
 * 支持多种地理编码提供商，包括：
 * - Nominatim（免费，全球）
 * - 高德地图（中国大陆优化）
 *
 * 需求：24
 */

class BackendGeocodingService {
  /**
   * 创建地理编码服务实例
   *
   * @param {Object} options
   * @param {string} options.proxyURL - 后端代理服务器地址（不使用，保持接口兼容）
   * @param {string} options.provider - 地理编码提供商（'nominatim' | 'gaode' | 'google'）
   * @param {string} options.apiKey - API Key（高德/Google 需要）
   */
  constructor({ proxyURL, provider, apiKey }) {
    this.provider = provider;
    this.apiKey = apiKey;
    this.timeout = 5000; // 5 秒超时
  }

  /**
   * 地理编码
   *
   * @param {string} address - 地址文本
   * @returns {Promise<Object>} 地理编码结果
   * @throws {Error} 地理编码失败时抛出错误
   */
  async geocode(address) {
    if (!address || address.trim().length === 0) {
      throw new Error('地址不能为空');
    }

    console.log(`[BackendGeocodingService] 使用 ${this.provider} 进行地理编码:`, address);

    try {
      switch (this.provider) {
        case 'gaode':
          return await this._geocodeGaode(address);
        case 'nominatim':
          return await this._geocodeNominatim(address);
        case 'google':
          return await this._geocodeGoogle(address);
        default:
          throw new Error(`不支持的地理编码提供商: ${this.provider}`);
      }
    } catch (error) {
      console.error('[BackendGeocodingService] 地理编码失败:', error);
      throw error;
    }
  }

  /**
   * 高德地图地理编码
   *
   * 高德地图 Web 服务 API：
   * https://restapi.amap.com/v3/geocode/geo
   *
   * @param {string} address - 地址文本
   * @returns {Promise<Object>} 地理编码结果
   * @private
   */
  async _geocodeGaode(address) {
    const apiKey = process.env.GAODE_API_KEY;
    if (!apiKey) {
      throw new Error('高德 API Key 未配置（请设置 GAODE_API_KEY 环境变量）');
    }

    // 高德地图 REST API
    const url = `https://restapi.amap.com/v3/geocode/geo?address=${encodeURIComponent(address)}&key=${apiKey}`;

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: this.timeout
    });

    if (!response.ok) {
      throw new Error(`高德地理编码 API 请求失败: HTTP ${response.status}`);
    }

    const data = await response.json();

    // 高德地图响应格式
    // https://lbs.amap.com/api/webservice/guide/api/search
    // geocodes: [{ formatted_address, location: { lat, lon, level }, ... }]
    if (!data.geocodes || data.geocodes.length === 0) {
      throw new Error('高德地理编码未返回结果');
    }

    const result = data.geocodes[0];

    return {
      name: result.formatted_address || address,
      lat: result.location.lat,
      lon: result.location.lon,
      provider: 'gaode',
      original: result
    };
  }

  /**
   * Nominatim 地理编码
   *
   * OpenStreetMap Nominatim API：
   * https://nominatim.org/openstreetmap/geocoding/search?format=json&q=xxx
   *
   * @param {string} address - 地址文本
   * @returns {Promise<Object>} 地理编码结果
   * @private
   */
  async _geocodeNominatim(address) {
    // Nominatim API（免费，无需 Key）
    const url = `https://nominatim.org/openstreetmap/geocoding/search?format=json&q=${encodeURIComponent(address)}&limit=1`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'WeatherSunsetPredictor/1.0'
      },
      timeout: this.timeout
    });

    if (!response.ok) {
      throw new Error(`Nominatim 地理编码 API 请求失败: HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      throw new Error('Nominatim 地理编码未返回结果');
    }

    const result = data[0];

    return {
      name: result.display_name || address,
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
      provider: 'nominatim',
      original: result
    };
  }

  /**
   * Google 地理编码（保留接口，未实现）
   *
   * Google Maps Geocoding API 需要 API Key
   *
   * @param {string} address - 地址文本
   * @returns {Promise<Object>} 地理编码结果
   * @private
   */
  async _geocodeGoogle(address) {
    throw new Error('Google 地理编码服务暂未实现');
  }
}

module.exports = BackendGeocodingService;
