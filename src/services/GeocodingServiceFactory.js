/**
 * GeocodingServiceFactory - 地理编码服务工厂
 *
 * 根据用户在设置面板中配置的提供商，返回对应的后端代理地理编码服务实例。
 *
 * 配置键（localStorage）：
 * - geocoding_provider: 'nominatim' | 'gaode' | 'google'（默认 'nominatim'）
 * - geocoding_api_key:  提供商 API Key（gaode / google 需要）
 *
 * 提供商说明：
 * - nominatim  OpenStreetMap Nominatim，免费，全球可用，通过后端代理解决中国访问限制
 * - gaode      高德地图，中国大陆优化，需要免费 API Key
 * - google     Google Maps Geocoding，覆盖最全，需付费 Key，通过后端代理访问
 *
 * 需求：24
 */

import BackendGeocodingService from './BackendGeocodingService.js';

class GeocodingServiceFactory {
  /**
   * 根据 localStorage 中的用户设置创建地理编码服务实例
   *
   * @param {string} [proxyURL] - 后端服务器地址（覆盖 localStorage 中的值）
   * @returns {BackendGeocodingService}
   */
  static create(proxyURL) {
    const provider = localStorage.getItem('geocoding_provider') || 'auto';
    const apiKey = localStorage.getItem('geocoding_api_key') || '';
    const storedProxyURL = localStorage.getItem('api_proxy_url') || 'http://localhost:3000';
    const effectiveProxyURL = proxyURL || storedProxyURL;

    console.log(`[GeocodingServiceFactory] 后端代理 → ${provider}`);
    return new BackendGeocodingService({ proxyURL: effectiveProxyURL, provider, apiKey });
  }

  /**
   * 返回各提供商的可用性描述（供设置 UI 使用）
   * @returns {Array<{provider, labelKey, requiresKey, chinaCompatible}>}
   */
  static getOptions() {
    return [
      {
        provider: 'auto',
        labelKey: 'settings.geocodingBackendAuto',
        requiresKey: false,
        chinaCompatible: true
      },
      {
        provider: 'gaode',
        labelKey: 'settings.geocodingBackendGaode',
        requiresKey: false,
        chinaCompatible: true
      },
      {
        provider: 'nominatim',
        labelKey: 'settings.geocodingBackendNominatim',
        requiresKey: false,
        chinaCompatible: true
      },
      {
        provider: 'openmeteo',
        labelKey: 'settings.geocodingBackendOpenMeteo',
        requiresKey: false,
        chinaCompatible: true
      },
      {
        provider: 'nominatim-frontend',
        labelKey: 'settings.geocodingFrontendNominatim',
        requiresKey: false,
        chinaCompatible: false
      }
    ];
  }
}

export default GeocodingServiceFactory;
