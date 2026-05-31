import { jest } from '@jest/globals';

let ScheduledGridRefreshService;

beforeAll(async () => {
  const mod = await import('../../../server/services/ScheduledGridRefreshService.js');
  ScheduledGridRefreshService = mod.default || mod;
});

describe('ScheduledGridRefreshService', () => {
  test('scheduled job runs data pipeline once before invalidating raster cache', async () => {
    const workerService = {
      runOnce: jest.fn().mockResolvedValue({ status: 'completed', run: { id: 'run-1' } })
    };
    const gridService = {
      refreshIfStale: jest.fn().mockResolvedValue(undefined)
    };
    const rasterService = {
      invalidateCache: jest.fn()
    };
    const config = { mode: 'gfs_cams', forecastHours: 48 };
    const service = new ScheduledGridRefreshService({
      readScheduleConfig: () => ({ enabled: true, jobs: [{ time: '20:00', type: 'sunrise', label: '朝霞晚间刷新' }] }),
      configService: { getConfig: () => config },
      workerService,
      gridService,
      rasterService,
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() }
    });

    const due = await service.runDueJobs(new Date('2026-05-30T12:00:00Z'));

    expect(due).toHaveLength(1);
    expect(workerService.runOnce).toHaveBeenCalledTimes(1);
    expect(workerService.runOnce).toHaveBeenCalledWith({
      config,
      reason: 'scheduled-grid-refresh:20:00:sunrise',
      dryRun: false
    });
    expect(gridService.refreshIfStale).not.toHaveBeenCalled();
    expect(rasterService.invalidateCache).toHaveBeenCalledWith('all');
  });

  test('does not refresh map scores when the scheduled data pipeline fails', async () => {
    const workerService = {
      runOnce: jest.fn().mockResolvedValue({
        status: 'failed',
        error: { code: 'GFS_DOWNLOAD_HTTP_ERROR', message: '404' }
      })
    };
    const gridService = {
      refreshIfStale: jest.fn()
    };
    const service = new ScheduledGridRefreshService({
      readScheduleConfig: () => ({ enabled: true, jobs: [{ time: '12:00', type: 'sunset', label: '晚霞午间刷新' }] }),
      configService: { getConfig: () => ({ mode: 'gfs_cams' }) },
      workerService,
      gridService,
      rasterService: { invalidateCache: jest.fn() },
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() }
    });

    await service.runDueJobs(new Date('2026-05-30T04:00:00Z'));

    expect(workerService.runOnce).toHaveBeenCalledTimes(1);
    expect(gridService.refreshIfStale).not.toHaveBeenCalled();
  });

  test('openmeteo mode refreshes legacy caches instead of starting GFS CAMS pipeline', async () => {
    const workerService = {
      runOnce: jest.fn()
    };
    const gridService = {
      refreshIfStale: jest.fn().mockResolvedValue(undefined)
    };
    const rasterService = {
      invalidateCache: jest.fn()
    };
    const service = new ScheduledGridRefreshService({
      readScheduleConfig: () => ({ enabled: true, jobs: [{ time: '12:00', type: 'both', label: '旧版刷新' }] }),
      configService: { getConfig: () => ({ mode: 'openmeteo' }) },
      workerService,
      gridService,
      rasterService,
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() }
    });

    await service.runDueJobs(new Date('2026-05-30T04:00:00Z'));

    expect(workerService.runOnce).not.toHaveBeenCalled();
    expect(gridService.refreshIfStale).toHaveBeenCalledWith(undefined, 'sunrise');
    expect(gridService.refreshIfStale).toHaveBeenCalledWith(undefined, 'sunset');
    expect(rasterService.invalidateCache).toHaveBeenCalledWith('all');
  });
});
