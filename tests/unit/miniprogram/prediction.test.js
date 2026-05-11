import { jest } from '@jest/globals';
import { configureApi, resetApiConfig, setWxInstance } from '../../../miniprogram/services/api.js';
import { getEnhancedPrediction, normalizePrediction } from '../../../miniprogram/services/prediction.js';

describe('miniprogram services/prediction', () => {
  afterEach(() => {
    resetApiConfig();
    jest.restoreAllMocks();
  });

  test('normalizePrediction exposes result-page friendly fields', () => {
    const normalized = normalizePrediction({
      score: 82.4,
      quality: 'excellent',
      bestViewingWindow: { start: '18:30', end: '19:10' },
      cloudLayers: { high: 70, mid: 35, low: 12 },
      weatherData: { visibility: 18, humidity: 56, aod: 0.18 },
      summary: { description: 'conditions look good' }
    });

    expect(normalized).toMatchObject({
      score: 82.4,
      quality: 'excellent',
      bestWindow: { start: '18:30', end: '19:10' },
      clouds: { high: 70, mid: 35, low: 12 },
      visibility: 18,
      humidity: 56,
      aod: 0.18,
      summary: { description: 'conditions look good' },
      explanation: 'conditions look good'
    });
  });

  test('getEnhancedPrediction posts request and normalizes backend data', async () => {
    const wxMock = {
      request: jest.fn(({ success }) => success({
        statusCode: 200,
        data: {
          success: true,
          data: {
            score: 76,
            status: 'good',
            goldenHour: { start: '2026-05-11T10:00:00Z', end: '2026-05-11T11:00:00Z' },
            cloudLayers: { high: 61, mid: 30, low: 10 },
            weatherData: { visibility: 20, humidity: 45, aqi: 34 }
          }
        }
      }))
    };
    setWxInstance(wxMock);
    configureApi({ baseUrl: 'https://api.example.com' });

    const result = await getEnhancedPrediction({ lat: 39.9, lon: 116.4, type: 'sunset', date: '2026-05-11' });

    expect(wxMock.request).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://api.example.com/api/prediction/enhanced',
      method: 'POST',
      data: { lat: 39.9, lon: 116.4, type: 'sunset', date: '2026-05-11', referenceTime: '2026-05-11' }
    }));
    expect(result).toMatchObject({
      score: 76,
      quality: 'good',
      clouds: { high: 61, mid: 30, low: 10 },
      visibility: 20,
      humidity: 45,
      aod: 34
    });
  });
});
