import fs from 'fs';
import os from 'os';
import path from 'path';
import { jest } from '@jest/globals';

let GfsGridSourceService;

beforeAll(async () => {
  const mod = await import('../../../server/services/GfsGridSourceService.js');
  GfsGridSourceService = mod.default || mod;
});

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'xiake-gfs-source-'));
}

describe('GfsGridSourceService', () => {
  test('builds one request batch per forecast hour for the default 48h window', () => {
    const service = new GfsGridSourceService({ dataDir: makeTempDir(), now: new Date('2026-05-26T10:15:00Z') });

    const plan = service.buildRequestPlan({
      bbox: { north: 54, south: 18, west: 73, east: 135 },
      resolution: 0.5,
      forecastHours: 48,
      forecastStepHours: 1
    });

    expect(plan.source).toBe('gfs');
    expect(plan.cycle).toBe('2026052600');
    expect(plan.forecastHours).toHaveLength(49);
    expect(plan.forecastHours[0]).toBe(0);
    expect(plan.forecastHours[48]).toBe(48);
    expect(plan.batches).toHaveLength(49);
    expect(plan.batches[6]).toMatchObject({
      source: 'gfs',
      forecastHour: 6,
      variables: GfsGridSourceService.FIELD_WHITELIST,
      cleanupRawAfterProcess: true
    });
    expect(plan.batches[6].idxUrl).toContain('gfs.t00z.pgrb2.0p25.f006.idx');
    expect(plan.batches[6].dataUrl).toContain('filter_gfs_0p25.pl');
    expect(plan.batches[6].dataUrl).toContain('lev_entire_atmosphere_%28considered_as_a_single_layer%29=on');
    expect(plan.batches[6].dataUrl).toContain('lev_2_m_above_ground=on');
    expect(plan.batches[6].dataUrl).toContain('lev_10_m_above_ground=on');
    expect(plan.batches[6].dataUrl).toContain('lev_low_cloud_layer=on');
    expect(plan.batches[6].dataUrl).toContain('lev_middle_cloud_layer=on');
    expect(plan.batches[6].dataUrl).toContain('lev_high_cloud_layer=on');
  });

  test('normalizes GFS records into an internal grid product without downloading data', () => {
    const service = new GfsGridSourceService({ dataDir: makeTempDir(), now: new Date('2026-05-26T10:15:00Z') });
    const batch = service.buildRequestPlan({
      bbox: { north: 41, south: 39, west: 115, east: 117 },
      resolution: 1,
      forecastHours: 1
    }).batches[1];

    const product = service.normalizeGridProduct(batch, [
      { lat: 40, lon: 116, values: { TCDC: 72, RH: 61, VIS: 12000 } }
    ]);

    expect(product).toMatchObject({
      source: 'gfs',
      productType: 'weather_grid',
      schemaVersion: 1,
      forecastHour: 1,
      grid: { resolution: 1, bbox: { north: 41, south: 39, west: 115, east: 117 } },
      fields: expect.arrayContaining(['TCDC', 'RH', 'VIS'])
    });
    expect(product.points).toEqual([
      { lat: 40, lon: 116, weather: { TCDC: 72, RH: 61, VIS: 12000 }, aerosol: {}, sourceMeta: { gfsForecastHour: 1 } }
    ]);
  });

  test('downloads a GFS batch through an injectable URL downloader', async () => {
    const calls = [];
    const service = new GfsGridSourceService({
      dataDir: makeTempDir(),
      now: new Date('2026-05-26T10:15:00Z'),
      downloadUrl: async (url, targetPath) => {
        calls.push({ url, targetPath });
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, 'payload');
        return { bytesDownloaded: 7, rawPath: targetPath };
      }
    });
    const batch = service.buildRequestPlan({
      bbox: { north: 41, south: 39, west: 115, east: 117 },
      resolution: 1,
      forecastHours: 0
    }).batches[0];

    const result = await service.downloadBatch(batch);

    expect(result).toEqual({ bytesDownloaded: 7, rawPath: batch.rawPath });
    expect(calls[0]).toMatchObject({
      url: batch.dataUrl,
      targetPath: batch.rawPath
    });
    expect(fs.existsSync(batch.rawPath)).toBe(true);
  });

  test('reads GFS records through the configured parser', async () => {
    const parser = {
      readGridRecords: jest.fn(async () => [
        { lat: 40, lon: 116, values: { TCDC: 72 } }
      ])
    };
    const service = new GfsGridSourceService({
      dataDir: makeTempDir(),
      now: new Date('2026-05-26T10:15:00Z'),
      parser
    });
    const batch = service.buildRequestPlan({
      bbox: { north: 41, south: 39, west: 115, east: 117 },
      resolution: 1,
      forecastHours: 0
    }).batches[0];

    await expect(service.readGridRecords(batch)).resolves.toEqual([
      { lat: 40, lon: 116, values: { TCDC: 72 } }
    ]);
    expect(parser.readGridRecords).toHaveBeenCalledWith(batch);
  });

  test('requires an explicit GFS parser for real GRIB2 products', async () => {
    const service = new GfsGridSourceService({
      dataDir: makeTempDir(),
      now: new Date('2026-05-26T10:15:00Z'),
      parser: null
    });
    const batch = service.buildRequestPlan({
      bbox: { north: 41, south: 39, west: 115, east: 117 },
      resolution: 1,
      forecastHours: 0
    }).batches[0];

    await expect(service.readGridRecords(batch)).rejects.toMatchObject({
      code: 'GFS_GRIB_PARSER_NOT_CONFIGURED'
    });
  });
});
