import { applyNavigationTheme, readAppSettings, saveAppSettings } from '../../utils/app-settings.js';

Component({
  properties: {
    current: {
      type: String,
      value: ''
    },
    period: {
      type: String,
      value: 'sunset'
    },
    themeMode: {
      type: String,
      value: 'system'
    },
    resolvedThemeMode: {
      type: String,
      value: 'light'
    }
  },

  data: {
    homeMenuOpen: false,
    settingsOpen: false,
    interfaceLanguage: 'zh-CN',
    temperatureUnit: 'celsius',
    windSpeedUnit: 'kmh'
  },

  lifetimes: {
    attached() {
      this.applySavedSettings();
    }
  },

  pageLifetimes: {
    show() {
      this.applySavedSettings();
    }
  },

  methods: {
    toggleHomeMenu() {
      this.setData({ homeMenuOpen: !this.data.homeMenuOpen, settingsOpen: false });
    },

    toggleSettings() {
      this.setData({ homeMenuOpen: false, settingsOpen: !this.data.settingsOpen });
    },

    closeSettings() {
      this.setData({ settingsOpen: false });
    },

    goHome() {
      this.setData({ homeMenuOpen: false });
      if (this.properties.current === 'home') return;
      wx.reLaunch({ url: '/pages/home/index' });
    },

    navigateFeature(event) {
      const target = event.currentTarget.dataset.target;
      const routes = {
        forecast: '/pages/home/index',
        simulator: '/pages/simulator/index',
        methodology: '/pages/methodology/index',
        map: `/pages/map/index?period=${this.properties.period || 'sunset'}`,
        gallery: '/pages/gallery/index',
        user: '/pages/user/index'
      };
      const url = routes[target];
      this.setData({ homeMenuOpen: false });
      if (!url) return;
      if (target === 'forecast') {
        wx.reLaunch({ url });
        return;
      }
      wx.navigateTo({ url });
    },

    selectInterfaceLanguage(event) {
      const value = event.currentTarget.dataset.value;
      if (!['zh-CN', 'en-US'].includes(value)) return;
      this.saveAppSettings({ interfaceLanguage: value });
    },

    selectThemeMode(event) {
      const value = event.currentTarget.dataset.value;
      if (!['system', 'light', 'dark'].includes(value)) return;
      this.saveAppSettings({ themeMode: value });
    },

    selectTemperatureUnit(event) {
      const value = event.currentTarget.dataset.value;
      if (!['celsius', 'fahrenheit'].includes(value)) return;
      this.saveAppSettings({ temperatureUnit: value });
    },

    selectWindSpeedUnit(event) {
      const value = event.currentTarget.dataset.value;
      if (!['kmh', 'ms'].includes(value)) return;
      this.saveAppSettings({ windSpeedUnit: value });
    },

    applySavedSettings() {
      const settings = readAppSettings();
      this.setData(settings);
      applyNavigationTheme(settings.resolvedThemeMode);
    },

    saveAppSettings(patch = {}) {
      const latest = readAppSettings();
      const settings = saveAppSettings(patch, { ...this.data, ...latest });
      this.setData(settings);
      applyNavigationTheme(settings.resolvedThemeMode);
      this.triggerEvent('settingschange', settings, { bubbles: true, composed: true });
    }
  }
});
