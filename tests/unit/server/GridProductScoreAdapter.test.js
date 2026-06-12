import fs from 'fs';
import os from 'os';
import path from 'path';

let GridProductCacheService;
let GridProductScoreAdapter;
let calculateSolarAzimuth;

beforeAll(async () => {
  const cacheMod = await import('../../../server/services/GridProductCacheService.js');
  GridProductCacheService = cacheMod.default || cacheMod;
  const adapterMod = await import('../../../server/services/GridProductScoreAdapter.js');
  GridProductScoreAdapter = adapterMod.default || adapterMod;
  const predictionMod = await import('../../../server/services/EnhancedPredictionService.js');
  calculateSolarAzimuth = predictionMod.calculateSolarAzimuth;
});

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'xiake-grid-product-adapter-'));
}

function fullGfsWeather(overrides = {}) {
  return {
    TCDC: 58,
    LCDC: 18,
    MCDC: 46,
    HCDC: 72,
    RH: 55,
    VIS: 22000,
    APCP: 0,
    DSWRF: 120,
    PWAT: 18,
    UGRD: 2,
    VGRD: 3,
    ...overrides
  };
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
    fields: ['TCDC', 'LCDC', 'MCDC', 'HCDC', 'RH', 'VIS', 'APCP', 'DSWRF', 'PWAT', 'UGRD', 'VGRD'],
    sourceMeta: { requestId: 'gfs:2026052606:f006', rawPath: '/tmp/gfs.grib2' },
    points: [
      { lat: 40, lon: 116, weather: fullGfsWeather(), sourceMeta: { gfsForecastHour: 6 } },
      { lat: 40.5, lon: 116.5, firecloudScore: 91, weather: fullGfsWeather({ TCDC: 90 }), sourceMeta: { gfsForecastHour: 6 } }
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
      scoringContext: 'map_grid_directional',
      mapSimplifiedScoring: expect.objectContaining({
        applied: true,
        usesRemoteLightPathSamples: false
      }),
      mapDirectionalScoring: expect.objectContaining({
        reason: expect.any(String)
      }),
      weather: expect.objectContaining({ TCDC: 58, HCDC: 72, RH: 55 }),
      aerosol: { aod550: 0.18 },
      sourceMeta: {
        weather: { source: 'gfs', cycle: '2026052606', forecastHour: 6, bbox: { north: 41, south: 39, west: 115, east: 117 } },
        aerosol: { source: 'cams', cycle: '2026052600', forecastHour: 6, bbox: { north: 41, south: 39, west: 115, east: 117 } }
      }
    });
    expect(cache.gridPoints[1].score).toBe(22);
    expect(cache.gridPoints[1].score).not.toBe(91);
    expect(cache.meta.products.weather.source).toBe('gfs');
    expect(cache.meta.products.aerosol.source).toBe('cams');
    expect(cache.meta.products.weather.bbox).toEqual({ north: 41, south: 39, west: 115, east: 117 });
    expect(cache.meta.products.aerosol.sourceMeta.requestId).toBe('cams:2026052600:f006');
  });

  test('selects different forecast products for next sunrise and sunset target times', () => {
    const cacheService = new GridProductCacheService({
      dataDir: makeTempDir(),
      now: new Date('2026-05-30T21:00:00Z')
    });
    for (const validTime of ['2026-05-31T00:00:00.000Z', '2026-05-31T10:00:00.000Z']) {
      cacheService.writeProduct({
        source: 'gfs',
        productType: 'weather_grid',
        schemaVersion: 1,
        cycle: '2026053018',
        forecastHour: validTime.endsWith('00:00:00.000Z') ? 6 : 16,
        validTime,
        grid: { bbox: { north: 41, south: 39, west: 115, east: 117 }, resolution: 0.5 },
        fields: ['TCDC', 'LCDC', 'MCDC', 'HCDC', 'RH', 'VIS', 'APCP', 'DSWRF', 'PWAT', 'UGRD', 'VGRD'],
        points: [{ lat: 40, lon: 116, weather: fullGfsWeather() }]
      });
      cacheService.writeProduct({
        source: 'cams',
        productType: 'aerosol_grid',
        schemaVersion: 1,
        cycle: '2026053018',
        forecastHour: validTime.endsWith('00:00:00.000Z') ? 6 : 16,
        validTime,
        grid: { bbox: { north: 41, south: 39, west: 115, east: 117 }, resolution: 0.5 },
        fields: ['aod550'],
        points: [{ lat: 40, lon: 116, aerosol: { aod550: 0.18 } }]
      });
    }

    const adapter = new GridProductScoreAdapter({
      cacheService,
      now: new Date('2026-05-30T21:00:00Z')
    });
    const sunrise = adapter.getScoreCache('sunrise');
    const sunset = adapter.getScoreCache('sunset');

    expect(sunrise.meta.products.weather.validTime).toBe('2026-05-31T00:00:00.000Z');
    expect(sunset.meta.products.weather.validTime).toBe('2026-05-31T10:00:00.000Z');
    expect(sunrise.meta.targetTime).not.toBe(sunset.meta.targetTime);
  });

  test('keeps advancing sunrise target after the Beijing event buffer has passed', () => {
    const cacheService = new GridProductCacheService({
      dataDir: makeTempDir(),
      now: new Date('2026-05-30T20:00:00Z')
    });
    for (const validTime of ['2026-05-30T20:48:00.000Z', '2026-05-31T20:48:00.000Z']) {
      cacheService.writeProduct({
        source: 'gfs',
        productType: 'weather_grid',
        schemaVersion: 1,
        cycle: '2026053018',
        forecastHour: 6,
        validTime,
        grid: { bbox: { north: 41, south: 39, west: 115, east: 117 }, resolution: 0.5 },
        fields: ['TCDC', 'LCDC', 'MCDC', 'HCDC', 'RH', 'VIS', 'APCP', 'DSWRF', 'PWAT', 'UGRD', 'VGRD'],
        points: [{ lat: 40, lon: 116, weather: fullGfsWeather() }]
      });
    }

    const adapter = new GridProductScoreAdapter({
      cacheService,
      now: new Date('2026-05-30T21:30:00Z')
    });
    const sunrise = adapter.getScoreCache('sunrise');

    expect(sunrise.meta.products.weather.validTime).toBe('2026-05-31T20:48:00.000Z');
    expect(new Date(sunrise.meta.targetTime).getTime()).toBeGreaterThan(new Date('2026-05-30T21:30:00Z').getTime());
  });

  test('uses product createdAt as public map update time, not forecast validTime', () => {
    const cacheService = new GridProductCacheService({
      dataDir: makeTempDir(),
      now: new Date('2026-05-30T20:10:00Z')
    });
    cacheService.writeProduct({
      source: 'gfs',
      productType: 'weather_grid',
      schemaVersion: 1,
      cycle: '2026053018',
      forecastHour: 6,
      validTime: '2026-05-31T00:00:00.000Z',
      grid: { bbox: { north: 41, south: 39, west: 115, east: 117 }, resolution: 0.5 },
      fields: ['TCDC', 'LCDC', 'MCDC', 'HCDC', 'RH', 'VIS', 'APCP', 'DSWRF', 'PWAT', 'UGRD', 'VGRD'],
      points: [{ lat: 40, lon: 116, weather: fullGfsWeather() }]
    });

    const adapter = new GridProductScoreAdapter({
      cacheService,
      now: new Date('2026-05-30T21:00:00Z')
    });
    const cache = adapter.getScoreCache('sunrise');

    expect(cache.updatedAt).toBe('2026-05-30T20:10:00.000Z');
    expect(cache.updatedAt).not.toBe(cache.meta.products.weather.validTime);
    expect(cache.meta.products.weather.validTime).toBe('2026-05-31T00:00:00.000Z');
  });

  test('serves a degraded GFS-only score cache when CAMS aerosol is missing', () => {
    const cacheService = new GridProductCacheService({ dataDir: makeTempDir() });
    cacheService.writeProduct({
      source: 'gfs',
      productType: 'weather_grid',
      schemaVersion: 1,
      cycle: '2026052606',
      forecastHour: 6,
      validTime: '2026-05-26T12:00:00.000Z',
      grid: { bbox: { north: 41, south: 39, west: 115, east: 117 }, resolution: 0.5 },
      fields: ['TCDC', 'LCDC', 'MCDC', 'HCDC', 'RH', 'VIS', 'APCP', 'PWAT', 'DSWRF', 'UGRD', 'VGRD'],
      points: [{
        lat: 40,
        lon: 116,
        weather: fullGfsWeather()
      }]
    });

    const adapter = new GridProductScoreAdapter({ cacheService });
    const cache = adapter.getScoreCache('sunset');

    expect(cache).toMatchObject({
      source: 'grid-product-cache',
      degraded: true,
      degradedReason: 'CAMS_AEROSOL_CACHE_NOT_READY',
      meta: { products: { aerosol: null } }
    });
    expect(cache.gridPoints).toHaveLength(1);
    expect(cache.gridPoints[0]).toMatchObject({
      lat: 40,
      lon: 116,
      quality: expect.any(String),
      weather: expect.objectContaining({ TCDC: 58, HCDC: 72, RH: 55 })
    });
    expect(Number.isFinite(cache.gridPoints[0].score)).toBe(true);
  });

  test('does not score GFS points with missing required weather fields', () => {
    const cacheService = new GridProductCacheService({ dataDir: makeTempDir() });
    cacheService.writeProduct({
      source: 'gfs',
      productType: 'weather_grid',
      schemaVersion: 1,
      cycle: '2026052606',
      forecastHour: 6,
      validTime: '2026-05-26T12:00:00.000Z',
      grid: { bbox: { north: 41, south: 39, west: 115, east: 117 }, resolution: 0.5 },
      fields: ['TCDC', 'HCDC'],
      points: [{ lat: 40, lon: 116, weather: { TCDC: 58, HCDC: 72 } }]
    });

    const adapter = new GridProductScoreAdapter({ cacheService });

    expect(adapter.getScoreCache('sunset')).toBeNull();
  });

  test('returns null when the GFS weather product is missing', () => {
    const cacheService = new GridProductCacheService({ dataDir: makeTempDir() });
    cacheService.writeProduct({
      source: 'cams',
      productType: 'aerosol_grid',
      schemaVersion: 1,
      cycle: '2026052600',
      forecastHours: [6],
      validTime: '2026-05-26T12:00:00.000Z',
      grid: { bbox: { north: 41, south: 39, west: 115, east: 117 }, resolution: 0.5 },
      fields: ['aod550'],
      points: [{ lat: 40, lon: 116, aerosol: { aod550: 0.2 } }]
    });

    const adapter = new GridProductScoreAdapter({ cacheService });

    expect(adapter.getScoreCache('sunset')).toBeNull();
  });

  test('does not use stale CAMS aerosol products with fresh GFS weather', () => {
    const cacheService = new GridProductCacheService({
      dataDir: makeTempDir(),
      now: new Date('2026-05-29T18:30:00Z')
    });
    cacheService.writeProduct({
      source: 'gfs',
      productType: 'weather_grid',
      schemaVersion: 1,
      cycle: '2026052912',
      forecastHour: 6,
      validTime: '2026-05-29T18:00:00.000Z',
      grid: { bbox: { north: 43, south: 38, west: 113, east: 118 }, resolution: 0.5 },
      fields: ['TCDC', 'LCDC', 'MCDC', 'HCDC', 'RH', 'VIS', 'APCP', 'DSWRF', 'PWAT', 'UGRD', 'VGRD'],
      points: [{ lat: 40, lon: 116, weather: fullGfsWeather() }]
    });
    cacheService.writeProduct({
      source: 'cams',
      productType: 'aerosol_grid',
      schemaVersion: 1,
      cycle: '2026052700',
      forecastHours: [6],
      validTime: '2026-05-27T06:00:00.000Z',
      grid: { bbox: { north: 43, south: 38, west: 113, east: 118 }, resolution: 0.5 },
      fields: ['aod550'],
      points: [{ lat: 40, lon: 116, aerosol: { aod550: 0.2 } }]
    });

    const adapter = new GridProductScoreAdapter({ cacheService });
    const cache = adapter.getScoreCache('sunset');

    expect(cache.degraded).toBe(true);
    expect(cache.degradedReason).toBe('CAMS_AEROSOL_CACHE_NOT_READY');
    expect(cache.meta.products.aerosol).toBeNull();
    expect(cache.gridPoints[0].aerosol).toEqual({});
  });

  test('uses sunset-direction neighboring grid cells as regional light-path trend', () => {
    const cacheService = new GridProductCacheService({
      dataDir: makeTempDir(),
      now: new Date('2026-05-26T12:30:00Z')
    });
    cacheService.writeProduct({
      source: 'gfs',
      productType: 'weather_grid',
      schemaVersion: 1,
      cycle: '2026052606',
      forecastHour: 6,
      validTime: '2026-05-26T11:30:00.000Z',
      grid: { bbox: { north: 41, south: 39, west: 115, east: 117 }, resolution: 0.5 },
      fields: ['TCDC', 'LCDC', 'MCDC', 'HCDC', 'RH', 'VIS', 'APCP', 'DSWRF', 'PWAT', 'UGRD', 'VGRD'],
      points: [
        {
          lat: 40,
          lon: 116,
          weather: fullGfsWeather({ TCDC: 50, LCDC: 4, MCDC: 30, HCDC: 40, DSWRF: 90 })
        },
        {
          lat: 40.2,
          lon: 115.5,
          weather: fullGfsWeather({ TCDC: 98, LCDC: 0, MCDC: 86, HCDC: 96, DSWRF: 85 })
        },
        {
          lat: 40.4,
          lon: 115.0,
          weather: fullGfsWeather({ TCDC: 92, LCDC: 0, MCDC: 70, HCDC: 84, DSWRF: 80 })
        }
      ]
    });

    const adapter = new GridProductScoreAdapter({ cacheService });
    const cache = adapter.getScoreCache('sunset');
    const center = cache.gridPoints.find(point => point.lat === 40 && point.lon === 116);

    expect(center.scoringContext).toBe('map_grid_directional');
    expect(center.mapDirectionalScoring).toMatchObject({
      applied: true,
      reason: 'gfs_cams_directional_neighbor_grid',
      neighborCount: expect.any(Number),
      adjustment: expect.objectContaining({
        applied: true,
        reason: 'directional_neighbor_upper_cloud_lift'
      })
    });
    expect(center.mapDirectionalScoring.directionalUpperCarrier).toBeGreaterThanOrEqual(80);
    expect(center.score).toBeGreaterThan(center.mapDirectionalScoring.adjustment.originalScore);
  });

  test('caps map simplified base scores before directional lift', () => {
    const cacheService = new GridProductCacheService({
      dataDir: makeTempDir(),
      now: new Date('2026-05-26T12:30:00Z')
    });
    cacheService.writeProduct({
      source: 'gfs',
      productType: 'weather_grid',
      schemaVersion: 1,
      cycle: '2026052606',
      forecastHour: 6,
      validTime: '2026-05-26T11:30:00.000Z',
      grid: { bbox: { north: 41, south: 39, west: 115, east: 117 }, resolution: 0.5 },
      fields: ['TCDC', 'LCDC', 'MCDC', 'HCDC', 'RH', 'VIS', 'APCP', 'DSWRF', 'PWAT', 'UGRD', 'VGRD'],
      points: [{
        lat: 40,
        lon: 116,
        weather: fullGfsWeather({ TCDC: 100, LCDC: 0, MCDC: 100, HCDC: 100, DSWRF: 180 })
      }]
    });

    const adapter = new GridProductScoreAdapter({ cacheService });
    const cache = adapter.getScoreCache('sunset');

    expect(cache.gridPoints[0].score).toBeLessThanOrEqual(78);
    expect(cache.gridPoints[0].mapSimplifiedScoring).toMatchObject({
      cap: 78
    });
  });

  test('uses buffered directional neighbors without exposing buffer cells in public cache', () => {
    const cacheService = new GridProductCacheService({
      dataDir: makeTempDir(),
      now: new Date('2026-05-26T12:30:00Z')
    });
    const outputBbox = { north: 40, south: 40, west: 116, east: 116 };
    cacheService.writeProduct({
      source: 'gfs',
      productType: 'weather_grid',
      schemaVersion: 1,
      cycle: '2026052606',
      forecastHour: 6,
      validTime: '2026-05-26T11:30:00.000Z',
      grid: { bbox: { north: 41, south: 39, west: 115, east: 117 }, resolution: 0.5 },
      sourceMeta: { outputBbox },
      fields: ['TCDC', 'LCDC', 'MCDC', 'HCDC', 'RH', 'VIS', 'APCP', 'DSWRF', 'PWAT', 'UGRD', 'VGRD'],
      points: [
        {
          lat: 40,
          lon: 116,
          weather: fullGfsWeather({ TCDC: 50, LCDC: 4, MCDC: 30, HCDC: 40, DSWRF: 90 })
        },
        {
          lat: 40.2,
          lon: 115.5,
          weather: fullGfsWeather({ TCDC: 98, LCDC: 0, MCDC: 86, HCDC: 96, DSWRF: 85 })
        }
      ]
    });

    const adapter = new GridProductScoreAdapter({ cacheService });
    const cache = adapter.getScoreCache('sunset');

    expect(cache.gridPoints).toHaveLength(1);
    expect(cache.gridPoints[0]).toMatchObject({
      lat: 40,
      lon: 116,
      mapDirectionalScoring: expect.objectContaining({
        applied: true,
        neighborCount: 1,
        adjustment: expect.objectContaining({
          reason: 'directional_neighbor_upper_cloud_lift'
        })
      })
    });
    expect(cache.meta.outputBbox).toEqual(outputBbox);
    expect(cache.meta.products.weather.outputBbox).toEqual(outputBbox);
  });

  test('ignores CAMS-only points when selecting directional weather neighbors', () => {
    const cacheService = new GridProductCacheService({
      dataDir: makeTempDir(),
      now: new Date('2026-05-26T12:30:00Z')
    });
    cacheService.writeProduct({
      source: 'gfs',
      productType: 'weather_grid',
      schemaVersion: 1,
      cycle: '2026052606',
      forecastHour: 6,
      validTime: '2026-05-26T11:30:00.000Z',
      grid: { bbox: { north: 41, south: 39, west: 115, east: 117 }, resolution: 0.5 },
      fields: ['TCDC', 'LCDC', 'MCDC', 'HCDC', 'RH', 'VIS', 'APCP', 'DSWRF', 'PWAT', 'UGRD', 'VGRD'],
      points: [
        {
          lat: 40,
          lon: 116,
          weather: fullGfsWeather({ TCDC: 50, LCDC: 4, MCDC: 30, HCDC: 40, DSWRF: 90 })
        },
        {
          lat: 40.2,
          lon: 115.5,
          weather: fullGfsWeather({ TCDC: 98, LCDC: 0, MCDC: 86, HCDC: 96, DSWRF: 85 })
        }
      ]
    });
    cacheService.writeProduct({
      source: 'cams',
      productType: 'aerosol_grid',
      schemaVersion: 1,
      cycle: '2026052600',
      forecastHour: 6,
      validTime: '2026-05-26T11:30:00.000Z',
      grid: { bbox: { north: 41, south: 39, west: 115, east: 117 }, resolution: 0.5 },
      fields: ['aod550'],
      points: [
        { lat: 40, lon: 116, aerosol: { aod550: 0.2 } },
        { lat: 40.18, lon: 115.55, aerosol: { aod550: 0.3 } }
      ]
    });

    const adapter = new GridProductScoreAdapter({ cacheService });
    const cache = adapter.getScoreCache('sunset');
    const center = cache.gridPoints.find(point => point.lat === 40 && point.lon === 116);

    expect(center.mapDirectionalScoring.samples[0]).toMatchObject({
      lat: 40.2,
      lon: 115.5
    });
    expect(center.mapDirectionalScoring.directionalUpperCarrier).toBeGreaterThan(80);
  });

  test('uses the map event time, not product validTime, for directional bearing', () => {
    const cacheService = new GridProductCacheService({
      dataDir: makeTempDir(),
      now: new Date('2026-05-30T21:00:00Z')
    });
    cacheService.writeProduct({
      source: 'gfs',
      productType: 'weather_grid',
      schemaVersion: 1,
      cycle: '2026053018',
      forecastHour: 6,
      validTime: '2026-05-31T00:00:00.000Z',
      grid: { bbox: { north: 41, south: 39, west: 115, east: 117 }, resolution: 0.5 },
      fields: ['TCDC', 'LCDC', 'MCDC', 'HCDC', 'RH', 'VIS', 'APCP', 'DSWRF', 'PWAT', 'UGRD', 'VGRD'],
      points: [{ lat: 40, lon: 116, weather: fullGfsWeather() }]
    });

    const adapter = new GridProductScoreAdapter({
      cacheService,
      now: new Date('2026-05-30T21:00:00Z')
    });
    const cache = adapter.getScoreCache('sunrise');
    const point = cache.gridPoints[0];
    const eventAzimuth = parseFloat(calculateSolarAzimuth(
      new Date(cache.meta.targetTime),
      point.lat,
      point.lon
    ).toFixed(1));
    const productAzimuth = parseFloat(calculateSolarAzimuth(
      new Date(cache.meta.products.weather.validTime),
      point.lat,
      point.lon
    ).toFixed(1));

    expect(point.mapDirectionalScoring.azimuth).toBe(eventAzimuth);
    expect(point.mapDirectionalScoring.azimuth).not.toBe(productAzimuth);
  });

  test('keeps local low-cloud cover from being lifted by a strong directional neighbor', () => {
    const cacheService = new GridProductCacheService({
      dataDir: makeTempDir(),
      now: new Date('2026-05-26T12:30:00Z')
    });
    cacheService.writeProduct({
      source: 'gfs',
      productType: 'weather_grid',
      schemaVersion: 1,
      cycle: '2026052606',
      forecastHour: 6,
      validTime: '2026-05-26T11:30:00.000Z',
      grid: { bbox: { north: 41, south: 39, west: 115, east: 117 }, resolution: 0.5 },
      fields: ['TCDC', 'LCDC', 'MCDC', 'HCDC', 'RH', 'VIS', 'APCP', 'DSWRF', 'PWAT', 'UGRD', 'VGRD'],
      points: [
        {
          lat: 40,
          lon: 116,
          weather: fullGfsWeather({ TCDC: 96, LCDC: 82, MCDC: 52, HCDC: 74, DSWRF: 70 })
        },
        {
          lat: 40.2,
          lon: 115.5,
          weather: fullGfsWeather({ TCDC: 98, LCDC: 0, MCDC: 86, HCDC: 96, DSWRF: 85 })
        }
      ]
    });

    const adapter = new GridProductScoreAdapter({ cacheService });
    const cache = adapter.getScoreCache('sunset');
    const center = cache.gridPoints.find(point => point.lat === 40 && point.lon === 116);

    expect(center.mapDirectionalScoring.adjustment).toMatchObject({
      reason: 'local_low_cloud_or_precip_blocks_map_directional_lift'
    });
    expect(center.score).toBeLessThanOrEqual(35);
  });
});
