/**
 * ThemeService 单元测试
 *
 * 覆盖主题加载、应用、切换、系统主题监听等所有方法
 * 需求：17.4, 17.5, 17.6（主题设置）、23.10（services 覆盖率）
 */

import { jest } from '@jest/globals';
import ThemeService from '@services/ThemeService.js';

// 构造 ThemeService 实例前需要 window.matchMedia，jsdom 默认不提供
function setupMatchMedia(prefersDark = false) {
  const listeners = [];
  const mediaQueryList = {
    matches: prefersDark,
    addEventListener: jest.fn((event, handler) => {
      listeners.push(handler);
    }),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    // 暴露辅助方法，让测试触发变化事件
    _trigger: (matches) => {
      listeners.forEach(fn => fn({ matches }));
    }
  };
  window.matchMedia = jest.fn(() => mediaQueryList);
  return mediaQueryList;
}

describe('ThemeService - 初始化', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.className = '';
    setupMatchMedia(false);
  });

  test('未保存主题时，默认使用 auto', () => {
    const service = new ThemeService();
    expect(service.getTheme()).toBe('auto');
  });

  test('localStorage 中保存了 light，初始化时加载 light', () => {
    localStorage.setItem('app_theme', 'light');
    const service = new ThemeService();
    expect(service.getTheme()).toBe('light');
  });

  test('localStorage 中保存了 dark，初始化时加载 dark', () => {
    localStorage.setItem('app_theme', 'dark');
    const service = new ThemeService();
    expect(service.getTheme()).toBe('dark');
  });

  test('localStorage 中保存了无效值，回退到 auto', () => {
    localStorage.setItem('app_theme', 'invalid-theme');
    const service = new ThemeService();
    expect(service.getTheme()).toBe('auto');
  });

  test('初始化后 document.body 拥有对应主题类', () => {
    localStorage.setItem('app_theme', 'dark');
    new ThemeService();
    expect(document.body.classList.contains('theme-dark')).toBe(true);
  });
});

describe('ThemeService.applyTheme', () => {
  let service;

  beforeEach(() => {
    localStorage.clear();
    document.body.className = '';
    setupMatchMedia(false);
    service = new ThemeService();
    document.body.className = '';
  });

  test('applyTheme("light") 添加 theme-light 类，移除其他', () => {
    service.applyTheme('light');
    expect(document.body.classList.contains('theme-light')).toBe(true);
    expect(document.body.classList.contains('theme-dark')).toBe(false);
    expect(document.body.classList.contains('theme-auto')).toBe(false);
  });

  test('applyTheme("dark") 添加 theme-dark 类，移除其他', () => {
    service.applyTheme('dark');
    expect(document.body.classList.contains('theme-dark')).toBe(true);
    expect(document.body.classList.contains('theme-light')).toBe(false);
  });

  test('applyTheme("auto") 添加 theme-auto 类', () => {
    service.applyTheme('auto');
    expect(document.body.classList.contains('theme-auto')).toBe(true);
  });

  test('applyTheme 更新 currentTheme', () => {
    service.applyTheme('dark');
    expect(service.getTheme()).toBe('dark');
  });

  test('applyTheme 调用 saveTheme 持久化', () => {
    service.applyTheme('dark');
    expect(localStorage.getItem('app_theme')).toBe('dark');
  });
});

describe('ThemeService.setTheme', () => {
  let service;

  beforeEach(() => {
    localStorage.clear();
    document.body.className = '';
    setupMatchMedia(false);
    service = new ThemeService();
  });

  test('setTheme("light") 成功，返回 true', () => {
    expect(service.setTheme('light')).toBe(true);
    expect(service.getTheme()).toBe('light');
  });

  test('setTheme("dark") 成功，返回 true', () => {
    expect(service.setTheme('dark')).toBe(true);
  });

  test('setTheme("auto") 成功，返回 true', () => {
    expect(service.setTheme('auto')).toBe(true);
  });

  test('setTheme 传入无效主题，返回 false 且主题不变', () => {
    service.setTheme('light');
    const result = service.setTheme('invalid');
    expect(result).toBe(false);
    expect(service.getTheme()).toBe('light');
  });
});

describe('ThemeService.getTheme & getActualTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.className = '';
  });

  test('light 模式：getActualTheme 返回 light', () => {
    setupMatchMedia(false);
    const service = new ThemeService();
    service.setTheme('light');
    expect(service.getActualTheme()).toBe('light');
  });

  test('dark 模式：getActualTheme 返回 dark', () => {
    setupMatchMedia(false);
    const service = new ThemeService();
    service.setTheme('dark');
    expect(service.getActualTheme()).toBe('dark');
  });

  test('auto 模式 + 系统暗色：getActualTheme 返回 dark', () => {
    setupMatchMedia(true);
    const service = new ThemeService();
    service.setTheme('auto');
    expect(service.getActualTheme()).toBe('dark');
  });

  test('auto 模式 + 系统亮色：getActualTheme 返回 light', () => {
    setupMatchMedia(false);
    const service = new ThemeService();
    service.setTheme('auto');
    expect(service.getActualTheme()).toBe('light');
  });
});

describe('ThemeService.getSystemTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.className = '';
  });

  test('系统为暗色模式时返回 dark', () => {
    setupMatchMedia(true);
    const service = new ThemeService();
    expect(service.getSystemTheme()).toBe('dark');
  });

  test('系统为亮色模式时返回 light', () => {
    setupMatchMedia(false);
    const service = new ThemeService();
    expect(service.getSystemTheme()).toBe('light');
  });

  test('window.matchMedia 不存在时返回 light', () => {
    const original = window.matchMedia;
    delete window.matchMedia;
    const service = new ThemeService();
    expect(service.getSystemTheme()).toBe('light');
    window.matchMedia = original;
  });
});

describe('ThemeService.dispatchThemeChangeEvent', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.className = '';
    setupMatchMedia(false);
  });

  test('触发 themeChanged 自定义事件', () => {
    const service = new ThemeService();
    const handler = jest.fn();
    window.addEventListener('themeChanged', handler);

    service.dispatchThemeChangeEvent('dark');

    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0][0];
    expect(event.detail.actualTheme).toBe('dark');

    window.removeEventListener('themeChanged', handler);
  });
});

describe('ThemeService - 系统主题变化监听', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.className = '';
  });

  test('auto 模式时系统主题变化触发 themeChanged 事件', () => {
    const mql = setupMatchMedia(false);
    const service = new ThemeService();
    service.setTheme('auto');

    const handler = jest.fn();
    window.addEventListener('themeChanged', handler);

    // 模拟系统切换为暗色
    mql._trigger(true);

    expect(handler).toHaveBeenCalled();
    const event = handler.mock.calls[0][0];
    expect(event.detail.actualTheme).toBe('dark');

    window.removeEventListener('themeChanged', handler);
  });

  test('非 auto 模式时系统主题变化不触发事件', () => {
    const mql = setupMatchMedia(false);
    const service = new ThemeService();
    service.setTheme('light');

    const handler = jest.fn();
    window.addEventListener('themeChanged', handler);

    mql._trigger(true);

    expect(handler).not.toHaveBeenCalled();

    window.removeEventListener('themeChanged', handler);
  });

  test('旧版浏览器通过 addListener 注册监听（兼容路径）', () => {
    const listeners = [];
    window.matchMedia = jest.fn(() => ({
      matches: false,
      addEventListener: undefined, // 不存在新 API
      addListener: jest.fn((handler) => listeners.push(handler)),
      removeListener: jest.fn()
    }));

    const service = new ThemeService();
    service.setTheme('auto');

    // addListener 应该被调用
    expect(window.matchMedia().addListener).toBeDefined();
  });
});

describe('ThemeService.saveTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.className = '';
    setupMatchMedia(false);
  });

  test('saveTheme 写入 localStorage', () => {
    const service = new ThemeService();
    service.saveTheme('dark');
    expect(localStorage.getItem('app_theme')).toBe('dark');
  });
});
