import { isInMainlandChina, isMainlandChinaLocation } from '../../../src/utils/mainlandChinaRegion.js';

describe('mainlandChinaRegion', () => {
  test('中国大陆核心城市应返回 true', () => {
    expect(isInMainlandChina(39.9042, 116.4074)).toBe(true); // 北京
    expect(isInMainlandChina(31.2304, 121.4737)).toBe(true); // 上海
    expect(isInMainlandChina(30.5928, 114.3055)).toBe(true); // 武汉
  });

  test('应排除台湾、港澳和南海远海区域', () => {
    expect(isInMainlandChina(25.033, 121.5654)).toBe(false); // 台北
    expect(isInMainlandChina(22.3193, 114.1694)).toBe(false); // 香港
    expect(isInMainlandChina(22.1987, 113.5439)).toBe(false); // 澳门
    expect(isInMainlandChina(10.0, 114.0)).toBe(false); // 南海远海
  });

  test('无效坐标应返回 false', () => {
    expect(isInMainlandChina(NaN, 116.4)).toBe(false);
    expect(isInMainlandChina(39.9, Infinity)).toBe(false);
    expect(isInMainlandChina(undefined, 116.4)).toBe(false);
  });

  test('isMainlandChinaLocation: 仅接受 CN 且排除港澳台 regionCode', () => {
    expect(isMainlandChinaLocation({ lat: 39.9, lon: 116.4, countryCode: 'CN' })).toBe(true);
    expect(isMainlandChinaLocation({ lat: 39.9, lon: 116.4, countryCode: 'US' })).toBe(false);
    expect(isMainlandChinaLocation({ lat: 31.2, lon: 121.5, countryCode: 'CN', regionCode: 'HK' })).toBe(false);
    expect(isMainlandChinaLocation({ lat: 31.2, lon: 121.5, countryCode: 'CN', regionCode: 'MO' })).toBe(false);
    expect(isMainlandChinaLocation({ lat: 31.2, lon: 121.5, countryCode: 'CN', regionCode: 'TW' })).toBe(false);
    expect(isMainlandChinaLocation({ lat: 31.2, lon: 121.5, countryCode: 'CN', regionCode: '110000' })).toBe(true);
  });
});
