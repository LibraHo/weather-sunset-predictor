import { compactLocationName } from '../../../src/utils/LocationName.js';

describe('compactLocationName global address compaction', () => {
  test.each([
    ['New York, New York, United States', {}, 'New York · United States'],
    ['Paris, Île-de-France, France', {}, 'Paris · Île-de-France'],
    ['Shinjuku City, Tokyo, Japan', {}, 'Shinjuku City · Tokyo'],
    ['São Paulo, São Paulo, Brazil', {}, 'São Paulo · Brazil'],
    ['北京市朝阳区, 中国', {}, '北京 · 朝阳区']
  ])('%s', (rawName, address, expected) => {
    expect(compactLocationName(rawName, address)).toBe(expected);
  });

  test('uses provider structured address fields for non-Chinese locations', () => {
    expect(compactLocationName('ignored provider display name', {
      city: 'Munich',
      state: 'Bavaria',
      country: 'Germany'
    })).toBe('Munich · Bavaria');
  });
});
