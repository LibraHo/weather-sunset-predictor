import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(import.meta.url);
const { ShareStatsService, _test } = require('../../../server/services/ShareStatsService.js');

describe('ShareStatsService', () => {
  let tempDir;
  let file;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xiake-share-'));
    file = path.join(tempDir, 'share-stats.json');
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('records share actions into today and total buckets', () => {
    const service = new ShareStatsService(file);
    service.record({ action: 'save', period: 'sunset', source: 'prediction-card' });
    service.record({ action: 'copy', period: 'sunrise', source: 'prediction-card' });

    const summary = service.getSummary();
    expect(summary.today.total).toBe(2);
    expect(summary.today.save).toBe(1);
    expect(summary.today.copy).toBe(1);
    expect(summary.total.total).toBe(2);
    expect(summary.recent).toHaveLength(2);

    const persisted = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(persisted.total.total).toBe(2);
  });

  test('sanitizes unknown actions and periods', () => {
    expect(_test.sanitizeAction('bad')).toBe('copy');
    expect(_test.sanitizePeriod('bad')).toBe('unknown');
  });

  test('loads persisted stats', () => {
    fs.writeFileSync(file, JSON.stringify({ total: { total: 9, save: 4 }, days: {}, recent: [] }));
    const service = new ShareStatsService(file);
    expect(service.getSummary().total.total).toBe(9);
    expect(service.getSummary().total.save).toBe(4);
  });
});
