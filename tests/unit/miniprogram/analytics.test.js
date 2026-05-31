import { jest } from '@jest/globals';

describe('miniprogram analytics service', () => {
  let api;
  let analytics;

  beforeEach(async () => {
    jest.resetModules();
    api = await import('../../../miniprogram/services/api.js');
    api.resetApiConfig();
    analytics = await import('../../../miniprogram/services/analytics.js');
  });

  afterEach(() => {
    api.resetApiConfig();
    delete globalThis.wx;
  });

  test('posts lightweight events to the analytics collection endpoint', async () => {
    const requestMock = jest.fn((options) => {
      expect(options.url).toBe('https://sunset.bjhyc.online/api/analytics/event');
      expect(options.method).toBe('POST');
      expect(options.header).toMatchObject({ 'X-Xiake-Client': 'miniprogram' });
      expect(options.data).toMatchObject({
        channel: 'miniprogram',
        eventName: 'map_view',
        path: '/pages/map/index',
        targetType: 'feature',
        targetLabel: 'china-firecloud-map',
        status: 'success'
      });
      expect(typeof options.data.occurredAt).toBe('string');
      options.success({ statusCode: 200, data: { success: true } });
    });
    api.configureApi({ baseUrl: 'https://sunset.bjhyc.online' });
    api.setWxInstance({ request: requestMock });

    await expect(analytics.trackMapView({
      path: '/pages/map/index?lat=39.9&lon=116.4',
      targetLabel: 'china-firecloud-map'
    })).resolves.toBe(true);
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  test('analytics failures resolve false and do not block the caller', async () => {
    api.setWxInstance({
      request(options) {
        options.fail({ errMsg: 'network down' });
      }
    });

    await expect(analytics.trackShareClick({ path: '/pages/result/index', targetLabel: 'poster' })).resolves.toBe(false);
  });

  test('exposes named helpers for the required user behavior entries', () => {
    expect(analytics.trackPageVisit).toEqual(expect.any(Function));
    expect(analytics.trackShareClick).toEqual(expect.any(Function));
    expect(analytics.trackMapView).toEqual(expect.any(Function));
    expect(analytics.trackUploadEntry).toEqual(expect.any(Function));
    expect(analytics.trackApiApplicationEntry).toEqual(expect.any(Function));
  });
});
