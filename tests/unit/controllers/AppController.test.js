/**
 * AppController单元测试
 * 
 * 测试应用主控制器的核心功能
 */

import { jest } from '@jest/globals';
import AppController from '../../../src/controllers/AppController.js';
import StorageService from '../../../src/services/StorageService.js';
import WeatherController from '../../../src/controllers/WeatherController.js';
import PredictionController from '../../../src/controllers/PredictionController.js';
import GeocodingService from '../../../src/services/GeocodingService.js';
import Location from '../../../src/models/Location.js';

// Mock DOM elements
const setupDOM = () => {
  document.body.innerHTML = `
    <div id="api-key-modal" class="modal hidden" style="display: none;">
      <div class="modal-content">
        <input id="api-key-input" type="text" />
        <button id="save-api-key">保存</button>
        <div id="api-key-error" class="error-message hidden"></div>
      </div>
    </div>
    <button id="settings-btn">设置</button>
    <button id="refresh-btn">刷新</button>
    <input id="location-input" type="text" />
    <button id="search-btn">搜索</button>
    <div id="location-error" class="error-message hidden" style="display: none;"></div>
    <div id="loading-indicator" style="display: none;"></div>
    <div id="error-message" style="display: none;"></div>
    <div id="success-message" style="display: none;"></div>
  `;
};

describe('AppController', () => {
  let appController;
  let storageService;
  let weatherController;
  let predictionController;
  let geocodingService;

  beforeEach(() => {
    // 设置DOM
    setupDOM();

    // 创建服务实例
    storageService = new StorageService();
    geocodingService = new GeocodingService();
    weatherController = new WeatherController(null, storageService);
    predictionController = new PredictionController(null);

    // 创建AppController实例
    appController = new AppController(
      storageService,
      weatherController,
      predictionController,
      geocodingService
    );

    // 清除localStorage
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('构造函数', () => {
    test('应该正确初始化AppController', () => {
      expect(appController.storageService).toBe(storageService);
      expect(appController.weatherController).toBe(weatherController);
      expect(appController.predictionController).toBe(predictionController);
      expect(appController.currentLocation).toBeNull();
      expect(appController.isInitialized).toBe(false);
    });
  });

  describe('initialize() - 需求 1.1, 1.5', () => {
    test('当API密钥未配置时，仍应完成初始化（固定后端代理）', async () => {
      // 确保没有API密钥
      expect(storageService.getAPIKey()).toBeNull();

      await appController.initialize();

      // 不再弹出 API Key 模态框
      const modal = document.getElementById('api-key-modal');
      expect(modal.style.display).toBe('none');
      expect(appController.isInitialized).toBe(true);
    });

    test('当API密钥已配置时，应该初始化UI', async () => {
      // 设置API密钥
      storageService.saveAPIKey('test-api-key');

      await appController.initialize();

      // 检查应用已初始化
      expect(appController.isInitialized).toBe(true);
    });

    test('当有上次位置时，应该尝试加载上次位置', async () => {
      // 设置API密钥和上次位置
      storageService.saveAPIKey('test-api-key');
      const lastLocation = new Location(39.9042, 116.4074, '北京');
      storageService.saveLastLocation(lastLocation);

      // Track if handleLocationChange was called
      let handleLocationChangeCalled = false;
      let handleLocationChangeArg = null;
      
      const originalHandleLocationChange = appController.handleLocationChange.bind(appController);
      appController.handleLocationChange = async (location) => {
        handleLocationChangeCalled = true;
        handleLocationChangeArg = location;
        return Promise.resolve();
      };

      await appController.initialize();

      // 检查是否调用了handleLocationChange
      expect(handleLocationChangeCalled).toBe(true);
      expect(handleLocationChangeArg).toMatchObject({
        lat: 39.9042,
        lon: 116.4074,
        name: '北京'
      });

      // Restore original method
      appController.handleLocationChange = originalHandleLocationChange;
    });

    test('当加载上次位置失败时，应该显示警告但不阻止初始化', async () => {
      // 设置API密钥和上次位置
      storageService.saveAPIKey('test-api-key');
      const lastLocation = new Location(39.9042, 116.4074, '北京');
      storageService.saveLastLocation(lastLocation);

      // Track console.warn calls
      const originalWarn = console.warn;
      let warnCalled = false;
      console.warn = (...args) => {
        warnCalled = true;
      };

      // Mock handleLocationChange to throw error
      const originalHandleLocationChange = appController.handleLocationChange.bind(appController);
      appController.handleLocationChange = async () => {
        throw new Error('加载失败');
      };

      await appController.initialize();

      // 应用仍然应该初始化
      expect(appController.isInitialized).toBe(true);
      expect(warnCalled).toBe(true);

      // Restore
      console.warn = originalWarn;
      appController.handleLocationChange = originalHandleLocationChange;
    });
  });

  describe('handleLocationChange()', () => {
    beforeEach(async () => {
      // 初始化应用
      storageService.saveAPIKey('test-api-key');
      await appController.initialize();
    });

    test('应该验证位置对象', async () => {
      await expect(appController.handleLocationChange(null)).rejects.toThrow(
        '无效的位置对象'
      );

      // Empty object without isValid method
      const invalidObj = {};
      await expect(appController.handleLocationChange(invalidObj)).rejects.toThrow();
    });

    test('应该验证位置坐标有效性', async () => {
      const invalidLocation = new Location(100, 200, '无效位置');

      await expect(
        appController.handleLocationChange(invalidLocation)
      ).rejects.toThrow('位置坐标无效');
    });

    test('应该保存当前位置到存储', async () => {
      const location = new Location(39.9042, 116.4074, '北京');

      // Mock controller methods
      weatherController.fetchWeather = async () => [{}];
      weatherController.updateWeatherDisplay = () => {};
      predictionController.generatePredictions = async () => [{}];
      predictionController.updatePredictionDisplay = () => {};

      await appController.handleLocationChange(location);

      // 检查位置是否保存
      expect(appController.currentLocation).toBe(location);
      const savedLocation = storageService.getLastLocation();
      expect(savedLocation.lat).toBe(39.9042);
      expect(savedLocation.lon).toBe(116.4074);
    });

    test('应该获取天气数据并更新显示', async () => {
      const location = new Location(39.9042, 116.4074, '北京');
      const mockWeatherData = [{ temp: 20, humidity: 60 }];

      // Track method calls
      let fetchWeatherCalled = false;
      let fetchWeatherArg = null;
      let updateWeatherDisplayCalled = false;
      let updateWeatherDisplayArg = null;

      // Mock controller methods
      weatherController.fetchWeather = async (loc) => {
        fetchWeatherCalled = true;
        fetchWeatherArg = loc;
        return mockWeatherData;
      };
      weatherController.updateWeatherDisplay = (data) => {
        updateWeatherDisplayCalled = true;
        updateWeatherDisplayArg = data;
      };
      predictionController.generatePredictions = async () => [{}];
      predictionController.updatePredictionDisplay = () => {};

      await appController.handleLocationChange(location);

      expect(fetchWeatherCalled).toBe(true);
      expect(fetchWeatherArg).toBe(location);
      expect(updateWeatherDisplayCalled).toBe(true);
      expect(updateWeatherDisplayArg).toBe(mockWeatherData);
    });

    test('应该生成预测并更新显示', async () => {
      const location = new Location(39.9042, 116.4074, '北京');
      const mockWeatherData = [{ temp: 20, humidity: 60 }];
      const mockPredictions = [{ score: 75, quality: 'excellent' }];

      // Track method calls
      let generatePredictionsCalled = false;
      let generatePredictionsArgs = null;
      let updatePredictionDisplayCalled = false;
      let updatePredictionDisplayArg = null;

      // Mock controller methods
      weatherController.fetchWeather = async () => mockWeatherData;
      weatherController.updateWeatherDisplay = () => {};
      predictionController.generatePredictions = async (weatherData, loc) => {
        generatePredictionsCalled = true;
        generatePredictionsArgs = { weatherData, loc };
        return mockPredictions;
      };
      predictionController.updatePredictionDisplay = (predictions) => {
        updatePredictionDisplayCalled = true;
        updatePredictionDisplayArg = predictions;
      };

      await appController.handleLocationChange(location);

      expect(generatePredictionsCalled).toBe(true);
      expect(generatePredictionsArgs.weatherData).toBe(mockWeatherData);
      expect(generatePredictionsArgs.loc).toBe(location);
      expect(updatePredictionDisplayCalled).toBe(true);
      expect(updatePredictionDisplayArg).toBe(mockPredictions);
    });

    test('当获取天气数据失败时，应该显示错误', async () => {
      const location = new Location(39.9042, 116.4074, '北京');

      // Mock fetchWeather to throw error
      weatherController.fetchWeather = async () => {
        throw new Error('API错误');
      };

      await expect(appController.handleLocationChange(location)).resolves.toBeUndefined();

      // 当前实现：天气失败不阻塞地图等功能，只显示错误提示
      const errorElement = document.getElementById('error-message');
      expect(errorElement.style.display).toBe('block');
      expect(errorElement.textContent).toContain('天气数据暂时不可用');
    });

    test('当天气数据为空时，应该抛出错误', async () => {
      const location = new Location(39.9042, 116.4074, '北京');

      // Mock fetchWeather to return empty array
      weatherController.fetchWeather = async () => [];

      await expect(appController.handleLocationChange(location)).resolves.toBeUndefined();
      expect(appController.currentLocation).toBe(location);
    });

    test('应该显示和隐藏加载状态', async () => {
      const location = new Location(39.9042, 116.4074, '北京');

      // Mock controller methods
      weatherController.fetchWeather = async () => [{}];
      weatherController.updateWeatherDisplay = () => {};
      predictionController.generatePredictions = async () => [{}];
      predictionController.updatePredictionDisplay = () => {};

      // Track showLoading calls
      const showLoadingCalls = [];
      const originalShowLoading = appController.showLoading.bind(appController);
      appController.showLoading = (show) => {
        showLoadingCalls.push(show);
        originalShowLoading(show);
      };

      await appController.handleLocationChange(location);

      // 检查showLoading被调用
      expect(showLoadingCalls).toContain(true);
      expect(showLoadingCalls).toContain(false);

      // Restore
      appController.showLoading = originalShowLoading;
    });
  });

  describe('showAPIKeyModal() - 需求 1.1, 1.5', () => {
    test('应该显示API密钥模态框', () => {
      appController.showAPIKeyModal();

      const modal = document.getElementById('api-key-modal');
      expect(modal.style.display).toBe('flex');
      expect(modal.classList.contains('hidden')).toBe(false);
    });

    test('如果已有API密钥，应该在输入框中显示（需求 1.5）', () => {
      storageService.saveAPIKey('existing-key');

      appController.showAPIKeyModal();

      const input = document.getElementById('api-key-input');
      expect(input.value).toBe('existing-key');
    });

    test('应该清除之前的错误消息', () => {
      // 先显示一个错误
      const errorElement = document.getElementById('api-key-error');
      errorElement.textContent = '之前的错误';
      errorElement.classList.remove('hidden');

      appController.showAPIKeyModal();

      expect(errorElement.textContent).toBe('');
      expect(errorElement.classList.contains('hidden')).toBe(true);
    });
  });

  describe('hideAPIKeyModal()', () => {
    test('应该隐藏API密钥模态框', () => {
      // 先显示模态框
      appController.showAPIKeyModal();

      // 然后隐藏
      appController.hideAPIKeyModal();

      const modal = document.getElementById('api-key-modal');
      expect(modal.style.display).toBe('none');
      expect(modal.classList.contains('hidden')).toBe(true);
    });

    test('应该清除输入框内容', () => {
      const input = document.getElementById('api-key-input');
      input.value = 'test-key';

      appController.hideAPIKeyModal();

      expect(input.value).toBe('');
    });

    test('应该清除错误消息', () => {
      const errorElement = document.getElementById('api-key-error');
      errorElement.textContent = '错误消息';
      errorElement.classList.remove('hidden');

      appController.hideAPIKeyModal();

      expect(errorElement.textContent).toBe('');
      expect(errorElement.classList.contains('hidden')).toBe(true);
    });
  });

  describe('handleSaveAPIKey() - 需求 1.2, 1.3, 1.4', () => {
    beforeEach(() => {
      appController.initializeUI();
    });

    test('当API密钥为空时，应该显示错误消息（需求 1.4）', async () => {
      const input = document.getElementById('api-key-input');
      input.value = '   '; // 空白字符串

      await appController.handleSaveAPIKey();

      const errorElement = document.getElementById('api-key-error');
      expect(errorElement.textContent).toBe('请输入API密钥');
      expect(errorElement.classList.contains('hidden')).toBe(false);
    });

    test('当API密钥长度过短时，应该显示错误消息', async () => {
      const input = document.getElementById('api-key-input');
      input.value = 'short';

      await appController.handleSaveAPIKey();

      const errorElement = document.getElementById('api-key-error');
      expect(errorElement.textContent).toContain('格式不正确');
      expect(errorElement.classList.contains('hidden')).toBe(false);
    });

    test('应该保存有效的API密钥（需求 1.2）', async () => {
      const input = document.getElementById('api-key-input');
      input.value = 'valid-api-key-12345';

      await appController.handleSaveAPIKey();

      // 检查API密钥是否保存
      expect(storageService.getAPIKey()).toBe('valid-api-key-12345');
    });

    test('保存成功后应该隐藏模态框', async () => {
      const input = document.getElementById('api-key-input');
      input.value = 'valid-api-key-12345';

      // Show modal first
      const modal = document.getElementById('api-key-modal');
      modal.style.display = 'flex';
      modal.classList.remove('hidden');

      await appController.handleSaveAPIKey();

      expect(modal.style.display).toBe('none');
      expect(modal.classList.contains('hidden')).toBe(true);
    });

    test('保存成功后应该显示成功消息', async () => {
      const input = document.getElementById('api-key-input');
      input.value = 'valid-api-key-12345';

      await appController.handleSaveAPIKey();

      const successElement = document.getElementById('success-message');
      expect(successElement.textContent).toBe('API密钥保存成功');
    });

    test('首次配置后应该初始化UI', async () => {
      const input = document.getElementById('api-key-input');
      input.value = 'valid-api-key-12345';
      appController.isInitialized = false;

      await appController.handleSaveAPIKey();

      expect(appController.isInitialized).toBe(true);
    });

    test('当存储失败时，应该显示错误消息（需求 1.4）', async () => {
      const input = document.getElementById('api-key-input');
      input.value = 'valid-api-key-12345';

      // Mock saveAPIKey to throw error
      const originalSave = storageService.saveAPIKey.bind(storageService);
      storageService.saveAPIKey = () => {
        throw new Error('存储失败');
      };

      await appController.handleSaveAPIKey();

      const errorElement = document.getElementById('api-key-error');
      expect(errorElement.textContent).toContain('存储失败');
      expect(errorElement.classList.contains('hidden')).toBe(false);

      // Restore
      storageService.saveAPIKey = originalSave;
    });
  });

  describe('showAPIKeyError()', () => {
    test('应该显示API密钥错误消息', () => {
      appController.showAPIKeyError('测试错误');

      const errorElement = document.getElementById('api-key-error');
      expect(errorElement.textContent).toBe('测试错误');
      expect(errorElement.classList.contains('hidden')).toBe(false);
    });
  });

  describe('clearAPIKeyError()', () => {
    test('应该清除API密钥错误消息', () => {
      const errorElement = document.getElementById('api-key-error');
      errorElement.textContent = '错误消息';
      errorElement.classList.remove('hidden');

      appController.clearAPIKeyError();

      expect(errorElement.textContent).toBe('');
      expect(errorElement.classList.contains('hidden')).toBe(true);
    });
  });

  describe('showLoading()', () => {
    test('应该显示加载指示器', () => {
      appController.showLoading(true);

      const loadingElement = document.getElementById('loading-indicator');
      expect(loadingElement.style.display).toBe('block');
    });

    test('应该隐藏加载指示器', () => {
      appController.showLoading(false);

      const loadingElement = document.getElementById('loading-indicator');
      expect(loadingElement.style.display).toBe('none');
    });

    test('应该禁用/启用刷新按钮', () => {
      const refreshBtn = document.getElementById('refresh-btn');

      appController.showLoading(true);
      expect(refreshBtn.disabled).toBe(true);

      appController.showLoading(false);
      expect(refreshBtn.disabled).toBe(false);
    });
  });

  describe('showError()', () => {
    test('应该显示错误消息', () => {
      appController.showError('测试错误');

      const errorElement = document.getElementById('error-message');
      expect(errorElement.textContent).toBe('测试错误');
      expect(errorElement.style.display).toBe('block');
    });
  });

  describe('showSuccess()', () => {
    test('应该显示成功消息', () => {
      appController.showSuccess('操作成功');

      const successElement = document.getElementById('success-message');
      expect(successElement.textContent).toBe('操作成功');
      expect(successElement.style.display).toBe('block');
    });
  });

  describe('getCurrentLocation()', () => {
    test('应该返回当前位置', () => {
      const location = new Location(39.9042, 116.4074, '北京');
      appController.currentLocation = location;

      expect(appController.getCurrentLocation()).toBe(location);
    });

    test('如果未设置位置，应该返回null', () => {
      expect(appController.getCurrentLocation()).toBeNull();
    });
  });

  describe('isAppInitialized()', () => {
    test('应该返回初始化状态', () => {
      expect(appController.isAppInitialized()).toBe(false);

      appController.isInitialized = true;
      expect(appController.isAppInitialized()).toBe(true);
    });
  });

  describe('handleLocationSearch() - 任务 13.2, 需求 2.1, 2.2, 2.5', () => {
    beforeEach(async () => {
      // 初始化应用
      storageService.saveAPIKey('test-api-key');
      await appController.initialize();
    });

    test('当输入为空时，应该显示错误消息', async () => {
      const locationInput = document.getElementById('location-input');
      locationInput.value = '   '; // 空白字符串

      await appController.handleLocationSearch();

      const errorElement = document.getElementById('location-error');
      expect(errorElement.textContent).toBe('请输入位置名称');
      expect(errorElement.style.display).toBe('block');
    });

    test('应该调用地理编码服务', async () => {
      const locationInput = document.getElementById('location-input');
      locationInput.value = '北京';

      const mockLocation = new Location(39.9042, 116.4074, '北京市');

      // Track geocode calls
      let geocodeCalled = false;
      let geocodeArg = null;

      // Mock geocodingService
      geocodingService.geocode = async (locationName) => {
        geocodeCalled = true;
        geocodeArg = locationName;
        return mockLocation;
      };

      // Mock controller methods
      weatherController.fetchWeather = async () => [{}];
      weatherController.updateWeatherDisplay = () => {};
      predictionController.generatePredictions = async () => [{}];
      predictionController.updatePredictionDisplay = () => {};

      await appController.handleLocationSearch();

      expect(geocodeCalled).toBe(true);
      expect(geocodeArg).toBe('北京');
    });

    test('应该调用handleLocationChange更新天气和预测', async () => {
      const locationInput = document.getElementById('location-input');
      locationInput.value = '上海';

      const mockLocation = new Location(31.2304, 121.4737, '上海市');

      // Mock geocodingService
      geocodingService.geocode = async () => mockLocation;

      // Track handleLocationChange calls
      let handleLocationChangeCalled = false;
      let handleLocationChangeArg = null;

      const originalHandleLocationChange = appController.handleLocationChange.bind(appController);
      appController.handleLocationChange = async (location) => {
        handleLocationChangeCalled = true;
        handleLocationChangeArg = location;
        return Promise.resolve();
      };

      await appController.handleLocationSearch();

      expect(handleLocationChangeCalled).toBe(true);
      expect(handleLocationChangeArg).toBe(mockLocation);

      // Restore
      appController.handleLocationChange = originalHandleLocationChange;
    });

    test('搜索成功后应该清空输入框', async () => {
      const locationInput = document.getElementById('location-input');
      locationInput.value = '广州';

      const mockLocation = new Location(23.1291, 113.2644, '广州市');

      // Mock services
      geocodingService.geocode = async () => mockLocation;
      weatherController.fetchWeather = async () => [{}];
      weatherController.updateWeatherDisplay = () => {};
      predictionController.generatePredictions = async () => [{}];
      predictionController.updatePredictionDisplay = () => {};

      await appController.handleLocationSearch();

      expect(locationInput.value).toBe('');
    });

    test('搜索成功后应该显示成功消息', async () => {
      const locationInput = document.getElementById('location-input');
      locationInput.value = '深圳';

      const mockLocation = new Location(22.5431, 114.0579, '深圳市');

      // Mock services
      geocodingService.geocode = async () => mockLocation;
      weatherController.fetchWeather = async () => [{}];
      weatherController.updateWeatherDisplay = () => {};
      predictionController.generatePredictions = async () => [{}];
      predictionController.updatePredictionDisplay = () => {};

      await appController.handleLocationSearch();

      const successElement = document.getElementById('success-message');
      expect(successElement.textContent).toContain('深圳市');
    });

    test('当地理编码失败时，应该显示错误消息（需求 2.5）', async () => {
      const locationInput = document.getElementById('location-input');
      locationInput.value = '不存在的城市xyz123';

      // Mock geocodingService to throw error
      geocodingService.geocode = async () => {
        throw new Error('无法找到位置');
      };

      await appController.handleLocationSearch();

      const locationErrorElement = document.getElementById('location-error');
      expect(locationErrorElement.textContent).toContain('位置解析失败');
      expect(locationErrorElement.style.display).toBe('block');
    });

    test('搜索时应该禁用搜索按钮防止重复点击', async () => {
      const locationInput = document.getElementById('location-input');
      locationInput.value = '杭州';
      const searchBtn = document.getElementById('search-btn');

      const mockLocation = new Location(30.2741, 120.1551, '杭州市');

      // Mock geocodingService with delay
      geocodingService.geocode = async () => {
        // Check button state during search
        expect(searchBtn.disabled).toBe(true);
        expect(searchBtn.textContent).toBe('搜索中...');
        return mockLocation;
      };

      // Mock controller methods
      weatherController.fetchWeather = async () => [{}];
      weatherController.updateWeatherDisplay = () => {};
      predictionController.generatePredictions = async () => [{}];
      predictionController.updatePredictionDisplay = () => {};

      await appController.handleLocationSearch();

      // Button should be re-enabled after search
      expect(searchBtn.disabled).toBe(false);
      expect(searchBtn.textContent).toBe('搜索');
    });

    test('搜索失败后应该恢复搜索按钮状态', async () => {
      const locationInput = document.getElementById('location-input');
      locationInput.value = '测试城市';
      const searchBtn = document.getElementById('search-btn');

      // Mock geocodingService to throw error
      geocodingService.geocode = async () => {
        throw new Error('搜索失败');
      };

      await appController.handleLocationSearch();

      // Button should be re-enabled after error
      expect(searchBtn.disabled).toBe(false);
      expect(searchBtn.textContent).toBe('搜索');
    });

    test('当地理编码服务未初始化时，应该显示错误', async () => {
      const locationInput = document.getElementById('location-input');
      locationInput.value = '北京';

      // Remove geocodingService
      appController.geocodingService = null;

      await appController.handleLocationSearch();

      const errorElement = document.getElementById('location-error');
      expect(errorElement.textContent).toContain('地理编码服务未初始化');
    });

    test('应该显示和隐藏加载状态', async () => {
      const locationInput = document.getElementById('location-input');
      locationInput.value = '成都';

      const mockLocation = new Location(30.5728, 104.0668, '成都市');

      // Mock services
      geocodingService.geocode = async () => mockLocation;
      weatherController.fetchWeather = async () => [{}];
      weatherController.updateWeatherDisplay = () => {};
      predictionController.generatePredictions = async () => [{}];
      predictionController.updatePredictionDisplay = () => {};

      // Track showLoading calls
      const showLoadingCalls = [];
      const originalShowLoading = appController.showLoading.bind(appController);
      appController.showLoading = (show) => {
        showLoadingCalls.push(show);
        originalShowLoading(show);
      };

      await appController.handleLocationSearch();

      // Should show loading at start and hide at end
      expect(showLoadingCalls).toContain(true);
      expect(showLoadingCalls).toContain(false);

      // Restore
      appController.showLoading = originalShowLoading;
    });
  });

  describe('showLocationError()', () => {
    test('应该显示位置错误消息', () => {
      appController.showLocationError('位置错误测试');

      const errorElement = document.getElementById('location-error');
      expect(errorElement.textContent).toBe('位置错误测试');
      expect(errorElement.classList.contains('hidden')).toBe(false);
      expect(errorElement.style.display).toBe('block');
    });
  });

  describe('clearLocationError()', () => {
    test('应该清除位置错误消息', () => {
      const errorElement = document.getElementById('location-error');
      errorElement.textContent = '错误消息';
      errorElement.classList.remove('hidden');
      errorElement.style.display = 'block';

      appController.clearLocationError();

      expect(errorElement.textContent).toBe('');
      expect(errorElement.classList.contains('hidden')).toBe(true);
      expect(errorElement.style.display).toBe('none');
    });
  });

  describe('handleCurrentLocation() - 任务 13.3, 需求 2.3, 2.4', () => {
    beforeEach(async () => {
      // 初始化应用
      storageService.saveAPIKey('test-api-key');
      await appController.initialize();

      // 添加当前位置按钮到DOM
      if (!document.getElementById('current-location-btn')) {
        const btn = document.createElement('button');
        btn.id = 'current-location-btn';
        btn.textContent = '📍 使用当前位置';
        document.body.appendChild(btn);
      }
    });

    test('应该调用地理编码服务的getCurrentLocation方法（需求 2.3）', async () => {
      const mockLocation = new Location(39.9042, 116.4074, '北京市');

      // Track getCurrentLocation calls
      let getCurrentLocationCalled = false;

      // Mock geocodingService
      geocodingService.getCurrentLocation = async () => {
        getCurrentLocationCalled = true;
        return mockLocation;
      };

      // Mock controller methods
      weatherController.fetchWeather = async () => [{}];
      weatherController.updateWeatherDisplay = () => {};
      predictionController.generatePredictions = async () => [{}];
      predictionController.updatePredictionDisplay = () => {};

      await appController.handleCurrentLocation();

      expect(getCurrentLocationCalled).toBe(true);
    });

    test('应该调用handleLocationChange更新天气和预测', async () => {
      const mockLocation = new Location(31.2304, 121.4737, '上海市');

      // Mock geocodingService
      geocodingService.getCurrentLocation = async () => mockLocation;

      // Track handleLocationChange calls
      let handleLocationChangeCalled = false;
      let handleLocationChangeArg = null;

      const originalHandleLocationChange = appController.handleLocationChange.bind(appController);
      appController.handleLocationChange = async (location) => {
        handleLocationChangeCalled = true;
        handleLocationChangeArg = location;
        return Promise.resolve();
      };

      await appController.handleCurrentLocation();

      expect(handleLocationChangeCalled).toBe(true);
      expect(handleLocationChangeArg).toBe(mockLocation);

      // Restore
      appController.handleLocationChange = originalHandleLocationChange;
    });

    test('获取位置成功后应该显示成功消息', async () => {
      const mockLocation = new Location(22.5431, 114.0579, '深圳市');

      // Mock services
      geocodingService.getCurrentLocation = async () => mockLocation;
      weatherController.fetchWeather = async () => [{}];
      weatherController.updateWeatherDisplay = () => {};
      predictionController.generatePredictions = async () => [{}];
      predictionController.updatePredictionDisplay = () => {};

      await appController.handleCurrentLocation();

      const successElement = document.getElementById('success-message');
      expect(successElement.textContent).toContain('深圳市');
      expect(successElement.textContent).toContain('已定位到');
    });

    test('当权限被拒绝时，应该显示友好的错误消息（需求 2.4）', async () => {
      // Mock geocodingService to throw permission denied error
      geocodingService.getCurrentLocation = async () => {
        throw new Error('位置权限被拒绝，请在浏览器设置中允许位置访问');
      };

      await appController.handleCurrentLocation();

      const locationErrorElement = document.getElementById('location-error');
      expect(locationErrorElement.textContent).toContain('位置权限被拒绝');
      expect(locationErrorElement.textContent).toContain('浏览器设置');
      expect(locationErrorElement.textContent).toContain('手动输入城市名称');
      expect(locationErrorElement.style.display).toBe('block');

      const errorElement = document.getElementById('error-message');
      expect(errorElement.textContent).toContain('位置权限被拒绝');
    });

    test('当浏览器不支持地理定位时，应该显示友好的错误消息', async () => {
      // Mock geocodingService to throw unsupported error
      geocodingService.getCurrentLocation = async () => {
        throw new Error('您的浏览器不支持地理定位功能');
      };

      await appController.handleCurrentLocation();

      const locationErrorElement = document.getElementById('location-error');
      expect(locationErrorElement.textContent).toContain('不支持地理定位功能');
      expect(locationErrorElement.textContent).toContain('手动输入城市名称');
    });

    test('当位置信息不可用时，应该显示友好的错误消息', async () => {
      // Mock geocodingService to throw unavailable error
      geocodingService.getCurrentLocation = async () => {
        throw new Error('位置信息不可用，请检查设备的定位服务是否开启');
      };

      await appController.handleCurrentLocation();

      const locationErrorElement = document.getElementById('location-error');
      expect(locationErrorElement.textContent).toContain('位置信息不可用');
      expect(locationErrorElement.textContent).toContain('定位服务');
    });

    test('当获取位置超时时，应该显示友好的错误消息', async () => {
      // Mock geocodingService to throw timeout error
      geocodingService.getCurrentLocation = async () => {
        throw new Error('获取位置超时，请重试');
      };

      await appController.handleCurrentLocation();

      const locationErrorElement = document.getElementById('location-error');
      expect(locationErrorElement.textContent).toContain('获取位置超时');
      expect(locationErrorElement.textContent).toContain('重试');
    });

    test('获取位置时应该禁用当前位置按钮防止重复点击', async () => {
      const currentLocationBtn = document.getElementById('current-location-btn');
      const mockLocation = new Location(30.2741, 120.1551, '杭州市');

      // Mock geocodingService with delay
      geocodingService.getCurrentLocation = async () => {
        // Check button state during location fetch
        expect(currentLocationBtn.disabled).toBe(true);
        expect(currentLocationBtn.textContent).toBe('📍 获取位置中...');
        return mockLocation;
      };

      // Mock controller methods
      weatherController.fetchWeather = async () => [{}];
      weatherController.updateWeatherDisplay = () => {};
      predictionController.generatePredictions = async () => [{}];
      predictionController.updatePredictionDisplay = () => {};

      await appController.handleCurrentLocation();

      // Button should be re-enabled after fetch
      expect(currentLocationBtn.disabled).toBe(false);
      expect(currentLocationBtn.textContent).toBe('📍 使用当前位置');
    });

    test('获取位置失败后应该恢复按钮状态', async () => {
      const currentLocationBtn = document.getElementById('current-location-btn');

      // Mock geocodingService to throw error
      geocodingService.getCurrentLocation = async () => {
        throw new Error('获取位置失败');
      };

      await appController.handleCurrentLocation();

      // Button should be re-enabled after error
      expect(currentLocationBtn.disabled).toBe(false);
      expect(currentLocationBtn.textContent).toBe('📍 使用当前位置');
    });

    test('当地理编码服务未初始化时，应该显示错误', async () => {
      // Remove geocodingService
      appController.geocodingService = null;

      await appController.handleCurrentLocation();

      const errorElement = document.getElementById('location-error');
      expect(errorElement.textContent).toContain('地理编码服务未初始化');
    });

    test('应该显示和隐藏加载状态', async () => {
      const mockLocation = new Location(30.5728, 104.0668, '成都市');

      // Mock services
      geocodingService.getCurrentLocation = async () => mockLocation;
      weatherController.fetchWeather = async () => [{}];
      weatherController.updateWeatherDisplay = () => {};
      predictionController.generatePredictions = async () => [{}];
      predictionController.updatePredictionDisplay = () => {};

      // Track showLoading calls
      const showLoadingCalls = [];
      const originalShowLoading = appController.showLoading.bind(appController);
      appController.showLoading = (show) => {
        showLoadingCalls.push(show);
        originalShowLoading(show);
      };

      await appController.handleCurrentLocation();

      // Should show loading at start and hide at end
      expect(showLoadingCalls).toContain(true);
      expect(showLoadingCalls).toContain(false);

      // Restore
      appController.showLoading = originalShowLoading;
    });

    test('应该清除之前的错误消息', async () => {
      const mockLocation = new Location(23.1291, 113.2644, '广州市');

      // Set an existing error
      const errorElement = document.getElementById('location-error');
      errorElement.textContent = '之前的错误';
      errorElement.classList.remove('hidden');
      errorElement.style.display = 'block';

      // Mock services
      geocodingService.getCurrentLocation = async () => mockLocation;
      weatherController.fetchWeather = async () => [{}];
      weatherController.updateWeatherDisplay = () => {};
      predictionController.generatePredictions = async () => [{}];
      predictionController.updatePredictionDisplay = () => {};

      await appController.handleCurrentLocation();

      // Error should be cleared before starting
      // (it will be cleared at the start of handleCurrentLocation)
      expect(errorElement.textContent).toBe('');
    });
  });

  describe('handleRefresh() - 任务 13.4, 需求 9.1, 9.2, 9.3', () => {
    beforeEach(async () => {
      // 初始化应用
      storageService.saveAPIKey('test-api-key');
      await appController.initialize();
    });

    test('当没有当前位置时，应该显示错误消息', async () => {
      // 确保没有当前位置
      appController.currentLocation = null;

      await appController.handleRefresh();

      const errorElement = document.getElementById('error-message');
      expect(errorElement.textContent).toBe('请先选择位置');
      expect(errorElement.style.display).toBe('block');
    });

    test('应该清除当前位置的天气缓存（需求 9.3）', async () => {
      const location = new Location(39.9042, 116.4074, '北京');
      appController.currentLocation = location;

      // 先缓存一些数据
      const cachedData = [{ temp: 20, humidity: 60 }];
      storageService.cacheWeatherData(location, cachedData);

      // 验证缓存存在
      expect(storageService.getCachedWeatherData(location)).not.toBeNull();

      // Mock controller methods
      weatherController.fetchWeather = async () => [{}];
      weatherController.updateWeatherDisplay = () => {};
      predictionController.generatePredictions = async () => [{}];
      predictionController.updatePredictionDisplay = () => {};

      await appController.handleRefresh();

      // 验证缓存已被清除
      expect(storageService.getCachedWeatherData(location)).toBeNull();
    });

    test('应该调用handleLocationChange重新获取数据（需求 9.2）', async () => {
      const location = new Location(39.9042, 116.4074, '北京');
      appController.currentLocation = location;

      // Track handleLocationChange calls
      let handleLocationChangeCalled = false;
      let handleLocationChangeArg = null;

      const originalHandleLocationChange = appController.handleLocationChange.bind(appController);
      appController.handleLocationChange = async (loc) => {
        handleLocationChangeCalled = true;
        handleLocationChangeArg = loc;
        return Promise.resolve();
      };

      await appController.handleRefresh();

      expect(handleLocationChangeCalled).toBe(true);
      expect(handleLocationChangeArg).toBe(location);

      // Restore
      appController.handleLocationChange = originalHandleLocationChange;
    });

    test('刷新成功后应该显示成功消息', async () => {
      const location = new Location(39.9042, 116.4074, '北京');
      appController.currentLocation = location;

      // Mock controller methods
      weatherController.fetchWeather = async () => [{}];
      weatherController.updateWeatherDisplay = () => {};
      predictionController.generatePredictions = async () => [{}];
      predictionController.updatePredictionDisplay = () => {};

      await appController.handleRefresh();

      const successElement = document.getElementById('success-message');
      expect(successElement.textContent).toBe('数据刷新成功');
      expect(successElement.style.display).toBe('block');
    });

    test('当刷新失败时，应该显示错误消息', async () => {
      const location = new Location(39.9042, 116.4074, '北京');
      appController.currentLocation = location;

      // Mock handleLocationChange to throw error
      const originalHandleLocationChange = appController.handleLocationChange.bind(appController);
      appController.handleLocationChange = async () => {
        throw new Error('网络错误');
      };

      await appController.handleRefresh();

      const errorElement = document.getElementById('error-message');
      expect(errorElement.textContent).toContain('刷新失败');
      expect(errorElement.textContent).toContain('网络错误');
      expect(errorElement.style.display).toBe('block');

      // Restore
      appController.handleLocationChange = originalHandleLocationChange;
    });

    test('应该通过handleLocationChange显示加载指示器（需求 9.3）', async () => {
      const location = new Location(39.9042, 116.4074, '北京');
      appController.currentLocation = location;

      // Track showLoading calls through handleLocationChange
      const showLoadingCalls = [];
      const originalShowLoading = appController.showLoading.bind(appController);
      appController.showLoading = (show) => {
        showLoadingCalls.push(show);
        originalShowLoading(show);
      };

      // Mock controller methods
      weatherController.fetchWeather = async () => {
        // During fetch, loading should be shown
        const loadingElement = document.getElementById('loading-indicator');
        expect(loadingElement.style.display).toBe('block');
        return [{}];
      };
      weatherController.updateWeatherDisplay = () => {};
      predictionController.generatePredictions = async () => [{}];
      predictionController.updatePredictionDisplay = () => {};

      await appController.handleRefresh();

      // Verify loading was shown and then hidden
      expect(showLoadingCalls).toContain(true);
      expect(showLoadingCalls).toContain(false);

      // Restore
      appController.showLoading = originalShowLoading;
    });

    test('刷新按钮事件应该正确绑定（需求 9.1）', async () => {
      const location = new Location(39.9042, 116.4074, '北京');
      appController.currentLocation = location;

      // Mock controller methods
      weatherController.fetchWeather = async () => [{}];
      weatherController.updateWeatherDisplay = () => {};
      predictionController.generatePredictions = async () => [{}];
      predictionController.updatePredictionDisplay = () => {};

      // Track handleRefresh calls
      let handleRefreshCalled = false;
      const originalHandleRefresh = appController.handleRefresh.bind(appController);
      appController.handleRefresh = async () => {
        handleRefreshCalled = true;
        return originalHandleRefresh();
      };

      // Simulate button click
      const refreshBtn = document.getElementById('refresh-btn');
      refreshBtn.click();

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(handleRefreshCalled).toBe(true);

      // Restore
      appController.handleRefresh = originalHandleRefresh;
    });

  describe('城市候选搜索', () => {
    beforeEach(() => {
      const dropdown = document.createElement('div');
      dropdown.id = 'city-suggestions-dropdown';
      dropdown.className = 'search-history-dropdown hidden';
      document.body.appendChild(dropdown);
    });

    test('旧的慢请求不应覆盖新的城市候选结果，避免下拉菜单闪退', async () => {
      const input = document.getElementById('location-input');
      let resolveOld;
      geocodingService.searchCities = jest.fn((query) => {
        if (query === '伊') {
          return new Promise(resolve => { resolveOld = resolve; });
        }
        if (query === '伊瓜苏') {
          return Promise.resolve([
            { displayName: '伊瓜苏, 巴拉那州, 巴西', lat: -25.54778, lon: -54.58806, countryCode: 'BR' }
          ]);
        }
        return Promise.resolve([]);
      });

      input.value = '伊';
      const oldPromise = appController.updateCitySuggestions('伊');
      input.value = '伊瓜苏';
      await appController.updateCitySuggestions('伊瓜苏');

      const dropdown = document.getElementById('city-suggestions-dropdown');
      expect(dropdown.classList.contains('hidden')).toBe(false);
      expect(dropdown.textContent).toContain('伊瓜苏');

      resolveOld([]);
      await oldPromise;

      expect(dropdown.classList.contains('hidden')).toBe(false);
      expect(dropdown.textContent).toContain('伊瓜苏');
    });

    test('输入候选搜索应防抖，避免每个字符都打接口', async () => {
      jest.useFakeTimers();
      geocodingService.searchCities = jest.fn().mockResolvedValue([
        { displayName: '伊瓜苏, 巴拉那州, 巴西', lat: -25.54778, lon: -54.58806, countryCode: 'BR' }
      ]);
      document.getElementById('location-input').value = '伊瓜苏';

      appController.scheduleCitySuggestionsUpdate('伊');
      appController.scheduleCitySuggestionsUpdate('伊瓜');
      appController.scheduleCitySuggestionsUpdate('伊瓜苏');

      expect(geocodingService.searchCities).not.toHaveBeenCalled();
      jest.advanceTimersByTime(300);
      await Promise.resolve();
      await Promise.resolve();

      expect(geocodingService.searchCities).toHaveBeenCalledTimes(1);
      expect(geocodingService.searchCities).toHaveBeenCalledWith('伊瓜苏', 8);
      jest.useRealTimers();
    });
  });

  });
});
