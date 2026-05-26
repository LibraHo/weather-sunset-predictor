import fs from 'fs';
import os from 'os';
import path from 'path';

let DataPipelineWorkerService;
let GridProductCacheService;

beforeAll(async () => {
  const workerMod = await import('../../../server/services/DataPipelineWorkerService.js');
  const cacheMod = await import('../../../server/services/GridProductCacheService.js');
  DataPipelineWorkerService = workerMod.default || workerMod;
  GridProductCacheService = cacheMod.default || cacheMod;
});

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'xiake-pipeline-worker-'));
}

function baseConfig(overrides = {}) {
  return {
    mode: 'gfs_cams',
    regionPreset: 'test_small',
    bbox: { north: 41, south: 39, west: 115, east: 117 },
    resolution: 1,
    forecastHours: 1,
    forecastStepHours: 1,
    sources: { gfs: true, cams: true, openMeteoFallback: true },
    runtimePolicy: {
      workerConcurrency: 1,
      maxResidentMemoryMb: 512,
      hardMemoryLimitMb: 768,
      reserveMemoryForApiMb: 2048,
      publicRequestCanStartPipeline: false,
      pauseWhenMemoryPressure: true
    },
    storagePolicy: {
      deleteRawAfterMinutes: 60,
      deleteTmpAfterHours: 3,
      keepCacheDays: 3,
      keepTileDays: 3,
      keepLogDays: 7,
      minFreeDiskGb: 3,
      maxRawTmpGb: 5
    },
    ...overrides
  };
}

describe('DataPipelineWorkerService', () => {
  test('runs a dry-run fixture pipeline and writes weather and aerosol products', async () => {
    const dataDir = makeTempDir();
    const worker = new DataPipelineWorkerService({
      dataDir,
      now: new Date('2026-05-26T12:00:00Z'),
      freeDiskBytes: 20 * 1024 ** 3
    });

    const result = await worker.runOnce({
      config: baseConfig(),
      reason: 'unit-test',
      dryRun: true
    });

    const cache = new GridProductCacheService({ dataDir });
    const manifest = cache.listManifest();
    const run = worker.runLogService.getRun(result.run.id);

    expect(result.status).toBe('completed');
    expect(run.status).toBe('completed');
    expect(run.steps.every(step => step.status === 'completed')).toBe(true);
    expect(run.totalBytesDownloaded).toBeGreaterThan(0);
    expect(manifest.products.some(item => item.source === 'gfs' && item.productType === 'weather_grid')).toBe(true);
    expect(manifest.products.some(item => item.source === 'cams' && item.productType === 'aerosol_grid')).toBe(true);
    expect(run.steps.filter(step => step.source === 'gfs')[0]).toMatchObject({
      bytesDownloaded: expect.any(Number),
      elapsedMs: expect.any(Number),
      outputPath: expect.stringContaining('grid-products')
    });
    expect(fs.existsSync(path.join(dataDir, 'data', 'raw', 'gfs'))).toBe(false);
  });

  test('records a retryable CAMS failure and completes as degraded when weather succeeds', async () => {
    const dataDir = makeTempDir();
    const camsSourceService = {
      normalizeGridProduct() {
        const err = new Error('fixture CAMS unavailable');
        err.code = 'CAMS_FIXTURE_FAILED';
        throw err;
      }
    };
    const worker = new DataPipelineWorkerService({
      dataDir,
      now: new Date('2026-05-26T12:00:00Z'),
      freeDiskBytes: 20 * 1024 ** 3,
      camsSourceService
    });

    const result = await worker.runOnce({
      config: baseConfig(),
      reason: 'cams-degrade',
      dryRun: true
    });

    const cache = new GridProductCacheService({ dataDir });
    const manifest = cache.listManifest();
    const run = worker.runLogService.getRun(result.run.id);
    const camsStep = run.steps.find(step => step.source === 'cams');

    expect(result.status).toBe('completed');
    expect(result.degraded).toBe(true);
    expect(run.status).toBe('completed');
    expect(camsStep).toMatchObject({
      status: 'failed',
      errorCode: 'CAMS_FIXTURE_FAILED',
      retryable: true
    });
    expect(manifest.products.some(item => item.source === 'gfs' && item.productType === 'weather_grid')).toBe(true);
    expect(manifest.products.some(item => item.source === 'cams')).toBe(false);
  });

  test('fails the run when a required GFS fixture step fails', async () => {
    const dataDir = makeTempDir();
    const gfsSourceService = {
      normalizeGridProduct() {
        const err = new Error('fixture GFS unavailable');
        err.code = 'GFS_FIXTURE_FAILED';
        throw err;
      }
    };
    const worker = new DataPipelineWorkerService({
      dataDir,
      now: new Date('2026-05-26T12:00:00Z'),
      freeDiskBytes: 20 * 1024 ** 3,
      gfsSourceService
    });

    const result = await worker.runOnce({
      config: baseConfig({ sources: { gfs: true, cams: false, openMeteoFallback: true } }),
      reason: 'gfs-fails',
      dryRun: true
    });

    const run = worker.runLogService.getRun(result.run.id);
    const gfsStep = run.steps.find(step => step.source === 'gfs');

    expect(result.status).toBe('failed');
    expect(run.status).toBe('failed');
    expect(gfsStep).toMatchObject({
      status: 'failed',
      errorCode: 'GFS_FIXTURE_FAILED',
      retryable: true
    });
  });

  test('fails the second run while one worker is already active', async () => {
    const dataDir = makeTempDir();
    let release;
    let blocked = false;
    const worker = new DataPipelineWorkerService({
      dataDir,
      now: new Date('2026-05-26T12:00:00Z'),
      freeDiskBytes: 20 * 1024 ** 3,
      stepDelayMs: 1,
      beforeStep: () => {
        if (blocked) return Promise.resolve();
        blocked = true;
        return new Promise(resolve => {
          release = resolve;
        });
      }
    });

    const firstRun = worker.runOnce({
      config: baseConfig({ sources: { gfs: true, cams: false, openMeteoFallback: true } }),
      reason: 'first',
      dryRun: true
    });
    await Promise.resolve();

    await expect(worker.runOnce({
      config: baseConfig({ sources: { gfs: true, cams: false, openMeteoFallback: true } }),
      reason: 'second',
      dryRun: true
    })).rejects.toMatchObject({ code: 'DATA_PIPELINE_WORKER_BUSY' });

    release();
    await expect(firstRun).resolves.toMatchObject({ status: 'completed' });
  });
});
