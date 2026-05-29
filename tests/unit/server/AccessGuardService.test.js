import { createRequire } from 'module';
import { jest } from '@jest/globals';

const require = createRequire(import.meta.url);
const accessGuardService = require('../../../server/services/AccessGuardService');

describe('AccessGuardService', () => {
  const originalHits = accessGuardService._hits;
  const originalBlocked = accessGuardService._blocked;
  const originalEvents = accessGuardService._events;
  const originalConfig = accessGuardService._config;
  const originalPersist = accessGuardService._persist;

  beforeEach(() => {
    accessGuardService._hits = new Map();
    accessGuardService._blocked = {};
    accessGuardService._events = [];
    accessGuardService._config = {
      enabled: true,
      perMinuteLimit: 5,
      rollingLimit: 20,
      suspiciousPathLimit: 3,
      blockMs: 60 * 60 * 1000,
    };
    accessGuardService._persist = jest.fn();
  });

  afterEach(() => {
    accessGuardService._hits = originalHits;
    accessGuardService._blocked = originalBlocked;
    accessGuardService._events = originalEvents;
    accessGuardService._config = originalConfig;
    accessGuardService._persist = originalPersist;
  });

  function makeReq(path = '/', ip = '203.0.113.10') {
    return {
      path,
      method: 'GET',
      ip,
      headers: {
        'user-agent': 'Mozilla/5.0',
      },
    };
  }

  test('blocks repeated sensitive path scans', () => {
    expect(accessGuardService.check(makeReq('/deploy/content.zip')).blocked).toBe(false);
    expect(accessGuardService.check(makeReq('/deploy/content.sql.gz')).blocked).toBe(false);

    const result = accessGuardService.check(makeReq('/data/.env.tar.gz'));

    expect(result).toMatchObject({
      blocked: true,
      ip: '203.0.113.10',
      reason: 'suspicious_path_scan',
      status: 429,
    });
    expect(accessGuardService.getStatus().blocked[0]).toMatchObject({
      ip: '203.0.113.10',
      reason: 'suspicious_path_scan',
    });
  });

  test('blocks excessive per-minute traffic', () => {
    for (let i = 0; i < 4; i += 1) {
      expect(accessGuardService.check(makeReq('/api/prediction')).blocked).toBe(false);
    }

    const result = accessGuardService.check(makeReq('/api/prediction'));

    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('per_minute_limit');
  });

  test('manual block and unblock are visible in status', () => {
    accessGuardService.manualBlock('198.51.100.9');

    expect(accessGuardService.check(makeReq('/', '198.51.100.9')).blocked).toBe(true);
    expect(accessGuardService.getStatus().blocked[0]).toMatchObject({
      ip: '198.51.100.9',
      reason: 'manual_block',
      manual: true,
    });

    expect(accessGuardService.unblock('198.51.100.9')).toBe(true);
    expect(accessGuardService.check(makeReq('/', '198.51.100.9')).blocked).toBe(false);
  });

  test('updates guard thresholds from admin config', () => {
    const config = accessGuardService.updateConfig({
      enabled: false,
      perMinuteLimit: 120,
      rollingLimit: 900,
      suspiciousPathLimit: 8,
      blockMinutes: 45,
    });

    expect(config).toEqual({
      perMinuteLimit: 120,
      rollingLimit: 900,
      suspiciousPathLimit: 8,
      blockMinutes: 45,
    });
    expect(accessGuardService.getStatus().enabled).toBe(false);
    expect(accessGuardService.getStatus().events[0]).toMatchObject({
      type: 'config_update',
      reason: 'manual_config_update',
    });
  });

  test('rejects a rolling threshold below the minute threshold', () => {
    expect(() => accessGuardService.updateConfig({
      perMinuteLimit: 500,
      rollingLimit: 100,
    })).toThrow('10分钟阈值不能小于1分钟阈值');
  });
});
