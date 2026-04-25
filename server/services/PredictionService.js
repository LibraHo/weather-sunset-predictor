/**
 * PredictionService - 基础火烧云预测服务（后端版）
 *
 * 分析气象数据，计算火烧云（晚霞/朝霞）出现的可能性和质量
 * 复用 SunCalculator 工具类
 *
 * 需求：22 (前后端分离 - Phase 1)
 * @author Backend Migration v1.0
 */

const SunCalculator = require('../utils/SunCalculator.js');

// ========== 服务类定义 ==========

class PredictionService {
  /**
   * 创建预测服务实例
   *
   * @param {Object} options - 配置选项
   * @param {Object} options.weights - 兼容旧参数（当前统一评分不使用）
   */
  constructor(options = {}) {
    this.weights = options.weights || null;
  }

  _toNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }

  _gaussian(value, mean, sigma) {
    return Math.exp(-Math.pow(value - mean, 2) / (2 * sigma * sigma));
  }

  _clamp(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, value));
  }

  _scoreAerosolScattering(weatherData) {
    const aodRaw = weatherData.aerosolOpticalDepth ?? weatherData.aod;
    const aod = Number(aodRaw);
    if (!Number.isFinite(aod)) {
      return { factor: 1.0, level: 'unknown', score: 0, reason: 'missing' };
    }

    const visibility = Number(weatherData.visibility ?? 10);
    const pm25 = Number(weatherData.pm2_5 ?? weatherData.pm25 ?? 0);
    const pm10 = Number(weatherData.pm10 ?? 0);
    const dust = Number(weatherData.dust ?? 0);

    let factor = 1.0;
    let level = 'moderate';
    let score = 0;
    let reason = 'balanced_scattering';

    if (aod < 0.08) {
      factor = 0.98;
      level = 'low';
      score = -2;
      reason = 'too_clean_color_may_be_pale';
    } else if (aod <= 0.35) {
      const boost = 0.03 + Math.min(0.05, (aod - 0.08) / 0.27 * 0.05);
      factor = 1 + boost;
      level = 'optimal';
      score = Math.round(boost * 100);
      reason = 'good_red_orange_scattering';
    } else if (aod <= 0.7) {
      factor = 0.95;
      level = 'high';
      score = -5;
      reason = 'haze_risk';
    } else {
      factor = 0.88;
      level = 'very_high';
      score = -12;
      reason = 'heavy_haze_or_dust';
    }

    const particulateHigh = pm25 > 75 || pm10 > 150 || dust > 100;
    const particulateModerate = pm25 > 35 || pm10 > 80 || dust > 50;
    if (particulateHigh) {
      factor = Math.min(factor, 0.85);
      level = 'polluted';
      score = Math.min(score, -15);
      reason = 'particulate_pollution';
    } else if (particulateModerate) {
      factor = Math.min(factor, 0.94);
      if (level === 'optimal') level = 'moderate_pollution';
      score = Math.min(score, -6);
      reason = 'particulate_haze_risk';
    }

    if (Number.isFinite(visibility) && visibility < 8 && (aod > 0.35 || particulateModerate)) {
      factor = Math.min(factor, 0.85);
      level = 'low_visibility_haze';
      score = Math.min(score, -15);
      reason = 'low_visibility_with_aerosol';
    }

    return {
      factor: Number(factor.toFixed(2)),
      level,
      score,
      reason,
      aerosolOpticalDepth: aod,
      pm2_5: Number.isFinite(pm25) ? pm25 : null,
      pm10: Number.isFinite(pm10) ? pm10 : null,
      dust: Number.isFinite(dust) ? dust : null
    };
  }


  _getQualityLevel(score) {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    return 'poor';
  }

  /**
   * 统一评分算法（与前端 SunsetPredictionService._calculateUnifiedScore 保持一致）
   *
   * @param {Object} weatherData
   * @returns {{ score: number, quality: string, breakdown: Object }}
   */
  _calculateUnifiedScore(weatherData) {
    const highClouds = this._toNumber(weatherData.highClouds ?? 0, 0);
    const midClouds = this._toNumber(weatherData.midClouds ?? 0, 0);
    const lowClouds = this._toNumber(weatherData.lowClouds ?? weatherData.lowCloudCover ?? 0, 0);
    const visibility = this._toNumber(weatherData.visibility ?? 10, 10);
    const humidity = this._toNumber(weatherData.humidity ?? 50, 50);
    const precipitation = this._toNumber(weatherData.precipitation ?? 0, 0);

    // ① 云层结构（60分）
    const highCloudsScore = 25 * this._gaussian(highClouds, 50, 20);
    const midCloudsScore = 25 * this._gaussian(midClouds, 35, 15);
    const lowCloudBonus = 10 * Math.max(0, 1 - lowClouds / 20);
    const cloudStructureScore = highCloudsScore + midCloudsScore + lowCloudBonus;

    // ② 大气透明度（25分）
    const visibilityScore = 15 * (1 - Math.exp(-visibility / 15));
    const humidityScore = 10 * this._gaussian(humidity, 55, 20);
    const transparencyScore = visibilityScore + humidityScore;

    // ③ 云层立体感（15分）
    const layerCount =
      (highClouds > 10 ? 1 : 0) +
      (midClouds > 10 ? 1 : 0) +
      (lowClouds > 10 ? 1 : 0);

    let layerDiversityScore;
    if (layerCount >= 3) {
      layerDiversityScore = 15;
    } else if (layerCount === 2) {
      layerDiversityScore = 8;
    } else {
      layerDiversityScore = 0;
    }

    const baseScore = cloudStructureScore + transparencyScore + layerDiversityScore;

    // 低云惩罚
    let lowCloudPenalty;
    if (lowClouds < 20) {
      lowCloudPenalty = 1.0;
    } else if (lowClouds < 40) {
      lowCloudPenalty = 1.0 - 0.2 * (lowClouds - 20) / 20;
    } else if (lowClouds < 70) {
      lowCloudPenalty = 0.8 - 0.3 * (lowClouds - 40) / 30;
    } else {
      lowCloudPenalty = 0.2;
    }

    // 降水惩罚
    let precipPenalty;
    if (precipitation < 0.1) {
      precipPenalty = 1.0;
    } else if (precipitation < 0.5) {
      precipPenalty = 0.85;
    } else if (precipitation < 2.0) {
      precipPenalty = 0.5;
    } else {
      precipPenalty = 0.15;
    }

    const aerosolScattering = this._scoreAerosolScattering(weatherData);
    const finalScore = this._clamp(baseScore * lowCloudPenalty * precipPenalty * aerosolScattering.factor, 0, 100);
    const quality = this._getQualityLevel(finalScore);

    const breakdown = {
      cloudStructure: {
        score: cloudStructureScore,
        max: 60,
        highCloudsScore,
        midCloudsScore,
        lowCloudBonus
      },
      transparency: {
        score: transparencyScore,
        max: 25,
        visibilityScore,
        humidityScore
      },
      layerDiversity: {
        score: layerDiversityScore,
        max: 15,
        layerCount
      },
      baseScore,
      lowCloudPenalty,
      precipPenalty,
      aerosolScattering,
      finalScore
    };

    return {
      score: finalScore,
      quality,
      breakdown
    };
  }

  /**
   * 计算火烧云预测
   *
   * 整合各气象因素评分，计算总分，并确定质量等级
   *
   * @param {Object} weatherData - 天气数据对象
   * @param {Date|string} date - 预测日期
   * @param {number} lat - 纬度（-90到90）
   * @param {number} lon - 经度（-180到180）
   * @param {string} type - 预测类型：'sunrise' 或 'sunset'
   * @returns {Object} 预测结果对象（对齐前端 SunsetPrediction 模型）
   *
   * 需求：22.1, 22.2, 22.3 - 核心预测算法后端化
   */
  calculatePrediction(weatherData, date, lat, lon, type = 'sunset') {
    // ========== 参数验证 ==========

    if (!weatherData || typeof weatherData !== 'object') {
      throw new Error('无效的天气数据对象');
    }

    // 将日期字符串转换为 Date 对象
    if (typeof date === 'string') {
      date = new Date(date);
    }

    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      throw new Error('无效的日期对象');
    }

    if (typeof lat !== 'number' || lat < -90 || lat > 90) {
      throw new Error('纬度必须在-90到90之间');
    }

    if (typeof lon !== 'number' || lon < -180 || lon > 180) {
      throw new Error('经度必须在-180到180之间');
    }

    if (!['sunrise', 'sunset'].includes(type)) {
      throw new Error('预测类型必须是 sunrise 或 sunset');
    }

    // ========== 计算日出/日落时间 ==========

    const timezoneOptions = { timezone: weatherData.timezone || weatherData.timeZone || null };
    const sunsetTime = SunCalculator.getSunsetTime(date, lat, lon, timezoneOptions);
    const sunriseTime = SunCalculator.getSunriseTime(date, lat, lon, timezoneOptions);

    // ========== 统一评分 ==========

    const unifiedResult = this._calculateUnifiedScore(weatherData);
    const lowCloudValue = this._toNumber(weatherData.lowClouds ?? weatherData.lowCloudCover ?? weatherData.cloudCover ?? 0, 0);

    // 构建因素详情对象（兼容前端结构）
    const factors = {
      cloudCover: {
        value: this._toNumber(weatherData.cloudCover ?? 0, 0),
        score: unifiedResult.breakdown.cloudStructure.score
      },
      humidity: {
        value: this._toNumber(weatherData.humidity ?? 0, 0),
        score: unifiedResult.breakdown.transparency.humidityScore
      },
      visibility: {
        value: this._toNumber(weatherData.visibility ?? 0, 0),
        score: unifiedResult.breakdown.transparency.visibilityScore
      },
      lowClouds: {
        value: lowCloudValue,
        score: unifiedResult.breakdown.cloudStructure.lowCloudBonus
      }
    };

    // ========== 计算黄金时段和蓝调时段 ==========

    const referenceTime = type === 'sunrise' ? sunriseTime : sunsetTime;
    const goldenHour = SunCalculator.getGoldenHour(referenceTime, type);
    const blueHour = SunCalculator.getBlueHour(referenceTime, type);

    // ========== 计算太阳方位角（与评分无关）==========

    const sunAzimuth = SunCalculator.getSunAzimuth(date, referenceTime, lat, lon);

    // ========== 分析云层分层 ==========

    const cloudLayers = SunCalculator.analyzeCloudLayers(
      this._toNumber(weatherData.highClouds ?? 0, 0),
      this._toNumber(weatherData.midClouds ?? 0, 0),
      this._toNumber(weatherData.lowClouds ?? weatherData.lowCloudCover ?? 0, 0)
    );

    // ========== 构建预测结果（对齐前端 SunsetPrediction 模型）==========

    return {
      date: date,
      score: unifiedResult.score,
      quality: unifiedResult.quality,
      factors: factors,
      breakdown: unifiedResult.breakdown,
      sunsetTime: sunsetTime,
      sunriseTime: sunriseTime,
      timezone: timezoneOptions.timezone,
      type: type,
      goldenHour: goldenHour,
      blueHour: blueHour,
      sunAzimuth: sunAzimuth,
      cloudLayers: cloudLayers
    };
  }

  /**
   * 计算预测评分（不包含时间计算）
   *
   * 仅计算各因素得分、总分和质量等级
   *
   * @param {Object} weatherData - 天气数据对象
   * @returns {Object} {factors, score, quality, breakdown}
   */
  calculateScore(weatherData) {
    if (!weatherData || typeof weatherData !== 'object') {
      throw new Error('无效的天气数据对象');
    }

    const unifiedResult = this._calculateUnifiedScore(weatherData);
    const lowCloudValue = this._toNumber(weatherData.lowClouds ?? weatherData.lowCloudCover ?? weatherData.cloudCover ?? 0, 0);

    const factors = {
      cloudCover: {
        value: this._toNumber(weatherData.cloudCover ?? 0, 0),
        score: unifiedResult.breakdown.cloudStructure.score
      },
      humidity: {
        value: this._toNumber(weatherData.humidity ?? 0, 0),
        score: unifiedResult.breakdown.transparency.humidityScore
      },
      visibility: {
        value: this._toNumber(weatherData.visibility ?? 0, 0),
        score: unifiedResult.breakdown.transparency.visibilityScore
      },
      lowClouds: {
        value: lowCloudValue,
        score: unifiedResult.breakdown.cloudStructure.lowCloudBonus
      }
    };

    return {
      factors,
      score: unifiedResult.score,
      quality: unifiedResult.quality,
      breakdown: unifiedResult.breakdown
    };
  }

  /**
   * 获取质量等级
   *
   * @param {number} score - 评分（0-100）
   * @returns {string} 质量等级
   */
  getQuality(score) {
    return this._getQualityLevel(this._toNumber(score, 0));
  }
}

// ========== 导出 ==========

module.exports = PredictionService;
