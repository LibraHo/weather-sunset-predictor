/**
 * StorageService增强单元测试 - 边缘情况和健壮性测试
 *
 * 测试场景：
 * - localStorage不可用情况
 * - 缓存过期边缘测试
 * - 并发读写操作
 * - 存储配额满
 * - 隐私模式
 *
 * 需求：存储服务健壮性
 */

import StorageService from '../../../../src/services/StorageService.js';

// Mock localStorage
const mockLocalStorage = {
  store: {},
  getItem: function(key) {
    return this.store[key] || null;
  },
  setItem: function(key, value) {
    this.store[key] = value;
  },
  removeItem: function(key) {
    delete this.store[key];
  },
  clear: function() {
    this.store = {};
  },
  get length() {
    return Object.keys(this.store).length;
  },
  key: function(index) {
    return Object.keys(this.store)[index] || null;
  }
};

describe('StorageService - localStorage不可用测试', () => {
  let originalLocalStorage;

  beforeEach(() => {
    // 保存原始localStorage
    originalLocalStorage = global.localStorage;
    // 重置mock
    mockLocalStorage.clear();
  });

  afterEach(() => {
    // 恢复原始localStorage
    global.localStorage = originalLocalStorage;
  });

  describe('localStorage完全不可用', () => {
    beforeEach(() => {
      // 模拟localStorage被禁用（如隐私模式）
      Object.defineProperty(global, 'localStorage', {
        value: null,
        writable: false,
        configurable: true
      });
    });

    test('isStorageAvailable应该返回false', () => {
      const service = new StorageService();
      expect(service.isStorageAvailable()).toBe(false);
    });

    test('saveAPIKey应该抛出错误', () => {
      const service = new StorageService();
      expect(() => {
        service.saveAPIKey('test-key');
      }).toThrow();
    });

    test('getAPIKey应该返回null', () => {
      const service = new StorageService();
      expect(service.getAPIKey()).toBeNull();
    });
  });

  describe('localStorage抛出异常（配额满）', () => {
    beforeEach(() => {
      // 模拟localStorage配额满
      const errorLocalStorage = {
        ...mockLocalStorage,
        setItem: function(key, value) {
          if (key === 'windy_api_key') {
            throw new DOMException('QuotaExceededError', 'QuotaExceededError');
          }
          mockLocalStorage.setItem.call(this, key, value);
        }
      };
      global.localStorage = errorLocalStorage;
    });

    test('saveAPIKey应该捕获QuotaExceededError', () => {
      const service = new StorageService();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        service.saveAPIKey('test-key');
      }).toThrow('无法保存API密钥，请检查浏览器存储设置');

      consoleSpy.mockRestore();
    });
  });

  describe('localStorage getItem抛出异常', () => {
    beforeEach(() => {
      const errorLocalStorage = {
        ...mockLocalStorage,
        getItem: function(key) {
          throw new Error('SecurityError');
        }
      };
      global.localStorage = errorLocalStorage;
    });

    test('getAPIKey应该捕获异常并返回null', () => {
      const service = new StorageService();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(service.getAPIKey()).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('getCachedWeatherData应该捕获异常并返回null', () => {
      const service = new StorageService();
      const location = {
        lat: 39.9042,
        lon: 116.4074,
        name: '北京'
      };

      expect(service.getCachedWeatherData(location)).toBeNull();
    });
  });
});

describe('StorageService - 缓存过期边缘测试', () => {
  let service;
  const CACHE_DURATION = 30 * 60 * 1000; // 30分钟

  beforeEach(() => {
    global.localStorage = mockLocalStorage;
    mockLocalStorage.clear();
    service = new StorageService();
  });

  afterEach(() => {
    mockLocalStorage.clear();
  });

  describe('缓存过期边界测试', () => {
    test('应该接受刚好未过期的缓存（29分59秒）', () => {
      const location = {
        lat: 39.9042,
        lon: 116.4074,
        name: '北京'
      };
      const testData = [{ temp: 20, humidity: 50 }];

      // 缓存时间：29分59秒前
      const timestamp = Date.now() - CACHE_DURATION + 1000;
      service.cacheWeatherData(location, testData, timestamp);

      const cached = service.getCachedWeatherData(location);
      expect(cached).toEqual(testData);
    });

    test('应该拒绝刚好过期的缓存（30分钟）', () => {
      const location = {
        lat: 39.9042,
        lon: 116.4074,
        name: '北京'
      };
      const testData = [{ temp: 20, humidity: 50 }];

      // 缓存时间：刚好30分钟前
      const timestamp = Date.now() - CACHE_DURATION;
      service.cacheWeatherData(location, testData, timestamp);

      const cached = service.getCachedWeatherData(location);
      expect(cached).toBeNull();

      // 验证缓存已被删除
      const cache = service.getWeatherCache();
      expect(cache[service.getLocationCacheKey(location)]).toBeUndefined();
    });

    test('应该拒绝已经过期的缓存（30分1秒）', () => {
      const location = {
        lat: 39.9042,
        lon: 116.4074,
        name: '北京'
      };
      const testData = [{ temp: 20, humidity: 50 }];

      // 缓存时间：30分1秒前
      const timestamp = Date.now() - CACHE_DURATION - 1000;
      service.cacheWeatherData(location, testData, timestamp);

      const cached = service.getCachedWeatherData(location);
      expect(cached).toBeNull();
    });

    test('应该接受未来时间戳的缓存（时钟偏差）', () => {
      const location = {
        lat: 39.9042,
        lon: 116.4074,
        name: '北京'
      };
      const testData = [{ temp: 20, humidity: 50 }];

      // 缓存时间：未来1秒
      const timestamp = Date.now() + 1000;
      service.cacheWeatherData(location, testData, timestamp);

      const cached = service.getCachedWeatherData(location);
      expect(cached).toEqual(testData);
    });

    test('应该处理零时间戳的缓存', () => {
      const location = {
        lat: 39.9042,
        lon: 116.4074,
        name: '北京'
      };
      const testData = [{ temp: 20, humidity: 50 }];

      // 缓存时间：Unix纪元（1970年）
      const timestamp = 0;
      service.cacheWeatherData(location, testData, timestamp);

      const cached = service.getCachedWeatherData(location);
      expect(cached).toBeNull(); // 应该被视为过期
    });

    test('应该处理负时间戳的缓存', () => {
      const location = {
        lat: 39.9042,
        lon: 116.4074,
        name: '北京'
      };
      const testData = [{ temp: 20, humidity: 50 }];

      // 缓存时间：负时间戳
      const timestamp = -1000;
      service.cacheWeatherData(location, testData, timestamp);

      const cached = service.getCachedWeatherData(location);
      expect(cached).toBeNull(); // 应该被视为过期
    });
  });

  describe('多位置缓存管理', () => {
    test('应该正确管理多个位置的缓存', () => {
      const location1 = { lat: 39.9042, lon: 116.4074, name: '北京' };
      const location2 = { lat: 31.2304, lon: 121.4737, name: '上海' };
      const data1 = [{ temp: 20, humidity: 50 }];
      const data2 = [{ temp: 25, humidity: 60 }];

      service.cacheWeatherData(location1, data1);
      service.cacheWeatherData(location2, data2);

      expect(service.getCachedWeatherData(location1)).toEqual(data1);
      expect(service.getCachedWeatherData(location2)).toEqual(data2);
    });

    test('应该只删除过期的缓存，保留有效的', () => {
      const location1 = { lat: 39.9042, lon: 116.4074, name: '北京' };
      const location2 = { lat: 31.2304, lon: 121.4737, name: '上海' };
      const data1 = [{ temp: 20, humidity: 50 }];
      const data2 = [{ temp: 25, humidity: 60 }];

      // 缓存1：刚创建（有效）
      service.cacheWeatherData(location1, data1, Date.now());

      // 缓存2：31分钟前（过期）
      service.cacheWeatherData(location2, data2, Date.now() - CACHE_DURATION - 60000);

      // 获取缓存1应该有效
      expect(service.getCachedWeatherData(location1)).toEqual(data1);

      // 获取缓存2应该返回null并删除
      expect(service.getCachedWeatherData(location2)).toBeNull();

      // 验证缓存1仍然存在
      expect(service.getCachedWeatherData(location1)).toEqual(data1);
    });
  });
});

describe('StorageService - 并发操作测试', () => {
  let service;

  beforeEach(() => {
    global.localStorage = mockLocalStorage;
    mockLocalStorage.clear();
    service = new StorageService();
  });

  afterEach(() => {
    mockLocalStorage.clear();
  });

  test('应该处理快速的连续读写', () => {
    const location = {
      lat: 39.9042,
      lon: 116.4074,
      name: '北京'
    };

    // 快速连续缓存100次
    for (let i = 0; i < 100; i++) {
      service.cacheWeatherData(location, [{ temp: i, humidity: 50 }]);
    }

    // 最后一次缓存应该生效
    const cached = service.getCachedWeatherData(location);
    expect(cached).toEqual([{ temp: 99, humidity: 50 }]);
  });

  test('应该处理API密钥的并发保存', () => {
    const promises = [];

    // 并发保存10个不同的API密钥
    for (let i = 0; i < 10; i++) {
      promises.push(
        new Promise((resolve) => {
          service.saveAPIKey(`key-${i}`);
          resolve();
        })
      );
    }

    return Promise.all(promises).then(() => {
      // 应该保存最后一个密钥
      expect(service.getAPIKey()).toBe('key-9');
    });
  });

  test('应该处理收藏位置的并发添加', () => {
    const locations = [
      { lat: 39.9042, lon: 116.4074, name: '北京' },
      { lat: 31.2304, lon: 121.4737, name: '上海' },
      { lat: 23.1291, lon: 113.2644, name: '广州' }
    ];

    locations.forEach(loc => {
      service.saveFavoriteLocation(loc);
    });

    const favorites = service.getFavoriteLocations();
    expect(favorites).toHaveLength(3);
  });
});

describe('StorageService - 搜索历史LRU策略测试', () => {
  let service;

  beforeEach(() => {
    global.localStorage = mockLocalStorage;
    mockLocalStorage.clear();
    service = new StorageService();
  });

  afterEach(() => {
    mockLocalStorage.clear();
  });

  test('应该限制历史记录为5个', () => {
    const locations = [
      { lat: 39.9042, lon: 116.4074, name: '北京' },
      { lat: 31.2304, lon: 121.4737, name: '上海' },
      { lat: 23.1291, lon: 113.2644, name: '广州' },
      { lat: 22.5431, lon: 114.0579, name: '深圳' },
      { lat: 30.5728, lon: 104.0668, name: '成都' },
      { lat: 29.5630, lon: 106.5516, name: '重庆' } // 第6个
    ];

    locations.forEach(loc => {
      service.saveSearchHistory(loc);
    });

    const history = service.getSearchHistory();
    expect(history).toHaveLength(5);
    expect(history[0].name).toBe('重庆'); // 最新的
    expect(history[4].name).toBe('上海'); // 第5个
    expect(history.find(h => h.name === '北京')).toBeUndefined(); // 被移除的
  });

  test('应该将重复位置移到最前面', () => {
    const locations = [
      { lat: 39.9042, lon: 116.4074, name: '北京' },
      { lat: 31.2304, lon: 121.4737, name: '上海' },
      { lat: 39.9042, lon: 116.4074, name: '北京' } // 重复
    ];

    locations.forEach(loc => {
      service.saveSearchHistory(loc);
    });

    const history = service.getSearchHistory();
    expect(history).toHaveLength(2);
    expect(history[0].name).toBe('北京'); // 北京在最前面
    expect(history[1].name).toBe('上海');
  });

  test('应该按时间戳倒序返回历史', () => {
    // 模拟不同时间的位置
    const now = Date.now();
    const locations = [
      { lat: 39.9042, lon: 116.4074, name: '北京', timestamp: now - 3000 },
      { lat: 31.2304, lon: 121.4737, name: '上海', timestamp: now - 2000 },
      { lat: 23.1291, lon: 113.2644, name: '广州', timestamp: now - 1000 }
    ];

    mockLocalStorage.store['search_history'] = JSON.stringify(locations);

    const history = service.getSearchHistory();
    expect(history[0].name).toBe('广州'); // 最新
    expect(history[1].name).toBe('上海');
    expect(history[2].name).toBe('北京'); // 最旧
  });
});

describe('StorageService - 收藏位置唯一性测试', () => {
  let service;

  beforeEach(() => {
    global.localStorage = mockLocalStorage;
    mockLocalStorage.clear();
    service = new StorageService();
  });

  afterEach(() => {
    mockLocalStorage.clear();
  });

  test('应该拒绝重复的收藏位置（相同坐标）', () => {
    const location1 = { lat: 39.9042, lon: 116.4074, name: '北京' };
    const location2 = { lat: 39.9042, lon: 116.4074, name: '北京-重复' };

    expect(service.saveFavoriteLocation(location1)).toBe(true);
    expect(service.saveFavoriteLocation(location2)).toBe(false); // 重复，应该失败

    const favorites = service.getFavoriteLocations();
    expect(favorites).toHaveLength(1);
    expect(favorites[0].name).toBe('北京'); // 保留第一个名称
  });

  test('应该接受不同坐标的位置', () => {
    const location1 = { lat: 39.9042, lon: 116.4074, name: '北京' };
    const location2 = { lat: 39.9043, lon: 116.4074, name: '北京-附近' }; // 略有不同

    expect(service.saveFavoriteLocation(location1)).toBe(true);
    expect(service.saveFavoriteLocation(location2)).toBe(true); // 不同坐标

    const favorites = service.getFavoriteLocations();
    expect(favorites).toHaveLength(2);
  });
});

describe('StorageService - 通知设置验证测试', () => {
  let service;

  beforeEach(() => {
    global.localStorage = mockLocalStorage;
    mockLocalStorage.clear();
    service = new StorageService();
  });

  afterEach(() => {
    mockLocalStorage.clear();
  });

  test('应该限制阈值在0-100范围', () => {
    service.saveNotificationSettings({ enabled: true, threshold: 150 });
    let settings = service.getNotificationSettings();
    expect(settings.threshold).toBe(100);

    service.saveNotificationSettings({ enabled: true, threshold: -10 });
    settings = service.getNotificationSettings();
    expect(settings.threshold).toBe(0);
  });

  test('应该返回默认设置当未设置时', () => {
    const settings = service.getNotificationSettings();
    expect(settings).toEqual({
      enabled: false,
      threshold: 70
    });
  });

  test('应该正确处理布尔值转换', () => {
    service.saveNotificationSettings({ enabled: 'true', threshold: 80 });
    const settings = service.getNotificationSettings();
    expect(settings.enabled).toBe(true); // 字符串'true'应该被转换

    service.saveNotificationSettings({ enabled: 0, threshold: 80 });
    const settings2 = service.getNotificationSettings();
    expect(settings2.enabled).toBe(false); // 0应该被转换为false
  });
});

describe('StorageService - 默认位置管理测试', () => {
  let service;

  beforeEach(() => {
    global.localStorage = mockLocalStorage;
    mockLocalStorage.clear();
    service = new StorageService();
  });

  afterEach(() => {
    mockLocalStorage.clear();
  });

  test('应该保存和获取默认位置', () => {
    const location = { lat: 39.9042, lon: 116.4074, name: '北京' };

    expect(service.saveDefaultLocation(location)).toBe(true);

    const defaultLocation = service.getDefaultLocation();
    expect(defaultLocation).toEqual({
      lat: 39.9042,
      lon: 116.4074,
      name: '北京',
      isValid: expect.any(Function)
    });
    expect(defaultLocation.isValid()).toBe(true);
  });

  test('应该清除默认位置', () => {
    const location = { lat: 39.9042, lon: 116.4074, name: '北京' };
    service.saveDefaultLocation(location);

    expect(service.clearDefaultLocation()).toBe(true);
    expect(service.getDefaultLocation()).toBeNull();
  });

  test('应该处理无效的位置对象', () => {
    expect(service.saveDefaultLocation(null)).toBe(false);
    expect(service.saveDefaultLocation({})).toBe(false);
    expect(service.saveDefaultLocation({ lat: 39.9042 })).toBe(false); // 缺少lon
  });
});
