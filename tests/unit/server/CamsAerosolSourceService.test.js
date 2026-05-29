import fs from 'fs';
import os from 'os';
import path from 'path';

let CamsAerosolSourceService;
let CamsNetcdfParserService;
let CamsCdsDownloaderService;

beforeAll(async () => {
  const mod = await import('../../../server/services/CamsAerosolSourceService.js');
  CamsAerosolSourceService = mod.default || mod;
  const parserMod = await import('../../../server/services/CamsNetcdfParserService.js');
  CamsNetcdfParserService = parserMod.default || parserMod;
  const downloaderMod = await import('../../../server/services/CamsCdsDownloaderService.js');
  CamsCdsDownloaderService = downloaderMod.default || downloaderMod;
});

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'xiake-cams-source-'));
}

function writeNodeScript(dir, body) {
  const scriptPath = path.join(dir, 'script.js');
  fs.writeFileSync(scriptPath, body);
  return scriptPath;
}

describe('CamsAerosolSourceService', () => {
  test('builds CAMS analysis request batch for a bbox-limited aerosol plan', () => {
    const service = new CamsAerosolSourceService({ dataDir: makeTempDir(), now: new Date('2026-05-26T10:15:00Z') });

    const plan = service.buildRequestPlan({
      bbox: { north: 54, south: 18, west: 73, east: 135 },
      resolution: 0.5,
      forecastHours: 48,
      forecastStepHours: 3
    });

    expect(plan.source).toBe('cams');
    expect(plan.cycle).toBe('2026052600');
    expect(plan.forecastHours).toEqual([]);
    expect(plan.batches).toHaveLength(1);
    expect(plan.batches[0]).toMatchObject({
      source: 'cams',
      productType: 'analysis',
      forecastHours: [],
      variables: CamsAerosolSourceService.FIELD_WHITELIST,
      cleanupRawAfterProcess: true
    });
    expect(plan.batches[0].request).toMatchObject({
      type: 'analysis',
      format: 'netcdf',
      area: [54, 73, 18, 135]
    });
    expect(plan.batches[0].request.leadtime_hour).toBeUndefined();
  });

  test('normalizes CAMS records into aerosol grid points on the target grid', () => {
    const service = new CamsAerosolSourceService({
      dataDir: makeTempDir(),
      now: new Date('2026-05-26T10:15:00Z'),
      batchForecastCount: 2
    });
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
      forecastHour: null,
      forecastHours: [],
      validTime: '2026-05-26T00:00:00.000Z',
      grid: { resolution: 0.5, bbox: { north: 41, south: 39, west: 115, east: 117 } },
      interpolation: { targetResolution: 0.5, method: 'deferred-bilinear' },
      fields: expect.arrayContaining(['total_aerosol_optical_depth_550nm', 'particulate_matter_10um'])
    });
    expect(product.points[0]).toEqual({
      lat: 40,
      lon: 116,
      weather: {},
      aerosol: { total_aerosol_optical_depth_550nm: 0.22, particulate_matter_10um: 38 },
      sourceMeta: { camsProductType: 'analysis', camsForecastHour: 3, interpolation: 'deferred-bilinear' }
    });
  });

  test('normalizes CAMS analysis product with validTime for GFS matching', () => {
    const service = new CamsAerosolSourceService({
      dataDir: makeTempDir(),
      now: new Date('2026-05-26T10:15:00Z'),
      batchForecastCount: 1
    });
    const batch = service.buildRequestPlan({
      bbox: { north: 41, south: 39, west: 115, east: 117 },
      resolution: 0.5,
      forecastHours: 6,
      forecastStepHours: 6
    }).batches[0];

    const product = service.normalizeGridProduct(batch, [
      {
        lat: 40,
        lon: 116,
        forecastHour: 0,
        values: { total_aerosol_optical_depth_550nm: 0.22 }
      }
    ]);

    expect(product).toMatchObject({
      forecastHour: null,
      forecastHours: [],
      validTime: '2026-05-26T00:00:00.000Z'
    });
  });

  test('delegates CAMS downloads to an explicit ADS/CDS downloader adapter', async () => {
    const service = new CamsAerosolSourceService({
      dataDir: makeTempDir(),
      now: new Date('2026-05-26T10:15:00Z'),
      downloader: {
        async downloadBatch(batch) {
          return { bytesDownloaded: 2048, rawPath: batch.rawPath };
        }
      }
    });
    const batch = service.buildRequestPlan({
      bbox: { north: 41, south: 39, west: 115, east: 117 },
      resolution: 1,
      forecastHours: 3,
      forecastStepHours: 3
    }).batches[0];

    await expect(service.downloadBatch(batch)).resolves.toEqual({
      bytesDownloaded: 2048,
      rawPath: batch.rawPath
    });
  });

  test('uses production CAMS downloader and NetCDF parser adapters by default', () => {
    const service = new CamsAerosolSourceService({ dataDir: makeTempDir(), now: new Date('2026-05-26T10:15:00Z') });

    expect(service.downloader).toBeInstanceOf(CamsCdsDownloaderService);
    expect(service.parser).toBeInstanceOf(CamsNetcdfParserService);
  });
});

describe('CamsNetcdfParserService', () => {
  test('returns records from parser JSON output', async () => {
    const dir = makeTempDir();
    const rawPath = path.join(dir, 'sample.netcdf_zip');
    fs.writeFileSync(rawPath, 'fake-netcdf');
    const scriptPath = writeNodeScript(dir, 'process.stdout.write(JSON.stringify({ records: [{ lat: 40, lon: 116, forecastHour: 6, values: { total_aerosol_optical_depth_550nm: 0.18 } }] }));');
    const service = new CamsNetcdfParserService({
      pythonPath: process.execPath,
      scriptPath
    });

    await expect(service.readGridRecords({
      rawPath,
      bbox: { north: 41, south: 39, west: 115, east: 117 },
      resolution: 1
    })).resolves.toEqual([
      { lat: 40, lon: 116, forecastHour: 6, values: { total_aerosol_optical_depth_550nm: 0.18 } }
    ]);
  });

  test('rejects missing raw files before invoking parser', async () => {
    const service = new CamsNetcdfParserService({
      pythonPath: process.execPath,
      scriptPath: path.join(makeTempDir(), 'missing-parser.js')
    });

    await expect(service.readGridRecords({
      rawPath: path.join(makeTempDir(), 'missing.netcdf_zip'),
      bbox: { north: 41, south: 39, west: 115, east: 117 },
      resolution: 1
    })).rejects.toMatchObject({ code: 'CAMS_RAW_FILE_NOT_FOUND' });
  });

  test('rejects invalid parser JSON output', async () => {
    const dir = makeTempDir();
    const rawPath = path.join(dir, 'sample.netcdf_zip');
    fs.writeFileSync(rawPath, 'fake-netcdf');
    const scriptPath = writeNodeScript(dir, 'process.stdout.write("not-json");');
    const service = new CamsNetcdfParserService({
      pythonPath: process.execPath,
      scriptPath
    });

    await expect(service.readGridRecords({
      rawPath,
      bbox: { north: 41, south: 39, west: 115, east: 117 },
      resolution: 1
    })).rejects.toMatchObject({ code: 'CAMS_NETCDF_PARSER_INVALID_JSON' });
  });

  test('rejects parser process failures', async () => {
    const dir = makeTempDir();
    const rawPath = path.join(dir, 'sample.netcdf_zip');
    fs.writeFileSync(rawPath, 'fake-netcdf');
    const scriptPath = writeNodeScript(dir, 'process.stderr.write("parser failed"); process.exit(2);');
    const service = new CamsNetcdfParserService({
      pythonPath: process.execPath,
      scriptPath
    });

    await expect(service.readGridRecords({
      rawPath,
      bbox: { north: 41, south: 39, west: 115, east: 117 },
      resolution: 1
    })).rejects.toMatchObject({ code: 'CAMS_NETCDF_PARSER_FAILED' });
  });
});

describe('CamsCdsDownloaderService', () => {
  test('writes request JSON and returns downloaded byte count', async () => {
    const dir = makeTempDir();
    const scriptPath = writeNodeScript(dir, `
      const fs = require('fs');
      const output = process.argv[process.argv.indexOf('--output') + 1];
      fs.writeFileSync(output, 'cams');
      process.stdout.write(JSON.stringify({ bytesDownloaded: 4, rawPath: output }));
    `);
    const service = new CamsCdsDownloaderService({
      pythonPath: process.execPath,
      scriptPath
    });
    const source = new CamsAerosolSourceService({
      dataDir: dir,
      now: new Date('2026-05-26T10:15:00Z')
    });
    const batch = source.buildRequestPlan({
      bbox: { north: 41, south: 39, west: 115, east: 117 },
      resolution: 1,
      forecastHours: 3,
      forecastStepHours: 3
    }).batches[0];

    const result = await service.downloadBatch(batch);

    expect(result).toEqual({ bytesDownloaded: 4, rawPath: batch.rawPath });
    expect(fs.existsSync(batch.rawPath)).toBe(true);
  });
});
