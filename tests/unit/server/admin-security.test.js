import { jest } from '@jest/globals';
import { createRequire } from 'module';
import express from 'express';
import fs from 'fs';

const require = createRequire(import.meta.url);
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = global.TextEncoder || TextEncoder;
global.TextDecoder = global.TextDecoder || TextDecoder;
const request = require('supertest');

function basic(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

describe('admin security boundaries', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('shared admin auth rejects missing production password instead of using a default', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ADMIN_PASSWORD;
    process.env.ADMIN_USERNAME = 'admin';
    jest.resetModules();

    const { requireAdminAuth } = require('../../../server/middleware/adminSecurity.js');
    const app = express();
    app.get('/admin-only', requireAdminAuth, (req, res) => res.json({ ok: true }));

    const res = await request(app)
      .get('/admin-only')
      .set('Authorization', basic('admin', 'xiake2024'))
      .expect(503);

    expect(res.body.error.code).toBe('ADMIN_AUTH_NOT_CONFIGURED');
  });

  test('shared admin auth validates username and password', async () => {
    process.env.NODE_ENV = 'test';
    process.env.ADMIN_USERNAME = 'admin';
    process.env.ADMIN_PASSWORD = 'unit-secret';
    jest.resetModules();

    const { requireAdminAuth } = require('../../../server/middleware/adminSecurity.js');
    const app = express();
    app.get('/admin-only', requireAdminAuth, (req, res) => res.json({ ok: true }));

    await request(app)
      .get('/admin-only')
      .set('Authorization', basic('anything', 'unit-secret'))
      .expect(401);

    await request(app)
      .get('/admin-only')
      .set('Authorization', basic('admin', 'unit-secret'))
      .expect(200);
  });

  test('admin mutation guard rejects cross-site browser posts', async () => {
    process.env.NODE_ENV = 'test';
    process.env.ADMIN_USERNAME = 'admin';
    process.env.ADMIN_PASSWORD = 'unit-secret';
    jest.resetModules();

    const { requireAdminAuth, requireAdminRequestIntegrity } = require('../../../server/middleware/adminSecurity.js');
    const app = express();
    app.post('/restart', requireAdminAuth, requireAdminRequestIntegrity, (req, res) => res.json({ ok: true }));

    await request(app)
      .post('/restart')
      .set('Host', 'xiake.example')
      .set('Origin', 'https://evil.example')
      .set('Authorization', basic('admin', 'unit-secret'))
      .expect(403);

    await request(app)
      .post('/restart')
      .set('Host', 'xiake.example')
      .set('Origin', 'http://xiake.example')
      .set('Authorization', basic('admin', 'unit-secret'))
      .expect(200);
  });

  test('server mounts admin static assets behind admin auth before public static', () => {
    const source = fs.readFileSync('server/index.js', 'utf8');
    const adminStaticIdx = source.indexOf("app.use('/admin', requireAdminAuth, express.static(path.join(__dirname, '../public/admin')");
    const publicStaticIdx = source.indexOf("app.use(express.static(path.join(__dirname, '../public')");

    expect(adminStaticIdx).toBeGreaterThan(-1);
    expect(publicStaticIdx).toBeGreaterThan(-1);
    expect(adminStaticIdx).toBeLessThan(publicStaticIdx);
  });

  test('/admin/quota requires admin auth', async () => {
    process.env.NODE_ENV = 'test';
    process.env.ADMIN_USERNAME = 'admin';
    process.env.ADMIN_PASSWORD = 'unit-secret';
    jest.resetModules();

    const adminRoutes = require('../../../server/routes/admin.js');
    const app = express();
    app.use('/', adminRoutes);

    await request(app).get('/admin/quota').expect(401);
    await request(app)
      .get('/admin/quota')
      .set('Authorization', basic('admin', 'unit-secret'))
      .expect(200);
  });
});
