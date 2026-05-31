import { jest } from '@jest/globals';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import { TextEncoder, TextDecoder } from 'node:util';

const require = createRequire(import.meta.url);
let request;

beforeAll(async () => {
  if (!global.TextEncoder) global.TextEncoder = TextEncoder;
  if (!global.TextDecoder) global.TextDecoder = TextDecoder;
  if (!global.setImmediate) global.setImmediate = (fn, ...args) => setTimeout(fn, 0, ...args);
  const supertest = await import('supertest');
  request = supertest.default || supertest;
});

function createApp(router) {
  const app = express();
  app.use(express.json());
  app.use('/api/analytics', router);
  return app;
}

describe('analytics routes', () => {
  let tempDir;
  let file;
  let AnalyticsService;
  let createRouter;

  beforeEach(() => {
    jest.resetModules();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xiake-analytics-route-'));
    file = path.join(tempDir, 'analytics-events.json');
    ({ AnalyticsService } = require('../../../server/services/AnalyticsService.js'));
    ({ createRouter } = require('../../../server/routes/analytics.js'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function appWithService(options = {}) {
    const service = new AnalyticsService({
      filePath: file,
      ipHashSecret: 'route-test-secret',
      now: () => new Date('2026-06-01T12:00:00.000Z')
    });
    return {
      app: createApp(createRouter({
        service,
        rateLimit: { windowMs: 60_000, max: 50 },
        ...options
      })),
      service
    };
  }

  test('records a sanitized analytics event from request body and client headers', async () => {
    const { app } = appWithService();

    const res = await request(app)
      .post('/api/analytics/event')
      .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
      .set('X-Forwarded-For', '198.51.100.88')
      .send({
        channel: 'web',
        eventName: 'page_view',
        visitorHash: 'visitor-route',
        userId: '',
        path: '/oauth/callback?code=route-code&state=route-state&openid=open-id&tab=home',
        referrerType: 'external',
        deviceType: 'mobile',
        region: 'CN-SH',
        targetType: 'page',
        status: 'success',
        elapsedMs: 42,
        token: 'route-token',
        unionid: 'union-id'
      })
      .expect(202);

    expect(res.body).toMatchObject({ success: true, accepted: true });
    const persisted = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(persisted.rawEvents[0]).toMatchObject({
      path: '/oauth/callback?tab=home',
      visitorHash: 'visitor-route',
      userId: '',
      deviceType: 'mobile'
    });
    expect(persisted.rawEvents[0].ipHash).toMatch(/^ip_[a-f0-9]{32}$/);
    expect(JSON.stringify(persisted)).not.toContain('198.51.100.88');
    expect(JSON.stringify(persisted)).not.toContain('route-code');
    expect(JSON.stringify(persisted)).not.toContain('route-state');
    expect(JSON.stringify(persisted)).not.toContain('route-token');
    expect(JSON.stringify(persisted)).not.toContain('open-id');
    expect(JSON.stringify(persisted)).not.toContain('union-id');
  });

  test('rejects oversized or invalid payloads before persistence', async () => {
    const { app } = appWithService();

    await request(app)
      .post('/api/analytics/event')
      .send({ eventName: 'x'.repeat(130), path: '/forecast' })
      .expect(400);

    expect(fs.existsSync(file)).toBe(false);
  });

  test('rate limits event submissions by hashed client IP', async () => {
    const service = new AnalyticsService({
      filePath: file,
      ipHashSecret: 'route-test-secret',
      now: () => new Date('2026-06-01T12:00:00.000Z')
    });
    const app = createApp(createRouter({
      service,
      rateLimit: { windowMs: 60_000, max: 1 }
    }));

    await request(app)
      .post('/api/analytics/event')
      .set('X-Forwarded-For', '203.0.113.10')
      .send({ channel: 'web', eventName: 'page_view', visitorHash: 'v1', path: '/forecast' })
      .expect(202);

    const res = await request(app)
      .post('/api/analytics/event')
      .set('X-Forwarded-For', '203.0.113.10')
      .send({ channel: 'web', eventName: 'page_view', visitorHash: 'v1', path: '/forecast' })
      .expect(429);

    expect(res.body.error.code).toBe('ANALYTICS_RATE_LIMIT');
  });

  test('marks bot and health check requests as ignored for normal aggregates', async () => {
    const { app } = appWithService();

    await request(app)
      .post('/api/analytics/event')
      .set('User-Agent', 'curl/8.0')
      .send({ channel: 'web', eventName: 'page_view', visitorHash: 'bot', path: '/forecast' })
      .expect(202);
    await request(app)
      .post('/api/analytics/event')
      .send({ channel: 'server', eventName: 'page_view', visitorHash: 'health', path: '/api/health?token=secret' })
      .expect(202);

    const persisted = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(persisted.rawEvents[0]).toMatchObject({ isBot: true, isCounted: false });
    expect(persisted.rawEvents[1]).toMatchObject({ isHealthCheck: true, isCounted: false, path: '/api/health' });
    expect(persisted.daily['2026-06-01'].pv).toBe(0);
    expect(persisted.daily['2026-06-01'].uv).toEqual([]);
  });
});
