import { isInMainlandChina } from '../../../src/utils/mainlandChinaRegion.js';

describe('mainlandChinaRegion', () => {
  test('中国大陆核心城市应返回 true', () => {
    expect(isInMainlandChina(39.9042, 116.4074)).toBe(true); // 北京
    expect(isInMainlandChina(31.2304, 121.4737)).toBe(true); // 上海
    expect(isInMainlandChina(30.5928, 114.3055)).toBe(true); // 武汉
  });

  test('应排除台湾和南海远海区域', () => {
    expect(isInMainlandChina(25.033, 121.5654)).toBe(false); // 台北
    expect(isInMainlandChina(10.0, 114.0)).toBe(false); // 南海远海
  });

  test('无效坐标应返回 false', () => {
    expect(isInMainlandChina(NaN, 116.4)).toBe(false);
    expect(isInMainlandChina(39.9, Infinity)).toBe(false);
    expect(isInMainlandChina(undefined, 116.4)).toBe(false);
  });
});
