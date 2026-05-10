import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { IpLocationService } = require('../../../server/services/IpLocationService');

describe('IpLocationService', () => {
  let tmpDir;
  let service;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ip-location-service-'));
    service = new IpLocationService({
      cacheFile: path.join(tmpDir, 'cache.json')
    });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('normalizes forwarded and IPv4-mapped addresses', () => {
    expect(service.normalizeIp('::ffff:203.0.113.8')).toBe('203.0.113.8');
    expect(service.normalizeIp('198.51.100.9, 10.0.0.2')).toBe('198.51.100.9');
    expect(service.normalizeIp('198.51.100.9:443')).toBe('198.51.100.9');
    expect(service.normalizeIp('[2001:db8::1]:443')).toBe('2001:db8::1');
  });

  test('returns local labels without scheduling a public lookup', () => {
    expect(service.getDisplayLocation('127.0.0.1')).toBe('本机');
    expect(service.getDisplayLocation('::1')).toBe('本机');
    expect(service.getDisplayLocation('10.0.0.8')).toBe('内网');
    expect(service.getDisplayLocation('192.168.1.2')).toBe('内网');
    expect(service.getDisplayLocation('172.16.1.2')).toBe('内网');
    expect(service.getDisplayLocation('169.254.1.2')).toBe('链路本地');
    expect(service.getDisplayLocation('unknown')).toBe('未知');
  });

  test('uses fresh cached public lookup results', () => {
    const cacheFile = path.join(tmpDir, 'cached.json');
    fs.writeFileSync(cacheFile, JSON.stringify({
      '8.8.8.8': {
        location: 'United States / California / Mountain View',
        resolvedAt: Date.now()
      }
    }));

    service = new IpLocationService({ cacheFile });

    expect(service.getDisplayLocation('8.8.8.8')).toBe('United States / California / Mountain View');
  });
});
