import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { TextEncoder, TextDecoder } from 'node:util';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let request;
beforeAll(async () => {
  if (!global.TextEncoder) {
    global.TextEncoder = TextEncoder;
  }
  if (!global.TextDecoder) {
    global.TextDecoder = TextDecoder;
  }

  const supertest = await import('supertest');
  request = supertest.default || supertest;
});

const ApiTokenService = require('../../../server/services/ApiTokenService');
const createAgentAuth = require('../../../server/middleware/agentAuth');

let app;
let tokenService;
let tmpDir;
let token;

function buildApp() {
  app = express();
  app.use(express.json());

  app.get('/agent/ping', createAgentAuth({ apiTokenService: tokenService }), (req, res) => {
    res.json({ ok: true, token: req.agentToken });
  });

  app.get('/agent/read', createAgentAuth({
    apiTokenService: tokenService,
    requiredScopes: ['agent:read']
  }), (req, res) => {
    res.json({ ok: true, scope: 'agent:read', token: req.agentToken });
  });

  app.get('/agent/write', createAgentAuth({
    apiTokenService: tokenService,
    requiredScopes: ['agent:write']
  }), (req, res) => {
    res.json({ ok: true, scope: 'agent:write', token: req.agentToken });
  });
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xiake-agent-auth-'));
  process.env.NODE_ENV = 'test';

  tokenService = new ApiTokenService({
    tokenFile: path.join(tmpDir, 'api-tokens.json'),
    secret: 'agent-auth-secret'
  });

  token = tokenService.createToken({
    name: 'middleware-token',
    scopes: ['agent:read'],
    minuteLimit: 1,
    dailyLimit: 2,
  });

  buildApp();
});

afterEach(() => {
  if (tmpDir) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = undefined;
  }
  delete process.env.NODE_ENV;
});

describe('Agent Token Auth Middleware', () => {
  test('无 token 返回 401 UNAUTHORIZED', async () => {
    const res = await request(app).get('/agent/ping').expect(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('X-Xiake-Token 兼容 header 可以鉴权', async () => {
    const res = await request(app)
      .get('/agent/ping')
      .set('X-Xiake-Token', token.token)
      .expect(200);

    expect(res.body).toMatchObject({ ok: true });
  });

  test('Authorization Bearer 通过可鉴权并挂载 token 上下文', async () => {
    const res = await request(app)
      .get('/agent/ping')
      .set('Authorization', `Bearer ${token.token}`)
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.token).toMatchObject({
      id: token.tokenMeta.id,
      name: 'middleware-token',
      scopes: ['agent:read'],
      enabled: true,
    });
    expect(typeof res.body.token.usageCount).toBe('number');
    expect(res.body.token.lastUsedAt).toBeTruthy();

    const after = tokenService.getTokenById(token.tokenMeta.id);
    expect(after.usageCount).toBe(1);
    expect(after.lastUsedAt).toBeTruthy();
  });

  test('格式错误、不存在、hash 不匹配都返回 401', async () => {
    const badFormat = await request(app).get('/agent/ping').set('Authorization', 'Bearer abc').expect(401);
    expect(badFormat.body.error.code).toBe('UNAUTHORIZED');

    const wrongPrefix = await request(app).get('/agent/ping').set('Authorization', 'Bearer badprefix_test_1234567890').expect(401);
    expect(wrongPrefix.body.error.code).toBe('UNAUTHORIZED');

    const notFound = await request(app).get('/agent/ping').set('Authorization', 'Bearer xiake_test_not-exist-token').expect(401);
    expect(notFound.body.error.code).toBe('UNAUTHORIZED');
  });

  test('disabled token 返回 403 TOKEN_DISABLED', async () => {
    const disabled = tokenService.createToken({ name: 'disabled', enabled: false, scopes: ['agent:read'] });

    const res = await request(app)
      .get('/agent/read')
      .set('Authorization', `Bearer ${disabled.token}`)
      .expect(403);

    expect(res.body.error.code).toBe('TOKEN_DISABLED');
  });

  test('scope 不足返回 403 SCOPE_DENIED', async () => {
    const res = await request(app)
      .get('/agent/write')
      .set('Authorization', `Bearer ${token.token}`)
      .expect(403);

    expect(res.body.error.code).toBe('SCOPE_DENIED');
  });

  test('分钟额度超限返回 429 RATE_LIMITED', async () => {
    await request(app)
      .get('/agent/ping')
      .set('Authorization', `Bearer ${token.token}`)
      .expect(200);

    const res = await request(app)
      .get('/agent/ping')
      .set('Authorization', `Bearer ${token.token}`)
      .expect(429);

    expect(res.body.error.code).toBe('RATE_LIMITED');
  });
});
