import { configureApi } from './services/api.js';

App({
  globalData: {
    apiBaseUrl: 'https://sunset.bjhyc.online',
    sessionToken: null,
    currentUser: null,
    latestPrediction: null,
    recentQueries: [],
    favorites: []
  },

  services: {},

  onLaunch(options) {
    const sessionToken = wx.getStorageSync('sessionToken');
    const currentUser = wx.getStorageSync('currentUser');
    const latest = wx.getStorageSync('latestPrediction');
    const recent = wx.getStorageSync('recentQueries');
    const favorites = wx.getStorageSync('favoriteLocations');

    if (sessionToken) this.globalData.sessionToken = sessionToken;
    if (currentUser) this.globalData.currentUser = currentUser;
    if (latest) this.globalData.latestPrediction = latest;
    if (Array.isArray(recent)) this.globalData.recentQueries = recent;
    if (Array.isArray(favorites)) this.globalData.favorites = favorites;

    configureApi({
      baseUrl: this.globalData.apiBaseUrl,
      sessionToken: this.globalData.sessionToken
    });

    if (options && options.services) {
      this.services = options.services;
    }
  },

  setServices(services = {}) {
    this.services = services;
  },

  setSession(session = {}) {
    const sessionToken = session.sessionToken || session.token || null;
    const currentUser = session.user || session.currentUser || null;

    this.globalData.sessionToken = sessionToken;
    this.globalData.currentUser = currentUser;
    configureApi({ sessionToken });

    if (sessionToken) wx.setStorageSync('sessionToken', sessionToken);
    if (currentUser) wx.setStorageSync('currentUser', currentUser);
  },

  rememberQuery(query) {
    const locationName = query.locationName || query.location || '当前位置';
    const next = [
      { ...query, locationName, savedAt: Date.now() },
      ...this.globalData.recentQueries.filter((item) => item.locationName !== locationName)
    ].slice(0, 5);

    this.globalData.recentQueries = next;
    wx.setStorageSync('recentQueries', next);
  },

  saveLatestPrediction(prediction) {
    this.globalData.latestPrediction = prediction;
    wx.setStorageSync('latestPrediction', prediction);
  }
});
