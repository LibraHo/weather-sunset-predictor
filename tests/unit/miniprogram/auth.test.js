import { jest } from '@jest/globals';
import { loginWithWechatCode } from '../../../miniprogram/services/auth.js';
import { configureApi, resetApiConfig, setWxInstance } from '../../../miniprogram/services/api.js';

describe('miniprogram services/auth', () => {
  afterEach(() => {
    resetApiConfig();
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
      }))
    };
    setWxInstance(wxMock);
    configureApi({ baseUrl: 'https://api.example.com' });

    await expect(loginWithWechatCode({ code: 'wx-code-1' })).resolves.toEqual({
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
  });

  test('loginWithWechatCode rejects missing code before network call', async () => {
    await expect(loginWithWechatCode({})).rejects.toThrow('WECHAT_CODE_REQUIRED');
  });
});
