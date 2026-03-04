/**
 * StorageService 补充覆盖率测试
 *
 * 覆盖现有 StorageService.test.js 未涉及的方法：
 * removeAPIKey, saveLastLocation, getLastLocation, clearWeatherCache,
 * clearAllWeatherCache, clearAll, isStorageAvailable,
 * removeFavoriteLocation, clearFavoriteLocations,
 * clearNotificationSettings, removeSearchHistoryItem, clearSearchHistory
 *
 * 需求：12, 13, 17, 23.10
 */

import { jest } from '@jest/globals';
import StorageService from '@services/StorageService.js';

describe('StorageService - API 密钥管理', () => {
  let service;

  beforeEach(() => {
    localStorage.clear();
    service = new StorageService();
  });

  test('saveAPIKey 保存密钥后可通过 getAPIKey 取回', () => {
    service.saveAPIKey('my-api-key');
    expect(service.getAPIKey()).toBe('my-api-key');
  });

  test('removeAPIKey 删除后 getAPIKey 返回 null', () => {
    service.saveAPIKey('delete-me');
    service.removeAPIKey();
    expect(service.getAPIKey()).toBeNull();
  });

  test('saveAPIKey 传入空字符串抛出错误', () => {
    expect(() => service.saveAPIKey('')).toThrow('API密钥必须是非空字符串');
  });

  test('saveAPIKey 传入 null 抛出错误', () => {
    expect(() => service.saveAPIKey(null)).toThrow('API密钥必须是非空字符串');
  });

  test('saveAPIKey 传入非字符串抛出错误', () => {
    expect(() => service.saveAPIKey(12345)).toThrow('API密钥必须是非空字符串');
  });
});

describe('StorageService - 上次位置管理', () => {
  let service;

  beforeEach(() => {
    localStorage.clear();
    service = new StorageService();
  });

  test('saveLastLocation 保存后 getLastLocation 返回正确位置', () => {
    const location = { lat: 39.9042, lon: 116.4074, name: '北京' };
    service.saveLastLocation(location);
    const result = service.getLastLocation();

    expect(result.lat).toBe(39.9042);
    expect(result.lon).toBe(116.4074);
    expect(result.name).toBe('北京');
    expect(typeof result.isValid).toBe('function');
    expect(result.isValid()).toBe(true);
  });

  test('saveLastLocation 传入 null 不保存', () => {
    service.saveLastLocation(null);
    expect(service.getLastLocation()).toBeNull();
  });

  test('getLastLocation 在无记录时返回 null', () => {
    expect(service.getLastLocation()).toBeNull();
  });

  test('getLastLocation 的 isValid 对有效坐标返回 true', () => {
    service.saveLastLocation({ lat: 0, lon: 0, name: 'Origin' });
    const result = service.getLastLocation();
    expect(result.isValid()).toBe(true);
  });

  test('getLastLocation JSON 损坏时返回 null', () => {
    localStorage.setItem('last_location', 'not-valid-json{');
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    expect(service.getLastLocation()).toBeNull();
    consoleSpy.mockRestore();
  });
});

describe('StorageService - 天气缓存清除', () => {
  let service;

  beforeEach(() => {
    localStorage.clear();
    service = new StorageService();
  });

  test('clearWeatherCache 删除指定位置的缓存', () => {
    const location = { lat: 39.9042, lon: 116.4074, name: '北京' };
    service.cacheWeatherData(location, [{ temp: 20 }]);

    expect(service.getCachedWeatherData(location)).not.toBeNull();
    service.clearWeatherCache(location);
    expect(service.getCachedWeatherData(location)).toBeNull();
  });

  test('clearWeatherCache 传入 null 不报错', () => {
    expect(() => service.clearWeatherCache(null)).not.toThrow();
  });

  test('clearWeatherCache 删除不存在的位置不报错', () => {
    const location = { lat: 10, lon: 20, name: 'Test' };
    expect(() => service.clearWeatherCache(location)).not.toThrow();
  });

  test('clearAllWeatherCache 清除所有缓存', () => {
    const loc1 = { lat: 39.9042, lon: 116.4074, name: '北京' };
    const loc2 = { lat: 31.2304, lon: 121.4737, name: '上海' };
    service.cacheWeatherData(loc1, [{ temp: 20 }]);
    service.cacheWeatherData(loc2, [{ temp: 25 }]);

    service.clearAllWeatherCache();

    expect(service.getCachedWeatherData(loc1)).toBeNull();
    expect(service.getCachedWeatherData(loc2)).toBeNull();
  });
});

describe('StorageService.clearAll', () => {
  let service;

  beforeEach(() => {
    localStorage.clear();
    service = new StorageService();
  });

  test('clearAll 清除 API 密钥、位置和缓存', () => {
    service.saveAPIKey('test-key');
    service.saveLastLocation({ lat: 39.9, lon: 116.4, name: '北京' });
    service.cacheWeatherData(
      { lat: 39.9, lon: 116.4, name: '北京' },
      [{ temp: 20 }]
    );

    service.clearAll();

    expect(service.getAPIKey()).toBeNull();
    expect(service.getLastLocation()).toBeNull();
    expect(localStorage.getItem('weather_cache')).toBeNull();
  });
});

describe('StorageService.isStorageAvailable', () => {
  let service;

  beforeEach(() => {
    localStorage.clear();
    service = new StorageService();
  });

  test('正常环境下返回 true', () => {
    expect(service.isStorageAvailable()).toBe(true);
  });
});

describe('StorageService - 收藏位置删除与清除', () => {
  let service;

  beforeEach(() => {
    localStorage.clear();
    service = new StorageService();
  });

  test('removeFavoriteLocation 删除已存在的收藏', () => {
    const loc = { lat: 39.9042, lon: 116.4074, name: '北京' };
    service.saveFavoriteLocation(loc);
    expect(service.getFavoriteLocations()).toHaveLength(1);

    const key = `${loc.lat}_${loc.lon}`;
    const result = service.removeFavoriteLocation(key);
    expect(result).toBe(true);
    expect(service.getFavoriteLocations()).toHaveLength(0);
  });

  test('removeFavoriteLocation 删除不存在的位置返回 false', () => {
    const result = service.removeFavoriteLocation('99.9999_99.9999');
    expect(result).toBe(false);
  });

  test('removeFavoriteLocation 传入 null/空字符串返回 false', () => {
    expect(service.removeFavoriteLocation(null)).toBe(false);
    expect(service.removeFavoriteLocation('')).toBe(false);
  });

  test('clearFavoriteLocations 清除所有收藏', () => {
    service.saveFavoriteLocation({ lat: 39.9042, lon: 116.4074, name: '北京' });
    service.saveFavoriteLocation({ lat: 31.2304, lon: 121.4737, name: '上海' });
    expect(service.getFavoriteLocations()).toHaveLength(2);

    service.clearFavoriteLocations();
    expect(service.getFavoriteLocations()).toHaveLength(0);
  });
});

describe('StorageService - 通知设置清除', () => {
  let service;

  beforeEach(() => {
    localStorage.clear();
    service = new StorageService();
  });

  test('clearNotificationSettings 清除后返回默认值', () => {
    service.saveNotificationSettings({ enabled: true, threshold: 80 });
    expect(service.getNotificationSettings().enabled).toBe(true);

    service.clearNotificationSettings();

    const defaults = service.getNotificationSettings();
    expect(defaults.enabled).toBe(false);
    expect(defaults.threshold).toBe(70);
  });
});

describe('StorageService - 搜索历史删除与清除', () => {
  let service;

  beforeEach(() => {
    localStorage.clear();
    service = new StorageService();
  });

  test('removeSearchHistoryItem 删除已存在的记录', () => {
    const loc = { lat: 39.9042, lon: 116.4074, name: '北京' };
    service.saveSearchHistory(loc);
    expect(service.getSearchHistory()).toHaveLength(1);

    const key = `${loc.lat}_${loc.lon}`;
    const result = service.removeSearchHistoryItem(key);
    expect(result).toBe(true);
    expect(service.getSearchHistory()).toHaveLength(0);
  });

  test('removeSearchHistoryItem 删除不存在的记录返回 false', () => {
    const result = service.removeSearchHistoryItem('0.0000_0.0000');
    expect(result).toBe(false);
  });

  test('removeSearchHistoryItem 传入 null/空字符串返回 false', () => {
    expect(service.removeSearchHistoryItem(null)).toBe(false);
    expect(service.removeSearchHistoryItem('')).toBe(false);
  });

  test('clearSearchHistory 清除全部历史，返回 true', () => {
    service.saveSearchHistory({ lat: 39.9042, lon: 116.4074, name: '北京' });
    service.saveSearchHistory({ lat: 31.2304, lon: 121.4737, name: '上海' });
    expect(service.getSearchHistory()).toHaveLength(2);

    const result = service.clearSearchHistory();
    expect(result).toBe(true);
    expect(service.getSearchHistory()).toHaveLength(0);
  });

  test('clearSearchHistory 在空历史时也返回 true', () => {
    expect(service.clearSearchHistory()).toBe(true);
  });
});

describe('StorageService - saveNotificationSettings 边界值', () => {
  let service;

  beforeEach(() => {
    localStorage.clear();
    service = new StorageService();
  });

  test('传入非对象返回 false', () => {
    expect(service.saveNotificationSettings(null)).toBe(false);
    expect(service.saveNotificationSettings('string')).toBe(false);
    expect(service.saveNotificationSettings(42)).toBe(false);
  });

  test('enabled=false 正确保存', () => {
    service.saveNotificationSettings({ enabled: false, threshold: 70 });
    expect(service.getNotificationSettings().enabled).toBe(false);
  });
});

describe('StorageService - getFavoriteLocations JSON 损坏', () => {
  let service;

  beforeEach(() => {
    localStorage.clear();
    service = new StorageService();
  });

  test('localStorage 中收藏数据损坏时返回空数组', () => {
    localStorage.setItem('favorite_locations', 'bad-json[');
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    expect(service.getFavoriteLocations()).toEqual([]);
    consoleSpy.mockRestore();
  });
});

describe('StorageService - getSearchHistory JSON 损坏', () => {
  let service;

  beforeEach(() => {
    localStorage.clear();
    service = new StorageService();
  });

  test('搜索历史数据损坏时返回空数组', () => {
    localStorage.setItem('search_history', '{bad-json');
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    expect(service.getSearchHistory()).toEqual([]);
    consoleSpy.mockRestore();
  });
});
