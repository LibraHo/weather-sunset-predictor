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
  if (!global.setImmediate) global.setImmediate = (fn, ...args) => setTimeout(fn, 0, ...args);
  const supertest = await import('supertest');
  request = supertest.default || supertest;
});

function makeJpegBuffer(sizeBytes = 256) {
  const buf = Buffer.alloc(sizeBytes);
  buf[0] = 0xff;
  buf[1] = 0xd8;
  return buf;
}

function createApp(router) {
  const app = express();
  app.use('/api/photos', router);
  return app;
}

describe('photos routes', () => {
  let tempDir;
  let userService;
  let token;
  let app;

  beforeEach(() => {
    jest.resetModules();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xiake-photo-routes-'));
    process.env.XIAKE_DIR = tempDir;
    process.env.PHOTO_UPLOAD_DAILY_IP_LIMIT = '10';

    const UserService = require('../../../server/services/UserService.js');
    const createRouter = require('../../../server/routes/photos.js').createRouter;
    userService = new UserService({
      dataFile: path.join(tempDir, 'users.json'),
      sessionSecret: 'test-secret'
    });
    const user = userService.upsertWechatUser({ openid: 'openid-photo', sessionKey: 'session-photo' });
    token = userService.issueToken(user);
    app = createApp(createRouter({ userService }));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.XIAKE_DIR;
    delete process.env.PHOTO_UPLOAD_DAILY_IP_LIMIT;
  });

  test('lists public photos without internal upload limit fields', async () => {
    const PhotoService = require('../../../server/services/PhotoService.js');
    await PhotoService.savePhoto({
      buffer: makeJpegBuffer(),
      mimeType: 'image/jpeg',
      filename: 'sunset.jpg',
      lat: 39.9,
      lon: 116.4,
      locationName: '景山',
      uploaderName: 'Alex',
      clientIp: '127.0.0.1'
    });

    const res = await request(app).get('/api/photos').expect(200);
    expect(res.body.photos).toHaveLength(1);
    expect(res.body.photos[0]).toMatchObject({
      lat: 39.9,
      lon: 116.4,
      locationName: '景山',
      uploaderName: 'Alex'
    });
    expect(res.body.photos[0].uploadIpHash).toBeUndefined();
    expect(res.body.photos[0].uploadDay).toBeUndefined();
  });

  test('requires login token for mini program upload', async () => {
    const res = await request(app)
      .post('/api/photos/upload')
      .attach('photo', makeJpegBuffer(), { filename: 'sunset.jpg', contentType: 'image/jpeg' })
      .expect(401);

    expect(res.body).toEqual({ error: { code: 'UNAUTHORIZED', message: '请先登录' } });
  });

  test('uploads a photo with metadata for the logged in user', async () => {
    const res = await request(app)
      .post('/api/photos/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('locationName', '颐和园')
      .field('uploaderName', 'Alex')
      .field('takenAt', '2026-05-11T10:00:00.000Z')
      .field('lat', '39.999617')
      .field('lon', '116.275179')
      .field('desc', '湖边晚霞')
      .attach('photo', makeJpegBuffer(), { filename: 'summer-palace.jpg', contentType: 'image/jpeg' })
      .expect(201);

    expect(res.body.photo).toMatchObject({
      locationName: '颐和园',
      uploaderName: 'Alex',
      uploaderUserId: userService.verifyToken(token).userId,
      takenAt: '2026-05-11T10:00:00.000Z',
      lat: 39.999617,
      lon: 116.275179,
      desc: '湖边晚霞'
    });
  });

  test('rejects upload without a photo file', async () => {
    const res = await request(app)
      .post('/api/photos/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('locationName', '景山')
      .expect(400);

    expect(res.body).toEqual({ error: { code: 'PHOTO_REQUIRED', message: '请选择要上传的照片' } });
  });
});
