import { clearSession, getCurrentUser, getSessionToken, loginWithWechat } from '../../services/auth.js';
import { listFavorites, listRecentLocations } from '../../services/user.js';
import { applyPageSettings, readAppSettings } from '../../utils/app-settings.js';

Page({
  data: {
    authLoading: false,
    dataLoading: false,
    errorMessage: '',
    currentUser: null,
    isSignedIn: false,
    displayName: '霞客用户',
    identitySummary: '微信身份已连接',
    favorites: [],
    recentLocations: [],
    themeMode: 'system',
    resolvedThemeMode: 'light'
  },

  onLoad() {
    this.applySavedSettings();
    this.refreshSessionState();
    this.refreshUserData();
  },

  onShow() {
    this.applySavedSettings();
    this.refreshSessionState();
  },

  applySavedSettings() {
    applyPageSettings(this);
  },

  onAppSettingsChange(event) {
    this.setData(event.detail || readAppSettings());
  },

  refreshSessionState() {
    const currentUser = getCurrentUser();
    this.setData(buildSessionState(currentUser));
  },

  async login() {
    if (this.data.authLoading) return;
    this.setData({ authLoading: true, errorMessage: '' });
    try {
      const session = await loginWithWechat();
      this.setData(buildSessionState(session.user || session));
      await this.refreshUserData();
    } catch (error) {
      this.setData({ errorMessage: '登录失败，请稍后再试。' });
    } finally {
      this.setData({ authLoading: false });
    }
  },

  logout() {
    clearSession();
    this.setData({
      ...buildSessionState(null),
      favorites: [],
      recentLocations: [],
      errorMessage: ''
    });
  },

  async refreshUserData() {
    if (this.data.dataLoading) return;
    const token = getSessionToken();
    if (!token) {
      this.setData({
        favorites: [],
        recentLocations: []
      });
      return;
    }
    this.setData({ dataLoading: true, errorMessage: '' });
    try {
      const favorites = await listFavorites();
      const recentLocations = await listRecentLocations();
      this.setData({
        favorites: decorateLocations(favorites),
        recentLocations: decorateLocations(recentLocations)
      });
      this.refreshSessionState();
    } catch (error) {
      this.setData({ errorMessage: this.data.isSignedIn ? '用户数据暂时加载失败。' : '' });
    } finally {
      this.setData({ dataLoading: false });
    }
  },

  openLocation(event = {}) {
    const source = event.currentTarget?.dataset?.source || 'favorites';
    const index = Number(event.currentTarget?.dataset?.index);
    const list = this.data[source] || [];
    const location = list[index];
    if (!location) return;
    wx.navigateTo({ url: `/pages/home/index?location=${encodeURIComponent(location.name || location.locationName || '')}` });
  }
});

export function buildSessionState(currentUser) {
  const identities = Array.isArray(currentUser?.identities) ? currentUser.identities : [];
  const identityNames = identities.map((item) => identityLabel(item.provider)).filter(Boolean);
  const userId = currentUser?.userId || currentUser?.id || '';
  return {
    currentUser: currentUser || null,
    isSignedIn: Boolean(currentUser),
    displayName: userId ? `霞客 ${String(userId).slice(-6)}` : '霞客用户',
    identitySummary: identityNames.length ? `${identityNames.join('、')} 已连接` : '微信身份已连接'
  };
}

export function decorateLocations(locations = []) {
  return locations.map((location, index) => {
    const lat = Number(location.lat);
    const lon = Number(location.lon);
    const hasCoordinate = Number.isFinite(lat) && Number.isFinite(lon);
    const type = location.type || location.period || 'sunset';
    return {
      ...location,
      id: location.id || `${location.name || location.locationName || 'location'}-${index}`,
      name: location.name || location.locationName || location.location || '未命名地点',
      typeLabel: type === 'sunrise' ? '朝霞' : '晚霞',
      coordinateText: hasCoordinate ? `${lat.toFixed(4)}, ${lon.toFixed(4)}` : '位置待补充'
    };
  });
}

function identityLabel(provider) {
  const labels = {
    wechat: '微信',
    wechat_mini: '微信小程序',
    wechat_web: '微信网页',
    google: 'Google'
  };
  return labels[provider] || provider || '';
}
