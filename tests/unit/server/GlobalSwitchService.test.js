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
      radarFovMode: 'fov',
      announcement: {
        enabled: false,
        summary: '',
        title: '',
        blocks: [],
        startsAt: null,
        endsAt: null
      },
      updatedAt: null
    });
    expect(service.isSiteClosed()).toBe(false);
    expect(service.isWeatherPredictionClosed()).toBe(false);
  });

  test('persists normalized switch updates', () => {
    const updated = service.updateState({
      siteClosed: true,
      weatherPredictionClosed: true,
      radarFovMode: 'legacy',
      announcement: {
        enabled: true,
        summary: '公告入口',
        title: '公告标题',
        startsAt: '2026-06-28T09:00:00+08:00',
        endsAt: '2026-06-29T09:00:00+08:00',
        blocks: [
          { type: 'text', text: '第一段公告' },
          { type: 'image', url: 'https://example.com/a.jpg' }
        ]
      }
    });

    expect(updated.siteClosed).toBe(true);
    expect(updated.weatherPredictionClosed).toBe(true);
    expect(updated.radarFovMode).toBe('legacy');
    expect(updated.announcement).toMatchObject({
      enabled: true,
      summary: '公告入口',
      title: '公告标题',
      startsAt: '2026-06-28T01:00:00.000Z',
      endsAt: '2026-06-29T01:00:00.000Z',
      blocks: [
        { type: 'text', text: '第一段公告' },
        { type: 'image', url: 'https://example.com/a.jpg' }
      ]
    });
    expect(typeof updated.updatedAt).toBe('string');

    const reloaded = new GlobalSwitchService({ filePath: path.join(tempDir, 'global-switches.json') });
    expect(reloaded.getState()).toMatchObject({
      siteClosed: true,
      weatherPredictionClosed: true,
      radarFovMode: 'legacy',
      announcement: {
        enabled: true,
        summary: '公告入口',
        title: '公告标题'
      }
    });
  });

  test('publishes announcement active status from content and schedule', () => {
    const now = Date.now();

    service.updateState({
      announcement: {
        enabled: true,
        summary: 'Soon',
        startsAt: new Date(now + 60 * 60 * 1000).toISOString()
      }
    });
    expect(service.getPublicState().announcement.active).toBe(false);

    service.updateState({
      announcement: {
        enabled: true,
        summary: 'Live',
        startsAt: new Date(now - 60 * 60 * 1000).toISOString(),
        endsAt: new Date(now + 60 * 60 * 1000).toISOString()
      }
    });
    expect(service.getPublicState().announcement.active).toBe(true);

    service.updateState({
      announcement: {
        enabled: true,
        summary: 'Expired',
        endsAt: new Date(now - 60 * 60 * 1000).toISOString()
      }
    });
    expect(service.getPublicState().announcement.active).toBe(false);
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
        radarFovMode: 'fov',
        shareMapAvailable: true,
        firecloudMapAvailable: true
      })
    });
  });
});
