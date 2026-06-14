import { jest } from '@jest/globals';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import { TextEncoder, TextDecoder } from 'node:util';

if (!global.TextEncoder) global.TextEncoder = TextEncoder;
if (!global.TextDecoder) global.TextDecoder = TextDecoder;

const require = createRequire(import.meta.url);
const request = require('supertest');

function makeAdminHeader(password = 'xiake2024') {
  return `Basic ${Buffer.from(`admin:${password}`).toString('base64')}`;
}

function createApp() {
  const { requireAdminAuth, requireAdminRequestIntegrity } = require('../../../server/middleware/adminSecurity');
  const adminUsersRoutes = require('../../../server/routes/admin-users');
  const app = express();
  app.use(express.json());
  app.use('/api/admin/users', requireAdminAuth, requireAdminRequestIntegrity, adminUsersRoutes);
  return app;
}

describe('admin user management routes', () => {
  let tmpDir;
  let app;
  let userService;
  let user;
  let token;

  beforeEach(() => {
    jest.resetModules();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xiake-admin-users-'));
    process.env.NODE_ENV = 'test';
    process.env.ADMIN_USERNAME = 'admin';
    process.env.ADMIN_PASSWORD = 'xiake2024';
    process.env.XIAKE_DATA_DIR = tmpDir;
    process.env.XIAKE_DIR = tmpDir;
    process.env.USER_DATA_FILE = path.join(tmpDir, 'users.json');
    process.env.USER_SESSION_SECRET = 'admin-users-secret';
    process.env.API_APPLICATION_STORAGE_PATH = path.join(tmpDir, 'api-applications.json');
    process.env.ANALYTICS_EVENTS_FILE = path.join(tmpDir, 'analytics-events.json');

    const UserService = require('../../../server/services/UserService');
    userService = new UserService({
      dataFile: process.env.USER_DATA_FILE,
      sessionSecret: process.env.USER_SESSION_SECRET
    });
    user = userService.registerEmailUser({
      email: 'owner@example.com',
      password: 'secret123',
      recoveryQuestion: 'City?',
      recoveryAnswer: 'Beijing'
    });
    token = userService.issueToken(user);
    userService.addFavorite(user.userId, { id: 'beijing', name: 'Beijing', lat: 39.9, lon: 116.4 });
    userService.addRecentLocation(user.userId, { id: 'tokyo', name: 'Tokyo', lat: 35.6, lon: 139.7 });

    app = createApp();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD;
    delete process.env.XIAKE_DATA_DIR;
    delete process.env.XIAKE_DIR;
    delete process.env.USER_DATA_FILE;
    delete process.env.USER_SESSION_SECRET;
    delete process.env.API_APPLICATION_STORAGE_PATH;
    delete process.env.ANALYTICS_EVENTS_FILE;
  });

  test('lists users with safe account summary fields', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', makeAdminHeader())
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.users).toHaveLength(1);
    expect(res.body.users[0]).toMatchObject({
      userId: user.userId,
      email: 'owner@example.com',
      disabled: false,
      identityProviders: ['email'],
      favoritesCount: 1,
      recentLocationsCount: 1,
      activeSessionsCount: 1
    });
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(JSON.stringify(res.body)).not.toContain('recoveryAnswerHash');
    expect(JSON.stringify(res.body)).not.toContain('tokenHash');
  });

  test('returns user detail and supports disabling, enabling, revoking sessions, and deleting', async () => {
    const detail = await request(app)
      .get(`/api/admin/users/${user.userId}`)
      .set('Authorization', makeAdminHeader())
      .expect(200);

    expect(detail.body.user).toMatchObject({
      userId: user.userId,
      email: 'owner@example.com',
      favoritesCount: 1,
      recentLocationsCount: 1,
      sessionsCount: 1
    });

    const disabled = await request(app)
      .patch(`/api/admin/users/${user.userId}`)
      .set('Authorization', makeAdminHeader())
      .send({ disabled: true, adminNote: 'abuse review' })
      .expect(200);
    expect(disabled.body.user).toMatchObject({ disabled: true, adminNote: 'abuse review' });
    expect(new userService.constructor({
      dataFile: process.env.USER_DATA_FILE,
      sessionSecret: process.env.USER_SESSION_SECRET
    }).verifyToken(token)).toBeNull();

    const enabled = await request(app)
      .patch(`/api/admin/users/${user.userId}`)
      .set('Authorization', makeAdminHeader())
      .send({ disabled: false })
      .expect(200);
    expect(enabled.body.user.disabled).toBe(false);

    const revoke = await request(app)
      .post(`/api/admin/users/${user.userId}/revoke-sessions`)
      .set('Authorization', makeAdminHeader())
      .expect(200);
    expect(revoke.body.revokedCount).toBeGreaterThanOrEqual(0);

    const deleted = await request(app)
      .delete(`/api/admin/users/${user.userId}`)
      .set('Authorization', makeAdminHeader())
      .expect(200);
    expect(deleted.body).toMatchObject({ success: true, deleted: true });

    await request(app)
      .get(`/api/admin/users/${user.userId}`)
      .set('Authorization', makeAdminHeader())
      .expect(404);
  });
});
