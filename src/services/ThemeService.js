/**
 * ThemeService - 主题管理服务
 *
 * 管理应用主题（明亮/暗色/自动）
 * 需求：17.4, 17.5, 17.6
 */

class ThemeService {
  constructor() {
    // 主题模式常量
    this.THEMES = {
      LIGHT: 'light',
      DARK: 'dark',
      AUTO: 'auto'
    };

    // LocalStorage 键（与SettingsPanel保持一致）
    this.STORAGE_KEY = 'app_theme';

    // 当前主题
    this.currentTheme = this.loadTheme();

    // 初始化主题
    this.applyTheme(this.currentTheme);

    // 监听系统主题变化（仅当主题为auto时）
    this.initSystemThemeListener();
  }

  /**
   * 从 LocalStorage 加载主题设置
   * @returns {string} 主题模式
   */
  loadTheme() {
    try {
      const savedTheme = localStorage.getItem(this.STORAGE_KEY);
      // 验证保存的主题是否有效
      if (savedTheme && Object.values(this.THEMES).includes(savedTheme)) {
        return savedTheme;
      }
    } catch (error) {
      console.warn('[ThemeService] 无法加载主题设置:', error);
    }
    // 默认返回 auto
    return this.THEMES.AUTO;
  }

  /**
   * 保存主题设置到 LocalStorage
   * @param {string} theme - 主题模式
   */
  saveTheme(theme) {
    try {
      localStorage.setItem(this.STORAGE_KEY, theme);
    } catch (error) {
      console.warn('[ThemeService] 无法保存主题设置:', error);
    }
  }

  /**
   * 应用主题
   * @param {string} theme - 主题模式 ('light' | 'dark' | 'auto')
   */
  applyTheme(theme) {
    const root = document.documentElement;
    const body = document.body;
    const themeClasses = ['theme-light', 'theme-dark', 'theme-auto', 'theme-actual-light', 'theme-actual-dark'];

    // Safari 对 prefers-color-scheme 与表单/滚动条渲染更激进：
    // 主题类同时挂到 html/body，并显式设置 colorScheme，确保手动 light 能压过系统暗色。
    root.classList.remove(...themeClasses);
    body.classList.remove(...themeClasses);

    let themeClass = 'theme-light';
    let actualTheme = this.THEMES.LIGHT;
    if (theme === this.THEMES.AUTO) {
      themeClass = 'theme-auto';
      actualTheme = this.getSystemTheme();
      root.style.colorScheme = actualTheme;
    } else if (theme === this.THEMES.DARK) {
      themeClass = 'theme-dark';
      actualTheme = this.THEMES.DARK;
      root.style.colorScheme = 'dark';
    } else {
      themeClass = 'theme-light';
      actualTheme = this.THEMES.LIGHT;
      root.style.colorScheme = 'light';
    }

    const actualThemeClass = actualTheme === this.THEMES.DARK ? 'theme-actual-dark' : 'theme-actual-light';
    root.classList.add(themeClass, actualThemeClass);
    body.classList.add(themeClass, actualThemeClass);
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-actual-theme', actualTheme);
    body.setAttribute('data-theme', theme);
    body.setAttribute('data-actual-theme', actualTheme);

    // 保存主题
    this.currentTheme = theme;
    this.saveTheme(theme);

    console.log(`[ThemeService] 主题已设置为: ${theme}`);
  }

  /**
   * 获取当前主题
   * @returns {string} 当前主题模式
   */
  getTheme() {
    return this.currentTheme;
  }

  /**
   * 获取实际应用的主题（考虑auto模式的系统主题）
   * @returns {string} 实际主题 ('light' | 'dark')
   */
  getActualTheme() {
    if (this.currentTheme === this.THEMES.AUTO) {
      // 检测系统主题
      return this.getSystemTheme();
    }
    return this.currentTheme;
  }

  /**
   * 检测系统主题
   * @returns {string} 系统主题 ('light' | 'dark')
   */
  getSystemTheme() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return this.THEMES.DARK;
    }
    return this.THEMES.LIGHT;
  }

  /**
   * 初始化系统主题变化监听
   */
  initSystemThemeListener() {
    if (window.matchMedia) {
      const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');

      // 使用 addListener（旧版浏览器）和 addEventListener（新版浏览器）
      const handler = (e) => {
        // 仅在主题为auto时响应系统主题变化
        if (this.currentTheme === this.THEMES.AUTO) {
          const newTheme = e.matches ? this.THEMES.DARK : this.THEMES.LIGHT;
          console.log(`[ThemeService] 系统主题已变化为: ${newTheme}`);

          document.documentElement.style.colorScheme = newTheme;
          document.documentElement.classList.remove('theme-actual-light', 'theme-actual-dark');
          document.body.classList.remove('theme-actual-light', 'theme-actual-dark');
          const actualClass = newTheme === this.THEMES.DARK ? 'theme-actual-dark' : 'theme-actual-light';
          document.documentElement.classList.add(actualClass);
          document.body.classList.add(actualClass);
          document.documentElement.setAttribute('data-actual-theme', newTheme);
          document.body.setAttribute('data-actual-theme', newTheme);

          // 触发主题变化事件
          this.dispatchThemeChangeEvent(newTheme);
        }
      };

      // 新版浏览器
      if (darkModeQuery.addEventListener) {
        darkModeQuery.addEventListener('change', handler);
      }
      // 旧版浏览器兼容
      else if (darkModeQuery.addListener) {
        darkModeQuery.addListener(handler);
      }
    }
  }

  /**
   * 触发主题变化事件
   * @param {string} actualTheme - 实际主题
   */
  dispatchThemeChangeEvent(actualTheme) {
    const event = new CustomEvent('themeChanged', {
      detail: {
        theme: this.currentTheme,
        actualTheme: actualTheme
      }
    });
    window.dispatchEvent(event);
  }

  /**
   * 设置主题
   * @param {string} theme - 主题模式 ('light' | 'dark' | 'auto')
   */
  setTheme(theme) {
    if (!Object.values(this.THEMES).includes(theme)) {
      console.warn('[ThemeService] 无效的主题模式:', theme);
      return false;
    }

    this.applyTheme(theme);

    // 触发主题变化事件
    this.dispatchThemeChangeEvent(this.getActualTheme());

    return true;
  }
}

export default ThemeService;
