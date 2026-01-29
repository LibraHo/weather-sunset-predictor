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
    // 移除所有主题类
    document.body.classList.remove('theme-light', 'theme-dark', 'theme-auto');

    // 添加新主题类
    if (theme === this.THEMES.AUTO) {
      document.body.classList.add('theme-auto');
    } else if (theme === this.THEMES.DARK) {
      document.body.classList.add('theme-dark');
    } else {
      // light 主题是默认的，不需要添加类
      // 但为了统一，我们还是添加
      document.body.classList.add('theme-light');
    }

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
