const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const { EventEmitter } = require('events');

const DataPipelineModeService = require('../services/DataPipelineModeService.js');
const DataPipelineRunLogService = require('../services/DataPipelineRunLogService.js');
const ScheduledGridRefreshService = require('../services/ScheduledGridRefreshService.js');
const GfsGridSourceService = require('../services/GfsGridSourceService.js');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'xiake-pipeline-test-'));
}

describe('data pipeline recovery guards', () => {
  test('hybrid mode falls back when pipeline cache is degraded', () => {
    const service = new DataPipelineModeService({
      configService: { getConfig: () => ({ mode: 'hybrid' }) }
    });
    const legacyCache = {
      source: 'openmeteo-grid-cache',
      gridPoints: [{ lat: 39.9, lon: 116.4, score: 55 }]
    };
    const pipelineCache = {
      source: 'gfs-cams-grid-products',
      degraded: true,
      degradedReason: 'CAMS_AEROSOL_CACHE_NOT_READY',
      gridPoints: new Array(1000).fill(null).map((_, index) => ({ lat: 20 + index, lon: 100, score: 1 }))
    };

    const result = service.getPublicMapCache({
      getPipelineCache: () => pipelineCache,
      getCache: () => legacyCache
    }, 'sunset');

    expect(result.status).toBe('ready');
    expect(result.cache.source).toBe('openmeteo-grid-cache');
    expect(result.degradedReason).toBe('CAMS_AEROSOL_CACHE_NOT_READY');
  });

  test('stale queued and running pipeline runs are marked failed', () => {
    const dir = tmpDir();
    try {
      let now = new Date('2026-07-14T10:00:00Z');
      const service = new DataPipelineRunLogService({
        dataDir: dir,
        now: () => now
      });
      const running = service.createRun({}, { reason: 'scheduled-grid-refresh' });
      service.startRun(running.id);
      const step = service.createStep(running.id, { source: 'gfs' });
      const queued = service.createRun({}, { reason: 'manual-real-run' });

      now = new Date('2026-07-14T10:05:00Z');
      const failed = service.failStaleActiveRuns({
        staleAfterMs: 60 * 1000,
        errorCode: 'DATA_PIPELINE_STALE_RUN_TEST',
        message: 'test stale'
      });

      expect(failed.map(run => run.id).sort()).toEqual([queued.id, running.id].sort());
      expect(service.getRun(running.id).status).toBe('failed');
      expect(service.getRun(queued.id).status).toBe('failed');
      expect(service.getRun(running.id).steps.find(row => row.id === step.id).status).toBe('failed');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('scheduled pipeline timeout releases the in-memory running guard', async () => {
    const runLogService = { failStaleActiveRuns: jest.fn(() => []) };
    const service = new ScheduledGridRefreshService({
      readScheduleConfig: () => ({ jobs: [] }),
      configService: { getConfig: () => ({ mode: 'gfs_cams' }) },
      workerService: { runOnce: jest.fn(() => new Promise(() => {})) },
      runLogService,
      pipelineTimeoutMs: 5,
      staleRunAfterMs: 5,
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() }
    });

    await service._runScheduledJob({ time: '12:00', type: 'sunset', label: 'test', periods: ['sunset'] });

    expect(service.running).toBe(false);
    expect(runLogService.failStaleActiveRuns).toHaveBeenCalledWith(expect.objectContaining({
      errorCode: 'DATA_PIPELINE_SCHEDULED_TIMEOUT'
    }));
  });

  test('GFS downloader aborts stalled requests', async () => {
    const dir = tmpDir();
    const targetPath = path.join(dir, 'gfs.grib2');
    let request;
    const getSpy = jest.spyOn(https, 'get').mockImplementation(() => {
      request = new EventEmitter();
      request.setTimeout = jest.fn((_, onTimeout) => {
        process.nextTick(onTimeout);
        return request;
      });
      request.destroy = jest.fn(err => {
        process.nextTick(() => request.emit('error', err));
      });
      return request;
    });

    try {
      await expect(GfsGridSourceService.downloadUrlToFile('https://example.invalid/gfs', targetPath, { timeoutMs: 1 }))
        .rejects.toMatchObject({ code: 'GFS_DOWNLOAD_TIMEOUT' });
      expect(request.setTimeout).toHaveBeenCalledWith(1, expect.any(Function));
      expect(request.destroy).toHaveBeenCalled();
      expect(fs.existsSync(`${targetPath}.download`)).toBe(false);
    } finally {
      getSpy.mockRestore();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
