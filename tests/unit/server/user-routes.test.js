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
  app.use('/api/user', router);
  return app;
}

describe('user routes', () => {
  let tempDir;
  let userService;
  let app;
  let token;

  beforeEach(() => {
    jest.resetModules();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xiake-user-routes-'));
    const UserService = require('../../../server/services/UserService.js');
    const createRouter = require('../../../server/routes/user.js').createRouter;
    userService = new UserService({
      dataFile: path.join(tempDir, 'users.json'),
      sessionSecret: 'test-secret'
    });
    const user = userService.upsertWechatUser({ openid: 'openid-user', sessionKey: 'session-user' });
    token = userService.issueToken(user);
    app = createApp(createRouter({ userService }));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('requires valid bearer token', async () => {
    const missing = await request(app).get('/api/user/favorites').expect(401);
    expect(missing.body).toEqual({ error: { code: 'UNAUTHORIZED', message: '请先登录' } });

    const malformed = await request(app)
      .get('/api/user/favorites')
      .set('Authorization', 'Bearer not-a-token')
      .expect(401);
    expect(malformed.body).toEqual({ error: { code: 'UNAUTHORIZED', message: '请先登录' } });
  });

  test('creates, lists and deletes favorites', async () => {
    const location = { id: 'bj-jingshan', name: '景山公园', lat: 39.925, lon: 116.396, countryCode: 'CN' };

    const created = await request(app)
      .post('/api/user/favorites')
      .set('Authorization', `Bearer ${token}`)
      .send({ location })
      .expect(201);

    expect(created.body.favorite).toMatchObject(location);

    const list = await request(app)
      .get('/api/user/favorites')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(list.body.favorites).toHaveLength(1);
    expect(list.body.favorites[0]).toMatchObject(location);

    await request(app)
      .delete('/api/user/favorites/bj-jingshan')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const afterDelete = await request(app)
      .get('/api/user/favorites')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(afterDelete.body.favorites).toEqual([]);
  });

  test('accepts web session cookie for favorites without bearer token', async () => {
    const location = { id: 'cookie-oslo', name: 'Oslo', lat: 59.9139, lon: 10.7522, countryCode: 'NO' };

    await request(app)
      .post('/api/user/favorites')
      .set('Cookie', `xiake_session=${token}`)
      .send({ location })
      .expect(201);

    const list = await request(app)
      .get('/api/user/favorites')
      .set('Cookie', `xiake_session=${token}`)
      .expect(200);
    expect(list.body.favorites[0]).toMatchObject(location);
  });

  test('creates and lists recent locations with newest first', async () => {
    await request(app)
      .post('/api/user/recent-locations')
      .set('Authorization', `Bearer ${token}`)
      .send({ location: { id: 'tokyo', name: 'Tokyo', lat: 35.6762, lon: 139.6503, countryCode: 'JP' } })
      .expect(201);

    await request(app)
      .post('/api/user/recent-locations')
      .set('Authorization', `Bearer ${token}`)
      .send({ location: { id: 'paris', name: 'Paris', lat: 48.8566, lon: 2.3522, countryCode: 'FR' } })
      .expect(201);

    const res = await request(app)
      .get('/api/user/recent-locations')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.recentLocations.map(item => item.id)).toEqual(['paris', 'tokyo']);
  });

  test('rejects invalid location payloads with unified error', async () => {
    const res = await request(app)
      .post('/api/user/favorites')
      .set('Authorization', `Bearer ${token}`)
      .send({ location: { name: 'No coords' } })
      .expect(400);

    expect(res.body).toEqual({
      error: {
        code: 'INVALID_LOCATION',
        message: 'location.name、location.lat、location.lon 为必填字段'
      }
    });
  });
});
