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

  beforeAll(async () => {
    const predictionRouterModule = await import('../../../server/routes/prediction.js');
    const supertestModule = await import('supertest');
    const predictionRouter = predictionRouterModule.default || predictionRouterModule;
    request = supertestModule.default || supertestModule;

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

      expect(res.body.error).toBe('INVALID_LATITUDE');
    });
  });

  describe('POST /api/prediction/surrounding', () => {
    test('rejects invalid radius with 400', async () => {
      const res = await request(app)
        .post('/api/prediction/surrounding')
        .send({ lat: 39.9, lon: 116.4, radius: 75, type: 'sunset' })
        .expect(400);

      expect(res.body.error).toBe('INVALID_RADIUS');
    });

    test('rejects invalid type with 400', async () => {
      const res = await request(app)
        .post('/api/prediction/surrounding')
        .send({ lat: 39.9, lon: 116.4, radius: 100, type: 'midnight' })
        .expect(400);

      expect(res.body.error).toBe('INVALID_TYPE');
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

    test('rejects missing weatherData with 400', async () => {
      const { weatherData, ...invalidPayload } = validEnhancedPayload;
      const res = await request(app)
        .post('/api/prediction/enhanced')
        .send(invalidPayload)
        .expect(400);

      expect(res.body.error).toBe('INVALID_WEATHER_DATA');
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

      expect(res.body.error).toBe('INVALID_WEATHER_DATA_ARRAY');
    });
  });
});
