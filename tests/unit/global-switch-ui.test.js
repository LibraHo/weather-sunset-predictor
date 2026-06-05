import fs from 'fs';
import path from 'path';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('global switch unavailable UI', () => {
  test('web forecast panel has a simple unavailable card and keeps map entries', () => {
    const html = read('index.html');
    const css = read('styles/main.css');
    const appController = read('src/controllers/AppController.js');

    expect(html).toContain('id="weather-unavailable-card"');
    expect(html).toContain('data-i18n="weather.unavailable.title"');
    expect(html).toContain('data-i18n="weather.unavailable.body"');
    expect(html).toContain('data-weather-unavailable-action="gallery"');
    expect(html).toContain('data-weather-unavailable-action="map"');
    expect(html).toContain('data-view="gallery" data-i18n="home.tabs.shareMap"');
    expect(html).toContain('data-view="map" data-i18n="home.tabs.map"');

    expect(css).toContain('.weather-unavailable-card');
    expect(css).toContain('backdrop-filter');
    expect(appController).toContain('loadSiteState');
    expect(appController).toContain('applyWeatherPredictionAvailability');
    expect(appController).toContain('weatherPredictionClosed');
  });

  test('mini-program home hides prediction controls and shows two map entries when weather is unavailable', () => {
    const wxml = read('miniprogram/pages/home/index.wxml');
    const wxss = read('miniprogram/pages/home/index.wxss');
    const js = read('miniprogram/pages/home/index.js');

    expect(wxml).toContain('wx:if="{{siteState.weatherPredictionClosed}}"');
    expect(wxml).toContain('weather-unavailable-card');
    expect(wxml).toContain('data-target="gallery"');
    expect(wxml).toContain('data-target="map"');
    expect(wxml).toContain('wx:if="{{!siteState.weatherPredictionClosed}}"');
    expect(wxss).toContain('.weather-unavailable-card');
    expect(wxss).toContain('.theme-light .weather-unavailable-card');
    expect(wxss).toContain('.theme-dark .weather-unavailable-card');
    expect(js).toContain('loadSiteState');
    expect(js).toContain('weatherPredictionClosed');
  });

  test('required locale keys exist in all web locales', () => {
    for (const locale of fs.readdirSync(path.join(root, 'src/locales')).filter(file => file.endsWith('.js') && file !== 'index.js')) {
      const source = read(path.join('src/locales', locale));
      for (const token of ['unavailable', 'shareMap', 'firecloudMap', 'globalSwitches', 'weatherPredictionClosed', 'siteClosed']) {
        expect(source).toContain(token);
      }
    }
  });
});
