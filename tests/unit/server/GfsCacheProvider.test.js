import fs from 'fs';
import os from 'os';
import path from 'path';

let GridProductCacheService;
let GfsCacheProvider;

beforeAll(async () => {
  const cacheMod = await import('../../../server/services/GridProductCacheService.js');
  GridProductCacheService = cacheMod.default || cacheMod;
  const providerMod = await import('../../../server/services/providers/GfsCacheProvider.js');
  GfsCacheProvider = providerMod.GfsCacheProvider;
});

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'xiake-gfs-cache-provider-'));
}

function writeGfsProduct(cacheService, forecastHour, validTime, point) {
  return cacheService.writeProduct({
    source: 'gfs',
    productType: 'weather_grid',
    schemaVersion: 1,
    cycle: '2026052912',
    forecastHour,
    validTime,
    grid: { bbox: { north: 41, south: 39, west: 115, east: 117 }, resolution: 0.5 },
    fields: Object.keys(point.weather),
    points: [point]
  });
}

describe('GfsCacheProvider', () => {
  test('serves normalized weather forecast from GFS grid products without external API calls', async () => {
    const dataDir = makeTempDir();
    const cacheService = new GridProductCacheService({ dataDir, now: new Date('2026-05-30T00:00:00Z') });
    writeGfsProduct(cacheService, 0, '2026-05-29T12:00:00.000Z', {
      lat: 40,
      lon: 116,
      weather: { TMP: 296.5, TCDC: 72, RH: 51, VIS: 18000, APCP: 0, LCDC: 12, MCDC: 33, HCDC: 61, UGRD: 3, VGRD: 4, DSWRF: 420, PWAT: 23 },
      aerosol: {},
      sourceMeta: {}
    });
    writeGfsProduct(cacheService, 6, '2026-05-29T18:00:00.000Z', {
      lat: 40,
      lon: 116,
      weather: { TMP: 292.15, TCDC: 40, RH: 60, VIS: 12000 },
      aerosol: {},
      sourceMeta: {}
    });
    const provider = new GfsCacheProvider({
      dataDir,
      cacheService,
      now: new Date('2026-05-29T11:30:00.000Z')
    });

    const result = await provider.fetchWeatherData(40.1, 116.1, 2);

    expect(result.providerMeta.name).toBe('gfs_cache');
    expect(result.providerMeta.cloudSource).toBe('NOAA GFS cache');
    expect(result.hours).toBe(2);
    expect(result.data[0]).toMatchObject({
      timestamp: new Date('2026-05-29T12:00:00.000Z').getTime(),
      temp: 23.35,
      cloudCover: 72,
      humidity: 51,
      visibility: 18,
      windSpeed: 5,
      lowClouds: 12,
      midClouds: 33,
      highClouds: 61,
      providerPoint: { lat: 40, lon: 116 },
      providerForecastHour: 0
    });
    expect(result.data[1].temp).toBe(19);
  });

  test('throws when no nearby cached grid point exists', async () => {
    const dataDir = makeTempDir();
    const cacheService = new GridProductCacheService({ dataDir });
    writeGfsProduct(cacheService, 0, '2026-05-29T12:00:00.000Z', {
      lat: 40,
      lon: 116,
      weather: { TMP: 296.5 },
      aerosol: {},
      sourceMeta: {}
    });
    const provider = new GfsCacheProvider({
      dataDir,
      cacheService,
      maxPointDistanceDeg: 0.25,
      now: new Date('2026-05-29T11:30:00.000Z')
    });

    await expect(provider.fetchWeatherData(45, 121, 1)).rejects.toMatchObject({
      code: 'GFS_CACHE_NO_NEARBY_POINT'
    });
  });

  test('ignores stale cache products for forecast responses', async () => {
    const dataDir = makeTempDir();
    const cacheService = new GridProductCacheService({ dataDir });
    writeGfsProduct(cacheService, 0, '2026-05-28T12:00:00.000Z', {
      lat: 40,
      lon: 116,
      weather: { TMP: 296.5 },
      aerosol: {},
      sourceMeta: {}
    });
    const provider = new GfsCacheProvider({
      dataDir,
      cacheService,
      now: new Date('2026-05-29T12:00:00.000Z')
    });

    await expect(provider.fetchWeatherData(40, 116, 1)).rejects.toMatchObject({
      code: 'GFS_CACHE_EMPTY_OR_STALE'
    });
  });
});
