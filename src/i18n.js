/**
 * I18n - 国际化核心类
 * 轻量级国际化解决方案，支持多语言、日期/数字格式化、RTL布局
 */
class I18n {
  constructor() {
    this.currentLanguage = 'zh-CN';
    this.translations = {};
    this.supportedLanguages = {
      'zh-CN': { name: '简体中文', direction: 'ltr' },
      'zh-TW': { name: '繁體中文', direction: 'ltr' },
      'en-US': { name: 'English', direction: 'ltr' },
      'ja-JP': { name: '日本語', direction: 'ltr' },
      'ko-KR': { name: '한국어', direction: 'ltr' },
      'vi-VN': { name: 'Tiếng Việt', direction: 'ltr' },
      'fr-FR': { name: 'Français', direction: 'ltr' },
      'es-ES': { name: 'Español', direction: 'ltr' },
      'it-IT': { name: 'Italiano', direction: 'ltr' },
      'ar-SA': { name: 'العربية', direction: 'rtl' }
    };
  }

  /**
   * 初始化I18n系统
   * 检测浏览器语言或从LocalStorage加载偏好
   */
  async init() {
    // 尝试从LocalStorage加载语言偏好
    const savedLanguage = this.getSavedLanguage();
    if (savedLanguage && this.supportedLanguages[savedLanguage]) {
      this.currentLanguage = savedLanguage;
    } else {
      // 检测浏览器语言
      this.currentLanguage = this.detectBrowserLanguage();
    }

    // 加载对应翻译文件
    await this.loadTranslations(this.currentLanguage);

    // 应用RTL布局（如果需要）
    this.applyDirection();
  }

  /**
   * 检测浏览器语言
   * @returns {string} 检测到的语言代码，如果不支持则返回默认语言
   */
  detectBrowserLanguage() {
    const browserLang = navigator.language || navigator.userLanguage;

    // 精确匹配（如 zh-CN）
    if (this.supportedLanguages[browserLang]) {
      return browserLang;
    }

    // 尝试基础语言代码匹配（如 zh -> zh-CN）
    const baseLang = browserLang.split('-')[0];
    for (const lang in this.supportedLanguages) {
      if (lang.startsWith(baseLang)) {
        return lang;
      }
    }

    // 默认返回简体中文
    return 'zh-CN';
  }

  /**
   * 加载翻译文件
   * @param {string} lang - 语言代码
   */
  async loadTranslations(lang) {
    try {
      const module = await import(`./locales/${lang}.js`);
      this.translations[lang] = module.default;
    } catch (error) {
      console.error(`Failed to load translations for ${lang}:`, error);
      // 回退到默认语言
      if (lang !== 'zh-CN') {
        await this.loadTranslations('zh-CN');
      }
    }
  }

  /**
   * 翻译文本
   * @param {string} key - 翻译键（支持嵌套，如 'app.title'）
   * @param {Object} params - 参数插值对象（如 { score: 85 }）
   * @returns {string} 翻译后的文本
   */
  t(key, params = {}) {
    const keys = key.split('.');
    let value = this.translations[this.currentLanguage];

    // 遍历嵌套键
    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        value = undefined;
        break;
      }
    }

    // 如果找不到翻译，回退到默认语言
    if (value === undefined && this.currentLanguage !== 'zh-CN') {
      value = this.translations['zh-CN'];
      if (value) {
        for (const k of keys) {
          if (value && typeof value === 'object') {
            value = value[k];
          } else {
            value = undefined;
            break;
          }
        }
      }
    }

    // 如果仍然找不到，尝试从 zh-CN 获取 fallback
    if (value === undefined) {
      const zhFallback = this.translations['zh-CN'];
      if (zhFallback && this.currentLang !== 'zh-CN') {
        const keys = key.split('.');
        let fallbackValue = zhFallback;
        for (const k of keys) {
          fallbackValue = fallbackValue?.[k];
        }
        if (fallbackValue !== undefined && typeof fallbackValue === 'string') {
          return fallbackValue;
        }
      }
      console.warn(`Translation key not found: ${key}`);
      return key;
    }

    // 参数插值（如 {{score}}）
    if (typeof value === 'string' && params) {
      return value.replace(/\{\{(\w+)\}\}/g, (match, paramKey) => {
        return params[paramKey] !== undefined ? params[paramKey] : match;
      });
    }

    return value;
  }

  /**
   * 格式化日期
   * @param {Date} date - 日期对象
   * @param {Object} options - Intl.DateTimeFormat选项
   * @returns {string} 格式化后的日期字符串
   */
  formatDate(date, options = {}) {
    const defaultOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };

    const mergedOptions = { ...defaultOptions, ...options };

    try {
      return new Intl.DateTimeFormat(this.currentLanguage, mergedOptions).format(date);
    } catch (error) {
      console.error('Date formatting error:', error);
      return date.toLocaleDateString();
    }
  }

  /**
   * 格式化时间
   * @param {Date} date - 日期对象
   * @param {boolean} use12Hour - 是否使用12小时制
   * @returns {string} 格式化后的时间字符串
   */
  formatTime(date, use12Hour = null) {
    let options = {
      hour: 'numeric',
      minute: '2-digit'
    };

    // 根据语言决定默认时间格式
    if (use12Hour === null) {
      const twelveHourLangs = ['en-US', 'zh-TW'];
      options.hour12 = twelveHourLangs.includes(this.currentLanguage);
    } else {
      options.hour12 = use12Hour;
    }

    try {
      return new Intl.DateTimeFormat(this.currentLanguage, options).format(date);
    } catch (error) {
      console.error('Time formatting error:', error);
      return date.toLocaleTimeString();
    }
  }

  /**
   * 格式化数字
   * @param {number} num - 数字
   * @param {Object} options - Intl.NumberFormat选项
   * @returns {string} 格式化后的数字字符串
   */
  formatNumber(num, options = {}) {
    try {
      return new Intl.NumberFormat(this.currentLanguage, options).format(num);
    } catch (error) {
      console.error('Number formatting error:', error);
      return num.toString();
    }
  }

  /**
   * 格式化百分比
   * @param {number} value - 0-1之间的小数（如0.85）
   * @param {number} decimals - 小数位数
   * @returns {string} 格式化后的百分比字符串
   */
  formatPercent(value, decimals = 0) {
    try {
      return new Intl.NumberFormat(this.currentLanguage, {
        style: 'percent',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      }).format(value);
    } catch (error) {
      console.error('Percent formatting error:', error);
      return `${(value * 100).toFixed(decimals)}%`;
    }
  }

  /**
   * 切换语言
   * @param {string} lang - 语言代码
   */
  async changeLanguage(lang) {
    if (!this.supportedLanguages[lang]) {
      console.error(`Unsupported language: ${lang}`);
      return;
    }

    // 加载新语言翻译（如果尚未加载）
    if (!this.translations[lang]) {
      await this.loadTranslations(lang);
    }

    this.currentLanguage = lang;

    // 保存语言偏好
    this.saveLanguage(lang);

    // 应用RTL布局
    this.applyDirection();
  }

  /**
   * 获取当前语言
   * @returns {string} 当前语言代码
   */
  getLanguage() {
    return this.currentLanguage;
  }

  /**
   * 判断是否为RTL语言
   * @returns {boolean} 是否为RTL语言
   */
  isRTL() {
    return this.supportedLanguages[this.currentLanguage]?.direction === 'rtl' || false;
  }

  /**
   * 应用文字方向（LTR/RTL）
   */
  applyDirection() {
    const html = document.documentElement;
    const body = document.body;

    // 设置lang和dir属性
    html.lang = this.currentLanguage;
    html.dir = this.isRTL() ? 'rtl' : 'ltr';

    // 添加或移除rtl类
    if (this.isRTL()) {
      body.classList.add('rtl');
    } else {
      body.classList.remove('rtl');
    }
  }

  /**
   * 保存语言偏好到LocalStorage
   * @param {string} lang - 语言代码
   */
  saveLanguage(lang) {
    try {
      localStorage.setItem('weather-sunset-predictor-language', lang);
    } catch (error) {
      console.error('Failed to save language preference:', error);
    }
  }

  /**
   * 从LocalStorage获取保存的语言偏好
   * @returns {string|null} 保存的语言代码
   */
  getSavedLanguage() {
    try {
      return localStorage.getItem('weather-sunset-predictor-language');
    } catch (error) {
      console.error('Failed to get saved language:', error);
      return null;
    }
  }
}

// 导出单例
const i18n = new I18n();
export default i18n;
