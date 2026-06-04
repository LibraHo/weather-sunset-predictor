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

  test('registers email users with hashed password and recovery answer', () => {
    const service = makeService();

    const user = service.registerEmailUser({
      email: '  Alex@Example.COM ',
      password: 'correct horse battery staple',
      recoveryQuestion: 'First sunset spot?',
      recoveryAnswer: 'Jingshan Park'
    });

    expect(user.email).toBe('alex@example.com');
    expect(user.passwordHash).toBeUndefined();
    expect(user.recoveryAnswerHash).toBeUndefined();
    expect(service.verifyPasswordLogin('alex@example.com', 'correct horse battery staple').userId).toBe(user.userId);

    const stored = service.findByIdentity('email', 'alex@example.com');
    const emailIdentity = stored.identities.find(identity => identity.provider === 'email');
    expect(emailIdentity).toMatchObject({
      provider: 'email',
      subject: 'alex@example.com',
      email: 'alex@example.com',
      recoveryQuestion: 'First sunset spot?'
    });
    expect(emailIdentity.passwordHash).toEqual(expect.any(String));
    expect(emailIdentity.recoveryAnswerHash).toEqual(expect.any(String));
    expect(emailIdentity.passwordHash).not.toContain('correct horse battery staple');
    expect(emailIdentity.recoveryAnswerHash).not.toContain('Jingshan Park');

    const saved = fs.readFileSync(dataFile, 'utf8');
    expect(saved).not.toContain('correct horse battery staple');
    expect(saved).not.toContain('Jingshan Park');
  });

  test('rejects duplicate email registration and invalid password login', () => {
    const service = makeService();
    service.registerEmailUser({
      email: 'alex@example.com',
      password: 'correct horse battery staple',
      recoveryQuestion: 'Question?',
      recoveryAnswer: 'Answer'
    });

    expect(() => service.registerEmailUser({
      email: 'ALEX@example.com',
      password: 'another password',
      recoveryQuestion: 'Question?',
      recoveryAnswer: 'Answer'
    })).toThrow(/already registered/i);

    expect(service.verifyPasswordLogin('alex@example.com', 'wrong password')).toBeNull();
  });

  test('returns recovery question and resets password with hashed answer', () => {
    const service = makeService();
    const user = service.registerEmailUser({
      email: 'alex@example.com',
      password: 'old password',
      recoveryQuestion: 'Favorite horizon?',
      recoveryAnswer: 'West lake'
    });

    expect(service.getRecoveryQuestion('alex@example.com')).toEqual({ recoveryQuestion: 'Favorite horizon?' });
    expect(service.resetPasswordWithRecovery({
      email: 'alex@example.com',
      recoveryAnswer: 'wrong answer',
      newPassword: 'new password'
    })).toBe(false);

    expect(service.resetPasswordWithRecovery({
      email: 'alex@example.com',
      recoveryAnswer: 'West lake',
      newPassword: 'new password'
    })).toBe(true);

    expect(service.verifyPasswordLogin('alex@example.com', 'old password')).toBeNull();
    expect(service.verifyPasswordLogin('alex@example.com', 'new password').userId).toBe(user.userId);

    const saved = fs.readFileSync(dataFile, 'utf8');
    expect(saved).not.toContain('new password');
    expect(saved).not.toContain('West lake');
  });

  test('can add password credentials to an existing google account without removing google identity', () => {
    const service = makeService();
    const googleUser = service.upsertGoogleUser({
      sub: 'google-sub-1',
      email: 'alex@example.com'
    });

    const linked = service.setPasswordForUser(googleUser.userId, {
      email: 'alex@example.com',
      password: 'manual password',
      recoveryQuestion: 'Question?',
      recoveryAnswer: 'Answer'
    });

    expect(linked.userId).toBe(googleUser.userId);
    expect(service.verifyPasswordLogin('alex@example.com', 'manual password').userId).toBe(googleUser.userId);
    expect(service.findByIdentity('google', 'google-sub-1').userId).toBe(googleUser.userId);
    expect(service.findByIdentity('email', 'alex@example.com').userId).toBe(googleUser.userId);
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
