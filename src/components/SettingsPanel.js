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


  _isEnglishUI() {
    const lang = this.i18n?.getCurrentLanguage ? this.i18n.getCurrentLanguage() : this.i18n?.currentLanguage;
    return String(lang || '').toLowerCase().startsWith('en');
  }

  _uiText(en, zh) {
    return this._isEnglishUI() ? en : zh;
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

          <!-- 🗺️ 地图底图 -->
          <div class="settings-section">
            <h3 class="settings-section-title">🗺️ ${this.i18n.t('settings.mapTileProvider') || this._uiText('Map Basemap', '地图底图')}</h3>
            <div class="settings-section-content">
              <div class="setting-item">
                <label class="setting-label" for="firecloud-raster-color-mode-select">🔥 ${this._uiText('Fire cloud overlay color mode', '火烧云涂层颜色模式')}</label>
                <select id="firecloud-raster-color-mode-select" class="setting-select">
                  <option value="compact">${this._uiText('Compact: color starts above 40 pts', '精简：40 分以上开始染色')}</option>
                  <option value="full">${this._uiText('Full: color starts above 30 pts', '完整：30 分以上开始染色')}</option>
                </select>
                <small class="setting-hint">${this._uiText('Changing this refreshes the fire-cloud map overlay and legend', '切换后会刷新火烧云地图涂层和图例')}</small>
              </div>
            </div>
          </div>

          <hr class="settings-section-divider" />

          <!-- ☁️ 天气数据源 -->
          <div class="settings-section">
            <h3 class="settings-section-title">☁️ ${this.i18n.t('settings.weatherProvider')}</h3>
            <div class="settings-section-content">
              <div class="setting-item">
                <label class="setting-label" for="weather-model-select">${this._uiText('Weather model', '天气模型')}</label>
                <select id="weather-model-select" class="setting-select">
                  <option value="ecmwf_ifs025">ECMWF IFS 025 ${this._uiText('(Recommended)', '（推荐）')}</option>
                  <option value="gfs_seamless">GFS Seamless</option>
                  <option value="best_match">Best Match ${this._uiText('(Auto)', '（自动）')}</option>
                </select>
                <small class="setting-hint">${this._uiText('Changing this refreshes weather data automatically', '切换后会自动刷新天气数据')}</small>
              </div>
              <div class="setting-item readonly-info">
                <div class="info-row">
                  <span class="info-label">${this.i18n.t('settings.providerCurrent')}:</span>
                  <span class="info-value" id="provider-current">-</span>
                </div>
                <div class="info-row">
                  <span class="info-label">${this.i18n.t('settings.providerQuality')}:</span>
                  <span class="info-value" id="provider-quality">-</span>
                </div>
                <div class="info-row">
                  <span class="info-label">${this.i18n.t('settings.providerUpdateTime')}:</span>
                  <span class="info-value" id="provider-update-time">-</span>
                </div>
                <div id="provider-issues-container" style="display:none; margin-top: 8px;">
                  <small class="setting-hint" style="color: var(--color-warning, #f59e0b);" id="provider-issues">-</small>
                </div>
              </div>
            </div>
          </div>

          <!-- Phase15 任务63.3：Windy API Key（默认隐藏，ENABLE_WINDY=true 时显示） -->
          <div id="windy-key-section" style="display:none;">
            <hr class="settings-section-divider" />
            <div class="settings-section">
              <h3 class="settings-section-title">🌬️ Windy API Key</h3>
              <div class="settings-section-content">
                <div class="setting-item">
                  <label class="setting-label" for="windy-api-key-input">${this.i18n.t('settings.windyApiKey') || 'Windy API Key'}</label>
                  <input type="password" id="windy-api-key-input" class="setting-input"
                    placeholder="${this.i18n.t('settings.windyApiKeyPlaceholder') || this._uiText('Enter your Windy API Key', '输入你的 Windy API Key')}"
                    value="${localStorage.getItem('user_windy_api_key') || ''}" />
                  <small class="setting-hint">${this.i18n.t('settings.windyApiKeyHint') || this._uiText('Used to enable Windy data source. Leave empty to use the system default.', '用于启用 Windy 数据源，留空使用系统默认')}</small>
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

    const weatherModelSelect = document.getElementById('weather-model-select');
    if (weatherModelSelect) {
      weatherModelSelect.value = localStorage.getItem('weather_model') || 'ecmwf_ifs025';
      weatherModelSelect.addEventListener('change', (e) => {
        localStorage.setItem('weather_model', e.target.value);
        window.dispatchEvent(new CustomEvent('weatherModelChanged', { detail: { model: e.target.value } }));
      });
    }

    const rasterColorModeSelect = document.getElementById('firecloud-raster-color-mode-select');
    if (rasterColorModeSelect) {
      rasterColorModeSelect.value = localStorage.getItem('firecloud_raster_color_mode') || 'compact';
      rasterColorModeSelect.addEventListener('change', (e) => {
        localStorage.setItem('firecloud_raster_color_mode', e.target.value);
        window.dispatchEvent(new CustomEvent('firecloudRasterColorModeChanged', { detail: { mode: e.target.value } }));
      });
    }

    // 天气数据源状态 (任务 44)
    this.updateProviderStatus();

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

    // 加载${this._uiText('Weather model', '天气模型')}设置
    const weatherModelSelect = document.getElementById('weather-model-select');
    if (weatherModelSelect) {
      weatherModelSelect.value = localStorage.getItem('weather_model') || 'ecmwf_ifs025';
    }

    const rasterColorModeSelect = document.getElementById('firecloud-raster-color-mode-select');
    if (rasterColorModeSelect) {
      rasterColorModeSelect.value = localStorage.getItem('firecloud_raster_color_mode') || 'compact';
    }

    // 任务17.3：加载默认位置
    this.loadDefaultLocation();

    // 加载位置解析服务设置（需求 24）
    this.loadGeocodingSettings();

    // 任务52.2：一次性清理历史 Windy Key 存储
    this.migrateLegacyWindyStorage();
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
   * Phase15 任务63.3：从后端获取 feature flags
   */
  async _fetchFeatureFlags() {
    try {
      const proxyURL = localStorage.getItem('proxy_url') || '';
      const base = proxyURL.replace(/\/$/, '');
      const resp = await fetch(`${base}/api/config/features`);
      if (resp.ok) {
        this._featureFlags = await resp.json();
      }
    } catch (e) {
      // 网络失败时保持默认（windyEnabled=false）
      this._featureFlags = this._featureFlags || { windyEnabled: false };
    }
  }

  /**
   * Phase15 任务63.3：根据 windyEnabled flag 控制 Windy Key UI 显隐
   */
  _applyWindyUIVisibility() {
    const windySection = this.panel?.querySelector('#windy-key-section');
    if (!windySection) return;
    const enabled = this._featureFlags?.windyEnabled === true;
    windySection.style.display = enabled ? '' : 'none';
  }

  /**
   * 打开设置面板
   */
  async open() {
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

    // Phase15 任务63.3：获取 feature flags 并更新 UI
    await this._fetchFeatureFlags();
    this._applyWindyUIVisibility();
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
    // 使用ThemeService设置主题；ThemeService 会负责派发包含 actualTheme 的 themeChanged 事件。
    // 不要在这里重复派发事件，否则 Safari 下可能出现第二个缺少 actualTheme 的事件覆盖状态。
    this.themeService.setTheme(theme);

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

  /**
   * 任务52.2：一次性清理历史 Windy API Key 本地存储
   */
  migrateLegacyWindyStorage() {
    if (localStorage.getItem('windy_storage_migrated_v1') === 'true') {
      return;
    }

    [
      'user_windy_api_key',
      'windy_api_key',
      'windy_api_mode',
      'windyApiKeyMode',
      'windyApiKeyModeV2'
    ].forEach((k) => localStorage.removeItem(k));

    localStorage.setItem('windy_storage_migrated_v1', 'true');
  }

  /**
   * 更新天气数据源状态信息
   */
  updateProviderStatus() {
    const providerCurrentEl = document.getElementById('provider-current');
    const providerQualityEl = document.getElementById('provider-quality');
    const providerUpdateTimeEl = document.getElementById('provider-update-time');
    const providerIssuesEl = document.getElementById('provider-issues-container');

    if (!providerCurrentEl || !providerQualityEl || !providerUpdateTimeEl || !providerIssuesEl) {
      return;
    }

    // 从回调或全局 weatherController 获取 providerMeta
    const meta = (typeof this._getProviderMeta === 'function' && this._getProviderMeta()) ||
                 window._weatherController?.currentWeatherData?.providerMeta ||
                 this.appState?.weatherData?.providerMeta;

    if (!meta) {
      providerCurrentEl.textContent = 'Open-Meteo';
      providerQualityEl.textContent = '-';
      providerUpdateTimeEl.textContent = '-';
      providerIssuesEl.style.display = 'none';
      return;
    }

    // 数据源名称：优先显示 cloudSource，fallback 到 name
    providerCurrentEl.textContent = meta.cloudSource || meta.name || 'Open-Meteo';
    const qualityMap = {
      excellent: this.i18n.t('settings.providerStatusExcellent'),
      standard: this.i18n.t('settings.providerStatusStandard'),
      degraded: this.i18n.t('settings.providerStatusDegraded')
    };
    const q = meta.sequenceQuality || meta.dataQuality;
    providerQualityEl.textContent = qualityMap[q] || q || '-';
    providerUpdateTimeEl.textContent = new Date().toLocaleTimeString();

    const issues = meta.unsupportedFields || [];
    const degradedReasons = meta.degradedReason || [];

    if (issues.length > 0 || degradedReasons.length > 0) {
      providerIssuesEl.style.display = 'block';
      const issueTexts = [];
      if (issues.length > 0) issueTexts.push(`不支持字段: ${issues.join(', ')}`);
      if (degradedReasons.length > 0) issueTexts.push(degradedReasons.join('; '));
      const issueSmall = providerIssuesEl.querySelector('small');
      if (issueSmall) issueSmall.textContent = issueTexts.join(' | ');
    } else {
      providerIssuesEl.style.display = 'none';
    }
  }
}

export default SettingsPanel;
