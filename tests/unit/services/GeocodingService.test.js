/**
 * GeocodingService单元测试
 * 
 * 测试地理编码服务的核心功能
 * 
 * 需求：2.2, 2.3, 2.4, 2.5, 10.4
 */

import GeocodingService from '../../../src/services/GeocodingService.js';
import Location from '../../../src/models/Location.js';

// Polyfill fetch for Node.js test environment
global.fetch = global.fetch || (() => Promise.reject(new Error('fetch is not available')));

describe('GeocodingService', () => {
  let service;

  beforeEach(() => {
    service = new GeocodingService();
  });

  describe('geocode()', () => {
    test('应该拒绝空字符串', async () => {
      await expect(service.geocode('')).rejects.toThrow('位置名称不能为空');
    });

    test('应该拒绝null值', async () => {
      await expect(service.geocode(null)).rejects.toThrow('位置名称不能为空');
    });

    test('应该拒绝undefined值', async () => {
      await expect(service.geocode(undefined)).rejects.toThrow('位置名称不能为空');
    });

    test('应该拒绝只包含空格的字符串', async () => {
      await expect(service.geocode('   ')).rejects.toThrow('位置名称不能为空');
    });

    test('应该拒绝非字符串类型', async () => {
      await expect(service.geocode(123)).rejects.toThrow('位置名称不能为空');
    });

    test('应该能够解析有效的城市名称', async () => {
      // Mock fetch to return a valid location
      const originalFetch = global.fetch;
      global.fetch = () => Promise.resolve({
        ok: true,
        json: () => Promise.resolve([{
          lat: '39.9042',
          lon: '116.4074',
          display_name: 'Beijing, China'
        }])
      });

      const location = await service.geocode('Beijing');
      
      expect(location).toBeInstanceOf(Location);
      expect(location.lat).toBeCloseTo(39.9, 1);
      expect(location.lon).toBeCloseTo(116.4, 1);
      expect(location.name).toContain('Beijing');
      expect(location.isValid()).toBe(true);

      // Restore
      global.fetch = originalFetch;
    });

    test('应该能够解析手动测试城市 test', async () => {
      const location = await service.geocode('test');
      expect(location).toBeInstanceOf(Location);
      expect(location.name).toBe('test');
      expect(location.lat).toBeCloseTo(0);
      expect(location.lon).toBeCloseTo(0);
    });

    test('应该为无效位置名称抛出友好错误', async () => {
      // Mock fetch to return empty results
      const originalFetch = global.fetch;
      global.fetch = () => Promise.resolve({
        ok: true,
        json: () => Promise.resolve([])
      });

      await expect(service.geocode('xyzabc123notarealplace999'))
        .rejects.toThrow(/无法找到位置/);

      // Restore
      global.fetch = originalFetch;
    });

    test('应该处理API速率限制错误', async () => {
      const originalFetch = global.fetch;
      global.fetch = () => Promise.resolve({
        ok: false,
        status: 429
      });

      await expect(service.geocode('Zurich'))
        .rejects.toThrow(/请求过于频繁/);

      // Restore
      global.fetch = originalFetch;
    });

    test('应该处理服务不可用错误', async () => {
      const originalFetch = global.fetch;
      global.fetch = () => Promise.resolve({
        ok: false,
        status: 503
      });

      await expect(service.geocode('Zurich'))
        .rejects.toThrow(/服务不可用/);

      // Restore
      global.fetch = originalFetch;
    });

    test('应该处理网络错误', async () => {
      const originalFetch = global.fetch;
      global.fetch = () => Promise.reject(new TypeError('fetch failed'));

      await expect(service.geocode('Zurich'))
        .rejects.toThrow(/网络连接失败/);

      // Restore
      global.fetch = originalFetch;
    });
  });


  describe('searchCities()', () => {
    test('应该返回离线城市联想结果', async () => {
      const results = await service.searchCities('bei', 5);
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(city => city.enName === 'Beijing' || city.zhName.includes('北京'))).toBe(true);
    });

    test('仅完整手动输入 test 时返回测试城市', async () => {
      const partial = await service.searchCities('tes', 5);
      const exact = await service.searchCities('test', 5);

      expect(partial.some(city => city.displayName === 'test')).toBe(false);
      expect(exact).toHaveLength(1);
      expect(exact[0]).toMatchObject({ displayName: 'test', lat: 0, lon: 0 });
    });

    test('空关键字应返回空数组', async () => {
      const results = await service.searchCities('   ');
      expect(results).toEqual([]);
    });
  });
  describe('getCurrentLocation()', () => {
    test('应该在不支持Geolocation API时抛出错误', async () => {
      // 临时移除navigator.geolocation
      const originalGeolocation = navigator.geolocation;
      Object.defineProperty(navigator, 'geolocation', {
        value: undefined,
        configurable: true
      });

      await expect(service.getCurrentLocation())
        .rejects.toThrow('您的浏览器不支持地理定位功能');

      // 恢复navigator.geolocation
      Object.defineProperty(navigator, 'geolocation', {
        value: originalGeolocation,
        configurable: true
      });
    });

    test('应该处理位置权限被拒绝的情况', async () => {
      // Mock navigator.geolocation.getCurrentPosition
      const mockGetCurrentPosition = (success, error) => {
        const mockError = {
          code: 1, // PERMISSION_DENIED
          message: 'User denied geolocation',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3
        };
        error(mockError);
      };

      const originalGeolocation = navigator.geolocation;
      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition: mockGetCurrentPosition
        },
        configurable: true
      });

      await expect(service.getCurrentLocation())
        .rejects.toThrow(/位置权限被拒绝/);

      // 恢复
      Object.defineProperty(navigator, 'geolocation', {
        value: originalGeolocation,
        configurable: true
      });
    });

    test('应该处理位置信息不可用的情况', async () => {
      const mockGetCurrentPosition = (success, error) => {
        const mockError = {
          code: 2, // POSITION_UNAVAILABLE
          message: 'Position unavailable',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3
        };
        error(mockError);
      };

      const originalGeolocation = navigator.geolocation;
      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition: mockGetCurrentPosition
        },
        configurable: true
      });

      await expect(service.getCurrentLocation())
        .rejects.toThrow(/位置信息不可用/);

      // 恢复
      Object.defineProperty(navigator, 'geolocation', {
        value: originalGeolocation,
        configurable: true
      });
    });

    test('应该处理超时错误', async () => {
      const mockGetCurrentPosition = (success, error) => {
        const mockError = {
          code: 3, // TIMEOUT
          message: 'Timeout',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3
        };
        error(mockError);
      };

      const originalGeolocation = navigator.geolocation;
      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition: mockGetCurrentPosition
        },
        configurable: true
      });

      await expect(service.getCurrentLocation())
        .rejects.toThrow(/获取位置超时/);

      // 恢复
      Object.defineProperty(navigator, 'geolocation', {
        value: originalGeolocation,
        configurable: true
      });
    });

    test('应该成功获取位置并返回Location对象', async () => {
      // Mock成功的位置获取
      const mockGetCurrentPosition = (success) => {
        success({
          coords: {
            latitude: 39.9042,
            longitude: 116.4074
          }
        });
      };

      const originalGeolocation = navigator.geolocation;
      const originalFetch = global.fetch;

      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition: mockGetCurrentPosition
        },
        configurable: true
      });

      // Mock反向地理编码的fetch调用
      global.fetch = () =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            display_name: 'Beijing, China'
          })
        });

      const location = await service.getCurrentLocation();

      expect(location).toBeInstanceOf(Location);
      expect(location.lat).toBeCloseTo(39.9, 1);
      expect(location.lon).toBeCloseTo(116.4, 1);
      expect(location.isValid()).toBe(true);

      // 恢复
      Object.defineProperty(navigator, 'geolocation', {
        value: originalGeolocation,
        configurable: true
      });
      global.fetch = originalFetch;
    });

    test('应该在反向地理编码失败时使用坐标作为名称', async () => {
      const mockGetCurrentPosition = (success) => {
        success({
          coords: {
            latitude: 39.9042,
            longitude: 116.4074
          }
        });
      };

      const originalGeolocation = navigator.geolocation;
      const originalFetch = global.fetch;

      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition: mockGetCurrentPosition
        },
        configurable: true
      });

      // Mock失败的反向地理编码
      global.fetch = () =>
        Promise.reject(new Error('Network error'));

      const location = await service.getCurrentLocation();

      expect(location).toBeInstanceOf(Location);
      expect(location.lat).toBeCloseTo(39.9, 1);
      expect(location.lon).toBeCloseTo(116.4, 1);
      expect(location.name).toMatch(/39\.9042.*116\.4074/);
      expect(location.isValid()).toBe(true);

      // 恢复
      Object.defineProperty(navigator, 'geolocation', {
        value: originalGeolocation,
        configurable: true
      });
      global.fetch = originalFetch;
    });
  });

  describe('reverseGeocode()', () => {
    test('应该能够将坐标转换为位置名称', async () => {
      // Mock fetch for reverse geocoding
      const originalFetch = global.fetch;
      global.fetch = () => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          display_name: 'Beijing, China'
        })
      });

      const name = await service.reverseGeocode(39.9042, 116.4074);
      
      expect(name).toBeTruthy();
      expect(typeof name).toBe('string');
      expect(name).toBe('Beijing, China');

      // Restore
      global.fetch = originalFetch;
    });

    test('应该处理反向地理编码失败', async () => {
      const originalFetch = global.fetch;
      global.fetch = () => Promise.resolve({
        ok: false,
        status: 500
      });

      await expect(service.reverseGeocode(39.9042, 116.4074))
        .rejects.toThrow();

      // Restore
      global.fetch = originalFetch;
    });
  });
});
