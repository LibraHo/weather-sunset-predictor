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
  const supertest = await import('supertest');
  request = supertest.default || supertest;
});

function createApp(router) {
  const app = express();
  app.use(express.json());
  app.use('/auth', router);
  return app;
}

function cookieValue(setCookieHeaders, name) {
  const header = setCookieHeaders.find((item) => item.startsWith(`${name}=`));
  return header?.split(';')[0].split('=').slice(1).join('=');
}

class FakeUserService {
  constructor() {
    this.data = { users: [] };
    this.tokens = new Map();
  }

  findByIdentity(provider, subject) {
    return this.data.users.find((user) =>
      user.identities?.some((identity) => identity.provider === provider && identity.subject === subject)
    ) || null;
  }

  findById(userId) {
    return this.data.users.find((user) => user.userId === userId) || null;
  }

  issueToken(user) {
    const token = `ey.${user.userId}.sig`;
    this.tokens.set(token, user.userId);
    return token;
  }

  verifyToken(token) {
    return this.findById(this.tokens.get(token));
  }

  save() {}
}

describe('auth routes', () => {
  let userService;
  let createRouter;

  beforeEach(() => {
    jest.resetModules();
    userService = new FakeUserService();
    createRouter = require('../../../server/routes/auth.js').createRouter;
  });

  test('returns explicit errors when OAuth provider config is missing', async () => {
    const app = createApp(createRouter({ userService, oauthOptions: { config: {} } }));

    const wechatWeb = await request(app).get('/auth/wechat/web/start').expect(500);
    expect(wechatWeb.body.error.code).toBe('WECHAT_WEB_CONFIG_MISSING');

    const wechatWebCallback = await request(app)
      .get('/auth/wechat/web/callback?code=sensitive-code&state=sensitive-state')
      .expect(500);
    expect(wechatWebCallback.body.error.code).toBe('WECHAT_WEB_CONFIG_MISSING');
    expect(JSON.stringify(wechatWebCallback.body)).not.toContain('sensitive-code');
    expect(JSON.stringify(wechatWebCallback.body)).not.toContain('sensitive-state');

    const wechatMini = await request(app).post('/auth/wechat/mini/login').send({ code: 'mini-code' }).expect(500);
    expect(wechatMini.body.error.code).toBe('WECHAT_MINI_CONFIG_MISSING');

    const google = await request(app).get('/auth/google/start').expect(500);
    expect(google.body.error.code).toBe('GOOGLE_CONFIG_MISSING');

    const googleCallback = await request(app)
      .get('/auth/google/callback?code=google-code&state=google-state')
      .expect(500);
    expect(googleCallback.body.error.code).toBe('GOOGLE_CONFIG_MISSING');
    expect(JSON.stringify(googleCallback.body)).not.toContain('google-code');
    expect(JSON.stringify(googleCallback.body)).not.toContain('google-state');
  });

  test('generates and validates OAuth state without leaking callback code or state', async () => {
    const app = createApp(createRouter({
      userService,
      oauthOptions: {
        config: {
          wechatWebAppId: 'wechat-web-id',
          wechatWebAppSecret: 'wechat-web-secret',
          wechatWebRedirectUri: 'https://example.test/auth/wechat/web/callback'
        }
      }
    }));

    const start = await request(app).get('/auth/wechat/web/start').expect(302);
    expect(start.headers.location).toContain('https://open.weixin.qq.com/connect/qrconnect');
    expect(start.headers.location).toContain('appid=wechat-web-id');
    expect(start.headers['set-cookie'].join('\n')).toContain('HttpOnly');
    expect(start.headers['set-cookie'].join('\n')).toContain('SameSite=Lax');

    const stateCookie = cookieValue(start.headers['set-cookie'], 'xiake_oauth_state');
    expect(stateCookie).toBeTruthy();

    const callback = await request(app)
      .get('/auth/wechat/web/callback?code=sensitive-code&state=wrong-state')
      .set('Cookie', `xiake_oauth_state=${stateCookie}`)
      .expect(400);

    expect(callback.body.error.code).toBe('OAUTH_STATE_INVALID');
    expect(JSON.stringify(callback.body)).not.toContain('sensitive-code');
    expect(JSON.stringify(callback.body)).not.toContain('wrong-state');
  });

  test('logs in with mocked WeChat web OAuth callback and exposes current user by cookie', async () => {
    const httpClient = {
      get: jest.fn().mockResolvedValue({
        data: { access_token: 'wechat-access', openid: 'web-openid', unionid: 'union-a' }
      })
    };
    const app = createApp(createRouter({
      userService,
      oauthOptions: {
        httpClient,
        config: {
          wechatWebAppId: 'wechat-web-id',
          wechatWebAppSecret: 'wechat-web-secret',
          wechatWebRedirectUri: 'https://example.test/auth/wechat/web/callback'
        }
      }
    }));

    const start = await request(app).get('/auth/wechat/web/start').expect(302);
    const stateCookie = cookieValue(start.headers['set-cookie'], 'xiake_oauth_state');
    const state = new URL(start.headers.location).searchParams.get('state');

    const callback = await request(app)
      .get(`/auth/wechat/web/callback?code=mock-web-code&state=${state}`)
      .set('Cookie', `xiake_oauth_state=${stateCookie}`)
      .expect(200);

    expect(httpClient.get).toHaveBeenCalledWith(
      'https://api.weixin.qq.com/sns/oauth2/access_token',
      expect.objectContaining({
        params: expect.objectContaining({
          appid: 'wechat-web-id',
          secret: 'wechat-web-secret',
          code: 'mock-web-code',
          grant_type: 'authorization_code'
        })
      })
    );
    expect(callback.body.token).toMatch(/^ey/);
    expect(callback.body.user.userId).toBeTruthy();
    expect(callback.body.user.identities).toEqual([{ provider: 'wechat_web' }]);
    expect(JSON.stringify(callback.body)).not.toContain('mock-web-code');
    expect(JSON.stringify(callback.body)).not.toContain('web-openid');

    const sessionCookie = cookieValue(callback.headers['set-cookie'], 'xiake_session');
    const me = await request(app)
      .get('/auth/me')
      .set('Cookie', `xiake_session=${sessionCookie}`)
      .expect(200);
    expect(me.body.user.userId).toBe(callback.body.user.userId);
  });

  test('logs in with mocked mini-program code exchange and supports bearer /me', async () => {
    const httpClient = {
      get: jest.fn().mockResolvedValue({
        data: { openid: 'mini-openid', session_key: 'mini-session', unionid: 'union-a' }
      })
    };
    const app = createApp(createRouter({
      userService,
      oauthOptions: {
        httpClient,
        config: {
          wechatMiniAppId: 'mini-id',
          wechatMiniAppSecret: 'mini-secret'
        }
      }
    }));

    const login = await request(app).post('/auth/wechat/mini/login').send({ code: 'mini-code' }).expect(200);

    expect(httpClient.get).toHaveBeenCalledWith(
      'https://api.weixin.qq.com/sns/jscode2session',
      expect.objectContaining({
        params: expect.objectContaining({
          appid: 'mini-id',
          secret: 'mini-secret',
          js_code: 'mini-code',
          grant_type: 'authorization_code'
        })
      })
    );
    expect(login.body.token).toMatch(/^ey/);
    expect(login.body.user.userId).toBeTruthy();
    expect(login.body.user.identities).toEqual([{ provider: 'wechat_miniprogram' }]);

    const me = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.token}`)
      .expect(200);
    expect(me.body.user.userId).toBe(login.body.user.userId);
  });

  test('uses the real UserService identity API for mini-program auth', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xiake-auth-real-user-'));
    const UserService = require('../../../server/services/UserService.js');
    const realUserService = new UserService({
      dataFile: path.join(tempDir, 'users.json'),
      sessionSecret: 'real-user-auth-secret'
    });
    const httpClient = {
      get: jest.fn().mockResolvedValue({
        data: { openid: 'real-mini-openid', session_key: 'mini-session', unionid: 'real-union' }
      })
    };

    try {
      const app = createApp(createRouter({
        userService: realUserService,
        oauthOptions: {
          httpClient,
          config: {
            wechatMiniAppId: 'mini-id',
            wechatMiniAppSecret: 'mini-secret'
          }
        }
      }));

      const login = await request(app).post('/auth/wechat/mini/login').send({ code: 'mini-code' }).expect(200);
      expect(realUserService.verifyToken(login.body.token).userId).toBe(login.body.user.userId);
      expect(realUserService.findByIdentity('wechat_miniprogram', 'real-mini-openid').userId).toBe(login.body.user.userId);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('logs in with mocked Google id token verification and logout clears the session cookie', async () => {
    const httpClient = {
      post: jest.fn().mockResolvedValue({ data: { id_token: 'mock-id-token' } })
    };
    const googleIdTokenVerifier = {
      verify: jest.fn().mockResolvedValue({
        sub: 'google-sub',
        email: 'person@example.test',
        name: 'Example Person',
        picture: 'https://example.test/avatar.png'
      })
    };
    const app = createApp(createRouter({
      userService,
      oauthOptions: {
        httpClient,
        googleIdTokenVerifier,
        config: {
          googleClientId: 'google-client-id',
          googleClientSecret: 'google-client-secret',
          googleRedirectUri: 'https://example.test/auth/google/callback'
        }
      }
    }));

    const start = await request(app).get('/auth/google/start').expect(302);
    const stateCookie = cookieValue(start.headers['set-cookie'], 'xiake_oauth_state');
    const state = new URL(start.headers.location).searchParams.get('state');

    const callback = await request(app)
      .get(`/auth/google/callback?code=google-code&state=${state}`)
      .set('Cookie', `xiake_oauth_state=${stateCookie}`)
      .expect(200);

    expect(httpClient.post).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/token',
      expect.any(URLSearchParams),
      expect.objectContaining({ headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
    );
    expect(googleIdTokenVerifier.verify).toHaveBeenCalledWith('mock-id-token', 'google-client-id');
    expect(callback.body.user.identities).toEqual([{ provider: 'google' }]);

    const sessionCookie = cookieValue(callback.headers['set-cookie'], 'xiake_session');
    await request(app)
      .post('/auth/logout')
      .set('Cookie', `xiake_session=${sessionCookie}`)
      .expect(200);

    const logout = await request(app).post('/auth/logout').expect(200);
    expect(logout.headers['set-cookie'].join('\n')).toContain('xiake_session=;');
    expect(logout.headers['set-cookie'].join('\n')).toContain('HttpOnly');
  });
});
