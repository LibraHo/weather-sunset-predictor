import fs from 'fs';
import os from 'os';
import path from 'path';
import { jest } from '@jest/globals';

let DataPipelineCleanupService;
let DataPipelineRunLogService;

beforeAll(async () => {
  const cleanupMod = await import('../../../server/services/DataPipelineCleanupService.js');
  DataPipelineCleanupService = cleanupMod.default || cleanupMod;
  const logMod = await import('../../../server/services/DataPipelineRunLogService.js');
  DataPipelineRunLogService = logMod.default || logMod;
});

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'xiake-pipeline-cleanup-'));
}

function writeFileWithMtime(filePath, content, mtime) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  fs.utimesSync(filePath, mtime, mtime);
}

describe('DataPipelineCleanupService', () => {
  test('deletes old raw/tmp/grid-product/tile files and updates manifest', () => {
    const dataDir = makeTempDir();
    const now = new Date('2026-05-26T12:00:00Z');
    const service = new DataPipelineCleanupService({ dataDir, now });
    const oldRaw = path.join(dataDir, 'data', 'raw', 'gfs', 'old.grib2');
    const newRaw = path.join(dataDir, 'data', 'raw', 'gfs', 'new.grib2');
    const oldTmp = path.join(dataDir, 'data', 'tmp', 'cams-old.nc.tmp');
    const newTmp = path.join(dataDir, 'data', 'tmp', 'cams-new.nc.tmp');
    const oldTile = path.join(dataDir, 'data', 'cache', 'tiles', 'old.png');
    const newTile = path.join(dataDir, 'data', 'cache', 'tiles', 'new.png');
    const oldProduct = path.join(dataDir, 'data', 'cache', 'grid-products', 'old_product.json');
    const newProduct = path.join(dataDir, 'data', 'cache', 'grid-products', 'new_product.json');
    const manifestPath = path.join(dataDir, 'data', 'cache', 'grid-products', 'manifest.json');

    writeFileWithMtime(oldRaw, 'old-raw', new Date('2026-05-26T10:30:00Z'));
    writeFileWithMtime(newRaw, 'new-raw', new Date('2026-05-26T11:30:00Z'));
    writeFileWithMtime(oldTmp, 'old-tmp', new Date('2026-05-26T08:00:00Z'));
    writeFileWithMtime(newTmp, 'new-tmp', new Date('2026-05-26T10:00:00Z'));
    writeFileWithMtime(oldTile, 'old-tile', new Date('2026-05-22T12:00:00Z'));
    writeFileWithMtime(newTile, 'new-tile', new Date('2026-05-25T12:00:00Z'));
    writeFileWithMtime(oldProduct, '{"old":true}', new Date('2026-05-22T12:00:00Z'));
    writeFileWithMtime(newProduct, '{"new":true}', new Date('2026-05-25T12:00:00Z'));
    fs.writeFileSync(manifestPath, JSON.stringify({
      schemaVersion: 1,
      products: [
        { productId: 'old_product', path: oldProduct, createdAt: '2026-05-22T12:00:00.000Z' },
        { productId: 'new_product', path: newProduct, createdAt: '2026-05-25T12:00:00.000Z' }
      ]
    }, null, 2), 'utf8');

    const result = service.cleanup({
      deleteRawAfterMinutes: 60,
      deleteTmpAfterHours: 3,
      keepCacheDays: 3,
      keepTileDays: 3,
      keepLogDays: 7
    });

    expect(result.deletedFiles).toEqual(expect.arrayContaining([oldRaw, oldTmp, oldTile, oldProduct]));
    expect(fs.existsSync(oldRaw)).toBe(false);
    expect(fs.existsSync(newRaw)).toBe(true);
    expect(fs.existsSync(oldTmp)).toBe(false);
    expect(fs.existsSync(newTmp)).toBe(true);
    expect(fs.existsSync(oldTile)).toBe(false);
    expect(fs.existsSync(newTile)).toBe(true);
    expect(fs.existsSync(oldProduct)).toBe(false);
    expect(fs.existsSync(newProduct)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest.products.map(item => item.productId)).toEqual(['new_product']);
    expect(result.deletedBytes).toBeGreaterThan(0);
  });

  test('prunes data pipeline runs and steps older than retention window', () => {
    const dataDir = makeTempDir();
    const runLogService = new DataPipelineRunLogService({
      dataDir,
      now: () => new Date('2026-05-18T12:00:00Z')
    });
    const oldRun = runLogService.createRun({ mode: 'gfs_cams' }, { reason: 'old' });
    runLogService.createStep(oldRun.id, { type: 'download', source: 'gfs' });

    runLogService.now = () => new Date('2026-05-26T12:00:00Z');
    const newRun = runLogService.createRun({ mode: 'gfs_cams' }, { reason: 'new' });
    runLogService.createStep(newRun.id, { type: 'download', source: 'cams' });

    const service = new DataPipelineCleanupService({
      dataDir,
      now: new Date('2026-05-26T12:00:00Z'),
      runLogService
    });

    const result = service.cleanup({ keepLogDays: 7 });

    expect(result.prunedRuns).toBe(1);
    expect(result.prunedSteps).toBe(1);
    expect(runLogService.listRuns({ limit: 10 }).map(run => run.id)).toEqual([newRun.id]);
  });

  test('dryRun reports old files without deleting them or pruning logs', () => {
    const dataDir = makeTempDir();
    const oldRaw = path.join(dataDir, 'data', 'raw', 'gfs', 'old.grib2');
    const oldProduct = path.join(dataDir, 'data', 'cache', 'grid-products', 'old_product.json');
    const newProduct = path.join(dataDir, 'data', 'cache', 'grid-products', 'new_product.json');
    const manifestPath = path.join(dataDir, 'data', 'cache', 'grid-products', 'manifest.json');
    writeFileWithMtime(oldRaw, 'old-raw', new Date('2026-05-26T10:30:00Z'));
    writeFileWithMtime(oldProduct, '{"old":true}', new Date('2026-05-22T12:00:00Z'));
    writeFileWithMtime(newProduct, '{"new":true}', new Date('2026-05-25T12:00:00Z'));
    fs.writeFileSync(manifestPath, JSON.stringify({
      schemaVersion: 1,
      products: [
        { productId: 'old_product', path: oldProduct, createdAt: '2026-05-22T12:00:00.000Z' },
        { productId: 'new_product', path: newProduct, createdAt: '2026-05-25T12:00:00.000Z' },
        { productId: 'missing_product', path: path.join(dataDir, 'data', 'cache', 'grid-products', 'missing.json') }
      ]
    }, null, 2), 'utf8');
    const runLogService = {
      pruneOlderThan: jest.fn()
    };
    const service = new DataPipelineCleanupService({
      dataDir,
      now: new Date('2026-05-26T12:00:00Z'),
      runLogService
    });

    const result = service.cleanup({ deleteRawAfterMinutes: 60, keepLogDays: 7 }, { dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(result.deletedFiles).toContain(oldRaw);
    expect(result.deletedFiles).toContain(oldProduct);
    expect(result.deletedBytes).toBeGreaterThan(0);
    expect(fs.existsSync(oldRaw)).toBe(true);
    expect(fs.existsSync(oldProduct)).toBe(true);
    expect(result.removedProducts).toBe(2);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest.products.map(item => item.productId)).toEqual(['old_product', 'new_product', 'missing_product']);
    expect(runLogService.pruneOlderThan).not.toHaveBeenCalled();
  });
});
