/**
 * AppController - 应用主控制器
 *
 * 协调各子控制器，管理应用的整体流程
 * 负责初始化应用、处理位置变更等核心功能
 *
 * 需求：1.1 - API密钥管理（首次访问显示配置界面）
 * 需求：1.5 - API密钥管理（已配置时允许查看和修改）
 * 需求：14 - 多语言支持
 */

import ErrorHandler from '../utils/ErrorHandler.js';
import i18n from '../i18n.js';
import { LanguageSelector } from '../components/LanguageSelector.js';
import ThemeService from '../services/ThemeService.js';
import UIStateController from './UIStateController.js';
import FavoriteController from './FavoriteController.js';

class AppController {
  /**
   * 创建AppController实例
   * @param {StorageService} storageService - 存储服务实例
   * @param {WeatherController} weatherController - 天气控制器实例
   * @param {PredictionController} predictionController - 预测控制器实例
   * @param {GeocodingService} geocodingService - 地理编码服务实例（任务 13.2）
   */
  constructor(storageService, weatherController, predictionController, geocodingService = null, dependencies = {}) {
    this.storageService = storageService;
    this.weatherController = weatherController;
    this.predictionController = predictionController;
    this.geocodingService = geocodingService;
    // 挂到 window，供 SettingsPanel 读取 providerMeta
    window._weatherController = weatherController;
    this.currentLocation = null;
    this.isInitialized = false;
    this.citySuggestions = [];
    this.citySuggestionTimer = null;
    this.citySuggestionRequestId = 0;

    // 需求14：初始化I18n系统
    this.i18n = i18n;

    // 任务17：初始化主题服务
    this.themeService = new ThemeService();

    // 任务16：设置面板
    this.settingsPanel = null;
    this.uiStateController = dependencies.uiStateController || new UIStateController();
    this.favoriteController = dependencies.favoriteController || new FavoriteController({
      storageService: this.storageService,
      i18n: this.i18n,
      onSuccess: (message) => this.showSuccess(message),
      onError: (message) => this.showError(message),
      onLocationChange: (location) => this.handleLocationChange(location)
    });
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
      // 需求14：初始化I18n系统
      console.log('[AppController] 初始化I18n系统...');
      await this.i18n.init();
      console.log('[AppController] I18n系统初始化完成，当前语言:', this.i18n.getLanguage());

      // 任务17.2：初始化主题系统
      console.log('[AppController] 初始化主题系统...');
      this.initializeTheme();
      this.setupThemeListener();
      this.setupWeatherModelListener();
      this.setupChinaRenderModeListener();

      // API 模式固定为后端代理：前端不再执行 API 密钥门禁
      console.log('[AppController] API模式: 后端代理（固定），跳过前端 API 密钥检查');
      this.initializeUI();

      // 需求12：加载收藏位置列表
      this.loadFavoriteLocations();

      // 需求13：加载搜索历史（预填充到下拉列表）
      this.loadSearchHistory();

      // 需求12：请求通知权限（如果用户启用了通知）
      await this.requestNotificationPermissionIfEnabled();

      // 任务17.3：尝试加载默认位置，如果不存在则加载上次使用的位置（仅当天气控制器可用时）
      if (this.weatherController && this.predictionController) {
        // 优先加载默认位置
        const defaultLocation = this.storageService.getDefaultLocation();
        const lastLocation = this.storageService.getLastLocation();
        const locationToLoad = defaultLocation || lastLocation;

        if (locationToLoad) {
          try {
            await this.handleLocationChange(locationToLoad);
            console.log('[AppController] 已加载位置:', locationToLoad.name, defaultLocation ? '(默认位置)' : '(上次位置)');
          } catch (error) {
            // 加载位置失败不应阻止应用启动（需求：14.1）
            console.warn('加载位置失败:', error.message);
            console.log('[AppController] 跳过位置加载，继续启动应用');
            // 不要显示错误消息，只记录日志，避免干扰用户体验
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

      const predictionSection = document.getElementById('prediction-section');
      if (predictionSection) {
        predictionSection.classList.add('hidden');
        predictionSection.classList.remove('prediction-loading');
      }

      // 获取天气数据（失败不阻塞地图等功能）
      let weatherData = null;
      try {
        weatherData = await this.weatherController.fetchWeather(location);
      } catch (weatherErr) {
        console.warn('[AppController] 天气数据获取失败，继续加载其他功能:', weatherErr.message);
        this.showError('天气数据暂时不可用，火烧云地图仍可正常使用');
        setTimeout(() => this.hideError?.(), 4000);
      }

      if (weatherData && weatherData.length > 0) {
        // 更新天气显示：天气信息先展示，再在朝霞/晚霞预测区域显示加载状态
        this.weatherController.updateWeatherDisplay(weatherData, location);
        this._setThreeDayGlowLoading(true);
        this.showLoading(true, { progress: 48, message: this.i18n.t('loading.prediction') });

        // 生成晚霞预测
        let predictions;
        try {
          predictions = await this._runPredictionWithTimeout(
            this.predictionController.generatePredictions(weatherData, location)
          );
        } catch (predictionError) {
          console.error('[AppController] 生成预测时出错:', predictionError.message);
          this.showError(`晚霞预测功能暂时不可用: ${predictionError.message}`);
          predictions = [];
          this._setThreeDayGlowLoading(false);
        }

        if (predictions && predictions.length > 0) {
          this.updateLoadingProgress({ progress: 88, message: this.i18n.t('loading.pleaseWait') });
          this.predictionController.updatePredictionDisplay(predictions);
        } else {
          console.warn('[AppController] 没有生成预测数据，跳过预测显示');
          this._setThreeDayGlowLoading(false);
          this.showError(this.i18n.t('prediction.insufficientData'));
        }
      } else {
        console.warn('[AppController] 无天气数据，跳过天气/预测显示，继续加载地图');
      }

      // Phase 18：雷达罗盘（异步，不阻塞主流程）
      // 需求：分别放在朝霞/晚霞卡片下方，并按对应时段计算
      if (this.weatherController?.renderRadarCompass) {
        this.weatherController.renderRadarCompass(location, 'sunrise').catch(err => {
          console.warn('[AppController] 朝霞雷达罗盘加载失败:', err.message);
        });
        this.weatherController.renderRadarCompass(location, 'sunset').catch(err => {
          console.warn('[AppController] 晚霞雷达罗盘加载失败:', err.message);
        });
      }

      // Phase 16：中国散点地图（异步，不阻塞主流程）
      if (this.weatherController?.updateChinaSpotsForLocation) {
        this.weatherController.updateChinaSpotsForLocation(location).catch(err => {
          console.warn('[AppController] 更新中国散点地图失败:', err.message);
        });
      }

      this.updateLoadingProgress({ progress: 100, message: this.i18n.t('loading.pleaseWait') });

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
    const modalTitle = modal.querySelector('h2');
    const modalDesc = modal.querySelector('.modal-description');

    if (input) {
      input.value = existingKey || '';

      // 如果已有API密钥，更新提示文本
      if (existingKey) {
        if (modalTitle) modalTitle.textContent = '更新Windy API密钥';
        if (modalDesc) modalDesc.textContent = '您的API密钥已保存，如需修改请重新输入';
        // 添加提示信息
        const infoDiv = document.createElement('div');
        infoDiv.className = 'info-message';
        infoDiv.style.cssText = 'background: #e3f2fd; color: #1976d2; padding: 12px; border-radius: 4px; margin-top: 16px; font-size: 0.9rem;';
        infoDiv.innerHTML = '✅ API密钥已保存，下次启动将自动加载<br>💡 如需更换密钥，直接修改并保存即可';
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent && !modalContent.querySelector('.info-message')) {
          modalContent.insertBefore(infoDiv, modal.querySelector('.modal-actions'));
        }
      } else {
        // 聚焦到输入框（首次配置）
        setTimeout(() => input.focus(), 100);
      }
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
    // 监听语言切换事件，刷新界面
    window.addEventListener('languageChanged', (event) => {
      console.log('[AppController] 语言已切换至:', event.detail.language);
      this.refreshUIText();

      // 语言切换会重建预测卡片DOM，需补渲染朝/晚霞云况雷达
      if (this.currentLocation && this.weatherController?.renderRadarCompass) {
        requestAnimationFrame(() => {
          this.weatherController.renderRadarCompass(this.currentLocation, 'sunrise').catch(err => {
            console.warn('[AppController] 语言切换后朝霞雷达重渲失败:', err?.message || err);
          });
          this.weatherController.renderRadarCompass(this.currentLocation, 'sunset').catch(err => {
            console.warn('[AppController] 语言切换后晚霞雷达重渲失败:', err?.message || err);
          });
        });
      }
    });

    // 任务17：监听温度单位切换事件
    window.addEventListener('temperatureUnitChanged', (event) => {
      console.log('[AppController] 温度单位已切换为:', event.detail.unit);
      if (this.weatherController) {
        this.weatherController.updateTemperatureUnit(event.detail.unit);
      }
    });

    // 任务17：监听风速单位切换事件
    window.addEventListener('windUnitChanged', (event) => {
      console.log('[AppController] 风速单位已切换为:', event.detail.unit);
      if (this.weatherController) {
        this.weatherController.updateWindUnit(event.detail.unit);
      }
    });

    // 绑定API密钥模态框事件（如果还没绑定）
    this.bindAPIKeyModalEvents();

    // 设置设置按钮事件（任务16：打开统一设置面板）
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
      settingsBtn.replaceWith(settingsBtn.cloneNode(true));
      const newSettingsBtn = document.getElementById('settings-btn');
      newSettingsBtn.addEventListener('click', () => {
        if (this.settingsPanel) {
          this.settingsPanel.toggle();
        }
      });
    }

    // 任务16：初始化设置面板
    console.log('[AppController] 初始化设置面板...');
    import('../components/SettingsPanel.js').then(module => {
      const SettingsPanel = module.default;
      this.settingsPanel = new SettingsPanel(this.storageService, this.themeService);
      this.settingsPanel.init();
      console.log('[AppController] 设置面板初始化完成');
    }).catch(error => {
      console.error('[AppController] 设置面板加载失败:', error);
    });

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

      newLocationInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.hideCitySuggestions();
        }
      });

      // 输入时清除错误消息；候选搜索做防抖，避免慢请求竞态导致下拉菜单闪退
      newLocationInput.addEventListener('input', () => {
        this.clearLocationError();
        this.scheduleCitySuggestionsUpdate(newLocationInput.value);
      });

      // 需求13：点击输入框时显示搜索历史
      newLocationInput.addEventListener('focus', async () => {
        if (newLocationInput.value.trim()) {
          await this.updateCitySuggestions(newLocationInput.value);
          return;
        }
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
      const favoritesToggleBtn = document.getElementById('favorites-toggle-btn');
      const favoritesPopover = document.getElementById('favorite-locations');
      
      // 如果点击的不是输入框或下拉列表，则隐藏下拉列表
      if (locationInput && historyDropdown && 
          !locationInput.contains(e.target) && 
          !historyDropdown.contains(e.target)) {
        this.hideSearchHistory();
      }

      const cityDropdown = document.getElementById('city-suggestions-dropdown');
      if (locationInput && cityDropdown &&
          !locationInput.contains(e.target) &&
          !cityDropdown.contains(e.target)) {
        this.hideCitySuggestions();
      }

      if (favoritesToggleBtn && favoritesPopover &&
          !favoritesToggleBtn.contains(e.target) &&
          !favoritesPopover.contains(e.target)) {
        favoritesPopover.classList.add('hidden');
      }
    });

    const favoritesToggleBtn = document.getElementById('favorites-toggle-btn');
    if (favoritesToggleBtn) {
      favoritesToggleBtn.replaceWith(favoritesToggleBtn.cloneNode(true));
      const newFavoritesToggleBtn = document.getElementById('favorites-toggle-btn');
      newFavoritesToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const favoritesPopover = document.getElementById('favorite-locations');
        if (favoritesPopover) {
          favoritesPopover.classList.toggle('hidden');
        }
      });
    }

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

    const threeDayGlowBtn = document.getElementById('three-day-glow-btn');
    if (threeDayGlowBtn) {
      threeDayGlowBtn.addEventListener('click', () => {
        if (this.weatherController) {
          this.weatherController.switchView('glow');
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

    // 任务19：设置周边半径选择按钮事件
    const radiusButtons = document.querySelectorAll('.radius-btn');
    radiusButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const radius = parseInt(e.target.dataset.radius);
        if (radius && this.weatherController) {
          // 更新按钮状态
          radiusButtons.forEach(b => b.classList.remove('active'));
          e.target.classList.add('active');

          // 设置新的半径
          this.weatherController.setSurroundingRadius(radius);
        }
      });
    });

    // 任务20：设置火烧云覆盖层UI事件 - 暂时禁用（2026-02-04，等待Phase 6重构）
    /*
    const overlayToggle = document.getElementById('firecloud-overlay-toggle');
    const overlayControls = document.getElementById('overlay-controls');
    const refreshOverlayBtn = document.getElementById('refresh-overlay-btn');
    const overlayTypeRadios = document.querySelectorAll('input[name="overlay-type"]');

    if (overlayToggle) {
      overlayToggle.addEventListener('change', async (e) => {
        const enabled = e.target.checked;

        // 显示/隐藏控制面板
        if (overlayControls) {
          overlayControls.style.display = enabled ? 'block' : 'none';
        }

        // 启用/禁用刷新按钮
        if (refreshOverlayBtn) {
          refreshOverlayBtn.disabled = !enabled;
        }

        // 切换覆盖层
        if (this.weatherController) {
          await this.weatherController.toggleFireCloudOverlay(enabled);
        }
      });
    }

    if (refreshOverlayBtn) {
      refreshOverlayBtn.addEventListener('click', async () => {
        if (this.weatherController) {
          await this.weatherController.refreshFireCloudOverlay();
        }
      });
    }

    // 覆盖层类型切换
    overlayTypeRadios.forEach(radio => {
      radio.addEventListener('change', async (e) => {
        const type = e.target.value;
        if (this.weatherController) {
          await this.weatherController.setOverlayType(type);
        }
      });
    });
    */

    // 初始化其他UI组件...

    // 需求14：初始化完成后刷新界面文本以应用正确的语言
    // 这确保从localStorage加载的语言偏好能够正确应用到UI
    console.log('[AppController] 初始化UI完成，刷新界面文本...');
    this.refreshUIText();

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
      this.showAPIKeyError(this.i18n.t('app.apiKeyRequired'));
      return;
    }

    // 基本格式验证：API密钥应该是一个合理长度的字符串
    if (apiKey.length < 10) {
      this.showAPIKeyError(this.i18n.t('app.apiKeyTooShort'));
      return;
    }

    try {
      // 清除错误消息
      this.clearAPIKeyError();

      // 显示保存中状态
      const saveButton = document.getElementById('save-api-key');
      if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = this.i18n.t('app.saving');
      }

      // 保存API密钥到本地存储（需求 1.2）
      this.storageService.saveAPIKey(apiKey);
      console.log('[AppController] API密钥已保存到本地存储');

      // 验证保存是否成功
      const savedKey = this.storageService.getAPIKey();
      console.log('[AppController] 验证保存的API密钥:', savedKey ? '成功' : '失败');

      // 更新 WeatherController 的 API 密钥
      if (this.weatherController) {
        this.weatherController.setAPIKey(apiKey);
      }

      // 需求 1.3 - API密钥有效性验证说明：
      // 基本格式验证已在上方完成（非空检查、最小长度检查）。
      // 在 proxy 模式下（默认），API密钥由后端服务器管理，无需前端验证。
      // 在 direct 模式下，WindyAPIService.validateAPIKey() 可用于在线验证。

      // 恢复按钮状态
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = this.i18n.t('buttons.save');
      }

      // 隐藏模态框
      this.hideAPIKeyModal();

      // 如果是首次配置，初始化UI
      if (!this.isInitialized) {
        this.initializeUI();
        this.isInitialized = true;
      }

      // 显示成功消息
      this.showSuccess(this.i18n.t('app.apiKeySaved'));

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
        saveButton.textContent = this.i18n.t('buttons.save');
      }
    }
  }

  /**
   * 处理数据刷新
   * @private
   */
  async handleRefresh() {
    if (!this.currentLocation) {
      this.showError(this.i18n.t('app.selectLocationFirst'));
      return;
    }

    try {
      // 清除缓存，强制重新获取数据
      this.storageService.clearWeatherCache(this.currentLocation);

      // 重新加载数据
      await this.handleLocationChange(this.currentLocation);

      this.showSuccess(this.i18n.t('app.refreshSuccess'));

    } catch (error) {
      // 使用ErrorHandler处理错误
      const errorInfo = ErrorHandler.handleError(error, 'Data Refresh');
      this.showError(this.i18n.t('app.refreshFailed', { message: errorInfo.message }));
    }
  }

  _runPredictionWithTimeout(predictionPromise, timeoutMs = 25000) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(this.i18n?.t?.('errors.timeout') || 'Request timeout, please retry'));
      }, timeoutMs);
    });

    return Promise.race([predictionPromise, timeoutPromise])
      .finally(() => clearTimeout(timeoutId));
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
    this.hideCitySuggestions();

    // 验证输入不为空
    if (!locationName) {
      this.showLocationError(this.i18n.t('app.locationRequired'));
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
        searchBtn.textContent = this.i18n.t('location.searching');
      }

      // 调用地理编码服务（需求 2.2）
      // 注意：GeocodingService 需要在构造函数中注入
      if (!this.geocodingService) {
        throw new Error(this.i18n.t('app.geocodingNotReady'));
      }

      const location = await this.geocodingService.geocode(locationName);

      // 更新天气和预测显示（需求 2.1）
      await this.handleLocationChange(location);

      // 需求13：保存到搜索历史
      const saved = this.storageService.saveSearchHistory(location);
      if (saved) {
        console.log('[AppController] 搜索历史已保存:', location.name);
        // 刷新搜索历史显示
        this.loadSearchHistory();
      } else {
        console.warn('[AppController] 搜索历史保存失败');
      }

      // 清空输入框
      locationInput.value = '';

      // 显示成功消息
      this.showSuccess(this.i18n.t('app.switchedToLocation', { name: location.name }));

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
        searchBtn.textContent = this.i18n.t('buttons.search');
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
        currentLocationBtn.setAttribute('aria-label', this.i18n.t('location.loading'));
      }

      // 检查地理编码服务是否已初始化
      if (!this.geocodingService) {
        throw new Error(this.i18n.t('app.geocodingNotReady'));
      }

      // 需求 2.3：请求浏览器地理位置权限并获取当前位置
      const location = await this.geocodingService.getCurrentLocation();

      // 更新天气和预测显示
      await this.handleLocationChange(location);

      // 显示成功消息
      this.showSuccess(this.i18n.t('app.locatedAt', { name: location.name }));

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
        currentLocationBtn.setAttribute('aria-label', this.i18n.t('buttons.useCurrentLocation'));
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
    this.uiStateController.showLocationError(message);
  }

  /**
   * 清除位置错误消息
   * @private
   */
  clearLocationError() {
    this.uiStateController.clearLocationError();
  }

  /**
   * 显示/隐藏加载状态
   * @param {boolean} show - 是否显示加载状态
   * @private
   */
  showLoading(show = true, state = {}) {
    this.uiStateController.showLoading(show, state);
  }

  updateLoadingProgress(state = {}) {
    this.uiStateController.updateLoadingProgress(state);
  }

  _setThreeDayGlowLoading(show = true) {
    const forecastTimeline = document.getElementById('forecast-timeline');
    const forecastLoading = document.getElementById('forecast-loading');

    if (forecastTimeline && show) {
      forecastTimeline.dataset.loaded = 'false';
      forecastTimeline.innerHTML = '';
    }

    if (forecastLoading) {
      forecastLoading.classList.toggle('hidden', !show);
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
    this.uiStateController.showError(message);
  }

  /**
   * 显示成功消息
   * @param {string} message - 成功消息
   * @private
   */
  showSuccess(message) {
    this.uiStateController.showSuccess(message);
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
    return this.favoriteController.addFavoriteLocation(location, this.currentLocation);
  }

  /**
   * 加载并显示收藏位置列表
   * 
   * 需求：12.9, 12.10 - 显示收藏位置列表
   */
  loadFavoriteLocations() {
    this.favoriteController.loadFavoriteLocations();
  }

  /**
   * 删除收藏位置
   * 
   * @param {string} locationKey - 位置键（格式：lat_lon）
   * 
   * 需求：12.9, 12.10 - 删除收藏位置
   */
  removeFavoriteLocation(locationKey) {
    this.favoriteController.removeFavoriteLocation(locationKey);
  }

  /**
   * 切换到收藏位置
   * 
   * @param {Location} location - 收藏的位置对象
   * 
   * 需求：12.9, 12.10 - 在位置列表中快速切换
   */
  async switchToFavoriteLocation(location) {
    return this.favoriteController.switchToFavoriteLocation(location);
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
            body: '通知功能正常工作！',
            icon: '/favicon.ico',
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

  scheduleCitySuggestionsUpdate(query, delay = 300) {
    if (this.citySuggestionTimer) {
      clearTimeout(this.citySuggestionTimer);
    }

    const keyword = (query || '').trim();
    if (!keyword) {
      this.hideCitySuggestions();
      return;
    }

    this.citySuggestionTimer = setTimeout(() => {
      this.updateCitySuggestions(keyword);
    }, delay);
  }

  async updateCitySuggestions(query) {
    const dropdown = document.getElementById('city-suggestions-dropdown');
    if (!dropdown) {
      return;
    }

    const keyword = query.trim();
    if (!keyword || !this.geocodingService || !this.geocodingService.searchCities) {
      this.hideCitySuggestions();
      return;
    }

    const requestId = ++this.citySuggestionRequestId;
    let suggestions = [];
    try {
      suggestions = await this.geocodingService.searchCities(keyword, 8);
    } catch (error) {
      console.warn('[AppController] 城市候选搜索失败:', error.message);
      suggestions = [];
    }

    // 只允许最后一次请求更新 UI，避免慢请求回包覆盖新输入导致菜单闪退
    const locationInput = document.getElementById('location-input');
    const latestKeyword = locationInput?.value?.trim() || '';
    if (requestId !== this.citySuggestionRequestId || latestKeyword !== keyword) {
      return;
    }

    this.citySuggestions = suggestions;

    if (!suggestions.length) {
      this.hideCitySuggestions();
      return;
    }

    dropdown.innerHTML = suggestions.map((city, index) => `
      <div class="history-item city-suggestion-item" data-index="${index}">
        <span class="history-name">📍 ${city.displayName}</span>
      </div>
    `).join('');

    dropdown.classList.remove('hidden');
    this.hideSearchHistory();

    dropdown.querySelectorAll('.city-suggestion-item').forEach(item => {
      item.addEventListener('click', async () => {
        const locationInput = document.getElementById('location-input');
        const index = parseInt(item.dataset.index, 10);
        const selected = this.citySuggestions[index];

        if (locationInput && selected) {
          // 优先使用 displayName，并直接使用候选坐标触发天气加载
          locationInput.value = selected.displayName || selected.enName;
          this.hideCitySuggestions();

          // 使用候选坐标直接创建 Location 对象，避免二次 geocode 误匹配
          try {
            const { default: Location } = await import('../models/Location.js');
            const location = new Location(selected.lat, selected.lon, selected.displayName || selected.enName);
            location.countryCode = selected.countryCode;

            if (location.isValid()) {
              await this.handleLocationChange(location);
              // 保存到搜索历史
              const saved = this.storageService.saveSearchHistory(location);
              if (saved) {
                console.log('[AppController] 搜索历史已保存:', location.name);
                this.loadSearchHistory();
              }
              this.showSuccess(this.i18n.t('app.switchedToLocation', { name: location.name }));
            } else {
              throw new Error('无效的坐标');
            }
          } catch (error) {
            console.error('[AppController] 选择城市失败:', error);
            this.showError('选择城市失败，请重试');
          }
        }
      });
    });
  }

  hideCitySuggestions() {
    const dropdown = document.getElementById('city-suggestions-dropdown');
    if (this.citySuggestionTimer) {
      clearTimeout(this.citySuggestionTimer);
      this.citySuggestionTimer = null;
    }
    this.citySuggestionRequestId += 1;
    if (dropdown) {
      dropdown.classList.add('hidden');
      dropdown.innerHTML = '';
    }
    this.citySuggestions = [];
  }

  // ========== 需求13：搜索历史管理 ==========

  /**
   * 加载并显示搜索历史
   * 
   * 需求：13.1, 13.4, 13.5, 13.7, 13.8, 13.9 - 加载搜索历史
   */
  loadSearchHistory() {
    this.favoriteController.loadSearchHistory();
  }

  /**
   * 处理历史记录点击
   * 
   * @param {Location} location - 历史记录中的位置对象
   * 
   * 需求：13.1, 13.4, 13.5, 13.7, 13.8, 13.9 - 点击历史记录加载天气数据
   */
  async handleHistoryItemClick(location) {
    return this.favoriteController.handleHistoryItemClick(location);
  }

  /**
   * 删除单个历史记录
   * 
   * @param {string} locationKey - 位置键（格式：lat_lon）
   * 
   * 需求：13.1, 13.4, 13.5, 13.7, 13.8, 13.9 - 删除单个历史记录
   */
  removeHistoryItem(locationKey) {
    this.favoriteController.removeHistoryItem(locationKey);
  }

  /**
   * 清除全部历史记录
   * 
   * 需求：13.1, 13.4, 13.5, 13.7, 13.8, 13.9 - 清除全部历史记录
   */
  clearAllHistory() {
    this.favoriteController.clearAllHistory();
  }

  /**
   * 显示搜索历史下拉列表
   * 
   * 需求：13.4, 13.5, 13.7, 13.8 - 显示搜索历史下拉列表
   */
  showSearchHistory() {
    this.hideCitySuggestions();
    this.favoriteController.showSearchHistory();
  }

  /**
   * 隐藏搜索历史下拉列表
   *
   * 需求：13.4, 13.5, 13.7, 13.8 - 隐藏搜索历史下拉列表
   */
  hideSearchHistory() {
    this.favoriteController.hideSearchHistory();
  }

  /**
   * 任务17.2：初始化主题系统
   * 主题已由ThemeService在构造函数中初始化，这里只需要记录日志
   * @private
   */
  initializeTheme() {
    console.log('[AppController] 当前主题:', this.themeService.getTheme());
  }

  /**
   * 任务17.2：设置主题变化监听器
   * @private
   */
  setupThemeListener() {
    // 监听主题切换事件
    window.addEventListener('themeChanged', (event) => {
      const theme = event.detail.theme;
      const actualTheme = event.detail.actualTheme;
      console.log('[AppController] 主题已切换为:', theme, '(实际:', actualTheme + ')');

      // 主题已被ThemeService应用，这里只需要处理需要重新渲染的UI
      // 不要再调用 themeService.setTheme()，否则会形成无限循环！

      // 重新初始化设置面板以应用新主题样式
      if (this.settingsPanel && this.settingsPanel.isOpen) {
        this.settingsPanel.refreshTranslations();
      }

      // 主题切换时重渲染雷达罗盘（颜色跟随主题）
      if (this.weatherController?.renderRadarCompass && this.currentLocation) {
        this.weatherController.renderRadarCompass(this.currentLocation, 'sunrise').catch(() => {});
        this.weatherController.renderRadarCompass(this.currentLocation, 'sunset').catch(() => {});
      }
    });
  }

  setupWeatherModelListener() {
    window.addEventListener('weatherModelChanged', async (event) => {
      const model = event?.detail?.model || localStorage.getItem('weather_model') || 'ecmwf_ifs025';
      console.log('[AppController] 天气模型已切换:', model);
      if (!this.currentLocation || !this.weatherController) return;

      try {
        const weatherData = await this.weatherController.fetchWeather(this.currentLocation, true);
        this.currentWeatherData = weatherData;
        this.weatherController.updateWeatherDisplay(weatherData, this.currentLocation);
        this.weatherController.renderWeeklyOverview(weatherData);
      } catch (error) {
        console.error('[AppController] 切换天气模型后刷新失败:', error);
      }
    });
  }

  /**
   * 监听火烧云渲染模式切换（任务 64.14）
   * 设置面板切换 china_render_mode 后重建 overlay manager 并重渲染
   */
  setupChinaRenderModeListener() {
    window.addEventListener('chinaRenderModeChanged', async (event) => {
      const mode = event?.detail?.mode || localStorage.getItem('china_render_mode') || 'raster';
      console.log('[AppController] 火烧云渲染模式已切换:', mode);

      if (!this.weatherController) return;

      try {
        // 销毁旧 overlay manager（清除地图图层）
        if (this.weatherController.chinaSpotsOverlayManager) {
          this.weatherController.chinaSpotsOverlayManager.destroy?.();
        }

        // 重建 manager（根据新 flag）
        const { createChinaOverlayManager } = await import('./WeatherController.js');
        this.weatherController.chinaSpotsOverlayManager = createChinaOverlayManager();
        this.weatherController.chinaSpotsOverlay = null;

        // 若地图已初始化，重新挂载
        if (this.weatherController._chinaSpotsMapInstance) {
          await this.weatherController._initChinaSpotsMap();
        }

        console.log('[AppController] 火烧云覆盖层已切换为:', mode);
      } catch (err) {
        console.error('[AppController] 切换火烧云渲染模式失败:', err);
      }
    });
  }

  /**
   * 刷新界面文本（语言切换后）
   * 需求：14 - 多语言支持
   * @private
   */
  refreshUIText() {
    console.log('[AppController] 刷新界面文本...');

    // 更新应用标题
    const appTitle = document.querySelector('header h1');
    if (appTitle) {
      appTitle.textContent = this.i18n.t('app.title');
    }

    // 更新页面标题
    document.title = this.i18n.t('app.title');

    // 更新HTML中的静态文本
    this.updateStaticText();

    // 通知子控制器刷新文本
    if (this.weatherController && typeof this.weatherController.refreshUIText === 'function') {
      this.weatherController.refreshUIText();
    }

    if (this.predictionController && typeof this.predictionController.refreshUIText === 'function') {
      this.predictionController.refreshUIText();
    }
  }

  /**
   * 更新HTML中的静态文本
   * 需求：14 - 多语言支持
   * @private
   */
  updateStaticText() {
    // 处理所有带有data-i18n属性的元素
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const key = element.getAttribute('data-i18n');
      try {
        element.textContent = this.i18n.t(key);
      } catch (error) {
        console.warn(`[AppController] 翻译失败 "${key}":`, error.message);
      }
    });

    // 处理placeholder属性
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
      const key = element.getAttribute('data-i18n-placeholder');
      try {
        element.placeholder = this.i18n.t(key);
      } catch (error) {
        console.warn(`[AppController] 翻译placeholder失败 "${key}":`, error.message);
      }
    });

    // 处理aria-label属性
    document.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
      const key = element.getAttribute('data-i18n-aria-label');
      try {
        element.setAttribute('aria-label', this.i18n.t(key));
      } catch (error) {
        console.warn(`[AppController] 翻译aria-label失败 "${key}":`, error.message);
      }
    });

    // 特殊处理：带emoji前缀的按钮
    const emojiButtons = [
      { selector: '#favorite-locations h3', content: '⭐ ', key: 'favorites.title' },
      { selector: '#refresh-btn', content: '🔄 ', key: 'buttons.refresh' }
    ];

    emojiButtons.forEach(({ selector, content, key }) => {
      const element = document.querySelector(selector);
      if (element) {
        try {
          element.textContent = content + this.i18n.t(key);
        } catch (error) {
          console.warn(`[AppController] 翻译按钮失败 "${key}":`, error.message);
        }
      }
    });
  }
}

export default AppController;
