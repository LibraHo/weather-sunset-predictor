import { jest } from '@jest/globals';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(import.meta.url);

describe('visitor counter persistence', () => {
  let tempDir;
  let file;

  beforeEach(() => {
    jest.resetModules();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xiake-visitor-'));
    file = path.join(tempDir, 'visitor-count.json');
    process.env.VISITOR_COUNT_FILE = file;
  });

  afterEach(() => {
    delete process.env.VISITOR_COUNT_FILE;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('loads persisted count on module initialization', () => {
    fs.writeFileSync(file, JSON.stringify({ count: 42 }));
    const route = require('../../../server/routes/visitor.js');
    expect(route._test.loadCount()).toBe(42);
  });

  test('saveCount writes durable JSON count', () => {
    const route = require('../../../server/routes/visitor.js');
    route._test.saveCount(17);
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(data.count).toBe(17);
    expect(data.updatedAt).toBeTruthy();
  });

  test('parseCount tolerates invalid or legacy shapes', () => {
    const route = require('../../../server/routes/visitor.js');
    expect(route._test.parseCount('{"visitorCount": 9}')).toBe(9);
    expect(route._test.parseCount('{"count": -1}')).toBe(0);
  });

  test('isBotUserAgent filters crawlers and keeps normal browsers', () => {
    const route = require('../../../server/routes/visitor.js');
    expect(route._test.isBotUserAgent('Mozilla/5.0 HeadlessChrome/138.0')).toBe(true);
    expect(route._test.isBotUserAgent('Mozilla/5.0 (compatible; CensysInspect/1.1)')).toBe(true);
    expect(route._test.isBotUserAgent('Go-http-client/1.1')).toBe(true);
    expect(route._test.isBotUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) Safari/604.1')).toBe(false);
    expect(route._test.isBotUserAgent('MicroMessenger/8.0.60 Mobile Safari/537.36')).toBe(false);
  });
});
