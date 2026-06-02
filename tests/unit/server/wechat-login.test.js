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
  app.use('/api/wechat', router);
  return app;
}

describe('wechat login route', () => {
  let tempDir;
  let userService;
  let createRouter;

  beforeEach(() => {
    jest.resetModules();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xiake-wechat-login-'));
    const UserService = require('../../../server/services/UserService.js');
    userService = new UserService({
      dataFile: path.join(tempDir, 'users.json'),
      sessionSecret: 'test-secret'
    });
    createRouter = require('../../../server/routes/wechat.js').createRouter;
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('logs in with mocked code2session and returns token/userId', async () => {
    const wechatAuthService = {
      code2Session: jest.fn().mockResolvedValue({ openid: 'openid-a', sessionKey: 'session-a' })
    };
    const app = createApp(createRouter({ userService, wechatAuthService }));

    const res = await request(app)
      .post('/api/wechat/login')
      .send({ code: 'mock-code' })
      .expect(200);

    expect(wechatAuthService.code2Session).toHaveBeenCalledWith('mock-code');
    expect(res.body.token).toMatch(/^ey/);
    expect(res.body.user.userId).toBeTruthy();
    expect(res.body.user.identities).toEqual([{ provider: 'wechat_miniprogram', subject: 'openid-a' }]);
    expect(userService.verifyToken(res.body.token).userId).toBe(res.body.user.userId);
  });

  test('reuses userId for same wechat openid', async () => {
    const wechatAuthService = {
      code2Session: jest.fn().mockResolvedValue({ openid: 'same-openid', sessionKey: 'session-1' })
    };
    const app = createApp(createRouter({ userService, wechatAuthService }));

    const first = await request(app).post('/api/wechat/login').send({ code: 'code-1' }).expect(200);
    wechatAuthService.code2Session.mockResolvedValueOnce({ openid: 'same-openid', sessionKey: 'session-2' });
    const second = await request(app).post('/api/wechat/login').send({ code: 'code-2' }).expect(200);

    expect(second.body.user.userId).toBe(first.body.user.userId);
    expect(userService.data.users).toHaveLength(1);
  });

  test('normalizes missing code errors', async () => {
    const wechatAuthService = {
      code2Session: jest.fn(async () => {
        const error = new Error('code 为必填字段');
        error.code = 'WECHAT_CODE_REQUIRED';
        error.status = 400;
        throw error;
      })
    };
    const app = createApp(createRouter({ userService, wechatAuthService }));

    const res = await request(app).post('/api/wechat/login').send({}).expect(400);
    expect(res.body).toEqual({ error: { code: 'WECHAT_CODE_REQUIRED', message: 'code 为必填字段' } });
  });
});
