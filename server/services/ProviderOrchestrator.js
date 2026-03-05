const openMeteoProvider = require('./providers/OpenMeteoProvider');
const windyProvider = require('./providers/WindyProviderAdapter');
const sequenceValidator = require('./validators/ForecastSequenceValidator');

class ProviderOrchestrator {
  constructor() {
    this.providers = {
      openmeteo: openMeteoProvider,
      windy: windyProvider
    };
    
    this.primaryProvider = process.env.PRIMARY_WEATHER_PROVIDER || 'openmeteo';
    this.fallbackProvider = process.env.FALLBACK_WEATHER_PROVIDER || 'windy';
  }

  async fetchWeatherData(lat, lon, hours = 168, userApiKey = null) {
    const primary = this.providers[this.primaryProvider];
    const fallback = this.providers[this.fallbackProvider];

    if (!primary) {
      throw new Error(`未知的Primary天气数据源: ${this.primaryProvider}`);
    }

    try {
      console.log(`[ProviderOrchestrator] 尝试使用 Primary 数据源: ${this.primaryProvider}`);
      const rawData = await primary.fetchWeatherData(lat, lon, hours, userApiKey);
      
      // 数据质量校验与修复 (需求 31, 任务 43)
      const validated = sequenceValidator.validateAndRepair(rawData.data);
      rawData.data = validated.validData;
      rawData.hours = validated.validData.length;
      
      if (rawData.providerMeta) {
        rawData.providerMeta.dataQuality = validated.quality;
        if (validated.issues.length > 0) {
          rawData.providerMeta.degradedReason = rawData.providerMeta.degradedReason || [];
          rawData.providerMeta.degradedReason.push(...validated.issues);
        }
      }
      return rawData;
    } catch (primaryError) {
      console.error(`[ProviderOrchestrator] Primary (${this.primaryProvider}) 失败/被拒绝:`, primaryError.message);
      
      if (fallback && fallback.name !== primary.name) {
        console.warn(`[ProviderOrchestrator] 触发降级，尝试使用 Fallback 数据源: ${this.fallbackProvider}`);
        try {
          const fallbackData = await fallback.fetchWeatherData(lat, lon, hours, userApiKey);
          
          // 对 fallback 数据也要做校验
          const validatedFallback = sequenceValidator.validateAndRepair(fallbackData.data);
          fallbackData.data = validatedFallback.validData;
          fallbackData.hours = validatedFallback.validData.length;
          
          if (fallbackData.providerMeta) {
            fallbackData.providerMeta.dataQuality = validatedFallback.quality;
            fallbackData.providerMeta.degradedReason = fallbackData.providerMeta.degradedReason || [];
            if (validatedFallback.issues.length > 0) {
              fallbackData.providerMeta.degradedReason.push(...validatedFallback.issues);
            }
            fallbackData.providerMeta.degradedReason.push(
              `Primary Provider (${this.primaryProvider}) failed: ${primaryError.message}`
            );
          }
          return fallbackData;
        } catch (fallbackError) {
          console.error(`[ProviderOrchestrator] Fallback (${this.fallbackProvider}) 也失败了:`, fallbackError.message);
          throw new Error(`所有数据源均无法获取有效天气数据。Primary: ${primaryError.message}, Fallback: ${fallbackError.message}`);
        }
      } else {
        throw primaryError;
      }
    }
  }
}

module.exports = new ProviderOrchestrator();
