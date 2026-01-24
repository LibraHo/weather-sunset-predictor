/**
 * Location类单元测试
 * 
 * 测试Location类的基本功能和边缘情况
 */

import Location from '../../../src/models/Location.js';

describe('Location', () => {
  describe('constructor', () => {
    test('应该正确创建Location实例', () => {
      const location = new Location(39.9042, 116.4074, '北京');
      
      expect(location.lat).toBe(39.9042);
      expect(location.lon).toBe(116.4074);
      expect(location.name).toBe('北京');
    });

    test('应该接受负数坐标', () => {
      const location = new Location(-33.8688, -151.2093, '悉尼');
      
      expect(location.lat).toBe(-33.8688);
      expect(location.lon).toBe(-151.2093);
      expect(location.name).toBe('悉尼');
    });
  });

  describe('isValid', () => {
    test('应该验证有效的坐标', () => {
      const validLocations = [
        new Location(0, 0, '赤道'),
        new Location(39.9042, 116.4074, '北京'),
        new Location(-33.8688, 151.2093, '悉尼'),
        new Location(51.5074, -0.1278, '伦敦'),
        new Location(90, 180, '北极边界'),
        new Location(-90, -180, '南极边界'),
      ];

      validLocations.forEach(location => {
        expect(location.isValid()).toBe(true);
      });
    });

    test('应该拒绝纬度超出范围的坐标', () => {
      const invalidLatLocations = [
        new Location(91, 0, '无效纬度'),
        new Location(-91, 0, '无效纬度'),
        new Location(100, 50, '无效纬度'),
        new Location(-100, 50, '无效纬度'),
      ];

      invalidLatLocations.forEach(location => {
        expect(location.isValid()).toBe(false);
      });
    });

    test('应该拒绝经度超出范围的坐标', () => {
      const invalidLonLocations = [
        new Location(0, 181, '无效经度'),
        new Location(0, -181, '无效经度'),
        new Location(50, 200, '无效经度'),
        new Location(50, -200, '无效经度'),
      ];

      invalidLonLocations.forEach(location => {
        expect(location.isValid()).toBe(false);
      });
    });

    test('应该拒绝纬度和经度都超出范围的坐标', () => {
      const invalidLocations = [
        new Location(91, 181, '完全无效'),
        new Location(-91, -181, '完全无效'),
        new Location(100, 200, '完全无效'),
      ];

      invalidLocations.forEach(location => {
        expect(location.isValid()).toBe(false);
      });
    });

    test('应该接受边界值', () => {
      const boundaryLocations = [
        new Location(90, 0, '北极'),
        new Location(-90, 0, '南极'),
        new Location(0, 180, '国际日期变更线东'),
        new Location(0, -180, '国际日期变更线西'),
        new Location(90, 180, '东北极点'),
        new Location(-90, -180, '西南极点'),
      ];

      boundaryLocations.forEach(location => {
        expect(location.isValid()).toBe(true);
      });
    });

    test('应该拒绝刚好超出边界的值', () => {
      const justOutOfBounds = [
        new Location(90.0001, 0, '略超北极'),
        new Location(-90.0001, 0, '略超南极'),
        new Location(0, 180.0001, '略超东界'),
        new Location(0, -180.0001, '略超西界'),
      ];

      justOutOfBounds.forEach(location => {
        expect(location.isValid()).toBe(false);
      });
    });
  });
});
