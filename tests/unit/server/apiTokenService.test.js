import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ApiTokenService = require('../../../server/services/ApiTokenService');

let tmpDir;
let service;
let tokenFile;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xiake-token-'));
  tokenFile = path.join(tmpDir, 'api-tokens.json');
  process.env.NODE_ENV = 'test';
  service = new ApiTokenService({
    tokenFile,
    secret: 'test-secret'
  });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.NODE_ENV;
});

describe('ApiTokenService.createToken', () => {
  test('生产环境缺少 SERVER_TOKEN_SECRET 时应阻止创建 token', () => {
    process.env.NODE_ENV = 'production';
    const badService = new ApiTokenService({
      tokenFile: path.join(tmpDir, 'prod-token-fail.json'),
      secret: undefined
    });

    expect(() => badService.createToken({ name: 'bad-prod' })).toThrow('SERVER_TOKEN_SECRET missing in production');
  });

  test('创建 token 后仅返回一次明文，并且列表/读取不返回明文', () => {
    const created = service.createToken({
      name: 'ci-agent',
      scopes: ['agent:read', 'agent:write'],
      minuteLimit: 30,
      dailyLimit: 100
    });

    expect(created).toMatchObject({
      token: expect.stringMatching(/^xiake_test_/),
      tokenMeta: expect.objectContaining({
        id: expect.any(String),
        name: 'ci-agent',
        scopes: ['agent:read', 'agent:write'],
        enabled: true,
        minuteLimit: 30,
        dailyLimit: 100,
        usageCount: 0,
        lastUsedAt: null
      })
    });

    expect(created.tokenMeta).not.toHaveProperty('token');

    const list = service.listTokens();
    expect(list).toHaveLength(1);
    expect(list[0]).not.toHaveProperty('token');

    const read = service.getTokenById(created.tokenMeta.id);
    expect(read).not.toBeNull();
    expect(read).not.toHaveProperty('token');
  });

  test('服务端只持久化 tokenHash，不持久化明文', () => {
    const created = service.createToken({ name: 'store-only-hash' });

    const raw = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
    const stored = raw.tokens[0];

    expect(stored.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.tokenHash).toBe(service._hashToken(created.token, service.secret));
    expect(stored.token).toBeUndefined();
    expect(JSON.stringify(raw)).not.toContain(created.token);
    expect(stored).not.toHaveProperty('rawToken');
  });

  test('认证成功会更新 lastUsedAt 和 usageCount', () => {
    const created = service.createToken({ name: 'counter-check', dailyLimit: 3, minuteLimit: 3 });
    expect(service.authenticateToken(created.token, []).token.usageCount).toBe(1);

    const snapshot = service.getTokenById(created.tokenMeta.id);
    expect(snapshot.usageCount).toBe(1);
    expect(snapshot.lastUsedAt).toBeTruthy();
  });

  test('禁用 token 时认证返回 403', () => {
    const created = service.createToken({ name: 'disabled', enabled: false });
    const result = service.authenticateToken(created.token);
    expect(result).toEqual({ ok: false, code: 'TOKEN_DISABLED', status: 403, message: 'token disabled' });
  });

  test('scope 校验失败返回 SCOPE_DENIED', () => {
    const created = service.createToken({ name: 'scope', scopes: ['agent:read'] });
    const result = service.authenticateToken(created.token, ['agent:write']);
    expect(result).toEqual({
      ok: false,
      code: 'SCOPE_DENIED',
      status: 403,
      message: 'missing scope: agent:write'
    });
  });

  test('用量阈值不足会触发 RATE_LIMITED', () => {
    const created = service.createToken({
      name: 'quota',
      minuteLimit: 1,
      dailyLimit: 1
    });

    expect(service.authenticateToken(created.token, []).ok).toBe(true);
    expect(service.authenticateToken(created.token, []).code).toBe('RATE_LIMITED');
  });
});
