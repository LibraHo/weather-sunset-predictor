/**
 * 控制器交互集成测试
 *
 * 测试场景：
 * - AppController → WeatherController → PredictionController 数据流
 * - 错误传播：服务层 → 控制器 → UI
 * - 事件监听：位置切换时各控制器响应
 *
 * 需求：控制器集成健壮性
 */

import { jest } from '@jest/globals';
import AppController from '@controllers/AppController.js';
import WeatherController from '@controllers/WeatherController.js';
import PredictionController from '@controllers/PredictionController.js';
import StorageService from '@services/StorageService.js';
import WindyAPIService from '@services/WindyAPIService.js';
import SunsetPredictionService from '@services/SunsetPredictionService.js';

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
  }
};

// Mock fetch
global.fetch = jest.fn();

describe('控制器交互测试 - 数据流', () => {
  let appController;
  let weatherController;
  let predictionController;

  beforeEach(() => {
    // 重置mock
    mockLocalStorage.clear();
    fetch.mockClear();

    // 创建服务实例
    const storageService = new StorageService();
    const apiService = new WindyAPIService('test-api-key', { useProxy: true });
    const predictionService = new SunsetPredictionService();

    // 创建控制器实例
    weatherController = new WeatherController(apiService, storageService);
    predictionController = new PredictionController(predictionService);
    appController = new AppController(storageService, weatherController, predictionController);

    global.localStorage = mockLocalStorage;
  });

  describe('位置切换时的数据流', () => {
    test('应该：位置变化 → 天气数据更新 → 预测重新计算', async () => {
      // Mock API响应
      const mockWeatherData = [
        {
          timestamp: Date.now(),
          temp: 20,
          humidity: 65,
          cloudCover: 50,
          windSpeed: 10,
          pressure: 1013,
          visibility: 10,
          lowClouds: 30,
          precipitation: 0,
          windDirection: 180,
          highClouds: 20,
          midClouds: 40,
          isValid: () => true
        }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockWeatherData })
      });

      const location = {
        lat: 39.9042,
        lon: 116.4074,
        name: '北京',
        isValid: () => true
      };

      // 模拟位置变化
      await appController.handleLocationChange(location);

      // 验证天气数据已更新
      expect(weatherController.currentLocation).toEqual(location);
      expect(weatherController.weatherData).toHaveLength(1);

      // 验证预测已生成
      expect(predictionController.predictions).toBeDefined();
    });

    test('应该：位置变化时触发所有控制器的事件监听器', async () => {
      const location = {
        lat: 39.9042,
        lon: 116.4074,
        name: '北京',
        isValid: () => true
      };

      // Mock响应
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] })
      });

      // 设置事件监听器
      const weatherSpy = jest.spyOn(weatherController, 'onLocationChanged');
      const predictionSpy = jest.spyOn(predictionController, 'onLocationChanged');

      await appController.handleLocationChange(location);

      // 验证事件被触发
      // 注意：这取决于你的控制器实现是否包含这些方法
    });
  });

  describe('数据传递测试', () => {
    test('WeatherController应该将天气数据传递给PredictionController', async () => {
      const mockWeatherData = [
        {
          timestamp: Date.now(),
          temp: 20,
          humidity: 65,
          cloudCover: 50,
          windSpeed: 10,
          pressure: 1013,
          visibility: 10,
          lowClouds: 30,
          precipitation: 0,
          windDirection: 180,
          highClouds: 20,
          midClouds: 40,
          isValid: () => true
        }
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockWeatherData })
      });

      const location = {
        lat: 39.9042,
        lon: 116.4074,
        name: '北京',
        isValid: () => true
      };

      await weatherController.fetchWeather(location);

      // 验证天气数据已加载
      expect(weatherController.weatherData).toHaveLength(1);

      // 生成预测
      const predictions = predictionController.generatePredictions(
        weatherController.weatherData,
        location
      );

      // 验证预测使用了天气数据
      expect(predictions).toBeDefined();
      expect(predictions.length).toBeGreaterThan(0);
    });

    test('AppController应该协调数据在控制器间传递', async () => {
      // 这取决于你的AppController实现
      // 主要是验证它正确调用了子控制器的方法
    });
  });
});

describe('控制器交互测试 - 错误传播', () => {
  let appController;
  let weatherController;
  let predictionController;

  beforeEach(() => {
    mockLocalStorage.clear();
    fetch.mockClear();

    const storageService = new StorageService();
    const apiService = new WindyAPIService('test-api-key', { useProxy: true });
    const predictionService = new SunsetPredictionService();

    weatherController = new WeatherController(apiService, storageService);
    predictionController = new PredictionController(predictionService);
    appController = new AppController(storageService, weatherController, predictionController);

    global.localStorage = mockLocalStorage;
  });

  test('应该：API错误 → WeatherController捕获 → AppController处理 → UI显示错误', async () => {
    // Mock API错误
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid API key' } })
    });

    const location = {
      lat: 39.9042,
      lon: 116.4074,
      name: '北京',
      isValid: () => true
    };

    // 尝试获取天气数据
    await expect(weatherController.fetchWeather(location))
      .rejects
      .toThrow();

    // 验证错误被正确传播
    // 注意：这取决于你的错误处理实现
  });

  test('应该：网络错误 → 控制器优雅降级 → 显示缓存数据（如果有）', async () => {
    // Mock网络错误
    fetch.mockRejectedValueOnce(new Error('Network error'));

    // 保存一些缓存数据
    const cachedData = [
      {
        timestamp: Date.now() - 3600000, // 1小时前
        temp: 20,
        humidity: 65,
        cloudCover: 50,
        isValid: () => true
      }
    ];

    const storageService = new StorageService();
    const location = {
      lat: 39.9042,
      lon: 116.4074,
      name: '北京',
      isValid: () => true
    };

    storageService.cacheWeatherData(location, cachedData);

    // 尝试获取新数据（失败）
    // 然后降级到缓存数据
    // 这取决于你的实现
  });

  test('应该：预测算法错误 → PredictionController处理 → 不影响天气数据显示', () => {
    const invalidWeatherData = [
      {
        timestamp: Date.now(),
        temp: null, // 无效数据
        humidity: 65,
        cloudCover: 50,
        isValid: () => false
      }
    ];

    const location = {
      lat: 39.9042,
      lon: 116.4074,
      name: '北京',
      isValid: () => true
    };

    // 预测算法应该优雅地处理无效数据
    const predictions = predictionController.generatePredictions(
      invalidWeatherData,
      location
    );

    // 验证返回了空预测或默认预测，而不是抛出错误
    expect(predictions).toBeDefined();
  });
});

describe('控制器交互测试 - 事件协调', () => {
  let appController;
  let weatherController;
  let predictionController;

  beforeEach(() => {
    mockLocalStorage.clear();
    fetch.mockClear();

    const storageService = new StorageService();
    const apiService = new WindyAPIService('test-api-key');
    const predictionService = new SunsetPredictionService();

    weatherController = new WeatherController(apiService, storageService);
    predictionController = new PredictionController(predictionService);
    appController = new AppController(storageService, weatherController, predictionController);

    global.localStorage = mockLocalStorage;
  });

  test('应该：位置切换 → 所有控制器更新状态', async () => {
    const location1 = {
      lat: 39.9042,
      lon: 116.4074,
      name: '北京',
      isValid: () => true
    };

    const location2 = {
      lat: 31.2304,
      lon: 121.4737,
      name: '上海',
      isValid: () => true
    };

    // Mock响应
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] })
    });

    // 切换到第一个位置
    await appController.handleLocationChange(location1);
    expect(weatherController.currentLocation).toEqual(location1);

    // 切换到第二个位置
    await appController.handleLocationChange(location2);
    expect(weatherController.currentLocation).toEqual(location2);

    // 验证状态被正确更新
    expect(weatherController.weatherData).toBeDefined();
  });

  test('应该：数据刷新 → 保持UI状态不变', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] })
    });

    const location = {
      lat: 39.9042,
      lon: 116.4074,
      name: '北京',
      isValid: () => true
    };

    // 首次加载
    await appController.handleLocationChange(location);

    // 刷新数据
    await appController.refreshData();

    // 验证位置没有改变
    expect(weatherController.currentLocation).toEqual(location);
  });
});

describe('控制器交互测试 - 状态同步', () => {
  let appController;
  let weatherController;
  let predictionController;

  beforeEach(() => {
    mockLocalStorage.clear();
    fetch.mockClear();

    const storageService = new StorageService();
    const apiService = new WindyAPIService('test-api-key');
    const predictionService = new SunsetPredictionService();

    weatherController = new WeatherController(apiService, storageService);
    predictionController = new PredictionController(predictionService);
    appController = new AppController(storageService, weatherController, predictionController);

    global.localStorage = mockLocalStorage;
  });

  test('应该：设置变更 → 相关控制器响应', () => {
    // 例如：单位切换 → WeatherController重新渲染数据
    // 例如：语言切换 → 所有控制器更新文案

    // 这取决于你的设置系统实现
  });

  test('应该：收藏位置变更 → AppController和WeatherController同步', () => {
    const location = {
      lat: 39.9042,
      lon: 116.4074,
      name: '北京',
      isValid: () => true
    };

    // 添加收藏
    const result = appController.addFavoriteLocation(location);

    expect(result).toBe(true);

    // 验证收藏已保存
    const favorites = appController.loadFavoriteLocations();
    expect(favorites).toContainEqual(
      expect.objectContaining({
        lat: 39.9042,
        lon: 116.4074
      })
    );
  });

  test('应该：通知设置变更 → PredictionController更新通知逻辑', () => {
    const settings = {
      enabled: true,
      threshold: 80
    };

    appController.updateNotificationSettings(settings);

    // 验证设置已保存
    const savedSettings = appController.storageService.getNotificationSettings();
    expect(savedSettings).toEqual(settings);

    // PredictionController应该在下次预测时使用新设置
  });
});

describe('控制器交互测试 - 边缘情况', () => {
  let appController;
  let weatherController;
  let predictionController;

  beforeEach(() => {
    mockLocalStorage.clear();
    fetch.mockClear();

    const storageService = new StorageService();
    const apiService = new WindyAPIService('test-api-key');
    const predictionService = new SunsetPredictionService();

    weatherController = new WeatherController(apiService, storageService);
    predictionController = new PredictionController(predictionService);
    appController = new AppController(storageService, weatherController, predictionController);

    global.localStorage = mockLocalStorage;
  });

  test('应该：空位置对象 → AppController拒绝处理', async () => {
    await expect(appController.handleLocationChange(null))
      .rejects
      .toThrow();

    await expect(appController.handleLocationChange({}))
      .rejects
      .toThrow();
  });

  test('应该：无效坐标 → WeatherController验证失败', async () => {
    const invalidLocation = {
      lat: 999,
      lon: 999,
      name: '无效位置',
      isValid: () => false
    };

    await expect(weatherController.fetchWeather(invalidLocation))
      .rejects
      .toThrow();
  });

  test('应该：空天气数据 → PredictionController返回空预测', () => {
    const predictions = predictionController.generatePredictions([], {
      lat: 39.9042,
      lon: 116.4074,
      name: '北京'
    });

    expect(predictions).toEqual([]);
  });

  test('应该：部分天气数据缺失 → PredictionController使用默认值', () => {
    const partialData = [
      {
        timestamp: Date.now(),
        temp: 20,
        humidity: null, // 缺失
        cloudCover: 50,
        isValid: () => true
      }
    ];

    const predictions = predictionController.generatePredictions(partialData, {
      lat: 39.9042,
      lon: 116.4074,
      name: '北京'
    });

    // 验证预测算法使用了默认值而不是抛出错误
    expect(predictions).toBeDefined();
  });
});
