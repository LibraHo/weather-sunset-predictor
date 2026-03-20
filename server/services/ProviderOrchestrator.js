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

    // Phase 14 任务60.1：预测链路 provider 门禁（默认开启）
    // true  → 强制要求使用 Open-Meteo，非 openmeteo 请求直接拒绝
    // false → 允许使用其他 provider（用于开发测试或紧急 fallback）
    this.openmeteoOnlyMode = process.env.DISABLE_OPENMETEO_GATE !== 'true';

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
  async _fetchWithQualityGate(providerKey, lat, lon, hours, weatherModel = 'ecmwf_ifs025') {
    const provider = this.providers[providerKey];
    if (!provider) {
      throw new Error(`未知的天气数据源: ${providerKey}`);
    }

    // Phase 14 任务60.1：预测链路 provider 门禁
    // 非 openmeteo 请求打告警并拒绝进入预测核心
    if (this.openmeteoOnlyMode && providerKey !== 'openmeteo') {
      const error = new Error(
        `预测链路 provider 门禁：当前仅允许使用 Open-Meteo（provider=${providerKey}）。` +
        `如需使用其他 provider，请设置环境变量 DISABLE_OPENMETEO_GATE=true。`
      );
      error.code = 'PROVIDER_GATE_VIOLATION';
      error.providerKey = providerKey;
      console.error('[ProviderOrchestrator]', error.message);
      throw error;
    }

    const rawData = await provider.fetchWeatherData(lat, lon, hours, null, weatherModel);

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

  async fetchWeatherData(lat, lon, hours = 168, weatherModel = 'ecmwf_ifs025') {
    const primaryKey = this.primaryProvider;
    const fallbackKey = this.fallbackProvider;

    let primaryError = null;

    try {
      return await this._fetchWithQualityGate(primaryKey, lat, lon, hours, weatherModel);
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
        const fallbackData = await this._fetchWithQualityGate(fallbackKey, lat, lon, hours, weatherModel);
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
}

module.exports = new ProviderOrchestrator();
module.exports.ProviderOrchestrator = ProviderOrchestrator;
