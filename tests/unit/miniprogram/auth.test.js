import { jest } from '@jest/globals';
import { configureApi, getApiConfig, resetApiConfig, setWxInstance } from '../../../miniprogram/services/api.js';
import { clearSession, getCurrentUser, getSessionToken, loginWithWechat, loginWithWechatCode, saveSession, setAuthWxInstance } from '../../../miniprogram/services/auth.js';

describe('miniprogram services/auth', () => {
  afterEach(() => {
    clearSession();
    resetApiConfig();
    setAuthWxInstance(null);
    jest.restoreAllMocks();
  });

  test('loginWithWechatCode posts code and stores session token in API config', async () => {
    const wxMock = {
      request: jest.fn(({ success }) => success({
        statusCode: 200,
        data: {
          success: true,
          data: {
            userId: 'user-1',
            sessionToken: 'session-token-1',
            user: { id: 'user-1' },
            identities: [{ provider: 'wechat', providerUserId: 'openid-1' }]
          }
        }
      })),
      setStorageSync: jest.fn(),
      getStorageSync: jest.fn(),
      removeStorageSync: jest.fn()
    };
    setWxInstance(wxMock);
    configureApi({ baseUrl: 'https://api.example.com' });

    await expect(loginWithWechatCode({ code: 'wx-code-1', wx: wxMock })).resolves.toEqual({
      userId: 'user-1',
      sessionToken: 'session-token-1',
      user: { id: 'user-1' },
      identities: [{ provider: 'wechat', providerUserId: 'openid-1' }]
    });

    expect(wxMock.request).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://api.example.com/api/wechat/login',
      method: 'POST',
      data: { code: 'wx-code-1', profile: undefined }
    }));
    expect(wxMock.setStorageSync).toHaveBeenCalledWith('sessionToken', 'session-token-1');
    expect(getApiConfig().sessionToken).toBe('session-token-1');
  });

  test('loginWithWechatCode accepts server route response shape', async () => {
    const wxMock = {
      request: jest.fn(({ success }) => success({
        statusCode: 200,
        data: {
          token: 'route-token',
          user: {
            userId: 'user-route-1',
            identities: [{ provider: 'wechat', subject: 'openid-route' }]
          }
        }
      })),
      setStorageSync: jest.fn(),
      getStorageSync: jest.fn(),
      removeStorageSync: jest.fn()
    };
    setWxInstance(wxMock);

    await expect(loginWithWechatCode({ code: 'wx-code-route', wx: wxMock })).resolves.toEqual({
      userId: 'user-route-1',
      sessionToken: 'route-token',
      user: {
        userId: 'user-route-1',
        identities: [{ provider: 'wechat', subject: 'openid-route' }]
      },
      identities: [{ provider: 'wechat', subject: 'openid-route' }]
    });
  });

  test('loginWithWechat calls wx.login before backend login', async () => {
    const wxMock = {
      login: jest.fn(({ success }) => success({ code: 'wx-login-code' })),
      request: jest.fn(({ success }) => success({ statusCode: 200, data: { success: true, data: { sessionToken: 'session-token-2' } } })),
      setStorageSync: jest.fn(),
      getStorageSync: jest.fn(),
      removeStorageSync: jest.fn()
    };
    setWxInstance(wxMock);
    setAuthWxInstance(wxMock);
    configureApi({ baseUrl: 'https://api.example.com' });

    await expect(loginWithWechat({ wx: wxMock })).resolves.toMatchObject({ sessionToken: 'session-token-2' });
    expect(wxMock.login).toHaveBeenCalledTimes(1);
    expect(wxMock.request.mock.calls[0][0].data).toEqual({ code: 'wx-login-code', profile: undefined });
  });

  test('save, read and clear session token support storage mocks', () => {
    const stored = new Map();
    const wxMock = {
      setStorageSync: jest.fn((key, value) => stored.set(key, value)),
      getStorageSync: jest.fn((key) => stored.get(key)),
      removeStorageSync: jest.fn((key) => stored.delete(key))
    };

    saveSession({ sessionToken: 'token-1', user: { id: 'u1' } }, { wx: wxMock });
    expect(getSessionToken({ wx: wxMock })).toBe('token-1');
    expect(getCurrentUser({ wx: wxMock })).toEqual({ id: 'u1' });

    clearSession({ wx: wxMock });
    expect(getSessionToken({ wx: wxMock })).toBeNull();
    expect(wxMock.removeStorageSync).toHaveBeenCalledWith('sessionToken');
  });

  test('loginWithWechatCode rejects missing code before network call', async () => {
    await expect(loginWithWechatCode({})).rejects.toThrow('WECHAT_CODE_REQUIRED');
  });
});
