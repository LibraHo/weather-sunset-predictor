import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('miniprogram web-like experience shell', () => {
  test('uses one global topbar without duplicating settings in the home menu', () => {
    const appConfig = JSON.parse(read('miniprogram/app.json'));
    const topbarWxml = read('miniprogram/components/app-topbar/index.wxml');
    const topbarJs = read('miniprogram/components/app-topbar/index.js');
    const topbarWxss = read('miniprogram/components/app-topbar/index.wxss');
    const settingsIcon = read('miniprogram/assets/icons/settings.svg');
    const pagePaths = appConfig.pages.map((page) => `miniprogram/${page}.wxml`);

    expect(appConfig.usingComponents).toMatchObject({
      'app-topbar': '/components/app-topbar/index'
    });
    for (const pagePath of pagePaths) {
      expect(read(pagePath)).toContain('<app-topbar');
      expect(read(pagePath)).toContain('theme-mode="{{themeMode}}"');
      expect(read(pagePath)).toContain('resolved-theme-mode="{{resolvedThemeMode}}"');
    }

    expect(topbarWxml).toContain('home-view-menu-dropdown');
    expect(topbarWxml).toContain('theme-{{resolvedThemeMode}}');
    expect(topbarWxml).toContain('bindtap="toggleSettings"');
    expect(topbarWxml).toContain('class="settings-close"');
    expect(topbarWxml).toContain('>保存</button>');
    expect(topbarWxml).not.toContain('data-target="settings"');
    expect(topbarWxml).not.toContain('>完成</button>');
    expect(topbarJs).not.toMatch(/if\s*\(\s*target\s*===\s*['"]settings['"]\s*\)/);
    expect(topbarJs).toContain('themeMode:');
    expect(topbarJs).toContain('resolvedThemeMode:');
    expect(topbarWxss).toContain('min-height: 132rpx');
    expect(topbarWxss).toContain('background: rgba(255, 252, 246, 0.90)');
    expect(topbarWxss).toContain('border-radius: 24rpx');
    expect(topbarWxss).toContain('width: 74rpx');
    expect(topbarWxss).toMatch(/\.settings-close\s*\{[\s\S]*position: absolute;[\s\S]*right: 18rpx;[\s\S]*justify-content: center;/);
    expect(topbarWxss).toMatch(/\.settings-done\s*\{[\s\S]*display: flex;[\s\S]*align-items: center;[\s\S]*justify-content: center;[\s\S]*line-height: 1;/);
    expect(topbarWxss).toContain('linear-gradient(135deg, #ffd166 0%, #fb923c 70%, #f97316 100%)');
    expect(topbarWxss).not.toContain('#39a849');
    expect(settingsIcon).toContain('M19.43 12.98');
    expect(settingsIcon).toContain('M12 15.5');
  });

  test('home opens with the same warm mobile shell and product destinations as web', () => {
    const wxml = read('miniprogram/pages/home/index.wxml');
    const js = read('miniprogram/pages/home/index.js');
    const wxss = read('miniprogram/pages/home/index.wxss');

    expect(wxml).toContain('home-topbar');
    expect(wxml).toContain('home-header-actions');
    expect(wxml).toContain('home-view-menu-dropdown');
    expect(wxml).toContain('<app-topbar current="home"');
    expect(wxml).toContain('location-search');
    expect(wxml).toContain('home-web-spacer');
    expect(wxml).toContain('home-footer-card');
    expect(wxml).toContain('visitorCountText');
    expect(wxml).toContain('weatherPreview.visible');
    expect(wxml).toContain('data-target="methodology"');
    expect(wxml).toContain('data-target="map"');
    expect(wxml).toContain('data-target="gallery"');
    expect(wxml).not.toContain('data-target="upload"');
    expect(wxml).not.toContain('data-target="api"');
    expect(wxml).toContain('settings-panel');
    expect(wxml).toContain('settings-done');
    expect(wxml).toContain('data-value="zh-CN"');
    expect(wxml).toContain('data-value="system"');
    expect(wxml).toContain('theme-{{resolvedThemeMode}}');
    expect(wxml).not.toContain('默认预测');
    expect(wxml).not.toContain('默认日期');
    expect(wxml).not.toContain('nav-grid');
    expect(wxml).not.toContain('nav-card');

    expect(js).toContain('toggleHomeMenu()');
    expect(js).toContain('persistAppSettings(patch, this.data)');
    expect(js).not.toContain('selectDefaultPeriod(event)');
    expect(js).not.toContain('selectDefaultDay(event)');
    expect(js).not.toContain('resetSettings()');
    expect(js).not.toContain("wx.setStorageSync('homeSettings'");
    expect(js).toContain('navigateFeature(event)');
    expect(js).toContain('async useHistory(event)');
    expect(js).toContain('await this.onSearch();');
    expect(js).toContain("this.setData({ locationText: event.detail.value, coordinate: null, locationCandidates: [], errorMessage: '' })");
    expect(js).toContain("methodology: '/pages/methodology/index'");
    expect(js).toContain("map: `/pages/map/index?period=${this.data.period}`");
    expect(js).toContain("gallery: '/pages/gallery/index'");
    expect(js).not.toContain("upload: '/pages/upload/index'");
    expect(js).not.toContain("api: '/pages/methodology/index?section=api'");
    expect(js).toContain("options.weatherTest === '1'");
    expect(js).toContain('buildDefaultWeatherPreview');
    expect(js).toContain("import { formatVisitorCount, incrementVisitorCount } from '../../services/visitor.js'");
    expect(js).toContain('this.refreshVisitorCount();');
    expect(js).toContain('async refreshVisitorCount()');
    expect(js).toContain('buildTestWeatherPreview');

    expect(wxss).toContain('#f6efe6');
    expect(wxss).toMatch(/\.home-page\s*\{[\s\S]*gap: 28rpx;/);
    expect(wxss).not.toContain('gap: 56rpx;');
    expect(wxss).toContain('.home-topbar');
    expect(wxss).toContain('.home-header-actions');
    expect(wxss).toContain('.header-icon-button');
    expect(wxss).toContain('.menu-button');
    expect(wxss).toContain('width: 70rpx');
    expect(wxss).toContain('height: 70rpx');
    expect(wxss).toContain('.home-view-menu-dropdown');
    expect(wxss).toContain('.home-web-spacer');
    expect(wxss).toContain('.home-footer-card');
    expect(wxss).toContain('.home-hero,');
    expect(wxss).toContain('.control-card,');
    expect(wxss).toContain('display: none;');
    expect(wxss).not.toContain('width: 80rpx');
    expect(wxss).not.toContain('height: 80rpx');
    expect(wxss).not.toContain('.app-header');
    expect(wxss).not.toContain('.home-view-rail');
    expect(wxss).not.toContain('.nav-grid');
    expect(wxss).not.toContain('.nav-card');
  });

  test('location shortcuts query immediately instead of requiring a second tap', () => {
    const locationWxml = read('miniprogram/components/location-search/index.wxml');
    const homeWxml = read('miniprogram/pages/home/index.wxml');
    const homeJs = read('miniprogram/pages/home/index.js');

    expect(locationWxml).toContain('bindtap="onLocate"');
    expect(locationWxml).toContain('bindtap="onFavorite"');
    expect(locationWxml).toContain('bindconfirm="onConfirm"');
    expect(locationWxml).toContain('bindtap="onConfirm"');
    expect(locationWxml).toContain('location-suggestion-dropdown');
    expect(locationWxml).toContain('wx:if="{{candidates.length}}"');
    expect(locationWxml).toContain('bindtap="onSelectCandidate"');
    expect(homeWxml).toContain('candidates="{{locationCandidates}}"');
    expect(homeWxml).toContain('bind:selectcandidate="selectLocationCandidate"');
    expect(locationWxml).toMatch(/class="favorite-icon"[\s\S]*bindtap="onFavorite"/);
    expect(locationWxml).toMatch(/class="pin-location-button"[\s\S]*bindtap="onLocate"/);
    expect(homeJs).toMatch(/async onUseCurrentLocation\(\)[\s\S]*await this\.onSearch\(\);/);
    expect(homeJs).toContain('normalizeCurrentLocationCoordinate(res)');
    expect(homeJs).toContain('reverseGeocode(coordinate.lat, coordinate.lon)');
    expect(homeJs).toContain('async onAddCurrentFavorite()');
    expect(homeJs).toMatch(/async useHistory\(event\)[\s\S]*await this\.onSearch\(\);/);
    expect(homeJs).toMatch(/async resolveLocation\(locationText\)[\s\S]*if \(this\.data\.coordinate\)/);
    expect(homeJs).toContain('locationCandidates');
    expect(homeJs).toContain('selectLocationCandidate(event)');
    expect(homeJs).toContain('event.detail?.index');
  });

  test('tap targets provide native press feedback across the mini-program surface', () => {
    const appWxss = read('miniprogram/app.wxss');
    const topbarWxml = read('miniprogram/components/app-topbar/index.wxml');
    const locationWxml = read('miniprogram/components/location-search/index.wxml');
    const homeWxml = read('miniprogram/pages/home/index.wxml');
    const resultWxml = read('miniprogram/pages/result/index.wxml');
    const mapWxml = read('miniprogram/pages/map/index.wxml');
    const galleryWxml = read('miniprogram/pages/gallery/index.wxml');
    const uploadWxml = read('miniprogram/pages/upload/index.wxml');
    const methodologyWxml = read('miniprogram/pages/methodology/index.wxml');

    expect(appWxss).toContain('.tap-feedback-hover');
    expect(appWxss).toContain('.button-hover');
    expect(appWxss).toContain('.card-tap-hover');
    expect(appWxss).toContain('transform: scale(0.97)');
    expect(topbarWxml).toContain('class="home-brand-row tap-feedback"');
    expect(topbarWxml).toContain('class="menu-button icon-button"');
    expect(topbarWxml).toContain('class="header-icon-button icon-button"');
    expect(topbarWxml).toContain('hover-class="button-hover"');
    expect(locationWxml).toContain('hover-class="button-hover" hover-stay-time="80" bindtap="onLocate"');
    expect(locationWxml).toContain('hover-class="button-hover" hover-stay-time="80" bindtap="onConfirm"');
    expect(homeWxml).toContain('class="weather-toggle tap-feedback');
    expect(homeWxml).toContain('class="prediction-toggle tap-feedback');
    expect(homeWxml).toContain('class="query-item tap-feedback"');
    expect(resultWxml).toContain('class="result-period-option tap-feedback');
    expect(resultWxml).toContain('class="switch-option tap-feedback"');
    expect(mapWxml).toContain('class="segment tap-feedback');
    expect(mapWxml).not.toContain('class="spot-row tap-feedback"');
    expect(galleryWxml).toContain('class="photo-card xiake-card glass-card tap-feedback"');
    expect(uploadWxml).toContain('class="picker-card xiake-card glass-card tap-feedback"');
    expect(methodologyWxml).toContain('bindtap="copyOpenApiSpec" hover-class="button-hover"');
  });

  test('theme settings apply a resolved light or dark theme to every native page', () => {
    const appConfig = JSON.parse(read('miniprogram/app.json'));
    const topbarWxml = read('miniprogram/components/app-topbar/index.wxml');
    const topbarJs = read('miniprogram/components/app-topbar/index.js');
    const topbarWxss = read('miniprogram/components/app-topbar/index.wxss');
    const locationWxml = read('miniprogram/components/location-search/index.wxml');
    const locationJs = read('miniprogram/components/location-search/index.js');
    const locationWxss = read('miniprogram/components/location-search/index.wxss');
    const appSettings = read('miniprogram/utils/app-settings.js');
    const appWxss = read('miniprogram/app.wxss');
    const homeWxml = read('miniprogram/pages/home/index.wxml');
    const homeWxss = read('miniprogram/pages/home/index.wxss');

    for (const page of appConfig.pages) {
      const wxml = read(`miniprogram/${page}.wxml`);
      const js = read(`miniprogram/${page}.js`);
      expect(wxml).toContain('theme-{{resolvedThemeMode}}');
      expect(wxml).toContain('bind:settingschange="onAppSettingsChange"');
      expect(js).toContain('applyPageSettings');
      expect(js).toContain('resolvedThemeMode');
      expect(js).toContain('onAppSettingsChange(event)');
    }

    expect(topbarWxml).toContain('theme-{{resolvedThemeMode}} theme-setting-{{themeMode}}');
    expect(topbarWxml).toContain('bindtap="selectTemperatureUnit"');
    expect(topbarWxml).toContain('bindtap="selectWindSpeedUnit"');
    expect(topbarJs).toContain("this.triggerEvent('settingschange'");
    expect(topbarJs).toContain('temperatureUnit');
    expect(topbarJs).toContain('windSpeedUnit');
    expect(topbarJs).toContain('applyNavigationTheme(settings.resolvedThemeMode)');
    expect(appSettings).toContain('resolveThemeMode(themeMode)');
    expect(appSettings).toContain('temperatureUnit');
    expect(appSettings).toContain('windSpeedUnit');
    expect(appSettings).toContain('wx.getAppBaseInfo');
    expect(appSettings).toContain('wx.getSystemSetting');
    expect(appWxss).toContain('.container.theme-dark');
    expect(appWxss).toContain('.container.theme-light');
    expect(topbarWxss).toContain('.app-topbar-shell.theme-dark .settings-panel');
    expect(homeWxss).toContain('.home-page.theme-dark.has-weather .home-weather-preview');
    expect(homeWxml).toContain('theme="{{resolvedThemeMode}}"');
    expect(locationWxml).toContain('theme-{{theme}}');
    expect(locationJs).toContain("theme: { type: String, value: 'light' }");
    expect(locationWxss).toContain('.location-search.theme-dark');
    expect(locationWxss).toContain('.location-search.theme-dark .input-row');
    expect(locationWxss).toContain('.location-search.theme-dark .location-input');
    expect(homeWxss).toContain('.home-page.theme-dark .home-footer-card');
    expect(homeWxss).not.toContain('.home-page.theme-dark.has-weather .home-footer-card');
    expect(homeWxss).toContain('.home-page.theme-dark.has-weather .weather-hourly-chart');
    expect(homeWxss).toContain('.home-page.theme-dark.has-weather .weather-hourly-axis-label');
    expect(homeWxss).toContain('.home-page.theme-dark.has-weather .weather-hourly-point-label');
    expect(homeWxss).toContain('.home-page.theme-dark.has-weather .weather-hourly-chart-dot');
    expect(homeWxml).not.toContain('weather-hourly-chart-bar');
    expect(homeWxss).not.toContain('.home-page.theme-dark.has-weather .weather-hourly-chart-bar');
    expect(homeWxss).not.toContain('.home-page.theme-dark.has-weather .weather-hourly-chart {\n  background: linear-gradient(180deg, rgba(255, 252, 246');
  });

  test('result page keeps users in the Xiake product loop after scoring', () => {
    const wxml = read('miniprogram/pages/result/index.wxml');
    const js = read('miniprogram/pages/result/index.js');
    const wxss = read('miniprogram/pages/result/index.wxss');

    expect(wxml).toContain('data-target="methodology"');
    expect(wxml).toContain('data-target="map"');
    expect(wxml).toContain('data-target="gallery"');
    expect(wxml).toContain('data-target="api"');
    expect(wxml).toContain('data-target="upload"');
    expect(js).toContain('navigateExperience(event)');
    expect(js).toContain("methodology: '/pages/methodology/index'");
    expect(js).toContain("map: `/pages/map/index?period=${this.data.prediction?.period || this.data.prediction?.type || 'sunset'}`");
    expect(js).toContain("gallery: '/pages/gallery/index'");
    expect(js).toContain("upload: '/pages/upload/index'");
    expect(wxss).toContain('.result-view-switch');
    expect(wxss).toContain('.switch-options');
    expect(wxss).toContain('border-radius: 999rpx');
    expect(wxss).not.toContain('.dock-grid');
  });

  test('result page never exposes backend condition enum tokens to users', () => {
    const wxml = read('miniprogram/pages/result/index.wxml');
    const js = read('miniprogram/pages/result/index.js');

    expect(js).toContain('humanizeExplanation');
    expect(js).toContain('conditions_good');
    expect(wxml).not.toMatch(/conditions_[a-z_]+/);
  });

  test('surrounding cloud panel uses a compass radar instead of a low-fi grid', () => {
    const wxml = read('miniprogram/pages/result/index.wxml');
    const wxss = read('miniprogram/pages/result/index.wxss');
    const js = read('miniprogram/pages/result/index.js');

    expect(wxml).toContain('radar-compass');
    expect(wxml).toContain('radar-compass-dial');
    expect(wxml).toContain('canvas-id="resultRadarCloudField"');
    expect(wxml).toContain('radar-direction-{{item.direction}}');
    expect(wxml).toContain('radar-legend');
    expect(wxml).not.toContain('class="radar-grid"');
    expect(wxss).toContain('.radar-compass-dial');
    expect(wxss).toContain('.radar-ring-outer');
    expect(wxss).toContain('.radar-ring-low-inner');
    expect(js).toContain('orderRadarDirections');
    expect(js).toContain('bestItems');
    expect(js).toContain('paintRadarCloudCanvas');
  });

  test('gallery is positioned as a native mini-program map with compressed photo viewing only', () => {
    const wxml = read('miniprogram/pages/gallery/index.wxml');
    const js = read('miniprogram/pages/gallery/index.js');

    expect(wxml).toContain('<map');
    expect(wxml).not.toContain('copyGalleryLink');
    expect(wxml).not.toContain('H5 地图');
    expect(wxml).not.toContain('查看原图');
    expect(wxml).toContain('native-map-shell');
    expect(js).not.toContain('copyGalleryLink()');
    expect(js).not.toContain('GALLERY_LINK');
    expect(js).toContain('previewPhoto(event = {})');
  });
});
