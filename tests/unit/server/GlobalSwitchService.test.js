import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(import.meta.url);
const GlobalSwitchService = require('../../../server/services/GlobalSwitchStateService.js');

describe('GlobalSwitchService', () => {
  let tempDir;
  let service;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xiake-switches-'));
    service = new GlobalSwitchService({ filePath: path.join(tempDir, 'global-switches.json') });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('defaults to public site and weather prediction available', () => {
    expect(service.getState()).toEqual({
      siteClosed: false,
      weatherPredictionClosed: false,
      updatedAt: null
    });
    expect(service.isSiteClosed()).toBe(false);
    expect(service.isWeatherPredictionClosed()).toBe(false);
  });

  test('persists normalized switch updates', () => {
    const updated = service.updateState({ siteClosed: true, weatherPredictionClosed: true });

    expect(updated.siteClosed).toBe(true);
    expect(updated.weatherPredictionClosed).toBe(true);
    expect(typeof updated.updatedAt).toBe('string');

    const reloaded = new GlobalSwitchService({ filePath: path.join(tempDir, 'global-switches.json') });
    expect(reloaded.getState()).toMatchObject({
      siteClosed: true,
      weatherPredictionClosed: true
    });
  });

  test('builds structured unavailable response for weather prediction closure', () => {
    service.updateState({ weatherPredictionClosed: true });

    expect(service.buildWeatherPredictionUnavailable()).toEqual({
      success: false,
      error: {
        code: 'WEATHER_PREDICTION_CLOSED',
        message: 'Weather prediction is temporarily unavailable. Please come back later.'
      },
      availability: expect.objectContaining({
        weatherPredictionClosed: true,
        shareMapAvailable: true,
        firecloudMapAvailable: true
      })
    });
  });
});
