import fs from 'fs';
import os from 'os';
import path from 'path';

let DataPipelinePlannerService;

beforeAll(async () => {
  const mod = await import('../../../server/services/DataPipelinePlannerService.js');
  DataPipelinePlannerService = mod.default || mod;
});

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'xiake-pipeline-planner-'));
}

describe('DataPipelinePlannerService', () => {
  test('creates a dry-run GFS+CAMS plan with traceable batches and resource estimates', () => {
    const service = new DataPipelinePlannerService({
      dataDir: makeTempDir(),
      now: new Date('2026-05-26T10:15:00Z'),
      freeDiskBytes: 20 * 1024 ** 3
    });

    const plan = service.createPlan({
      mode: 'gfs_cams',
      bbox: { north: 54, south: 18, west: 73, east: 135 },
      resolution: 0.5,
      forecastHours: 48,
      forecastStepHours: 1,
      sources: { gfs: true, cams: true },
      runtimePolicy: { maxResidentMemoryMb: 512 },
      storagePolicy: { minFreeDiskGb: 3, maxRawTmpGb: 5 }
    });

    expect(plan.safe).toBe(true);
    expect(plan.windowHours).toBe(48);
    expect(plan.sources).toEqual(['gfs', 'cams']);
    expect(plan.runtimePolicy).toMatchObject({
      workerConcurrency: 1,
      maxResidentMemoryMb: 512,
      publicRequestCanStartPipeline: false
    });
    const gfsStep = plan.steps.find(step => step.source === 'gfs' && step.forecastHour === 0);
    const camsStep = plan.steps.find(step => step.source === 'cams');
    expect(gfsStep).toMatchObject({
      dataUrl: expect.stringContaining('filter_gfs_0p25.pl'),
      idxUrl: expect.stringContaining('.idx')
    });
    expect(camsStep).toMatchObject({
      request: expect.objectContaining({
        dataset: 'cams-global-atmospheric-composition-forecasts',
        type: 'analysis',
        format: 'netcdf'
      })
    });
    expect(camsStep.request.leadtime_hour).toBeUndefined();
    expect(plan.estimate).toMatchObject({
      gridPoints: 10731,
      estimatedDownloadBytes: expect.any(Number),
      estimatedRawTmpBytes: expect.any(Number),
      maxResidentBytes: expect.any(Number),
      freeDiskBytes: 20 * 1024 ** 3
    });
  });

  test('marks plan unsafe when raw tmp estimate would violate disk policy', () => {
    const service = new DataPipelinePlannerService({
      dataDir: makeTempDir(),
      now: new Date('2026-05-26T10:15:00Z'),
      freeDiskBytes: 3.1 * 1024 ** 3
    });

    const plan = service.createPlan({
      mode: 'gfs_cams',
      bbox: { north: 54, south: 18, west: 73, east: 135 },
      resolution: 0.5,
      forecastHours: 48,
      forecastStepHours: 1,
      sources: { gfs: true, cams: true },
      storagePolicy: { minFreeDiskGb: 3, maxRawTmpGb: 5 }
    });

    expect(plan.safe).toBe(false);
    expect(plan.reasons.join('; ')).toMatch(/disk/i);
  });

  test('does not expand a zero-hour smoke plan into the default 48h window', () => {
    const service = new DataPipelinePlannerService({
      dataDir: makeTempDir(),
      now: new Date('2026-05-26T10:15:00Z'),
      freeDiskBytes: 20 * 1024 ** 3
    });

    const plan = service.createPlan({
      mode: 'gfs_cams',
      regionPreset: 'test_small',
      sources: { gfs: true, cams: false },
      forecastHours: 0,
      forecastStepHours: 6
    });

    expect(plan.safe).toBe(true);
    expect(plan.windowHours).toBe(0);
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]).toMatchObject({ source: 'gfs', forecastHour: 0 });
  });
});
