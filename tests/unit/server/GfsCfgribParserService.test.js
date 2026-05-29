import fs from 'fs';
import os from 'os';
import path from 'path';

let GfsCfgribParserService;

beforeAll(async () => {
  const mod = await import('../../../server/services/GfsCfgribParserService.js');
  GfsCfgribParserService = mod.default || mod;
});

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'xiake-gfs-parser-'));
}

function writeNodeScript(dir, body) {
  const scriptPath = path.join(dir, 'parser.js');
  fs.writeFileSync(scriptPath, body);
  return scriptPath;
}

describe('GfsCfgribParserService', () => {
  test('returns records from parser JSON output', async () => {
    const dir = makeTempDir();
    const rawPath = path.join(dir, 'sample.grib2');
    fs.writeFileSync(rawPath, 'fake-grib');
    const scriptPath = writeNodeScript(dir, 'process.stdout.write(JSON.stringify({ records: [{ lat: 40, lon: 116, values: { TCDC: 80 } }] }));');
    const service = new GfsCfgribParserService({
      pythonPath: process.execPath,
      scriptPath
    });

    await expect(service.readGridRecords({
      rawPath,
      bbox: { north: 41, south: 39, west: 115, east: 117 },
      resolution: 1
    })).resolves.toEqual([
      { lat: 40, lon: 116, values: { TCDC: 80 } }
    ]);
  });

  test('rejects missing raw files before invoking parser', async () => {
    const service = new GfsCfgribParserService({
      pythonPath: process.execPath,
      scriptPath: path.join(makeTempDir(), 'missing-parser.js')
    });

    await expect(service.readGridRecords({
      rawPath: path.join(makeTempDir(), 'missing.grib2'),
      bbox: { north: 41, south: 39, west: 115, east: 117 },
      resolution: 1
    })).rejects.toMatchObject({ code: 'GFS_RAW_FILE_NOT_FOUND' });
  });

  test('rejects invalid parser JSON output', async () => {
    const dir = makeTempDir();
    const rawPath = path.join(dir, 'sample.grib2');
    fs.writeFileSync(rawPath, 'fake-grib');
    const scriptPath = writeNodeScript(dir, 'process.stdout.write("not-json");');
    const service = new GfsCfgribParserService({
      pythonPath: process.execPath,
      scriptPath
    });

    await expect(service.readGridRecords({
      rawPath,
      bbox: { north: 41, south: 39, west: 115, east: 117 },
      resolution: 1
    })).rejects.toMatchObject({ code: 'GFS_GRIB_PARSER_INVALID_JSON' });
  });

  test('rejects parser process failures', async () => {
    const dir = makeTempDir();
    const rawPath = path.join(dir, 'sample.grib2');
    fs.writeFileSync(rawPath, 'fake-grib');
    const scriptPath = writeNodeScript(dir, 'process.stderr.write("parser failed"); process.exit(2);');
    const service = new GfsCfgribParserService({
      pythonPath: process.execPath,
      scriptPath
    });

    await expect(service.readGridRecords({
      rawPath,
      bbox: { north: 41, south: 39, west: 115, east: 117 },
      resolution: 1
    })).rejects.toMatchObject({ code: 'GFS_GRIB_PARSER_FAILED' });
  });
});
