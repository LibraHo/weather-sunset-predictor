/**
 * GeocodingServiceFactory - 地理编码服务工厂
 *
 * 根据用户在设置面板中配置的模式和提供商，返回对应的地理编码服务实例。
 *
 * 配置键（localStorage）：
 * - geocoding_mode:     'direct' | 'backend'（默认 'backend'）
 * - geocoding_provider: 'nominatim' | 'gaode' | 'google'（默认 'nominatim'）
 * - geocoding_api_key:  提供商 API Key（gaode / google 需要）
 *
 * 模式说明：
 * - direct   前端直接调用地理编码服务（Nominatim 或 Google）
 * - backend  通过后端代理调用（推荐，可保护 Key，解决跨域和中国网络限制）
 *
 * 提供商说明：
 * - nominatim  OpenStreetMap Nominatim，免费，全球可用（直连时中国可能受限）
 * - gaode      高德地图，中国大陆优化，仅后端代理模式支持，需要免费 API Key
 * - google     Google Maps Geocoding，覆盖最全，需付费 Key，中国直连不可用
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
    const mode = localStorage.getItem('geocoding_mode') || 'backend';
    const provider = localStorage.getItem('geocoding_provider') || 'nominatim';
    const apiKey = localStorage.getItem('geocoding_api_key') || '';
    const storedProxyURL = localStorage.getItem('api_proxy_url') || 'http://localhost:3000';
    const effectiveProxyURL = proxyURL || storedProxyURL;

    if (mode === 'direct') {
      return GeocodingServiceFactory._createDirect(provider, apiKey);
    } else {
      return GeocodingServiceFactory._createBackend(provider, apiKey, effectiveProxyURL);
    }
  }

  /**
   * 前端直连模式
   * @private
   */
  static _createDirect(provider, apiKey) {
    switch (provider) {
      case 'google':
        // Google Maps 直连：中国大陆不可用；需要有效的 API Key
        console.log('[GeocodingServiceFactory] 前端直连 Google Maps');
        return new BackendGeocodingService({
          // Google 没有独立的前端服务类，借用 BackendGeocodingService 直调
          // 实际应把 proxyURL 指向一个能访问 Google 的代理或直接设 GOOGLE_GEOCODING_API
          proxyURL: 'https://maps.googleapis.com',
          provider: 'google_direct',
          apiKey
        });

      case 'nominatim':
      default:
        // Nominatim 直连：免费，当前默认实现（前端直接调 nominatim.openstreetmap.org）
        console.log('[GeocodingServiceFactory] 前端直连 Nominatim (OSM)');
        return new GeocodingService();
    }
  }

  /**
   * 后端代理模式
   * @private
   */
  static _createBackend(provider, apiKey, proxyURL) {
    switch (provider) {
      case 'gaode':
        // 高德地图：中国大陆最优方案，需要用户自备免费 Key
        console.log('[GeocodingServiceFactory] 后端代理 → 高德地图');
        return new BackendGeocodingService({
          proxyURL,
          provider: 'gaode',
          apiKey
        });

      case 'google':
        // Google Maps 通过后端代理：后端部署在境外时可用
        console.log('[GeocodingServiceFactory] 后端代理 → Google Maps');
        return new BackendGeocodingService({
          proxyURL,
          provider: 'google',
          apiKey
        });

      case 'nominatim':
      default:
        // Nominatim 通过后端代理：推荐默认，解决中国直连受限问题
        console.log('[GeocodingServiceFactory] 后端代理 → Nominatim (OSM)');
        return new BackendGeocodingService({
          proxyURL,
          provider: 'nominatim',
          apiKey: ''
        });
    }
  }

  /**
   * 返回各模式/提供商的可用性描述（供设置 UI 使用）
   * @returns {Array<{mode, provider, label, requiresKey, chinaCompatible}>}
   */
  static getOptions() {
    return [
      // ---- 后端代理 ----
      {
        mode: 'backend', provider: 'nominatim',
        labelKey: 'settings.geocodingBackendNominatim',
        requiresKey: false,
        chinaCompatible: true  // 后端可访问 OSM
      },
      {
        mode: 'backend', provider: 'gaode',
        labelKey: 'settings.geocodingBackendGaode',
        requiresKey: true,
        chinaCompatible: true  // 高德本就是中国服务
      },
      {
        mode: 'backend', provider: 'google',
        labelKey: 'settings.geocodingBackendGoogle',
        requiresKey: true,
        chinaCompatible: false  // 需后端部署在境外
      },
      // ---- 前端直连 ----
      {
        mode: 'direct', provider: 'nominatim',
        labelKey: 'settings.geocodingDirectNominatim',
        requiresKey: false,
        chinaCompatible: false  // 中国直连 OSM 可能受限
      },
      {
        mode: 'direct', provider: 'google',
        labelKey: 'settings.geocodingDirectGoogle',
        requiresKey: true,
        chinaCompatible: false  // 中国无法直连 Google
      }
    ];
  }
}

export default GeocodingServiceFactory;
