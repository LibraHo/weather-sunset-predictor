import { jest } from '@jest/globals';
import { configureApi, resetApiConfig, setWxInstance } from '../../../miniprogram/services/api.js';
import {
  buildThreeDayDates,
  getEnhancedPrediction,
  getEnhancedPredictionBatch,
  getHomeGateway,
  getThreeDayGlow,
  getWeatherForecast,
  getSurroundingPrediction,
  normalizePrediction,
  normalizeSurroundingPrediction,
  scoreToLevel
} from '../../../miniprogram/services/prediction.js';

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
      lat: null,
      lon: null,
      bestWindow: { start: '18:30', end: '19:10' },
      clouds: { high: 70, mid: 35, low: 12 },
      visibility: 18,
      humidity: 56,
      aod: 0.18,
      weatherData: expect.objectContaining({
        temp: null,
        humidity: 56,
        visibility: 18,
        aod: 0.18
      }),
      canvasAnalysis: null,
      lightPathAnalysis: null,
      renderingAnalysis: null,
      summary: { description: 'conditions look good' },
      explanation: 'conditions look good'
    });
  });

  test('normalizePrediction preserves real weather fields for the home weather card', () => {
    const normalized = normalizePrediction({
      score: 76,
      status: 'good',
      cloudLayers: { high: 62, mid: 36, low: 8 },
      weatherData: {
        temperature_2m: 21.6,
        relative_humidity_2m: 68,
        surface_pressure: 1008.7,
        visibility: 16000,
        wind_speed_10m: 11.4,
        wind_direction_10m: 270,
        precipitation: 0,
        aerosol_optical_depth: 0.12,
        cloud_cover: 36
      }
    });

    expect(normalized.weatherData).toMatchObject({
      temp: 21.6,
      humidity: 68,
      pressure: 1008.7,
      visibility: 16,
      windSpeed: 11.4,
      windDirection: 270,
      precipitation: 0,
      aod: 0.12,
      cloudCover: 36
    });
  });

  test('normalizePrediction preserves backend referenceTime separately from viewing window', () => {
    const normalized = normalizePrediction({
      score: 76,
      status: 'good',
      type: 'sunset',
      referenceTime: '2026-05-18T11:24:00.000Z',
      goldenHour: {
        start: '2026-05-18T10:58:00.000Z',
        end: '2026-05-18T11:28:00.000Z'
      }
    });

    expect(normalized.referenceTime).toBe('2026-05-18T11:24:00.000Z');
    expect(normalized.date).toBe('2026-05-18T11:24:00.000Z');
    expect(normalized.bestWindow).toEqual({
      start: '2026-05-18T10:58:00.000Z',
      end: '2026-05-18T11:28:00.000Z'
    });
  });

  test('getWeatherForecast fetches basic weather without invoking scoring', async () => {
    const wxMock = {
      request: jest.fn(({ success }) => success({
        statusCode: 200,
        data: {
          success: true,
          data: [
            {
              temperature_2m: 21.6,
              relative_humidity_2m: 68,
              surface_pressure: 1008.7,
              visibility: 16000,
              wind_speed_10m: 11.4,
              wind_direction_10m: 270,
              precipitation: 0,
              cloud_cover: 36,
              cloud_cover_high: 62,
              cloud_cover_mid: 36,
              cloud_cover_low: 8
            }
          ],
          providerMeta: { name: 'openmeteo' }
        }
      }))
    };
    setWxInstance(wxMock);
    configureApi({ baseUrl: 'https://api.example.com' });

    const result = await getWeatherForecast({ lat: 39.9, lon: 116.4, hours: 168 });

    expect(wxMock.request).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://api.example.com/api/weather/forecast?lat=39.9&lon=116.4&hours=168',
      method: 'GET',
      timeout: 12000
    }));
    expect(wxMock.request.mock.calls[0][0].url).not.toContain('/api/prediction/enhanced');
    expect(result).toMatchObject({
      temp: 21.6,
      humidity: 68,
      pressure: 1008.7,
      visibility: 16,
      windSpeed: 11.4,
      windDirection: 270,
      precipitation: 0,
      cloudCover: 36,
      highClouds: 62,
      midClouds: 36,
      lowClouds: 8,
      provider: 'openmeteo'
    });
  });

  test('getHomeGateway fetches one authoritative home payload', async () => {
    const wxMock = {
      request: jest.fn(({ success }) => success({
        statusCode: 200,
        data: {
          success: true,
          data: {
            weather: {
              current: {
                temp: 22.4,
                humidity: 62,
                visibility: 20,
                windSpeed: 8,
                windDirection: 135,
                pressure: 1006,
                precipitation: 0,
                cloudCover: 35,
                highClouds: 60,
                midClouds: 30,
                lowClouds: 8
              },
              hourly: [],
              providerMeta: { name: 'openmeteo' }
            },
            predictions: {
              currentPeriod: 'sunset',
              current: { type: 'sunset', score: 76, weatherData: { visibility: 20, humidity: 62 } },
              sunrise: { type: 'sunrise', score: 58 },
              sunset: { type: 'sunset', score: 76 },
              byDate: [
                {
                  date: '2026-05-11',
                  sunrise: { type: 'sunrise', score: 58 },
                  sunset: { type: 'sunset', score: 76 }
                }
              ]
            }
          }
        }
      }))
    };
    setWxInstance(wxMock);
    configureApi({ baseUrl: 'https://api.example.com' });

    const result = await getHomeGateway({
      lat: 39.9,
      lon: 116.4,
      date: '2026-05-11',
      period: 'sunset',
      days: 3
    });

    expect(wxMock.request).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://api.example.com/api/prediction/home?lat=39.9&lon=116.4&date=2026-05-11&period=sunset&days=3&includeRemoteCloudData=true',
      method: 'GET',
      timeout: 30000
    }));
    expect(result.weather).toMatchObject({
      temp: 22.4,
      humidity: 62,
      visibility: 20,
      windSpeed: 8,
      windDirection: 135
    });
    expect(result.predictionCards.sunset).toMatchObject({ type: 'sunset', score: 76 });
    expect(result.predictionCards.sunrise).toMatchObject({ type: 'sunrise', score: 58 });
    expect(result.threeDayGlow).toHaveLength(1);
  });

  test('getEnhancedPrediction lets the backend derive local sunrise or sunset reference time from the date', async () => {
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
      data: {
        lat: 39.9,
        lon: 116.4,
        type: 'sunset',
        date: '2026-05-11'
      },
      timeout: 20000
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

  test('getEnhancedPredictionBatch fetches sunrise and sunset cards in one closed-loop request', async () => {
    const wxMock = {
      request: jest.fn(({ success }) => success({
        statusCode: 200,
        data: {
          success: true,
          data: [
            {
              id: 'sunrise',
              type: 'sunrise',
              score: 58,
              referenceTime: '2026-05-11T21:02:00.000Z',
              goldenHour: { start: '2026-05-11T20:42:00.000Z', end: '2026-05-11T21:22:00.000Z' }
            },
            {
              id: 'sunset',
              type: 'sunset',
              score: 76,
              referenceTime: '2026-05-11T11:24:00.000Z',
              goldenHour: { start: '2026-05-11T10:58:00.000Z', end: '2026-05-11T11:28:00.000Z' }
            }
          ]
        }
      }))
    };
    setWxInstance(wxMock);
    configureApi({ baseUrl: 'https://api.example.com' });

    const result = await getEnhancedPredictionBatch({
      lat: 39.9,
      lon: 116.4,
      items: [
        { id: 'sunrise', type: 'sunrise', date: '2026-05-11' },
        { id: 'sunset', type: 'sunset', date: '2026-05-11' }
      ]
    });

    expect(wxMock.request).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://api.example.com/api/prediction/enhanced/closed-loop/batch',
      method: 'POST',
      timeout: 30000,
      data: {
        lat: 39.9,
        lon: 116.4,
        options: { includeRemoteCloudData: true },
        items: [
          { id: 'sunrise', type: 'sunrise', date: '2026-05-11' },
          { id: 'sunset', type: 'sunset', date: '2026-05-11' }
        ]
      }
    }));
    expect(result).toEqual([
      expect.objectContaining({ type: 'sunrise', score: 58, referenceTime: '2026-05-11T21:02:00.000Z' }),
      expect.objectContaining({ type: 'sunset', score: 76, referenceTime: '2026-05-11T11:24:00.000Z' })
    ]);
  });

  test('getThreeDayGlow uses one closed-loop batch instead of six enhanced requests', async () => {
    const wxMock = {
      request: jest.fn(({ success }) => success({
        statusCode: 200,
        data: {
          success: true,
          data: Array.from({ length: 6 }, (_, index) => ({
            id: `item-${index}`,
            type: index % 2 === 0 ? 'sunrise' : 'sunset',
            score: 60 + index,
            referenceTime: '2026-05-11T11:24:00.000Z'
          }))
        }
      }))
    };
    setWxInstance(wxMock);
    configureApi({ baseUrl: 'https://api.example.com' });

    const result = await getThreeDayGlow({ lat: 39.9, lon: 116.4 });

    expect(wxMock.request).toHaveBeenCalledTimes(1);
    expect(wxMock.request.mock.calls[0][0]).toMatchObject({
      url: 'https://api.example.com/api/prediction/enhanced/closed-loop/batch',
      method: 'POST',
      timeout: 30000
    });
    expect(wxMock.request.mock.calls[0][0].data.items).toHaveLength(6);
    expect(wxMock.request.mock.calls[0][0].data.items.map((item) => item.type)).toEqual([
      'sunrise', 'sunset', 'sunrise', 'sunset', 'sunrise', 'sunset'
    ]);
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      sunrise: expect.objectContaining({ score: 60 }),
      sunset: expect.objectContaining({ score: 61 })
    });
  });

  test('normalizeSurroundingPrediction keeps 8-direction radar essentials', () => {
    const radar = normalizeSurroundingPrediction({
      points: [
        {
          direction: 'NE',
          name: '东北',
          score: 77.4,
          cloudLayers: { high: 60, mid: 24, low: 8 }
        }
      ],
      bestDirection: { direction: 'NE' }
    });

    expect(radar.points[0]).toMatchObject({
      key: 'NE',
      direction: 'NE',
      name: '东北',
      score: 77.4,
      level: 'good',
      highCloud: 60,
      midCloud: 24,
      lowCloud: 8
    });
    expect(radar.bestDirection).toEqual({ direction: 'NE' });
  });

  test('normalizeSurroundingPrediction keeps real backend cloud fields for canvas radar', () => {
    const radar = normalizeSurroundingPrediction({
      points: [
        { direction: 'W', score: 76, highClouds: 64, midCloud: 36, lowCloudCover: 8 },
        { direction: 'NW', score: 69, weather: { highClouds: 55, midClouds: 38, lowClouds: 12 } }
      ]
    });

    expect(radar.points[0]).toMatchObject({
      direction: 'W',
      highCloud: 64,
      midCloud: 36,
      lowCloud: 8
    });
    expect(radar.points[1]).toMatchObject({
      direction: 'NW',
      highCloud: 55,
      midCloud: 38,
      lowCloud: 12
    });
  });

  test('getSurroundingPrediction posts to surrounding API', async () => {
    const wxMock = {
      request: jest.fn(({ success }) => success({
        statusCode: 200,
        data: {
          success: true,
          data: {
            points: [{ direction: 'S', name: '南', prediction: { score: 45 }, cloudLayers: { high: 10, mid: 20, low: 30 } }]
          }
        }
      }))
    };
    setWxInstance(wxMock);
    configureApi({ baseUrl: 'https://api.example.com' });

    const result = await getSurroundingPrediction({ lat: 39.9, lon: 116.4, type: 'sunrise', date: '2026-05-11', radius: 100 });

    expect(wxMock.request).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://api.example.com/api/prediction/surrounding',
      method: 'POST',
      data: { lat: 39.9, lon: 116.4, type: 'sunrise', date: '2026-05-11', radius: 100 }
    }));
    expect(result.points[0]).toMatchObject({ direction: 'S', score: 45, level: 'watch' });
  });

  test('buildThreeDayDates and score levels match web score bands', () => {
    const days = buildThreeDayDates(new Date('2026-05-13T00:00:00Z'));
    expect(days.map((day) => day.label)).toEqual(['今天', '明天', '后天']);
    expect(days.map((day) => day.date)).toEqual(['2026-05-13', '2026-05-14', '2026-05-15']);
    expect([scoreToLevel(91), scoreToLevel(77), scoreToLevel(45), scoreToLevel(12)]).toEqual([
      'excellent',
      'good',
      'watch',
      'weak'
    ]);
  });
});
