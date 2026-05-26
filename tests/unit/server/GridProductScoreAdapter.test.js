import fs from 'fs';
import os from 'os';
import path from 'path';

let GridProductCacheService;
let GridProductScoreAdapter;

beforeAll(async () => {
  const cacheMod = await import('../../../server/services/GridProductCacheService.js');
  GridProductCacheService = cacheMod.default || cacheMod;
  const adapterMod = await import('../../../server/services/GridProductScoreAdapter.js');
  GridProductScoreAdapter = adapterMod.default || adapterMod;
});

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'xiake-grid-product-adapter-'));
}

function writeProducts(cacheService) {
  cacheService.writeProduct({
    source: 'gfs',
    productType: 'weather_grid',
    schemaVersion: 1,
    cycle: '2026052606',
    forecastHour: 6,
    validTime: '2026-05-26T12:00:00.000Z',
    grid: { bbox: { north: 41, south: 39, west: 115, east: 117 }, resolution: 0.5 },
    fields: ['total_cloud_cover', 'high_cloud_cover', 'relative_humidity'],
    sourceMeta: { requestId: 'gfs:2026052606:f006', rawPath: '/tmp/gfs.grib2' },
    points: [
      { lat: 40, lon: 116, weather: { total_cloud_cover: 45, high_cloud_cover: 72, relative_humidity: 56 }, sourceMeta: { gfsForecastHour: 6 } },
      { lat: 40.5, lon: 116.5, firecloudScore: 91, weather: { total_cloud_cover: 90 }, sourceMeta: { gfsForecastHour: 6 } }
    ]
  });
  cacheService.writeProduct({
    source: 'cams',
    productType: 'aerosol_grid',
    schemaVersion: 1,
    cycle: '2026052600',
    forecastHour: 6,
    validTime: '2026-05-26T12:00:00.000Z',
    grid: { bbox: { north: 41, south: 39, west: 115, east: 117 }, resolution: 0.5 },
    fields: ['aod550'],
    sourceMeta: { requestId: 'cams:2026052600:f006', rawPath: '/tmp/cams.nc' },
    points: [
      { lat: 40, lon: 116, aerosol: { aod550: 0.18 }, sourceMeta: { camsForecastHour: 6 } },
      { lat: 40.5, lon: 116.5, score: 64, aerosol: { aod550: 0.6 }, sourceMeta: { camsForecastHour: 6 } }
    ]
  });
}

describe('GridProductScoreAdapter', () => {
  test('turns latest GFS weather_grid and CAMS aerosol_grid products into scored grid cache', () => {
    const cacheService = new GridProductCacheService({
      dataDir: makeTempDir(),
      now: new Date('2026-05-26T12:30:00Z')
    });
    writeProducts(cacheService);

    const adapter = new GridProductScoreAdapter({ cacheService });
    const cache = adapter.getScoreCache('sunset');

    expect(cache).toMatchObject({
      period: 'sunset',
      updatedAt: '2026-05-26T12:30:00.000Z',
      source: 'grid-product-cache',
      degraded: false
    });
    expect(cache.gridPoints).toHaveLength(2);
    expect(cache.gridPoints[0]).toMatchObject({
      lat: 40,
      lon: 116,
      score: expect.any(Number),
      weather: { total_cloud_cover: 45 },
      aerosol: { aod550: 0.18 },
      sourceMeta: {
        weather: { source: 'gfs', cycle: '2026052606', forecastHour: 6, bbox: { north: 41, south: 39, west: 115, east: 117 } },
        aerosol: { source: 'cams', cycle: '2026052600', forecastHour: 6, bbox: { north: 41, south: 39, west: 115, east: 117 } }
      }
    });
    expect(cache.gridPoints[1].score).toBe(91);
    expect(cache.meta.products.weather.source).toBe('gfs');
    expect(cache.meta.products.aerosol.source).toBe('cams');
    expect(cache.meta.products.weather.bbox).toEqual({ north: 41, south: 39, west: 115, east: 117 });
    expect(cache.meta.products.aerosol.sourceMeta.requestId).toBe('cams:2026052600:f006');
  });

  test('returns null when either standardized product is missing', () => {
    const cacheService = new GridProductCacheService({ dataDir: makeTempDir() });
    cacheService.writeProduct({
      source: 'gfs',
      productType: 'weather_grid',
      schemaVersion: 1,
      cycle: '2026052606',
      forecastHour: 6,
      validTime: '2026-05-26T12:00:00.000Z',
      grid: { bbox: { north: 41, south: 39, west: 115, east: 117 }, resolution: 0.5 },
      fields: ['total_cloud_cover'],
      points: [{ lat: 40, lon: 116, score: 80 }]
    });

    const adapter = new GridProductScoreAdapter({ cacheService });

    expect(adapter.getScoreCache('sunset')).toBeNull();
  });
});
