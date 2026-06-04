import { reverseGeocode, searchLocations } from '../../services/geocoding.js';
import { getEnhancedPrediction, getEnhancedPredictionBatch, getHomeGateway, getSiteState, getWeatherForecast } from '../../services/prediction.js';
import { addFavorite, addRecentLocation, listRecentLocations } from '../../services/user.js';
import { formatVisitorCount, incrementVisitorCount } from '../../services/visitor.js';
import { trackMapView, trackPageVisit, trackShareClick } from '../../services/analytics.js';
import { applyPageSettings, readAppSettings, saveAppSettings as persistAppSettings } from '../../utils/app-settings.js';
import { buildRadarCloudGradients, paintRadarCloudCanvas } from '../../utils/radar-cloud-field.js';
import { getDefaultSunEventDay } from '../../utils/sun-event-day.js';

const app = getApp();
let cachedCanvasPixelRatio = null;

function getCachedCanvasPixelRatio(wxApi = wx) {
  if (cachedCanvasPixelRatio) return cachedCanvasPixelRatio;
  const deviceInfo = wxApi.getDeviceInfo?.() || {};
  const windowInfo = wxApi.getWindowInfo?.() || {};
  cachedCanvasPixelRatio = windowInfo.pixelRatio || deviceInfo.pixelRatio || 1;
  return cachedCanvasPixelRatio;
}

Page({
  data: {
    locationText: '',
    coordinate: null,
    period: 'sunset',
    day: getDefaultPredictionDay(),
    loading: false,
    loadingMessage: '正在查询位置',
    loadingProgress: 0,
    loadingDetail: '',
    locating: false,
    favoriteLoading: false,
    locationCandidates: [],
    homeMenuOpen: false,
    settingsOpen: false,
    interfaceLanguage: 'zh-CN',
    themeMode: 'system',
    resolvedThemeMode: 'light',
    weatherView: 'overview',
    weatherDay: getDefaultPredictionDay(),
    weatherParameter: 'temp',
    errorMessage: '',
    weatherPreview: buildDefaultWeatherPreview(),
    predictionPreview: buildDefaultPredictionPreview(),
    predictionPeriodCards: {},
    predictionPreviewLoading: false,
    recentQueries: [],
    favorites: [],
    visitorCountText: '--'
    ,
    siteState: {
      siteClosed: false,
      weatherPredictionClosed: false,
      shareMapAvailable: true,
      firecloudMapAvailable: true
    }
  },

  onLoad(options = {}) {
    trackPageVisit({ path: '/pages/home/index' });
    this.predictionService = options.predictionService || this.predictionService || null;
    this.applyDefaultPredictionDay();
    this.applySavedSettings();
    if (options.weatherTest === '1' || options.test === 'weather') {
      this.setData({
        weatherPreview: buildTestWeatherPreview(),
        predictionPreview: buildPredictionPreviewForPeriod(this.data.period, this.data.day)
      }, () => {
        this.paintPredictionRadarCloudField();
      });
    }
    this.refreshSavedLists();
    this.refreshVisitorCount();
    this.loadSiteState();
  },

  onShow() {
    this.applySavedSettings();
    this.refreshSavedLists();
    this.loadSiteState();
    this.paintPredictionRadarCloudField();
    this.paintHourlyChartLine({ force: true });
  },

  async loadSiteState() {
    try {
      const siteState = await getSiteState();
      this.setData({ siteState });
    } catch (error) {
      this.setData({
        siteState: {
          siteClosed: false,
          weatherPredictionClosed: false,
          shareMapAvailable: true,
          firecloudMapAvailable: true
        }
      });
    }
  },

  onUnload() {
    if (this.radarPaintTimer) {
      clearTimeout(this.radarPaintTimer);
      this.radarPaintTimer = null;
    }
    if (this.hourlyChartPaintTimer) {
      clearTimeout(this.hourlyChartPaintTimer);
      this.hourlyChartPaintTimer = null;
    }
  },

  refreshSavedLists() {
    const recent = app.globalData.recentQueries || wx.getStorageSync('recentQueries') || [];
    const favorites = app.globalData.favorites || wx.getStorageSync('favoriteLocations') || [];
    this.setData({
      recentQueries: decorateRecentQueries(recent),
      favorites
    });

    this.refreshRemoteRecentQueries();
  },

  async refreshRemoteRecentQueries() {
    if (this.refreshingRemoteRecent) return;
    this.refreshingRemoteRecent = true;
    try {
      const recent = await listRecentLocations();
      if (recent.length) {
        app.globalData.recentQueries = recent.slice(0, 5);
        wx.setStorageSync('recentQueries', app.globalData.recentQueries);
        this.setData({ recentQueries: decorateRecentQueries(app.globalData.recentQueries) });
      }
    } catch (error) {
      // Remote history is optional; local recent queries keep the page useful offline.
    } finally {
      this.refreshingRemoteRecent = false;
    }
  },

  onLocationChange(event) {
    this.selectedLocationCandidate = null;
    this.setData({ locationText: event.detail.value, coordinate: null, locationCandidates: [], errorMessage: '' });
  },

  selectPeriod(event) {
    const period = event.currentTarget.dataset.value;
    if (!['sunrise', 'sunset'].includes(period)) return;
    const patch = { period };
    if (!this.dayWasSelected) {
      const day = getDefaultPredictionDay(new Date(), { period, coordinate: this.data.coordinate });
      patch.day = day;
      patch.weatherDay = day;
    }
    this.setData(patch);
  },

  selectDay(event) {
    this.dayWasSelected = true;
    this.setData({ day: event.currentTarget.dataset.value });
  },

  selectPredictionPreviewPeriod(event) {
    const value = event.currentTarget.dataset.value;
    if (!['sunrise', 'sunset'].includes(value)) return;
    const tapStartedAt = perfNow();
    const cachedPrediction = this.data.predictionPeriodCards?.[value];
    const pendingPrediction = this.predictionPreviewPromises?.[value];
    logMiniPerf('home.toggle.tap', {
      target: value,
      current: this.data.period,
      cacheHit: Boolean(cachedPrediction),
      pendingHit: Boolean(pendingPrediction),
      cards: Object.keys(this.data.predictionPeriodCards || {})
    });
    if (cachedPrediction) {
      const buildStartedAt = perfNow();
      const predictionPreview = buildPredictionPreviewFromPrediction(cachedPrediction, this.currentPredictionQuery || { period: value });
      const builtAt = perfNow();
      const patch = {
        period: value,
        predictionPreview,
        predictionPreviewLoading: false
      };
      const setDataStartedAt = perfNow();
      this.setData(patch, () => {
        const setDataDoneAt = perfNow();
        logMiniPerf('home.toggle.cached.setDataDone', {
          target: value,
          totalMs: roundPerfMs(setDataDoneAt - tapStartedAt),
          buildMs: roundPerfMs(builtAt - buildStartedAt),
          setDataMs: roundPerfMs(setDataDoneAt - setDataStartedAt),
          payloadBytes: estimatePayloadBytes(patch),
          radarDirections: predictionPreview.radar?.directions?.length || 0
        });
        this.paintPredictionRadarCloudField({ source: 'home.toggle.cached', startedAt: tapStartedAt });
      });
      return;
    }

    if (pendingPrediction) {
      const setLoadingStartedAt = perfNow();
      this.setData({
        period: value,
        predictionPreviewLoading: true
      }, () => {
        logMiniPerf('home.toggle.pending.loadingSet', {
          target: value,
          setDataMs: roundPerfMs(perfNow() - setLoadingStartedAt)
        });
      });
      pendingPrediction.then((prediction) => {
        if (!prediction || this.data.period !== value) return;
        const buildStartedAt = perfNow();
        const predictionPreview = buildPredictionPreviewFromPrediction(prediction, this.currentPredictionQuery || { period: value });
        const patch = {
          predictionPreview,
          predictionPreviewLoading: false,
          predictionPeriodCards: {
            ...(this.data.predictionPeriodCards || {}),
            [value]: prediction
          }
        };
        const builtAt = perfNow();
        const setDataStartedAt = perfNow();
        this.setData(patch, () => {
          const setDataDoneAt = perfNow();
          logMiniPerf('home.toggle.pending.setDataDone', {
            target: value,
            totalMs: roundPerfMs(setDataDoneAt - tapStartedAt),
            buildMs: roundPerfMs(builtAt - buildStartedAt),
            setDataMs: roundPerfMs(setDataDoneAt - setDataStartedAt),
            payloadBytes: estimatePayloadBytes(patch)
          });
          this.paintPredictionRadarCloudField({ source: 'home.toggle.pending', startedAt: tapStartedAt });
        });
      }).catch(() => {
        if (this.data.period === value) this.setData({ predictionPreviewLoading: false });
      });
      return;
    }

    if (this.currentPredictionQuery?.coordinate) {
      const setLoadingStartedAt = perfNow();
      this.setData({
        period: value,
        predictionPreviewLoading: true
      }, () => {
        logMiniPerf('home.toggle.fetch.loadingSet', {
          target: value,
          setDataMs: roundPerfMs(perfNow() - setLoadingStartedAt)
        });
      });
      const fetchStartedAt = perfNow();
      this.prefetchPredictionPreviewPeriod({ ...this.currentPredictionQuery, period: value })
        .then((prediction) => {
          if (!prediction || this.data.period !== value) return;
          const buildStartedAt = perfNow();
          const predictionPreview = buildPredictionPreviewFromPrediction(prediction, this.currentPredictionQuery || { period: value });
          const patch = {
            predictionPreview,
            predictionPreviewLoading: false,
            predictionPeriodCards: {
              ...(this.data.predictionPeriodCards || {}),
              [value]: prediction
            }
          };
          const builtAt = perfNow();
          const setDataStartedAt = perfNow();
          this.setData(patch, () => {
            const setDataDoneAt = perfNow();
            logMiniPerf('home.toggle.fetch.setDataDone', {
              target: value,
              totalMs: roundPerfMs(setDataDoneAt - tapStartedAt),
              fetchMs: roundPerfMs(builtAt - fetchStartedAt),
              buildMs: roundPerfMs(builtAt - buildStartedAt),
              setDataMs: roundPerfMs(setDataDoneAt - setDataStartedAt),
              payloadBytes: estimatePayloadBytes(patch)
            });
            this.paintPredictionRadarCloudField({ source: 'home.toggle.fetch', startedAt: tapStartedAt });
          });
        })
        .catch(() => {
          if (this.data.period === value) this.setData({ predictionPreviewLoading: false });
        });
      return;
    }

    const fallbackPatch = {
      period: value,
      predictionPreview: buildPredictionPreviewForPeriod(value, this.data.day)
    };
    const setDataStartedAt = perfNow();
    this.setData(fallbackPatch, () => {
      logMiniPerf('home.toggle.fallback.setDataDone', {
        target: value,
        totalMs: roundPerfMs(perfNow() - tapStartedAt),
        setDataMs: roundPerfMs(perfNow() - setDataStartedAt),
        payloadBytes: estimatePayloadBytes(fallbackPatch)
      });
      this.paintPredictionRadarCloudField({ source: 'home.toggle.fallback', startedAt: tapStartedAt });
    });
  },

  async refreshVisitorCount() {
    if (this.visitorCountRequested) return;
    this.visitorCountRequested = true;
    try {
      const count = await incrementVisitorCount();
      this.setData({ visitorCountText: formatVisitorCount(count) });
    } catch (error) {
      this.setData({ visitorCountText: '--' });
    }
  },

  onShareAppMessage() {
    trackShareClick({ path: '/pages/home/index', targetLabel: 'home-share' });
    return buildHomeShareMessage(this.data.predictionPreview, this.currentPredictionQuery || {});
  },

  switchWeatherView(event) {
    const view = event.currentTarget.dataset.view;
    if (!['overview', 'hourly', 'glow'].includes(view)) return;
    this.setData({ weatherView: view }, () => {
      if (view === 'hourly') this.paintHourlyChartLine({ force: true });
    });
  },

  switchWeatherDay(event) {
    const day = event.currentTarget.dataset.day;
    if (!['today', 'tomorrow'].includes(day)) return;
    this.setData({
      weatherDay: day,
      weatherPreview: refreshWeatherHourlyView(this.data.weatherPreview, day, this.data.weatherParameter)
    }, () => {
      this.paintHourlyChartLine({ force: true });
    });
  },

  switchWeatherParameter(event) {
    const parameter = event.currentTarget.dataset.param;
    if (!['temp', 'precip', 'humidity', 'wind', 'pressure', 'clouds'].includes(parameter)) return;
    this.setData({
      weatherParameter: parameter,
      weatherPreview: refreshWeatherHourlyView(this.data.weatherPreview, this.data.weatherDay, parameter)
    }, () => {
      this.paintHourlyChartLine({ force: true });
    });
  },

  toggleHomeMenu() {
    this.setData({ homeMenuOpen: !this.data.homeMenuOpen });
  },

  openSettings() {
    this.setData({ homeMenuOpen: false, settingsOpen: true });
  },

  toggleSettings() {
    this.setData({
      homeMenuOpen: false,
      settingsOpen: !this.data.settingsOpen
    });
  },

  closeSettings() {
    this.setData({ settingsOpen: false });
  },

  navigateFeature(event) {
    const target = event.currentTarget.dataset.target;
    if (target === 'settings') {
      this.openSettings();
      return;
    }
    const routes = {
      forecast: '',
      methodology: '/pages/methodology/index',
      map: `/pages/map/index?period=${this.data.period}`,
      gallery: '/pages/gallery/index'
    };
    const url = routes[target];
    this.setData({ homeMenuOpen: false });
    if (!url) return;
    if (target === 'map') trackMapView({ path: '/pages/home/index', targetLabel: 'home-menu-map' });
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
    applyPageSettings(this);
  },

  applyDefaultPredictionDay() {
    if (this.dayWasSelected) return;
    const day = getDefaultPredictionDay(new Date(), {
      period: this.data.period,
      coordinate: this.data.coordinate
    });
    if (this.data.day === day && this.data.weatherDay === day) return;
    this.setData({ day, weatherDay: day });
  },

  saveAppSettings(patch = {}) {
    const settings = persistAppSettings(patch, this.data);
    this.setData(settings);
  },

  onAppSettingsChange(event) {
    this.setData(event.detail || readAppSettings());
  },

  async useHistory(event) {
    const index = event.currentTarget.dataset.index;
    const item = this.data.recentQueries[index] || null;
    const location = event.currentTarget.dataset.location;
    const lat = toNumberOrNull(event.currentTarget.dataset.lat);
    const lon = toNumberOrNull(event.currentTarget.dataset.lon);
    if (item) {
      this.setData({
        locationText: item.locationName || item.name || location,
        coordinate: item.lat !== null && item.lon !== null ? { lat: item.lat, lon: item.lon } : item.coordinate || null,
        period: item.type || item.period || this.data.period,
        day: item.day || this.data.day,
        errorMessage: ''
      });
      await this.onSearch();
      return;
    }
    if (location) {
      this.setData({
        locationText: location,
        coordinate: lat !== null && lon !== null ? { lat, lon } : null,
        errorMessage: ''
      });
      await this.onSearch();
    }
  },

  async onUseCurrentLocation() {
    if (this.data.locating) return;
    this.setData({ locating: true, errorMessage: '' });

    try {
      const res = await wxPromise(wx.getLocation, { type: 'wgs84' });
      const reverseName = await reverseGeocode(res.latitude, res.longitude).catch(() => '');
      const locationText = reverseName || '当前位置';
      this.setData({
        coordinate: { lat: res.latitude, lon: res.longitude },
        locationText,
        locationCandidates: []
      });
      await this.onSearch();
    } catch (error) {
      this.setData({ errorMessage: '无法获取当前位置，请检查定位权限或手动输入地点。' });
    } finally {
      this.setData({ locating: false });
    }
  },

  async onSearch() {
    if (this.data.siteState?.weatherPredictionClosed) return;
    const locationText = (this.data.locationText || '').trim();
    if (this.data.loading) return;

    if (isWeatherTestLocation(locationText)) {
      this.startSearchLoading('正在读取测试天气', 64, '生成天气卡片与朝晚霞面板');
      await waitForLoadingFrame();
      this.setSearchLoadingStep('正在整理天气卡片', 92, '准备云况雷达与预测摘要');
      this.setData({
        weatherPreview: buildTestWeatherPreview(),
        predictionPreview: buildPredictionPreviewForPeriod(this.data.period, this.data.day),
        errorMessage: '',
        loading: false
      }, () => {
        this.paintPredictionRadarCloudField();
      });
      return;
    }

    if (!locationText && !this.data.coordinate) {
      this.setData({ errorMessage: '先输入地点，或使用当前位置。' });
      return;
    }

    this.startSearchLoading('正在查询位置', 36, '匹配城市坐标');

    try {
      const resolvedLocation = await this.resolveLocation(locationText);
      this.currentResolvedLocation = resolvedLocation;
      const defaultDay = this.dayWasSelected
        ? resolveQueryDay(this.data.day)
        : getDefaultPredictionDay(new Date(), {
            period: this.data.period,
            coordinate: { lat: resolvedLocation.lat, lon: resolvedLocation.lon }
          });
      const query = {
        location: resolvedLocation.name,
        locationName: resolvedLocation.name,
        coordinate: { lat: resolvedLocation.lat, lon: resolvedLocation.lon },
        period: this.data.period,
        day: defaultDay
      };
      this.currentPredictionQuery = query;
      this.predictionPreviewPromises = {};
      this.setSearchLoadingStep('正在读取基础天气', 58, '先展示温度、风、湿度、能见度、气压和降水');
      const gatewayPromise = this.callHomeGateway(query)
        .then(data => ({ data }))
        .catch(error => ({ error }));
      const earlyGateway = await Promise.race([
        gatewayPromise,
        new Promise(resolve => setTimeout(() => resolve(null), 900))
      ]);
      if (earlyGateway?.data) {
        this.applyUnifiedHomeGatewayResult(earlyGateway.data, query);
        return;
      }

      let weather = null;
      try {
        weather = await this.callWeatherForecast(query);
        this.setData({
          weatherPreview: buildWeatherPreview({ ...weather, location: query.locationName }),
          predictionPreview: buildPredictionPreviewLoading(query.period, query.day, weather),
          predictionPreviewLoading: true,
          weatherView: 'overview',
          weatherDay: query.day,
          weatherParameter: 'temp'
        }, () => {
          this.paintPredictionRadarCloudField();
        });
        this.setSearchLoadingStep('正在计算霞光评分', 82, '基础天气已就绪，继续计算朝晚霞条件');
      } catch (weatherError) {
        this.setSearchLoadingStep('正在计算霞光评分', 72, '基础天气暂未返回，继续读取综合预测');
      }
      const gatewayResult = await gatewayPromise;
      let predictionCards;
      let prediction;
      if (gatewayResult?.data) {
        predictionCards = gatewayResult.data.predictionCards;
        prediction = gatewayResult.data.prediction;
        weather = gatewayResult.data.weather || weather;
      } else {
        predictionCards = await this.callPredictionCardBatch(query);
        prediction = predictionCards[query.period] || await this.prefetchPredictionPreviewPeriod(query);
      }
      this.setSearchLoadingStep('正在整理天气卡片', 92, '准备天气面板与云况雷达');
      app.rememberQuery(query);
      this.recordRecentLocation(query);
      app.saveLatestPrediction(prediction);

      this.setData({
        weatherPreview: buildWeatherPreview({ ...weather, location: query.locationName }),
        ...buildHomePredictionSurface(prediction, query),
        predictionPeriodCards: predictionCards,
        predictionPreviewLoading: false,
        weatherView: 'overview',
        weatherDay: query.day,
        weatherParameter: 'temp'
      }, () => {
        this.paintPredictionRadarCloudField();
      });
    } catch (error) {
      if (error && error.message === 'LOCATION_NEEDS_CONFIRMATION') {
        return;
      }
      this.setData({
        errorMessage: friendlyError(error),
        predictionPreviewLoading: false
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  startSearchLoading(message, progress, detail = '') {
    this.setData({
      loading: true,
      errorMessage: '',
      loadingMessage: message,
      loadingProgress: clampProgress(progress),
      loadingDetail: detail
    });
  },

  setSearchLoadingStep(message, progress, detail = '') {
    if (!this.data.loading) return;
    this.setData({
      loadingMessage: message,
      loadingProgress: clampProgress(progress),
      loadingDetail: detail
    });
  },

  paintPredictionRadarCloudField({ force = false, source = 'home.paint', startedAt = null } = {}) {
    const directions = this.data.predictionPreview?.radar?.directions || [];
    if (!directions.length) return;
    const signature = directions.map((item) => [
      item.direction,
      item.scoreText,
      item.highCloud,
      item.midCloud,
      item.lowCloud,
      item.cloudText
    ].map((value) => value ?? '').join(':')).join('|');
    if (!force && signature && signature === this.lastRadarPaintSignature) {
      logMiniPerf('home.radar.skipSameSignature', { source, sinceStartMs: startedAt === null ? null : roundPerfMs(perfNow() - startedAt) });
      return;
    }
    this.lastRadarPaintSignature = signature;
    if (this.radarPaintTimer) clearTimeout(this.radarPaintTimer);
    const scheduledAt = perfNow();
    logMiniPerf('home.radar.schedule', { source, directions: directions.length, sinceStartMs: startedAt === null ? null : roundPerfMs(scheduledAt - startedAt) });
    this.radarPaintTimer = setTimeout(() => {
      this.radarPaintTimer = null;
      const paintStartedAt = perfNow();
      const requested = paintRadarCloudCanvas('homeRadarCloudField', directions, {
        page: this,
        onProfile: (payload) => logMiniPerf('home.radar.canvas', { source, ...payload })
      });
      logMiniPerf('home.radar.requested', {
        source,
        requested,
        timerWaitMs: roundPerfMs(paintStartedAt - scheduledAt),
        requestMs: roundPerfMs(perfNow() - paintStartedAt)
      });
    }, 80);
  },

  paintHourlyChartLine({ force = false } = {}) {
    if (this.data.weatherView !== 'hourly') return;
    const chart = this.data.weatherPreview?.hourlyChart || this.data.weatherPreview?.hourlyView?.chart || [];
    if (chart.length < 2) return;
    const signature = chart.map((item) => `${item.left}:${item.top}:${item.valueText}`).join('|');
    if (!force && signature && signature === this.lastHourlyChartPaintSignature) return;
    this.lastHourlyChartPaintSignature = signature;
    if (this.hourlyChartPaintTimer) clearTimeout(this.hourlyChartPaintTimer);
    this.hourlyChartPaintTimer = setTimeout(() => {
      this.hourlyChartPaintTimer = null;
      paintHourlyChartCanvas('homeHourlyChart', chart, { page: this });
    }, 80);
  },

  async resolveLocation(locationText) {
    if (this.data.coordinate) {
      return {
        name: locationText || '当前位置',
        lat: this.data.coordinate.lat,
        lon: this.data.coordinate.lon
      };
    }

    const results = await searchLocations(locationText, 5);
    if (!results.length) {
      throw new Error('LOCATION_NOT_FOUND');
    }

    const selected = this.selectedLocationCandidate;
    if (selected && selected.query === locationText) {
      return selected.location;
    }

    if (shouldAskLocationChoice(locationText, results)) {
      this.setData({
        locationCandidates: decorateLocationCandidates(results, locationText),
        errorMessage: ''
      });
      throw new Error('LOCATION_NEEDS_CONFIRMATION');
    }

    return results[0];
  },

  async selectLocationCandidate(event) {
    const index = Number(event.detail?.index ?? event.currentTarget?.dataset?.index);
    const item = this.data.locationCandidates[index];
    if (!item) return;
    const location = {
      name: item.name,
      lat: item.lat,
      lon: item.lon,
      countryCode: item.countryCode,
      regionCode: item.regionCode
    };
    this.selectedLocationCandidate = { query: this.data.locationText.trim(), location };
    this.setData({
      locationText: item.name,
      coordinate: { lat: item.lat, lon: item.lon },
      locationCandidates: [],
      errorMessage: ''
    });
    await this.onSearch();
  },

  async onAddCurrentFavorite() {
    if (this.data.favoriteLoading) return;
    const location = this.currentResolvedLocation || buildFavoriteFromState(this.data);
    if (!location) {
      this.setData({ errorMessage: '请先查询或选择一个地点，再收藏。' });
      return;
    }

    this.setData({ favoriteLoading: true, errorMessage: '' });
    try {
      const favorites = app.globalData.favorites || wx.getStorageSync('favoriteLocations') || [];
      const next = upsertFavorite(favorites, location);
      app.globalData.favorites = next;
      wx.setStorageSync('favoriteLocations', next);
      this.setData({ favorites: next });
      await addFavorite(location).catch(() => null);
      if (wx.showToast) wx.showToast({ title: '已收藏', icon: 'success' });
    } finally {
      this.setData({ favoriteLoading: false });
    }
  },

  callPredictionService(query) {
    const services = app.services || {};
    const candidates = [
      this.predictionService,
      services.prediction,
      services.predictionService,
      services.sunsetPrediction,
      services.sunsetPredictionService
    ].filter(Boolean);

    const methodNames = ['predict', 'query', 'getPrediction', 'getSunsetPrediction', 'generatePrediction'];
    for (const service of candidates) {
      for (const name of methodNames) {
        if (typeof service[name] === 'function') {
          return service[name](query);
        }
      }
      if (typeof service === 'function') {
        return service(query);
      }
    }

    const date = resolvePredictionDate(query.day);
    return getEnhancedPrediction({
      lat: query.coordinate.lat,
      lon: query.coordinate.lon,
      type: query.period,
      date
    });
  },

  callWeatherForecast(query) {
    const services = app.services || {};
    const candidates = [
      services.weather,
      services.weatherService
    ].filter(Boolean);

    for (const service of candidates) {
      if (typeof service.getForecast === 'function') return service.getForecast(query);
      if (typeof service.forecast === 'function') return service.forecast(query);
      if (typeof service === 'function') return service(query);
    }

    return getWeatherForecast({
      lat: query.coordinate.lat,
      lon: query.coordinate.lon,
      hours: 168
    });
  },

  async callHomeGateway(query) {
    const date = resolvePredictionDate(query.day);
    const gateway = await getHomeGateway({
      lat: query.coordinate.lat,
      lon: query.coordinate.lon,
      date,
      period: query.period,
      days: 3,
      includeRemoteCloudData: true
    });
    const cards = {};
    for (const period of ['sunrise', 'sunset']) {
      const day = this.dayWasSelected
        ? query.day
        : getDefaultPredictionDay(new Date(), { period, coordinate: query.coordinate });
      const prediction = pickGatewayPredictionCard(gateway, period, query, day);
      if (prediction) {
        cards[period] = prediction;
      }
    }
    const prediction = cards[query.period] || cards.sunset || cards.sunrise;
    if (!prediction) {
      throw new Error('UNIFIED_GATEWAY_EMPTY_PREDICTION');
    }
    return {
      gateway,
      weather: gateway.weather,
      prediction,
      predictionCards: cards
    };
  },

  applyUnifiedHomeGatewayResult(unified, query) {
    app.rememberQuery(query);
    this.recordRecentLocation(query);
    app.saveLatestPrediction(unified.prediction);

    this.setData({
      weatherPreview: buildWeatherPreview({ ...unified.weather, location: query.locationName }),
      predictionPreviewLoading: false,
      predictionPeriodCards: unified.predictionCards,
      ...buildHomePredictionSurface(unified.prediction, query),
      weatherView: 'overview',
      weatherDay: query.day,
      weatherParameter: 'temp'
    }, () => {
      this.paintPredictionRadarCloudField();
    });
  },

  async callPredictionCardBatch(query) {
    const date = resolvePredictionDate(query.day);
    const periods = query.period === 'sunrise' ? ['sunrise', 'sunset'] : ['sunset', 'sunrise'];
    const items = periods.map((period) => ({ id: period, type: period, date }));
    try {
      const rows = await getEnhancedPredictionBatch({
        lat: query.coordinate.lat,
        lon: query.coordinate.lon,
        items,
        includeRemoteCloudData: true
      });
      const cards = {};
      rows.forEach((prediction, index) => {
        const period = prediction.period || prediction.type || items[index]?.type;
        if (period) cards[period] = compactPredictionPreviewPayload(normalizePrediction(prediction, { ...query, period }));
      });
      if (cards[query.period]) return cards;
    } catch (error) {
      // Fall back to the single-card path below; search should remain usable if batch is unavailable.
    }

    const raw = await this.callPredictionService(query);
    return {
      [query.period]: compactPredictionPreviewPayload(normalizePrediction(raw, query))
    };
  },

  async prefetchPredictionPreviewPeriod(query) {
    const raw = await this.callPredictionService(query);
    return compactPredictionPreviewPayload(normalizePrediction(raw, query));
  },

  async recordRecentLocation(query) {
    try {
      await addRecentLocation(buildRecentLocation(query));
    } catch (error) {
      // Local app.rememberQuery already captured the interaction.
    }
  }
});

export function buildRecentLocation(query = {}) {
  const day = resolveQueryDay(query.day);
  return {
    name: query.locationName || query.location || '当前位置',
    locationName: query.locationName || query.location || '当前位置',
    lat: query.coordinate?.lat ?? query.lat,
    lon: query.coordinate?.lon ?? query.lon,
    type: query.period || query.type || 'sunset',
    day,
    date: resolvePredictionDate(day)
  };
}

export function buildHomeShareMessage(preview = {}, query = {}) {
  const locationName = query.locationName || query.location || preview.locationName || '这个地点';
  const period = preview.periodKey || query.period || query.type || 'sunset';
  const periodLabel = preview.periodLabel || (period === 'sunrise' ? '朝霞' : '晚霞');
  const scoreNumber = Number(preview.score);
  const scoreText = Number.isFinite(scoreNumber) ? `${Math.round(scoreNumber)}分` : '值得一看';
  return {
    title: `霞客｜${locationName}${periodLabel}评分 ${scoreText}`,
    path: buildHomeSharePath(preview, query)
  };
}

export function buildHomeSharePath(preview = {}, query = {}) {
  const lat = query.coordinate?.lat ?? query.lat ?? preview.lat;
  const lon = query.coordinate?.lon ?? query.lon ?? query.lng ?? preview.lon ?? preview.lng;
  const locationName = query.locationName || query.location || preview.locationName || '';
  const period = preview.periodKey || query.period || query.type || 'sunset';
  const date = normalizeDateKey(preview.date) || normalizeDateKey(preview.referenceTime) || query.date || resolvePredictionDate(resolveQueryDay(query.day));
  const params = {
    lat,
    lon,
    name: locationName,
    type: period,
    date
  };
  const queryString = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  return lat !== undefined && lat !== null && lon !== undefined && lon !== null
    ? `/pages/result/index?${queryString}`
    : '/pages/home/index';
}

export function getDefaultPredictionDay(now = new Date(), options = {}) {
  return getDefaultSunEventDay(now, options);
}

export function resolveQueryDay(day) {
  return day === 'today' || day === 'tomorrow' ? day : getDefaultPredictionDay();
}

export function shouldAskLocationChoice(query = '', results = []) {
  if (!Array.isArray(results) || results.length < 2) return false;
  const tokens = splitPlaceTokens(query);
  if (tokens.length > 1) {
    const matchedTokens = new Set();
    results.slice(0, 5).forEach((item) => {
      const name = normalizePlaceText(item.name);
      tokens.forEach((token) => {
        if (name.includes(token)) matchedTokens.add(token);
      });
    });
    if (matchedTokens.size > 1) return true;
  }
  const q = normalizePlaceText(query);
  if (!q) return false;
  const top = results[0] || {};
  const second = results[1] || {};
  const topCountry = (top.countryCode || '').toUpperCase();
  const secondCountry = (second.countryCode || '').toUpperCase();
  if (topCountry && secondCountry && topCountry !== secondCountry) return true;
  const topName = normalizePlaceText(top.name);
  const secondName = normalizePlaceText(second.name);
  return topName.includes(q) && secondName.includes(q);
}

function decorateLocationCandidates(results = [], query = '') {
  return results.slice(0, 5).map((item, index) => ({
    ...item,
    key: `${item.lat}:${item.lon}:${index}`,
    meta: buildLocationCandidateMeta(item, query)
  }));
}

function buildLocationCandidateMeta(item = {}, query = '') {
  const parts = [
    item.countryCode,
    item.regionCode,
    item.address && item.address !== item.name ? item.address : ''
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : `匹配 "${query}"`;
}

function buildFavoriteFromState(data = {}) {
  const coordinate = data.coordinate || null;
  const name = String(data.locationText || '').trim();
  if (!coordinate || !name) return null;
  return { name, locationName: name, lat: coordinate.lat, lon: coordinate.lon, type: data.period || 'sunset', day: data.day || 'today' };
}

function upsertFavorite(favorites = [], location = {}) {
  const normalized = {
    name: location.name || location.locationName || '当前位置',
    locationName: location.locationName || location.name || '当前位置',
    lat: Number(location.lat ?? location.coordinate?.lat),
    lon: Number(location.lon ?? location.coordinate?.lon),
    type: location.type || location.period || 'sunset',
    day: location.day || 'today'
  };
  if (!Number.isFinite(normalized.lat) || !Number.isFinite(normalized.lon)) return favorites;
  return [
    normalized,
    ...favorites.filter((item) => Math.abs(Number(item.lat) - normalized.lat) > 0.000001 || Math.abs(Number(item.lon) - normalized.lon) > 0.000001)
  ].slice(0, 20);
}

function normalizePlaceText(value = '') {
  return String(value).toLowerCase().replace(/[\s,，市省州县区镇乡·\-]/g, '');
}

function splitPlaceTokens(value = '') {
  return String(value)
    .split(/[\s,，、/|]+/)
    .map(normalizePlaceText)
    .filter(Boolean);
}

export function buildDefaultWeatherPreview() {
  return {
    visible: false,
    title: '天气信息',
    description: '查询后先看当前天气，再进入预测结果。',
    badge: '7天概览',
    location: '--',
    iconType: 'cloud',
    iconSrc: '/assets/icons/weather-cloud.svg',
    condition: '--',
    temperature: '--',
    temperatureUnit: '°C',
    windSpeed: '--',
    windDirection: '--',
    weekly: [],
    hourly: [],
    hourlyChart: [],
    hourlyView: buildWeatherHourlyViewModel([], 'temp'),
    glow: [],
    weeklyTab: '7天概览',
    hourlyTab: '24小时预报',
    glowTab: '3天朝晚霞',
    metrics: [
      { key: 'humidity', label: '湿度', value: '--' },
      { key: 'cloud', label: '云量', value: '--' },
      { key: 'pressure', label: '气压', value: '--' },
      { key: 'visibility', label: '能见度', value: '--' },
      { key: 'aerosol', label: '气溶胶', value: '--' },
      { key: 'precipitation', label: '降水', value: '--' }
    ],
    note: '3天朝晚霞趋势会跟随查询结果一起查看'
  };
}

export function buildTestWeatherPreview() {
  return buildWeatherPreview({
    provider: 'test',
    highClouds: 62,
    midClouds: 54,
    lowClouds: 43,
    humidity: 72,
    visibility: 13.2,
    windDirection: '西',
    windSpeed: 11,
    pressure: 1007,
    aod: 0.11,
    temp: 19.9,
    precipitation: 0,
    location: 'TEST',
    condition: '多云'
  });
}

export function buildDefaultPredictionPreview() {
  return {
    dateLabel: '今日',
    periodKey: 'sunset',
    periodLabel: '晚霞',
    conclusion: '输入地点后生成结论、评分、最佳时间窗和形成条件分析。',
    score: '--',
    scoreLabel: '等待查询',
    scoreDesc: '与网页 test 预测卡保持同一阅读顺序',
    eventTimeLabel: '日落时间',
    mainTime: '--:--',
    bestViewingTime: '--',
    directionLabel: '太阳方向',
    direction: '--',
    clouds: [
      { key: 'high', label: '高云', value: 0 },
      { key: 'mid', label: '中云', value: 0 },
      { key: 'low', label: '低云', value: 0 }
    ],
    analysis: [
      {
        key: 'carrier',
        title: '云层载体',
        status: '待判断',
        tone: 'fair',
        desc: '查询后判断中高云是否能承接霞光。'
      },
      {
        key: 'lightPath',
        title: '光路条件',
        status: '待判断',
        tone: 'fair',
        desc: '查询后判断太阳方向是否有遮挡。'
      },
      {
        key: 'rendering',
        title: '空气显色',
        status: '待判断',
        tone: 'fair',
        desc: '查询后结合能见度、湿度和气溶胶判断颜色表现。'
      }
    ]
  };
}

export function buildPredictionPreviewLoading(period = 'sunset', day = 'today', weather = {}) {
  const preview = buildPredictionPreviewFromPrediction({
    period,
    day,
    weatherData: weather,
    clouds: {
      high: weather.highClouds,
      mid: weather.midClouds,
      low: weather.lowClouds
    },
    explanation: '基础天气已加载，正在计算霞光评分。'
  }, { period, day });

  return {
    ...preview,
    score: '--',
    scoreLabel: '计算中',
    scoreDesc: '基础天气已就绪',
    conclusion: '基础天气已加载，正在计算霞光评分。',
    mainTime: '--:--',
    bestViewingTime: '--'
  };
}

export function buildTestPredictionPreview() {
  return {
    dateLabel: '今日',
    periodKey: 'sunset',
    periodLabel: '晚霞',
    conclusion: '高云较充足、低云较少，具备可观赏的晚霞基础。',
    score: 76,
    scoreLabel: '高分 Strong',
    scoreDesc: '观赏条件不错',
    eventTimeLabel: '日落时间',
    mainTime: '18:58',
    bestViewingTime: '18:28-19:18',
    directionLabel: '日落方向',
    direction: '西偏北',
    clouds: [
      { key: 'high', label: '高云', value: 62 },
      { key: 'mid', label: '中云', value: 36 },
      { key: 'low', label: '低云', value: 8 }
    ],
    analysis: [
      {
        key: 'carrier',
        title: '云层载体',
        status: '较好',
        tone: 'good',
        desc: '中高云能承接日落光线，是今天主要的显色画布。'
      },
      {
        key: 'lightPath',
        title: '光路条件',
        status: '较好',
        tone: 'good',
        desc: '低云较少，太阳方向相对通透，光线有机会照到云底。'
      },
      {
        key: 'rendering',
        title: '空气显色',
        status: '一般',
        tone: 'fair',
        desc: '湿度和 AOD 适中，颜色表现主要看临近日落时段云层变化。'
      }
    ]
  };
}

export function buildPredictionPreviewForPeriod(period = 'sunset', day = getDefaultPredictionDay()) {
  const dateLabel = day === 'tomorrow' ? '明日' : '今日';
  if (period === 'sunrise') {
    return buildCompletePredictionPreview({
      dateLabel,
      periodKey: 'sunrise',
      periodLabel: '朝霞',
      conclusion: '东侧中高云较合适，低云遮挡偏少，具备可观赏的朝霞基础。',
      score: 58,
      scoreLabel: '可观 Watch',
      scoreDesc: '建议提前观察',
      eventTimeLabel: '日出时间',
      mainTime: '05:04',
      bestViewingTime: '04:42-05:22',
      directionLabel: '日出方向',
      direction: '东偏北',
      clouds: [
        { key: 'high', label: '高云', value: 38 },
        { key: 'mid', label: '中云', value: 48 },
        { key: 'low', label: '低云', value: 14 }
      ]
    });
  }

  return buildCompletePredictionPreview({
    ...buildTestPredictionPreview(),
    dateLabel
  });
}

export function buildHomePredictionSurface(prediction = {}, query = {}) {
  const weather = buildWeatherFromPrediction(prediction, query);
  return {
    weatherPreview: buildWeatherPreview(weather),
    predictionPreview: buildPredictionPreviewFromPrediction(prediction, query)
  };
}

export function buildPredictionPreviewFromPrediction(prediction = {}, query = {}) {
  const period = prediction.period || prediction.type || query.period || 'sunset';
  const periodLabel = period === 'sunrise' ? '朝霞' : '晚霞';
  const clouds = extractCloudLayers(prediction);
  const weather = buildWeatherFromPrediction(prediction, query);
  const score = Number(prediction.score ?? prediction.totalScore ?? prediction.finalScore);
  const preview = {
    dateLabel: prediction.day === 'tomorrow' || query.day === 'tomorrow' ? '明日' : '今日',
    periodKey: period,
    periodLabel,
    date: normalizeDateKey(prediction.date) || normalizeDateKey(prediction.referenceTime) || null,
    referenceTime: prediction.referenceTime || null,
    locationName: prediction.locationName || prediction.location || query.locationName || query.location || '',
    lat: prediction.lat ?? prediction.latitude ?? query.coordinate?.lat ?? query.lat ?? null,
    lon: prediction.lon ?? prediction.lng ?? prediction.longitude ?? query.coordinate?.lon ?? query.lon ?? null,
    eventTimeLabel: period === 'sunrise' ? '日出时间' : '日落时间',
    mainTime: compactBestTime(prediction.mainTime || prediction.eventTime || prediction.referenceTime || prediction.bestWindow || prediction.date),
    bestViewingTime: formatBestWindow(prediction.bestWindow || prediction.window || prediction.timeWindow || prediction.goldenHour || prediction.referenceTime || prediction.date),
    directionLabel: period === 'sunrise' ? '日出方向' : '日落方向',
    direction: prediction.direction || prediction.sunDirection || prediction.lightPathAnalysis?.directionalAnalysis?.direction || (period === 'sunrise' ? '东偏北' : '西偏北'),
    score: Number.isFinite(score) ? Math.round(score) : '--',
    scoreLabel: prediction.scoreLabel || buildScoreLabel(score),
    scoreDesc: prediction.scoreDesc || (Number.isFinite(score) && score >= 70 ? '观赏条件不错' : '建议提前观察'),
    conclusion: humanizePredictionConclusion(
      prediction.conclusion || prediction.explanation || prediction.summary?.description,
      score,
      periodLabel
    ),
    clouds: [
      { key: 'high', label: '高云', value: toDisplayNumber(clouds.high) },
      { key: 'mid', label: '中云', value: toDisplayNumber(clouds.mid) },
      { key: 'low', label: '低云', value: toDisplayNumber(clouds.low) }
    ],
    visibility: weather.visibility,
    humidity: weather.humidity,
    aod: weather.aod ?? weather.aerosolOpticalDepth
  };
  return buildCompletePredictionPreview(preview);
}

export function compactPredictionPreviewPayload(prediction = {}) {
  const summary = prediction.summary;
  return {
    score: prediction.score ?? prediction.totalScore ?? prediction.finalScore,
    quality: prediction.quality || prediction.status || null,
    grade: prediction.grade || prediction.quality || prediction.level || null,
    period: prediction.period || prediction.type || null,
    type: prediction.type || prediction.period || null,
    day: prediction.day || null,
    date: prediction.date || prediction.referenceTime || null,
    referenceTime: prediction.referenceTime || null,
    bestWindow: prediction.bestWindow || prediction.bestViewingWindow || prediction.window || prediction.timeWindow || prediction.goldenHour || null,
    mainTime: prediction.mainTime || prediction.eventTime || null,
    eventTime: prediction.eventTime || null,
    direction: prediction.direction || null,
    sunDirection: prediction.sunDirection || null,
    locationName: prediction.locationName || prediction.location || null,
    location: prediction.location || prediction.locationName || null,
    lat: prediction.lat ?? prediction.latitude ?? prediction.coordinate?.lat ?? null,
    lon: prediction.lon ?? prediction.lng ?? prediction.longitude ?? prediction.coordinate?.lon ?? null,
    scoreLabel: prediction.scoreLabel || null,
    scoreDesc: prediction.scoreDesc || null,
    conclusion: prediction.conclusion || null,
    explanation: prediction.explanation || null,
    summary: typeof summary === 'string'
      ? summary
      : (summary ? {
        description: summary.description || '',
        advice: summary.advice || '',
        status: summary.status || summary.quality || null
      } : null),
    clouds: compactPredictionMetrics(prediction.clouds || prediction.cloudLayers || {}),
    metrics: compactPredictionMetrics(prediction.metrics || {}),
    weatherData: compactPredictionMetrics(prediction.weatherData || prediction.weather || {}),
    breakdown: prediction.breakdown || null,
    canvasAnalysis: prediction.canvasAnalysis || null,
    lightPathAnalysis: compactLightPathAnalysis(prediction.lightPathAnalysis),
    renderingAnalysis: prediction.renderingAnalysis || null,
    lightPathGate: prediction.lightPathGate || null,
    renderingAdjustment: prediction.renderingAdjustment || null,
    cloudThickness: prediction.cloudThickness || null,
    cloudThicknessAdjustment: prediction.cloudThicknessAdjustment || null,
    thickHighCloudPenalty: prediction.thickHighCloudPenalty || null,
    algorithm: prediction.algorithm || null,
    cloudType: prediction.cloudType || null,
    clearSunsetAdvice: prediction.clearSunsetAdvice || null
  };
}

function compactLightPathAnalysis(lightPath = null) {
  if (!lightPath || typeof lightPath !== 'object') return lightPath || null;
  return {
    score: lightPath.score,
    azimuth: lightPath.azimuth,
    occlusionProbability: lightPath.occlusionProbability,
    explain: lightPath.explain,
    directionalAnalysis: lightPath.directionalAnalysis ? {
      direction: lightPath.directionalAnalysis.direction,
      reason: lightPath.directionalAnalysis.reason
    } : null
  };
}

function compactPredictionMetrics(source = {}) {
  if (!source || typeof source !== 'object') return {};
  const keys = [
    'temp',
    'temperature',
    'temperature_2m',
    'windSpeed',
    'wind',
    'wind_speed_10m',
    'windDirection',
    'windDeg',
    'wind_direction_10m',
    'highCloud',
    'highClouds',
    'highCloudCover',
    'cloudHigh',
    'high',
    'midCloud',
    'midClouds',
    'midCloudCover',
    'cloudMid',
    'mid',
    'lowCloud',
    'lowClouds',
    'lowCloudCover',
    'cloudLow',
    'low',
    'visibility',
    'visibilityKm',
    'humidity',
    'relativeHumidity',
    'pressure',
    'surfacePressure',
    'surface_pressure',
    'precipitation',
    'precip',
    'rain',
    'showers',
    'aod',
    'aerosolOpticalDepth',
    'cloudCover',
    'provider',
    'providerMeta'
  ];
  return keys.reduce((result, key) => {
    const value = source[key];
    if (value !== undefined && value !== null && value !== '') result[key] = value;
    return result;
  }, {});
}

function humanizePredictionConclusion(value, score, periodLabel = '霞光') {
  if (value && typeof value === 'object') {
    return humanizePredictionConclusion(value.description || value.text || value.label || value.key || value.code, score, periodLabel);
  }

  const text = String(value || '').trim();
  const internalTokens = {
    conditions_excellent: '火烧云条件很强，云层和光路都比较配合。',
    excellent_conditions: '火烧云条件很强，云层和光路都比较配合。',
    conditions_good: '火烧云条件可以关注，建议结合临近日落前云况再判断。',
    good_conditions: '火烧云条件可以关注，建议结合临近日落前云况再判断。',
    conditions_fair: '火烧云条件一般，适合顺路观察，不建议专程追霞。',
    fair_conditions: '火烧云条件一般，适合顺路观察，不建议专程追霞。',
    conditions_low: '火烧云条件偏弱，普通日落效果还要看实时天气和视野。',
    low_conditions: '火烧云条件偏弱，普通日落效果还要看实时天气和视野。',
    conditions_poor: '火烧云条件偏弱，普通日落效果还要看实时天气和视野。',
    poor_conditions: '火烧云条件偏弱，普通日落效果还要看实时天气和视野。'
  };
  if (internalTokens[text]) return internalTokens[text];
  if (/^[a-z]+_[a-z0-9_]+$/i.test(text)) return buildScoreConclusion(score, periodLabel);
  return text || buildScoreConclusion(score, periodLabel);
}

function buildScoreConclusion(score, periodLabel = '霞光') {
  const number = Number(score);
  if (!Number.isFinite(number)) return `${periodLabel}条件已根据实时天气完成评估。`;
  if (number >= 85) return '火烧云条件很强，值得重点关注。';
  if (number >= 70) return '火烧云条件不错，有较好的观赏基础。';
  if (number >= 40) return '火烧云条件一般，需要结合临近云况观察。';
  return '火烧云条件偏弱，不建议只凭当前评分专程追霞。';
}

export function buildWeatherPreview(weather = {}) {
  const highCloud = weather.highClouds ?? weather.highCloud ?? weather.clouds?.high;
  const midCloud = weather.midClouds ?? weather.midCloud ?? weather.clouds?.mid;
  const lowCloud = weather.lowClouds ?? weather.lowCloud ?? weather.clouds?.low;
  const cloudAverage = averageNumber([highCloud, midCloud, lowCloud, weather.cloudCover]);
  const provider = weather.provider || weather.providerMeta?.name || 'test';
  const windSpeed = formatWindSpeedValue(weather.windSpeed);
  const hourly = buildWeatherHourlyPreview(weather);
  const hourlyView = buildWeatherHourlyViewModel(hourly, 'temp');
  const windDirection = formatWindDirectionLabel(weather.windDirection);
  return {
    sourceWeather: weather,
    visible: true,
    title: '天气信息',
    description: provider === 'test' ? `${provider} 天气测试数据，用于先验收天气卡片 UI。` : `${provider} 天气数据，用于评估当前火烧云条件。`,
    badge: provider === 'test' ? 'TEST' : '7天概览',
    location: weather.location || weather.locationName || '当前位置',
    iconType: weather.iconType || getWeatherPreviewIconType(cloudAverage, weather.precipitation ?? weather.precipitationProbability),
    iconSrc: `/assets/icons/weather-${weather.iconType || getWeatherPreviewIconType(cloudAverage, weather.precipitation ?? weather.precipitationProbability)}.svg`,
    condition: weather.condition || getWeatherPreviewCondition(cloudAverage),
    temperature: formatTemperatureValue(weather.temp ?? weather.temperature),
    temperatureUnit: '°C',
    windSpeed,
    windDirection,
    windDirectionArrow: formatWindDirectionArrow(weather.windDirection),
    weekly: buildWeatherWeeklyPreview(weather),
    hourly,
    hourlyChart: hourlyView.chart,
    hourlyView,
    glow: buildWeatherGlowPreview(weather),
    weeklyTab: '7天概览',
    hourlyTab: '24小时预报',
    glowTab: '3天朝晚霞',
    metrics: [
      { key: 'humidity', label: '湿度', value: formatPercentValue(weather.humidity) },
      { key: 'cloud', label: '云量', value: formatPercentValue(cloudAverage) },
      { key: 'pressure', label: '气压', value: formatNumberValue(weather.pressure, 'hPa') },
      { key: 'visibility', label: '能见度', value: formatDistanceValue(weather.visibility) },
      { key: 'aerosol', label: '气溶胶', value: formatNumberValue(weather.aod ?? weather.aerosolOpticalDepth, '') },
      { key: 'precipitation', label: '降水', value: formatNumberValue(weather.precipitation, 'mm') }
    ],
    note: `高 ${formatPercentValue(highCloud)} / 中 ${formatPercentValue(midCloud)} / 低 ${formatPercentValue(lowCloud)} · ${windDirection} ${windSpeed}`
  };
}

export function buildWeatherHourlyPreview(weather = {}, day = 'today') {
  const source = Array.isArray(weather.hourly) ? weather.hourly : [];
  if (source.length) {
    const offset = day === 'tomorrow' ? 24 : 0;
    const window = source.slice(offset, offset + 24);
    return (window.length ? window : source.slice(0, 24)).map((item, index) => ({
      key: item.key || item.time || `hour-${index}`,
      time: item.timeLabel || compactHour(item.time || item.date || item.timestamp) || `${index}:00`,
      temp: formatTemperatureValue(item.temp ?? item.temperature),
      precip: formatNumberRaw(item.precipitation ?? item.precip ?? 0),
      humidity: formatPercentValue(item.humidity),
      humidityValue: formatNumberRaw(item.humidity),
      cloud: formatPercentValue(item.cloudCover ?? item.clouds),
      cloudValue: formatNumberRaw(item.cloudCover ?? item.clouds),
      wind: formatWindSpeedValue(item.windSpeed ?? item.wind),
      windValue: formatNumberRaw(item.windSpeed ?? item.wind),
      pressure: formatNumberRaw(item.pressure)
    }));
  }

  const baseTemp = Number(weather.temp ?? weather.temperature);
  const temp = Number.isFinite(baseTemp) ? baseTemp : 19.9;
  return Array.from({ length: 24 }, (_, index) => {
    const hour = index;
    const daylight = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
    const tempValue = temp + daylight * 6 - 2 + Math.sin(index / 3) * 1.4;
    const cloudValue = (weather.cloudCover ?? weather.midClouds ?? 53) + Math.sin(index / 2) * 10;
    const humidityValue = (weather.humidity ?? 72) - daylight * 18 + Math.cos(index / 4) * 4;
    const windValue = (weather.windSpeed ?? 11) + (index % 5) - 2;
    return {
      key: `test-hour-${day}-${hour}`,
      time: `${String(hour).padStart(2, '0')}:00`,
      temp: formatTemperatureValue(tempValue),
      precip: formatNumberRaw(index % 9 === 0 ? 0.4 : 0),
      humidity: formatPercentValue(humidityValue),
      humidityValue: formatNumberRaw(humidityValue),
      cloud: formatPercentValue(cloudValue),
      cloudValue: formatNumberRaw(cloudValue),
      wind: formatWindSpeedValue(windValue),
      windValue: formatNumberRaw(windValue),
      pressure: formatNumberRaw((weather.pressure ?? 1007) + Math.sin(index / 5) * 3)
    };
  });
}

export function buildWeatherHourlyChart(weather = {}) {
  return buildWeatherHourlyViewModel(buildWeatherHourlyPreview(weather), 'temp').chart;
}

export function buildWeatherHourlyViewModel(hourly = [], parameter = 'temp') {
  const parameterConfig = getWeatherParameterConfig();
  const config = parameterConfig[parameter] || parameterConfig.temp;
  const values = hourly.map((item) => getHourlyParameterValue(item, parameter)).filter(Number.isFinite);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const span = Math.max(1, max - min);
  const inset = 18;
  const plotWidth = 100 - inset * 2;

  const displayHourly = hourly.filter((_, index) => index % 2 === 0);
  if (hourly.length > 1 && displayHourly[displayHourly.length - 1] !== hourly[hourly.length - 1]) {
    displayHourly.push(hourly[hourly.length - 1]);
  }
  const displayCount = Math.max(1, displayHourly.length - 1);

  const chart = displayHourly.map((item, index) => {
    const value = getHourlyParameterValue(item, parameter);
    const normalized = Number.isFinite(value) ? (value - min) / span : 0.5;
    const x = Math.round((inset + (index / displayCount) * plotWidth) * 10) / 10;
    const y = Math.round((80 - normalized * 54) * 10) / 10;
    return {
      key: item.key,
      time: item.time,
      value,
      valueText: formatHourlyParameterValue(value, config.unit),
      left: x,
      top: y,
      labelPlacement: index === 0 ? 'right' : (index === displayHourly.length - 1 ? 'left' : 'center'),
      labelVisible: index === 0 || index === Math.floor((displayHourly.length - 1) / 2) || index === displayHourly.length - 1
    };
  });

  return {
    selected: parameter,
    label: config.label,
    unit: config.unit,
    parameters: Object.keys(parameterConfig).map((key) => ({ key, ...parameterConfig[key] })),
    dayOptions: [
      { key: 'today', label: '今天' },
      { key: 'tomorrow', label: '明天' }
    ],
    chart,
    axisLabels: [max, min + span / 2, min].map((value, index) => ({
      key: `axis-${index}`,
      value: formatHourlyParameterValue(value, config.unit)
    })),
    weatherStrip: hourly.filter((_, index) => index % 4 === 0).map((item) => ({
      key: item.key,
      time: item.time,
      text: item.cloud
    }))
  };
}

function paintHourlyChartCanvas(canvasId, chart = [], options = {}) {
  const wxApi = options.wxApi || options.wx || globalThis.wx;
  if (!canvasId || !chart.length || !wxApi?.createSelectorQuery) return false;

  const query = wxApi.createSelectorQuery();
  const scope = options.component || options.page;
  const scopedQuery = scope && query.in ? query.in(scope) : query;
  if (!scopedQuery?.select) return false;

  scopedQuery
    .select(`#${canvasId}`)
    .fields({ node: true, size: true })
    .exec((res = []) => {
      const result = res[0] || {};
      const canvas = result.node;
      if (!canvas?.getContext) return;

      const width = Math.max(1, Math.round(result.width || 320));
      const height = Math.max(1, Math.round(result.height || 120));
      const dpr = getCachedCanvasPixelRatio(wxApi);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.beginPath();
      chart.forEach((item, index) => {
        const x = width * Number(item.left || 0) / 100;
        const y = height * Number(item.top || 0) / 100;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = options.lineColor || '#f59e0b';
      ctx.lineWidth = options.lineWidth || 2.1;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(245, 158, 11, 0.20)';
      ctx.shadowBlur = 4;
      ctx.stroke();
      ctx.restore();
    });

  return true;
}

function getWeatherParameterConfig() {
  return {
    temp: { label: '温度', unit: '°C', iconSrc: '/assets/icons/weather-param-temperature.svg' },
    precip: { label: '降水', unit: 'mm', iconSrc: '/assets/icons/weather-param-precipitation.svg' },
    humidity: { label: '湿度', unit: '%', iconSrc: '/assets/icons/weather-param-humidity.svg' },
    wind: { label: '风速', unit: 'km/h', iconSrc: '/assets/icons/weather-param-wind.svg' },
    pressure: { label: '气压', unit: 'hPa', iconSrc: '/assets/icons/weather-param-pressure.svg' },
    clouds: { label: '云量', unit: '%', iconSrc: '/assets/icons/weather-param-cloud.svg' }
  };
}

function refreshWeatherHourlyView(preview = {}, day = 'today', parameter = 'temp') {
  const hourly = buildWeatherHourlyPreview(preview.sourceWeather || {}, day);
  const fallbackHourly = hourly.length ? hourly : (preview.hourly || []);
  const hourlyView = buildWeatherHourlyViewModel(fallbackHourly, parameter);
  return {
    ...preview,
    hourly: fallbackHourly,
    hourlyChart: hourlyView.chart,
    hourlyView
  };
}

function getHourlyParameterValue(item = {}, parameter = 'temp') {
  const value = {
    temp: item.temp,
    precip: item.precip,
    humidity: item.humidityValue ?? item.humidity,
    wind: item.windValue ?? item.wind,
    pressure: item.pressure,
    clouds: item.cloudValue ?? item.cloud
  }[parameter];
  return Number(String(value).replace(/[^0-9.-]/g, ''));
}

function formatHourlyParameterValue(value, unit) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '--';
  const rounded = unit === 'mm' ? Math.round(number * 10) / 10 : Math.round(number);
  return `${rounded}${unit}`;
}

function formatNumberRaw(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 10) / 10 : 0;
}

export function buildPredictionAnalysisGroups(input = {}) {
  const high = Number(input.high ?? 62);
  const mid = Number(input.mid ?? 36);
  const low = Number(input.low ?? 8);
  const visibility = Number(input.visibility ?? 13);
  const humidity = Number(input.humidity ?? 72);
  const aod = Number(input.aod ?? 0.11);
  return [
    { key: 'carrier', title: '云层载体', status: high >= 50 || mid >= 30 ? '较好' : '一般', tone: high >= 50 || mid >= 30 ? 'good' : 'fair', desc: `高云 ${Math.round(high)}%、中云 ${Math.round(mid)}%，有可染色云层基础。` },
    { key: 'lightPath', title: '光路条件', status: low <= 25 ? '较好' : '一般', tone: low <= 25 ? 'good' : 'fair', desc: `低云 ${Math.round(low)}%，太阳方向相对通透，光线有机会照到云底。` },
    { key: 'rendering', title: '空气显色', status: visibility >= 10 && humidity < 85 ? '较好' : '一般', tone: visibility >= 10 && humidity < 85 ? 'good' : 'fair', desc: `能见度 ${Math.round(visibility)}km、湿度 ${Math.round(humidity)}%、AOD ${aod.toFixed(2)}。` },
    { key: 'limits', title: '限制因素', status: low > 45 ? '明显' : '无明显', tone: low > 45 ? 'weak' : 'good', desc: low > 45 ? '低云偏多可能遮挡太阳方向。' : '降水和厚低云限制不明显。' }
  ];
}

export function buildPredictionRadarPreview(period = 'sunset', sunDirection = '') {
  if (period === 'sunrise') {
    const directions = withRadarCloudFields([
      { direction: 'N', name: '北', scoreText: '51', level: 'watch', cloudText: '高 22% / 中 35% / 低 18%' },
      { direction: 'NE', name: '东北', scoreText: '58', level: 'watch', cloudText: '高 30% / 中 48% / 低 14%' },
      { direction: 'E', name: '东', scoreText: '62', level: 'watch', cloudText: '高 38% / 中 52% / 低 12%' },
      { direction: 'SE', name: '东南', scoreText: '55', level: 'watch', cloudText: '高 34% / 中 46% / 低 16%' },
      { direction: 'S', name: '南', scoreText: '44', level: 'watch', cloudText: '高 18% / 中 32% / 低 26%' },
      { direction: 'SW', name: '西南', scoreText: '39', level: 'weak', cloudText: '高 14% / 中 26% / 低 32%' },
      { direction: 'W', name: '西', scoreText: '36', level: 'weak', cloudText: '高 12% / 中 24% / 低 36%' },
      { direction: 'NW', name: '西北', scoreText: '43', level: 'watch', cloudText: '高 18% / 中 30% / 低 24%' }
    ]);
    return {
      directions,
      sunMarker: buildRadarSunMarker(period, sunDirection),
      cloudGradients: buildRadarCloudGradients(directions)
    };
  }

  const directions = withRadarCloudFields([
      { direction: 'N', name: '北', scoreText: '62', level: 'watch', cloudText: '高 28% / 中 44% / 低 12%' },
      { direction: 'NE', name: '东北', scoreText: '68', level: 'watch', cloudText: '高 34% / 中 48% / 低 10%' },
      { direction: 'E', name: '东', scoreText: '58', level: 'watch', cloudText: '高 22% / 中 39% / 低 18%' },
      { direction: 'SE', name: '东南', scoreText: '52', level: 'watch', cloudText: '高 18% / 中 34% / 低 24%' },
      { direction: 'S', name: '南', scoreText: '49', level: 'weak', cloudText: '高 16% / 中 30% / 低 28%' },
      { direction: 'SW', name: '西南', scoreText: '74', level: 'good', cloudText: '高 62% / 中 36% / 低 8%' },
      { direction: 'W', name: '西', scoreText: '76', level: 'good', cloudText: '高 64% / 中 36% / 低 8%' },
      { direction: 'NW', name: '西北', scoreText: '69', level: 'watch', cloudText: '高 55% / 中 38% / 低 12%' }
    ]);
  return {
    directions,
    sunMarker: buildRadarSunMarker(period, sunDirection),
    cloudGradients: buildRadarCloudGradients(directions)
  };
}

function buildCompletePredictionPreview(preview = {}) {
  return {
    ...preview,
    analysis: buildPredictionAnalysisGroups({
      high: preview.clouds?.[0]?.value,
      mid: preview.clouds?.[1]?.value,
      low: preview.clouds?.[2]?.value,
      visibility: preview.visibility,
      humidity: preview.humidity,
      aod: preview.aod
    }),
    radar: buildPredictionRadarFromClouds(preview.periodKey, preview.clouds, preview.direction)
  };
}

function buildPredictionRadarFromClouds(period = 'sunset', clouds = [], sunDirection = '') {
  const high = Number(clouds.find((item) => item.key === 'high')?.value);
  const mid = Number(clouds.find((item) => item.key === 'mid')?.value);
  const low = Number(clouds.find((item) => item.key === 'low')?.value);
  if (![high, mid, low].every(Number.isFinite)) return buildPredictionRadarPreview(period, sunDirection);

  const names = {
    N: '北', NE: '东北', E: '东', SE: '东南', S: '南', SW: '西南', W: '西', NW: '西北'
  };
  const weights = period === 'sunrise'
    ? { N: 0.74, NE: 0.92, E: 1, SE: 0.9, S: 0.72, SW: 0.58, W: 0.52, NW: 0.62 }
    : { N: 0.72, NE: 0.62, E: 0.56, SE: 0.62, S: 0.72, SW: 0.92, W: 1, NW: 0.9 };
  const directions = withRadarCloudFields(Object.entries(weights).map(([direction, weight]) => {
    const h = clampPercent(high * weight + mid * (1 - weight) * 0.22);
    const m = clampPercent(mid * (0.82 + weight * 0.18));
    const l = clampPercent(low * (1.08 - weight * 0.14));
    const score = Math.round(h * 0.62 + m * 0.28 - l * 0.18 + 18);
    return {
      direction,
      name: names[direction],
      scoreText: String(clampPercent(score)),
      level: score >= 70 ? 'good' : (score >= 40 ? 'watch' : 'weak'),
      cloudText: `高 ${Math.round(h)}% / 中 ${Math.round(m)}% / 低 ${Math.round(l)}%`
    };
  }));
  return {
    directions,
    sunMarker: buildRadarSunMarker(period, sunDirection),
    cloudGradients: buildRadarCloudGradients(directions)
  };
}

function buildRadarSunMarker(period = 'sunset', direction = '') {
  const bearing = normalizeSunDirectionBearing(direction, period);
  const radius = 36;
  const radians = bearing * Math.PI / 180;
  return {
    label: period === 'sunrise' ? '日出方向' : '日落方向',
    shortLabel: period === 'sunrise' ? '日出' : '日落',
    bearing,
    left: Number((50 + Math.sin(radians) * radius).toFixed(1)),
    top: Number((50 - Math.cos(radians) * radius).toFixed(1))
  };
}

function normalizeSunDirectionBearing(direction = '', period = 'sunset') {
  const number = Number(direction);
  if (Number.isFinite(number)) return ((number % 360) + 360) % 360;

  const text = String(direction || '').trim();
  if (!text) return period === 'sunrise' ? 67.5 : 292.5;

  const exact = {
    北: 0,
    东北: 45,
    东: 90,
    东南: 135,
    南: 180,
    西南: 225,
    西: 270,
    西北: 315,
    东偏北: 67.5,
    东偏南: 112.5,
    南偏东: 157.5,
    南偏西: 202.5,
    西偏南: 247.5,
    西偏北: 292.5,
    北偏西: 337.5,
    北偏东: 22.5
  };
  if (Object.prototype.hasOwnProperty.call(exact, text)) return exact[text];

  const compact = text.replace(/\s+/g, '').toLowerCase();
  const english = {
    n: 0,
    ne: 45,
    ene: 67.5,
    e: 90,
    ese: 112.5,
    se: 135,
    sse: 157.5,
    s: 180,
    ssw: 202.5,
    sw: 225,
    wsw: 247.5,
    w: 270,
    wnw: 292.5,
    nw: 315,
    nnw: 337.5,
    nne: 22.5
  };
  if (Object.prototype.hasOwnProperty.call(english, compact)) return english[compact];

  if (text.includes('西') && text.includes('北')) return 292.5;
  if (text.includes('西') && text.includes('南')) return 247.5;
  if (text.includes('东') && text.includes('北')) return 67.5;
  if (text.includes('东') && text.includes('南')) return 112.5;
  if (text.includes('西')) return 270;
  if (text.includes('东')) return 90;
  if (text.includes('北')) return 0;
  if (text.includes('南')) return 180;
  return period === 'sunrise' ? 67.5 : 292.5;
}

export function buildWeatherGlowPreview(weather = {}) {
  if (Array.isArray(weather.glow) && weather.glow.length) {
    return weather.glow.map((item, index) => ({
      key: item.key || item.date || `glow-${index}`,
      label: item.label || formatGlowDayLabel(item.date, index),
      dayDate: item.dayDate || item.dateLabel || formatGlowDateLabel(item.date, index),
      sunrise: item.sunrise ?? item.sunriseScore ?? '--',
      sunset: item.sunset ?? item.sunsetScore ?? '--',
      summary: item.summary || item.condition || ''
    }));
  }

  const cloudAverage = averageNumber([
    weather.highClouds ?? weather.clouds?.high,
    weather.midClouds ?? weather.clouds?.mid,
    weather.lowClouds ?? weather.clouds?.low,
    weather.cloudCover
  ]);
  const base = Number.isFinite(Number(cloudAverage)) ? Math.round(cloudAverage) : 53;
  return [
    { key: 'today', label: '今天', dayDate: '今日', sunrise: Math.max(0, base - 8), sunset: Math.min(100, base + 18), summary: '云层结构适合观察霞光' },
    { key: 'tomorrow', label: '明天', dayDate: '次日', sunrise: Math.max(0, base - 3), sunset: Math.min(100, base + 12), summary: '留意西侧云带变化' },
    { key: 'day-3', label: '后天', dayDate: '第3天', sunrise: Math.max(0, base - 12), sunset: Math.min(100, base + 6), summary: '中等把握，适合顺路观察' }
  ];
}

function formatGlowDayLabel(dateValue, index) {
  if (index === 0) return '今天';
  if (index === 1) return '明天';
  if (index === 2) return '后天';
  const date = parseWeeklyDate(dateValue);
  if (!date) return `第${index + 1}天`;
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
}

function formatGlowDateLabel(dateValue, index) {
  const date = parseWeeklyDate(dateValue);
  if (date) return `${date.getMonth() + 1}/${date.getDate()}`;
  return index === 0 ? '今日' : index === 1 ? '次日' : `第${index + 1}天`;
}

export function isWeatherTestLocation(value = '') {
  return String(value).trim().toLowerCase() === 'test';
}

function buildWeatherWeeklyPreview(weather = {}) {
  if (Array.isArray(weather.weekly) && weather.weekly.length) {
    return weather.weekly.map((item, index) => {
      const temps = splitWeeklyTemperatures(item);
      const precip = item.precip ?? item.precipitationProbability;
      const cloudCover = item.cloudCover ?? item.cloud ?? weather.cloudCover;
      return {
        key: item.key || item.date || `day-${index}`,
        label: item.label || item.day || formatWeeklyDayLabel(item.date, index),
        dayDate: item.dayDate || item.dateLabel || formatWeeklyDateLabel(item.date, index),
        condition: item.condition || item.summary || weather.condition || '--',
        iconSrc: `/assets/icons/weather-${item.iconType || getWeatherPreviewIconType(cloudCover, precip)}.svg`,
        minTemp: formatWeeklyTemperature(temps.min),
        maxTemp: formatWeeklyTemperature(temps.max),
        temp: item.temp || formatTempRange(temps.min, temps.max),
        precip: formatPercentValue(precip),
        wind: formatWindSpeedValue(item.windSpeed ?? item.wind),
        windArrow: formatWindDirectionArrow(item.windDirection ?? item.windDeg ?? weather.windDirection)
      };
    });
  }

  return [
    buildWeeklyRow('today', '今天', '(16日)', 'partly-cloudy', 15, 31, 8, 21, 180),
    buildWeeklyRow('tomorrow', '明天', '(17日)', 'partly-cloudy', 15, 32, 6, 19, 180),
    buildWeeklyRow('sat', '周六', '(18日)', 'partly-cloudy', 15, 28, 14, 24, 180),
    buildWeeklyRow('sun', '周日', '(19日)', 'partly-cloudy', 17, 27, 10, 18, 180),
    buildWeeklyRow('mon', '周一', '(20日)', 'partly-cloudy', 16, 31, 5, 16, 180),
    buildWeeklyRow('tue', '周二', '(21日)', 'partly-cloudy', 16, 32, 7, 20, 180),
    buildWeeklyRow('wed', '周三', '(22日)', 'sunny', 16, 29, 4, 17, 180)
  ];
}

function formatTempRange(min, max) {
  const minNum = Number(min);
  const maxNum = Number(max);
  if (!Number.isFinite(minNum) || !Number.isFinite(maxNum)) return '--';
  return `${Math.round(minNum)}° / ${Math.round(maxNum)}°`;
}

function buildWeeklyRow(key, label, dayDate, iconType, minTemp, maxTemp, precip, windSpeed, windDirection) {
  return {
    key,
    label,
    dayDate,
    condition: '',
    iconSrc: `/assets/icons/weather-${iconType}.svg`,
    minTemp: formatWeeklyTemperature(minTemp),
    maxTemp: formatWeeklyTemperature(maxTemp),
    temp: formatTempRange(minTemp, maxTemp),
    precip: formatPercentValue(precip),
    wind: formatWindSpeedValue(windSpeed),
    windArrow: formatWindDirectionArrow(windDirection)
  };
}

function splitWeeklyTemperatures(item = {}) {
  const directMin = item.minTemp ?? item.tempMin ?? item.lowTemp ?? item.low;
  const directMax = item.maxTemp ?? item.tempMax ?? item.highTemp ?? item.high;
  const minNum = Number(directMin);
  const maxNum = Number(directMax);
  if (Number.isFinite(minNum) && Number.isFinite(maxNum)) return { min: minNum, max: maxNum };

  const parts = String(item.temp || '').match(/-?\d+(?:\.\d+)?/g) || [];
  const values = parts.map(Number).filter(Number.isFinite);
  if (values.length >= 2) {
    return { min: Math.min(values[0], values[1]), max: Math.max(values[0], values[1]) };
  }
  return { min: null, max: null };
}

function formatWeeklyTemperature(value) {
  const num = Number(value);
  return Number.isFinite(num) ? `${Math.round(num)}°` : '--';
}

function formatWeeklyDayLabel(dateValue, index) {
  const labels = ['今天', '明天', '周一', '周二', '周三', '周四', '周五'];
  if (index < 2) return labels[index];
  const date = parseWeeklyDate(dateValue);
  if (!date) return labels[index] || `D${index + 1}`;
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
}

function formatWeeklyDateLabel(dateValue, index) {
  const date = parseWeeklyDate(dateValue);
  if (date) return `(${date.getDate()}日)`;
  return `(${16 + index}日)`;
}

function parseWeeklyDate(dateValue) {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatWindDirectionArrow(direction) {
  const deg = Number(direction);
  if (!Number.isFinite(deg)) return '↓';
  const normalized = (((deg + 180) % 360) + 360) % 360;
  if (normalized >= 337.5 || normalized < 22.5) return '↑';
  if (normalized < 67.5) return '↗';
  if (normalized < 112.5) return '→';
  if (normalized < 157.5) return '↘';
  if (normalized < 202.5) return '↓';
  if (normalized < 247.5) return '↙';
  if (normalized < 292.5) return '←';
  return '↖';
}

function formatWindDirectionLabel(direction) {
  if (direction === null || direction === undefined || direction === '') return '风向';
  const deg = Number(direction);
  if (!Number.isFinite(deg)) return String(direction);
  const normalizedDirection = ((deg % 360) + 360) % 360;
  const directions = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
  const index = Math.round(normalizedDirection / 45) % directions.length;
  return directions[index];
}

function decorateRecentQueries(recent = []) {
  return recent.map((item) => ({
    ...item,
    locationName: item.locationName || item.name || item.location,
    periodLabel: (item.period || item.type) === 'sunrise' ? '朝霞' : '晚霞',
    dayLabel: item.day === 'tomorrow' ? '明日' : '今日'
  }));
}

function formatPercentValue(value) {
  if (value === null || value === undefined || value === '') return '--';
  const num = Number(value);
  return Number.isFinite(num) ? `${Math.round(num)}%` : '--';
}

function formatDistanceValue(value) {
  if (value === null || value === undefined || value === '') return '--';
  const num = Number(value);
  return Number.isFinite(num) ? `${num.toFixed(num >= 10 ? 0 : 1)} km` : '--';
}

function formatWindSpeedValue(speed) {
  if (speed === null || speed === undefined || speed === '') return '--';
  const speedNum = Number(speed);
  return Number.isFinite(speedNum) ? `${Math.round(speedNum)} km/h` : '--';
}

function formatWindValue(direction, speed) {
  return `${direction || '风向'} ${formatWindSpeedValue(speed)}`;
}

function formatNumberValue(value, unit) {
  if (value === null || value === undefined || value === '') return '--';
  const num = Number(value);
  if (!Number.isFinite(num)) return '--';
  return `${num}${unit ? ` ${unit}` : ''}`;
}

function formatTemperatureValue(value) {
  if (value === null || value === undefined || value === '') return '--';
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(1) : '--';
}

function averageNumber(values) {
  const valid = values.map(Number).filter(Number.isFinite);
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function getWeatherPreviewIconType(cloudCover, precipitation = 0) {
  const precip = Number(precipitation);
  const value = Number(cloudCover);
  if (Number.isFinite(precip) && precip > 0.5) return 'rain';
  if (!Number.isFinite(value)) return 'cloud';
  if (value < 25) return 'sunny';
  if (value < 65) return 'partly-cloudy';
  return 'cloud';
}

function getWeatherPreviewCondition(cloudCover) {
  const value = Number(cloudCover);
  if (!Number.isFinite(value)) return '--';
  if (value < 25) return '晴';
  if (value < 65) return '多云';
  return '阴';
}

function buildWeatherFromPrediction(prediction = {}, query = {}) {
  const weather = prediction.weatherData || prediction.weather || {};
  const metrics = prediction.metrics || {};
  const clouds = extractCloudLayers(prediction);
  return {
    ...weather,
    location: prediction.locationName || prediction.location || query.locationName || query.location,
    provider: weather.provider || prediction.provider || prediction.providerMeta?.name || 'Open-Meteo',
    providerMeta: weather.providerMeta || prediction.providerMeta,
    temp: weather.temp ?? weather.temperature ?? metrics.temp ?? metrics.temperature ?? prediction.temperature,
    humidity: weather.humidity ?? metrics.humidity ?? prediction.humidity,
    pressure: weather.pressure ?? metrics.pressure ?? prediction.pressure,
    visibility: weather.visibility ?? metrics.visibility ?? prediction.visibility,
    aod: weather.aod ?? weather.aerosolOpticalDepth ?? metrics.aod ?? prediction.aod,
    windSpeed: weather.windSpeed ?? metrics.windSpeed ?? prediction.windSpeed,
    windDirection: weather.windDirection ?? metrics.windDirection ?? prediction.windDirection,
    precipitation: weather.precipitation ?? metrics.precipitation ?? prediction.precipitation,
    highClouds: clouds.high,
    midClouds: clouds.mid,
    lowClouds: clouds.low,
    cloudCover: weather.cloudCover ?? metrics.cloudCover ?? prediction.cloudCover,
    hourly: weather.hourly || prediction.hourly || [],
    daily: weather.daily || prediction.daily || [],
    glow: weather.glow || prediction.glow || []
  };
}

function extractCloudLayers(prediction = {}) {
  const weather = prediction.weatherData || prediction.weather || {};
  const metrics = prediction.metrics || {};
  const clouds = prediction.clouds || prediction.cloudLayers || {};
  return {
    high: firstFinite(clouds.high, clouds.highClouds, metrics.highCloud, metrics.highClouds, weather.highClouds, weather.highCloud, prediction.highCloud, prediction.highClouds),
    mid: firstFinite(clouds.mid, clouds.midClouds, metrics.midCloud, metrics.midClouds, weather.midClouds, weather.midCloud, prediction.midCloud, prediction.midClouds),
    low: firstFinite(clouds.low, clouds.lowClouds, clouds.lowCloudCover, metrics.lowCloud, metrics.lowClouds, weather.lowClouds, weather.lowCloudCover, prediction.lowCloud, prediction.lowClouds)
  };
}

function firstFinite(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function toDisplayNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : 0;
}

function buildScoreLabel(score) {
  const number = Number(score);
  if (!Number.isFinite(number)) return '--';
  if (number >= 85) return '极佳 Excellent';
  if (number >= 70) return '高分 Strong';
  if (number >= 40) return '可观 Watch';
  return '较弱 Weak';
}

function compactBestTime(value) {
  if (!value) return '--';
  if (typeof value === 'string' && /^\s*\d{1,2}:\d{2}\s*[-–]/.test(value)) {
    return value.split(/[-–]/)[0].trim();
  }
  if (typeof value === 'object') return compactDateTime(value.start || value.from || value.time);
  return compactDateTime(value);
}

function withRadarCloudFields(directions = []) {
  return directions.map((item) => {
    const values = parseCloudText(item.cloudText);
    return {
      ...item,
      highCloud: item.highCloud ?? values.high,
      midCloud: item.midCloud ?? values.mid,
      lowCloud: item.lowCloud ?? values.low
    };
  });
}

function parseCloudText(text = '') {
  const matches = String(text).match(/\d+(?:\.\d+)?/g) || [];
  return {
    high: Number(matches[0] ?? 0),
    mid: Number(matches[1] ?? 0),
    low: Number(matches[2] ?? 0)
  };
}

function clampPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function clampProgress(value) {
  return clampPercent(value);
}

function waitForLoadingFrame() {
  return new Promise((resolve) => setTimeout(resolve, 120));
}

function wxPromise(fn, options) {
  return new Promise((resolve, reject) => {
    fn({ ...options, success: resolve, fail: reject });
  });
}

function normalizePrediction(raw = {}, query) {
  const data = raw.prediction || raw.data || raw;
  const clouds = data.clouds || data.cloudLayers || {};
  const summary = data.summary || {};
  const explanation = typeof summary === 'string'
    ? summary
    : (summary.description || data.description || data.advice || '已完成查分，建议结合实时天气、视野和临近时段云况判断。');

  return {
    ...data,
    locationName: data.locationName || data.location || query.locationName,
    lat: data.lat ?? data.latitude ?? query.coordinate?.lat,
    lon: data.lon ?? data.lng ?? data.longitude ?? query.coordinate?.lon,
    period: data.period || data.type || query.period,
    day: data.day || query.day,
    score: data.score ?? data.totalScore ?? data.finalScore,
    grade: data.grade || data.quality || data.level,
    bestWindow: formatBestWindow(data.bestWindow || data.window || data.timeWindow || data.referenceTime || data.date),
    explanation,
    weatherData: data.weatherData || data.weather || {},
    clouds,
    metrics: {
      ...(data.metrics || data.factors || data.weather || {}),
      highCloud: clouds.high,
      midCloud: clouds.mid,
      lowCloud: clouds.low,
      visibility: data.visibility,
      humidity: data.humidity,
      aod: data.aod
    }
  };
}

function pickGatewayPredictionCard(gateway = {}, period = 'sunset', query = {}, day = 'today') {
  const date = resolvePredictionDate(day);
  const byDate = Array.isArray(gateway.predictions?.byDate) ? gateway.predictions.byDate : [];
  const dayRow = byDate.find((item) => item?.date === date);
  const raw = dayRow?.[period] || gateway.predictionCards?.[period] || gateway.predictions?.[period];
  if (!raw) return null;
  return compactPredictionPreviewPayload(normalizePrediction({
    ...raw,
    type: raw.type || period,
    period: raw.period || raw.type || period,
    day: raw.day || day,
    date: raw.date || date
  }, { ...query, period, day, date }));
}

function friendlyError(error) {
  if (error && error.message === 'LOCATION_NOT_FOUND') return '没有找到这个地点，请换个更具体的名称。';
  if (error && error.code === 'GEOCODING_RATE_LIMIT') return '地点搜索太频繁了，稍后再试。';
  return '查分失败，请换个地点或稍后再试。';
}

function perfNow() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
  return Date.now();
}

function roundPerfMs(value) {
  return Math.round(Number(value) * 10) / 10;
}

function estimatePayloadBytes(payload) {
  try {
    return JSON.stringify(payload).length;
  } catch (error) {
    return -1;
  }
}

function logMiniPerf(event, payload = {}) {
  try {
    console.info('[MiniPerf]', JSON.stringify({
      event,
      page: 'home',
      at: Date.now(),
      ...payload
    }));
  } catch (error) {
    // Profiling must not affect user interactions.
  }
}

function resolvePredictionDate(day) {
  const date = new Date();
  if (day === 'tomorrow') date.setDate(date.getDate() + 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${d}`;
}

function normalizeDateKey(value) {
  if (!value) return '';
  const text = String(value);
  const direct = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (direct) return direct[1];
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${d}`;
}

function toNumberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatBestWindow(value) {
  if (!value) return '日出/日落前后';
  if (typeof value === 'string') return compactDateTime(value);
  const start = value.start || value.from;
  const end = value.end || value.to;
  if (start && end) return `${compactDateTime(start)} - ${compactDateTime(end)}`;
  return '日出/日落前后';
}

function compactDateTime(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${hour}:${minute}`;
}

function compactHour(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 5);
  return `${String(date.getHours()).padStart(2, '0')}:00`;
}
