import { jest } from '@jest/globals';

let GridScoreService;

beforeAll(async () => {
  const mod = await import('../../../server/services/GridScoreService.js');
  GridScoreService = mod.GridScoreService;
});

describe('GridScoreService public map mode policy', () => {
  test('delegates public map reads to the data pipeline mode service', () => {
    const modeService = {
      getPublicMapCache: jest.fn(() => ({
        mode: 'paused',
        status: 'paused',
        cache: null,
        degradedReason: 'DATA_PIPELINE_PAUSED'
      }))
    };
    const service = new GridScoreService({
      modeService,
      productScoreAdapter: { getScoreCache: jest.fn(() => null) }
    });

    const result = service.getPublicMapCache('sunset');

    expect(modeService.getPublicMapCache).toHaveBeenCalledWith(service, 'sunset');
    expect(result).toMatchObject({
      mode: 'paused',
      status: 'paused',
      cache: null,
      degradedReason: 'DATA_PIPELINE_PAUSED'
    });
  });

  test('public map mode policy never starts Open-Meteo refreshes', () => {
    const modeService = {
      getPublicMapCache: jest.fn((gridService, period) => {
        const cache = gridService.getCache(period);
        return { mode: 'openmeteo', status: cache ? 'ready' : 'not-ready', cache };
      })
    };
    const service = new GridScoreService({
      modeService,
      productScoreAdapter: { getScoreCache: jest.fn(() => null) }
    });
    service.refreshIfStale = jest.fn();

    service.getPublicMapCache('sunset');

    expect(service.refreshIfStale).not.toHaveBeenCalled();
  });
});
