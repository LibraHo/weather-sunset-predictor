import { createRequire } from 'module';
import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { jest } from '@jest/globals';

const require = createRequire(import.meta.url);
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = global.TextEncoder || TextEncoder;
global.TextDecoder = global.TextDecoder || TextDecoder;
const request = require('supertest');

function basic(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

describe('global switch routes and weather closure guard', () => {
  let tempDir;
  let originalEnv;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xiake-switch-routes-'));
    originalEnv = { ...process.env };
    process.env.NODE_ENV = 'test';
    process.env.ADMIN_USERNAME = 'admin';
    process.env.ADMIN_PASSWORD = 'unit-secret';
    process.env.GLOBAL_SWITCH_FILE = path.join(tempDir, 'global-switches.json');
    jest.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    fs.rmSync(tempDir, { recursive: true, force: true });
    jest.resetModules();
  });

  test('admin can read and write global switches', async () => {
    const adminRoutes = require('../../../server/routes/admin.js');
    const app = express();
    app.use(express.json());
    app.use('/', adminRoutes);

    await request(app).get('/admin/global-switches').expect(401);

    await request(app)
      .post('/admin/global-switches')
      .set('Authorization', basic('admin', 'unit-secret'))
      .send({ siteClosed: false, weatherPredictionClosed: true, radarFovMode: 'legacy' })
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.state.weatherPredictionClosed).toBe(true);
        expect(res.body.state.radarFovMode).toBe('legacy');
      });

    await request(app)
      .get('/admin/global-switches')
      .set('Authorization', basic('admin', 'unit-secret'))
      .expect(200)
      .expect((res) => {
        expect(res.body.state).toMatchObject({
          siteClosed: false,
          weatherPredictionClosed: true,
          radarFovMode: 'legacy'
        });
      });
  });

  test('weather and prediction APIs close while share and firecloud stay available', async () => {
    const globalSwitchService = require('../../../server/services/GlobalSwitchRuntime.js');
    const {
      blockAgentWeatherPredictionWhenClosed,
      blockWeatherPredictionWhenClosed
    } = require('../../../server/middleware/globalSwitches.js');

    globalSwitchService.updateState({ weatherPredictionClosed: true });

    const app = express();
    app.use(express.json());
    app.get('/api/config/site-state', (req, res) => res.json(globalSwitchService.getPublicState()));
    app.use('/api/weather', blockWeatherPredictionWhenClosed, (req, res) => res.json({ ok: true }));
    app.use('/api/prediction', blockWeatherPredictionWhenClosed, (req, res) => res.json({ ok: true }));
    app.use('/api/agent', blockAgentWeatherPredictionWhenClosed, (req, res) => res.json({ ok: true }));
    app.use('/api/share', (req, res) => res.json({ ok: true }));
    app.use('/api/firecloud', (req, res) => res.json({ ok: true }));

    await request(app).get('/api/weather/forecast').expect(503).expect((res) => {
      expect(res.body.error.code).toBe('WEATHER_PREDICTION_CLOSED');
      expect(res.body.availability.shareMapAvailable).toBe(true);
      expect(res.body.availability.firecloudMapAvailable).toBe(true);
    });
    await request(app).post('/api/prediction/enhanced').send({}).expect(503);
    await request(app).get('/api/agent/forecast').expect(503);
    await request(app).get('/api/agent/geocode?q=Beijing').expect(200);
    await request(app).get('/api/share/summary').expect(200);
    await request(app).get('/api/firecloud/status').expect(200);
    await request(app).get('/api/config/site-state').expect(200).expect((res) => {
      expect(res.body.weatherPredictionClosed).toBe(true);
      expect(res.body.radarFovMode).toBe('fov');
      expect(res.body.shareMapAvailable).toBe(true);
      expect(res.body.firecloudMapAvailable).toBe(true);
    });
  });
});
