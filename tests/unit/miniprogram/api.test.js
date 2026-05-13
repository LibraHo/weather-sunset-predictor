import { jest } from '@jest/globals';
import { configureApi, request, resetApiConfig, setWxInstance } from '../../../miniprogram/services/api.js';

describe('miniprogram services/api', () => {
  afterEach(() => {
    resetApiConfig();
    jest.restoreAllMocks();
  });

  test('request resolves response data and sends baseUrl, timeout, token header', async () => {
    const wxMock = {
      request: jest.fn(({ success }) => success({ statusCode: 200, data: { success: true, data: { ok: true } } }))
    };
    setWxInstance(wxMock);
    configureApi({ baseUrl: 'https://example.com/', timeout: 5000, sessionToken: 'session-1' });

    await expect(request('/api/ping', { method: 'POST', data: { a: 1 } })).resolves.toEqual({ success: true, data: { ok: true } });

    expect(wxMock.request).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://example.com/api/ping',
      method: 'POST',
      data: { a: 1 },
      timeout: 5000,
      header: expect.objectContaining({ 'X-Session-Token': 'session-1' })
    }));
  });

  test('request appends query params for GET calls', async () => {
    const wxMock = {
      request: jest.fn(({ success }) => success({ statusCode: 200, data: { results: [] } }))
    };
    setWxInstance(wxMock);
    configureApi({ baseUrl: 'https://api.test' });

    await request('/api/search', { query: { q: '北京', limit: 3 } });

    expect(wxMock.request.mock.calls[0][0].url).toBe('https://api.test/api/search?q=%E5%8C%97%E4%BA%AC&limit=3');
  });

  test('request rejects non-2xx responses with unified error object', async () => {
    const wxMock = {
      request: jest.fn(({ success }) => success({
        statusCode: 400,
        data: { error: { code: 'INVALID_PARAMS', message: 'bad params' } }
      }))
    };
    setWxInstance(wxMock);

    await expect(request('/api/fail')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'INVALID_PARAMS',
      status: 400,
      message: 'bad params',
      isApiError: true
    });
  });

  test('request rejects wx.request fail with unified error object', async () => {
    const wxMock = {
      request: jest.fn(({ fail }) => fail({ errMsg: 'request:fail timeout' }))
    };
    setWxInstance(wxMock);

    await expect(request('/api/timeout')).rejects.toMatchObject({
      name: 'ApiError',
      code: 'WX_REQUEST_FAILED',
      message: 'request:fail timeout',
      isApiError: true
    });
  });
});
