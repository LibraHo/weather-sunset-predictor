/**
 * 天气服务提供商基类 (Interface/Abstract)
 * 定义标准的提供商行为，确保不同 API 返回相同格式的数据模型。
 */
class BaseWeatherProvider {
  /**
   * @param {string} name - Provider的唯一名称（如 'windy', 'openmeteo', 'caiyun'）
   */
  constructor(name) {
    this.name = name;
  }

  /**
   * 获取标准化天气数据
   * @param {number} lat - 纬度
   * @param {number} lon - 经度
   * @param {number} hours - 预测小时数
   * @param {string|null} userApiKey - 用户自定义的 API Key（如果有）
   * @returns {Promise<{
   *   hours: number,
   *   data: Array<{
   *     timestamp: number,
   *     temp: number|null,
   *     humidity: number|null,
   *     cloudCover: number|null,
   *     windSpeed: number|null,
   *     windDirection: number|null,
   *     pressure: number|null,
   *     visibility: number|null,
   *     precipitation: number|null,
   *     lowClouds: number|null,
   *     midClouds: number|null,
   *     highClouds: number|null,
   *     shortwaveRadiation: number|null,
   *     directRadiation: number|null,
   *     diffuseRadiation: number|null,
   *     waterVapourColumn: number|null
   *   }>,
   *   providerMeta: {
   *     name: string,
   *     latency: number,
   *     dataQuality: string,
   *     unsupportedFields: string[],
   *     degradedReason: string[]
   *   }
   * }>} 标准化格式的天气数据
   */
  async fetchWeatherData(lat, lon, hours = 168, userApiKey = null) {
    throw new Error('fetchWeatherData must be implemented by subclass');
  }

  /**
   * 估算能见度 (km)
   * 供缺少能见度数据的 Provider 子类复用
   * @param {number|null} humidity - 相对湿度 (0-100)
   * @param {number} precipitation - 降水量 (mm)
   * @param {number} cloudCover - 云量 (0-100)
   * @returns {number} 估算能见度(km)
   */
  estimateVisibility(humidity, precipitation, cloudCover) {
    const rh = humidity ?? 50;
    const precip = precipitation ?? 0;
    const cloud = cloudCover ?? 0;

    if (precip > 0.1) return 5;
    if (rh > 90) return 8;
    if (rh > 80 && cloud > 70) return 10;
    if (rh > 70) return 15;
    return 20;
  }
}

module.exports = BaseWeatherProvider;
