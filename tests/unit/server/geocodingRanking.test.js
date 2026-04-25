import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { _private } = require('../../../server/routes/geocoding.js');

describe('geocoding ranking', () => {
  test('NYC should prioritize New York in United States', () => {
    const ranked = _private.rankGeocodingResults('NYC', [
      { name: 'New York, Ontario, Canada', lat: 43.96, lon: -79.27, provider: 'openmeteo', countryCode: 'CA', population: 861, type: 'PPL' },
      { name: 'New York, New York, United States', lat: 40.7128, lon: -74.006, provider: 'openmeteo', countryCode: 'US', population: 8175133, type: 'PPLC' }
    ]);

    expect(ranked[0].countryCode).toBe('US');
    expect(ranked[0].name).toContain('New York, New York, United States');
  });

  test('SF should prioritize San Francisco in United States', () => {
    const ranked = _private.rankGeocodingResults('SF', [
      { name: 'San Francisco, California, United States', lat: 37.7749, lon: -122.4194, provider: 'openmeteo', countryCode: 'US', population: 808000, type: 'PPLC' },
      { name: 'San Fernando, California, United States', lat: 34.28, lon: -118.43, provider: 'openmeteo', countryCode: 'US', population: 247000, type: 'PPLA3' }
    ]);

    expect(ranked[0].countryCode).toBe('US');
    expect(ranked[0].name).toContain('San Francisco');
  });

  test('London/伦敦 should prioritize GB candidate', () => {
    const byAbbrev = _private.rankGeocodingResults('London', [
      { name: 'London, Ontario, Canada', lat: 42.98, lon: -81.25, provider: 'openmeteo', countryCode: 'CA', population: 346765, type: 'PPL' },
      { name: 'London, England, United Kingdom', lat: 51.5074, lon: -0.1278, provider: 'openmeteo', countryCode: 'GB', population: 8982000, type: 'PPLC' },
    ]);

    expect(byAbbrev[0].countryCode).toBe('GB');
    expect(byAbbrev[0].name).toContain('London');

    const byZh = _private.rankGeocodingResults('伦敦', [
      { name: 'London, Ontario, Canada', lat: 42.98, lon: -81.25, provider: 'openmeteo', countryCode: 'CA', population: 346765, type: 'PPL' },
      { name: 'London, England, United Kingdom', lat: 51.5074, lon: -0.1278, provider: 'openmeteo', countryCode: 'GB', population: 8982000, type: 'PPLC' },
    ]);

    expect(byZh[0].countryCode).toBe('GB');
    expect(byZh[0].name).toContain('United Kingdom');
  });

  test('Paris/巴黎 should prioritize FR candidate', () => {
    const byEn = _private.rankGeocodingResults('Paris', [
      { name: 'Paris, Texas, United States', lat: 33.66, lon: -95.55, provider: 'openmeteo', countryCode: 'US', population: 249000, type: 'PPLA2' },
      { name: 'Paris, Île-de-France, France', lat: 48.8566, lon: 2.3522, provider: 'openmeteo', countryCode: 'FR', population: 2140526, type: 'PPLC' }
    ]);

    expect(byEn[0].countryCode).toBe('FR');
    expect(byEn[0].name).toContain('Paris, Île-de-France, France');

    const byZh = _private.rankGeocodingResults('巴黎', [
      { name: 'Paris, Texas, United States', lat: 33.66, lon: -95.55, provider: 'openmeteo', countryCode: 'US', population: 249000, type: 'PPLA2' },
      { name: 'Paris, Île-de-France, France', lat: 48.8566, lon: 2.3522, provider: 'openmeteo', countryCode: 'FR', population: 2140526, type: 'PPLC' }
    ]);

    expect(byZh[0].countryCode).toBe('FR');
    expect(byZh[0].name).toContain('France');
  });

  test('Hong Kong query variants should prioritize HK candidates', () => {
    const byEn = _private.rankGeocodingResults('HK', [
      { name: 'HKG, Hong Kong, China', lat: 22.3964, lon: 114.1095, provider: 'openmeteo', countryCode: 'CN', population: 7451000, type: 'PPLC' },
      { name: 'Hong Kong, Hong Kong', lat: 22.3193, lon: 114.1694, provider: 'openmeteo', countryCode: 'HK', population: 7496000, type: 'PPLC' }
    ]);

    expect(byEn[0].countryCode).toBe('HK');
    expect(byEn[0].name).toContain('Hong Kong');

    const byZh = _private.rankGeocodingResults('香港', [
      { name: 'HKG, Hong Kong, China', lat: 22.3964, lon: 114.1095, provider: 'openmeteo', countryCode: 'CN', population: 7451000, type: 'PPLC' },
      { name: 'Hong Kong, Hong Kong', lat: 22.3193, lon: 114.1694, provider: 'openmeteo', countryCode: 'HK', population: 7496000, type: 'PPLC' }
    ]);

    expect(byZh[0].countryCode).toBe('HK');
    expect(byZh[0].name).toContain('Hong Kong');
  });
  test('Tokyo prefers global JP city over CN same-name place', () => {
    const ranked = _private.rankGeocodingResults('Tokyo', [
      { name: '广西壮族自治区贵港市平南县东京', lat: 23.2, lon: 110.4, provider: 'gaode', countryCode: 'CN' },
      { name: 'Tokyo, Japan', lat: 35.68, lon: 139.76, provider: 'openmeteo', countryCode: 'JP', population: 8336599, type: 'PPLC' }
    ]);
    expect(ranked[0].countryCode).toBe('JP');
    expect(ranked[0].name).toContain('Tokyo');
  });

  test('东京 alias also prefers Tokyo JP over Dongjing CN', () => {
    const ranked = _private.rankGeocodingResults('东京', [
      { name: 'Dongjing, Jiangxi, China', lat: 28.7, lon: 115.9, provider: 'openmeteo', countryCode: 'CN', type: 'PPL' },
      { name: 'Tokyo, Japan', lat: 35.68, lon: 139.76, provider: 'openmeteo', countryCode: 'JP', population: 9733276, type: 'PPLC' }
    ]);
    expect(ranked[0].countryCode).toBe('JP');
  });

  test('洛杉矶 alias prefers Los Angeles US', () => {
    const ranked = _private.rankGeocodingResults('洛杉矶', [
      { name: 'Los Ángeles, Chile', lat: -37.47, lon: -72.35, provider: 'openmeteo', countryCode: 'CL', population: 125430, type: 'PPLA2' },
      { name: 'Los Angeles, California, United States', lat: 34.05, lon: -118.24, provider: 'openmeteo', countryCode: 'US', population: 3820914, type: 'PPLA2' }
    ]);
    expect(ranked[0].countryCode).toBe('US');
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
