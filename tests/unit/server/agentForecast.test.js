import { jest } from '@jest/globals';
import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { TextEncoder, TextDecoder } from 'node:util';

const require = createRequire(import.meta.url);
let request;

beforeAll(async () => {
  if (!global.TextEncoder) global.TextEncoder = TextEncoder;
  if (!global.TextDecoder) global.TextDecoder = TextDecoder;
  const supertest = await import('supertest');
  request = supertest.default || supertest;
});

function mockWeather() {
  const base = new Date('2026-04-25T00:00:00.000Z').getTime();
  return Array.from({ length: 24 }, (_, hour) => ({
    timestamp: base + hour * 60 * 60 * 1000,
    cloudCover: 58,
    lowClouds: 8,
    midClouds: 30,
    highClouds: 72,
    humidity: 48,
    visibility: 18,
    precipitation: 0,
    aerosolOpticalDepth: 0.22,
    pm2_5: 12,
    pm10: 24,
    aqi: 42
  }));
}

describe('Agent Forecast API', () => {
  let app;
  let token;
  let orchestrator;
  let EnhancedPredictionService;
  let tmpDir;

  beforeEach(() => {
    jest.resetModules();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xiake-agent-forecast-'));
    process.env.NODE_ENV = 'test';
    process.env.SERVER_TOKEN_SECRET = 'forecast-test-secret';
    process.env.API_TOKEN_STORAGE_PATH = path.join(tmpDir, 'api-tokens.json');

    const ApiTokenService = require('../../../server/services/ApiTokenService');
    const tokenService = new ApiTokenService({
      tokenFile: process.env.API_TOKEN_STORAGE_PATH,
      secret: process.env.SERVER_TOKEN_SECRET
    });
    token = tokenService.createToken({ name: 'forecast-test', scopes: ['forecast:read'], minuteLimit: 100, dailyLimit: 1000 }).token;

    orchestrator = require('../../../server/services/ProviderOrchestrator');
    EnhancedPredictionService = require('../../../server/services/EnhancedPredictionService');
    orchestrator.fetchWeatherData = jest.fn().mockResolvedValue({ data: mockWeather() });
    EnhancedPredictionService.calculateEnhancedPrediction = jest.fn(() => ({
      date: '2026-04-25T00:00:00.000Z',
      type: 'sunset',
      score: 78.4,
      quality: 'excellent',
      status: 'good',
      description: 'good_conditions',
      geometricModel: { feasible: true, durationMin: 32 },
      cloudType: { type: 'cirrus', label: '卷云' },
      cloudThickness: { thickness: 'thin', modifier: 1, reasons: [] },
      scoreBeforeOcclusion: 79
    }));

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{
          name: '北京',
          country: '中国',
          country_code: 'CN',
          admin1: '北京',
          latitude: 39.9042,
          longitude: 116.4074
        }]
      })
    });

    const agentRoutes = require('../../../server/routes/agent');
    app = express();
    app.use(express.json());
    app.use('/api/agent', agentRoutes);
  });

  afterEach(() => {
    delete process.env.API_TOKEN_STORAGE_PATH;
    delete process.env.SERVER_TOKEN_SECRET;
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('location=北京 + sunset 成功返回 simple 结构', async () => {
    const res = await request(app)
      .get('/api/agent/forecast')
      .set('Authorization', `Bearer ${token}`)
      .query({ location: '北京', type: 'sunset', date: 'today', detail: 'simple' })
      .expect(200);

    expect(global.fetch).toHaveBeenCalled();
    expect(orchestrator.fetchWeatherData).toHaveBeenCalledWith(39.9042, 116.4074, 168);
    expect(res.body.success).toBe(true);
    expect(res.body.data.location.name).toBe('北京');
    expect(res.body.data.score).toBe(78);
    expect(res.body.data.quality).toBe('excellent');
    expect(res.body.data.bestViewingWindow).toEqual(expect.objectContaining({ start: expect.any(String), end: expect.any(String) }));
    expect(res.body.data.summary).toContain('晚霞');
    expect(res.body.data.meta.detail).toBe('simple');
    expect(res.body.data.factors).toBeUndefined();
  });

  test('lat/lon + sunrise 成功返回 full 结构', async () => {
    const res = await request(app)
      .get('/api/agent/forecast')
      .set('Authorization', `Bearer ${token}`)
      .query({ lat: '39.9042', lon: '116.4074', type: 'sunrise', date: '2026-04-25', detail: 'full' })
      .expect(200);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(EnhancedPredictionService.calculateEnhancedPrediction).toHaveBeenCalledWith(
      expect.objectContaining({ cloudCover: 58, aerosolOpticalDepth: 0.22 }),
      expect.any(Date),
      39.9042,
      116.4074,
      'sunrise'
    );
    expect(res.body.data.factors).toEqual(expect.objectContaining({ cloudCover: 58, aerosolOpticalDepth: 0.22, pm2_5: 12 }));
    expect(res.body.data.explanation).toEqual(expect.objectContaining({ status: 'good', description: 'good_conditions' }));
  });

  test('无 location 且无 lat/lon 返回 400', async () => {
    const res = await request(app)
      .get('/api/agent/forecast')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
    expect(res.body.error.code).toBe('MISSING_LOCATION');
  });

  test('type 非法返回 400', async () => {
    const res = await request(app)
      .get('/api/agent/forecast')
      .set('Authorization', `Bearer ${token}`)
      .query({ lat: 1, lon: 2, type: 'noon' })
      .expect(400);
    expect(res.body.error.code).toBe('INVALID_TYPE');
  });

  test('date 非法返回 400', async () => {
    const res = await request(app)
      .get('/api/agent/forecast')
      .set('Authorization', `Bearer ${token}`)
      .query({ lat: 1, lon: 2, date: '25/04/2026' })
      .expect(400);
    expect(res.body.error.code).toBe('INVALID_DATE');
  });

  test('上游天气失败返回稳定错误结构', async () => {
    orchestrator.fetchWeatherData.mockRejectedValue(new Error('upstream down'));
    const res = await request(app)
      .get('/api/agent/forecast')
      .set('Authorization', `Bearer ${token}`)
      .query({ lat: 39.9042, lon: 116.4074, type: 'sunset' })
      .expect(500);
    expect(res.body).toEqual({
      success: false,
      error: { code: 'AGENT_FORECAST_ERROR', message: 'upstream down' }
    });
  });
});
