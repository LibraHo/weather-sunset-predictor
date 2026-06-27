export function readAppSettings() {
  const settings = wx.getStorageSync('appSettings') || {};
  const interfaceLanguage = settings.interfaceLanguage === 'en-US' ? 'en-US' : 'zh-CN';
  const themeMode = ['system', 'light', 'dark'].includes(settings.themeMode) ? settings.themeMode : 'system';
  const temperatureUnit = ['celsius', 'fahrenheit'].includes(settings.temperatureUnit) ? settings.temperatureUnit : 'celsius';
  const windSpeedUnit = ['kmh', 'ms'].includes(settings.windSpeedUnit) ? settings.windSpeedUnit : 'kmh';
  return {
    interfaceLanguage,
    themeMode,
    temperatureUnit,
    windSpeedUnit,
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
  const temperatureUnit = patch.temperatureUnit || current.temperatureUnit || 'celsius';
  const windSpeedUnit = patch.windSpeedUnit || current.windSpeedUnit || 'kmh';
  const settings = {
    interfaceLanguage: patch.interfaceLanguage || current.interfaceLanguage || 'zh-CN',
    themeMode: patch.themeMode || current.themeMode || 'system',
    temperatureUnit: ['celsius', 'fahrenheit'].includes(temperatureUnit) ? temperatureUnit : 'celsius',
    windSpeedUnit: ['kmh', 'ms'].includes(windSpeedUnit) ? windSpeedUnit : 'kmh'
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
