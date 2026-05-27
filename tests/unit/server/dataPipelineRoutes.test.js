import { createRequire } from 'module';
import { jest } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import { TextDecoder, TextEncoder } from 'util';

const require = createRequire(import.meta.url);

let createDataPipelineRouter;
let DataPipelineConfigService;
let DataPipelineRunLogService;
let request;

beforeAll(async () => {
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
  request = (await import('supertest')).default;
  const routeMod = await import('../../../server/routes/data-pipeline.js');
  createDataPipelineRouter = routeMod.createRouter || routeMod.default?.createRouter;
  const configMod = await import('../../../server/services/DataPipelineConfigService.js');
  DataPipelineConfigService = configMod.default || configMod;
  const logMod = await import('../../../server/services/DataPipelineRunLogService.js');
  DataPipelineRunLogService = logMod.default || logMod;
});

function makeApp(options = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xiake-pipeline-routes-'));
  const configService = new DataPipelineConfigService({ dataDir, freeDiskBytes: 20 * 1024 ** 3 });
  const runLogService = new DataPipelineRunLogService({ dataDir });
  const workerService = options.workerService;
  const cleanupService = options.cleanupService === undefined ? {
    cleanup: jest.fn().mockReturnValue({
      deletedFiles: ['/tmp/old.grib2'],
      deletedBytes: 1024,
      prunedRuns: 0,
      prunedSteps: 0
    })
  } : options.cleanupService;
  const app = express();
  app.use(express.json());
  app.use('/api/admin/data-pipeline', createDataPipelineRouter({ configService, runLogService, cleanupService, workerService }));
  return { app, cleanupService, dataDir, runLogService };
}

describe('data pipeline admin routes', () => {
  test('GET /config returns safe default hybrid config', async () => {
    const { app } = makeApp();
    const res = await request(app).get('/api/admin/data-pipeline/config').expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.config.mode).toBe('hybrid');
    expect(res.body.config.forecastHours).toBe(48);
  });

  test('POST /estimate rejects unsafe bbox with stable error code', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post('/api/admin/data-pipeline/estimate')
      .send({
        regionPreset: 'custom_bbox',
        bbox: { north: 90, south: -90, west: -180, east: 180 },
        resolution: 0.25,
        forecastHours: 72
      })
      .expect(400);

    expect(res.body.error.code).toBe('DATA_PIPELINE_UNSAFE_CONFIG');
    expect(res.body.estimate.safe).toBe(false);
  });

  test('POST /run rejects real runs until the worker is implemented', async () => {
    const { app } = makeApp();
    const res = await request(app)
      .post('/api/admin/data-pipeline/run')
      .send({ reason: 'manual-test' })
      .expect(501);

    expect(res.body.error.code).toBe('DATA_PIPELINE_REAL_WORKER_NOT_IMPLEMENTED');
    expect(res.body.estimate.safe).toBe(true);
  });

  test('POST /run with dryRun executes the local fixture worker immediately', async () => {
    const workerService = {
      runOnce: jest.fn().mockResolvedValue({
        status: 'completed',
        degraded: false,
        run: { id: 'run_fixture', status: 'completed' },
        products: [{ source: 'gfs' }, { source: 'cams' }],
        failedSteps: []
      })
    };
    const { app } = makeApp({ workerService });

    const res = await request(app)
      .post('/api/admin/data-pipeline/run')
      .send({ reason: 'dry-run-test', dryRun: true })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.run.status).toBe('completed');
    expect(res.body.products).toHaveLength(2);
    expect(workerService.runOnce).toHaveBeenCalledWith(expect.objectContaining({
      reason: 'dry-run-test',
      dryRun: true
    }));
  });

  test('POST /runs/:id/retry with dryRun reruns the previous config locally', async () => {
    const workerService = {
      runOnce: jest.fn().mockResolvedValue({
        status: 'completed',
        degraded: false,
        run: { id: 'retry_fixture', status: 'completed' },
        products: [{ source: 'gfs' }],
        failedSteps: []
      })
    };
    const { app, runLogService } = makeApp({ workerService });
    const previous = runLogService.createRun({ mode: 'hybrid', regionPreset: 'test_small' }, { reason: 'failed-dry-run' });

    const res = await request(app)
      .post(`/api/admin/data-pipeline/runs/${previous.id}/retry`)
      .send({ dryRun: true })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.previousRunId).toBe(previous.id);
    expect(workerService.runOnce).toHaveBeenCalledWith(expect.objectContaining({
      config: expect.objectContaining({ regionPreset: 'test_small' }),
      reason: `retry:${previous.id}`,
      dryRun: true
    }));
  });

  test('POST /runs/:id/retry rejects real retries until the worker is implemented', async () => {
    const { app, runLogService } = makeApp();
    const previous = runLogService.createRun({ mode: 'hybrid', regionPreset: 'test_small' }, { reason: 'failed-run' });

    const res = await request(app)
      .post(`/api/admin/data-pipeline/runs/${previous.id}/retry`)
      .send({})
      .expect(501);

    expect(res.body.error.code).toBe('DATA_PIPELINE_REAL_WORKER_NOT_IMPLEMENTED');
    expect(res.body.previousRunId).toBe(previous.id);
  });

  test('POST /cleanup deletes files immediately and records completed cleanup step', async () => {
    const { app, cleanupService } = makeApp();
    const res = await request(app)
      .post('/api/admin/data-pipeline/cleanup')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.run.status).toBe('completed');
    expect(res.body.step.status).toBe('completed');
    expect(res.body.cleanup.deletedFiles).toEqual(['/tmp/old.grib2']);
    expect(res.body.cleanup.deletedBytes).toBe(1024);
    expect(cleanupService.cleanup).toHaveBeenCalledWith(expect.objectContaining({
      deleteRawAfterMinutes: 60,
      deleteTmpAfterHours: 3,
      keepCacheDays: 3,
      keepTileDays: 3,
      keepLogDays: 7
    }), { dryRun: false });
  });

  test('POST /cleanup dryRun previews cleanup without deleting files', async () => {
    const cleanupService = {
      cleanup: jest.fn().mockReturnValue({
        dryRun: true,
        deletedFiles: ['/tmp/would-delete.grib2'],
        deletedBytes: 2048,
        prunedRuns: 0,
        prunedSteps: 0
      })
    };
    const { app } = makeApp({ cleanupService });
    const res = await request(app)
      .post('/api/admin/data-pipeline/cleanup')
      .send({ dryRun: true })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.cleanup.dryRun).toBe(true);
    expect(res.body.run.reason).toBe('manual-cleanup-dry-run');
    expect(cleanupService.cleanup).toHaveBeenCalledWith(expect.any(Object), { dryRun: true });
  });

  test('POST /cleanup uses the configured pipeline data directory by default', async () => {
    const { app, dataDir } = makeApp({ cleanupService: null });
    const oldRaw = path.join(dataDir, 'data', 'raw', 'gfs', 'old.grib2');
    fs.mkdirSync(path.dirname(oldRaw), { recursive: true });
    fs.writeFileSync(oldRaw, 'old', 'utf8');
    const oldTime = new Date('2026-05-26T00:00:00Z');
    fs.utimesSync(oldRaw, oldTime, oldTime);

    const res = await request(app)
      .post('/api/admin/data-pipeline/cleanup')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.cleanup.deletedFiles).toContain(oldRaw);
    expect(fs.existsSync(oldRaw)).toBe(false);
  });
});
