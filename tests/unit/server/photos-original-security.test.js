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

describe('photo original file access', () => {
  let tempDir;
  let token;
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

    app = express();
    app.use('/api/photos', createRouter({ userService }));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.XIAKE_DIR;
    delete process.env.PHOTO_UPLOAD_DAILY_IP_LIMIT;
  });

  test('does not expose original photo files to anonymous visitors', async () => {
    const PhotoService = require('../../../server/services/PhotoService.js');
    const photo = await PhotoService.savePhoto({
      buffer: makeJpegBuffer(),
      mimeType: 'image/jpeg',
      filename: 'sunset.jpg',
      clientIp: '127.0.0.1'
    });

    await request(app)
      .get(`/api/photos/${photo.id}/original`)
      .expect(401);

    await request(app)
      .get(`/api/photos/${photo.id}/original`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
