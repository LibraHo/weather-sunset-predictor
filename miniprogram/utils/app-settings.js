export function readAppSettings() {
  const settings = wx.getStorageSync('appSettings') || {};
  const interfaceLanguage = settings.interfaceLanguage === 'en-US' ? 'en-US' : 'zh-CN';
  const themeMode = ['system', 'light', 'dark'].includes(settings.themeMode) ? settings.themeMode : 'system';
  return {
    interfaceLanguage,
    themeMode,
    resolvedThemeMode: resolveThemeMode(themeMode)
  };
}

export function resolveThemeMode(themeMode = 'system') {
  if (themeMode === 'dark' || themeMode === 'light') return themeMode;
  const appBaseInfo = typeof wx.getAppBaseInfo === 'function' ? wx.getAppBaseInfo() : {};
  const systemSetting = typeof wx.getSystemSetting === 'function' ? wx.getSystemSetting() : {};
  const theme = appBaseInfo.theme || systemSetting.theme;
  return theme === 'dark' || systemSetting.darkmode === true ? 'dark' : 'light';
}

export function saveAppSettings(patch = {}, current = {}) {
  const settings = {
    interfaceLanguage: patch.interfaceLanguage || current.interfaceLanguage || 'zh-CN',
    themeMode: patch.themeMode || current.themeMode || 'system'
  };
  wx.setStorageSync('appSettings', settings);
  return {
    ...settings,
    resolvedThemeMode: resolveThemeMode(settings.themeMode)
  };
}

export function applyPageSettings(page) {
  const settings = readAppSettings();
  page.setData(settings);
  applyNavigationTheme(settings.resolvedThemeMode);
  return settings;
}

export function applyNavigationTheme(resolvedThemeMode = 'light') {
  if (typeof wx.setNavigationBarColor !== 'function') return;
  const dark = resolvedThemeMode === 'dark';
  wx.setNavigationBarColor({
    frontColor: dark ? '#ffffff' : '#000000',
    backgroundColor: dark ? '#070b16' : '#f6efe6'
  });
}
