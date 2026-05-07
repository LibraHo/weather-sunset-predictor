import { jest } from '@jest/globals';
import OpenMeteoAPIService from '@services/OpenMeteoAPIService.js';

// 确保 global.fetch 存在（jest 环境可能没有原生 fetch）
if (!global.fetch) {
  global.fetch = () => Promise.resolve({ ok: true, json: () => ({}) });
}

describe('OpenMeteoAPIService', () => {
  let service;
  let fetchSpy;

  beforeEach(() => {
    service = new OpenMeteoAPIService('ignored', { proxyURL: 'http://localhost:3000' });
    fetchSpy = jest.spyOn(global, 'fetch').mockReset();
  });

  afterEach(() => {
    localStorage.clear();
    if (fetchSpy) fetchSpy.mockRestore();
  });

  test('calls backend forecast endpoint with GET', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ windyEnabled: false })
    });
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] })
    });

    await service.fetchWeatherData(39.9, 116.4, 24);

    const calls = fetchSpy.mock.calls;
    const forecastCall = calls.find(c => c[0].includes('/api/weather/forecast'));
    expect(forecastCall[0]).toContain('/api/weather/forecast?lat=39.9&lon=116.4&hours=24');
  });

  test('throws backend error when response is not ok', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ windyEnabled: false })
    });
    fetchSpy.mockResolvedValueOnce({ ok: false, status: 503 });

    await expect(service.fetchWeatherData(39.9, 116.4, 24)).rejects.toThrow('后端请求失败: 503');
  });

  test('preserves air quality fields for weather panel display', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ windyEnabled: false })
    });
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{
          timestamp: 1700000000000,
          temp: 25,
          humidity: 60,
          cloudCover: 40,
          windSpeed: 4,
          pressure: 1012,
          aerosolOpticalDepth: 0.62,
          dust: 68,
          pm2_5: 46.6,
          pm10: 82.2,
          aqi: 170
        }]
      })
    });

    const data = await service.fetchWeatherData(39.9, 116.4, 24);

    expect(data[0].aerosolOpticalDepth).toBe(0.62);
    expect(data[0].dust).toBe(68);
    expect(data[0].pm2_5).toBe(46.6);
    expect(data[0].pm10).toBe(82.2);
    expect(data[0].aqi).toBe(170);
  });

  test('attaches providerMeta from backend response', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ windyEnabled: false })
    });
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{
          timestamp: 1700000000000,
          temp: 25,
          humidity: 60,
          cloudCover: 40,
          windSpeed: 4,
          pressure: 1012
        }],
        providerMeta: { name: 'openmeteo', dataQuality: 'excellent' }
      })
    });

    const data = await service.fetchWeatherData(39.9, 116.4, 24);
    expect(data.providerMeta).toEqual({ name: 'openmeteo', dataQuality: 'excellent' });
  });

  test('client mode bypasses backend and uses browser weather fetcher', async () => {
    localStorage.setItem('weather_fetch_mode', 'client');
    localStorage.setItem('weather_model', 'gfs_seamless');
    const fallbackData = [];
    service.clientWeatherService.fetchWeatherData = jest.fn().mockResolvedValue(fallbackData);

    const data = await service.fetchWeatherData(39.9, 116.4, 24);

    expect(data).toBe(fallbackData);
    expect(service.clientWeatherService.fetchWeatherData).toHaveBeenCalledWith(39.9, 116.4, 24, 'gfs_seamless');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('client-fallback mode uses browser fetcher only for eligible backend weather errors', async () => {
    localStorage.setItem('weather_fetch_mode', 'client-fallback');
    const fallbackData = [];
    service.clientWeatherService.fetchWeatherData = jest.fn().mockResolvedValue(fallbackData);
    service.fetchFromProxy = jest.fn().mockRejectedValue(new Error('WEATHER_RATE_LIMITED: backend quota'));

    const data = await service.fetchWeatherData(39.9, 116.4, 24);

    expect(data).toBe(fallbackData);
    expect(service.fetchFromProxy).toHaveBeenCalledWith(39.9, 116.4, 24);
    expect(service.clientWeatherService.fetchWeatherData).toHaveBeenCalledWith(39.9, 116.4, 24, 'ecmwf_ifs025');
  });

  test('client-fallback mode does not hide non-weather backend errors', async () => {
    localStorage.setItem('weather_fetch_mode', 'client-fallback');
    service.clientWeatherService.fetchWeatherData = jest.fn();
    service.fetchFromProxy = jest.fn().mockRejectedValue(new Error('后端返回数据格式错误'));

    await expect(service.fetchWeatherData(39.9, 116.4, 24)).rejects.toThrow('后端返回数据格式错误');
    expect(service.clientWeatherService.fetchWeatherData).not.toHaveBeenCalled();
  });
});
