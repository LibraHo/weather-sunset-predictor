/**
 * UnitConverter 单元测试
 *
 * 覆盖所有静态方法的正常路径、边界值和异常输入
 * 需求：17（个性化设置）、23.8（utils 函数覆盖率 ≥ 90%）
 */

import { jest } from '@jest/globals';
import UnitConverter from '@utils/UnitConverter.js';

describe('UnitConverter - 常量', () => {
  test('TEMP_UNITS 包含 CELSIUS 和 FAHRENHEIT', () => {
    expect(UnitConverter.TEMP_UNITS.CELSIUS).toBe('celsius');
    expect(UnitConverter.TEMP_UNITS.FAHRENHEIT).toBe('fahrenheit');
  });

  test('WIND_UNITS 包含 KMH 和 MS', () => {
    expect(UnitConverter.WIND_UNITS.KMH).toBe('kmh');
    expect(UnitConverter.WIND_UNITS.MS).toBe('ms');
  });
});

describe('UnitConverter.celsiusToFahrenheit', () => {
  test('0°C = 32°F', () => {
    expect(UnitConverter.celsiusToFahrenheit(0)).toBe(32);
  });

  test('100°C = 212°F', () => {
    expect(UnitConverter.celsiusToFahrenheit(100)).toBe(212);
  });

  test('-40°C = -40°F（等值点）', () => {
    expect(UnitConverter.celsiusToFahrenheit(-40)).toBe(-40);
  });

  test('37°C ≈ 98.6°F（保留1位小数）', () => {
    expect(UnitConverter.celsiusToFahrenheit(37)).toBe(98.6);
  });

  test('decimals=0 时返回整数', () => {
    expect(UnitConverter.celsiusToFahrenheit(100, 0)).toBe(212);
  });

  test('decimals=null 时返回原始浮点数（不舍入）', () => {
    const result = UnitConverter.celsiusToFahrenheit(37, null);
    expect(typeof result).toBe('number');
    expect(result).toBeCloseTo(98.6);
  });

  test('非数字输入返回 null', () => {
    expect(UnitConverter.celsiusToFahrenheit('hot')).toBeNull();
    expect(UnitConverter.celsiusToFahrenheit(null)).toBeNull();
    expect(UnitConverter.celsiusToFahrenheit(undefined)).toBeNull();
  });

  test('NaN 输入返回 null', () => {
    expect(UnitConverter.celsiusToFahrenheit(NaN)).toBeNull();
  });
});

describe('UnitConverter.fahrenheitToCelsius', () => {
  test('32°F = 0°C', () => {
    expect(UnitConverter.fahrenheitToCelsius(32)).toBe(0);
  });

  test('212°F = 100°C', () => {
    expect(UnitConverter.fahrenheitToCelsius(212)).toBe(100);
  });

  test('-40°F = -40°C（等值点）', () => {
    expect(UnitConverter.fahrenheitToCelsius(-40)).toBe(-40);
  });

  test('98.6°F ≈ 37°C', () => {
    expect(UnitConverter.fahrenheitToCelsius(98.6)).toBe(37);
  });

  test('decimals=2 时保留2位小数', () => {
    expect(UnitConverter.fahrenheitToCelsius(100, 2)).toBe(37.78);
  });

  test('decimals=null 时返回原始浮点数', () => {
    const result = UnitConverter.fahrenheitToCelsius(32, null);
    expect(result).toBe(0);
  });

  test('非数字输入返回 null', () => {
    expect(UnitConverter.fahrenheitToCelsius('cold')).toBeNull();
    expect(UnitConverter.fahrenheitToCelsius(null)).toBeNull();
  });

  test('NaN 输入返回 null', () => {
    expect(UnitConverter.fahrenheitToCelsius(NaN)).toBeNull();
  });
});

describe('UnitConverter.msToKmh', () => {
  test('1 m/s = 3.6 km/h', () => {
    expect(UnitConverter.msToKmh(1)).toBe(3.6);
  });

  test('0 m/s = 0 km/h', () => {
    expect(UnitConverter.msToKmh(0)).toBe(0);
  });

  test('10 m/s = 36 km/h', () => {
    expect(UnitConverter.msToKmh(10)).toBe(36);
  });

  test('decimals=0 时返回整数', () => {
    expect(UnitConverter.msToKmh(10, 0)).toBe(36);
  });

  test('decimals=null 时返回原始浮点数', () => {
    const result = UnitConverter.msToKmh(1, null);
    expect(result).toBe(3.6);
  });

  test('非数字输入返回 null', () => {
    expect(UnitConverter.msToKmh('fast')).toBeNull();
    expect(UnitConverter.msToKmh(null)).toBeNull();
  });

  test('NaN 输入返回 null', () => {
    expect(UnitConverter.msToKmh(NaN)).toBeNull();
  });
});

describe('UnitConverter.kmhToMs', () => {
  test('3.6 km/h = 1 m/s', () => {
    expect(UnitConverter.kmhToMs(3.6)).toBe(1);
  });

  test('0 km/h = 0 m/s', () => {
    expect(UnitConverter.kmhToMs(0)).toBe(0);
  });

  test('36 km/h = 10 m/s', () => {
    expect(UnitConverter.kmhToMs(36)).toBe(10);
  });

  test('decimals=2 时保留2位小数', () => {
    expect(UnitConverter.kmhToMs(100, 2)).toBe(27.78);
  });

  test('decimals=null 时返回原始浮点数', () => {
    const result = UnitConverter.kmhToMs(3.6, null);
    expect(result).toBe(1);
  });

  test('非数字输入返回 null', () => {
    expect(UnitConverter.kmhToMs('slow')).toBeNull();
    expect(UnitConverter.kmhToMs(undefined)).toBeNull();
  });

  test('NaN 输入返回 null', () => {
    expect(UnitConverter.kmhToMs(NaN)).toBeNull();
  });
});

describe('UnitConverter.formatTemperature', () => {
  test('默认单位为摄氏度，显示 ℃', () => {
    expect(UnitConverter.formatTemperature(25)).toBe('25℃');
  });

  test('unit=celsius 显示 ℃', () => {
    expect(UnitConverter.formatTemperature(25, 'celsius')).toBe('25℃');
  });

  test('unit=fahrenheit 显示 ℉', () => {
    expect(UnitConverter.formatTemperature(77, 'fahrenheit')).toBe('77℉');
  });

  test('负数温度正确格式化', () => {
    expect(UnitConverter.formatTemperature(-10, 'celsius')).toBe('-10℃');
  });

  test('浮点数保留1位小数', () => {
    expect(UnitConverter.formatTemperature(25.56, 'celsius')).toBe('25.6℃');
  });

  test('decimals=0 时显示整数', () => {
    expect(UnitConverter.formatTemperature(25.6, 'celsius', 0)).toBe('26℃');
  });

  test('非数字输入返回 "--"', () => {
    expect(UnitConverter.formatTemperature(null)).toBe('--');
    expect(UnitConverter.formatTemperature(undefined)).toBe('--');
    expect(UnitConverter.formatTemperature(NaN)).toBe('--');
    expect(UnitConverter.formatTemperature('hot')).toBe('--');
  });
});

describe('UnitConverter.formatWindSpeed', () => {
  test('默认单位为 km/h', () => {
    expect(UnitConverter.formatWindSpeed(15)).toBe('15 km/h');
  });

  test('unit=kmh 显示 km/h', () => {
    expect(UnitConverter.formatWindSpeed(15, 'kmh')).toBe('15 km/h');
  });

  test('unit=ms 显示 m/s', () => {
    expect(UnitConverter.formatWindSpeed(5, 'ms')).toBe('5 m/s');
  });

  test('浮点数保留1位小数', () => {
    expect(UnitConverter.formatWindSpeed(15.56, 'kmh')).toBe('15.6 km/h');
  });

  test('decimals=0 时显示整数', () => {
    expect(UnitConverter.formatWindSpeed(15.6, 'kmh', 0)).toBe('16 km/h');
  });

  test('非数字输入返回 "--"', () => {
    expect(UnitConverter.formatWindSpeed(null)).toBe('--');
    expect(UnitConverter.formatWindSpeed(NaN)).toBe('--');
    expect(UnitConverter.formatWindSpeed('windy')).toBe('--');
  });
});

describe('UnitConverter.batchCelsiusToFahrenheit', () => {
  test('批量转换数组', () => {
    const result = UnitConverter.batchCelsiusToFahrenheit([0, 100, -40]);
    expect(result).toEqual([32, 212, -40]);
  });

  test('空数组返回空数组', () => {
    expect(UnitConverter.batchCelsiusToFahrenheit([])).toEqual([]);
  });

  test('包含 null 的数组，null 转换为 null', () => {
    const result = UnitConverter.batchCelsiusToFahrenheit([0, null, 100]);
    expect(result[0]).toBe(32);
    expect(result[1]).toBeNull();
    expect(result[2]).toBe(212);
  });

  test('非数组输入返回空数组', () => {
    expect(UnitConverter.batchCelsiusToFahrenheit(null)).toEqual([]);
    expect(UnitConverter.batchCelsiusToFahrenheit('abc')).toEqual([]);
    expect(UnitConverter.batchCelsiusToFahrenheit(42)).toEqual([]);
  });

  test('支持自定义小数位', () => {
    const result = UnitConverter.batchCelsiusToFahrenheit([37], 2);
    expect(result[0]).toBe(98.6);
  });
});

describe('UnitConverter.batchMsToKmh', () => {
  test('批量转换数组', () => {
    const result = UnitConverter.batchMsToKmh([0, 1, 10]);
    expect(result).toEqual([0, 3.6, 36]);
  });

  test('空数组返回空数组', () => {
    expect(UnitConverter.batchMsToKmh([])).toEqual([]);
  });

  test('非数组输入返回空数组', () => {
    expect(UnitConverter.batchMsToKmh(null)).toEqual([]);
    expect(UnitConverter.batchMsToKmh(5)).toEqual([]);
  });

  test('包含 null 的数组，null 转换为 null', () => {
    const result = UnitConverter.batchMsToKmh([1, null]);
    expect(result[0]).toBe(3.6);
    expect(result[1]).toBeNull();
  });
});

describe('UnitConverter.convertTemperature', () => {
  test('相同单位直接返回（保留1位小数）', () => {
    expect(UnitConverter.convertTemperature(25, 'celsius', 'celsius')).toBe(25);
    expect(UnitConverter.convertTemperature(77, 'fahrenheit', 'fahrenheit')).toBe(77);
  });

  test('celsius → fahrenheit', () => {
    expect(UnitConverter.convertTemperature(0, 'celsius', 'fahrenheit')).toBe(32);
    expect(UnitConverter.convertTemperature(100, 'celsius', 'fahrenheit')).toBe(212);
  });

  test('fahrenheit → celsius', () => {
    expect(UnitConverter.convertTemperature(32, 'fahrenheit', 'celsius')).toBe(0);
    expect(UnitConverter.convertTemperature(212, 'fahrenheit', 'celsius')).toBe(100);
  });

  test('不支持的转换返回原始值', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const result = UnitConverter.convertTemperature(25, 'celsius', 'kelvin');
    expect(result).toBe(25);
    expect(consoleWarnSpy).toHaveBeenCalled();
    consoleWarnSpy.mockRestore();
  });

  test('相同单位时 decimals=null 保留原始精度', () => {
    const result = UnitConverter.convertTemperature(25.555, 'celsius', 'celsius', null);
    expect(result).toBe(25.555);
  });
});

describe('UnitConverter.convertWindSpeed', () => {
  test('相同单位直接返回（保留1位小数）', () => {
    expect(UnitConverter.convertWindSpeed(10, 'kmh', 'kmh')).toBe(10);
    expect(UnitConverter.convertWindSpeed(5, 'ms', 'ms')).toBe(5);
  });

  test('ms → kmh', () => {
    expect(UnitConverter.convertWindSpeed(1, 'ms', 'kmh')).toBe(3.6);
    expect(UnitConverter.convertWindSpeed(10, 'ms', 'kmh')).toBe(36);
  });

  test('kmh → ms', () => {
    expect(UnitConverter.convertWindSpeed(3.6, 'kmh', 'ms')).toBe(1);
    expect(UnitConverter.convertWindSpeed(36, 'kmh', 'ms')).toBe(10);
  });

  test('不支持的转换返回原始值', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const result = UnitConverter.convertWindSpeed(10, 'kmh', 'mph');
    expect(result).toBe(10);
    expect(consoleWarnSpy).toHaveBeenCalled();
    consoleWarnSpy.mockRestore();
  });

  test('相同单位时 decimals=null 保留原始精度', () => {
    const result = UnitConverter.convertWindSpeed(10.555, 'ms', 'ms', null);
    expect(result).toBe(10.555);
  });
});
