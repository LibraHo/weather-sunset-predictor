import express from 'express';
import cors from 'cors';
import { TextEncoder, TextDecoder } from 'node:util';

if (!global.TextEncoder) {
  global.TextEncoder = TextEncoder;
}

if (!global.TextDecoder) {
  global.TextDecoder = TextDecoder;
}

if (!global.setImmediate) {
  global.setImmediate = (fn, ...args) => setTimeout(fn, 0, ...args);
}

describe('Weather API Integration', () => {
  let app;
  let request;
  let windyService;
  let originalFetchWeatherData;

  beforeAll(async () => {
    process.env.CORS_ORIGIN = 'http://localhost:9002';
    process.env.WINDY_MAP_API_KEY = 'wk_test_map_key';

    const supertestModule = await import('supertest');
    const weatherRouterModule = await import('../../../server/routes/weather.js');
    const windyServiceModule = await import('../../../server/services/ProviderOrchestrator.js');

    request = supertestModule.default || supertestModule;
    const weatherRouter = weatherRouterModule.default || weatherRouterModule;
    windyService = windyServiceModule.default || windyServiceModule;
    originalFetchWeatherData = windyService.fetchWeatherData;

    app = express();
    app.use(cors({ origin: process.env.CORS_ORIGIN }));
    app.use(express.json());

    app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    app.get('/api/config/map-key', (req, res) => {
      const mapKey = process.env.WINDY_MAP_API_KEY;
      if (!mapKey || mapKey === 'your_map_api_key_here') {
        return res.status(500).json({
          error: {
            code: 'MAP_KEY_NOT_CONFIGURED',
            message: '地图API密钥未配置'
          }
        });
      }
      return res.json({ mapKey });
    });

    app.use('/api/weather', weatherRouter);

    app.use((err, req, res, next) => {
      res.status(err.status || 500).json({
        error: {
          code: err.code || 'INTERNAL_SERVER_ERROR',
          message: err.message || '服务器内部错误'
        }
      });
    });
  });

  afterAll(() => {
    if (windyService && originalFetchWeatherData) {
      windyService.fetchWeatherData = originalFetchWeatherData;
    }
  });

  describe('GET /api/weather/forecast', () => {
    test('returns forecast payload for valid query', async () => {
      windyService.fetchWeatherData = async (lat, lon, hours) => ({
        hours,
        data: [{ timestamp: 1700000000000, temp: 24.5, humidity: 60 }]
      });

      const res = await request(app)
        .get('/api/weather/forecast')
        .query({ lat: '39.9', lon: '116.4', hours: '24' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.location).toEqual({ lat: 39.9, lon: 116.4 });
      expect(res.body.hours).toBe(24);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('returns 400 when lat/lon are missing', async () => {
      const res = await request(app)
        .get('/api/weather/forecast')
        .query({ lat: '39.9' })
        .expect(400);

      expect(res.body.error.code).toBe('INVALID_PARAMS');
    });

    test('propagates service errors through error middleware', async () => {
      windyService.fetchWeatherData = async () => {
        const error = new Error('Windy upstream timeout');
        error.code = 'UPSTREAM_TIMEOUT';
        error.status = 503;
        throw error;
      };

      const res = await request(app)
        .get('/api/weather/forecast')
        .query({ lat: '39.9', lon: '116.4' })
        .expect(503);

      expect(res.body.error.code).toBe('UPSTREAM_TIMEOUT');
      expect(res.body.error.message).toBe('Windy upstream timeout');
    });

    test('returns CORS header for allowed origin', async () => {
      windyService.fetchWeatherData = async () => ({ hours: 168, data: [] });

      const res = await request(app)
        .get('/api/weather/forecast')
        .set('Origin', 'http://localhost:9002')
        .query({ lat: '39.9', lon: '116.4' })
        .expect(200);

      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:9002');
    });
  });

  describe('GET /api/config/map-key', () => {
    test('returns map key when configured', async () => {
      process.env.WINDY_MAP_API_KEY = 'wk_test_map_key';

      const res = await request(app)
        .get('/api/config/map-key')
        .expect(200);

      expect(res.body.mapKey).toBe('wk_test_map_key');
    });

    test('returns 500 when map key is not configured', async () => {
      process.env.WINDY_MAP_API_KEY = 'your_map_api_key_here';

      const res = await request(app)
        .get('/api/config/map-key')
        .expect(500);

      expect(res.body.error.code).toBe('MAP_KEY_NOT_CONFIGURED');
    });
  });

  describe('GET /health', () => {
    test('returns health status and timestamp', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      expect(res.body.status).toBe('ok');
      expect(typeof res.body.timestamp).toBe('string');
    });
  });
});
