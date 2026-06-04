import { jest } from '@jest/globals';
import { configureApi, resetApiConfig, setWxInstance } from '../../../miniprogram/services/api.js';
import { addFavorite, addRecentLocation, deleteFavorite, listFavorites, listRecentLocations, normalizeLocation } from '../../../miniprogram/services/user.js';
import { saveSession, clearSession } from '../../../miniprogram/services/auth.js';

describe('miniprogram services/user', () => {
  afterEach(() => {
    clearSession();
    resetApiConfig();
    jest.restoreAllMocks();
  });

  test('normalizes location payloads for favorites and recent locations', () => {
    expect(normalizeLocation({ locationName: '北京', coordinate: { lat: '39.9', lon: '116.4' }, period: 'sunrise' })).toMatchObject({
      name: '北京',
      locationName: '北京',
      lat: 39.9,
      lon: 116.4,
      type: 'sunrise'
    });
  });

  test('favorites API sends bearer Authorization and session token', async () => {
    const wxMock = {
      getStorageSync: jest.fn(),
      setStorageSync: jest.fn(),
      removeStorageSync: jest.fn(),
      request: jest.fn(({ success }) => success({ statusCode: 200, data: { favorites: [{ name: '北京', lat: 39.9, lon: 116.4 }] } }))
    };
    setWxInstance(wxMock);
    configureApi({ baseUrl: 'https://api.example.com' });
    saveSession({ sessionToken: 'token-1' }, { wx: wxMock });

    await expect(listFavorites({ wx: wxMock })).resolves.toEqual([expect.objectContaining({ name: '北京', lat: 39.9, lon: 116.4 })]);

    expect(wxMock.request).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://api.example.com/api/user/favorites',
      method: 'GET',
      header: expect.objectContaining({ Authorization: 'Bearer token-1', 'X-Session-Token': 'token-1' })
    }));
  });

  test('favorites API silently logs in when no session token exists', async () => {
    const wxMock = {
      login: jest.fn(({ success }) => success({ code: 'wx-code-auto' })),
      getStorageSync: jest.fn(),
      setStorageSync: jest.fn(),
      removeStorageSync: jest.fn(),
      request: jest.fn((options) => {
        if (options.url.endsWith('/api/wechat/login')) {
          options.success({ statusCode: 200, data: { token: 'auto-token', user: { userId: 'user-auto' } } });
          return;
        }
        options.success({ statusCode: 200, data: { favorites: [] } });
      })
    };
    setWxInstance(wxMock);
    configureApi({ baseUrl: 'https://api.example.com' });

    await expect(listFavorites({ wx: wxMock })).resolves.toEqual([]);

    expect(wxMock.login).toHaveBeenCalledTimes(1);
    expect(wxMock.request.mock.calls.map(([call]) => call.url)).toEqual([
      'https://api.example.com/api/wechat/login',
      'https://api.example.com/api/user/favorites'
    ]);
    expect(wxMock.request.mock.calls[1][0].header).toEqual(expect.objectContaining({
      Authorization: 'Bearer auto-token',
      'X-Session-Token': 'auto-token'
    }));
  });

  test('favorites and recent locations fall back locally when silent login is unavailable', async () => {
    const wxMock = {
      login: jest.fn(({ fail }) => fail({ errMsg: 'login:fail personal subject unavailable' })),
      getStorageSync: jest.fn(),
      setStorageSync: jest.fn(),
      removeStorageSync: jest.fn(),
      request: jest.fn()
    };
    setWxInstance(wxMock);
    configureApi({ baseUrl: 'https://api.example.com' });

    const location = { name: '北京', lat: 39.9, lon: 116.4 };

    await expect(listFavorites({ wx: wxMock })).resolves.toEqual([]);
    await expect(addFavorite(location, { wx: wxMock })).resolves.toMatchObject(location);
    await expect(deleteFavorite(location, { wx: wxMock })).resolves.toEqual({ success: true });
    await expect(listRecentLocations({ wx: wxMock })).resolves.toEqual([]);
    await expect(addRecentLocation(location, { wx: wxMock })).resolves.toMatchObject(location);

    expect(wxMock.login).toHaveBeenCalled();
    expect(wxMock.request).not.toHaveBeenCalled();
  });

  test('writes favorite and recent endpoints', async () => {
    const calls = [];
    const wxMock = {
      getStorageSync: jest.fn(),
      setStorageSync: jest.fn(),
      removeStorageSync: jest.fn(),
      request: jest.fn((options) => {
        calls.push(options);
        if (options.method === 'POST' && options.url.endsWith('/favorites')) {
          options.success({ statusCode: 201, data: { favorite: options.data } });
          return;
        }
        if (options.method === 'POST' && options.url.endsWith('/recent-locations')) {
          options.success({ statusCode: 201, data: { location: options.data } });
          return;
        }
        options.success({ statusCode: 200, data: { success: true } });
      })
    };
    setWxInstance(wxMock);
    configureApi({ baseUrl: 'https://api.example.com' });
    saveSession({ sessionToken: 'token-2' }, { wx: wxMock });

    await addFavorite({ name: '海边', lat: 1, lon: 2 }, { wx: wxMock });
    await deleteFavorite({ name: '海边', lat: 1, lon: 2 }, { wx: wxMock });
    await addRecentLocation({ locationName: '山顶', lat: 3, lon: 4, type: 'sunset' }, { wx: wxMock });

    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      'POST https://api.example.com/api/user/favorites',
      'DELETE https://api.example.com/api/user/favorites/loc%3A1.000000%3A2.000000%3A%25E6%25B5%25B7%25E8%25BE%25B9',
      'POST https://api.example.com/api/user/recent-locations'
    ]);
  });

  test('recent list reads GET /api/user/recent-locations', async () => {
    const wxMock = {
      getStorageSync: jest.fn(),
      setStorageSync: jest.fn(),
      removeStorageSync: jest.fn(),
      request: jest.fn(({ success }) => success({ statusCode: 200, data: { recentLocations: [{ locationName: '山顶', lat: 3, lon: 4 }] } }))
    };
    setWxInstance(wxMock);
    configureApi({ baseUrl: 'https://api.example.com' });
    saveSession({ sessionToken: 'token-3' }, { wx: wxMock });

    await expect(listRecentLocations({ wx: wxMock })).resolves.toEqual([expect.objectContaining({ name: '山顶', lat: 3, lon: 4 })]);
    expect(wxMock.request.mock.calls[0][0].url).toBe('https://api.example.com/api/user/recent-locations');
  });
});
