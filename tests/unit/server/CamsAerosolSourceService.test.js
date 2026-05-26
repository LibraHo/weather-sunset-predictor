import fs from 'fs';
import os from 'os';
import path from 'path';

let CamsAerosolSourceService;

beforeAll(async () => {
  const mod = await import('../../../server/services/CamsAerosolSourceService.js');
  CamsAerosolSourceService = mod.default || mod;
});

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'xiake-cams-source-'));
}

describe('CamsAerosolSourceService', () => {
  test('builds CAMS request batches for a 48h bbox-limited aerosol plan', () => {
    const service = new CamsAerosolSourceService({ dataDir: makeTempDir(), now: new Date('2026-05-26T10:15:00Z') });

    const plan = service.buildRequestPlan({
      bbox: { north: 54, south: 18, west: 73, east: 135 },
      resolution: 0.5,
      forecastHours: 48,
      forecastStepHours: 3
    });

    expect(plan.source).toBe('cams');
    expect(plan.cycle).toBe('2026052600');
    expect(plan.forecastHours).toEqual([0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42, 45, 48]);
    expect(plan.batches[0]).toMatchObject({
      source: 'cams',
      forecastHours: [0, 3, 6],
      variables: CamsAerosolSourceService.FIELD_WHITELIST,
      cleanupRawAfterProcess: true
    });
    expect(plan.batches[0].request).toMatchObject({
      format: 'netcdf',
      area: [54, 73, 18, 135]
    });
  });

  test('normalizes CAMS records into aerosol grid points on the target grid', () => {
    const service = new CamsAerosolSourceService({ dataDir: makeTempDir(), now: new Date('2026-05-26T10:15:00Z') });
    const batch = service.buildRequestPlan({
      bbox: { north: 41, south: 39, west: 115, east: 117 },
      resolution: 0.5,
      forecastHours: 3,
      forecastStepHours: 3
    }).batches[0];

    const product = service.normalizeGridProduct(batch, [
      {
        lat: 40,
        lon: 116,
        forecastHour: 3,
        values: { total_aerosol_optical_depth_550nm: 0.22, particulate_matter_10um: 38 }
      }
    ]);

    expect(product).toMatchObject({
      source: 'cams',
      productType: 'aerosol_grid',
      schemaVersion: 1,
      grid: { resolution: 0.5, bbox: { north: 41, south: 39, west: 115, east: 117 } },
      interpolation: { targetResolution: 0.5, method: 'deferred-bilinear' },
      fields: expect.arrayContaining(['total_aerosol_optical_depth_550nm', 'particulate_matter_10um'])
    });
    expect(product.points[0]).toEqual({
      lat: 40,
      lon: 116,
      weather: {},
      aerosol: { total_aerosol_optical_depth_550nm: 0.22, particulate_matter_10um: 38 },
      sourceMeta: { camsForecastHour: 3, interpolation: 'deferred-bilinear' }
    });
  });
});
