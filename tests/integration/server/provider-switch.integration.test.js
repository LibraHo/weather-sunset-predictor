import express from 'express';
import cors from 'cors';
import { TextEncoder, TextDecoder } from 'node:util';

if (!global.TextEncoder) global.TextEncoder = TextEncoder;
if (!global.TextDecoder) global.TextDecoder = TextDecoder;
if (!global.setImmediate) global.setImmediate = (fn, ...args) => setTimeout(fn, 0, ...args);

describe('45.2 /api/weather/forecast provider switch consistency', () => {
  let app;
  let request;
  let orchestrator;
  let originalFetch;

  beforeAll(async () => {
    process.env.CORS_ORIGIN = 'http://localhost:9002';

    const supertestModule = await import('supertest');
    const weatherRouterModule = await import('../../../server/routes/weather.js');
    const orchestratorModule = await import('../../../server/services/ProviderOrchestrator.js');

    request = supertestModule.default || supertestModule;
    const weatherRouter = weatherRouterModule.default || weatherRouterModule;
    orchestrator = orchestratorModule.default || orchestratorModule;
    originalFetch = orchestrator.fetchWeatherData;

    app = express();
    app.use(cors({ origin: process.env.CORS_ORIGIN }));
    app.use(express.json());
    app.use('/api/weather', weatherRouter);
    app.use((err, req, res, next) => {
      res.status(err.status || 500).json({
        error: { code: err.code || 'INTERNAL_SERVER_ERROR', message: err.message || '服务器内部错误' }
      });
    });
  });

  afterAll(() => {
    if (orchestrator && originalFetch) orchestrator.fetchWeatherData = originalFetch;
  });

  test('primary=openmeteo response shape is stable', async () => {
    orchestrator.fetchWeatherData = async () => ({
      hours: 24,
      data: [{ timestamp: 1700000000000, temp: 20 }],
      providerMeta: {
        name: 'openmeteo',
        dataQuality: 'excellent',
        usedFallback: false,
        degradedReason: []
      }
    });

    const res = await request(app)
      .get('/api/weather/forecast?lat=39.9&lon=116.4&hours=24')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.providerMeta.name).toBe('openmeteo');
    expect(res.body.providerMeta.usedFallback).toBe(false);
  });

  test('fallback=windy response shape remains consistent', async () => {
    orchestrator.fetchWeatherData = async () => ({
      hours: 24,
      data: [{ timestamp: 1700000000000, temp: 21 }],
      providerMeta: {
        name: 'windy',
        dataQuality: 'degraded',
        usedFallback: true,
        fallbackReason: 'quality_gate_failure',
        degradedReason: ['Primary Provider (openmeteo) failed: quality gate']
      }
    });

    const res = await request(app)
      .get('/api/weather/forecast?lat=39.9&lon=116.4&hours=24')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.providerMeta.name).toBe('windy');
    expect(res.body.providerMeta.usedFallback).toBe(true);
    expect(res.body.providerMeta.fallbackReason).toBe('quality_gate_failure');
  });
});
