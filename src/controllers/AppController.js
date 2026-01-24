/**
 * AppController - 应用主控制器
 * 
 * 协调各子控制器，管理应用的整体流程
 * 负责初始化应用、处理位置变更等核心功能
 * 
 * 需求：1.1 - API密钥管理（首次访问显示配置界面）
 * 需求：1.5 - API密钥管理（已配置时允许查看和修改）
 */

import ErrorHandler from '../utils/ErrorHandler.js';

class AppController {
  /**
   * 创建AppController实例
   * @param {StorageService} storageService - 存储服务实例
   * @param {WeatherController} weatherController - 天气控制器实例
   * @param {PredictionController} predictionController - 预测控制器实例
   * @param {GeocodingService} geocodingService - 地理编码服务实例（任务 13.2）
   */
  constructor(storageService, weatherController, predictionController, geocodingService = null) {
    this.storageService = storageService;
    this.weatherController = weatherController;
    this.predictionController = predictionController;
    this.geocodingService = geocodingService;
    this.currentLocation = null;
    this.isInitialized = false;
  }

  /**
   * 初始化应用
   * 
   * 检查API密钥是否已配置：
   * - 如果未配置，显示API密钥配置界面
   * - 如果已配置，初始化UI并加载上次使用的位置（如果有）
   * 
   * @returns {Promise<void>}
   * 
   * 需求：1.1 - 首次访问时显示API密钥配置界面
   * 需求：1.5 - API密钥已配置时允许查看和修改
   * 需求：12.6, 12.7, 12.8 - 在初始化时请求通知权限
   */
  async initialize() {
    try {
      // 检查API密钥是否已配置
      const apiKey = this.storageService.getAPIKey();

      if (!apiKey) {
        // 需求 1.1：首次访问时显示API密钥配置界面
        this.showAPIKeyModal();
        this.isInitialized = false;
        return;
      }

      // API密钥已配置，初始化UI
      this.initializeUI();

      // 需求12：加载收藏位置列表
      this.loadFavoriteLocations();

      // 需求12：请求通知权限（如果用户启用了通知）
      await this.requestNotificationPermissionIfEnabled();

      // 尝试加载上次使用的位置（仅当天气控制器可用时）
      if (this.weatherController && this.predictionController) {
        const lastLocation = this.storageService.getLastLocation();
        if (lastLocation) {
          try {
            await this.handleLocationChange(lastLocation);
          } catch (error) {
            // 加载上次位置失败不应阻止应用启动
            console.warn('加载上次位置失败:', error.message);
            this.showError('加载上次位置失败，请重新选择位置');
          }
        }
      } else {
        console.log('天气服务尚未实现，跳过自动加载位置');
      }

      this.isInitialized = true;

    } catch (error) {
      console.error('应用初始化失败:', error);
      
      // 使用ErrorHandler处理错误
      const errorInfo = ErrorHandler.handleError(error, 'App Initialization');
      this.showError(errorInfo.message);
      
      throw error;
    }
  }

  /**
   * 处理位置变更
   * 
   * 当用户选择新位置时：
   * 1. 保存新位置到本地存储
   * 2. 获取该位置的天气数据
   * 3. 生成晚霞预测
   * 4. 更新UI显示
   * 
   * @param {Location} location - 新的位置对象
   * @returns {Promise<void>}
   * @throws {Error} 如果位置无效或数据获取失败
   */
  async handleLocationChange(location) {
    // 验证位置对象
    if (!location || typeof location !== 'object') {
      throw new Error('无效的位置对象');
    }

    if (!location.isValid || !location.isValid()) {
      throw new Error('位置坐标无效');
    }

    try {
      // 显示加载状态
      this.showLoading(true);

      // 保存当前位置
      this.currentLocation = location;
      this.storageService.saveLastLocation(location);

      // 如果天气控制器和预测控制器未初始化，只保存位置
      if (!this.weatherController || !this.predictionController) {
        console.warn('天气控制器或预测控制器未初始化，仅保存位置信息');
        this.showLoading(false);
        this.showSuccess(`位置已保存：${location.name || '未知位置'}`);
        return;
      }

      // 获取天气数据
      const weatherData = await this.weatherController.fetchWeather(location);

      if (!weatherData || weatherData.length === 0) {
        throw new Error('未能获取天气数据');
      }

      // 更新天气显示
      this.weatherController.updateWeatherDisplay(weatherData);

      // 生成晚霞预测
      let predictions;
      try {
        console.log('[AppController] 开始生成晚霞预测...');
        console.log('[AppController] 天气数据:', weatherData);
        console.log('[AppController] 位置:', location);
        console.log('[AppController] PredictionController:', this.predictionController);
        
        predictions = await this.predictionController.generatePredictions(
          weatherData,
          location
        );
        console.log('[AppController] 预测生成完成:', predictions);
      } catch (predictionError) {
        console.error('[AppController] 生成预测时出错:', predictionError);
        console.error('[AppController] 错误堆栈:', predictionError.stack);
        // 不抛出错误，允许应用继续运行
        this.showError(`晚霞预测功能暂时不可用: ${predictionError.message}`);
        predictions = [];
      }

      if (predictions && predictions.length > 0) {
        // 更新预测显示
        this.predictionController.updatePredictionDisplay(predictions);
      } else {
        console.warn('[AppController] 没有生成预测数据，跳过预测显示');
      }

      // 隐藏加载状态
      this.showLoading(false);

    } catch (error) {
      // 隐藏加载状态
      this.showLoading(false);

      // 使用ErrorHandler处理错误
      const errorInfo = ErrorHandler.handleError(error, 'Location Change');
      this.showError(errorInfo.message);

      // 重新抛出错误供调用者处理
      throw error;
    }
  }

  /**
   * 显示API密钥配置模态框
   * 
   * 需求：1.1 - 首次访问时显示配置界面
   * 需求：1.5 - 允许查看和修改已配置的密钥
   * 
   * @private
   */
  showAPIKeyModal() {
    const modal = document.getElementById('api-key-modal');
    if (!modal) {
      console.error('API密钥模态框元素未找到');
      return;
    }

    // 确保事件监听器已绑定（首次访问时 initializeUI 还未调用）
    this.bindAPIKeyModalEvents();

    // 显示模态框
    modal.classList.remove('hidden');
    modal.style.display = 'flex';

    // 如果已有API密钥，显示在输入框中（需求 1.5）
    const existingKey = this.storageService.getAPIKey();
    const input = document.getElementById('api-key-input');
    if (input) {
      input.value = existingKey || '';
      // 聚焦到输入框
      setTimeout(() => input.focus(), 100);
    }

    // 清除之前的错误消息
    this.clearAPIKeyError();
  }

  /**
   * 隐藏API密钥配置模态框
   * @private
   */
  hideAPIKeyModal() {
    const modal = document.getElementById('api-key-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }

    // 清除输入框和错误消息
    const input = document.getElementById('api-key-input');
    if (input) {
      input.value = '';
    }
    this.clearAPIKeyError();
  }

  /**
   * 显示API密钥错误消息
   * @param {string} message - 错误消息
   * @private
   */
  showAPIKeyError(message) {
    const errorElement = document.getElementById('api-key-error');
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.remove('hidden');
    }
  }

  /**
   * 清除API密钥错误消息
   * @private
   */
  clearAPIKeyError() {
    const errorElement = document.getElementById('api-key-error');
    if (errorElement) {
      errorElement.textContent = '';
      errorElement.classList.add('hidden');
    }
  }

  /**
   * 绑定API密钥模态框事件
   * 确保事件监听器只绑定一次
   * @private
   */
  bindAPIKeyModalEvents() {
    // 使用标志避免重复绑定
    if (this._apiKeyEventsbound) {
      return;
    }

    // 设置API密钥保存按钮事件
    const saveApiKeyBtn = document.getElementById('save-api-key');
    if (saveApiKeyBtn) {
      saveApiKeyBtn.addEventListener('click', () => {
        console.log('[AppController] 保存按钮被点击');
        this.handleSaveAPIKey();
      });
    }

    // 设置API密钥输入框的Enter键事件
    const apiKeyInput = document.getElementById('api-key-input');
    if (apiKeyInput) {
      apiKeyInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          console.log('[AppController] Enter键被按下');
          this.handleSaveAPIKey();
        }
      });
      // 清除错误消息当用户开始输入
      apiKeyInput.addEventListener('input', () => {
        this.clearAPIKeyError();
      });
    }

    // 点击模态框背景关闭（可选功能）
    const modal = document.getElementById('api-key-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        // 只有点击背景时才关闭，点击内容区域不关闭
        if (e.target === modal && this.isInitialized) {
          // 只有在已初始化后才允许点击背景关闭
          this.hideAPIKeyModal();
        }
      });
    }

    this._apiKeyEventsbound = true;
    console.log('[AppController] API密钥模态框事件已绑定');
  }

  /**
   * 初始化UI组件
   * 设置事件监听器和初始状态
   * @private
   */
  initializeUI() {
    // 绑定API密钥模态框事件（如果还没绑定）
    this.bindAPIKeyModalEvents();

    // 设置设置按钮事件（允许修改API密钥）
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
      settingsBtn.replaceWith(settingsBtn.cloneNode(true));
      const newSettingsBtn = document.getElementById('settings-btn');
      newSettingsBtn.addEventListener('click', () => this.showAPIKeyModal());
    }

    // 设置刷新按钮事件
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
      refreshBtn.replaceWith(refreshBtn.cloneNode(true));
      const newRefreshBtn = document.getElementById('refresh-btn');
      newRefreshBtn.addEventListener('click', () => this.handleRefresh());
    }

    // 设置位置搜索按钮事件（任务 13.2）
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) {
      searchBtn.replaceWith(searchBtn.cloneNode(true));
      const newSearchBtn = document.getElementById('search-btn');
      newSearchBtn.addEventListener('click', () => this.handleLocationSearch());
    }

    // 设置位置输入框的Enter键事件和防抖（任务 13.2）
    const locationInput = document.getElementById('location-input');
    if (locationInput) {
      locationInput.replaceWith(locationInput.cloneNode(true));
      const newLocationInput = document.getElementById('location-input');
      
      // Enter键触发搜索
      newLocationInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.handleLocationSearch();
        }
      });

      // 输入时清除错误消息
      newLocationInput.addEventListener('input', () => {
        this.clearLocationError();
      });

      // 需求13：点击输入框时显示搜索历史
      newLocationInput.addEventListener('focus', () => {
        this.showSearchHistory();
      });
    }

    // 设置当前位置按钮事件（任务 13.3）
    const currentLocationBtn = document.getElementById('current-location-btn');
    if (currentLocationBtn) {
      currentLocationBtn.replaceWith(currentLocationBtn.cloneNode(true));
      const newCurrentLocationBtn = document.getElementById('current-location-btn');
      newCurrentLocationBtn.addEventListener('click', () => this.handleCurrentLocation());
    }

    // 需求12：设置通知设置按钮事件
    const notificationSettingsBtn = document.getElementById('notification-settings-btn');
    if (notificationSettingsBtn) {
      notificationSettingsBtn.replaceWith(notificationSettingsBtn.cloneNode(true));
      const newNotificationSettingsBtn = document.getElementById('notification-settings-btn');
      newNotificationSettingsBtn.addEventListener('click', () => this.showNotificationModal());
    }

    // 需求12：设置收藏位置按钮事件
    const addFavoriteBtn = document.getElementById('add-favorite-btn');
    if (addFavoriteBtn) {
      addFavoriteBtn.replaceWith(addFavoriteBtn.cloneNode(true));
      const newAddFavoriteBtn = document.getElementById('add-favorite-btn');
      newAddFavoriteBtn.addEventListener('click', () => this.addFavoriteLocation());
    }

    // 需求12：设置保存通知设置按钮事件
    const saveNotificationSettingsBtn = document.getElementById('save-notification-settings');
    if (saveNotificationSettingsBtn) {
      saveNotificationSettingsBtn.replaceWith(saveNotificationSettingsBtn.cloneNode(true));
      const newSaveNotificationSettingsBtn = document.getElementById('save-notification-settings');
      newSaveNotificationSettingsBtn.addEventListener('click', () => this.saveNotificationSettings());
    }

    // 需求12：设置测试通知按钮事件
    const testNotificationBtn = document.getElementById('test-notification');
    if (testNotificationBtn) {
      testNotificationBtn.replaceWith(testNotificationBtn.cloneNode(true));
      const newTestNotificationBtn = document.getElementById('test-notification');
      newTestNotificationBtn.addEventListener('click', () => this.testNotification());
    }

    // 需求12：设置关闭通知模态框按钮事件
    const closeNotificationModalBtn = document.getElementById('close-notification-modal');
    if (closeNotificationModalBtn) {
      closeNotificationModalBtn.replaceWith(closeNotificationModalBtn.cloneNode(true));
      const newCloseNotificationModalBtn = document.getElementById('close-notification-modal');
      newCloseNotificationModalBtn.addEventListener('click', () => this.hideNotificationModal());
    }

    // 需求12：点击通知模态框背景关闭
    const notificationModal = document.getElementById('notification-modal');
    if (notificationModal) {
      notificationModal.addEventListener('click', (e) => {
        if (e.target === notificationModal) {
          this.hideNotificationModal();
        }
      });
    }

    // 需求13：点击外部区域隐藏搜索历史下拉列表
    document.addEventListener('click', (e) => {
      const locationInput = document.getElementById('location-input');
      const historyDropdown = document.getElementById('search-history-dropdown');
      
      // 如果点击的不是输入框或下拉列表，则隐藏下拉列表
      if (locationInput && historyDropdown && 
          !locationInput.contains(e.target) && 
          !historyDropdown.contains(e.target)) {
        this.hideSearchHistory();
      }
    });

    // 需求11：设置天气视图切换按钮事件
    const overviewBtn = document.getElementById('overview-btn');
    if (overviewBtn) {
      overviewBtn.addEventListener('click', () => {
        if (this.weatherController) {
          this.weatherController.switchView('overview');
        }
      });
    }

    const hourlyBtn = document.getElementById('hourly-btn');
    if (hourlyBtn) {
      hourlyBtn.addEventListener('click', () => {
        if (this.weatherController) {
          this.weatherController.switchView('hourly');
        }
      });
    }

    // 需求11：设置日期切换按钮事件
    const todayBtn = document.getElementById('today-btn');
    if (todayBtn) {
      todayBtn.addEventListener('click', () => {
        if (this.weatherController) {
          this.weatherController.switchDay('today');
        }
      });
    }

    const tomorrowBtn = document.getElementById('tomorrow-btn');
    if (tomorrowBtn) {
      tomorrowBtn.addEventListener('click', () => {
        if (this.weatherController) {
          this.weatherController.switchDay('tomorrow');
        }
      });
    }

    // 需求11：设置参数切换按钮事件
    const paramButtons = document.querySelectorAll('.parameter-selector button');
    paramButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const param = btn.dataset.param;
        if (param && this.weatherController) {
          this.weatherController.switchParameter(param);
        }
      });
    });

    // 初始化其他UI组件...
    this.hideLoading();
  }

  /**
   * 处理API密钥保存
   * 
   * 验证并保存用户输入的API密钥
   * 需求：1.2 - 存储API密钥
   * 需求：1.3 - 验证密钥有效性
   * 需求：1.4 - 显示错误消息
   * 
   * @private
   */
  async handleSaveAPIKey() {
    const input = document.getElementById('api-key-input');
    if (!input) {
      console.error('API密钥输入框未找到');
      return;
    }

    const apiKey = input.value.trim();

    // 验证API密钥不为空
    if (!apiKey) {
      this.showAPIKeyError('请输入API密钥');
      return;
    }

    // 基本格式验证：API密钥应该是一个合理长度的字符串
    if (apiKey.length < 10) {
      this.showAPIKeyError('API密钥格式不正确，长度过短');
      return;
    }

    try {
      // 清除错误消息
      this.clearAPIKeyError();

      // 显示保存中状态
      const saveButton = document.getElementById('save-api-key');
      if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = '保存中...';
      }

      // 保存API密钥到本地存储（需求 1.2）
      this.storageService.saveAPIKey(apiKey);

      // 更新 WeatherController 的 API 密钥
      if (this.weatherController) {
        this.weatherController.setAPIKey(apiKey);
      }

      // TODO: 需求 1.3 - 验证API密钥有效性
      // 这将在实现WindyAPIService后完成
      // 目前先保存，后续任务会添加实际的API验证
      
      // 恢复按钮状态
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = '保存';
      }

      // 隐藏模态框
      this.hideAPIKeyModal();

      // 如果是首次配置，初始化UI
      if (!this.isInitialized) {
        this.initializeUI();
        this.isInitialized = true;
      }

      // 显示成功消息
      this.showSuccess('API密钥保存成功');

    } catch (error) {
      // 需求 1.4：显示错误消息
      console.error('保存API密钥失败:', error);
      
      // 使用ErrorHandler处理错误
      const errorInfo = ErrorHandler.handleError(error, 'Save API Key');
      this.showAPIKeyError(errorInfo.message);

      // 恢复按钮状态
      const saveButton = document.getElementById('save-api-key');
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = '保存';
      }
    }
  }

  /**
   * 处理数据刷新
   * @private
   */
  async handleRefresh() {
    if (!this.currentLocation) {
      this.showError('请先选择位置');
      return;
    }

    try {
      // 清除缓存，强制重新获取数据
      this.storageService.clearWeatherCache(this.currentLocation);

      // 重新加载数据
      await this.handleLocationChange(this.currentLocation);

      this.showSuccess('数据刷新成功');

    } catch (error) {
      // 使用ErrorHandler处理错误
      const errorInfo = ErrorHandler.handleError(error, 'Data Refresh');
      this.showError(errorInfo.message);
    }
  }

  /**
   * 处理位置搜索
   * 
   * 任务 13.2：实现位置搜索功能
   * - 获取用户输入的位置名称
   * - 调用地理编码服务转换为坐标
   * - 更新天气和预测显示
   * 
   * 需求：2.1, 2.2, 2.5
   * 
   * @private
   */
  async handleLocationSearch() {
    const locationInput = document.getElementById('location-input');
    if (!locationInput) {
      console.error('位置输入框未找到');
      return;
    }

    const locationName = locationInput.value.trim();

    // 验证输入不为空
    if (!locationName) {
      this.showLocationError('请输入位置名称');
      return;
    }

    try {
      // 清除之前的错误消息
      this.clearLocationError();

      // 显示加载状态
      this.showLoading(true);

      // 禁用搜索按钮防止重复点击
      const searchBtn = document.getElementById('search-btn');
      if (searchBtn) {
        searchBtn.disabled = true;
        searchBtn.textContent = '搜索中...';
      }

      // 调用地理编码服务（需求 2.2）
      // 注意：GeocodingService 需要在构造函数中注入
      if (!this.geocodingService) {
        throw new Error('地理编码服务未初始化');
      }

      const location = await this.geocodingService.geocode(locationName);

      // 更新天气和预测显示（需求 2.1）
      await this.handleLocationChange(location);

      // 需求13：保存到搜索历史
      this.storageService.saveSearchHistory(location);

      // 清空输入框
      locationInput.value = '';

      // 显示成功消息
      this.showSuccess(`已切换到：${location.name}`);

    } catch (error) {
      // 需求 2.5：显示友好的错误提示
      console.error('位置搜索失败:', error);
      
      // 使用ErrorHandler处理错误
      const errorInfo = ErrorHandler.handleError(error, 'Location Search');
      this.showLocationError(errorInfo.message);
      this.showError(errorInfo.message);

    } finally {
      // 恢复搜索按钮状态
      const searchBtn = document.getElementById('search-btn');
      if (searchBtn) {
        searchBtn.disabled = false;
        searchBtn.textContent = '搜索';
      }

      // 隐藏加载状态
      this.showLoading(false);
    }
  }

  /**
   * 处理当前位置获取
   * 
   * 任务 13.3：实现当前位置功能
   * - 请求浏览器地理位置权限
   * - 获取用户当前GPS坐标
   * - 处理权限拒绝情况
   * - 更新天气和预测显示
   * 
   * 需求：2.3, 2.4
   * 
   * @private
   */
  async handleCurrentLocation() {
    try {
      // 清除之前的错误消息
      this.clearLocationError();

      // 显示加载状态
      this.showLoading(true);

      // 禁用当前位置按钮防止重复点击
      const currentLocationBtn = document.getElementById('current-location-btn');
      if (currentLocationBtn) {
        currentLocationBtn.disabled = true;
        currentLocationBtn.textContent = '📍 获取位置中...';
      }

      // 检查地理编码服务是否已初始化
      if (!this.geocodingService) {
        throw new Error('地理编码服务未初始化');
      }

      // 需求 2.3：请求浏览器地理位置权限并获取当前位置
      const location = await this.geocodingService.getCurrentLocation();

      // 更新天气和预测显示
      await this.handleLocationChange(location);

      // 显示成功消息
      this.showSuccess(`已定位到：${location.name}`);

    } catch (error) {
      // 需求 2.4：处理权限拒绝情况和其他错误
      console.error('获取当前位置失败:', error);
      
      // 使用ErrorHandler处理错误
      const errorInfo = ErrorHandler.handleError(error, 'Get Current Location');
      this.showLocationError(errorInfo.message);
      this.showError(errorInfo.message);

    } finally {
      // 恢复当前位置按钮状态
      const currentLocationBtn = document.getElementById('current-location-btn');
      if (currentLocationBtn) {
        currentLocationBtn.disabled = false;
        currentLocationBtn.textContent = '📍 使用当前位置';
      }

      // 隐藏加载状态
      this.showLoading(false);
    }
  }

  /**
   * 显示位置错误消息
   * @param {string} message - 错误消息
   * @private
   */
  showLocationError(message) {
    const errorElement = document.getElementById('location-error');
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.remove('hidden');
      errorElement.style.display = 'block';
    }
  }

  /**
   * 清除位置错误消息
   * @private
   */
  clearLocationError() {
    const errorElement = document.getElementById('location-error');
    if (errorElement) {
      errorElement.textContent = '';
      errorElement.classList.add('hidden');
      errorElement.style.display = 'none';
    }
  }

  /**
   * 显示/隐藏加载状态
   * @param {boolean} show - 是否显示加载状态
   * @private
   */
  showLoading(show = true) {
    const loadingElement = document.getElementById('loading-indicator');
    if (loadingElement) {
      loadingElement.style.display = show ? 'block' : 'none';
    }

    // 禁用/启用刷新按钮
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
      refreshBtn.disabled = show;
    }
  }

  /**
   * 隐藏加载状态
   * @private
   */
  hideLoading() {
    this.showLoading(false);
  }

  /**
   * 显示错误消息
   * @param {string} message - 错误消息
   * @private
   */
  showError(message) {
    // 简单实现：使用alert或创建错误提示元素
    // 后续任务会实现更好的UI
    console.error(message);
    
    const errorElement = document.getElementById('error-message');
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = 'block';
      errorElement.className = 'error-message show';

      // 5秒后自动隐藏
      setTimeout(() => {
        errorElement.style.display = 'none';
        errorElement.className = 'error-message';
      }, 5000);
    } else {
      // 降级方案：使用alert
      alert(message);
    }
  }

  /**
   * 显示成功消息
   * @param {string} message - 成功消息
   * @private
   */
  showSuccess(message) {
    console.log(message);
    
    const successElement = document.getElementById('success-message');
    if (successElement) {
      successElement.textContent = message;
      successElement.style.display = 'block';
      successElement.className = 'success-message show';

      // 3秒后自动隐藏
      setTimeout(() => {
        successElement.style.display = 'none';
        successElement.className = 'success-message';
      }, 3000);
    }
  }

  /**
   * 获取当前位置
   * @returns {Location|null} 当前位置对象，如果未设置则返回null
   */
  getCurrentLocation() {
    return this.currentLocation;
  }

  /**
   * 检查应用是否已初始化
   * @returns {boolean} 如果已初始化返回true，否则返回false
   */
  isAppInitialized() {
    return this.isInitialized;
  }

  // ========== 需求12：收藏位置管理 ==========

  /**
   * 添加收藏位置
   * 
   * @param {Location} location - 要收藏的位置对象
   * @returns {boolean} 是否成功添加
   * 
   * 需求：12.9, 12.10 - 支持用户收藏多个位置
   */
  addFavoriteLocation(location) {
    if (!location) {
      location = this.currentLocation;
    }

    if (!location || !location.isValid()) {
      this.showError('无效的位置信息');
      return false;
    }

    const success = this.storageService.saveFavoriteLocation(location);
    
    if (success) {
      this.showSuccess(`已收藏：${location.name}`);
      this.loadFavoriteLocations(); // 刷新收藏列表显示
      return true;
    } else {
      this.showError('该位置已在收藏列表中');
      return false;
    }
  }

  /**
   * 加载并显示收藏位置列表
   * 
   * 需求：12.9, 12.10 - 显示收藏位置列表
   */
  loadFavoriteLocations() {
    const favorites = this.storageService.getFavoriteLocations();
    const favoriteList = document.getElementById('favorite-list');

    if (!favoriteList) {
      console.warn('[AppController] 收藏位置列表元素未找到');
      return;
    }

    // 清空现有列表
    favoriteList.innerHTML = '';

    if (favorites.length === 0) {
      favoriteList.innerHTML = '<li class="empty-favorites">暂无收藏位置</li>';
      return;
    }

    // 渲染收藏位置列表
    favorites.forEach(fav => {
      const li = document.createElement('li');
      li.className = 'favorite-item';
      li.innerHTML = `
        <span class="favorite-name">${fav.name}</span>
        <div class="favorite-actions">
          <button class="btn-favorite-switch" data-lat="${fav.lat}" data-lon="${fav.lon}" data-name="${fav.name}">
            切换
          </button>
          <button class="btn-favorite-remove" data-key="${fav.lat}_${fav.lon}">
            删除
          </button>
        </div>
      `;
      favoriteList.appendChild(li);
    });

    // 绑定切换按钮事件
    const switchButtons = favoriteList.querySelectorAll('.btn-favorite-switch');
    switchButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const location = {
          lat: parseFloat(btn.dataset.lat),
          lon: parseFloat(btn.dataset.lon),
          name: btn.dataset.name,
          isValid: () => true
        };
        this.switchToFavoriteLocation(location);
      });
    });

    // 绑定删除按钮事件
    const removeButtons = favoriteList.querySelectorAll('.btn-favorite-remove');
    removeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.removeFavoriteLocation(btn.dataset.key);
      });
    });
  }

  /**
   * 删除收藏位置
   * 
   * @param {string} locationKey - 位置键（格式：lat_lon）
   * 
   * 需求：12.9, 12.10 - 删除收藏位置
   */
  removeFavoriteLocation(locationKey) {
    const success = this.storageService.removeFavoriteLocation(locationKey);
    
    if (success) {
      this.showSuccess('已删除收藏位置');
      this.loadFavoriteLocations(); // 刷新收藏列表显示
    } else {
      this.showError('删除失败');
    }
  }

  /**
   * 切换到收藏位置
   * 
   * @param {Location} location - 收藏的位置对象
   * 
   * 需求：12.9, 12.10 - 在位置列表中快速切换
   */
  async switchToFavoriteLocation(location) {
    try {
      await this.handleLocationChange(location);
      this.showSuccess(`已切换到：${location.name}`);
    } catch (error) {
      const errorInfo = ErrorHandler.handleError(error, 'Switch to Favorite Location');
      this.showError(errorInfo.message);
    }
  }

  // ========== 需求12：通知设置管理 ==========

  /**
   * 更新通知设置
   * 
   * @param {Object} settings - 通知设置对象 {enabled: boolean, threshold: number}
   * 
   * 需求：12.6, 12.7, 12.8 - 通知设置管理
   */
  updateNotificationSettings(settings) {
    const success = this.storageService.saveNotificationSettings(settings);
    
    if (success) {
      this.showSuccess('通知设置已保存');
      
      // 如果启用了通知，请求权限
      if (settings.enabled && this.predictionController) {
        this.predictionController.notificationService.requestPermission()
          .then(permission => {
            if (permission === 'granted') {
              console.log('[AppController] 通知权限已授予');
            } else {
              this.showError('通知权限被拒绝，请在浏览器设置中允许通知');
            }
          });
      }
    } else {
      this.showError('保存通知设置失败');
    }
  }

  /**
   * 在初始化时请求通知权限（如果用户启用了通知）
   * 
   * 需求：12.6, 12.7, 12.8 - 通知权限管理
   * 
   * @private
   */
  async requestNotificationPermissionIfEnabled() {
    const settings = this.storageService.getNotificationSettings();
    
    if (settings.enabled && this.predictionController) {
      try {
        const permission = await this.predictionController.notificationService.requestPermission();
        
        if (permission === 'granted') {
          console.log('[AppController] 通知权限已授予');
        } else if (permission === 'denied') {
          console.warn('[AppController] 通知权限被拒绝');
          // 更新设置，禁用通知
          this.storageService.saveNotificationSettings({ ...settings, enabled: false });
        }
      } catch (error) {
        console.error('[AppController] 请求通知权限失败:', error);
      }
    }
  }

  /**
   * 显示通知设置模态框
   * 
   * 需求：12.6, 12.7 - 通知设置界面
   * 
   * @private
   */
  showNotificationModal() {
    const modal = document.getElementById('notification-modal');
    if (!modal) return;

    // 加载当前设置
    const settings = this.storageService.getNotificationSettings();
    
    const enabledCheckbox = document.getElementById('notification-enabled');
    const thresholdInput = document.getElementById('notification-threshold');
    const thresholdValue = document.querySelector('.threshold-value');

    if (enabledCheckbox) {
      enabledCheckbox.checked = settings.enabled;
    }

    if (thresholdInput) {
      thresholdInput.value = settings.threshold;
      
      // 更新阈值显示
      thresholdInput.addEventListener('input', (e) => {
        if (thresholdValue) {
          thresholdValue.textContent = e.target.value;
        }
      });
    }

    if (thresholdValue) {
      thresholdValue.textContent = settings.threshold;
    }

    modal.classList.remove('hidden');
  }

  /**
   * 隐藏通知设置模态框
   * 
   * @private
   */
  hideNotificationModal() {
    const modal = document.getElementById('notification-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  /**
   * 保存通知设置
   * 
   * 需求：12.6, 12.7 - 保存通知设置
   * 
   * @private
   */
  saveNotificationSettings() {
    const enabledCheckbox = document.getElementById('notification-enabled');
    const thresholdInput = document.getElementById('notification-threshold');

    if (!enabledCheckbox || !thresholdInput) {
      this.showError('无法读取通知设置');
      return;
    }

    const settings = {
      enabled: enabledCheckbox.checked,
      threshold: parseInt(thresholdInput.value, 10)
    };

    // 验证阈值
    if (isNaN(settings.threshold) || settings.threshold < 0 || settings.threshold > 100) {
      this.showError('阈值必须在0-100之间');
      return;
    }

    this.updateNotificationSettings(settings);
    this.hideNotificationModal();
  }

  /**
   * 测试通知功能
   * 
   * 需求：12.8 - 测试通知
   * 
   * @private
   */
  async testNotification() {
    if (!this.predictionController || !this.predictionController.notificationService) {
      this.showError('通知服务未初始化');
      return;
    }

    try {
      const permission = await this.predictionController.notificationService.requestPermission();
      
      if (permission === 'granted') {
        this.predictionController.notificationService.sendNotification(
          '测试通知',
          {
            body: '通知功能正常工作！🌅',
            icon: '🌅',
            tag: 'test-notification'
          }
        );
        this.showSuccess('测试通知已发送');
      } else {
        this.showError('通知权限被拒绝，请在浏览器设置中允许通知');
      }
    } catch (error) {
      console.error('[AppController] 测试通知失败:', error);
      this.showError('测试通知失败：' + error.message);
    }
  }

  // ========== 需求13：搜索历史管理 ==========

  /**
   * 加载并显示搜索历史
   * 
   * 需求：13.1, 13.4, 13.5, 13.7, 13.8, 13.9 - 加载搜索历史
   */
  loadSearchHistory() {
    const history = this.storageService.getSearchHistory();
    const historyDropdown = document.getElementById('search-history-dropdown');

    if (!historyDropdown) {
      console.warn('[AppController] 搜索历史下拉列表元素未找到');
      return;
    }

    // 清空现有列表
    historyDropdown.innerHTML = '';

    if (history.length === 0) {
      historyDropdown.innerHTML = '<div class="history-empty">暂无搜索历史</div>';
      historyDropdown.classList.add('hidden');
      return;
    }

    // 渲染历史记录列表
    const historyList = document.createElement('ul');
    historyList.className = 'history-list';

    history.forEach(item => {
      const li = document.createElement('li');
      li.className = 'history-item';
      li.innerHTML = `
        <span class="history-name" data-lat="${item.lat}" data-lon="${item.lon}" data-name="${item.name}">
          📍 ${item.name}
        </span>
        <button class="history-remove" data-key="${item.lat}_${item.lon}" aria-label="删除">
          ✕
        </button>
      `;
      historyList.appendChild(li);
    });

    // 添加清除全部按钮
    const clearAllBtn = document.createElement('button');
    clearAllBtn.className = 'history-clear-all btn btn-secondary';
    clearAllBtn.textContent = '清除全部历史';
    clearAllBtn.addEventListener('click', () => this.clearAllHistory());

    historyDropdown.appendChild(historyList);
    historyDropdown.appendChild(clearAllBtn);

    // 绑定点击事件
    const historyNames = historyDropdown.querySelectorAll('.history-name');
    historyNames.forEach(nameEl => {
      nameEl.addEventListener('click', () => {
        const location = {
          lat: parseFloat(nameEl.dataset.lat),
          lon: parseFloat(nameEl.dataset.lon),
          name: nameEl.dataset.name,
          isValid: () => true
        };
        this.handleHistoryItemClick(location);
      });
    });

    // 绑定删除按钮事件
    const removeButtons = historyDropdown.querySelectorAll('.history-remove');
    removeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation(); // 防止触发父元素的点击事件
        this.removeHistoryItem(btn.dataset.key);
      });
    });
  }

  /**
   * 处理历史记录点击
   * 
   * @param {Location} location - 历史记录中的位置对象
   * 
   * 需求：13.1, 13.4, 13.5, 13.7, 13.8, 13.9 - 点击历史记录加载天气数据
   */
  async handleHistoryItemClick(location) {
    try {
      // 隐藏历史下拉列表
      this.hideSearchHistory();

      // 填充到输入框
      const locationInput = document.getElementById('location-input');
      if (locationInput) {
        locationInput.value = location.name;
      }

      // 加载天气数据
      await this.handleLocationChange(location);
      this.showSuccess(`已切换到：${location.name}`);
    } catch (error) {
      const errorInfo = ErrorHandler.handleError(error, 'History Item Click');
      this.showError(errorInfo.message);
    }
  }

  /**
   * 删除单个历史记录
   * 
   * @param {string} locationKey - 位置键（格式：lat_lon）
   * 
   * 需求：13.1, 13.4, 13.5, 13.7, 13.8, 13.9 - 删除单个历史记录
   */
  removeHistoryItem(locationKey) {
    const success = this.storageService.removeSearchHistoryItem(locationKey);
    
    if (success) {
      this.showSuccess('已删除历史记录');
      this.loadSearchHistory(); // 刷新历史列表显示
    } else {
      this.showError('删除失败');
    }
  }

  /**
   * 清除全部历史记录
   * 
   * 需求：13.1, 13.4, 13.5, 13.7, 13.8, 13.9 - 清除全部历史记录
   */
  clearAllHistory() {
    const success = this.storageService.clearSearchHistory();
    
    if (success) {
      this.showSuccess('已清除所有搜索历史');
      this.loadSearchHistory(); // 刷新历史列表显示
    } else {
      this.showError('清除失败');
    }
  }

  /**
   * 显示搜索历史下拉列表
   * 
   * 需求：13.4, 13.5, 13.7, 13.8 - 显示搜索历史下拉列表
   */
  showSearchHistory() {
    this.loadSearchHistory();
    const historyDropdown = document.getElementById('search-history-dropdown');
    if (historyDropdown) {
      historyDropdown.classList.remove('hidden');
    }
  }

  /**
   * 隐藏搜索历史下拉列表
   * 
   * 需求：13.4, 13.5, 13.7, 13.8 - 隐藏搜索历史下拉列表
   */
  hideSearchHistory() {
    const historyDropdown = document.getElementById('search-history-dropdown');
    if (historyDropdown) {
      historyDropdown.classList.add('hidden');
    }
  }
}

export default AppController;
