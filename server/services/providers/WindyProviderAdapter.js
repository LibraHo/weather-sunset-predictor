const BaseWeatherProvider = require('./BaseWeatherProvider');
const windyService = require('../windyService'); // 原本的单例

class WindyProviderAdapter extends BaseWeatherProvider {
  constructor() {
    super('windy');
  }

  async fetchWeatherData(lat, lon, hours = 168, userApiKey = null) {
    const startTime = Date.now();
    try {
      const result = await windyService.fetchWeatherData(lat, lon, hours, userApiKey);
      
      // 检查原本的数据，补充 providerMeta
      return {
        hours: result.hours,
        data: result.data, // 假设 windyService.fetchWeatherData 已返回所需结构
        providerMeta: {
          name: this.name,
          latency: Date.now() - startTime,
          dataQuality: 'standard',
          unsupportedFields: [],
          degradedReason: []
        }
      };
    } catch (error) {
      throw error; // 交给 orchestrator 处理
    }
  }
}

module.exports = new WindyProviderAdapter();
module.exports.WindyProviderAdapter = WindyProviderAdapter;
