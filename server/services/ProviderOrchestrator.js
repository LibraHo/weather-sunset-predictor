const openMeteoProvider = require('./providers/OpenMeteoProvider');
const windyProvider = require('./providers/WindyProviderAdapter');
const caiyunProvider = require('./providers/CaiyunProviderAdapter');
const sequenceValidator = require('./validators/ForecastSequenceValidator');

class ProviderOrchestrator {
  constructor() {
    // Phase 15 任务63.1：ENABLE_WINDY 统一开关（默认 false）
    // true  → Windy 注册为 emergency fallback，可一键接入
    // false → Windy 完全不注册，fallback 也不触发
    this.windyEnabled = process.env.ENABLE_WINDY === 'true';

    this.providers = {
      openmeteo: openMeteoProvider,
      ...(this.windyEnabled ? { windy: windyProvider } : {}),
      caiyun: caiyunProvider
    };

    // 任务51.1：默认仅 Open-Meteo，Windy 仅 emergency fallback
    this.primaryProvider = process.env.PRIMARY_WEATHER_PROVIDER || 'openmeteo';
    this.fallbackProvider = process.env.FALLBACK_WEATHER_PROVIDER || 'windy';

    // emergency fallback: ENABLE_WINDY=true 时生效（默认关闭）
    // 兼容旧变量 ENABLE_WINDY_EMERGENCY_FALLBACK，新项目统一用 ENABLE_WINDY
    this.emergencyFallbackEnabled = this.windyEnabled &&
      process.env.ENABLE_WINDY_EMERGENCY_FALLBACK !== 'false';

    // 任务43.3：时序质量门禁 fallback（默认开启）
    // 当序列校验抛出严重错误时，自动切到 fallback provider
    this.qualityGateFallbackEnabled = process.env.ENABLE_QUALITY_GATE_FALLBACK !== 'false';

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

  /**
   * 任务43.2：校验数据时序并写入 providerMeta.sequenceQuality
   * 任务43.3：时序严重异常时抛出，由调用方决定是否触发 fallback
   */
  _validateAndAnnotate(rawData, providerName) {
    const validated = sequenceValidator.validateAndRepair(rawData.data || []);
    rawData.data = validated.validData;
    rawData.hours = validated.validData.length;

    rawData.providerMeta = rawData.providerMeta || { name: providerName };
    rawData.providerMeta.name = rawData.providerMeta.name || providerName;

    // 任务43.2：接入时序质量标签（不要覆盖数据源自带 quality 字段）
    rawData.providerMeta.sequenceQuality = validated.quality;
    rawData.providerMeta.dataQualityIssues = validated.issues;
    if (!rawData.providerMeta.dataQuality) {
      rawData.providerMeta.dataQuality = validated.quality;
    }

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

  /**
   * 任务43.3：尝试从指定 provider 获取数据并经过质量门禁
   * @returns { data, isQualityError } - isQualityError 为 true 时表示是序列校验失败
   */
  async _fetchWithQualityGate(providerKey, lat, lon, hours, weatherModel = 'ecmwf_ifs025', fetchOptions = {}) {
    const provider = this.providers[providerKey];
    if (!provider) {
      throw new Error(`未知的天气数据源: ${providerKey}`);
    }

    const rawData = await provider.fetchWeatherData(lat, lon, hours, null, weatherModel, fetchOptions);

    // 序列校验可能抛出（严重缺口/数据量太少）- 这是质量门禁错误
    let annotated;
    try {
      annotated = this._validateAndAnnotate(rawData, providerKey);
    } catch (qualityError) {
      qualityError.isQualityError = true;
      qualityError.providerKey = providerKey;
      throw qualityError;
    }

    return annotated;
  }

  async _fetchBatchWithQualityGate(providerKey, points, hours, weatherModel = 'ecmwf_ifs025', fetchOptions = {}) {
    const provider = this.providers[providerKey];
    if (!provider) {
      throw new Error(`未知的天气数据源: ${providerKey}`);
    }

    const pointList = Array.isArray(points) ? points : [];
    if (pointList.length === 0) {
      return {};
    }

    const addByPoint = (target, key, rawData) => {
      const annotated = this._validateAndAnnotate(rawData, providerKey);
      target[key] = annotated;
    };

    if (typeof provider.fetchWeatherDataBatch === 'function') {
      const rawMap = await provider.fetchWeatherDataBatch(pointList, hours, weatherModel, fetchOptions);
      const result = {};

      for (const point of pointList) {
        const key = `${point.lat},${point.lon}`;
        const rawData = rawMap?.[key];
        if (!rawData) {
          const missError = new Error(`Batch response missing point ${key}`);
          missError.isQualityError = true;
          missError.providerKey = providerKey;
          throw missError;
        }

        try {
          addByPoint(result, key, rawData);
        } catch (qualityError) {
          qualityError.isQualityError = true;
          qualityError.providerKey = providerKey;
          throw qualityError;
        }
      }

      return result;
    }

    // 兼容不支持批量接口的 provider：串行回退单点调用
    const fallbackMap = {};
    for (const point of pointList) {
      try {
        const rawData = await provider.fetchWeatherData(point.lat, point.lon, hours, null, weatherModel, fetchOptions);
        addByPoint(fallbackMap, `${point.lat},${point.lon}`, rawData);
      } catch (error) {
        if (!error.isQualityError) {
          error.isQualityError = true;
        }
        error.providerKey = providerKey;
        throw error;
      }
    }

    return fallbackMap;
  }

  async fetchWeatherData(lat, lon, hours = 168, weatherModel = 'ecmwf_ifs025', fetchOptions = {}) {
    const primaryKey = this.primaryProvider;
    const fallbackKey = this.fallbackProvider;

    let primaryError = null;

    try {
      return await this._fetchWithQualityGate(primaryKey, lat, lon, hours, weatherModel, fetchOptions);
    } catch (err) {
      primaryError = err;
      const isQuality = err.isQualityError;

      if (isQuality) {
        console.warn(`[ProviderOrchestrator] Primary (${primaryKey}) 数据质量门禁失败:`, err.message);
      } else {
        console.error(`[ProviderOrchestrator] Primary (${primaryKey}) 请求失败:`, err.message);
      }

      // 任务43.3：质量门禁失败 → qualityGateFallback
      // emergency fallback：服务本身故障
      const canFallback = isQuality
        ? this.qualityGateFallbackEnabled
        : this.emergencyFallbackEnabled;

      if (!canFallback || fallbackKey === primaryKey) {
        throw primaryError;
      }

      const fallbackProvider = this.providers[fallbackKey];
      if (!fallbackProvider) {
        throw primaryError;
      }

      console.warn(`[ProviderOrchestrator] 触发 fallback (${fallbackKey}), 原因: ${err.message}`);

      try {
        const fallbackData = await this._fetchWithQualityGate(fallbackKey, lat, lon, hours, weatherModel, fetchOptions);
        fallbackData.providerMeta.degradedReason = fallbackData.providerMeta.degradedReason || [];
        fallbackData.providerMeta.degradedReason.push(
          `Primary Provider (${primaryKey}) failed: ${primaryError.message}`
        );
        fallbackData.providerMeta.usedFallback = true;
        fallbackData.providerMeta.fallbackReason = primaryError.isQualityError
          ? 'quality_gate_failure'
          : 'primary_provider_error';
        return fallbackData;
      } catch (fallbackError) {
        console.error(`[ProviderOrchestrator] Fallback (${fallbackKey}) 失败:`, fallbackError.message);
        throw new Error(
          `所有数据源均无法获取有效天气数据。Primary: ${primaryError.message}, Fallback: ${fallbackError.message}`
        );
      }
    }
  }

  async fetchWeatherDataBatch(points, hours = 168, weatherModel = 'ecmwf_ifs025', fetchOptions = {}) {
    const primaryKey = this.primaryProvider;
    const fallbackKey = this.fallbackProvider;
    const pointList = Array.isArray(points) ? points : [];

    let primaryError = null;

    try {
      return await this._fetchBatchWithQualityGate(primaryKey, pointList, hours, weatherModel, fetchOptions);
    } catch (err) {
      primaryError = err;
      const isQuality = err.isQualityError;

      if (isQuality) {
        console.warn(`[ProviderOrchestrator] Batch primary (${primaryKey}) 数据质量门禁失败:`, err.message);
      } else {
        console.error(`[ProviderOrchestrator] Batch primary (${primaryKey}) 请求失败:`, err.message);
      }

      const canFallback = isQuality
        ? this.qualityGateFallbackEnabled
        : this.emergencyFallbackEnabled;

      if (!canFallback || fallbackKey === primaryKey || !this.providers[fallbackKey]) {
        throw primaryError;
      }

      console.warn(`[ProviderOrchestrator] Batch 触发 fallback (${fallbackKey}), 原因: ${err.message}`);

      try {
        const fallbackMap = await this._fetchBatchWithQualityGate(fallbackKey, pointList, hours, weatherModel, fetchOptions);
        for (const point of pointList) {
          const key = `${point.lat},${point.lon}`;
          const pointData = fallbackMap[key];
          if (!pointData) continue;
          pointData.providerMeta = pointData.providerMeta || {};
          pointData.providerMeta.degradedReason = pointData.providerMeta.degradedReason || [];
          pointData.providerMeta.degradedReason.push(
            `Primary Provider (${primaryKey}) failed: ${primaryError.message}`
          );
          pointData.providerMeta.usedFallback = true;
          pointData.providerMeta.fallbackReason = primaryError.isQualityError
            ? 'quality_gate_failure'
            : 'primary_provider_error';
        }
        return fallbackMap;
      } catch (fallbackError) {
        console.error(`[ProviderOrchestrator] Batch fallback (${fallbackKey}) 失败:`, fallbackError.message);
        throw new Error(
          `批量天气数据获取失败。Primary: ${primaryError.message}, Fallback: ${fallbackError.message}`
        );
      }
    }
  }
}

module.exports = new ProviderOrchestrator();
module.exports.ProviderOrchestrator = ProviderOrchestrator;
