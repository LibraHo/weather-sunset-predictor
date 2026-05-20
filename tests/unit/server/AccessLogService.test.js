import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const accessLogService = require('../../../server/services/AccessLogService');

describe('AccessLogService visitor records', () => {
  const originalRecords = accessLogService._records;
  const originalDaily = accessLogService._daily;

  afterEach(() => {
    accessLogService._records = originalRecords;
    accessLogService._daily = originalDaily;
  });

  test('groups visitor records by Beijing date and returns daily IPs', () => {
    const ts = Date.UTC(2026, 4, 19, 16, 30, 15); // 2026-05-20 00:30:15 Asia/Shanghai
    accessLogService._records = [
      { t: ts, ip: '10.0.0.1', path: '/admin', method: 'GET', ua: 'Mozilla/5.0' },
      { t: ts - 60 * 60 * 1000, ip: '10.0.0.2', path: '/', method: 'GET', ua: 'Mozilla/5.0' }
    ];
    accessLogService._daily = {
      '2026-05-20': { pv: 1, uv: new Set(['10.0.0.1']), ips: { '10.0.0.1': 1 } },
      '2026-05-19': { pv: 1, uv: new Set(['10.0.0.2']), ips: { '10.0.0.2': 1 } }
    };

    const result = accessLogService.getVisitorRecords({ date: '2026-05-20' });

    expect(result.timezone).toBe('Asia/Shanghai');
    expect(result.summary).toEqual({ pv: 1, uv: 1, ips: 1 });
    expect(result.topIps).toEqual([{ ip: '10.0.0.1', count: 1, location: '内网' }]);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      time: '2026-05-20 00:30:15',
      ip: '10.0.0.1',
      location: '内网',
      path: '/admin'
    });
  });
});
