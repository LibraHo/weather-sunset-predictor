import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

function expectInOrder(source, tokens) {
  let cursor = -1;
  for (const token of tokens) {
    const next = source.indexOf(token, cursor + 1);
    expect(next).toBeGreaterThan(cursor);
    cursor = next;
  }
}

describe('mini-program home parity with mobile web home', () => {
  test('home keeps the web mobile information hierarchy after search controls', () => {
    const web = read('index.html');
    const homeWxml = read('miniprogram/pages/home/index.wxml');
    const homeWxss = read('miniprogram/pages/home/index.wxss');
    const homeJs = read('miniprogram/pages/home/index.js');

    expectInOrder(web, [
      'id="location-section"',
      'id="weather-section"',
      'id="three-day-glow-btn"',
      'id="prediction-section"'
    ]);

    expectInOrder(homeWxml, [
      'location-search',
      'control-card',
      'query-button',
      'home-weather-preview',
      'home-prediction-preview',
      'home-experience-strip',
      'placeholder-grid'
    ]);

    expect(homeWxml).toContain('weather-metric-grid');
    expect(homeWxml).toContain('weather-main-layout');
    expect(homeWxml).toContain('weather-visual-panel');
    expect(homeWxml).not.toContain('weatherPreview.description');
    expect(homeWxml).not.toContain('weatherPreview.badge');
    expect(homeWxml).toContain('src="{{weatherPreview.iconSrc}}"');
    expect(homeWxml).toContain('weatherPreview.temperature');
    expect(homeWxml).toContain('weatherPreview.windSpeed');
    expect(homeWxml).toContain('weatherPreview.metrics');
    expect(homeWxml).toContain('src="/assets/icons/metric-{{item.key}}.svg"');
    expect(homeWxml).toContain('weather-view-toggle');
    expect(homeWxml).toContain('bindtap="switchWeatherView"');
    expect(homeWxml).toContain('data-view="overview"');
    expect(homeWxml).toContain('data-view="hourly"');
    expect(homeWxml).toContain('data-view="glow"');
    expect(homeWxml).toContain('weather-weekly-list');
    expect(homeWxml).toContain('weather-weekly-date');
    expect(homeWxml).toContain('weather-weekly-icon');
    expect(homeWxml).toContain('src="{{item.iconSrc}}"');
    expect(homeWxml).toContain('weather-weekly-min');
    expect(homeWxml).toContain('weather-weekly-max');
    expect(homeWxml).toContain('weather-weekly-meta-icon');
    expect(homeWxml).toContain('/assets/icons/metric-precipitation.svg');
    expect(homeWxml).toContain('/assets/icons/metric-wind.svg');
    expect(homeWxml).toContain('weather-hourly-panel');
    expect(homeWxml).toContain('weather-day-selector');
    expect(homeWxml).toContain('weather-parameter-selector');
    expect(homeWxml).toContain('bindtap="switchWeatherDay"');
    expect(homeWxml).toContain('bindtap="switchWeatherParameter"');
    expect(homeWxml).toContain('data-param="temp"');
    expect(homeWxml).toContain('data-param="precip"');
    expect(homeWxml).toContain('data-param="humidity"');
    expect(homeWxml).toContain('data-param="wind"');
    expect(homeWxml).toContain('data-param="pressure"');
    expect(homeWxml).toContain('data-param="clouds"');
    expect(homeWxml).toContain('weather-chart-panel');
    expect(homeWxml).toContain('weather-hourly-chart');
    expect(homeWxml).toContain('canvas-id="homeHourlyChart"');
    expect(homeWxml).toContain('weather-hourly-canvas');
    expect(homeWxml).toContain('weather-hourly-point-label-{{item.labelPlacement}}');
    expect(homeWxml).not.toContain('weather-hourly-chart-path');
    expect(homeWxml).toContain('weather-hourly-axis-label');
    expect(homeWxml).not.toContain('hourly-weather-strip');
    expect(homeWxml).not.toContain('weather-hourly-row" wx:for="{{weatherPreview.hourly}}"');
    expect(homeWxml).toContain('weather-glow-panel');
    expect(homeWxml).toContain('weather-glow-card');
    expect(homeWxml).toContain('weather-glow-date');
    expect(homeWxml).toContain('/assets/icons/sun-event-sunrise.svg');
    expect(homeWxml).toContain('/assets/icons/sun-event-sunset.svg');
    expect(homeWxml).toContain('wx:for="{{weatherPreview.weekly}}"');
    expect(homeWxml).toContain('wx:for="{{weatherPreview.hourlyChart}}"');
    expect(homeWxml).toContain('wx:for="{{weatherPreview.glow}}"');
    expect(homeWxml).not.toContain('weather-glow-summary');
    expect(homeWxml).not.toContain('{{item.summary}}');
    expect(homeWxml).not.toContain('home-three-day-glow');
    expect(homeWxml).toContain('data-target="methodology"');
    expect(homeWxml).toContain('data-target="map"');
    expect(homeWxml).toContain('data-target="gallery"');
    expect(homeWxml).toContain('data-target="upload"');
    expect(homeWxss).toContain('.home-weather-preview');
    expect(homeWxss).toContain('.weather-main-layout');
    expect(homeWxss).toContain('.weather-visual-panel');
    expect(homeJs).toContain('/assets/icons/weather-');
    expect(homeJs).toContain("weatherView: 'overview'");
    expect(homeJs).toContain('switchWeatherView(event)');
    expect(homeJs).toContain('switchWeatherParameter(event)');
    expect(homeJs).toContain('switchWeatherDay(event)');
    expect(homeJs).toContain('buildWeatherHourlyPreview');
    expect(homeJs).toContain('buildWeatherHourlyChart');
    expect(homeJs).toContain('buildWeatherHourlyViewModel');
    expect(homeJs).toContain('paintHourlyChartCanvas');
    expect(homeJs).toContain('buildWeatherGlowPreview');
    expect(homeWxml).toContain('/assets/icons/metric-');
    expect(homeWxss).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(homeWxss).toContain('.weather-weekly-row');
    expect(homeWxss).toContain('grid-template-columns: 108rpx 50rpx minmax(100rpx, 1fr) 220rpx');
    expect(homeWxss).toContain('grid-template-columns: 78rpx 136rpx');
    expect(homeWxss).toContain('.weather-weekly-wind');
    expect(homeWxss).toContain('grid-template-columns: 22rpx 82rpx 14rpx');
    expect(homeWxss).toContain('flex: 0 0 24rpx');
    expect(homeWxss).toContain('.weather-weekly-precip-text');
    expect(homeWxss).toContain('.weather-weekly-wind-text');
    expect(homeWxss).toContain('linear-gradient(145deg, rgba(18, 28, 52, 0.72) 0%, rgba(14, 22, 44, 0.58) 100%)');
    expect(homeWxss).toContain('.weather-weekly-min');
    expect(homeWxss).toContain('.weather-weekly-max');
    expect(homeWxss).toContain('grid-template-columns: repeat(3, minmax(0, 1fr));');
    expect(homeWxss).toContain('.weather-glow-card');
    expect(homeWxss).toContain('.weather-glow-score-row');
    expect(homeWxss).toContain('.home-page.theme-dark.has-weather .weather-chart-title');
    expect(homeWxss).toContain('.weather-hourly-point-label-right');
    expect(homeWxss).toContain('.weather-hourly-point-label-left');
    expect(homeWxss).toContain('color: rgba(226, 232, 240, 0.84);');
    expect(homeWxss).not.toContain('.weather-glow-summary');
    expect(homeWxml).toContain('weather-forecast-module');
    expect(homeWxss).toContain('.weather-forecast-module');
    expect(homeWxss).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));');
    expect(homeWxss).toContain('align-self: stretch;');
    expect(homeWxss).toContain('.home-experience-strip');
  });

  test('weather icons keep the same colored SVG palette as the web weather card', () => {
    const webCss = read('styles/main.css');
    const partlyCloudy = read('miniprogram/assets/icons/weather-partly-cloudy.svg');
    const sunny = read('miniprogram/assets/icons/weather-sunny.svg');
    const cloud = read('miniprogram/assets/icons/weather-cloud.svg');
    const rain = read('miniprogram/assets/icons/weather-rain.svg');

    for (const token of ['#fbbf24', '#f59e0b', '#eef2ff', '#64748b', '#2563eb']) {
      expect(webCss).toContain(token);
    }

    expect(partlyCloudy).toContain('fill="#fbbf24"');
    expect(partlyCloudy).toContain('fill="#eef2ff"');
    expect(partlyCloudy).toContain('stroke="#64748b"');
    expect(partlyCloudy).not.toContain('viewBox="0 0 24 24" fill="none"');
    expect(sunny).toContain('fill="#fbbf24"');
    expect(cloud).toContain('fill="#eef2ff"');
    expect(rain).toContain('stroke="#2563eb"');
  });

  test('mini-program feature shortcuts preserve web menu order before upload', () => {
    const web = read('index.html');
    const homeWxml = read('miniprogram/pages/home/index.wxml');

    expectInOrder(web, [
      'data-view="methodology"',
      'data-view="map"',
      'data-view="gallery"',
      'data-view="api"'
    ]);

    expectInOrder(homeWxml, [
      'data-target="methodology"',
      'data-target="map"',
      'data-target="gallery"',
      'data-target="api"',
      'data-target="upload"'
    ]);
  });

  test('home keeps a direct API access route instead of hiding the web API surface', () => {
    const homeWxml = read('miniprogram/pages/home/index.wxml');
    const homeJs = read('miniprogram/pages/home/index.js');

    expect(homeWxml).toContain('data-target="api"');
    expect(homeJs).toContain("api: '/pages/methodology/index?section=api'");
  });

  test('home search uses the same in-card loading treatment as the web prediction flow', () => {
    const web = read('index.html');
    const webCss = read('styles/main.css');
    const homeWxml = read('miniprogram/pages/home/index.wxml');
    const homeWxss = read('miniprogram/pages/home/index.wxss');
    const homeJs = read('miniprogram/pages/home/index.js');

    expect(web).toContain('id="loading-indicator"');
    expect(web).toContain('id="loading-progress-fill"');
    expect(webCss).toContain('#prediction-section .loading');
    expect(webCss).toContain('.loading-progress-fill');

    expect(homeWxml).toContain('home-search-loading');
    expect(homeWxml).toContain('wx:if="{{loading}}"');
    expect(homeWxml).toContain('loadingMessage');
    expect(homeWxml).toContain('loadingProgress');
    expect(homeWxml).toContain('loadingDetail');
    expect(homeWxss).toContain('.home-search-loading');
    expect(homeWxss).toContain('.home-search-spinner');
    expect(homeWxss).toContain('.home-search-loading-progress');
    expect(homeWxss).toContain('animation: xiake-loading-progress 1.6s ease-in-out infinite alternate;');
    expect(homeJs).toContain("loadingMessage: '正在查询位置'");
    expect(homeJs).toContain('setSearchLoadingStep(');
    expect(homeJs).toContain("this.setSearchLoadingStep('正在读取基础天气', 58");
    expect(homeJs).toContain("this.setSearchLoadingStep('正在计算霞光评分', 82");
    expect(homeJs).toContain("this.setSearchLoadingStep('正在整理天气卡片', 92");
    expect(homeJs.indexOf('weather = await this.callWeatherForecast(query);')).toBeLessThan(homeJs.indexOf('const raw = await this.callPredictionService(query);'));
    expect(homeJs).toContain("this.setSearchLoadingStep('正在计算霞光评分', 72, '基础天气暂未返回，继续读取综合预测');");
    expect(homeWxml).toContain('prediction-local-loading');
    expect(homeWxml).toContain('wx:if="{{predictionPreviewLoading}}"');
  });

  test('home prediction preview mirrors the web test prediction card hierarchy', () => {
    const web = read('src/controllers/PredictionController.js');
    const webRender = web.slice(web.indexOf('  renderSinglePrediction('));
    const homeWxml = read('miniprogram/pages/home/index.wxml');
    const homeWxss = read('miniprogram/pages/home/index.wxss');
    const homeJs = read('miniprogram/pages/home/index.js');

    expectInOrder(webRender, [
      'prediction-share-menu',
      'phenomenon-title-card',
      'renderConclusionBanner',
      'score-summary-card',
      'renderCloudConditionCard',
      'renderAnalysisCard',
      'prediction-app-footer'
    ]);

    expectInOrder(homeWxml, [
      'home-prediction-preview',
      'prediction-panel-head',
      '朝晚霞预测',
      'prediction-toggle-bar',
      'prediction-hero-card',
      'phenomenon-title-card',
      'conclusion-banner',
      'score-summary-card',
      'cloud-condition-card',
      'app-analysis-card',
      'home-experience-strip'
    ]);

    expect(homeWxml).toContain('predictionPreview.score');
    expect(homeWxml).toContain('class="section-title prediction-panel-title">朝晚霞预测</view>');
    expect(homeWxml).toContain('predictionPreview.scoreLabel');
    expect(homeWxml).toContain('predictionPreview.bestViewingTime');
    expect(homeWxml).toContain('src="/assets/icons/share-upload.svg"');
    expect(homeWxss).toContain('background: linear-gradient(135deg, #ffd166, #fb923c)');
    expect(homeWxss).not.toContain('.home-page.has-weather .prediction-share-menu');
    expect(homeWxml).not.toContain('phenomenon-icon-tile');
    expect(homeWxml).not.toContain('src="/assets/icons/sun-event-{{predictionPreview.periodKey}}.svg"');
    expect(homeWxml).toContain('src="/assets/icons/leaf.svg"');
    expect(homeWxml).toContain('data-value="sunrise"');
    expect(homeWxml).toContain('data-value="sunset"');
    expect(homeWxml).toContain('wx:for="{{predictionPreview.clouds}}"');
    expect(homeWxml).toContain('wx:for="{{predictionPreview.analysis}}"');
    expect(homeWxml).toContain('prediction-radar-card');
    expect(homeWxml).toContain('prediction-radar-cloud-field');
    expect(homeWxml).toContain('id="homeRadarCloudField"');
    expect(homeWxml).toContain('canvas-id="homeRadarCloudField"');
    expect(homeWxml).toContain('type="2d"');
    expect(homeWxml).toContain('prediction-radar-cloud-canvas');
    expect(homeWxml).toContain('prediction-radar-ring-low-inner');
    expect(homeWxml).toContain('prediction-radar-ring-label-high');
    expect(homeWxml).not.toContain('prediction-radar-cloud-gradient');
    expect(homeWxml).not.toContain('prediction-radar-score');
    expect(homeWxml).toContain('wx:for="{{predictionPreview.radar.directions}}"');
    expect(homeWxml).not.toContain('prediction-radar-detail');
    expect(homeWxml).not.toContain('prediction-radar-cloud-blob');
    expect(homeWxml).not.toContain('predictionPreview.radar.cloudBlobs');
    expect(homeWxml).toContain('prediction-app-footer');
    expect(homeWxml).not.toContain('prediction-preview-action-primary');
    expect(homeWxml).not.toContain('查看完整预测');
    expect(homeJs).toContain('predictionPreview: buildDefaultPredictionPreview()');
    expect(homeJs).toContain('export function buildTestPredictionPreview');
    expect(homeJs).toContain("periodKey: 'sunset'");
    expect(homeJs).not.toContain("dateLabel: 'TEST'");
    expect(homeJs).toContain('buildPredictionAnalysisGroups');
    expect(homeJs).toContain('buildPredictionRadarPreview');
    expect(homeJs).toContain('lastRadarPaintSignature');
    expect(homeJs).toContain('clearTimeout(this.radarPaintTimer)');
    expect(homeJs).toContain('}, 80);');
    expect(homeJs).toContain('cloudGradients: buildRadarCloudGradients(directions)');
    expect(homeJs).toContain("paintRadarCloudCanvas('homeRadarCloudField', directions, { page: this })");
    expect(homeJs).not.toContain('buildRadarCloudBlobs');
    expect(homeWxss).toMatch(/\.prediction-toggle-bar\s*\{[\s\S]*box-sizing: border-box;[\s\S]*overflow: hidden;/);
    expect(homeWxss).toMatch(/\.prediction-toggle\s*\{[\s\S]*flex: 1;[\s\S]*min-width: 0;[\s\S]*box-sizing: border-box;/);
    expect(homeWxss).toContain('.prediction-hero-card');
    expect(homeWxss).toContain('.score-summary-card');
    expect(homeWxss).toContain('.home-page.theme-dark.has-weather .prediction-hero-card');
    expect(homeWxss).toContain('.app-main-time');
    expect(homeWxss).toContain('text-align: center;');
    expect(homeWxml).toContain('class="phenomenon-title-card"');
    expect(homeWxml.indexOf('phenomenon-date-tag')).toBeLessThan(homeWxml.indexOf('{{predictionPreview.periodLabel}}'));
    expect(homeWxml).not.toContain('bindtap="togglePredictionPreviewPeriod"');
    expect(homeWxss).not.toContain('.phenomenon-icon-tile');
    expect(homeWxss).not.toContain('.home-page.has-weather .phenomenon-title-card');
    expect(homeWxss).toContain('.prediction-toggle-bar');
    expect(homeWxss).toContain('.prediction-panel-title');
    expect(homeWxss).toContain('display: flex;');
    expect(homeWxss).toContain('width: 332rpx');
    expect(homeWxss).toContain('background: linear-gradient(135deg, #f59e0b, #ea8500)');
    expect(homeWxss).toContain('.cloud-condition-card');
    expect(homeWxss).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(homeWxss).toContain('.app-analysis-card');
    expect(homeWxss).toContain('.prediction-radar-card');
    expect(homeWxss).toContain('.prediction-radar-cloud-canvas');
    expect(homeWxss).toContain('.prediction-radar-ring-low-inner');
    expect(homeWxss).toContain('.prediction-radar-ring-high { width: 84%; height: 84%; }');
    expect(homeWxss).toContain('top: 6.3%;');
    expect(homeWxss).toContain('height: 87.4%;');
    expect(homeWxss).toContain('.prediction-radar-ring-label-high');
    expect(homeWxss).toContain('.prediction-radar-ring-label-high { left: 37.3%; top: 15.2%; }');
    expect(homeWxss).toContain('.home-page.theme-dark.has-weather .prediction-radar-title');
    expect(homeWxss).toContain('color: rgba(241, 245, 249, 0.95);');
    expect(homeWxss).toContain('.home-page.theme-dark.has-weather .prediction-radar-subtitle');
    expect(homeWxss).toContain('color: rgba(148, 163, 184, 0.80);');
    expect(homeWxss).toContain('.home-page.theme-dark.has-weather .prediction-radar-ring-label');
    expect(homeWxss).toContain('color: rgba(203, 213, 225, 0.78);');
    expect(homeWxss).toContain('.home-page.theme-dark.has-weather .prediction-radar-name');
    expect(homeWxss).toContain('color: rgba(220, 230, 245, 0.92);');
    expect(homeWxss).toContain('.home-page.theme-dark.has-weather .prediction-app-footer');
    expect(homeWxss).toContain('.home-page.theme-dark.has-weather .experience-chip');
    expect(homeWxss).toContain('.home-page.theme-dark.has-weather .query-item');
    expect(homeWxss).toContain('.home-page.theme-dark.has-weather .mini-card');
    expect(homeWxss).not.toContain('.prediction-radar-score');
    expect(homeWxss).not.toContain('.prediction-radar-cloud-gradient');
    expect(homeWxss).not.toContain('.prediction-radar-cloud-blob-high');
  });
});
