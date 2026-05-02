/**
 * 需求45 PR D: Agent Explain / Geocode / OpenAPI / 用量统计
 */
import { jest } from '@jest/globals';
import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { TextEncoder, TextDecoder } from 'node:util';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
let request;

if (!global.TextEncoder) global.TextEncoder = TextEncoder;
if (!global.TextDecoder) global.TextDecoder = TextDecoder;

beforeAll(async () => {
  const supertest = await import('supertest');
  request = supertest.default || supertest;
});

function createAdminHeader(password = process.env.ADMIN_PASSWORD || 'xiake2024') {
  return `Basic ${Buffer.from(`admin:${password}`).toString('base64')}`;
}

function mockWeather() {
  const base = new Date('2026-04-25T00:00:00.000Z').getTime();
  return [
    {
      timestamp: base,
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
    }
  ];
}

describe('Agent API 扩展接口', () => {
  let app;
  let adminApp;
  let token; // forecast scope
  let geocodeToken;
  let adminToken;
  let tmpDir;
  let ApiTokenService;
  let orchestrator;
  let EnhancedPredictionService;
  let gridScoreService;

  beforeEach(() => {
    jest.resetModules();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xiake-agent-prd-'));

    process.env.NODE_ENV = 'test';
    process.env.SERVER_TOKEN_SECRET = 'agent-extended-secret';
    process.env.XIAKE_DATA_DIR = tmpDir;
    process.env.API_TOKEN_STORAGE_PATH = path.join(tmpDir, 'api-tokens.json');
    process.env.API_AGENT_AUDIT_LOG_PATH = path.join(tmpDir, 'agent-audit-logs.json');
    process.env.ADMIN_PASSWORD = 'xiake2024';

    ApiTokenService = require('../../../server/services/ApiTokenService');
    const tokenService = new ApiTokenService({
      tokenFile: process.env.API_TOKEN_STORAGE_PATH,
      secret: process.env.SERVER_TOKEN_SECRET
    });

    token = tokenService.createToken({
      name: 'explain-token',
      scopes: ['forecast:read'],
      minuteLimit: 100,
      dailyLimit: 1000
    }).token;

    geocodeToken = tokenService.createToken({
      name: 'geocode-token',
      scopes: ['geocode:read'],
      minuteLimit: 100,
      dailyLimit: 1000
    }).token;

    const mapToken = tokenService.createToken({
      name: 'map-token',
      scopes: ['map:read'],
      minuteLimit: 100,
      dailyLimit: 1000
    }).token;

    tokenService.createToken({
      name: 'unused-token',
      scopes: ['forecast:read'],
      minuteLimit: 100,
      dailyLimit: 1000
    });

    global.__agentMapToken = mapToken;

    adminToken = geocodeToken;

    orchestrator = require('../../../server/services/ProviderOrchestrator');
    EnhancedPredictionService = require('../../../server/services/EnhancedPredictionService');
    gridScoreService = require('../../../server/services/GridScoreService');
    orchestrator.fetchWeatherData = jest.fn().mockResolvedValue({ data: mockWeather() });
    EnhancedPredictionService.calculateEnhancedPrediction = jest.fn(() => ({
      date: '2026-04-25T00:00:00.000Z',
      type: 'sunset',
      score: 77.2,
      quality: 'good',
      status: 'good',
      description: 'good_conditions',
      geometricModel: { feasible: true, durationMin: 26 },
      cloudType: { type: 'altocumulus', label: '高层云' },
      cloudThickness: { thickness: 'normal', modifier: 1.0, reasons: ['clouds are suitable'] },
      scoreBeforeOcclusion: 82.1,
      breakdown: { baseScore: 52, canvasScore: 20, lightPathScore: 24, renderingFactor: 1, unclampedFinalScore: 77.2 }
    }));
    gridScoreService.getCache = jest.fn((period) => ({
      period,
      updatedAt: '2026-04-25T08:00:00.000Z',
      gridPoints: [
        { lat: 39.9, lon: 116.4, score: 88.2 },
        { lat: 31.2, lon: 121.5, score: 62.6 },
        { lat: 22.5, lon: 114.1, score: 35.4 },
        { lat: 43.8, lon: 87.6, score: 72.1 }
      ]
    }));

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            name: '北京',
            country: '中国',
            country_code: 'CN',
            admin1: '北京',
            latitude: 39.9042,
            longitude: 116.4074,
            population: 2154,
            type: 'PPLC'
          }
        ]
      })
    });

    const agentRoutes = require('../../../server/routes/agent');
    const apiLogsRoutes = require('../../../server/routes/api-logs');

    const buildAdminAuth = (req, res, next) => {
      const header = req.get('Authorization') || '';
      const match = /^Basic\s+(.+)$/i.exec(header);
      if (!match) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: '认证失败' } });
      }
      const decoded = Buffer.from(match[1], 'base64').toString('utf8');
      const idx = decoded.indexOf(':');
      const pass = idx >= 0 ? decoded.slice(idx + 1) : '';
      if (pass !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: '认证失败' } });
      }
      return next();
    };

    app = express();
    app.use(express.json());
    app.use('/api/agent', agentRoutes);

    adminApp = express();
    adminApp.use(express.json());
    adminApp.use('/api/agent', agentRoutes);
    adminApp.use('/api/admin', buildAdminAuth, apiLogsRoutes);
  });

  afterEach(() => {
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    delete process.env.XIAKE_DATA_DIR;
    delete process.env.API_TOKEN_STORAGE_PATH;
    delete process.env.API_AGENT_AUDIT_LOG_PATH;
    delete process.env.ADMIN_PASSWORD;
    delete process.env.SERVER_TOKEN_SECRET;
    delete process.env.NODE_ENV;
    delete global.fetch;
    delete global.__agentMapToken;
  });

  test('explain: 兼容 forecast:read，返回 scoreComposition / factorRelations / constraints / narrative', async () => {
    const res = await request(app)
      .get('/api/agent/explain')
      .set('Authorization', `Bearer ${token}`)
      .query({ lat: 39.9042, lon: 116.4074, type: 'sunset', date: 'today' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.scoreComposition).toHaveProperty('estimatedMax');
    expect(Array.isArray(res.body.data.factorRelations)).toBe(true);
    expect(Array.isArray(res.body.data.constraints)).toBe(true);
    expect(res.body.data.explanation).toHaveProperty('narrative');
  });

  test('geocode: q 查询返回标准字段和排序信息', async () => {
    const res = await request(app)
      .get('/api/agent/geocode')
      .set('Authorization', `Bearer ${geocodeToken}`)
      .query({ q: '北京', limit: 5 })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.top).toHaveProperty('name', '北京');
    expect(res.body.data.top).toHaveProperty('provider');
    expect(res.body.data.top).toHaveProperty('countryCode', 'CN');
    expect(res.body.data.top).toHaveProperty('lat');
    expect(typeof res.body.data.top.confidence).toBe('number');
    expect(res.body.data.top).toHaveProperty('rankReason');
  });

  test('openapi.json 可返回并包含 Bearer auth 与 agent 路径', async () => {
    const res = await request(app).get('/api/agent/openapi.json').expect(200);
    expect(res.body).toHaveProperty('paths');
    expect(res.body.paths['/api/agent/explain']).toBeDefined();
    expect(res.body.paths['/api/agent/geocode']).toBeDefined();
    expect(res.body.paths['/api/agent/forecast']).toBeDefined();
    expect(res.body.paths['/api/agent/map-summary']).toBeDefined();
    expect(res.body.components?.securitySchemes).toHaveProperty('bearerAuth');
  });

  test('map-summary: 返回区域摘要和高分点，不暴露完整图层', async () => {
    const res = await request(app)
      .get('/api/agent/map-summary')
      .set('Authorization', `Bearer ${global.__agentMapToken}`)
      .query({ bbox: '110,20,125,42', type: 'sunset', threshold: 60, limit: 2 })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.type).toBe('sunset');
    expect(res.body.data.summary.matchingPoints).toBe(2);
    expect(res.body.data.summary.maxScore).toBe(88.2);
    expect(res.body.data.topPoints).toHaveLength(2);
    expect(res.body.data.topPoints[0]).toMatchObject({ lat: 39.9, lon: 116.4, score: 88.2, quality: 'excellent' });
    expect(res.body.data).not.toHaveProperty('gridPoints');
    expect(res.body.data).not.toHaveProperty('values');
  });

  test('map-summary: 参数错误与权限不足有稳定错误码', async () => {
    const denied = await request(app)
      .get('/api/agent/map-summary')
      .set('Authorization', `Bearer ${geocodeToken}`)
      .query({ bbox: '110,20,125,42' })
      .expect(403);
    expect(denied.body.error.code).toBe('SCOPE_DENIED');

    const badBbox = await request(app)
      .get('/api/agent/map-summary')
      .set('Authorization', `Bearer ${global.__agentMapToken}`)
      .query({ bbox: 'bad' })
      .expect(400);
    expect(badBbox.body.error.code).toBe('INVALID_BBOX');
  });

  test('无 token 访问 explain 返回 401，geocode 权限不足返回 403', async () => {
    const without = await request(app).get('/api/agent/explain').query({ lat: 1, lon: 2, type: 'sunset' }).expect(401);
    expect(without.body.error.code).toBe('UNAUTHORIZED');

    const insufficient = await request(app)
      .get('/api/agent/geocode')
      .set('Authorization', `Bearer ${token}`)
      .query({ q: '北京' })
      .expect(403);
    expect(insufficient.body.error.code).toBe('SCOPE_DENIED');
  });

  test('参数非法返回 400，地名为空', async () => {
    const res = await request(app)
      .get('/api/agent/geocode')
      .set('Authorization', `Bearer ${geocodeToken}`)
      .query({ q: '   ' })
      .expect(400);

    expect(res.body.error.code).toBe('INVALID_PARAMS');
  });

  test('用量统计按 token 汇总今日调用量与错误率及最近调用', async () => {
    const okRes = await request(app)
      .get('/api/agent/forecast')
      .set('Authorization', `Bearer ${token}`)
      .query({ lat: 39.9042, lon: 116.4074, type: 'sunset' })
      .expect(200);
    expect(okRes.status).toBe(200);

    const badRes = await request(app)
      .get('/api/agent/explain')
      .set('Authorization', `Bearer ${token}`)
      .query({ type: 'wrong' })
      .expect(400);
    expect(badRes.status).toBe(400);

    const usageRes = await request(adminApp)
      .get('/api/admin/agent-usage')
      .set('Authorization', createAdminHeader())
      .expect(200);

    expect(usageRes.body.success).toBe(true);
    expect(Array.isArray(usageRes.body.tokens)).toBe(true);
    expect(usageRes.body.tokens.length).toBeGreaterThan(0);

    const row = usageRes.body.tokens.find((item) => item.name === 'explain-token');
    expect(row).toBeDefined();
    expect(typeof row.todayCalls).toBe('number');
    expect(typeof row.dailyRemaining).toBe('number');
    expect(Array.isArray(row.recentCalls)).toBe(true);
  });
});
