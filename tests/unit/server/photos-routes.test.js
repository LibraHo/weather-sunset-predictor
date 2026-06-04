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
  app.use(express.json());
  app.use('/api/photos', router);
  return app;
}

describe('photos routes', () => {
  let tempDir;
  let userService;
  let token;
  let secondToken;
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
    const secondUser = userService.upsertWechatUser({ openid: 'openid-photo-2', sessionKey: 'session-photo-2' });
    secondToken = userService.issueToken(secondUser);
    app = createApp(createRouter({ userService }));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.XIAKE_DIR;
    delete process.env.PHOTO_UPLOAD_DAILY_IP_LIMIT;
  });

  test('lists public photos without internal upload and owner identity fields', async () => {
    const PhotoService = require('../../../server/services/PhotoService.js');
    await PhotoService.savePhoto({
      buffer: makeJpegBuffer(),
      mimeType: 'image/jpeg',
      filename: 'sunset.jpg',
      lat: 39.9,
      lon: 116.4,
      locationName: 'Jingshan',
      uploaderName: 'Alex',
      uploaderUserId: 'user-private-1',
      clientIp: '127.0.0.1'
    });

    const res = await request(app).get('/api/photos').expect(200);
    expect(res.body.photos).toHaveLength(1);
    expect(res.body.photos[0]).toMatchObject({
      lat: 39.9,
      lon: 116.4,
      locationName: 'Jingshan',
      uploaderName: 'Alex'
    });
    expect(res.body.photos[0].uploadIpHash).toBeUndefined();
    expect(res.body.photos[0].uploadDay).toBeUndefined();
    expect(res.body.photos[0].uploaderUserId).toBeUndefined();
    expect(res.body.photos[0].origFile).toBeUndefined();
    expect(res.body.photos[0].originalUrl).toBeUndefined();
    expect(res.body.photos[0].userId).toBeUndefined();
    expect(res.body.photos[0].ownerUserId).toBeUndefined();
    expect(res.body.photos[0].identity).toBeUndefined();
    expect(res.body.photos[0].identities).toBeUndefined();
  });

  test('requires login token for mini program upload', async () => {
    const res = await request(app)
      .post('/api/photos/upload')
      .attach('photo', makeJpegBuffer(), { filename: 'sunset.jpg', contentType: 'image/jpeg' })
      .expect(401);

    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('uploads a photo with hidden response metadata while storage keeps logged in owner', async () => {
    const res = await request(app)
      .post('/api/photos/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('locationName', 'Summer Palace')
      .field('uploaderName', 'Alex')
      .field('takenAt', '2026-05-11T10:00:00.000Z')
      .field('lat', '39.999617')
      .field('lon', '116.275179')
      .field('desc', 'Lakeside sunset')
      .attach('photo', makeJpegBuffer(), { filename: 'summer-palace.jpg', contentType: 'image/jpeg' })
      .expect(201);

    expect(res.body.photo).toMatchObject({
      locationName: 'Summer Palace',
      uploaderName: 'Alex',
      takenAt: '2026-05-11T10:00:00.000Z',
      lat: 39.999617,
      lon: 116.275179,
      desc: 'Lakeside sunset'
    });
    expect(res.body.photo.uploaderUserId).toBeUndefined();
    expect(res.body.photo.uploadIpHash).toBeUndefined();
    expect(res.body.photo.uploadDay).toBeUndefined();

    const PhotoService = require('../../../server/services/PhotoService.js');
    const stored = PhotoService.getPhotoById(res.body.photo.id);
    expect(stored.uploaderUserId).toBe(userService.verifyToken(token).userId);
    expect(stored.origFile).toBeNull();
    expect(fs.readdirSync(PhotoService.ORIGINALS_DIR)).toEqual([]);
  });

  test('user uploads are pending until admin review approves them for the public list', async () => {
    const AdminRoutes = require('../../../server/routes/admin.js');
    process.env.ADMIN_PASSWORD = 'review-secret';
    const adminApp = express();
    adminApp.use(express.json());
    adminApp.use('/', AdminRoutes);
    const adminAuth = `Basic ${Buffer.from('admin:review-secret').toString('base64')}`;

    const upload = await request(app)
      .post('/api/photos/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('locationName', 'Pending Ridge')
      .attach('photo', makeJpegBuffer(), { filename: 'pending.jpg', contentType: 'image/jpeg' })
      .expect(201);

    expect(upload.body.photo.reviewStatus).toBe('pending');

    const publicBefore = await request(app).get('/api/photos').expect(200);
    expect(publicBefore.body.photos.map(photo => photo.id)).not.toContain(upload.body.photo.id);

    const adminList = await request(adminApp)
      .get('/admin/photos')
      .set('Authorization', adminAuth)
      .expect(200);
    expect(adminList.body.photos.find(photo => photo.id === upload.body.photo.id)).toMatchObject({
      reviewStatus: 'pending',
      locationName: 'Pending Ridge'
    });

    const reviewed = await request(adminApp)
      .post(`/photos/${upload.body.photo.id}/review`)
      .set('Authorization', adminAuth)
      .send({ reviewStatus: 'approved', reviewNote: 'ok' })
      .expect(200);
    expect(reviewed.body.photo).toMatchObject({
      reviewStatus: 'approved',
      reviewNote: 'ok'
    });

    const publicAfter = await request(app).get('/api/photos').expect(200);
    expect(publicAfter.body.photos.map(photo => photo.id)).toContain(upload.body.photo.id);
    delete process.env.ADMIN_PASSWORD;
  });

  test('users can manage only their own uploads and edits require re-review', async () => {
    const AdminRoutes = require('../../../server/routes/admin.js');
    process.env.ADMIN_PASSWORD = 'edit-review-secret';
    const adminApp = express();
    adminApp.use(express.json());
    adminApp.use('/', AdminRoutes);
    const adminAuth = `Basic ${Buffer.from('admin:edit-review-secret').toString('base64')}`;

    const firstUpload = await request(app)
      .post('/api/photos/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('locationName', 'Mine')
      .field('desc', 'Keep me')
      .field('lat', '39.9')
      .field('lon', '116.4')
      .attach('photo', makeJpegBuffer(), { filename: 'mine.jpg', contentType: 'image/jpeg' })
      .expect(201);

    await request(adminApp)
      .post(`/photos/${firstUpload.body.photo.id}/review`)
      .set('Authorization', adminAuth)
      .send({ reviewStatus: 'approved' })
      .expect(200);

    const publicBeforeEdit = await request(app).get('/api/photos').expect(200);
    expect(publicBeforeEdit.body.photos.find(photo => photo.id === firstUpload.body.photo.id)).toMatchObject({
      locationName: 'Mine',
      desc: 'Keep me',
      reviewStatus: 'approved'
    });

    const mine = await request(app)
      .get('/api/photos/mine')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(mine.body.photos.map(photo => photo.id)).toContain(firstUpload.body.photo.id);

    await request(app)
      .patch(`/api/photos/mine/${firstUpload.body.photo.id}`)
      .set('Authorization', `Bearer ${secondToken}`)
      .send({ locationName: 'Stolen' })
      .expect(404);

    const edited = await request(app)
      .patch(`/api/photos/mine/${firstUpload.body.photo.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ locationName: 'Edited Mine', reviewStatus: 'approved' })
      .expect(200);
    expect(edited.body.photo).toMatchObject({
      locationName: 'Mine',
      desc: 'Keep me',
      lat: 39.9,
      lon: 116.4,
      reviewStatus: 'approved',
      pendingEdit: {
        locationName: 'Edited Mine',
        reviewStatus: 'pending'
      }
    });

    const publicWhileEditPending = await request(app).get('/api/photos').expect(200);
    expect(publicWhileEditPending.body.photos.find(photo => photo.id === firstUpload.body.photo.id)).toMatchObject({
      locationName: 'Mine',
      desc: 'Keep me',
      reviewStatus: 'approved'
    });

    const mineWithPendingEdit = await request(app)
      .get('/api/photos/mine')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(mineWithPendingEdit.body.photos.find(photo => photo.id === firstUpload.body.photo.id)).toMatchObject({
      locationName: 'Mine',
      pendingEdit: {
        locationName: 'Edited Mine',
        reviewStatus: 'pending'
      }
    });

    await request(adminApp)
      .post(`/photos/${firstUpload.body.photo.id}/review`)
      .set('Authorization', adminAuth)
      .send({ reviewStatus: 'approved', reviewNote: 'edit ok' })
      .expect(200);

    const publicAfterEditApproval = await request(app).get('/api/photos').expect(200);
    expect(publicAfterEditApproval.body.photos.find(photo => photo.id === firstUpload.body.photo.id)).toMatchObject({
      locationName: 'Edited Mine',
      desc: 'Keep me',
      reviewStatus: 'approved'
    });

    await request(app)
      .get(`/api/photos/${firstUpload.body.photo.id}/original`)
      .set('Authorization', `Bearer ${secondToken}`)
      .expect(404);

    await request(app)
      .delete(`/api/photos/mine/${firstUpload.body.photo.id}`)
      .set('Authorization', `Bearer ${secondToken}`)
      .expect(404);

    await request(app)
      .delete(`/api/photos/mine/${firstUpload.body.photo.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const afterDelete = await request(app)
      .get('/api/photos/mine')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(afterDelete.body.photos.map(photo => photo.id)).not.toContain(firstUpload.body.photo.id);
    delete process.env.ADMIN_PASSWORD;
  });

  test('optional analytics hook failures do not block photo upload', async () => {
    const analyticsHook = jest.fn(() => {
      throw new Error('analytics unavailable');
    });
    const createRouter = require('../../../server/routes/photos.js').createRouter;
    const hookedApp = createApp(createRouter({ userService, analyticsHook }));

    const res = await request(hookedApp)
      .post('/api/photos/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('locationName', 'Jingshan')
      .attach('photo', makeJpegBuffer(), { filename: 'hooked.jpg', contentType: 'image/jpeg' })
      .expect(201);

    await new Promise(resolve => setImmediate(resolve));
    expect(res.body.photo.id).toBeTruthy();
    expect(analyticsHook).toHaveBeenCalledWith(expect.objectContaining({
      eventName: 'photo_upload',
      userId: userService.verifyToken(token).userId,
      status: 'success'
    }));
  });

  test('rejects upload without a photo file', async () => {
    const res = await request(app)
      .post('/api/photos/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('locationName', 'Jingshan')
      .expect(400);

    expect(res.body.error.code).toBe('PHOTO_REQUIRED');
  });
});
