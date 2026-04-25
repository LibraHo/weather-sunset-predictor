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

describe('45.5 GET /api/agent/forecast', () => {
  let app;
  let request;
  let orchestrator;
  let geocoderModule;
  let originalFetch;
  let originalGeocode;

  const resolvedBeijing = {
    name: '北京',
    lat: 39.9042,
    lon: 116.4074,
    provider: 'mock'
  };

  const defaultDate = new Date();
  const weatherHourly = [
    { timestamp: defaultDate.getTime(), temp: 25, cloudCover: 55, humidity: 62, visibility: 16, lowClouds: 20, midClouds: 35, highClouds: 60 },
    { timestamp: defaultDate.getTime() + 3600 * 1000, temp: 24, cloudCover: 52, humidity: 60, visibility: 18, lowClouds: 20, midClouds: 32, highClouds: 58 },
    { timestamp: defaultDate.getTime() + 7200 * 1000, temp: 23, cloudCover: 48, humidity: 58, visibility: 20, lowClouds: 18, midClouds: 30, highClouds: 55 }
  ];

  const defaultWeatherResponse = {
    hours: 24,
    data: weatherHourly,
    providerMeta: {
      name: 'openmeteo',
      usedFallback: false,
      degradedReason: []
    }
  };

  beforeAll(async () => {
    const supertestModule = await import('supertest');
    const agentRouterModule = await import('../../../server/routes/agent-forecast.js');
    const orchestratorModule = await import('../../../server/services/ProviderOrchestrator.js');
    const geocoder = await import('../../../server/services/BackendGeocodingService.js');

    request = supertestModule.default || supertestModule;
    const agentRouter = agentRouterModule.default || agentRouterModule;
    orchestrator = orchestratorModule.default || orchestratorModule;
    geocoderModule = geocoder.default || geocoder;

    originalFetch = orchestrator.fetchWeatherData;
    originalGeocode = geocoderModule.prototype.geocode;

    app = express();
    app.use(cors({ origin: 'http://localhost:9002' }));
    app.use(express.json());
    app.use('/api/agent', agentRouter);
    app.use((err, req, res, next) => {
      res.status(err.status || 500).json({
        error: {
          code: err.code || 'INTERNAL_SERVER_ERROR',
          message: err.message || '服务器内部错误'
        }
      });
    });
  });

  beforeEach(() => {
    orchestrator.fetchWeatherData = async () => defaultWeatherResponse;
    geocoderModule.prototype.geocode = async () => resolvedBeijing;
  });

  afterEach(() => {
    orchestrator.fetchWeatherData = originalFetch;
    geocoderModule.prototype.geocode = originalGeocode;
  });

  test('location=北京 + sunset 成功', async () => {
    const res = await request(app)
      .get('/api/agent/forecast')
      .query({
        location: '北京',
        type: 'sunset',
        detail: 'full'
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.location).toMatchObject({
      name: '北京',
      lat: resolvedBeijing.lat,
      lon: resolvedBeijing.lon
    });
    expect(res.body.data.bestViewingWindow).toBeDefined();
    expect(res.body.data.score).toBeGreaterThanOrEqual(0);
    expect(res.body.data.quality).toBeDefined();
  });

  test('lat/lon + sunrise 成功', async () => {
    const res = await request(app)
      .get('/api/agent/forecast')
      .query({
        lat: '39.9042',
        lon: '116.4074',
        type: 'sunrise',
        detail: 'full'
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.location.lat).toBeCloseTo(39.9042);
    expect(res.body.data.location.lon).toBeCloseTo(116.4074);
    expect(res.body.data.bestViewingWindow.start).toBeDefined();
    expect(res.body.data.bestViewingWindow.end).toBeDefined();
  });

  test('simple 与 full 返回差异', async () => {
    const simple = await request(app)
      .get('/api/agent/forecast')
      .query({
        lat: '39.9042',
        lon: '116.4074',
        type: 'sunset',
        detail: 'simple'
      })
      .expect(200);

    const full = await request(app)
      .get('/api/agent/forecast')
      .query({
        lat: '39.9042',
        lon: '116.4074',
        type: 'sunset',
        detail: 'full'
      })
      .expect(200);

    expect(typeof simple.body.data.explanation).toBe('object');
    expect(simple.body.data.explanation).not.toHaveProperty('timeAnalysis');
    expect(full.body.data.explanation).toHaveProperty('timeAnalysis');
    expect(full.body.data.factors).toHaveProperty('lightPathAnalysis');
    expect(simple.body.data.factors).not.toHaveProperty('lightPathAnalysis');
  });

  test('无 location 且无 lat/lon 返回 400', async () => {
    const res = await request(app)
      .get('/api/agent/forecast')
      .query({ type: 'sunset' })
      .expect(400);

    expect(res.body.error.code).toBe('INVALID_PARAMS');
  });

  test('type 非法返回 400', async () => {
    const res = await request(app)
      .get('/api/agent/forecast')
      .query({ lat: '39.9', lon: '116.4', type: 'invalid' })
      .expect(400);

    expect(res.body.error.code).toBe('INVALID_TYPE');
  });

  test('date 非法返回 400', async () => {
    const res = await request(app)
      .get('/api/agent/forecast')
      .query({ lat: '39.9', lon: '116.4', type: 'sunset', date: 'abc' })
      .expect(400);

    expect(res.body.error.code).toBe('INVALID_DATE');
  });

  test('上游天气失败返回稳定错误结构', async () => {
    orchestrator.fetchWeatherData = async () => {
      const err = new Error('weather upstream unavailable');
      err.code = 'UPSTREAM_TIMEOUT';
      throw err;
    };

    const res = await request(app)
      .get('/api/agent/forecast')
      .query({ lat: '39.9', lon: '116.4', type: 'sunset' })
      .expect(503);

    expect(res.body).toHaveProperty('error');
    expect(res.body.error.code).toBe('WEATHER_FORECAST_ERROR');
    expect(res.body.error).toHaveProperty('details');
    expect(res.body.error.message).toBe('weather upstream unavailable');
  });

  test('返回字段 schema 稳定且关键字段存在', async () => {
    const res = await request(app)
      .get('/api/agent/forecast')
      .query({
        lat: '39.9042',
        lon: '116.4074',
        type: 'sunset',
        detail: 'full'
      })
      .expect(200);

    const data = res.body.data;
    expect(data).toMatchObject({
      location: expect.any(Object),
      score: expect.any(Number),
      quality: expect.any(String),
      bestViewingWindow: expect.any(Object),
      factors: expect.any(Object),
      summary: expect.any(Object),
      explanation: expect.any(Object),
      warnings: expect.any(Array),
      meta: expect.any(Object)
    });

    expect(data.bestViewingWindow).toHaveProperty('start');
    expect(data.bestViewingWindow).toHaveProperty('end');
    expect(data.bestViewingWindow).toHaveProperty('type');
    expect(data.summary).toHaveProperty('status');
    expect(data.meta).toHaveProperty('forecastDate');
  });
});
