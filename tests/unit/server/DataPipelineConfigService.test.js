import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(import.meta.url);

let DataPipelineConfigService;

beforeAll(async () => {
  const mod = await import('../../../server/services/DataPipelineConfigService.js');
  DataPipelineConfigService = mod.default || mod;
});

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'xiake-pipeline-config-'));
}

describe('DataPipelineConfigService', () => {
  test('returns safe default China Japan Korea 48h hybrid config', () => {
    const service = new DataPipelineConfigService({ dataDir: makeTempDir() });

    const config = service.getConfig();

    expect(config.mode).toBe('hybrid');
    expect(config.regionPreset).toBe('china_japan_korea');
    expect(config.regionDefinition).toEqual({ type: 'countries', countries: ['CN', 'JP', 'KR'] });
    expect(config.bbox).toEqual({ north: 54, south: 18, west: 73, east: 146 });
    expect(config.resolution).toBe(0.5);
    expect(config.forecastHours).toBe(48);
    expect(config.sources).toEqual({ gfs: true, cams: true, openMeteoFallback: true });
    expect(config.runtimePolicy).toMatchObject({
      workerConcurrency: 1,
      maxResidentMemoryMb: 512,
      hardMemoryLimitMb: 768,
      reserveMemoryForApiMb: 2048,
      publicRequestCanStartPipeline: false,
      pauseWhenMemoryPressure: true
    });
    expect(config.storagePolicy.minFreeDiskGb).toBe(3);
  });

  test('estimate reports grid size and forecast hour count for default config', () => {
    const service = new DataPipelineConfigService({ dataDir: makeTempDir(), freeDiskBytes: 20 * 1024 ** 3 });

    const estimate = service.estimate(service.getConfig());

    expect(estimate.safe).toBe(true);
    expect(estimate.gridPoints).toBe(10731);
    expect(estimate.forecastHourCount).toBe(49);
    expect(estimate.estimatedDownloadBytes).toBeGreaterThan(0);
    expect(estimate.estimatedResidentMemoryMb).toBeLessThanOrEqual(512);
    expect(estimate.reasons).toEqual([]);
  });

  test('derives download bbox from an irregular country region definition', () => {
    const service = new DataPipelineConfigService({ dataDir: makeTempDir(), freeDiskBytes: 20 * 1024 ** 3 });

    const config = service.saveConfig({
      mode: 'gfs_cams',
      regionPreset: 'china_japan_korea',
      regionDefinition: {
        type: 'countries',
        countries: ['CN', 'JP', 'KR']
      },
      resolution: 0.5,
      forecastHours: 24
    });
    const estimate = service.estimate(config);

    expect(config.regionPreset).toBe('china_japan_korea');
    expect(config.regionDefinition).toEqual({
      type: 'countries',
      countries: ['CN', 'JP', 'KR']
    });
    expect(config.bbox).toEqual({ north: 54, south: 18, west: 73, east: 146 });
    expect(estimate.safe).toBe(true);
    expect(estimate.regionDefinition.type).toBe('countries');
  });

  test('rejects dangerous global high resolution config', () => {
    const service = new DataPipelineConfigService({ dataDir: makeTempDir(), freeDiskBytes: 20 * 1024 ** 3 });

    expect(() => service.saveConfig({
      regionPreset: 'custom_bbox',
      bbox: { north: 90, south: -90, west: -180, east: 180 },
      resolution: 0.25,
      forecastHours: 72
    })).toThrow(/grid points|bbox area|forecast hours/i);
  });

  test('rejects valid bbox when disk would fall below safety threshold', () => {
    const service = new DataPipelineConfigService({ dataDir: makeTempDir(), freeDiskBytes: 2 * 1024 ** 3 });

    expect(() => service.saveConfig(service.getConfig())).toThrow(/disk/i);
  });

  test('rejects configs that could starve website and miniprogram APIs', () => {
    const service = new DataPipelineConfigService({ dataDir: makeTempDir(), freeDiskBytes: 20 * 1024 ** 3 });

    expect(() => service.saveConfig({
      runtimePolicy: {
        workerConcurrency: 2
      }
    })).toThrow(/worker concurrency/i);

    expect(() => service.saveConfig({
      runtimePolicy: {
        publicRequestCanStartPipeline: true
      }
    })).toThrow(/public requests/i);
  });
});
