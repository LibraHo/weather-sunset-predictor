/**
 * SettingsPanel 单元测试
 *
 * 覆盖 open/close/toggle、loadSettings、各 handle* 回调、renderFavoriteLocationsList
 * 需求：16（统一设置面板）、17（个性化设置）、23.13（UI 组件测试）
 */

import { jest } from '@jest/globals';
import SettingsPanel from '@components/SettingsPanel.js';
import i18n from '@/i18n.js';

// ---- Mock i18n 单例 ----

function setupI18nMock(currentLang = 'zh-CN') {
  jest.spyOn(i18n, 'getLanguage').mockReturnValue(currentLang);
  jest.spyOn(i18n, 't').mockImplementation((key) => key);
  jest.spyOn(i18n, 'init').mockResolvedValue(undefined);
  jest.spyOn(i18n, 'changeLanguage').mockResolvedValue(undefined);
  Object.defineProperty(i18n, 'currentLanguage', {
    get: jest.fn().mockReturnValue(currentLang),
    configurable: true
  });
  Object.defineProperty(i18n, 'supportedLanguages', {
    get: jest.fn().mockReturnValue({
      'zh-CN': { name: '简体中文' },
      'en-US': { name: 'English' }
    }),
    configurable: true
  });
}

// ---- Mock StorageService ----

function makeMockStorageService(overrides = {}) {
  return {
    getNotificationSettings: jest.fn().mockReturnValue({ enabled: false, threshold: 70 }),
    getFavoriteLocations: jest.fn().mockReturnValue([]),
    getDefaultLocation: jest.fn().mockReturnValue(null),
    saveDefaultLocation: jest.fn().mockReturnValue(true),
    ...overrides
  };
}

// ---- Mock ThemeService ----

function makeMockThemeService(overrides = {}) {
  return {
    getTheme: jest.fn().mockReturnValue('auto'),
    setTheme: jest.fn().mockReturnValue(true),
    ...overrides
  };
}

// ---- 工厂函数 ----

function makePanel(storageOverrides = {}, themeOverrides = {}) {
  const storage = makeMockStorageService(storageOverrides);
  const theme = makeMockThemeService(themeOverrides);
  return new SettingsPanel(storage, theme);
}

// ---- 测试 ----

describe('SettingsPanel - 初始化', () => {
  beforeEach(() => {
    setupI18nMock();
    localStorage.clear();
  });

  afterEach(() => {
    // 移除测试中挂载的面板
    const panel = document.getElementById('settings-panel');
    if (panel) panel.remove();
    jest.restoreAllMocks();
  });

  test('初始状态 isOpen = false, panel = null', () => {
    const sp = makePanel();
    expect(sp.isOpen).toBe(false);
    expect(sp.panel).toBeNull();
  });

  test('init() 在 i18n 已初始化时不重复调用 i18n.init()', async () => {
    const sp = makePanel();
    await sp.init();
    expect(i18n.init).not.toHaveBeenCalled();
  });

  test('init() 在 i18n.currentLanguage 为 null 时调用 i18n.init()', async () => {
    jest.restoreAllMocks();
    setupI18nMock();
    // 覆盖 currentLanguage 为 null
    Object.defineProperty(i18n, 'currentLanguage', {
      get: jest.fn().mockReturnValue(null),
      configurable: true
    });
    const sp = makePanel();
    await sp.init();
    expect(i18n.init).toHaveBeenCalled();
  });
});

describe('SettingsPanel.open / close / toggle', () => {
  beforeEach(() => {
    setupI18nMock();
    localStorage.clear();
  });

  afterEach(() => {
    const panel = document.getElementById('settings-panel');
    if (panel) panel.remove();
    jest.restoreAllMocks();
  });

  test('open() 创建面板并移除 hidden 类，isOpen = true', () => {
    const sp = makePanel();
    sp.open();
    expect(sp.panel).not.toBeNull();
    expect(sp.isOpen).toBe(true);
    expect(sp.panel.classList.contains('hidden')).toBe(false);
  });

  test('close() 添加 hidden 类，isOpen = false', () => {
    const sp = makePanel();
    sp.open();
    sp.close();
    expect(sp.isOpen).toBe(false);
    expect(sp.panel.classList.contains('hidden')).toBe(true);
  });

  test('toggle() 在关闭时打开', () => {
    const sp = makePanel();
    sp.toggle();
    expect(sp.isOpen).toBe(true);
  });

  test('toggle() 在打开时关闭', () => {
    const sp = makePanel();
    sp.open();
    sp.toggle();
    expect(sp.isOpen).toBe(false);
  });

  test('语言变化后 open() 重新创建面板', () => {
    const sp = makePanel();
    sp.open(); // 用 zh-CN 创建
    const firstPanel = sp.panel;

    // 模拟语言变化
    i18n.getLanguage.mockReturnValue('en-US');
    sp.open();

    // 面板应被重新创建
    expect(sp.panel).not.toBe(firstPanel);
  });

  test('多次 open() 相同语言不重新创建面板', () => {
    const sp = makePanel();
    sp.open();
    const firstPanel = sp.panel;
    sp.close();
    sp.open();
    expect(sp.panel).toBe(firstPanel);
  });
});

describe('SettingsPanel.loadSettings', () => {
  beforeEach(() => {
    setupI18nMock();
    localStorage.clear();
  });

  afterEach(() => {
    const panel = document.getElementById('settings-panel');
    if (panel) panel.remove();
    jest.restoreAllMocks();
  });

  test('加载通知设置：enabled 和 threshold', () => {
    const sp = makePanel({
      getNotificationSettings: jest.fn().mockReturnValue({ enabled: true, threshold: 80 })
    });
    localStorage.setItem('notification_settings', JSON.stringify({ enabled: true, threshold: 80 }));
    sp.open();

    const enabled = document.getElementById('notification-enabled');
    const threshold = document.getElementById('notification-threshold');
    expect(enabled.checked).toBe(true);
    expect(threshold.value).toBe('80');
  });

  test('加载主题设置调用 themeService.getTheme()', () => {
    const theme = makeMockThemeService({ getTheme: jest.fn().mockReturnValue('dark') });
    const sp = new SettingsPanel(makeMockStorageService(), theme);
    sp.open();
    const themeSelect = document.getElementById('theme-select');
    expect(themeSelect.value).toBe('dark');
  });

  test('加载温度单位', () => {
    localStorage.setItem('temp_unit', 'fahrenheit');
    const sp = makePanel();
    sp.open();
    const tempSelect = document.getElementById('temp-unit-select');
    expect(tempSelect.value).toBe('fahrenheit');
  });

  test('加载风速单位', () => {
    localStorage.setItem('wind_unit', 'ms');
    const sp = makePanel();
    sp.open();
    const windSelect = document.getElementById('wind-unit-select');
    expect(windSelect.value).toBe('ms');
  });
});

describe('SettingsPanel - API 配置入口', () => {
  beforeEach(() => {
    setupI18nMock();
    localStorage.clear();
  });

  afterEach(() => {
    const panel = document.getElementById('settings-panel');
    if (panel) panel.remove();
    jest.restoreAllMocks();
  });

  test('设置面板不再显示 API 模式选择器', () => {
    const sp = makePanel();
    sp.open();
    const select = document.getElementById('api-mode-select');
    expect(select).toBeNull();
  });
});

describe('SettingsPanel - 事件处理', () => {
  let sp;

  beforeEach(() => {
    setupI18nMock();
    localStorage.clear();
    sp = makePanel();
    sp.open();
  });

  afterEach(() => {
    const panel = document.getElementById('settings-panel');
    if (panel) panel.remove();
    jest.restoreAllMocks();
  });

  test('关闭按钮点击关闭面板', () => {
    const closeBtn = sp.panel.querySelector('.settings-close');
    closeBtn.click();
    expect(sp.isOpen).toBe(false);
  });

  test('遮罩点击关闭面板', () => {
    const overlay = sp.panel.querySelector('.settings-overlay');
    overlay.click();
    expect(sp.isOpen).toBe(false);
  });

  test('handleProxyUrlChange 保存 URL 到 localStorage', () => {
    sp.handleProxyUrlChange('http://example.com:3001');
    expect(localStorage.getItem('api_proxy_url')).toBe('http://example.com:3001');
  });

  test('handleNotificationChange 保存通知设置', () => {
    // 确保 threshold 元素存在
    const thresholdEl = document.getElementById('notification-threshold');
    thresholdEl.value = '75';

    sp.handleNotificationChange(true);
    const saved = JSON.parse(localStorage.getItem('notification_settings'));
    expect(saved.enabled).toBe(true);
    expect(saved.threshold).toBe(75);
  });

  test('handleThresholdChange 保存阈值', () => {
    sp.handleThresholdChange('85');
    const saved = JSON.parse(localStorage.getItem('notification_settings'));
    expect(saved.threshold).toBe(85);
  });

  test('handleThemeChange 调用 themeService.setTheme 并分发事件', () => {
    const handler = jest.fn();
    window.addEventListener('themeChanged', handler);

    sp.handleThemeChange('dark');

    expect(sp.themeService.setTheme).toHaveBeenCalledWith('dark');
    expect(handler).toHaveBeenCalledTimes(1);

    window.removeEventListener('themeChanged', handler);
  });

  test('handleTempUnitChange 保存单位并分发 temperatureUnitChanged 事件', () => {
    const handler = jest.fn();
    window.addEventListener('temperatureUnitChanged', handler);

    sp.handleTempUnitChange('fahrenheit');

    expect(localStorage.getItem('temp_unit')).toBe('fahrenheit');
    expect(handler).toHaveBeenCalledTimes(1);

    window.removeEventListener('temperatureUnitChanged', handler);
  });

  test('handleWindUnitChange 保存单位并分发 windUnitChanged 事件', () => {
    const handler = jest.fn();
    window.addEventListener('windUnitChanged', handler);

    sp.handleWindUnitChange('ms');

    expect(localStorage.getItem('wind_unit')).toBe('ms');
    expect(handler).toHaveBeenCalledTimes(1);

    window.removeEventListener('windUnitChanged', handler);
  });
});

describe('SettingsPanel.handleLanguageChange', () => {
  beforeEach(() => {
    setupI18nMock();
    localStorage.clear();
  });

  afterEach(() => {
    const panel = document.getElementById('settings-panel');
    if (panel) panel.remove();
    jest.restoreAllMocks();
  });

  test('切换语言后分发 languageChanged 事件', async () => {
    const sp = makePanel();
    sp.open();

    const handler = jest.fn();
    window.addEventListener('languageChanged', handler);

    await sp.handleLanguageChange('en-US');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.language).toBe('en-US');

    window.removeEventListener('languageChanged', handler);
  });

  test('切换语言后面板保持打开', async () => {
    const sp = makePanel();
    sp.open();

    await sp.handleLanguageChange('en-US');

    expect(sp.isOpen).toBe(true);
    expect(sp.panel.classList.contains('hidden')).toBe(false);
  });
});

describe('SettingsPanel.renderFavoriteLocationsList', () => {
  beforeEach(() => {
    setupI18nMock();
    localStorage.clear();
  });

  afterEach(() => {
    const panel = document.getElementById('settings-panel');
    if (panel) panel.remove();
    jest.restoreAllMocks();
  });

  test('没有收藏位置时不渲染 favorites.noFavorites 文案', () => {
    const sp = makePanel({ getFavoriteLocations: jest.fn().mockReturnValue([]) });
    sp.open();
    const container = document.getElementById('default-location-list');
    expect(container.innerHTML.trim()).toBe('');
  });

  
  test('未设置默认位置时使用空状态样式并显示设置文案', () => {
    const sp = makePanel({
      getFavoriteLocations: jest.fn().mockReturnValue([]),
      getDefaultLocation: jest.fn().mockReturnValue(null)
    });
    sp.open();

    const display = document.getElementById('default-location-display');
    expect(display.textContent).toBe('settings.noDefaultLocation');
    expect(display.classList.contains('setting-default-location-empty')).toBe(true);
  });

  test('有收藏位置时渲染位置列表', () => {
    const favorites = [
      { lat: 39.9, lon: 116.4, name: '北京' },
      { lat: 31.2, lon: 121.5, name: '上海' }
    ];
    const sp = makePanel({ getFavoriteLocations: jest.fn().mockReturnValue(favorites) });
    sp.open();
    const container = document.getElementById('default-location-list');
    expect(container.querySelectorAll('.favorite-location-item').length).toBe(2);
  });

  test('当前默认位置显示标记而非设为默认按钮', () => {
    const favorites = [{ lat: 39.9042, lon: 116.4074, name: '北京' }];
    const sp = makePanel({
      getFavoriteLocations: jest.fn().mockReturnValue(favorites),
      getDefaultLocation: jest.fn().mockReturnValue({ lat: 39.9042, lon: 116.4074, name: '北京' })
    });
    sp.open();
    const container = document.getElementById('default-location-list');
    const btns = container.querySelectorAll('.set-default-btn');
    expect(btns.length).toBe(0);
    expect(container.innerHTML).toContain('settings.currentDefaultLocation');
  });

  test('handleSetDefaultLocation 调用 storageService.saveDefaultLocation', () => {
    const favorites = [
      { lat: 39.9, lon: 116.4, name: '北京' },
      { lat: 31.2, lon: 121.5, name: '上海' }
    ];
    const saveSpy = jest.fn().mockReturnValue(true);
    const sp = makePanel({
      getFavoriteLocations: jest.fn().mockReturnValue(favorites),
      saveDefaultLocation: saveSpy
    });
    sp.open();

    sp.handleSetDefaultLocation(1);

    expect(saveSpy).toHaveBeenCalledWith(favorites[1]);
  });

  test('handleSetDefaultLocation 无效索引时打印 warn 不调用 save', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const saveSpy = jest.fn();
    const sp = makePanel({
      getFavoriteLocations: jest.fn().mockReturnValue([]),
      saveDefaultLocation: saveSpy
    });
    sp.open();

    sp.handleSetDefaultLocation(99);

    expect(saveSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });
});

describe('SettingsPanel.applyTheme', () => {
  beforeEach(() => {
    setupI18nMock();
    localStorage.clear();
  });

  afterEach(() => {
    const panel = document.getElementById('settings-panel');
    if (panel) panel.remove();
    jest.restoreAllMocks();
  });

  test('applyTheme 委托给 themeService.setTheme', () => {
    const sp = makePanel();
    sp.applyTheme('light');
    expect(sp.themeService.setTheme).toHaveBeenCalledWith('light');
  });
});

describe('SettingsPanel - 火烧云渲染模式切换（任务 64.14）', () => {
  beforeEach(() => {
    setupI18nMock();
    localStorage.clear();
  });

  afterEach(() => {
    const panel = document.getElementById('settings-panel');
    if (panel) panel.remove();
    jest.restoreAllMocks();
  });

  test('初始打开时渲染模式 select 值来自 localStorage（默认 raster）', () => {
    const sp = makePanel();
    sp.open();
    const sel = document.getElementById('china-render-mode-select');
    expect(sel).not.toBeNull();
    expect(sel.value).toBe('raster');
  });

  test('localStorage 中已有 spots 时 select 初始化为 spots', () => {
    localStorage.setItem('china_render_mode', 'spots');
    const sp = makePanel();
    sp.open();
    const sel = document.getElementById('china-render-mode-select');
    expect(sel.value).toBe('spots');
  });

  test('切换 select 时写入 localStorage 并触发 chinaRenderModeChanged 事件', () => {
    const sp = makePanel();
    sp.open();

    const events = [];
    window.addEventListener('chinaRenderModeChanged', (e) => events.push(e.detail));

    const sel = document.getElementById('china-render-mode-select');
    sel.value = 'spots';
    sel.dispatchEvent(new Event('change'));

    expect(localStorage.getItem('china_render_mode')).toBe('spots');
    expect(events).toHaveLength(1);
    expect(events[0].mode).toBe('spots');

    window.removeEventListener('chinaRenderModeChanged', events);
  });

  test('loadSettings 正确同步 select 值与 localStorage', () => {
    localStorage.setItem('china_render_mode', 'raster');
    const sp = makePanel();
    sp.open();
    // 改变 localStorage 后调用 loadSettings 应同步
    localStorage.setItem('china_render_mode', 'spots');
    sp.loadSettings();
    const sel = document.getElementById('china-render-mode-select');
    expect(sel.value).toBe('spots');
  });
});
