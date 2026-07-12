import { jest } from '@jest/globals';
import fs from 'fs';
import AppController from '../../../src/controllers/AppController.js';
import i18n from '../../../src/i18n.js';

function createController(overrides = {}) {
  const storageService = {
    getDefaultLocation: () => null,
    getSearchHistory: () => [],
    getFavoriteLocations: () => [],
    saveSearchHistory: () => true,
    ...overrides
  };
  return new AppController(storageService, null, null, null);
}

describe('AppController home state audit items 13-17', () => {
  beforeEach(async () => {
    localStorage.setItem('language', 'zh-CN');
    await i18n.changeLanguage('zh-CN');
    document.body.innerHTML = `
      <input id="location-input" value="Paris">
      <button id="search-btn"></button>
      <div id="forecast-empty-state"></div>
      <div id="empty-state-actions"></div>
      <footer id="app-footer" class="app-footer app-footer-empty"><button id="refresh-btn" disabled></button></footer>
      <div id="weather-context-inline" class="hidden">
        <span id="weather-context-date-time"></span>
        <span id="weather-context-updated"></span>
      </div>
    `;
  });

  afterEach(() => localStorage.clear());

  test('keeps result context inside the weather card instead of a standalone bar', () => {
    const page = fs.readFileSync('index.html', 'utf8');
    expect(page).toContain('id="weather-context-inline"');
    expect(page).not.toContain('id="result-context-bar"');
  });

  test('renders default, recent and favorite shortcuts without duplicates', () => {
    const controller = createController({
      getDefaultLocation: () => ({ name: '上海', lat: 31.23, lon: 121.47 }),
      getSearchHistory: () => [{ name: '巴黎', lat: 48.86, lon: 2.35 }],
      getFavoriteLocations: () => [{ name: '东京', lat: 35.68, lon: 139.76 }]
    });

    controller.renderForecastEmptyState();

    expect([...document.querySelectorAll('.empty-state-location-btn')].map(button => button.textContent))
      .toEqual(['上海', '巴黎', '东京', '北京']);
  });

  test('hides empty-only footer controls after weather results exist', () => {
    const controller = createController();
    controller.setResultState(true);

    expect(document.getElementById('forecast-empty-state').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('app-footer').classList.contains('app-footer-empty')).toBe(false);
    expect(document.getElementById('refresh-btn').disabled).toBe(false);
  });

  test('keeps the successful search text', async () => {
    const controller = createController();
    controller.geocodingService = { geocode: jest.fn().mockResolvedValue({ name: 'Paris' }) };
    controller.handleLocationChange = jest.fn().mockResolvedValue();
    controller.hideCitySuggestions = jest.fn();
    controller.clearLocationError = jest.fn();
    controller.showLoading = jest.fn();
    controller.showSuccess = jest.fn();
    controller.loadSearchHistory = jest.fn();

    await controller.handleLocationSearch();

    expect(document.getElementById('location-input').value).toBe('Paris');
  });

  test('renders only the event time and update time below the location', () => {
    const controller = createController();
    const eventTime = new Date(Date.now() + 60 * 60 * 1000);
    controller.updateWeatherContext(
      { name: '巴黎', timezone: 'Europe/Paris' },
      Object.assign([], { fetchedAt: Date.now(), providerMeta: { timezone: 'Europe/Paris' } }),
      [{ type: 'sunset', sunsetTime: eventTime }]
    );

    expect(document.getElementById('weather-context-inline').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('weather-context-inline').textContent).not.toContain('优先预测');
    expect(document.getElementById('weather-context-inline').textContent).not.toContain(i18n.t('prediction.sunset'));
    expect(document.getElementById('weather-context-date-time').textContent).not.toBe('');
    expect(document.getElementById('weather-context-updated').textContent).not.toBe('');
  });

  test('renders the active event immediately from local sun times while predictions load', () => {
    const controller = createController();
    const now = Date.now();
    controller.predictionController = {
      predictionService: {
        getSunriseTime: jest.fn().mockReturnValue(new Date(now - 8 * 60 * 60 * 1000)),
        getSunsetTime: jest.fn().mockReturnValue(new Date(now + 2 * 60 * 60 * 1000))
      }
    };
    const weatherData = Object.assign([{ timezone: 'Europe/Paris' }], { fetchedAt: now });

    controller.updateWeatherContext(
      { name: '巴黎', lat: 48.86, lon: 2.35, timezone: 'Europe/Paris' },
      weatherData,
      []
    );

    expect(document.getElementById('weather-context-inline').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('weather-context-date-time').textContent).not.toBe('');
  });
});
