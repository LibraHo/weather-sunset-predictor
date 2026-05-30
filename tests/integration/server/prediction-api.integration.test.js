import express from 'express';
import { jest } from '@jest/globals';
import { TextEncoder, TextDecoder } from 'node:util';

if (!global.TextEncoder) {
  global.TextEncoder = TextEncoder;
}

if (!global.TextDecoder) {
  global.TextDecoder = TextDecoder;
}

describe('Prediction API Integration', () => {
  let app;
  let request;
  let orchestrator;

  beforeAll(async () => {
    const predictionRouterModule = await import('../../../server/routes/prediction.js');
    const supertestModule = await import('supertest');
    const orchestratorModule = await import('../../../server/services/ProviderOrchestrator.js');
    const predictionRouter = predictionRouterModule.default || predictionRouterModule;
    request = supertestModule.default || supertestModule;
    orchestrator = orchestratorModule.default || orchestratorModule;

    app = express();
    app.use(express.json());
    app.use('/api/prediction', predictionRouter);
  });

  describe('POST /api/prediction/calculate', () => {
    const validPayload = {
      weatherData: {
        cloudCover: 45,
        humidity: 55,
        visibility: 14,
        lowCloudCover: 20,
        highClouds: 25,
        midClouds: 45,
        lowClouds: 15
      },
      date: '2024-06-21T18:00:00Z',
      lat: 39.9042,
      lon: 116.4074,
      type: 'sunset'
    };

    test('returns prediction payload for valid request', async () => {
      const res = await request(app)
        .post('/api/prediction/calculate')
        .send(validPayload)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('score');
      expect(res.body.data).toHaveProperty('quality');
      expect(res.body.data).toHaveProperty('type', 'sunset');
      expect(typeof res.body.data.score).toBe('number');
    });

    test('rejects invalid coordinates with 400', async () => {
      const res = await request(app)
        .post('/api/prediction/calculate')
        .send({ ...validPayload, lat: 123 })
        .expect(400);

      expect(res.body.error).toHaveProperty('code', 'INVALID_LATITUDE');
    });
  });

  describe('POST /api/prediction/surrounding', () => {
    test('rejects invalid radius with 400', async () => {
      const res = await request(app)
        .post('/api/prediction/surrounding')
        .send({ lat: 39.9, lon: 116.4, radius: 75, type: 'sunset' })
        .expect(400);

      expect(res.body.error).toHaveProperty('code', 'INVALID_RADIUS');
    });

    test('rejects invalid type with 400', async () => {
      const res = await request(app)
        .post('/api/prediction/surrounding')
        .send({ lat: 39.9, lon: 116.4, radius: 100, type: 'midnight' })
        .expect(400);

      expect(res.body.error).toHaveProperty('code', 'INVALID_TYPE');
    });
  });

  describe('POST /api/prediction/enhanced', () => {
    const validEnhancedPayload = {
      weatherData: {
        lowClouds: 20,
        midClouds: 55,
        highClouds: 30,
        visibility: 16,
        humidity: 50,
        aqi: 45
      },
      date: '2024-06-21T18:00:00Z',
      lat: 39.9,
      lon: 116.4,
      type: 'sunset'
    };

    test('returns enhanced prediction for valid request', async () => {
      const res = await request(app)
        .post('/api/prediction/enhanced')
        .send(validEnhancedPayload)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('score');
      expect(res.body.data).toHaveProperty('quality');
      expect(res.body.data).toHaveProperty('status');
      expect(res.body.data).toHaveProperty('icon');
    });

    test('rejects malformed weatherData with 400', async () => {
      const res = await request(app)
        .post('/api/prediction/enhanced')
        .send({ ...validEnhancedPayload, weatherData: null })
        .expect(400);

      expect(res.body.error).toHaveProperty('code', 'INVALID_WEATHER_DATA');
    });

    test('uses fast closed-loop weather window when requested', async () => {
      const fetchSpy = jest.spyOn(orchestrator, 'fetchWeatherData').mockResolvedValue({
        data: [{
          timestamp: new Date('2024-06-21T10:00:00Z').getTime(),
          cloudCover: 45,
          humidity: 55,
          visibility: 14,
          lowClouds: 20,
          midClouds: 45,
          highClouds: 25,
          temp: 21,
          windSpeed: 3,
          windDirection: 180,
          pressure: 1010,
          precipitation: 0,
          shortwaveRadiation: 300
        }],
        providerMeta: { name: 'openmeteo' }
      });

      const res = await request(app)
        .post('/api/prediction/enhanced')
        .send({
          date: '2024-06-21',
          referenceTime: '2024-06-21T10:00:00Z',
          lat: 39.9,
          lon: 116.4,
          type: 'sunset',
          options: {
            fast: true,
            includeRemoteCloudData: false,
            forecastHours: 48
          }
        })
        .expect(200);

      expect(fetchSpy).toHaveBeenCalledWith(39.9, 116.4, 48, undefined, {
        includeAirQuality: false,
        maxRetries: 1,
        timeoutMs: 5000
      });
      expect(res.body.data.weatherDataSource).toBe('backend_closed_loop_fast');
      expect(res.body.data.weatherData).toEqual(expect.objectContaining({
        temp: 21,
        humidity: 55,
        visibility: 14,
        windSpeed: 3,
        windDirection: 180,
        pressure: 1010,
        precipitation: 0
      }));
      expect(res.body.data.diagnostics.timings).toEqual(expect.objectContaining({
        referenceMs: expect.any(Number),
        weatherFetchMs: expect.any(Number),
        remoteCloudMs: 0,
        calculateMs: expect.any(Number),
        totalMs: expect.any(Number)
      }));
    });
  });

  describe('POST /api/prediction/enhanced/batch', () => {
    test('returns batch result with count for valid request', async () => {
      const res = await request(app)
        .post('/api/prediction/enhanced/batch')
        .send({
          weatherDataArray: [
            {
              weather: { lowClouds: 20, midClouds: 40, highClouds: 50, humidity: 60, visibility: 12 },
              date: '2024-06-21T18:00:00Z',
              rainedRecently: false
            },
            {
              weather: { lowClouds: 25, midClouds: 45, highClouds: 30, humidity: 52, visibility: 15 },
              date: '2024-06-22T18:00:00Z',
              rainedRecently: true
            }
          ],
          lat: 39.9,
          lon: 116.4,
          type: 'sunset'
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(2);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(2);
    });

    test('rejects empty weatherDataArray with 400', async () => {
      const res = await request(app)
        .post('/api/prediction/enhanced/batch')
        .send({
          weatherDataArray: [],
          lat: 39.9,
          lon: 116.4,
          type: 'sunset'
        })
        .expect(400);

      expect(res.body.error).toHaveProperty('code', 'INVALID_WEATHER_DATA_ARRAY');
    });
  });

  describe('POST /api/prediction/enhanced/closed-loop/batch', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('rejects empty items with 400', async () => {
      const res = await request(app)
        .post('/api/prediction/enhanced/closed-loop/batch')
        .send({ items: [], lat: 39.9, lon: 116.4 })
        .expect(400);

      expect(res.body.error).toHaveProperty('code', 'INVALID_ITEMS');
    });

    test('rejects invalid item type with 400', async () => {
      const res = await request(app)
        .post('/api/prediction/enhanced/closed-loop/batch')
        .send({
          items: [{ date: '2024-06-21T18:00:00Z', type: 'midnight' }],
          lat: 39.9,
          lon: 116.4
        })
        .expect(400);

      expect(res.body.error).toHaveProperty('code', 'INVALID_TYPE');
    });

    test('derives local sunset reference time for date-only batch items', async () => {
      jest.spyOn(orchestrator, 'fetchWeatherData').mockResolvedValue({
        data: [
          {
            timestamp: new Date('2026-05-17T00:00:00Z').getTime(),
            cloudCover: 10,
            humidity: 40,
            visibility: 20,
            lowClouds: 5,
            midClouds: 5,
            highClouds: 5,
            precipitation: 0
          },
          {
            timestamp: new Date('2026-05-17T11:23:00Z').getTime(),
            cloudCover: 90,
            humidity: 95,
            visibility: 4,
            lowClouds: 85,
            midClouds: 90,
            highClouds: 95,
            precipitation: 12
          }
        ],
        providerMeta: { name: 'openmeteo', timezone: 'Asia/Shanghai' }
      });

      const res = await request(app)
        .post('/api/prediction/enhanced/closed-loop/batch')
        .send({
          lat: 39.9042,
          lon: 116.4074,
          options: { includeRemoteCloudData: false },
          items: [{ id: 'beijing-sunset', date: '2026-05-17', type: 'sunset' }]
        })
        .expect(200);

      expect(res.body.data[0].referenceTime).toBe('2026-05-17T11:23:00.000Z');
      expect(res.body.data[0].weatherData.precipitation).toBe(12);
    });
  });

  describe('GET /api/prediction/home', () => {
    afterEach(() => {
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    test('returns one authoritative weather and prediction payload for the home surface', async () => {
      const fetchSpy = jest.spyOn(orchestrator, 'fetchWeatherData').mockResolvedValue({
        data: [
          {
            timestamp: new Date('2026-05-17T00:00:00Z').getTime(),
            cloudCover: 20,
            humidity: 45,
            visibility: 18,
            lowClouds: 10,
            midClouds: 20,
            highClouds: 30,
            temp: 18,
            windSpeed: 6,
            windDirection: 135,
            pressure: 1008,
            precipitation: 0,
            shortwaveRadiation: 200
          },
          {
            timestamp: new Date('2026-05-17T11:23:00Z').getTime(),
            cloudCover: 55,
            humidity: 58,
            visibility: 16,
            lowClouds: 12,
            midClouds: 45,
            highClouds: 60,
            temp: 24,
            windSpeed: 8,
            windDirection: 150,
            pressure: 1005,
            precipitation: 0,
            shortwaveRadiation: 180
          }
        ],
        providerMeta: { name: 'openmeteo', timezone: 'Asia/Shanghai' }
      });

      const res = await request(app)
        .get('/api/prediction/home')
        .query({
          lat: 39.91,
          lon: 116.41,
          date: '2026-05-17',
          period: 'sunset',
          days: 1,
          includeRemoteCloudData: 'false'
        })
        .expect(200);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(39.91, 116.41, 168, undefined, {});
      expect(res.body.success).toBe(true);
      expect(res.body.data.weather.hourly).toHaveLength(2);
      expect(res.body.data.predictions.current).toHaveProperty('type', 'sunset');
      expect(res.body.data.predictions.sunrise).toHaveProperty('score');
      expect(res.body.data.predictions.sunset).toHaveProperty('score');
      expect(res.body.data.predictions.byDate).toHaveLength(1);
      expect(res.body.data.request).toEqual(expect.objectContaining({
        date: '2026-05-17',
        period: 'sunset',
        days: 1,
        includeRemoteCloudData: false
      }));
    });

    test('rolls stale current-day sunrise requests to the next event day', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-05-30T13:52:00Z'));
      jest.spyOn(orchestrator, 'fetchWeatherData').mockResolvedValue({
        data: [
          {
            timestamp: new Date('2026-05-30T21:48:00Z').getTime(),
            cloudCover: 80,
            humidity: 50,
            visibility: 20,
            lowClouds: 0,
            midClouds: 20,
            highClouds: 100,
            temp: 18,
            windSpeed: 3,
            windDirection: 90,
            pressure: 1008,
            precipitation: 0,
            shortwaveRadiation: 0
          }
        ],
        providerMeta: { name: 'openmeteo', timezone: 'Asia/Shanghai' }
      });

      const res = await request(app)
        .get('/api/prediction/home')
        .query({
          lat: 39.9042,
          lon: 116.4074,
          date: '2026-05-30',
          period: 'sunrise',
          days: 1,
          includeRemoteCloudData: 'false'
        })
        .expect(200);

      expect(res.body.data.request.date).toBe('2026-05-31');
      expect(res.body.data.predictions.current.dateKey).toBe('2026-05-31');
      expect(res.body.data.predictions.current.type).toBe('sunrise');
      expect(res.body.data.predictions.current.referenceTime).toMatch(/^2026-05-30T20:/);
    });

    test('does not roll requests that are not today in the target local date', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-05-30T23:30:00Z'));
      jest.spyOn(orchestrator, 'fetchWeatherData').mockResolvedValue({
        data: [
          {
            timestamp: new Date('2026-05-31T04:50:00Z').getTime(),
            cloudCover: 60,
            humidity: 45,
            visibility: 18,
            lowClouds: 5,
            midClouds: 20,
            highClouds: 75,
            temp: 16,
            windSpeed: 3,
            windDirection: 90,
            pressure: 1010,
            precipitation: 0,
            shortwaveRadiation: 0
          }
        ],
        providerMeta: { name: 'openmeteo', timezone: 'America/Los_Angeles' }
      });

      const res = await request(app)
        .get('/api/prediction/home')
        .query({
          lat: 37.7749,
          lon: -122.4194,
          date: '2026-05-31',
          period: 'sunrise',
          days: 1,
          includeRemoteCloudData: 'false'
        })
        .expect(200);

      expect(res.body.data.request.date).toBe('2026-05-31');
      expect(res.body.data.predictions.current.dateKey).toBe('2026-05-31');
    });
  });
});
