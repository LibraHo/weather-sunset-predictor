Component({
  properties: {
    current: {
      type: String,
      value: ''
    },
    period: {
      type: String,
      value: 'sunset'
    }
  },

  data: {
    homeMenuOpen: false,
    settingsOpen: false,
    interfaceLanguage: 'zh-CN',
    themeMode: 'system'
  },

  lifetimes: {
    attached() {
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
        methodology: '/pages/methodology/index',
        map: `/pages/map/index?period=${this.properties.period || 'sunset'}`,
        gallery: '/pages/gallery/index',
        api: '/pages/methodology/index?section=api',
        upload: '/pages/upload/index'
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

    applySavedSettings() {
      const settings = readAppSettings();
      this.setData({
        interfaceLanguage: settings.interfaceLanguage,
        themeMode: settings.themeMode
      });
    },

    saveAppSettings(patch = {}) {
      const settings = {
        interfaceLanguage: patch.interfaceLanguage || this.data.interfaceLanguage || 'zh-CN',
        themeMode: patch.themeMode || this.data.themeMode || 'system'
      };
      wx.setStorageSync('appSettings', settings);
      this.setData(settings);
    }
  }
});

function readAppSettings() {
  const settings = wx.getStorageSync('appSettings') || {};
  const interfaceLanguage = settings.interfaceLanguage === 'en-US' ? 'en-US' : 'zh-CN';
  const themeMode = ['system', 'light', 'dark'].includes(settings.themeMode) ? settings.themeMode : 'system';
  return { interfaceLanguage, themeMode };
}
