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
    expect(homeWxml).toContain('weather-hourly-chart-path');
    expect(homeWxml).toContain('weather-hourly-axis-label');
    expect(homeWxml).toContain('hourly-weather-strip');
    expect(homeWxml).toContain('weather-glow-panel');
    expect(homeWxml).toContain('wx:for="{{weatherPreview.weekly}}"');
    expect(homeWxml).toContain('wx:for="{{weatherPreview.hourly}}"');
    expect(homeWxml).toContain('wx:for="{{weatherPreview.hourlyChart}}"');
    expect(homeWxml).toContain('wx:for="{{weatherPreview.glow}}"');
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
    expect(homeJs).toContain('buildWeatherGlowPreview');
    expect(homeWxml).toContain('/assets/icons/metric-');
    expect(homeWxss).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(homeWxss).toContain('.weather-weekly-row');
    expect(homeWxss).toContain('.home-experience-strip');
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
      'prediction-app-nav',
      'prediction-preview-action-row',
      'prediction-toggle-bar',
      'phenomenon-title-card',
      'conclusion-banner',
      'score-summary-card',
      'cloud-condition-card',
      'app-analysis-card',
      'home-experience-strip'
    ]);

    expect(homeWxml).toContain('predictionPreview.score');
    expect(homeWxml).toContain('predictionPreview.scoreLabel');
    expect(homeWxml).toContain('predictionPreview.bestViewingTime');
    expect(homeWxml).toContain('src="/assets/icons/share-upload.svg"');
    expect(homeWxml).toContain('src="/assets/icons/sun-event-{{predictionPreview.periodKey}}.svg"');
    expect(homeWxml).toContain('src="/assets/icons/leaf.svg"');
    expect(homeWxml).toContain('data-value="sunrise"');
    expect(homeWxml).toContain('data-value="sunset"');
    expect(homeWxml).toContain('wx:for="{{predictionPreview.clouds}}"');
    expect(homeWxml).toContain('wx:for="{{predictionPreview.analysis}}"');
    expect(homeWxml).toContain('prediction-radar-card');
    expect(homeWxml).toContain('wx:for="{{predictionPreview.radar.directions}}"');
    expect(homeWxml).toContain('prediction-app-footer');
    expect(homeWxml).not.toContain('prediction-preview-action-primary');
    expect(homeWxml).not.toContain('查看完整预测');
    expect(homeJs).toContain('predictionPreview: buildDefaultPredictionPreview()');
    expect(homeJs).toContain('export function buildTestPredictionPreview');
    expect(homeJs).toContain("periodKey: 'sunset'");
    expect(homeJs).toContain('buildPredictionAnalysisGroups');
    expect(homeJs).toContain('buildPredictionRadarPreview');
    expect(homeWxss).toContain('.score-summary-card');
    expect(homeWxss).toContain('.cloud-condition-card');
    expect(homeWxss).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(homeWxss).toContain('.app-analysis-card');
    expect(homeWxss).toContain('.prediction-radar-card');
  });
});
