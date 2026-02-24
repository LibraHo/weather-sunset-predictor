/**
 * GeocodingServiceFactory 单元测试
 * 需求：24
 */

import { jest } from '@jest/globals';
import GeocodingServiceFactory from '../../../src/services/GeocodingServiceFactory.js';
import GeocodingService from '../../../src/services/GeocodingService.js';
import BackendGeocodingService from '../../../src/services/BackendGeocodingService.js';

// localStorage mock (plain object, no jest.fn at module level)
const localStorageStore = {};
const localStorageMock = {
  getItem: (key) => localStorageStore[key] ?? null,
  setItem: (key, value) => { localStorageStore[key] = String(value); },
  removeItem: (key) => { delete localStorageStore[key]; },
  clear: () => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); }
};

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true
});

describe('GeocodingServiceFactory', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  // ========== create() — 默认值 ==========

  describe('create() — 默认值', () => {
    test('无 localStorage 配置时，默认返回后端代理 Nominatim 服务', () => {
      const service = GeocodingServiceFactory.create();
      expect(service).toBeInstanceOf(BackendGeocodingService);
      expect(service.provider).toBe('nominatim');
    });

    test('传入 proxyURL 参数时应覆盖 localStorage 中的值', () => {
      const service = GeocodingServiceFactory.create('http://custom:4000');
      expect(service).toBeInstanceOf(BackendGeocodingService);
      expect(service.proxyURL).toBe('http://custom:4000');
    });
  });

  // ========== create() — 后端代理模式 ==========

  describe("create() — mode='backend'", () => {
    beforeEach(() => {
      localStorageStore['geocoding_mode'] = 'backend';
      localStorageStore['api_proxy_url'] = 'http://localhost:3000';
    });

    test('backend + nominatim → BackendGeocodingService, provider=nominatim', () => {
      localStorageStore['geocoding_provider'] = 'nominatim';
      const service = GeocodingServiceFactory.create();
      expect(service).toBeInstanceOf(BackendGeocodingService);
      expect(service.provider).toBe('nominatim');
    });

    test('backend + gaode → BackendGeocodingService, provider=gaode', () => {
      localStorageStore['geocoding_provider'] = 'gaode';
      localStorageStore['geocoding_api_key'] = 'my-gaode-key';
      const service = GeocodingServiceFactory.create();
      expect(service).toBeInstanceOf(BackendGeocodingService);
      expect(service.provider).toBe('gaode');
      expect(service.apiKey).toBe('my-gaode-key');
    });

    test('backend + google → BackendGeocodingService, provider=google', () => {
      localStorageStore['geocoding_provider'] = 'google';
      localStorageStore['geocoding_api_key'] = 'my-google-key';
      const service = GeocodingServiceFactory.create();
      expect(service).toBeInstanceOf(BackendGeocodingService);
      expect(service.provider).toBe('google');
    });

    test('proxyURL 应从 localStorage 读取', () => {
      localStorageStore['api_proxy_url'] = 'http://prod-server:8080';
      localStorageStore['geocoding_provider'] = 'nominatim';
      const service = GeocodingServiceFactory.create();
      expect(service.proxyURL).toBe('http://prod-server:8080');
    });

    test('传入 proxyURL 参数应优先于 localStorage', () => {
      localStorageStore['api_proxy_url'] = 'http://localhost:3000';
      localStorageStore['geocoding_provider'] = 'nominatim';
      const service = GeocodingServiceFactory.create('http://override:9000');
      expect(service.proxyURL).toBe('http://override:9000');
    });
  });

  // ========== create() — 前端直连模式 ==========

  describe("create() — mode='direct'", () => {
    beforeEach(() => {
      localStorageStore['geocoding_mode'] = 'direct';
    });

    test('direct + nominatim → GeocodingService（原生直连）', () => {
      localStorageStore['geocoding_provider'] = 'nominatim';
      const service = GeocodingServiceFactory.create();
      expect(service).toBeInstanceOf(GeocodingService);
    });

    test('direct + google → BackendGeocodingService（借用代理类直连）', () => {
      localStorageStore['geocoding_provider'] = 'google';
      localStorageStore['geocoding_api_key'] = 'g-key';
      const service = GeocodingServiceFactory.create();
      expect(service).toBeInstanceOf(BackendGeocodingService);
    });

    test('direct + unknown provider → 默认 GeocodingService', () => {
      localStorageStore['geocoding_provider'] = 'unknown_provider';
      const service = GeocodingServiceFactory.create();
      expect(service).toBeInstanceOf(GeocodingService);
    });
  });

  // ========== getOptions() ==========

  describe('getOptions()', () => {
    test('应返回 5 个选项', () => {
      const options = GeocodingServiceFactory.getOptions();
      expect(Array.isArray(options)).toBe(true);
      expect(options.length).toBe(5);
    });

    test('每个选项应包含必要字段', () => {
      const options = GeocodingServiceFactory.getOptions();
      options.forEach(opt => {
        expect(opt).toHaveProperty('mode');
        expect(opt).toHaveProperty('provider');
        expect(opt).toHaveProperty('labelKey');
        expect(opt).toHaveProperty('requiresKey');
        expect(opt).toHaveProperty('chinaCompatible');
      });
    });

    test('后端 Nominatim 不需要 Key 且中国可用', () => {
      const options = GeocodingServiceFactory.getOptions();
      const opt = options.find(o => o.mode === 'backend' && o.provider === 'nominatim');
      expect(opt).toBeDefined();
      expect(opt.requiresKey).toBe(false);
      expect(opt.chinaCompatible).toBe(true);
    });

    test('后端高德需要 Key 且中国可用', () => {
      const options = GeocodingServiceFactory.getOptions();
      const opt = options.find(o => o.mode === 'backend' && o.provider === 'gaode');
      expect(opt).toBeDefined();
      expect(opt.requiresKey).toBe(true);
      expect(opt.chinaCompatible).toBe(true);
    });

    test('直连 Nominatim 不需要 Key 但中国受限', () => {
      const options = GeocodingServiceFactory.getOptions();
      const opt = options.find(o => o.mode === 'direct' && o.provider === 'nominatim');
      expect(opt).toBeDefined();
      expect(opt.requiresKey).toBe(false);
      expect(opt.chinaCompatible).toBe(false);
    });

    test('直连 Google 需要 Key 且中国不可用', () => {
      const options = GeocodingServiceFactory.getOptions();
      const opt = options.find(o => o.mode === 'direct' && o.provider === 'google');
      expect(opt).toBeDefined();
      expect(opt.requiresKey).toBe(true);
      expect(opt.chinaCompatible).toBe(false);
    });
  });
});
