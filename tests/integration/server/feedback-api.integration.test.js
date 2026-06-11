import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TextDecoder, TextEncoder } from 'node:util';
import { jest } from '@jest/globals';

if (!global.TextEncoder) global.TextEncoder = TextEncoder;
if (!global.TextDecoder) global.TextDecoder = TextDecoder;

describe('Feedback API', () => {
  let request;
  let app;
  let tmpHome;

  beforeEach(async () => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'xiake-feedback-api-'));
    process.env.HOME = tmpHome;
    jest.resetModules();
    const supertestModule = await import('supertest');
    const feedbackRouterModule = await import('../../../server/routes/feedback.js');
    request = supertestModule.default || supertestModule;
    const createRouter = feedbackRouterModule.createRouter || feedbackRouterModule.default?.createRouter;
    app = express();
    app.use(express.json({ limit: '2mb' }));
    app.use('/api/feedback', createRouter({
      userService: {
        verifyToken(token) {
          return token === 'valid-token' ? { userId: 'u1', email: 'user@example.com' } : null;
        }
      }
    }));
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  test('requires login for home feedback', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .send({
        source: 'home',
        feedbackType: 'wrong',
        period: 'sunset',
        predictionSnapshot: { score: 60 }
      })
      .expect(401);

    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('creates authenticated home feedback', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .set('X-Session-Token', 'valid-token')
      .send({
        source: 'home',
        client: 'web',
        feedbackType: 'overstated',
        comment: '有颜色但很弱',
        period: 'sunset',
        date: '2026-06-12',
        lat: 39.9,
        lon: 116.4,
        score: 58,
        predictionSnapshot: { score: 58 },
        weatherSnapshot: { cloudLayers: { high: 80 } }
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.feedback.id).toBeTruthy();
  });
});
