/**
 * BackendGeocodingService 单元测试
 * 需求：24
 */

import { jest } from '@jest/globals';
import BackendGeocodingService from '../../../src/services/BackendGeocodingService.js';
import Location from '../../../src/models/Location.js';

// Mock fetch at module level (required for ES module Jest)
global.fetch = jest.fn();

describe('BackendGeocodingService', () => {
  let service;

  beforeEach(() => {
    fetch.mockClear();
    service = new BackendGeocodingService({
      proxyURL: 'http://localhost:3000',
      provider: 'nominatim'
    });
  });

  // ========== constructor ==========

  describe('constructor', () => {
    test('应使用默认值初始化', () => {
      const s = new BackendGeocodingService();
      expect(s.proxyURL).toBe('http://localhost:3000');
      expect(s.provider).toBe('nominatim');
      expect(s.apiKey).toBe('');
    });

    test('应接受自定义选项', () => {
      const s = new BackendGeocodingService({
        proxyURL: 'http://example.com',
        provider: 'gaode',
        apiKey: 'my-key'
      });
      expect(s.proxyURL).toBe('http://example.com');
      expect(s.provider).toBe('gaode');
      expect(s.apiKey).toBe('my-key');
    });
  });

  // ========== geocode() ==========

  describe('geocode()', () => {
    test('应拒绝空字符串', async () => {
      await expect(service.geocode('')).rejects.toThrow('位置名称不能为空');
    });

    test('应拒绝 null', async () => {
      await expect(service.geocode(null)).rejects.toThrow('位置名称不能为空');
    });

    test('应拒绝纯空格字符串', async () => {
      await expect(service.geocode('   ')).rejects.toThrow('位置名称不能为空');
    });

    test('应拒绝非字符串类型', async () => {
      await expect(service.geocode(123)).rejects.toThrow('位置名称不能为空');
    });

    test('成功时返回 Location 对象并携带 country/region 元数据', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          results: [{ name: '北京市', lat: 39.9042, lon: 116.4074, provider: 'nominatim', countryCode: 'cn', regionCode: '110000' }]
        })
      });

      const result = await service.geocode('北京');
      expect(result).toBeInstanceOf(Location);
      expect(result.lat).toBeCloseTo(39.9042);
      expect(result.lon).toBeCloseTo(116.4074);
      expect(result.name).toBe('北京市');
      expect(result.countryCode).toBe('CN');
      expect(result.regionCode).toBe('110000');
    });

    test('结果为空时应抛出错误', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ results: [] })
      });

      await expect(service.geocode('不存在的地方XYZ')).rejects.toThrow('无法找到位置');
    });

    test('400 状态时应抛出参数错误', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: '缺少搜索关键词 q' } })
      });

      await expect(service.geocode('test')).rejects.toThrow('缺少搜索关键词 q');
    });

    test('非 ok 状态时应抛出服务不可用错误', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({})
      });

      await expect(service.geocode('test')).rejects.toThrow('503');
    });

    test('fetch 网络错误时应抛出连接错误', async () => {
      fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(service.geocode('test')).rejects.toThrow('无法连接到后端服务器');
    });

    test('应向 URL 附加 provider 参数', async () => {
      const gaodeService = new BackendGeocodingService({
        proxyURL: 'http://localhost:3000',
        provider: 'gaode',
        apiKey: 'test-key'
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          results: [{ name: '上海', lat: 31.2304, lon: 121.4737, provider: 'gaode' }]
        })
      });

      await gaodeService.geocode('上海');

      const calledUrl = fetch.mock.calls[0][0];
      expect(calledUrl).toContain('provider=gaode');
      expect(calledUrl).toContain('key=test-key');
    });
  });

  // ========== reverseGeocode() ==========

  describe('reverseGeocode()', () => {
    test('成功时返回地名字符串', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ name: '北京市朝阳区', lat: 39.9, lon: 116.4, provider: 'nominatim' })
      });

      const name = await service.reverseGeocode(39.9, 116.4);
      expect(name).toBe('北京市朝阳区');
    });

    test('无匹配时返回 null', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ name: null })
      });

      const name = await service.reverseGeocode(0, 0);
      expect(name).toBeNull();
    });

    test('非 ok 状态时应抛出错误', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({})
      });

      await expect(service.reverseGeocode(39.9, 116.4)).rejects.toThrow('反向地理编码失败');
    });

    test('应传递 provider 参数', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ name: '某地' })
      });

      await service.reverseGeocode(39.9, 116.4);

      const calledUrl = fetch.mock.calls[0][0];
      expect(calledUrl).toContain('provider=nominatim');
    });
  });

  // ========== getCurrentLocation() ==========

  describe('getCurrentLocation()', () => {
    test('浏览器不支持地理定位时应抛出错误', async () => {
      Object.defineProperty(global, 'navigator', {
        value: { geolocation: undefined },
        configurable: true
      });

      await expect(service.getCurrentLocation()).rejects.toThrow('不支持地理定位');
    });

    test('成功获取位置时返回 Location 对象', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ name: '北京市' })
      });

      const mockGeolocation = {
        getCurrentPosition: jest.fn((success) =>
          success({ coords: { latitude: 39.9, longitude: 116.4 } })
        )
      };

      Object.defineProperty(global, 'navigator', {
        value: { geolocation: mockGeolocation },
        configurable: true
      });

      const location = await service.getCurrentLocation();
      expect(location).toBeInstanceOf(Location);
      expect(location.lat).toBeCloseTo(39.9);
      expect(location.lon).toBeCloseTo(116.4);
    });

    test('GPS 权限拒绝时应抛出错误', async () => {
      const mockGeolocation = {
        getCurrentPosition: jest.fn((_, error) =>
          error({ code: 1, PERMISSION_DENIED: 1, message: 'PERMISSION_DENIED' })
        )
      };

      Object.defineProperty(global, 'navigator', {
        value: { geolocation: mockGeolocation },
        configurable: true
      });

      await expect(service.getCurrentLocation()).rejects.toThrow('位置权限被拒绝');
    });

    test('位置不可用时应抛出错误', async () => {
      const mockGeolocation = {
        getCurrentPosition: jest.fn((_, error) =>
          error({ code: 2, POSITION_UNAVAILABLE: 2, message: 'POSITION_UNAVAILABLE' })
        )
      };

      Object.defineProperty(global, 'navigator', {
        value: { geolocation: mockGeolocation },
        configurable: true
      });

      await expect(service.getCurrentLocation()).rejects.toThrow('位置信息不可用');
    });

    test('超时时应抛出错误', async () => {
      const mockGeolocation = {
        getCurrentPosition: jest.fn((_, error) =>
          error({ code: 3, TIMEOUT: 3, message: 'TIMEOUT' })
        )
      };

      Object.defineProperty(global, 'navigator', {
        value: { geolocation: mockGeolocation },
        configurable: true
      });

      await expect(service.getCurrentLocation()).rejects.toThrow('获取位置超时');
    });
  });
});
