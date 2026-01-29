/**
 * UnitConverter - 单位转换工具类
 *
 * 提供各种单位转换方法，支持舍入精度控制
 */

class UnitConverter {
  /**
   * 温度单位常量
   */
  static TEMP_UNITS = {
    CELSIUS: 'celsius',
    FAHRENHEIT: 'fahrenheit'
  };

  /**
   * 风速单位常量
   */
  static WIND_UNITS = {
    KMH: 'kmh',
    MS: 'ms'
  };

  /**
   * 摄氏度转华氏度
   * @param {number} celsius - 摄氏度温度
   * @param {number} decimals - 小数位数，默认1位
   * @returns {number} 华氏度温度
   */
  static celsiusToFahrenheit(celsius, decimals = 1) {
    if (typeof celsius !== 'number' || isNaN(celsius)) {
      console.warn('[UnitConverter] Invalid celsius value:', celsius);
      return null;
    }
    const fahrenheit = (celsius * 9 / 5) + 32;
    return decimals !== null ? Number(fahrenheit.toFixed(decimals)) : fahrenheit;
  }

  /**
   * 华氏度转摄氏度
   * @param {number} fahrenheit - 华氏度温度
   * @param {number} decimals - 小数位数，默认1位
   * @returns {number} 摄氏度温度
   */
  static fahrenheitToCelsius(fahrenheit, decimals = 1) {
    if (typeof fahrenheit !== 'number' || isNaN(fahrenheit)) {
      console.warn('[UnitConverter] Invalid fahrenheit value:', fahrenheit);
      return null;
    }
    const celsius = (fahrenheit - 32) * 5 / 9;
    return decimals !== null ? Number(celsius.toFixed(decimals)) : celsius;
  }

  /**
   * 米/秒 转为 公里/小时
   * @param {number} ms - 米/秒速度
   * @param {number} decimals - 小数位数，默认1位
   * @returns {number} 公里/小时速度
   */
  static msToKmh(ms, decimals = 1) {
    if (typeof ms !== 'number' || isNaN(ms)) {
      console.warn('[UnitConverter] Invalid ms value:', ms);
      return null;
    }
    const kmh = ms * 3.6;
    return decimals !== null ? Number(kmh.toFixed(decimals)) : kmh;
  }

  /**
   * 公里/小时 转为 米/秒
   * @param {number} kmh - 公里/小时速度
   * @param {number} decimals - 小数位数，默认1位
   * @returns {number} 米/秒速度
   */
  static kmhToMs(kmh, decimals = 1) {
    if (typeof kmh !== 'number' || isNaN(kmh)) {
      console.warn('[UnitConverter] Invalid kmh value:', kmh);
      return null;
    }
    const ms = kmh / 3.6;
    return decimals !== null ? Number(ms.toFixed(decimals)) : ms;
  }

  /**
   * 格式化温度显示
   * @param {number} value - 温度值
   * @param {string} unit - 温度单位 ('celsius' | 'fahrenheit')
   * @param {number} decimals - 小数位数，默认1位
   * @returns {string} 格式化后的温度字符串（如 "25°C"）
   */
  static formatTemperature(value, unit = 'celsius', decimals = 1) {
    if (typeof value !== 'number' || isNaN(value)) {
      return '--';
    }

    const displayValue = decimals !== null ? Number(value.toFixed(decimals)) : value;
    const symbol = unit === 'fahrenheit' ? '℉' : '℃';
    return `${displayValue}${symbol}`;
  }

  /**
   * 格式化风速显示
   * @param {number} value - 风速值
   * @param {string} unit - 风速单位 ('kmh' | 'ms')
   * @param {number} decimals - 小数位数，默认1位
   * @returns {string} 格式化后的风速字符串（如 "15 km/h"）
   */
  static formatWindSpeed(value, unit = 'kmh', decimals = 1) {
    if (typeof value !== 'number' || isNaN(value)) {
      return '--';
    }

    const displayValue = decimals !== null ? Number(value.toFixed(decimals)) : value;
    const suffix = unit === 'ms' ? 'm/s' : 'km/h';
    return `${displayValue} ${suffix}`;
  }

  /**
   * 批量转换温度数据
   * @param {number[]} celsiusValues - 摄氏度温度数组
   * @param {number} decimals - 小数位数
   * @returns {number[]} 华氏度温度数组
   */
  static batchCelsiusToFahrenheit(celsiusValues, decimals = 1) {
    if (!Array.isArray(celsiusValues)) {
      console.warn('[UnitConverter] batchCelsiusToFahrenheit expects an array');
      return [];
    }
    return celsiusValues.map(c => this.celsiusToFahrenheit(c, decimals));
  }

  /**
   * 批量转换风速数据
   * @param {number[]} msValues - 米/秒速度数组
   * @param {number} decimals - 小数位数
   * @returns {number[]} 公里/小时速度数组
   */
  static batchMsToKmh(msValues, decimals = 1) {
    if (!Array.isArray(msValues)) {
      console.warn('[UnitConverter] batchMsToKmh expects an array');
      return [];
    }
    return msValues.map(ms => this.msToKmh(ms, decimals));
  }

  /**
   * 根据目标单位转换温度
   * @param {number} value - 温度值
   * @param {string} fromUnit - 源单位 ('celsius' | 'fahrenheit')
   * @param {string} toUnit - 目标单位 ('celsius' | 'fahrenheit')
   * @param {number} decimals - 小数位数
   * @returns {number} 转换后的温度值
   */
  static convertTemperature(value, fromUnit, toUnit, decimals = 1) {
    if (fromUnit === toUnit) {
      return decimals !== null ? Number(value.toFixed(decimals)) : value;
    }

    if (fromUnit === 'celsius' && toUnit === 'fahrenheit') {
      return this.celsiusToFahrenheit(value, decimals);
    }

    if (fromUnit === 'fahrenheit' && toUnit === 'celsius') {
      return this.fahrenheitToCelsius(value, decimals);
    }

    console.warn('[UnitConverter] Unsupported temperature conversion:', fromUnit, 'to', toUnit);
    return value;
  }

  /**
   * 根据目标单位转换风速
   * @param {number} value - 风速值
   * @param {string} fromUnit - 源单位 ('kmh' | 'ms')
   * @param {string} toUnit - 目标单位 ('kmh' | 'ms')
   * @param {number} decimals - 小数位数
   * @returns {number} 转换后的风速值
   */
  static convertWindSpeed(value, fromUnit, toUnit, decimals = 1) {
    if (fromUnit === toUnit) {
      return decimals !== null ? Number(value.toFixed(decimals)) : value;
    }

    if (fromUnit === 'ms' && toUnit === 'kmh') {
      return this.msToKmh(value, decimals);
    }

    if (fromUnit === 'kmh' && toUnit === 'ms') {
      return this.kmhToMs(value, decimals);
    }

    console.warn('[UnitConverter] Unsupported wind speed conversion:', fromUnit, 'to', toUnit);
    return value;
  }
}

export default UnitConverter;
