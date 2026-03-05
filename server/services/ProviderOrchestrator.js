const openMeteoProvider = require('./providers/OpenMeteoProvider');
const windyProvider = require('./providers/WindyProviderAdapter');

class ProviderOrchestrator {
  constructor() {
    this.providers = {
      openmeteo: openMeteoProvider,
      windy: windyProvider
    };
    
    // 默认使用 Open-Meteo，因为它是 Phase 11 确定的主要数据源，免费、无需配置 API Key
    this.primaryProvider = process.env.PRIMARY_WEATHER_PROVIDER || 'openmeteo';
    this.fallbackProvider = process.env.FALLBACK_WEATHER_PROVIDER || 'windy';
  }

  /**
   * 按策略获取天气数据
   */
  async fetchWeatherData(lat, lon, hours = 168, userApiKey = null) {
    const primary = this.providers[this.primaryProvider];
    const fallback = this.providers[this.fallbackProvider];

    if (!primary) {
      throw new Error(`未知的Primary天气数据源: ${this.primaryProvider}`);
    }

    try {
      console.log(`[ProviderOrchestrator] 尝试使用 Primary 数据源: ${this.primaryProvider}`);
      return await primary.fetchWeatherData(lat, lon, hours, userApiKey);
    } catch (primaryError) {
      console.error(`[ProviderOrchestrator] Primary (${this.primaryProvider}) 失败:`, primaryError.message);
      
      if (fallback && fallback.name !== primary.name) {
        console.warn(`[ProviderOrchestrator] 触发降级，尝试使用 Fallback 数据源: ${this.fallbackProvider}`);
        try {
          const fallbackData = await fallback.fetchWeatherData(lat, lon, hours, userApiKey);
          
          // 在元数据里标记降级发生的原因
          if (fallbackData.providerMeta) {
            fallbackData.providerMeta.degradedReason = fallbackData.providerMeta.degradedReason || [];
            fallbackData.providerMeta.degradedReason.push(
              `Primary Provider (${this.primaryProvider}) failed: ${primaryError.message}`
            );
          }
          return fallbackData;
        } catch (fallbackError) {
          console.error(`[ProviderOrchestrator] Fallback (${this.fallbackProvider}) 也失败了:`, fallbackError.message);
          throw new Error(`所有数据源均无法获取天气数据。Primary: ${primaryError.message}, Fallback: ${fallbackError.message}`);
        }
      } else {
        throw primaryError;
      }
    }
  }
}

// 导出单例
module.exports = new ProviderOrchestrator();
