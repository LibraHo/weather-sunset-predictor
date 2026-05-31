import { jest } from '@jest/globals';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(import.meta.url);

describe('UserService auth foundation', () => {
  let tempDir;
  let dataFile;
  let originalEnv;
  let UserService;

  beforeEach(() => {
    jest.resetModules();
    originalEnv = {
      AUTH_SECRET: process.env.AUTH_SECRET,
      USER_SESSION_SECRET: process.env.USER_SESSION_SECRET,
      SERVER_TOKEN_SECRET: process.env.SERVER_TOKEN_SECRET
    };
    delete process.env.AUTH_SECRET;
    delete process.env.USER_SESSION_SECRET;
    delete process.env.SERVER_TOKEN_SECRET;
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xiake-user-auth-foundation-'));
    dataFile = path.join(tempDir, 'users.json');
    UserService = require('../../../server/services/UserService.js');
  });

  afterEach(() => {
    if (originalEnv.AUTH_SECRET === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = originalEnv.AUTH_SECRET;
    if (originalEnv.USER_SESSION_SECRET === undefined) delete process.env.USER_SESSION_SECRET;
    else process.env.USER_SESSION_SECRET = originalEnv.USER_SESSION_SECRET;
    if (originalEnv.SERVER_TOKEN_SECRET === undefined) delete process.env.SERVER_TOKEN_SECRET;
    else process.env.SERVER_TOKEN_SECRET = originalEnv.SERVER_TOKEN_SECRET;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function makeService(options = {}) {
    return new UserService({
      dataFile,
      sessionSecret: 'test-secret',
      ...options
    });
  }

  test('keeps provider and subject identities unique across repeated upserts', () => {
    const service = makeService();

    const first = service.upsertWechatUser({
      provider: 'wechat_miniprogram',
      openid: 'mini-openid',
      sessionKey: 'session-1'
    });
    const second = service.upsertWechatUser({
      provider: 'wechat_miniprogram',
      openid: 'mini-openid',
      sessionKey: 'session-2'
    });

    expect(second.userId).toBe(first.userId);
    expect(service.data.users).toHaveLength(1);
    expect(service.data.userIdentities).toHaveLength(1);
    expect(service.data.userIdentities[0]).toMatchObject({
      userId: first.userId,
      provider: 'wechat_miniprogram',
      subject: 'mini-openid',
      sessionKey: 'session-2'
    });
  });

  test('merges wechat web and miniprogram users through unionid', () => {
    const service = makeService();

    const webUser = service.upsertWechatUser({
      provider: 'wechat_web',
      openid: 'web-openid',
      unionid: 'union-1'
    });
    const miniUser = service.upsertWechatUser({
      provider: 'wechat_miniprogram',
      openid: 'mini-openid',
      sessionKey: 'mini-session',
      unionid: 'union-1'
    });

    expect(miniUser.userId).toBe(webUser.userId);
    expect(service.data.users).toHaveLength(1);
    expect(service.findByIdentity('wechat_web', 'web-openid').userId).toBe(webUser.userId);
    expect(service.findByIdentity('wechat_miniprogram', 'mini-openid').userId).toBe(webUser.userId);
    expect(service.data.userIdentities.map(identity => identity.provider).sort()).toEqual([
      'wechat_miniprogram',
      'wechat_web'
    ]);
  });

  test('rejects conflicting unionid changes for an existing wechat subject', () => {
    const service = makeService();
    service.upsertWechatUser({
      provider: 'wechat_miniprogram',
      openid: 'same-openid',
      unionid: 'union-a'
    });

    expect(() => service.upsertWechatUser({
      provider: 'wechat_miniprogram',
      openid: 'same-openid',
      unionid: 'union-b'
    })).toThrow(/identity conflict/i);
  });

  test('upserts google users by sub without merging unrelated providers', () => {
    const service = makeService();

    const googleUser = service.upsertGoogleUser({
      sub: 'google-sub-1',
      email: 'alex@example.com',
      name: 'Alex'
    });
    const sameGoogleUser = service.upsertGoogleUser({
      sub: 'google-sub-1',
      email: 'alex.new@example.com'
    });
    const wechatUser = service.upsertWechatUser({
      provider: 'wechat_miniprogram',
      openid: 'mini-openid'
    });

    expect(sameGoogleUser.userId).toBe(googleUser.userId);
    expect(wechatUser.userId).not.toBe(googleUser.userId);
    expect(service.data.users).toHaveLength(2);
    expect(service.findByIdentity('google', 'google-sub-1').identities[0]).toMatchObject({
      provider: 'google',
      subject: 'google-sub-1',
      email: 'alex.new@example.com'
    });
  });

  test('issues verifiable sessions with AUTH_SECRET ahead of USER_SESSION_SECRET', () => {
    process.env.AUTH_SECRET = 'auth-secret';
    process.env.USER_SESSION_SECRET = 'user-session-secret';
    const service = new UserService({ dataFile });
    const user = service.upsertWechatUser({ provider: 'wechat_miniprogram', openid: 'mini-openid' });

    const token = service.issueToken(user);
    const verified = service.verifyToken(token);
    expect(verified.userId).toBe(user.userId);
    expect(service.data.sessions).toHaveLength(1);
    expect(service.lookupSession(service.data.sessions[0].sessionId).userId).toBe(user.userId);

    delete process.env.AUTH_SECRET;
    const wrongSecretService = new UserService({ dataFile });
    expect(wrongSecretService.verifyToken(token)).toBeNull();

    process.env.AUTH_SECRET = 'auth-secret';
    const reloadedService = new UserService({ dataFile });
    expect(reloadedService.verifyToken(token).userId).toBe(user.userId);
    expect(reloadedService.revokeSession(reloadedService.data.sessions[0].sessionId)).toBe(true);
    expect(reloadedService.verifyToken(token)).toBeNull();
  });

  test('loads legacy provider=wechat identities and keeps favorites/recent locations working', () => {
    const service = makeService({
      initialData: {
        users: [{
          userId: 'legacy-user',
          identities: [{ provider: 'wechat', subject: 'legacy-openid', unionid: 'legacy-union' }],
          favorites: [],
          recentLocations: [],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z'
        }]
      }
    });

    const user = service.upsertWechatUser({
      provider: 'wechat_miniprogram',
      openid: 'legacy-openid',
      sessionKey: 'new-session',
      unionid: 'legacy-union'
    });
    const favorite = service.addFavorite(user.userId, { id: 'beijing', name: 'Beijing', lat: 39.9, lon: 116.4 });
    const recent = service.addRecentLocation(user.userId, { id: 'paris', name: 'Paris', lat: 48.8566, lon: 2.3522 });

    expect(user.userId).toBe('legacy-user');
    expect(service.findByIdentity('wechat', 'legacy-openid').userId).toBe('legacy-user');
    expect(service.findByIdentity('wechat_miniprogram', 'legacy-openid').userId).toBe('legacy-user');
    expect(service.getFavorites(user.userId)).toEqual([expect.objectContaining({ id: favorite.id })]);
    expect(service.getRecentLocations(user.userId)).toEqual([expect.objectContaining({ id: recent.id })]);
  });
});
