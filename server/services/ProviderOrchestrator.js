const openMeteoProvider = require('./providers/OpenMeteoProvider');
const windyProvider = require('./providers/WindyProviderAdapter');
const sequenceValidator = require('./validators/ForecastSequenceValidator');

class ProviderOrchestrator {
  constructor() {
    this.providers = {
      openmeteo: openMeteoProvider,
      windy: windyProvider
    };

    // 任务51.1：默认仅 Open-Meteo，Windy 仅 emergency fallback
    this.primaryProvider = process.env.PRIMARY_WEATHER_PROVIDER || 'openmeteo';
    this.fallbackProvider = process.env.FALLBACK_WEATHER_PROVIDER || 'windy';
    this.emergencyFallbackEnabled = process.env.ENABLE_WINDY_EMERGENCY_FALLBACK === 'true';

    // 任务49.2：Windy 特定子评分开关（迁移到 Open-Meteo 时默认关闭）
    this.featureFlags = {
      capeScoreEnabled: process.env.ENABLE_CAPE_SCORE === 'true',
      convectivePrecipScoreEnabled: process.env.ENABLE_CONVECTIVE_PRECIP_SCORE === 'true'
    };
  }

  _appendScoringDegradeMeta(providerMeta = {}) {
    const meta = {
      ...providerMeta,
      unsupportedFields: providerMeta.unsupportedFields || [],
      degradedReason: providerMeta.degradedReason || []
    };

    if (!this.featureFlags.capeScoreEnabled) {
      meta.unsupportedFields = [...new Set([...meta.unsupportedFields, 'cape'])];
      meta.degradedReason.push('cape scoring disabled by feature flag');
    }

    if (!this.featureFlags.convectivePrecipScoreEnabled) {
      meta.unsupportedFields = [...new Set([...meta.unsupportedFields, 'convPrecip'])];
      meta.degradedReason.push('convPrecip scoring disabled by feature flag');
    }

    meta.scoringFeatures = {
      cape: this.featureFlags.capeScoreEnabled,
      convPrecip: this.featureFlags.convectivePrecipScoreEnabled
    };

    return meta;
  }

  _validateAndAnnotate(rawData, providerName) {
    const validated = sequenceValidator.validateAndRepair(rawData.data || []);
    rawData.data = validated.validData;
    rawData.hours = validated.validData.length;

    rawData.providerMeta = rawData.providerMeta || { name: providerName };
    rawData.providerMeta.name = rawData.providerMeta.name || providerName;
    rawData.providerMeta.dataQuality = validated.quality;
    rawData.providerMeta.degradedReason = rawData.providerMeta.degradedReason || [];
    if (validated.issues.length > 0) {
      rawData.providerMeta.degradedReason.push(...validated.issues);
    }

    // 任务51.2：providerMeta 强制校验
    rawData.providerMeta.providerValidated = rawData.providerMeta.name === 'openmeteo';
    if (!rawData.providerMeta.providerValidated) {
      rawData.providerMeta.degradedReason.push(`provider not openmeteo: ${rawData.providerMeta.name}`);
    }

    rawData.providerMeta = this._appendScoringDegradeMeta(rawData.providerMeta);
    return rawData;
  }

  async fetchWeatherData(lat, lon, hours = 168) {
    const primary = this.providers[this.primaryProvider];

    if (!primary) {
      throw new Error(`未知的 Primary 天气数据源: ${this.primaryProvider}`);
    }

    try {
      const rawData = await primary.fetchWeatherData(lat, lon, hours);
      return this._validateAndAnnotate(rawData, this.primaryProvider);
    } catch (primaryError) {
      console.error(`[ProviderOrchestrator] Primary (${this.primaryProvider}) 失败:`, primaryError.message);

      if (!this.emergencyFallbackEnabled) {
        throw primaryError;
      }

      const fallback = this.providers[this.fallbackProvider];
      if (!fallback || fallback.name === primary.name) {
        throw primaryError;
      }

      console.warn(`[ProviderOrchestrator] emergency fallback 启用，尝试: ${this.fallbackProvider}`);
      try {
        const fallbackData = await fallback.fetchWeatherData(lat, lon, hours);
        const annotated = this._validateAndAnnotate(fallbackData, this.fallbackProvider);
        annotated.providerMeta.degradedReason.push(
          `Primary Provider (${this.primaryProvider}) failed: ${primaryError.message}`
        );
        return annotated;
      } catch (fallbackError) {
        console.error(`[ProviderOrchestrator] Fallback (${this.fallbackProvider}) 失败:`, fallbackError.message);
        throw new Error(`所有数据源均无法获取有效天气数据。Primary: ${primaryError.message}, Fallback: ${fallbackError.message}`);
      }
    }
  }
}

module.exports = new ProviderOrchestrator();
