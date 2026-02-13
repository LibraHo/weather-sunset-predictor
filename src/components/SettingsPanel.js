/**
 * SettingsPanel - 统一设置面板组件
 *
 * 提供集中化的设置界面，管理应用的所有配置项
 */

import i18n from '../i18n.js';

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
          <!-- 数据源与网络 -->
          <div class="settings-section" data-section="dataSource">
            <h3 class="settings-section-title">📡 ${this.i18n.t('settings.dataSource')}</h3>
            <div class="settings-section-content">
              <div class="setting-item" id="proxy-url-setting">
                <label class="setting-label">${this.i18n.t('settings.proxyUrl')}</label>
                <div class="setting-control">
                  <input
                    type="text"
                    id="proxy-url-input"
                    class="setting-input"
                    placeholder="${this.i18n.t('settings.proxyUrlPlaceholder')}"
                    value="http://localhost:3001"
                  />
                </div>
                <small class="setting-hint">${this.i18n.t('settings.proxyUrlHint')}</small>
              </div>
            </div>
          </div>

          <!-- 通知与提醒 -->
          <div class="settings-section" data-section="notification">
            <h3 class="settings-section-title">🔔 ${this.i18n.t('settings.notificationAndAlerts')}</h3>
            <div class="settings-section-content">
              <div class="setting-item">
                <label class="setting-label">
                  <input type="checkbox" id="notification-enabled" class="setting-checkbox" />
                  <span>${this.i18n.t('settings.enableSunsetNotification')}</span>
                </label>
                <small class="setting-hint">${this.i18n.t('settings.notificationHint')}</small>
              </div>

              <div class="setting-item">
                <label class="setting-label">${this.i18n.t('settings.notificationThresholdLabel')}</label>
                <div class="setting-control">
                  <input
                    type="range"
                    id="notification-threshold"
                    class="setting-range"
                    min="0"
                    max="100"
                    step="5"
                    value="70"
                  />
                  <span id="threshold-value" class="setting-value">70</span>
                </div>
                <small class="setting-hint">${this.i18n.t('settings.notificationThresholdHint')}</small>
              </div>
            </div>
          </div>

          <!-- 语言与显示 -->
          <div class="settings-section" data-section="language">
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
            </div>
          </div>

          <!-- 个性化 -->
          <div class="settings-section" data-section="personalization">
            <h3 class="settings-section-title">🎨 ${this.i18n.t('settings.personalization')}</h3>
            <div class="settings-section-content">
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

              <div class="setting-item">
                <label class="setting-label">${this.i18n.t('settings.defaultLocation')}</label>
                <div class="setting-description">
                  <span id="default-location-display">${this.i18n.t('settings.noDefaultLocation')}</span>
                </div>
                <div id="default-location-list"></div>
                <small class="setting-hint">${this.i18n.t('settings.defaultLocationHint')}</small>
              </div>
            </div>
          </div>
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
  }

  /**
   * 加载设置
   */
  loadSettings() {
    // 加载代理 URL
    const proxyUrl = localStorage.getItem('api_proxy_url') || 'http://localhost:3001';
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
      } else {
        defaultLocationDisplay.textContent = this.i18n.t('settings.noDefaultLocation');
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
      container.innerHTML = `<p style="color: var(--color-text-light); font-size: 14px; margin-top: 8px;">
        ${this.i18n.t('favorites.noFavorites')}
      </p>`;
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
}

export default SettingsPanel;
