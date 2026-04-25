/**
 * SunsetPredictionService - 晚霞预测算法服务
 * 
 * 分析气象数据，计算火烧云（晚霞）出现的可能性和质量
 * 
 * 需求：5.1, 5.2, 5.3, 5.4 - 火烧云预测算法
 * 需求：6.4 - 最佳观赏时间计算
 */

import SunsetPrediction from '../models/SunsetPrediction.js';

class SunsetPredictionService {
  constructor() {
    /**
     * 各气象因素的权重配置（保留兼容旧逻辑，实际评分已迁移至 _calculateUnifiedScore）
     *
     * 需求：5.1, 5.2, 5.3, 5.4 - 分析多个气象参数
     */
    this.weights = {
      cloudCover: 0.35,    // 云量权重（最重要）
      humidity: 0.25,      // 湿度权重
      visibility: 0.20,    // 能见度权重
      lowClouds: 0.20      // 低层云权重
    };
  }

  /**
   * 计算目标地点时区偏移。优先使用 IANA timezone，缺失时按经度近似。
   * 不能使用浏览器时区，否则用户人在卡塔尔查北京时会显示成卡塔尔时间。
   * @private
   */
  _getTargetTimezoneOffsetHours(date, lon, timeZone = null) {
    if (timeZone && typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
      try {
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        }).formatToParts(date);
        const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
        const asUtc = Date.UTC(
          Number(values.year), Number(values.month) - 1, Number(values.day),
          Number(values.hour), Number(values.minute), Number(values.second)
        );
        return (asUtc - date.getTime()) / 3600000;
      } catch (error) {
        console.warn('[SunsetPredictionService] 无法解析目标时区，回退到经度估算:', timeZone, error.message);
      }
    }
    return Math.round(lon / 15);
  }

  /** @private */
  _createDateFromTargetLocalTime(date, dayOffset, hours, minutes, timezoneOffsetHours) {
    return new Date(Date.UTC(
      date.getFullYear(), date.getMonth(), date.getDate() + dayOffset,
      hours - timezoneOffsetHours, minutes, 0, 0
    ));
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

  /**
   * 计算火烧云综合评分（内联自原 UnifiedSunsetScoringService）
   *
   * @param {Object} weatherData - 天气数据
   * @returns {{ score: number, quality: string, breakdown: Object }}
   */
  _calculateUnifiedScore(weatherData) {
    const highClouds = weatherData.highClouds ?? 0;
    const midClouds = weatherData.midClouds ?? 0;
    const lowClouds = weatherData.lowClouds ?? 0;
    const visibility = weatherData.visibility ?? 10;
    const humidity = weatherData.humidity ?? 50;
    const precipitation = weatherData.precipitation ?? 0;

    // ── 第一步：基础分 ────────────────────────────────────────────────

    // ① 云层结构（60分）
    const highCloudsScore = 25 * Math.exp(-Math.pow(highClouds - 50, 2) / (2 * 20 * 20));
    // 中云评分：有高云配合时更宽容（中云也能反射光线，厚中云+高云=多层色彩）
    let midCloudsScore;
    if (midClouds >= 20 && highClouds >= 40) {
      // 高云充足时，中云只要有就算贡献，不会因太厚而扣到0
      midCloudsScore = 15 * Math.exp(-Math.pow(midClouds - 40, 2) / (2 * 25 * 25));
      // 额外加成：中云越厚在高云配合下色彩越丰富
      midCloudsScore += 10 * Math.min(1, midClouds / 60) * Math.min(1, highClouds / 60);
    } else {
      // 无高云配合时，中云太厚会遮挡，用原始严格曲线
      midCloudsScore = 25 * Math.exp(-Math.pow(midClouds - 35, 2) / (2 * 15 * 15));
    }
    const lowCloudBonus   = 10 * Math.max(0, 1 - lowClouds / 20);
    const cloudStructureScore = highCloudsScore + midCloudsScore + lowCloudBonus;

    // ② 大气透明度（25分）
    const visibilityScore = 15 * (1 - Math.exp(-visibility / 15));
    const humidityScore   = 10 * Math.exp(-Math.pow(humidity - 55, 2) / (2 * 20 * 20));
    const transparencyScore = visibilityScore + humidityScore;

    // ③ 云层立体感（15分）
    const layerCount = (highClouds > 10 ? 1 : 0) + (midClouds > 10 ? 1 : 0) + (lowClouds > 10 ? 1 : 0);
    let layerDiversityScore;
    if (layerCount >= 3) {
      layerDiversityScore = 15;
    } else if (layerCount === 2) {
      layerDiversityScore = 8;
    } else {
      layerDiversityScore = 0;
    }

    const baseScore = cloudStructureScore + transparencyScore + layerDiversityScore;

    // ── 第二步：乘性惩罚 ──────────────────────────────────────────────

    // 低云惩罚
    let lowCloudPenalty;
    if (lowClouds < 20) {
      lowCloudPenalty = 1.0;
    } else if (lowClouds < 40) {
      lowCloudPenalty = 1.0 - 0.2 * (lowClouds - 20) / 20; // 1.0 → 0.8
    } else if (lowClouds < 70) {
      lowCloudPenalty = 0.8 - 0.3 * (lowClouds - 40) / 30; // 0.8 → 0.5
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
    let finalScore = baseScore * lowCloudPenalty * precipPenalty * aerosolScattering.factor;
    finalScore = Math.max(0, Math.min(100, finalScore));

    // ── 第三步：quality 等级 ──────────────────────────────────────────

    let quality;
    if (finalScore >= 80) {
      quality = 'excellent';
    } else if (finalScore >= 60) {
      quality = 'good';
    } else if (finalScore >= 40) {
      quality = 'fair';
    } else {
      quality = 'poor';
    }

    // ── 返回结果 ──────────────────────────────────────────────────────

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

    return { score: finalScore, quality, breakdown };
  }

  /**
   * 计算指定日期和位置的日落时间
   * 
   * 使用简化的天文算法计算日落时间
   * 基于NOAA太阳计算器的算法
   * 
   * @param {Date} date - 日期对象
   * @param {number} lat - 纬度（-90到90）
   * @param {number} lon - 经度（-180到180）
   * @returns {Date} 日落时间
   * 
   * 需求：6.4 - 计算日落时间以确定最佳观赏时间
   */
  getSunsetTime(date, lat, lon, options = {}) {
    // 验证输入
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      throw new Error('无效的日期对象');
    }
    
    if (typeof lat !== 'number' || lat < -90 || lat > 90) {
      throw new Error('纬度必须在-90到90之间');
    }
    
    if (typeof lon !== 'number' || lon < -180 || lon > 180) {
      throw new Error('经度必须在-180到180之间');
    }

    // 获取年份中的第几天（1-366）
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000)) + 1;

    // 计算分数年（fractional year）
    const fractionalYear = (2 * Math.PI / 365) * (dayOfYear - 1);

    // 计算时间方程（equation of time）- 单位：分钟
    const eqTime = 229.18 * (
      0.000075 +
      0.001868 * Math.cos(fractionalYear) -
      0.032077 * Math.sin(fractionalYear) -
      0.014615 * Math.cos(2 * fractionalYear) -
      0.040849 * Math.sin(2 * fractionalYear)
    );

    // 计算太阳赤纬（solar declination）- 单位：弧度
    const declination = 0.006918 -
      0.399912 * Math.cos(fractionalYear) +
      0.070257 * Math.sin(fractionalYear) -
      0.006758 * Math.cos(2 * fractionalYear) +
      0.000907 * Math.sin(2 * fractionalYear) -
      0.002697 * Math.cos(3 * fractionalYear) +
      0.00148 * Math.sin(3 * fractionalYear);

    // 将纬度转换为弧度
    const latRad = lat * Math.PI / 180;

    // 计算时角（hour angle）- 日落时太阳在地平线下0.833度（考虑大气折射）
    const zenith = 90.833 * Math.PI / 180; // 转换为弧度
    const cosHourAngle = (Math.cos(zenith) - Math.sin(latRad) * Math.sin(declination)) /
                         (Math.cos(latRad) * Math.cos(declination));

    // 检查是否有日落（极昼或极夜情况）
    if (cosHourAngle > 1) {
      // 极夜 - 太阳不升起
      // 返回午夜时间
      const midnight = new Date(date);
      midnight.setHours(0, 0, 0, 0);
      return midnight;
    } else if (cosHourAngle < -1) {
      // 极昼 - 太阳不落下
      // 返回午夜时间
      const midnight = new Date(date);
      midnight.setHours(23, 59, 59, 999);
      return midnight;
    }

    // 计算日落时角（单位：度）
    const hourAngle = Math.acos(cosHourAngle) * 180 / Math.PI;

    // 使用目标地点时区，而不是浏览器/用户当前所在时区。
    const timezone = this._getTargetTimezoneOffsetHours(date, lon, options.timezone || options.timeZone || null);
    const localMeridian = timezone * 15;
    const lonOffset = lon - localMeridian;

    // 计算日落时间（本地太阳时，单位：分钟）
    // 720分钟 = 12:00 (正午)
    // 使用相对于本地子午线的经度偏移
    const solarNoon = 720 - 4 * lonOffset - eqTime;
    const sunsetMinutes = solarNoon + 4 * hourAngle;

    // 转换为当天的本地时间
    // 注意：sunsetMinutes 是基于 UTC 计算的本地太阳时，需要加上时区偏移
    // 处理跨日情况（sunsetMinutes可能为负或超过24小时）
    let sunsetMinutesAdjusted = sunsetMinutes;
    let dayOffset = 0;

    if (sunsetMinutesAdjusted < 0) {
      // 负数表示在前一天
      dayOffset = -1;
      sunsetMinutesAdjusted += 24 * 60;
    } else if (sunsetMinutesAdjusted >= 24 * 60) {
      // 超过24小时表示在后一天
      dayOffset = 1;
      sunsetMinutesAdjusted -= 24 * 60;
    }

    const hours = Math.floor(sunsetMinutesAdjusted / 60);
    const minutes = Math.round(sunsetMinutesAdjusted % 60);

    return this._createDateFromTargetLocalTime(date, dayOffset, hours, minutes, timezone);
  }

  /**
   * 计算指定日期和位置的日出时间
   * 
   * 使用简化的天文算法计算日出时间
   * 基于NOAA太阳计算器的算法
   * 
   * @param {Date} date - 日期对象
   * @param {number} lat - 纬度（-90到90）
   * @param {number} lon - 经度（-180到180）
   * @returns {Date} 日出时间
   */
  getSunriseTime(date, lat, lon, options = {}) {
    // 验证输入
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      throw new Error('无效的日期对象');
    }
    
    if (typeof lat !== 'number' || lat < -90 || lat > 90) {
      throw new Error('纬度必须在-90到90之间');
    }
    
    if (typeof lon !== 'number' || lon < -180 || lon > 180) {
      throw new Error('经度必须在-180到180之间');
    }

    // 获取年份中的第几天（1-366）
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000)) + 1;

    // 计算分数年（fractional year）
    const fractionalYear = (2 * Math.PI / 365) * (dayOfYear - 1);

    // 计算时间方程（equation of time）- 单位：分钟
    const eqTime = 229.18 * (
      0.000075 +
      0.001868 * Math.cos(fractionalYear) -
      0.032077 * Math.sin(fractionalYear) -
      0.014615 * Math.cos(2 * fractionalYear) -
      0.040849 * Math.sin(2 * fractionalYear)
    );

    // 计算太阳赤纬（solar declination）- 单位：弧度
    const declination = 0.006918 -
      0.399912 * Math.cos(fractionalYear) +
      0.070257 * Math.sin(fractionalYear) -
      0.006758 * Math.cos(2 * fractionalYear) +
      0.000907 * Math.sin(2 * fractionalYear) -
      0.002697 * Math.cos(3 * fractionalYear) +
      0.00148 * Math.sin(3 * fractionalYear);

    // 将纬度转换为弧度
    const latRad = lat * Math.PI / 180;

    // 计算时角（hour angle）- 日出时太阳在地平线下0.833度（考虑大气折射）
    const zenith = 90.833 * Math.PI / 180; // 转换为弧度
    const cosHourAngle = (Math.cos(zenith) - Math.sin(latRad) * Math.sin(declination)) /
                         (Math.cos(latRad) * Math.cos(declination));

    // 检查是否有日出（极昼或极夜情况）
    if (cosHourAngle > 1) {
      // 极夜 - 太阳不升起
      const midnight = new Date(date);
      midnight.setHours(0, 0, 0, 0);
      return midnight;
    } else if (cosHourAngle < -1) {
      // 极昼 - 太阳不落下
      const midnight = new Date(date);
      midnight.setHours(0, 0, 0, 1);
      return midnight;
    }

    // 计算日出时角（单位：度）- 注意：日出用负的时角
    const hourAngle = Math.acos(cosHourAngle) * 180 / Math.PI;

    // 使用目标地点时区，而不是浏览器/用户当前所在时区。
    const timezone = this._getTargetTimezoneOffsetHours(date, lon, options.timezone || options.timeZone || null);
    const localMeridian = timezone * 15;
    const lonOffset = lon - localMeridian;

    // 计算日出时间（本地太阳时，单位：分钟）
    // 720分钟 = 12:00 (正午)
    // 使用相对于本地子午线的经度偏移
    const solarNoon = 720 - 4 * lonOffset - eqTime;
    const sunriseMinutes = solarNoon - 4 * hourAngle;

    // 转换为当天的本地时间
    // 注意：sunriseMinutes 是基于 UTC 计算的本地太阳时，需要加上时区偏移
    // 处理跨日情况（sunriseMinutes可能为负或超过24小时）
    let sunriseMinutesAdjusted = sunriseMinutes;
    let dayOffset = 0;

    if (sunriseMinutesAdjusted < 0) {
      // 负数表示在前一天
      dayOffset = -1;
      sunriseMinutesAdjusted += 24 * 60;
    } else if (sunriseMinutesAdjusted >= 24 * 60) {
      // 超过24小时表示在后一天
      dayOffset = 1;
      sunriseMinutesAdjusted -= 24 * 60;
    }

    const hours = Math.floor(sunriseMinutesAdjusted / 60);
    const minutes = Math.round(sunriseMinutesAdjusted % 60);

    return this._createDateFromTargetLocalTime(date, dayOffset, hours, minutes, timezone);
  }

  /**
   * 计算综合晚霞预测
   * 
   * 整合各气象因素评分，计算加权总分，并确定质量等级
   * 
   * @param {Object} weatherData - 天气数据对象，包含所有气象参数
   * @param {Date} date - 预测日期
   * @param {number} lat - 纬度
   * @param {number} lon - 经度
   * @param {string} type - 预测类型：'sunrise' 或 'sunset'（需求12.4）
   * @returns {SunsetPrediction} 预测结果对象
   * 
   * 需求：5.5 - 输出0-100的预测质量评分
   * 需求：5.6 - 评分高于70时标记为"优秀"
   * 需求：5.7 - 评分在40-70之间时标记为"良好"
   * 需求：5.8 - 评分低于40时标记为"一般"
   * 需求：12.1, 12.2, 12.3, 12.4, 12.5, 12.11 - 朝霞晚霞预测增强功能
   */
  calculatePrediction(weatherData, date, lat, lon, type = 'sunset', options = {}) {
    // 验证输入
    if (!weatherData || typeof weatherData !== 'object') {
      throw new Error('无效的天气数据对象');
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

    // 计算日落和日出时间
    const timezoneOptions = { timezone: options.timezone || options.timeZone || weatherData.timezone || null };
    const sunsetTime = this.getSunsetTime(date, lat, lon, timezoneOptions);
    const sunriseTime = this.getSunriseTime(date, lat, lon, timezoneOptions);

    // 使用统一评分算法计算 score / quality / breakdown
    const unifiedResult = this._calculateUnifiedScore({
      cloudCover:    weatherData.cloudCover    ?? 0,
      highClouds:    weatherData.highClouds    ?? 0,
      midClouds:     weatherData.midClouds     ?? 0,
      lowClouds:     weatherData.lowClouds     ?? weatherData.lowCloudCover ?? 0,
      visibility:    weatherData.visibility    ?? 10,
      humidity:      weatherData.humidity      ?? 50,
      precipitation: weatherData.precipitation ?? 0
    });

    const finalScore = Math.round(unifiedResult.score);
    const quality    = unifiedResult.quality;

    // 保存各因素得分，用于详细展示（基于 UnifiedSunsetScoringService 结果）
    const bd = unifiedResult.breakdown;
    const factors = {
      cloudCover: {
        value: weatherData.cloudCover || 0,
        score: bd.cloudStructure.score
      },
      humidity: {
        value: weatherData.humidity || 0,
        score: bd.transparency.humidityScore
      },
      visibility: {
        value: weatherData.visibility || 0,
        score: bd.transparency.visibilityScore
      },
      lowClouds: {
        value: weatherData.lowClouds ?? weatherData.lowCloudCover ?? weatherData.cloudCover ?? 0,
        score: bd.cloudStructure.lowCloudBonus
      }
    };

    // 需求12：计算黄金时段和蓝调时段
    const referenceTime = type === 'sunrise' ? sunriseTime : sunsetTime;
    const goldenHour = this.getGoldenHour(referenceTime, type);
    const blueHour = this.getBlueHour(referenceTime, type);

    // 需求12：计算太阳方位角（与评分无关）
    const sunAzimuth = this.getSunAzimuth(date, referenceTime, lat, lon, timezoneOptions);

    // 需求12：分析云层分层
    const cloudLayers = this.analyzeCloudLayers(
      weatherData.highClouds || 0,
      weatherData.midClouds || 0,
      weatherData.lowClouds || 0
    );

    // 创建并返回预测对象
    return new SunsetPrediction(
      date,
      finalScore,
      quality,
      factors,
      sunsetTime,
      sunriseTime,
      type,
      goldenHour,
      blueHour,
      sunAzimuth,
      cloudLayers
    );
  }

  // ========== 需求12：朝霞晚霞预测增强功能方法 ==========

  /**
   * 计算黄金时段（Golden Hour）
   * 
   * @param {Date} referenceTime - 参考时间（日出或日落）
   * @param {string} type - 'sunrise' 或 'sunset'
   * @returns {Object} {start, end} 黄金时段的开始和结束时间
   * 
   * 需求：12.2 - 标注黄金时段（日出后/日落前30-60分钟）
   */
  getGoldenHour(referenceTime, type) {
    if (!referenceTime) return { start: null, end: null };
    if (type === 'sunrise') {
      // 日出后30-60分钟
      const start = new Date(referenceTime.getTime() + 30 * 60 * 1000);
      const end = new Date(referenceTime.getTime() + 60 * 60 * 1000);
      return { start, end };
    } else {
      // 日落前30-60分钟
      const start = new Date(referenceTime.getTime() - 60 * 60 * 1000);
      const end = new Date(referenceTime.getTime() - 30 * 60 * 1000);
      return { start, end };
    }
  }

  /**
   * 计算蓝调时段（Blue Hour）
   * 
   * @param {Date} referenceTime - 参考时间（日出或日落）
   * @param {string} type - 'sunrise' 或 'sunset'
   * @returns {Object} {start, end} 蓝调时段的开始和结束时间
   * 
   * 需求：12.3 - 标注蓝调时段（日出前/日落后20-30分钟）
   */
  getBlueHour(referenceTime, type) {
    if (!referenceTime) return { start: null, end: null };
    if (type === 'sunrise') {
      // 日出前20-30分钟
      const start = new Date(referenceTime.getTime() - 30 * 60 * 1000);
      const end = new Date(referenceTime.getTime() - 20 * 60 * 1000);
      return { start, end };
    } else {
      // 日落后20-30分钟
      const start = new Date(referenceTime.getTime() + 20 * 60 * 1000);
      const end = new Date(referenceTime.getTime() + 30 * 60 * 1000);
      return { start, end };
    }
  }

  /**
   * 计算太阳方位角
   * 
   * @param {Date} date - 日期
   * @param {Date} time - 时间
   * @param {number} lat - 纬度
   * @param {number} lon - 经度
   * @returns {number} 太阳方位角（0-360度，0度为正北）
   * 
   * 需求：12.5 - 显示太阳方位角信息（仅当评分>70时）
   */
  getSunAzimuth(date, time, lat, lon, options = {}) {
    const timezone = options.timezone || options.timeZone || null;
    const timezoneOffset = this._getTargetTimezoneOffsetHours(time, lon, timezone);
    const targetLocalTime = new Date(time.getTime() + timezoneOffset * 60 * 60 * 1000);
    const targetLocalDate = new Date(date.getTime() + timezoneOffset * 60 * 60 * 1000);

    // 获取目标地点当地日期对应的年份第几天
    const startOfYear = new Date(Date.UTC(targetLocalDate.getUTCFullYear(), 0, 1));
    const dayOfYear = Math.floor((targetLocalDate - startOfYear) / (24 * 60 * 60 * 1000)) + 1;

    // 计算分数年
    const fractionalYear = (2 * Math.PI / 365) * (dayOfYear - 1);

    // 计算太阳赤纬
    const declination = 0.006918 -
      0.399912 * Math.cos(fractionalYear) +
      0.070257 * Math.sin(fractionalYear) -
      0.006758 * Math.cos(2 * fractionalYear) +
      0.000907 * Math.sin(2 * fractionalYear) -
      0.002697 * Math.cos(3 * fractionalYear) +
      0.00148 * Math.sin(3 * fractionalYear);

    // 计算时角（基于当地时间）
    const hours = targetLocalTime.getUTCHours() + targetLocalTime.getUTCMinutes() / 60 + targetLocalTime.getUTCSeconds() / 3600;
    const hourAngle = (hours - 12) * 15; // 每小时15度

    // 转换为弧度
    const latRad = lat * Math.PI / 180;
    const hourAngleRad = hourAngle * Math.PI / 180;

    // 计算太阳高度角
    const sinAltitude = Math.sin(latRad) * Math.sin(declination) +
                        Math.cos(latRad) * Math.cos(declination) * Math.cos(hourAngleRad);
    const altitude = Math.asin(sinAltitude);

    // 计算太阳方位角
    const cosAzimuth = (Math.sin(declination) - Math.sin(latRad) * sinAltitude) /
                       (Math.cos(latRad) * Math.cos(altitude));
    
    let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAzimuth))) * 180 / Math.PI;

    // 根据时角调整方位角（上午在东侧，下午在西侧）
    if (hourAngle > 0) {
      azimuth = 360 - azimuth;
    }

    return Math.round(azimuth);
  }

  /**
   * 分析云层分层对朝霞/晚霞的影响
   * 
   * @param {number} highClouds - 高云量（>6km，0-100）
   * @param {number} midClouds - 中云量（2-6km，0-100）
   * @param {number} lowClouds - 低云量（<2km，0-100）
   * @returns {Object} {high, mid, low, description} 云层分层信息和影响描述
   * 
   * 需求：12.11 - 显示云层分层信息
   * 需求：12.13 - 说明各层云对朝霞/晚霞效果的影响
   */
  analyzeCloudLayers(highClouds, midClouds, lowClouds) {
    const layers = {
      high: highClouds,
      mid: midClouds,
      low: lowClouds,
      description: ''
    };

    // 分析云层组合并生成描述
    const totalClouds = highClouds + midClouds + lowClouds;

    if (totalClouds < 20) {
      layers.description = '云量较少，可能缺乏足够的云层来散射光线，晚霞效果一般';
    } else if (lowClouds > 50) {
      layers.description = '低层云过多，可能遮挡日落/日出，不利于观赏';
    } else if (midClouds > 30 && midClouds < 70 && highClouds > 20) {
      layers.description = '中高云适中，有利于火烧云形成，预计晚霞效果较好';
    } else if (highClouds > 60) {
      layers.description = '高云较多，可能产生卷云效果，适合拍摄';
    } else if (midClouds > 70) {
      layers.description = '中层云过多，可能影响光线穿透，晚霞颜色可能较暗';
    } else {
      layers.description = '云层分布一般，晚霞效果取决于其他气象条件';
    }

    return layers;
  }
}

export default SunsetPredictionService;
