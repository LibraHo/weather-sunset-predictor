import { jest } from '@jest/globals';

describe('miniprogram visitor counter service', () => {
  let api;
  let visitor;

  beforeEach(async () => {
    jest.resetModules();
    api = await import('../../../miniprogram/services/api.js');
    api.resetApiConfig();
    visitor = await import('../../../miniprogram/services/visitor.js');
  });

  afterEach(() => {
    api.resetApiConfig();
    delete globalThis.wx;
  });

  test('increments the shared website visitor counter endpoint', async () => {
    const requestMock = jest.fn((options) => {
      expect(options.url).toBe('https://sunset.bjhyc.online/api/visitor/count');
      expect(options.method).toBe('POST');
      expect(options.data).toEqual({ client: 'miniprogram' });
      expect(options.header).toMatchObject({ 'X-Xiake-Client': 'miniprogram' });
      options.success({ statusCode: 200, data: { count: 12345 } });
    });
    api.configureApi({ baseUrl: 'https://sunset.bjhyc.online' });
    api.setWxInstance({ request: requestMock });

    await expect(visitor.incrementVisitorCount()).resolves.toBe(12345);
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  test('formats visitor counts for the home footer', () => {
    expect(visitor.formatVisitorCount(12345)).toBe('12,345');
    expect(visitor.formatVisitorCount(null)).toBe('--');
    expect(visitor.normalizeVisitorCount({ visitorCount: 9.8 })).toBe(9);
  });
});
