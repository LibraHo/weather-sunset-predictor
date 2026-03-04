/**
 * WeatherData类 - 表示特定时间点的天气数据
 * 
 * 包含所有气象参数：温度、湿度、云量、风速、气压和能见度
 * 提供数据验证方法确保气象数据在合理范围内
 * 
 * 需求：3.4 - 天气数据解析和存储
 * 需求：4.1 - 基本天气显示
 */
class WeatherData {
  /**
   * 创建WeatherData实例
   * @param {number} timestamp - Unix时间戳（毫秒）
   * @param {number} temp - 温度（摄氏度）
   * @param {number} humidity - 相对湿度（0-100）
   * @param {number} cloudCover - 云量（0-100）
   * @param {number} windSpeed - 风速（km/h）
   * @param {number} pressure - 气压（hPa）
   * @param {number} visibility - 能见度（km）
   * @param {number} lowClouds - 低层云量（0-100）
   * @param {number} precipitation - 降水量（mm）或降水概率（%）
   * @param {number} windDirection - 风向（度数，0-360）
   * @param {number} highClouds - 高云量（>6km，0-100）
   * @param {number} midClouds - 中云量（2-6km，0-100）
   */
  constructor(timestamp, temp, humidity, cloudCover, windSpeed, pressure, visibility, lowClouds = 0, precipitation = 0, windDirection = 0, highClouds = 0, midClouds = 0) {
    this.timestamp = timestamp;
    this.temp = temp;
    this.humidity = humidity;
    this.cloudCover = cloudCover;
    this.windSpeed = windSpeed;
    this.pressure = pressure;
    this.visibility = visibility;
    this.lowClouds = lowClouds;
    this.precipitation = precipitation;
    this.windDirection = windDirection;
    this.highClouds = highClouds;
    this.midClouds = midClouds;
  }

  /**
   * 验证所有气象参数是否在合理范围内
   * @returns {boolean} 如果所有数据有效返回true，否则返回false
   */
  isValid() {
    return (
      // 时间戳应该是正数
      this.timestamp > 0 &&
      // 温度范围：-60°C 到 60°C（与 isFieldValid 和 getValidationErrors 保持一致）
      this.temp >= -60 &&
      this.temp <= 60 &&
      // 湿度：0-100%
      this.humidity >= 0 &&
      this.humidity <= 100 &&
      // 云量：0-100%
      this.cloudCover >= 0 &&
      this.cloudCover <= 100 &&
      // 风速：0-500 km/h（理论最大值）
      this.windSpeed >= 0 &&
      this.windSpeed <= 500 &&
      // 气压：800-1100 hPa（极端气压范围）
      this.pressure >= 800 &&
      this.pressure <= 1100 &&
      // 能见度：0-50 km（合理范围）
      this.visibility >= 0 &&
      this.visibility <= 50 &&
      // 低层云量：0-100%
      this.lowClouds >= 0 &&
      this.lowClouds <= 100 &&
      // 降水量：0-500 mm（极端降水范围）
      this.precipitation >= 0 &&
      this.precipitation <= 500 &&
      // 风向：0-360度
      this.windDirection >= 0 &&
      this.windDirection <= 360 &&
      // 高云量：0-100%
      this.highClouds >= 0 &&
      this.highClouds <= 100 &&
      // 中云量：0-100%
      this.midClouds >= 0 &&
      this.midClouds <= 100
    );
  }

  /**
   * 验证特定字段是否在有效范围内
   * @param {string} field - 字段名称
   * @returns {boolean} 如果字段有效返回true，否则返回false
   */
  isFieldValid(field) {
    switch (field) {
      case 'timestamp':
        return this.timestamp > 0;
      case 'temp':
        return this.temp >= -60 && this.temp <= 60;
      case 'humidity':
        return this.humidity >= 0 && this.humidity <= 100;
      case 'cloudCover':
        return this.cloudCover >= 0 && this.cloudCover <= 100;
      case 'windSpeed':
        return this.windSpeed >= 0 && this.windSpeed <= 500;
      case 'pressure':
        return this.pressure >= 800 && this.pressure <= 1100;
      case 'visibility':
        return this.visibility >= 0 && this.visibility <= 50;
      case 'lowClouds':
        return this.lowClouds >= 0 && this.lowClouds <= 100;
      case 'precipitation':
        return this.precipitation >= 0 && this.precipitation <= 500;
      case 'windDirection':
        return this.windDirection >= 0 && this.windDirection <= 360;
      case 'highClouds':
        return this.highClouds >= 0 && this.highClouds <= 100;
      case 'midClouds':
        return this.midClouds >= 0 && this.midClouds <= 100;
      default:
        return false;
    }
  }

  /**
   * 获取数据验证错误信息
   * @returns {Array<string>} 验证错误信息数组，如果没有错误则返回空数组
   */
  getValidationErrors() {
    const errors = [];

    if (this.timestamp <= 0) {
      errors.push('时间戳必须是正数');
    }
    if (this.temp < -60 || this.temp > 60) {
      errors.push('温度必须在-60°C到60°C之间');
    }
    if (this.humidity < 0 || this.humidity > 100) {
      errors.push('湿度必须在0%到100%之间');
    }
    if (this.cloudCover < 0 || this.cloudCover > 100) {
      errors.push('云量必须在0%到100%之间');
    }
    if (this.windSpeed < 0 || this.windSpeed > 500) {
      errors.push('风速必须在0到500 km/h之间');
    }
    if (this.pressure < 800 || this.pressure > 1100) {
      errors.push('气压必须在800到1100 hPa之间');
    }
    if (this.visibility < 0 || this.visibility > 50) {
      errors.push('能见度必须在0到50 km之间');
    }
    if (this.lowClouds < 0 || this.lowClouds > 100) {
      errors.push('低层云量必须在0%到100%之间');
    }
    if (this.precipitation < 0 || this.precipitation > 500) {
      errors.push('降水量必须在0到500 mm之间');
    }
    if (this.windDirection < 0 || this.windDirection > 360) {
      errors.push('风向必须在0到360度之间');
    }
    if (this.highClouds < 0 || this.highClouds > 100) {
      errors.push('高云量必须在0%到100%之间');
    }
    if (this.midClouds < 0 || this.midClouds > 100) {
      errors.push('中云量必须在0%到100%之间');
    }

    return errors;
  }

  /**
   * 将WeatherData对象转换为JSON格式
   * @returns {Object} JSON对象
   */
  toJSON() {
    return {
      timestamp: this.timestamp,
      temp: this.temp,
      humidity: this.humidity,
      cloudCover: this.cloudCover,
      windSpeed: this.windSpeed,
      pressure: this.pressure,
      visibility: this.visibility,
      lowClouds: this.lowClouds,
      precipitation: this.precipitation,
      windDirection: this.windDirection,
      highClouds: this.highClouds,
      midClouds: this.midClouds
    };
  }

  /**
   * 从JSON对象创建WeatherData实例
   * @param {Object} json - JSON对象
   * @returns {WeatherData} WeatherData实例
   */
  static fromJSON(json) {
    return new WeatherData(
      json.timestamp,
      json.temp,
      json.humidity,
      json.cloudCover,
      json.windSpeed,
      json.pressure,
      json.visibility,
      json.lowClouds || 0,
      json.precipitation || 0,
      json.windDirection || 0,
      json.highClouds || 0,
      json.midClouds || 0
    );
  }
}

// 导出供其他模块使用
export default WeatherData;
