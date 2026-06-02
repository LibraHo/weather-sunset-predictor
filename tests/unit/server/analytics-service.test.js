import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(import.meta.url);
const { AnalyticsService, _test } = require('../../../server/services/AnalyticsService.js');

describe('AnalyticsService', () => {
  let tempDir;
  let file;
  let now;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xiake-analytics-'));
    file = path.join(tempDir, 'analytics-events.json');
    now = new Date('2026-06-01T12:00:00.000Z');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function createService(date = now) {
    return new AnalyticsService({
      filePath: file,
      ipHashSecret: 'unit-test-secret',
      now: () => date
    });
  }

  test('sanitizes sensitive identifiers and exact coordinates before persistence', () => {
    const service = createService();

    const result = service.recordEvent({
      channel: 'web',
      eventName: 'page_view',
      visitorHash: 'visitor-1',
      userId: 'user-123',
      ip: '203.0.113.8',
      path: '/oauth/callback?code=secret-code&state=secret-state&token=secret-token&lat=39.908823&lon=116.397470&tab=home',
      referrerType: 'external',
      deviceType: 'desktop',
      region: 'CN-BJ',
      targetType: 'page',
      status: 'success',
      elapsedMs: 123,
      errorCode: '',
      openid: 'openid-secret',
      unionid: 'unionid-secret',
      access_token: 'access-secret',
      foo: 'not-allowed'
    });

    expect(result.accepted).toBe(true);
    const persisted = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(persisted.rawEvents).toHaveLength(1);
    expect(persisted.rawEvents[0]).toMatchObject({
      channel: 'web',
      eventName: 'page_view',
      visitorHash: 'visitor-1',
      userId: 'user-123',
      path: '/oauth/callback?tab=home',
      referrerType: 'external',
      deviceType: 'desktop',
      region: 'CN-BJ',
      targetType: 'page',
      status: 'success',
      elapsedMs: 123,
      errorCode: ''
    });
    expect(persisted.rawEvents[0].ipHash).toMatch(/^ip_[a-f0-9]{32}$/);
    expect(persisted.rawEvents[0]).not.toHaveProperty('ip');
    expect(persisted.rawEvents[0]).not.toHaveProperty('lat');
    expect(persisted.rawEvents[0]).not.toHaveProperty('lon');
    expect(persisted.rawEvents[0]).not.toHaveProperty('foo');
    expect(JSON.stringify(persisted)).not.toContain('203.0.113.8');
    expect(JSON.stringify(persisted)).not.toContain('secret-code');
    expect(JSON.stringify(persisted)).not.toContain('secret-state');
    expect(JSON.stringify(persisted)).not.toContain('openid-secret');
    expect(JSON.stringify(persisted)).not.toContain('unionid-secret');
  });

  test('cleans path query strings without dropping safe query keys', () => {
    expect(_test.cleanPath('/forecast?lat=39.9&lng=116.4&q=sunset&utm_source=wechat&code=abc&state=xyz'))
      .toBe('/forecast?q=sunset&utm_source=wechat');
  });

  test('whitelists analytics fields and normalizes unknown enum values', () => {
    const service = createService();

    service.recordEvent({
      channel: 'evil-channel',
      eventName: 'script-tag',
      visitorHash: 'visitor-2',
      path: '/weather',
      referrerType: 'javascript:alert(1)',
      deviceType: 'toaster',
      targetType: 'password',
      status: 'boom',
      elapsedMs: -20,
      errorCode: 'E_TOKEN_LEAK',
      token: 'must-not-persist'
    });

    const event = JSON.parse(fs.readFileSync(file, 'utf8')).rawEvents[0];
    expect(event).toEqual(expect.objectContaining({
      channel: 'unknown',
      eventName: 'unknown',
      referrerType: 'unknown',
      deviceType: 'unknown',
      targetType: 'unknown',
      status: 'unknown',
      elapsedMs: 0,
      errorCode: 'E_TOKEN_LEAK'
    }));
    expect(Object.keys(event).sort()).toEqual([
      'channel',
      'day',
      'deviceType',
      'elapsedMs',
      'errorCode',
      'eventName',
      'id',
      'ipHash',
      'isAdmin',
      'isBot',
      'isCounted',
      'isHealthCheck',
      'path',
      'referrerType',
      'region',
      'status',
      't',
      'targetType',
      'userId',
      'visitorHash'
    ]);
    expect(JSON.stringify(event)).not.toContain('must-not-persist');
  });

  test('marks bot and health events without adding normal uv or pv', () => {
    const service = createService();

    service.recordEvent({
      channel: 'web',
      eventName: 'page_view',
      visitorHash: 'bot-visitor',
      path: '/forecast',
      userAgent: 'Googlebot/2.1'
    });
    service.recordEvent({
      channel: 'server',
      eventName: 'page_view',
      visitorHash: 'health-probe',
      path: '/health'
    });

    const summary = service.getSummary({ days: 1 });
    expect(summary.days[0].pv).toBe(0);
    expect(summary.days[0].uv).toBe(0);
    expect(summary.days[0].filtered.bot).toBe(1);
    expect(summary.days[0].filtered.health).toBe(1);

    const events = JSON.parse(fs.readFileSync(file, 'utf8')).rawEvents;
    expect(events[0]).toMatchObject({ isBot: true, isCounted: false });
    expect(events[1]).toMatchObject({ isHealthCheck: true, isCounted: false });
  });

  test('aggregates countable page views, events, channels, admin traffic, and errors by day', () => {
    const service = createService();

    service.recordEvent({ channel: 'web', eventName: 'page_view', visitorHash: 'visitor-a', path: '/forecast', status: 'success' });
    service.recordEvent({ channel: 'web', eventName: 'page_view', visitorHash: 'visitor-a', path: '/forecast?tab=hourly', status: 'success' });
    service.recordEvent({ channel: 'miniprogram', eventName: 'prediction_request', visitorHash: 'visitor-b', path: '/api/prediction', status: 'error', errorCode: 'PROVIDER_TIMEOUT' });
    service.recordEvent({ channel: 'web', eventName: 'page_view', visitorHash: 'admin-a', path: '/admin/dashboard', status: 'success' });

    const summary = service.getSummary({ days: 1 });
    expect(summary.days[0]).toMatchObject({
      day: '2026-06-01',
      pv: 2,
      uv: 1,
      events: {
        page_view: 3,
        prediction_request: 1
      },
      channels: {
        web: 3,
        miniprogram: 1
      },
      admin: {
        pv: 1,
        uv: 1
      },
      errors: {
        PROVIDER_TIMEOUT: 1
      }
    });
  });

  test('prunes raw events after 30 days and daily aggregates after one year', () => {
    fs.writeFileSync(file, JSON.stringify({
      rawEvents: [
        { id: 'old-raw', t: '2026-04-01T00:00:00.000Z', day: '2026-04-01', path: '/old' },
        { id: 'recent-raw', t: '2026-05-20T00:00:00.000Z', day: '2026-05-20', path: '/recent' }
      ],
      daily: {
        '2024-12-31': { day: '2024-12-31', pv: 9, uv: ['old'] },
        '2025-06-02': { day: '2025-06-02', pv: 2, uv: ['kept'] }
      }
    }), 'utf8');

    const service = createService();
    service.recordEvent({ channel: 'web', eventName: 'page_view', visitorHash: 'visitor-new', path: '/forecast' });

    const persisted = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(persisted.rawEvents.map((event) => event.id)).toEqual(['recent-raw', expect.any(String)]);
    expect(Object.keys(persisted.daily).sort()).toEqual(['2025-06-02', '2026-06-01']);
  });
});
