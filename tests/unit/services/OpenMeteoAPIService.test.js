import { jest } from '@jest/globals';
import OpenMeteoAPIService from '@services/OpenMeteoAPIService.js';

global.fetch = jest.fn();

describe('OpenMeteoAPIService', () => {
  let service;

  beforeEach(() => {
    service = new OpenMeteoAPIService('ignored');
    fetch.mockReset();
  });

  test('calls backend forecast endpoint with GET', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] })
    });

    await service.fetchWeatherData(39.9, 116.4, 24);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/weather/forecast?lat=39.9&lon=116.4&hours=24')
    );
  });

  test('throws backend error when response is not ok', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 503 });

    await expect(service.fetchWeatherData(39.9, 116.4, 24)).rejects.toThrow('后端请求失败: 503');
  });

  test('attaches providerMeta from backend response', async () => {
    fetch.mockResolvedValueOnce({
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
});
