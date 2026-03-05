import { jest } from '@jest/globals';
import GeocodingServiceFactory from '../../../src/services/GeocodingServiceFactory.js';
import BackendGeocodingService from '../../../src/services/BackendGeocodingService.js';

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

  describe('create() — 默认值', () => {
    test('无 localStorage 配置时，默认返回后端代理 gaode 服务', () => {
      const service = GeocodingServiceFactory.create();
      expect(service).toBeInstanceOf(BackendGeocodingService);
      expect(service.provider).toBe('gaode');
    });

    test('传入 proxyURL 参数时应覆盖 localStorage 中的值', () => {
      const service = GeocodingServiceFactory.create('http://custom:4000');
      expect(service).toBeInstanceOf(BackendGeocodingService);
      expect(service.proxyURL).toBe('http://custom:4000');
    });
  });

  describe('create() — 后端代理模式', () => {
    beforeEach(() => {
      localStorageStore['api_proxy_url'] = 'http://localhost:3000';
    });

    test('nominatim → BackendGeocodingService, provider=nominatim', () => {
      localStorageStore['geocoding_provider'] = 'nominatim';
      const service = GeocodingServiceFactory.create();
      expect(service).toBeInstanceOf(BackendGeocodingService);
      expect(service.provider).toBe('nominatim');
    });

    test('gaode → BackendGeocodingService, provider=gaode', () => {
      localStorageStore['geocoding_provider'] = 'gaode';
      const service = GeocodingServiceFactory.create();
      expect(service).toBeInstanceOf(BackendGeocodingService);
      expect(service.provider).toBe('gaode');
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

  describe('getOptions()', () => {
    test('应返回 3 个选项', () => {
      const options = GeocodingServiceFactory.getOptions();
      expect(Array.isArray(options)).toBe(true);
      expect(options.length).toBe(3);
    });

    test('每个选项应包含必要字段', () => {
      const options = GeocodingServiceFactory.getOptions();
      options.forEach(opt => {
        expect(opt).toHaveProperty('provider');
        expect(opt).toHaveProperty('labelKey');
        expect(opt).toHaveProperty('requiresKey');
        expect(opt).toHaveProperty('chinaCompatible');
      });
    });

    test('Nominatim 不需要 Key 且中国可用', () => {
      const options = GeocodingServiceFactory.getOptions();
      const opt = options.find(o => o.provider === 'nominatim');
      expect(opt).toBeDefined();
      expect(opt.requiresKey).toBe(false);
      expect(opt.chinaCompatible).toBe(true);
    });

    test('高德不需要 Key 且中国可用', () => {
      const options = GeocodingServiceFactory.getOptions();
      const opt = options.find(o => o.provider === 'gaode');
      expect(opt).toBeDefined();
      expect(opt.requiresKey).toBe(false);
      expect(opt.chinaCompatible).toBe(true);
    });

    test('Nominatim-frontend 不需要 Key 且中国不可用', () => {
      const options = GeocodingServiceFactory.getOptions();
      const opt = options.find(o => o.provider === 'nominatim-frontend');
      expect(opt).toBeDefined();
      expect(opt.requiresKey).toBe(false);
      expect(opt.chinaCompatible).toBe(false);
    });
  });
});
