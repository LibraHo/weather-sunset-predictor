/**
 * SettingsPanel - 统一设置面板组件
 *
 * 提供集中化的设置界面，管理应用的所有配置项
 */

import i18n from '../i18n.js';
import GeocodingServiceFactory from '../services/GeocodingServiceFactory.js';

class SettingsPanel {
  constructor(storageService, themeService) {
    this.panel = null;
    this.isOpen = false;
    this.i18n = i18n;
    this.storageService = storageService;
    this.themeService = themeService;
  }

  /**
   * 初始化设置面板
   */
  async init() {
    // 等待 i18n 初始化完成
    if (!this.i18n.currentLanguage) {
      await this.i18n.init();
    }
    // 不在这里创建面板，而是在第一次打开时创建
    // 这样可以确保使用当前语言
  }

  /**
   * 创建设置面板 DOM
   */
  createPanel() {
    // 创建面板容器
    const panel = document.createElement('div');
    panel.id = 'settings-panel';
    panel.className = 'settings-panel hidden';
    panel.innerHTML = `
      <div class="settings-overlay"></div>
      <div class="settings-container">
        <div class="settings-header">
          <h2>⚙️ ${this.i18n.t('settings.title')}</h2>
          <button class="settings-close" aria-label="${this.i18n.t('settings.close')}">✕</button>
        </div>

        <div class="settings-content">

          <!-- 🌐 语言与显示 -->
          <div class="settings-section">
            <h3 class="settings-section-title">🌐 ${this.i18n.t('settings.languageAndDisplay')}</h3>
            <div class="settings-section-content">
              <div class="setting-item">
                <label class="setting-label">${this.i18n.t('settings.interfaceLanguage')}</label>
                <div class="setting-control">
                  <select id="language-select" class="setting-select">
                    ${this.getLanguageOptions()}
                  </select>
                </div>
              </div>
              <div class="setting-item">
                <label class="setting-label">${this.i18n.t('settings.themeMode')}</label>
                <div class="setting-control">
                  <select id="theme-select" class="setting-select">
                    <option value="light">${this.i18n.t('settings.themeLight')}</option>
                    <option value="dark">${this.i18n.t('settings.themeDark')}</option>
                    <option value="auto">${this.i18n.t('settings.themeAuto')}</option>
                  </select>
                </div>
              </div>
              <div class="setting-item">
                <label class="setting-label">${this.i18n.t('settings.temperatureUnit')}</label>
                <div class="setting-control">
                  <select id="temp-unit-select" class="setting-select">
                    <option value="celsius">${this.i18n.t('settings.tempCelsius')}</option>
                    <option value="fahrenheit">${this.i18n.t('settings.tempFahrenheit')}</option>
                  </select>
                </div>
              </div>
              <div class="setting-item">
                <label class="setting-label">${this.i18n.t('settings.windSpeedUnit')}</label>
                <div class="setting-control">
                  <select id="wind-unit-select" class="setting-select">
                    <option value="kmh">${this.i18n.t('settings.windKmh')}</option>
                    <option value="ms">${this.i18n.t('settings.windMs')}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <hr class="settings-section-divider" />

          <!-- ⭐ 默认位置 -->
          <div class="settings-section">
            <h3 class="settings-section-title">⭐ ${this.i18n.t('settings.defaultLocation')}</h3>
            <div class="settings-section-content">
              <div class="setting-item setting-item-default-location">
                <div class="setting-row setting-row-between">
                  <span id="default-location-display" class="setting-default-location-value setting-default-location-empty">${this.i18n.t('settings.noDefaultLocation')}</span>
                </div>
                <div id="default-location-list" class="default-location-list"></div>
                <small class="setting-hint">${this.i18n.t('settings.defaultLocationHint')}</small>
              </div>
            </div>
          </div>

          <hr class="settings-section-divider" />

          <!-- 📍 位置解析 -->
          <div class="settings-section">
            <h3 class="settings-section-title">📍 ${this.i18n.t('settings.geocodingService')}</h3>
            <div class="settings-section-content">
              <div class="setting-item">
                <label class="setting-label" for="geocoding-provider-select">${this.i18n.t('settings.geocodingProvider')}</label>
                <div class="setting-control">
                  <select id="geocoding-provider-select" class="setting-select">
                    ${this.getGeocodingProviderOptions()}
                  </select>
                </div>
              </div>

            </div>
          </div>

          <hr class="settings-section-divider" />

          <!-- 🔑 Windy API -->
          <div class="settings-section">
            <h3 class="settings-section-title">🔑 ${this.i18n.t('settings.windyApiKeyMode')}</h3>
            <div class="settings-section-content">
              <div class="setting-item">
                <div class="setting-control">
                  <div class="setting-radio-group">
                    <label class="setting-radio-label">
                      <input type="radio" name="windy-api-mode" value="system" id="windy-api-system" />
                      ${this.i18n.t('settings.windyApiKeyModeSystem')}
                    </label>
                    <label class="setting-radio-label">
                      <input type="radio" name="windy-api-mode" value="custom" id="windy-api-custom" />
                      ${this.i18n.t('settings.windyApiKeyModeCustom')}
                    </label>
                  </div>
                </div>
              </div>
              <div id="windy-api-key-section" style="display:none">
                <div class="setting-item">
                  <label class="setting-label" for="windy-api-key-input">${this.i18n.t('settings.windyApiKeyCustom')}</label>
                  <div class="setting-control">
                    <input type="password" id="windy-api-key-input" class="setting-input"
                      placeholder="${this.i18n.t('settings.windyApiKeyCustomPlaceholder')}" />
                    <small class="setting-hint">${this.i18n.t('settings.windyApiKeyCustomHint')}</small>
                    <span id="windy-api-key-error" class="setting-error" style="display:none;color:var(--color-error,#e53935);font-size:12px;"></span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <hr class="settings-section-divider" />

          <!-- 🔔 通知与提醒 -->
          <div class="settings-section">
            <h3 class="settings-section-title">🔔 ${this.i18n.t('settings.notificationAndAlerts')}</h3>
            <div class="settings-section-content">
              <div class="setting-item setting-item-toggle">
                <div class="setting-row setting-row-between">
                  <div class="setting-text-block">
                    <label class="setting-label setting-label-title" for="notification-enabled">${this.i18n.t('settings.enableSunsetNotification')}</label>
                    <small class="setting-subtitle">${this.i18n.t('settings.notificationHint')}</small>
                  </div>
                  <label class="setting-switch" for="notification-enabled">
                    <input type="checkbox" id="notification-enabled" class="setting-checkbox" />
                    <span class="setting-switch-slider" aria-hidden="true"></span>
                  </label>
                </div>
              </div>
              <div class="setting-item">
                <label class="setting-label">${this.i18n.t('settings.notificationThresholdLabel')}</label>
                <div class="setting-control">
                  <input type="range" id="notification-threshold" class="setting-range" min="0" max="100" step="5" value="70" />
                  <span id="threshold-value" class="setting-value">70</span>
                </div>
                <small class="setting-hint">${this.i18n.t('settings.notificationThresholdHint')}</small>
              </div>
            </div>
          </div>

          <hr class="settings-section-divider" />

          <!-- ⚙️ 高级 -->
          <details class="settings-section settings-advanced">
            <summary class="settings-section-title settings-advanced-toggle">⚙️ ${this.i18n.t('settings.dataSource')}</summary>
            <div class="settings-section-content">
              <div class="setting-item">
                <label class="setting-label setting-label-title" for="proxy-url-input">${this.i18n.t('settings.proxyUrl')}</label>
                <small class="setting-subtitle">${this.i18n.t('settings.proxyUrlHint')}</small>
                <div class="setting-control setting-control-full">
                  <input type="text" id="proxy-url-input" class="setting-input"
                    placeholder="${this.i18n.t('settings.proxyUrlPlaceholder')}"
                    value="http://localhost:3000" />
                </div>
              </div>
            </div>
          </details>

        </div>

        <div class="settings-footer">
          <button class="settings-close btn-primary">${this.i18n.t('settings.done')}</button>
        </div>
      </div>
    `;

    document.body.appendChild(panel);
    this.panel = panel;
  }

  /**
   * 返回地理编码提供商选项 HTML（后端代理模式）
   * 需求：24
   * @returns {string}
   */
  getGeocodingProviderOptions() {
    return GeocodingServiceFactory.getOptions()
      .map(o => `<option value="${o.provider}">${this.i18n.t(o.labelKey)}</option>`)
      .join('');
  }

  /**
   * 获取语言选项HTML
   */
  getLanguageOptions() {
    const languages = this.i18n.supportedLanguages;
    return Object.entries(languages)
      .map(([code, info]) => `<option value="${code}">${info.name}</option>`)
      .join('');
  }

  /**
   * 绑定事件监听器
   */
  attachEventListeners() {
    // 关闭按钮
    const closeButtons = this.panel.querySelectorAll('.settings-close');
    closeButtons.forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });

    // 点击遮罩关闭
    const overlay = this.panel.querySelector('.settings-overlay');
    overlay.addEventListener('click', () => this.close());

    // 代理 URL 输入
    const proxyUrlInput = document.getElementById('proxy-url-input');
    if (proxyUrlInput) {
      proxyUrlInput.addEventListener('change', (e) => {
        this.handleProxyUrlChange(e.target.value);
      });
    }

    // 通知设置
    const notificationEnabled = document.getElementById('notification-enabled');
    if (notificationEnabled) {
      notificationEnabled.addEventListener('change', (e) => {
        this.handleNotificationChange(e.target.checked);
      });
    }

    const notificationThreshold = document.getElementById('notification-threshold');
    if (notificationThreshold) {
      notificationThreshold.addEventListener('input', (e) => {
        document.getElementById('threshold-value').textContent = e.target.value;
        this.handleThresholdChange(e.target.value);
      });
    }

    // 语言切换
    const languageSelect = document.getElementById('language-select');
    if (languageSelect) {
      languageSelect.addEventListener('change', (e) => {
        this.handleLanguageChange(e.target.value);
      });
    }

    // 主题切换
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
      themeSelect.addEventListener('change', (e) => {
        this.handleThemeChange(e.target.value);
      });
    }

    // 单位切换
    const tempUnitSelect = document.getElementById('temp-unit-select');
    if (tempUnitSelect) {
      tempUnitSelect.addEventListener('change', (e) => {
        this.handleTempUnitChange(e.target.value);
      });
    }

    const windUnitSelect = document.getElementById('wind-unit-select');
    if (windUnitSelect) {
      windUnitSelect.addEventListener('change', (e) => {
        this.handleWindUnitChange(e.target.value);
      });
    }

    // 位置解析提供商（需求 24）
    const geocodingProviderSelect = document.getElementById('geocoding-provider-select');
    if (geocodingProviderSelect) {
      geocodingProviderSelect.addEventListener('change', (e) => {
        this.handleGeocodingProviderChange(e.target.value);
      });
    }

    const geocodingApiKeyInput = document.getElementById('geocoding-api-key-input');
    if (geocodingApiKeyInput) {
      geocodingApiKeyInput.addEventListener('change', (e) => {
        this.handleGeocodingApiKeyChange(e.target.value);
      });
    }

    // Windy API Key 模式（需求 25）
    const windyApiModeRadios = this.panel.querySelectorAll('input[name="windy-api-mode"]');
    windyApiModeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.handleWindyApiModeChange(e.target.value);
      });
    });

    const windyApiKeyInput = document.getElementById('windy-api-key-input');
    if (windyApiKeyInput) {
      windyApiKeyInput.addEventListener('change', (e) => {
        this.handleWindyApiKeyChange(e.target.value);
      });
    }
  }

  /**
   * 加载设置
   */
  loadSettings() {
    // 加载代理 URL
    const proxyUrl = localStorage.getItem('api_proxy_url') || 'http://localhost:3000';
    const proxyUrlInput = document.getElementById('proxy-url-input');
    if (proxyUrlInput) {
      proxyUrlInput.value = proxyUrl;
    }

    // 加载通知设置
    const notificationSettings = JSON.parse(localStorage.getItem('notification_settings') || '{}');
    const notificationEnabled = document.getElementById('notification-enabled');
    const notificationThreshold = document.getElementById('notification-threshold');
    const thresholdValue = document.getElementById('threshold-value');

    if (notificationEnabled) {
      notificationEnabled.checked = notificationSettings.enabled || false;
    }
    if (notificationThreshold) {
      notificationThreshold.value = notificationSettings.threshold || 70;
    }
    if (thresholdValue) {
      thresholdValue.textContent = notificationSettings.threshold || 70;
    }

    // 加载语言设置
    const currentLang = this.i18n.getLanguage();
    const languageSelect = document.getElementById('language-select');
    if (languageSelect) {
      languageSelect.value = currentLang;
    }

    // 加载主题设置
    const theme = this.themeService.getTheme();
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
      themeSelect.value = theme;
    }

    // 加载温度单位
    const tempUnit = localStorage.getItem('temp_unit') || 'celsius';
    const tempUnitSelect = document.getElementById('temp-unit-select');
    if (tempUnitSelect) {
      tempUnitSelect.value = tempUnit;
    }

    // 加载风速单位
    const windUnit = localStorage.getItem('wind_unit') || 'kmh';
    const windUnitSelect = document.getElementById('wind-unit-select');
    if (windUnitSelect) {
      windUnitSelect.value = windUnit;
    }

    // 任务17.3：加载默认位置
    this.loadDefaultLocation();

    // 加载位置解析服务设置（需求 24）
    this.loadGeocodingSettings();

    // 加载 Windy API Key 设置（需求 25）
    this.loadWindyApiKeySettings();
  }

  /**
   * 任务17.3：加载并显示默认位置
   */
  loadDefaultLocation() {
    // 显示当前默认位置
    const defaultLocation = this.storageService.getDefaultLocation();
    const defaultLocationDisplay = document.getElementById('default-location-display');
    if (defaultLocationDisplay) {
      if (defaultLocation) {
        defaultLocationDisplay.textContent = `⭐ ${defaultLocation.name}`;
        defaultLocationDisplay.classList.remove('setting-default-location-empty');
      } else {
        defaultLocationDisplay.textContent = this.i18n.t('settings.noDefaultLocation');
        defaultLocationDisplay.classList.add('setting-default-location-empty');
      }
    }

    // 渲染收藏位置列表
    this.renderFavoriteLocationsList();
  }

  /**
   * 任务17.3：渲染收藏位置列表，每个位置带有"设为默认"按钮
   */
  renderFavoriteLocationsList() {
    const container = document.getElementById('default-location-list');
    if (!container) {
      return;
    }

    const favorites = this.storageService.getFavoriteLocations();

    if (favorites.length === 0) {
      container.innerHTML = '';
      return;
    }

    // 获取当前默认位置
    const defaultLocation = this.storageService.getDefaultLocation();

    // 渲染位置列表
    container.innerHTML = favorites.map((fav, index) => {
      const isDefault = defaultLocation &&
        Math.abs(fav.lat - defaultLocation.lat) < 0.001 &&
        Math.abs(fav.lon - defaultLocation.lon) < 0.001;

      return `
        <div class="favorite-location-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-top: 1px solid var(--border-color, #e0e0e0);">
          <span style="flex: 1;">${fav.name}</span>
          ${isDefault
            ? `<span style="color: var(--accent-color, #4CAF50); font-size: 12px;">⭐ ${this.i18n.t('settings.currentDefaultLocation')}</span>`
            : `<button class="set-default-btn" data-index="${index}" style="
                padding: 4px 12px;
                background: transparent;
                border: 1px solid var(--accent-color, #4CAF50);
                color: var(--accent-color, #4CAF50);
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.2s;
              ">${this.i18n.t('settings.setAsDefault')}</button>`
          }
        </div>
      `;
    }).join('');

    // 绑定"设为默认"按钮事件
    container.querySelectorAll('.set-default-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        this.handleSetDefaultLocation(index);
      });
    });

    // 添加按钮悬停效果
    const style = document.createElement('style');
    style.textContent = `
      .set-default-btn:hover {
        background: var(--accent-color, #4CAF50) !important;
        color: white !important;
      }
    `;
    if (!document.querySelector('style[data-settings-panel-default-loc]')) {
      style.setAttribute('data-settings-panel-default-loc', 'true');
      document.head.appendChild(style);
    }
  }

  /**
   * 任务17.3：处理设置默认位置
   */
  handleSetDefaultLocation(favoriteIndex) {
    const favorites = this.storageService.getFavoriteLocations();
    if (!favorites[favoriteIndex]) {
      console.warn('[SettingsPanel] 无效的收藏位置索引:', favoriteIndex);
      return;
    }

    const location = favorites[favoriteIndex];
    const success = this.storageService.saveDefaultLocation(location);

    if (success) {
      console.log('[SettingsPanel] 默认位置已设置:', location.name);
      // 重新加载默认位置显示
      this.loadDefaultLocation();
    } else {
      console.error('[SettingsPanel] 设置默认位置失败');
    }
  }

  /**
   * 打开设置面板
   */
  open() {
    // 如果面板还没有创建，或者语言已改变，则重新创建
    const currentLang = this.i18n.getLanguage();
    if (!this.panel || this.lastLanguage !== currentLang) {
      if (this.panel) {
        this.panel.remove();
      }
      this.createPanel();
      this.attachEventListeners();
      this.lastLanguage = currentLang;
    }

    this.panel.classList.remove('hidden');
    this.isOpen = true;
    this.loadSettings();
  }

  /**
   * 关闭设置面板
   */
  close() {
    this.panel.classList.add('hidden');
    this.isOpen = false;
  }

  /**
   * 切换设置面板
   */
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * 刷新所有翻译文本（当语言切换时调用）
   */
  async refreshTranslations() {
    // 重新创建面板以应用新语言
    if (this.panel) {
      this.panel.remove();
    }
    await this.createPanel();
    this.attachEventListeners();
    this.loadSettings();
  }

  /**
   * 处理代理 URL 变更
   */
  handleProxyUrlChange(url) {
    localStorage.setItem('api_proxy_url', url);
    console.log('[SettingsPanel] 代理 URL 已更新:', url);
  }

  /**
   * 处理通知开关变更
   */
  handleNotificationChange(enabled) {
    const settings = {
      enabled: enabled,
      threshold: parseInt(document.getElementById('notification-threshold').value)
    };
    localStorage.setItem('notification_settings', JSON.stringify(settings));
    console.log('[SettingsPanel] 通知设置已更新:', settings);
  }

  /**
   * 处理通知阈值变更
   */
  handleThresholdChange(threshold) {
    const settings = JSON.parse(localStorage.getItem('notification_settings') || '{}');
    settings.threshold = parseInt(threshold);
    localStorage.setItem('notification_settings', JSON.stringify(settings));
  }

  /**
   * 处理语言变更
   */
  async handleLanguageChange(lang) {
    console.log('[SettingsPanel] 语言已切换为:', lang);

    // 使用 i18n 系统切换语言
    await this.i18n.changeLanguage(lang);

    // 刷新设置面板的翻译，并确保保持打开状态
    await this.refreshTranslations();

    // 重新打开面板（因为 refreshTranslations 会关闭面板）
    this.panel.classList.remove('hidden');
    this.isOpen = true;

    // 重新加载设置以更新语言选择器
    this.loadSettings();

    // 触发自定义事件，通知其他组件语言已更改
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));
  }

  /**
   * 处理主题变更
   */
  handleThemeChange(theme) {
    // 使用ThemeService设置主题
    this.themeService.setTheme(theme);

    // 触发自定义事件，通知 AppController 主题已更改
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));

    console.log('[SettingsPanel] 主题已切换为:', theme);
  }

  /**
   * 应用主题（用于实时预览）
   * 注意：现在使用ThemeService，此方法保留用于兼容性，但已不再需要
   */
  applyTheme(theme) {
    // 使用ThemeService应用主题
    this.themeService.setTheme(theme);
  }

  /**
   * 处理温度单位变更
   */
  handleTempUnitChange(unit) {
    localStorage.setItem('temp_unit', unit);
    console.log('[SettingsPanel] 温度单位已切换为:', unit);

    // 触发自定义事件，通知 WeatherController 刷新数据
    window.dispatchEvent(new CustomEvent('temperatureUnitChanged', { detail: { unit } }));
  }

  /**
   * 处理风速单位变更
   */
  handleWindUnitChange(unit) {
    localStorage.setItem('wind_unit', unit);
    console.log('[SettingsPanel] 风速单位已切换为:', unit);

    // 触发自定义事件，通知 WeatherController 刷新数据
    window.dispatchEvent(new CustomEvent('windUnitChanged', { detail: { unit } }));
  }

  // ========== 位置解析服务（需求 24）==========

  /**
   * 加载位置解析服务设置，恢复控件状态
   */
  loadGeocodingSettings() {
    const provider = localStorage.getItem('geocoding_provider') || 'nominatim';
    const apiKey = localStorage.getItem('geocoding_api_key') || '';

    const providerSelect = document.getElementById('geocoding-provider-select');
    if (providerSelect) providerSelect.value = provider;

    const apiKeyInput = document.getElementById('geocoding-api-key-input');
    if (apiKeyInput) apiKeyInput.value = apiKey;

    this.updateGeocodingApiKeyVisibility(providerSelect ? providerSelect.value : provider);
  }

  /**
   * 根据所选提供商决定是否显示 API Key 输入框
   * @param {string} provider
   */
  updateGeocodingApiKeyVisibility(provider) {
    const section = document.getElementById('geocoding-api-key-section');
    if (!section) return;

    const opt = GeocodingServiceFactory.getOptions().find(o => o.provider === provider);
    const needsKey = opt ? opt.requiresKey : false;
    section.style.display = needsKey ? '' : 'none';

    const hint = document.getElementById('geocoding-api-key-hint');
    if (hint) hint.textContent = this.i18n.t('settings.geocodingApiKeyHint');
  }

  /**
   * 处理地理编码提供商变更
   * @param {string} provider
   */
  handleGeocodingProviderChange(provider) {
    localStorage.setItem('geocoding_provider', provider);
    this.updateGeocodingApiKeyVisibility(provider);
    console.log('[SettingsPanel] 地理编码提供商已切换为:', provider);
    this.dispatchGeocodingSettingChanged(provider, localStorage.getItem('geocoding_api_key') || '');
  }

  /**
   * 处理地理编码 API Key 变更
   * @param {string} apiKey
   */
  handleGeocodingApiKeyChange(apiKey) {
    const trimmed = apiKey.trim();
    localStorage.setItem('geocoding_api_key', trimmed);
    console.log('[SettingsPanel] 地理编码 API Key 已更新');
    this.dispatchGeocodingSettingChanged(localStorage.getItem('geocoding_provider') || 'nominatim', trimmed);
  }

  /**
   * 触发 geocodingSettingChanged 自定义事件
   * @param {string} provider
   * @param {string} apiKey
   */
  dispatchGeocodingSettingChanged(provider, apiKey) {
    window.dispatchEvent(new CustomEvent('geocodingSettingChanged', {
      detail: { provider, apiKey }
    }));
  }

  // ========== Windy API Key（需求 25）==========

  /**
   * 加载 Windy API Key 设置，恢复控件状态
   */
  loadWindyApiKeySettings() {
    const userKey = localStorage.getItem('user_windy_api_key') || '';
    const mode = userKey ? 'custom' : 'system';

    const modeRadio = this.panel.querySelector(`input[name="windy-api-mode"][value="${mode}"]`);
    if (modeRadio) modeRadio.checked = true;

    const keySection = document.getElementById('windy-api-key-section');
    if (keySection) keySection.style.display = mode === 'custom' ? '' : 'none';

    const keyInput = document.getElementById('windy-api-key-input');
    if (keyInput) keyInput.value = userKey;
  }

  /**
   * 处理 Windy API 模式变更（system / custom）
   * @param {string} mode
   */
  handleWindyApiModeChange(mode) {
    const keySection = document.getElementById('windy-api-key-section');
    if (keySection) keySection.style.display = mode === 'custom' ? '' : 'none';

    if (mode === 'system') {
      // 清除用户自定义 Key
      localStorage.removeItem('user_windy_api_key');
      const keyInput = document.getElementById('windy-api-key-input');
      if (keyInput) keyInput.value = '';
      const errorEl = document.getElementById('windy-api-key-error');
      if (errorEl) errorEl.style.display = 'none';
    }

    console.log('[SettingsPanel] Windy API 模式已切换为:', mode);
  }

  /**
   * 处理 Windy API Key 输入变更（格式校验 + 保存）
   * @param {string} key
   */
  handleWindyApiKeyChange(key) {
    const trimmed = key.trim();
    const errorEl = document.getElementById('windy-api-key-error');

    if (trimmed && trimmed.length <= 8) {
      // 格式无效
      if (errorEl) {
        errorEl.textContent = this.i18n.t('settings.windyApiKeyInvalid');
        errorEl.style.display = '';
      }
      return;
    }

    if (errorEl) errorEl.style.display = 'none';

    if (trimmed) {
      localStorage.setItem('user_windy_api_key', trimmed);
      console.log('[SettingsPanel] 用户 Windy API Key 已保存');
    } else {
      localStorage.removeItem('user_windy_api_key');
      console.log('[SettingsPanel] 用户 Windy API Key 已清除');
    }
  }
}

export default SettingsPanel;
