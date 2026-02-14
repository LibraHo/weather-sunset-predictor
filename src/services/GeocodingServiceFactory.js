/**
 * GeocodingServiceFactory - 地理编码服务工厂
 *
 * 根据用户在设置面板中配置的提供商，返回对应的地理编码服务实例。
 *
 * 策略：
 * - geocoding_provider = 'backend_nominatim' → BackendGeocodingService (provider: nominatim)
 * - geocoding_provider = 'backend_gaode'     → BackendGeocodingService (provider: gaode)
 * - 其他 / 未配置                            → 原始 GeocodingService (Nominatim 直连)
 *
 * 需求：24
 */

import GeocodingService from './GeocodingService.js';
import BackendGeocodingService from './BackendGeocodingService.js';

class GeocodingServiceFactory {
  /**
   * 根据 localStorage 中的用户设置创建地理编码服务实例
   *
   * @param {string} [proxyURL] - 后端服务器地址（覆盖 localStorage 中的值）
   * @returns {GeocodingService|BackendGeocodingService}
   */
  static create(proxyURL) {
    const provider = localStorage.getItem('geocoding_provider') || 'backend_nominatim';
    const apiKey = localStorage.getItem('geocoding_api_key') || '';
    const storedProxyURL = localStorage.getItem('api_proxy_url') || 'http://localhost:3000';
    const effectiveProxyURL = proxyURL || storedProxyURL;

    switch (provider) {
      case 'direct_nominatim':
        // 直连 Nominatim（不经过后端，适合在 Nominatim 可正常访问的环境）
        console.log('[GeocodingServiceFactory] 使用直连 Nominatim');
        return new GeocodingService();

      case 'backend_gaode':
        // 通过后端代理调用高德地图（中国大陆优化）
        console.log('[GeocodingServiceFactory] 使用后端高德地图代理');
        return new BackendGeocodingService({
          proxyURL: effectiveProxyURL,
          provider: 'gaode',
          apiKey
        });

      case 'backend_nominatim':
      default:
        // 通过后端代理调用 Nominatim（默认，推荐）
        console.log('[GeocodingServiceFactory] 使用后端 Nominatim 代理');
        return new BackendGeocodingService({
          proxyURL: effectiveProxyURL,
          provider: 'nominatim',
          apiKey: ''
        });
    }
  }
}

export default GeocodingServiceFactory;
