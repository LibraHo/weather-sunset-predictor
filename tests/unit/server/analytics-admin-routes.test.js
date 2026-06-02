import { jest } from '@jest/globals';
import express from 'express';
import { TextDecoder, TextEncoder } from 'util';

let createAnalyticsAdminRouter;
let request;

beforeAll(async () => {
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
  request = (await import('supertest')).default;
  const routeMod = await import('../../../server/routes/analytics-admin.js');
  createAnalyticsAdminRouter = routeMod.createRouter || routeMod.default?.createRouter;
});

function makeApp(events = []) {
  const analyticsService = {
    listEvents: jest.fn().mockResolvedValue(events)
  };
  const app = express();
  app.use(express.json());
  app.use('/api/admin/analytics', createAnalyticsAdminRouter({ analyticsService }));
  return { app, analyticsService };
}

describe('analytics admin routes', () => {
  test('summary aggregates traffic dimensions while excluding admin visits from PV and UV', async () => {
    const { app } = makeApp([
      {
        type: 'page_view',
        visitorId: 'visitor-a',
        path: '/',
        channel: 'organic',
        source: 'wechat',
        device: 'mobile',
        referrer: 'https://search.example',
        location: { city: 'Beijing', province: 'Beijing' }
      },
      {
        type: 'page_view',
        visitorId: 'visitor-a',
        path: '/map',
        channel: 'organic',
        source: 'wechat',
        device: 'mobile',
        referrer: 'https://search.example',
        location: 'Beijing'
      },
      {
        type: 'page_view',
        visitorId: 'visitor-b',
        path: '/prediction',
        channel: 'direct',
        source: 'direct',
        device: 'desktop',
        referrer: ''
      },
      {
        type: 'page_view',
        visitorId: 'admin-1',
        path: '/admin',
        channel: 'direct',
        source: 'internal',
        device: 'desktop',
        admin: true
      }
    ]);

    const res = await request(app)
      .get('/api/admin/analytics/summary?days=7')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.summary.pageViews).toBe(3);
    expect(res.body.summary.uniqueVisitors).toBe(2);
    expect(res.body.summary.channels).toEqual([
      { key: 'organic', count: 2 },
      { key: 'direct', count: 1 }
    ]);
    expect(res.body.summary.sources).toEqual([
      { key: 'wechat', count: 2 },
      { key: 'direct', count: 1 }
    ]);
    expect(res.body.summary.devices).toEqual([
      { key: 'mobile', count: 2 },
      { key: 'desktop', count: 1 }
    ]);
    expect(res.body.summary.referrers).toEqual([
      { key: 'https://search.example', count: 2 },
      { key: 'direct', count: 1 }
    ]);
    expect(res.body.summary.topPaths).toEqual([
      { key: '/', count: 1 },
      { key: '/map', count: 1 },
      { key: '/prediction', count: 1 }
    ]);
    expect(res.body.summary.locations).toEqual([{ key: 'Beijing', count: 2 }]);
  });

  test('behavior and funnel expose page, share, map, upload, and API application entries', async () => {
    const { app } = makeApp([
      { type: 'page_view', visitorId: 'u1', path: '/' },
      { type: 'page_view', visitorId: 'u2', path: '/map' },
      { type: 'share_click', visitorId: 'u1', path: '/prediction' },
      { type: 'share_click', visitorId: 'u2', path: '/prediction' },
      { type: 'map_view', visitorId: 'u1', path: '/map' },
      { type: 'upload_entry', visitorId: 'u1', path: '/admin/upload' },
      { type: 'api_application_entry', visitorId: 'u3', path: '/api/apply' },
      { type: 'page_view', visitorId: 'admin-1', path: '/api/admin/analytics/summary', admin: true }
    ]);

    const behaviorRes = await request(app)
      .get('/api/admin/analytics/behavior')
      .expect(200);

    expect(behaviorRes.body.behavior).toMatchObject({
      pageVisits: 2,
      shareClicks: 2,
      mapViews: 1,
      uploadEntries: 1,
      apiApplicationEntries: 1
    });

    const funnelRes = await request(app)
      .get('/api/admin/analytics/funnel')
      .expect(200);

    expect(funnelRes.body.funnel.steps).toEqual([
      { key: 'page_visits', label: 'Page visits', count: 2, conversionFromPageVisits: 100 },
      { key: 'map_views', label: 'Map views', count: 1, conversionFromPageVisits: 50 },
      { key: 'share_clicks', label: 'Share clicks', count: 2, conversionFromPageVisits: 100 },
      { key: 'upload_entries', label: 'Upload entries', count: 1, conversionFromPageVisits: 50 },
      { key: 'api_application_entries', label: 'API application entries', count: 1, conversionFromPageVisits: 50 }
    ]);
  });

  test('quality reports failure rate, slow requests, geocoding misses, mini program errors, map failures, and token anomalies', async () => {
    const { app } = makeApp([
      { type: 'api_request', path: '/api/prediction', status: 200, durationMs: 180 },
      { type: 'api_request', path: '/api/geocoding', status: 500, durationMs: 1450, errorCode: 'GEOCODING_TIMEOUT' },
      { type: 'api_request', path: '/api/agent', success: false, durationMs: 2600, tokenId: 'tok_bad' },
      { type: 'geocoding_failed', query: 'Nowhere Lake', reason: 'ZERO_RESULTS' },
      { type: 'miniprogram_error', errorCode: 'WX_LOGIN_FAILED', message: 'login failed' },
      { type: 'map_layer_failure', layer: 'cloud', errorCode: 'TILE_500' },
      { type: 'api_token_anomaly', tokenId: 'tok_bad', reason: 'daily_limit_exceeded' }
    ]);

    const res = await request(app)
      .get('/api/admin/analytics/quality')
      .expect(200);

    expect(res.body.quality.failureRate).toBe(66.67);
    expect(res.body.quality.totalRequests).toBe(3);
    expect(res.body.quality.failedRequests).toBe(2);
    expect(res.body.quality.slowRequestsTop).toEqual([
      { path: '/api/agent', count: 1, maxDurationMs: 2600, avgDurationMs: 2600 },
      { path: '/api/geocoding', count: 1, maxDurationMs: 1450, avgDurationMs: 1450 }
    ]);
    expect(res.body.quality.geocodingFailedQueries).toEqual([
      { key: 'Nowhere Lake', count: 1, reason: 'ZERO_RESULTS' }
    ]);
    expect(res.body.quality.miniprogramErrors).toEqual([
      { key: 'WX_LOGIN_FAILED', count: 1, message: 'login failed' }
    ]);
    expect(res.body.quality.mapLayerFailures).toEqual([
      { key: 'cloud', count: 1, errorCode: 'TILE_500' }
    ]);
    expect(res.body.quality.apiTokenAnomalies).toEqual([
      { key: 'tok_bad', count: 1, reason: 'daily_limit_exceeded' }
    ]);
  });

  test('all read endpoints return empty analytics shapes when the service has no data', async () => {
    const { app } = makeApp([]);

    const [summary, sources, behavior, funnel, quality] = await Promise.all([
      request(app).get('/api/admin/analytics/summary').expect(200),
      request(app).get('/api/admin/analytics/sources').expect(200),
      request(app).get('/api/admin/analytics/behavior').expect(200),
      request(app).get('/api/admin/analytics/funnel').expect(200),
      request(app).get('/api/admin/analytics/quality').expect(200)
    ]);

    expect(summary.body.summary).toMatchObject({
      pageViews: 0,
      uniqueVisitors: 0,
      channels: [],
      sources: [],
      devices: [],
      referrers: [],
      topPaths: [],
      locations: []
    });
    expect(sources.body.sources).toEqual({
      channels: [],
      sources: [],
      devices: [],
      referrers: []
    });
    expect(behavior.body.behavior).toMatchObject({
      pageVisits: 0,
      shareClicks: 0,
      mapViews: 0,
      uploadEntries: 0,
      apiApplicationEntries: 0
    });
    expect(funnel.body.funnel.steps).toEqual([
      { key: 'page_visits', label: 'Page visits', count: 0, conversionFromPageVisits: 0 },
      { key: 'map_views', label: 'Map views', count: 0, conversionFromPageVisits: 0 },
      { key: 'share_clicks', label: 'Share clicks', count: 0, conversionFromPageVisits: 0 },
      { key: 'upload_entries', label: 'Upload entries', count: 0, conversionFromPageVisits: 0 },
      { key: 'api_application_entries', label: 'API application entries', count: 0, conversionFromPageVisits: 0 }
    ]);
    expect(quality.body.quality).toMatchObject({
      failureRate: 0,
      totalRequests: 0,
      failedRequests: 0,
      slowRequestsTop: [],
      geocodingFailedQueries: [],
      miniprogramErrors: [],
      mapLayerFailures: [],
      apiTokenAnomalies: []
    });
  });
});
