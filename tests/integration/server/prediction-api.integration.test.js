import express from 'express';
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
  let originalFetchWeatherData;

  const mockWeatherResponse = {
    provider: 'mock',
    providerMeta: { name: 'mock', cloudSource: 'mock_hourly', airQualitySource: 'mock_air' },
    data: Array.from({ length: 12 }, (_, idx) => ({
      timestamp: new Date(`2024-06-21T${String(12 + idx).padStart(2, '0')}:00:00Z`).getTime(),
      cloudCover: 55,
      lowClouds: idx % 3 === 0 ? 18 : 22,
      midClouds: 35,
      highClouds: 45,
      humidity: 58,
      visibility: 16,
      precipitation: idx < 3 ? 0.1 : 0,
      shortwaveRadiation: 320,
      directRadiation: 170,
      diffuseRadiation: 80,
      waterVapourColumn: 3.2,
      aerosolOpticalDepth: 0.18,
      pm2_5: 18,
      pm10: 35,
      dust: 10,
      aqi: 45
    }))
  };

  beforeAll(async () => {
    const predictionRouterModule = await import('../../../server/routes/prediction.js');
    const supertestModule = await import('supertest');
    const orchestratorModule = await import('../../../server/services/ProviderOrchestrator.js');
    const predictionRouter = predictionRouterModule.default || predictionRouterModule;
    orchestrator = orchestratorModule.default || orchestratorModule;
    originalFetchWeatherData = orchestrator.fetchWeatherData;
    request = supertestModule.default || supertestModule;

    app = express();
    app.use(express.json());
    app.use('/api/prediction', predictionRouter);
  });

  beforeEach(() => {
    orchestrator.fetchWeatherData = async () => mockWeatherResponse;
  });

  afterEach(() => {
    orchestrator.fetchWeatherData = originalFetchWeatherData;
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

    test('runs closed-loop prediction without frontend weatherData', async () => {
      const { weatherData, ...invalidPayload } = validEnhancedPayload;
      const res = await request(app)
        .post('/api/prediction/enhanced')
        .send(invalidPayload)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('weatherDataSource', 'backend_closed_loop');
      expect(res.body.data).toHaveProperty('remoteCloudData');
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
});
