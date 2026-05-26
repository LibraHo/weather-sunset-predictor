import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(import.meta.url);

let DataPipelineRunLogService;

beforeAll(async () => {
  const mod = await import('../../../server/services/DataPipelineRunLogService.js');
  DataPipelineRunLogService = mod.default || mod;
});

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'xiake-pipeline-log-'));
}

describe('DataPipelineRunLogService', () => {
  test('records run and step lifecycle with byte accounting', () => {
    const service = new DataPipelineRunLogService({ dataDir: makeTempDir() });

    const run = service.createRun({
      mode: 'gfs_cams',
      bbox: { north: 54, south: 18, west: 73, east: 135 },
      resolution: 0.5,
      forecastHours: 48
    });
    const step = service.createStep(run.id, {
      type: 'download',
      source: 'gfs',
      cycle: '2026052600',
      forecastHour: 6,
      variables: ['HCDC', 'MCDC']
    });

    service.completeStep(step.id, {
      bytesDownloaded: 2048,
      outputPath: '/tmp/gfs-f006.grib2'
    });
    service.completeRun(run.id, { artifactPath: '/cache/latest.json' });

    const detail = service.getRun(run.id);

    expect(detail.status).toBe('completed');
    expect(detail.totalBytesDownloaded).toBe(2048);
    expect(detail.artifactPath).toBe('/cache/latest.json');
    expect(detail.steps).toHaveLength(1);
    expect(detail.steps[0]).toMatchObject({
      status: 'completed',
      source: 'gfs',
      cycle: '2026052600',
      forecastHour: 6,
      bytesDownloaded: 2048
    });
  });

  test('marks failed step retryable and fails parent run', () => {
    const service = new DataPipelineRunLogService({ dataDir: makeTempDir() });
    const run = service.createRun({ mode: 'gfs_cams' });
    const step = service.createStep(run.id, { type: 'download', source: 'cams' });

    service.failStep(step.id, {
      errorCode: 'UPSTREAM_TIMEOUT',
      message: 'CAMS timed out',
      retryable: true
    });

    const detail = service.getRun(run.id);

    expect(detail.status).toBe('failed');
    expect(detail.steps[0]).toMatchObject({
      status: 'failed',
      errorCode: 'UPSTREAM_TIMEOUT',
      message: 'CAMS timed out',
      retryable: true
    });
  });
});
