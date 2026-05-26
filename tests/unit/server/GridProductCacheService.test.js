import fs from 'fs';
import os from 'os';
import path from 'path';

let GridProductCacheService;

beforeAll(async () => {
  const mod = await import('../../../server/services/GridProductCacheService.js');
  GridProductCacheService = mod.default || mod;
});

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'xiake-grid-product-cache-'));
}

describe('GridProductCacheService', () => {
  test('writes and reads standardized grid products with a manifest entry', () => {
    const dataDir = makeTempDir();
    const service = new GridProductCacheService({ dataDir, now: new Date('2026-05-26T12:00:00Z') });

    const written = service.writeProduct({
      source: 'gfs',
      productType: 'weather_grid',
      schemaVersion: 1,
      cycle: '2026052606',
      forecastHour: 6,
      validTime: '2026-05-26T12:00:00.000Z',
      grid: { bbox: { north: 41, south: 39, west: 115, east: 117 }, resolution: 0.5 },
      fields: ['TCDC'],
      points: [{ lat: 40, lon: 116, weather: { TCDC: 80 }, aerosol: {}, sourceMeta: {} }]
    });

    const loaded = service.readProduct(written.productId);
    const manifest = service.listManifest();

    expect(loaded.points[0].weather.TCDC).toBe(80);
    expect(manifest.products).toHaveLength(1);
    expect(manifest.products[0]).toMatchObject({
      productId: written.productId,
      source: 'gfs',
      productType: 'weather_grid',
      cycle: '2026052606',
      forecastHour: 6,
      byteSize: expect.any(Number)
    });
    expect(fs.existsSync(path.join(dataDir, 'data', 'cache', 'grid-products', `${written.productId}.json`))).toBe(true);
  });

  test('enforces low disk protection before writing a product', () => {
    const service = new GridProductCacheService({
      dataDir: makeTempDir(),
      freeDiskBytes: 2 * 1024 ** 3,
      minFreeDiskGb: 3
    });

    expect(() => service.writeProduct({
      source: 'cams',
      productType: 'aerosol_grid',
      schemaVersion: 1,
      cycle: '2026052600',
      forecastHour: 0,
      validTime: '2026-05-26T12:00:00.000Z',
      grid: { bbox: { north: 41, south: 39, west: 115, east: 117 }, resolution: 0.5 },
      fields: ['total_aerosol_optical_depth_550nm'],
      points: []
    })).toThrow(/free disk/i);
  });

  test('cleans raw tmp files older than the configured threshold', () => {
    const dataDir = makeTempDir();
    const service = new GridProductCacheService({ dataDir, now: new Date('2026-05-26T12:00:00Z') });
    const rawDir = path.join(dataDir, 'data', 'raw');
    fs.mkdirSync(rawDir, { recursive: true });
    fs.writeFileSync(path.join(rawDir, 'old.grib2'), 'old', 'utf8');
    fs.writeFileSync(path.join(rawDir, 'new.grib2'), 'new', 'utf8');
    const oldTime = new Date('2026-05-26T10:00:00Z');
    fs.utimesSync(path.join(rawDir, 'old.grib2'), oldTime, oldTime);

    const result = service.cleanupRawTmp({ olderThanMinutes: 60 });

    expect(result.deletedFiles).toEqual([path.join(rawDir, 'old.grib2')]);
    expect(fs.existsSync(path.join(rawDir, 'old.grib2'))).toBe(false);
    expect(fs.existsSync(path.join(rawDir, 'new.grib2'))).toBe(true);
  });
});
