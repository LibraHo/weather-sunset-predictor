import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = global.TextEncoder || TextEncoder;
global.TextDecoder = global.TextDecoder || TextDecoder;

const express = require('express');
const request = require('supertest');
const { requireAdminAuth, ADMIN_REALM } = require('../../../server/utils/adminAuth');

function basicHeader(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

describe('admin Basic Auth username guard', () => {
  const oldUsername = process.env.ADMIN_USERNAME;
  const oldPassword = process.env.ADMIN_PASSWORD;

  beforeEach(() => {
    process.env.ADMIN_USERNAME = 'admin';
    process.env.ADMIN_PASSWORD = 'xiake2024';
  });

  afterAll(() => {
    if (oldUsername === undefined) delete process.env.ADMIN_USERNAME;
    else process.env.ADMIN_USERNAME = oldUsername;

    if (oldPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = oldPassword;
  });

  function buildApp() {
    const app = express();
    app.get('/admin', requireAdminAuth, (req, res) => res.json({ ok: true }));
    return app;
  }

  test('rejects stale mobile/browser credentials that reuse the right password with the wrong username', async () => {
    await request(buildApp())
      .get('/admin')
      .set('Authorization', basicHeader('老板', 'xiake2024'))
      .expect(401)
      .expect('WWW-Authenticate', `Basic realm="${ADMIN_REALM}"`);
  });

  test('accepts only the configured admin username and password pair', async () => {
    await request(buildApp())
      .get('/admin')
      .set('Authorization', basicHeader('admin', 'xiake2024'))
      .expect(200, { ok: true });
  });
});
