import { jest } from '@jest/globals';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import { TextEncoder, TextDecoder } from 'node:util';

const require = createRequire(import.meta.url);

if (!global.TextEncoder) global.TextEncoder = TextEncoder;
if (!global.TextDecoder) global.TextDecoder = TextDecoder;
const request = require('supertest');

function makeJpegBuffer(sizeBytes = 256) {
  const buf = Buffer.alloc(sizeBytes);
  buf[0] = 0xff;
  buf[1] = 0xd8;
  return buf;
}

function makePngBuffer() {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
    'base64'
  );
}

describe('photo original file access', () => {
  let tempDir;
  let token;
  let secondToken;
  let app;

  beforeEach(() => {
    jest.resetModules();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xiake-photo-original-'));
    process.env.XIAKE_DIR = tempDir;
    process.env.PHOTO_UPLOAD_DAILY_IP_LIMIT = '10';

    const UserService = require('../../../server/services/UserService.js');
    const createRouter = require('../../../server/routes/photos.js').createRouter;
    const userService = new UserService({
      dataFile: path.join(tempDir, 'users.json'),
      sessionSecret: 'test-secret'
    });
    const user = userService.upsertWechatUser({ openid: 'openid-photo', sessionKey: 'session-photo' });
    token = userService.issueToken(user);
    const secondUser = userService.upsertWechatUser({ openid: 'openid-second-photo', sessionKey: 'session-second-photo' });
    secondToken = userService.issueToken(secondUser);

    app = express();
    app.use('/api/photos', createRouter({ userService }));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.XIAKE_DIR;
    delete process.env.PHOTO_UPLOAD_DAILY_IP_LIMIT;
  });

  test('does not expose original photo files because originals are not retained', async () => {
    const PhotoService = require('../../../server/services/PhotoService.js');
    const photo = await PhotoService.savePhoto({
      buffer: makeJpegBuffer(),
      mimeType: 'image/jpeg',
      filename: 'sunset.jpg',
      clientIp: '127.0.0.1'
    });

    await request(app)
      .get(`/api/photos/${photo.id}/original`)
      .expect(404);

    await request(app)
      .get(`/api/photos/${photo.id}/original`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    expect(photo.origFile).toBeNull();
    expect(fs.readdirSync(PhotoService.ORIGINALS_DIR)).toEqual([]);
  });

  test('does not expose pending thumbnails to anonymous visitors or other users', async () => {
    const PhotoService = require('../../../server/services/PhotoService.js');
    const userId = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).sub;
    const photo = await PhotoService.savePhoto({
      buffer: makePngBuffer(),
      mimeType: 'image/png',
      filename: 'pending.png',
      clientIp: '127.0.0.1',
      uploaderUserId: userId,
      reviewStatus: 'pending'
    });

    await request(app)
      .get(`/api/photos/${photo.id}/thumb`)
      .expect(404);

    await request(app)
      .get(`/api/photos/${photo.id}/thumb`)
      .set('Authorization', `Bearer ${secondToken}`)
      .expect(404);

    await request(app)
      .get(`/api/photos/${photo.id}/thumb`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
