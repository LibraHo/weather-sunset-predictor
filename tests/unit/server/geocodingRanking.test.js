import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { _private } = require('../../../server/routes/geocoding.js');

describe('geocoding ranking', () => {
  test('Tokyo prefers global JP city over CN same-name place', () => {
    const ranked = _private.rankGeocodingResults('Tokyo', [
      { name: '广西壮族自治区贵港市平南县东京', lat: 23.2, lon: 110.4, provider: 'gaode', countryCode: 'CN' },
      { name: 'Tokyo, Japan', lat: 35.68, lon: 139.76, provider: 'openmeteo', countryCode: 'JP', population: 8336599, type: 'PPLC' }
    ]);
    expect(ranked[0].countryCode).toBe('JP');
    expect(ranked[0].name).toContain('Tokyo');
  });

  test('Chinese city query keeps CN result priority', () => {
    const ranked = _private.rankGeocodingResults('北京', [
      { name: 'Beijing, China', lat: 39.9, lon: 116.4, provider: 'openmeteo', countryCode: 'CN', population: 18960744, type: 'PPLC' },
      { name: '北京', lat: 39.9, lon: 116.4, provider: 'gaode', countryCode: 'CN' }
    ]);
    expect(ranked[0].countryCode).toBe('CN');
    expect(ranked[0].rankScore).toBeGreaterThan(0);
  });

  test('LA alias matches Los Angeles', () => {
    const ranked = _private.rankGeocodingResults('LA', [
      { name: 'Louisiana, United States', lat: 31, lon: -92, provider: 'openmeteo', countryCode: 'US', population: 4600000, type: 'ADM1' },
      { name: 'Los Angeles, California, United States', lat: 34.05, lon: -118.24, provider: 'openmeteo', countryCode: 'US', population: 3971883, type: 'PPLA2' }
    ]);
    expect(ranked[0].name).toContain('Los Angeles');
  });
});
