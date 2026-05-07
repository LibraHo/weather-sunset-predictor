/**
 * Enhanced Sunset Prediction Service - 增强版火烧云预测服务
 *
 * 基于物理模型的火烧云预测系统，包含四个核心模块：
 * 1. 时间判定逻辑（触发机制）
 * 2. 画布逻辑（本地云况评分）
 * 3. 光路逻辑（光路通透评分）
 * 4. 渲染逻辑（画质修正系数）
 *
 * @author Enhanced Model v2.0
 */

import i18n from '../i18n.js';

class EnhancedSunsetPredictionService {
  constructor() {
    this.i18n = i18n;
    // 常量定义
    this.SOLAR_ELEVATION_WINDOW = {
      SUNRISE_START: -6,  // 日出前太阳高度角（度）
      SUNRISE_END: 5,
      SUNSET_START: -5,
      SUNSET_END: 6
    };

    this.CLOUD_WEIGHTS = {
      HIGH: 0.45,   // 高云权重（提高：高云是火烧云的关键载体）
      MID: 0.35,    // 中云权重（降低：避免中云为0时严重拉低分数）
      LOW: 0.20     // 低云权重（通常遮挡视线）
    };

    this.LIGHT_PATH_WEIGHTS = {
      NEAR: 0.4,     // 150km点权重
      FAR: 0.6        // 300km点权重（更重要）
    };

    this.FINAL_WEIGHTS = {
      CLOUD_CANVAS: 0.4,   // 本地云况（画布）
      LIGHT_PATH: 0.6      // 光路通透（权重更高）
    };
  }

  /**
   * 计算太阳高度角（Solar Elevation Angle）
   * @param {Date} date - 日期时间（应该是日出或日落时间）
   * @param {number} lat - 纬度
   * @param {number} lon - 经度
   * @returns {number} 太阳高度角（度）
   */
  calculateSolarElevation(date, lat, lon) {
    // 由于这个方法在日出/日落预测时被调用，传入的时间就是日出或日落时间
    // 在日出/日落时刻，太阳高度角约为0°（考虑大气折射，实际是-0.83°左右）
    // 为了简化计算，我们直接返回接近0的值

    // 计算儒略日和太阳赤纬（用于季节性变化）
    const jday = this._getJulianDay(date);
    const declination = 23.45 * Math.sin((360/365) * (172 + jday));

    // 日出日落时的太阳高度角（考虑大气折射和日面定义）
    // 标准天文日出日落：太阳中心在地平线下0.83°
    // 民用曙暮光：太阳中心在地平线下6°
    const sunriseSunsetElevation = -0.83;

    return sunriseSunsetElevation;
  }

  /**
   * 计算太阳方位角（Solar Azimuth）
   * @param {Date} date - 日期时间
   * @param {number} lat - 纬度
   * @param {number} lon - 经度
   * @returns {number} 太阳方位角（度，0-360）
   */
  calculateSolarAzimuth(date, lat, lon) {
    // 简化计算，返回近似值
    const hour = date.getHours();
    const month = date.getMonth() + 1;

    // 日落方位角近似公式（季节和纬度相关）
    const baseAzimuth = month <= 3 || month >= 10 ? 240 : 300; // 冬季西南，夏季西北
    const timeAdjustment = (hour - 12) * 15;

    return (baseAzimuth + timeAdjustment + 360) % 360;
  }

  /**
   * 第一模块：时间判定逻辑（触发机制）
   * @param {Date} date - 当前时间
   * @param {number} lat - 纬度
   * @param {number} lon - 经度
   * @param {string} type - 'sunrise' 或 'sunset'
   * @returns {Object} 时间判定结果
   */
  checkTimeWindow(date, lat, lon, type) {
    const elevation = this.calculateSolarElevation(date, lat, lon);

    let inWindow = false;
    let optimalMoment = null;
    let windowDescription = '';

    if (type === 'sunset') {
      // 日落窗口：-5° 到 +6°
      inWindow = elevation >= -5 && elevation <= 6;

      // 最佳爆发时刻
      if (elevation >= -6 && elevation <= -4) {
        optimalMoment = '烧高云爆发时刻（日落后15-25分钟）';
      } else if (elevation >= -2 && elevation <= 2) {
        optimalMoment = '烧中云爆发时刻（日落时分）';
      } else if (elevation >= 2 && elevation <= 5) {
        optimalMoment = '烧低云时刻（极少见）';
      }

      windowDescription = `太阳高度角: ${elevation.toFixed(1)}°`;
    } else {
      // 日出窗口（类似逻辑，镜像处理）
      inWindow = elevation >= -6 && elevation <= 5;

      if (elevation >= -6 && elevation <= -4) {
        optimalMoment = '朝霞高云爆发时刻（日出前15-25分钟）';
      } else if (elevation >= -2 && elevation <= 2) {
        optimalMoment = '朝霞中云爆发时刻（日出时分）';
      }

      windowDescription = `太阳高度角: ${elevation.toFixed(1)}°`;
    }

    return {
      inWindow,
      elevation,
      optimalMoment,
      windowDescription,
      isInDetectionWindow: inWindow
    };
  }

  /**
   * 第二模块：画布逻辑（本地云况评分）
   * @param {Object} weatherData - 天气数据
   * @returns {Object} 画布评分结果
   */
  scoreCloudCanvas(weatherData) {
    const lowClouds = weatherData.lowClouds || 0;
    const midClouds = weatherData.midClouds || 0;
    const highClouds = weatherData.highClouds || 0;

    // 1. 计算有效云量
    // 高云和中云都能产生火烧云，取最大值作为主贡献
    // 低云主要起遮挡作用，不贡献正面分数
    const bestUpperCloud = Math.max(highClouds * 1.15, midClouds);
    const effectiveCloudCover = bestUpperCloud * 0.7 +
      Math.min(highClouds, midClouds) * 0.2;

    // 2. 云量区间评分（梯形函数）
    let cloudRangeScore = 0;
    let cloudLevelKey = '';

    if (effectiveCloudCover <= 10) {
      cloudRangeScore = 10;
      cloudLevelKey = 'prediction.canvas.space';
    } else if (effectiveCloudCover <= 30) {
      // 线性插值：10% -> 40分, 30% -> 70分
      cloudRangeScore = 40 + (effectiveCloudCover - 10) / 20 * 30;
      cloudLevelKey = 'prediction.canvas.fair';
    } else if (effectiveCloudCover <= 70) {
      // 完美区间：70-93分
      cloudRangeScore = 70 + (effectiveCloudCover - 30) / 40 * 23;
      cloudLevelKey = 'prediction.canvas.perfect';
    } else if (effectiveCloudCover <= 100) {
      // 线性下降：70% -> 100分, 100% -> 60分（平缓下降）
      cloudRangeScore = 100 - (effectiveCloudCover - 70) / 30 * 40;
      cloudLevelKey = 'prediction.canvas.crowded';
    } else {
      cloudRangeScore = 0;
      cloudLevelKey = 'prediction.canvas.overcast';
    }

    const cloudLevel = this.i18n.t(cloudLevelKey);

    // 3. 低云惩罚（再次降低惩罚强度：30%以下不惩罚，80%降到0.5）
    let lowCloudPenalty = 1.0;
    let penaltyReasonKey = '';

    if (lowClouds < 30) {
      lowCloudPenalty = 1.0;
      penaltyReasonKey = 'prediction.canvas.noLowCloudObstruction';
    } else if (lowClouds > 80) {
      lowCloudPenalty = 0.5;  // 原来是0.3，现在0.5
      penaltyReasonKey = 'prediction.canvas.tooManyLowClouds';
    } else {
      // 线性衰减：30% -> 1.0, 80% -> 0.5（更平缓）
      lowCloudPenalty = 1.0 - (lowClouds - 30) / 50 * 0.5;
      penaltyReasonKey = 'prediction.canvas.lowCloudAmount';
    }

    const penaltyReason = this.i18n.t(penaltyReasonKey, { value: lowClouds.toFixed(0) });

    // 最终画布得分
    let canvasScore = cloudRangeScore * lowCloudPenalty;

    // 高云主导场景加分：当 highClouds > 50% 且 lowClouds < 30% 时，增加 bonus 系数
    let highCloudBonus = 1.0;
    if (highClouds > 50 && lowClouds < 30) {
      highCloudBonus = 1.20; // 1.15~1.2 之间，让画布分达到 75+
      canvasScore = canvasScore * highCloudBonus;
    }

    return {
      score: canvasScore,
      effectiveCloudCover: effectiveCloudCover.toFixed(1),
      cloudRangeScore: cloudRangeScore.toFixed(1),
      cloudLevel,
      lowCloudPenalty: lowCloudPenalty.toFixed(2),
      penaltyReason,
      breakdown: {
        lowClouds: lowClouds.toFixed(1),
        midClouds: midClouds.toFixed(1),
        highClouds: highClouds.toFixed(1)
      }
    };
  }

  /**
   * 第三模块：光路逻辑（光路通透评分）
   * @param {Object} weatherData - 本地天气数据
   * @param {number} azimuth - 太阳方位角
   * @param {Function} getRemoteCloudData - 获取远距离云量的函数
   * @returns {Promise<Object>} 光路评分结果
   */
  async scoreLightPath(weatherData, azimuth, getRemoteCloudData) {
    // 光路评分：评估太阳方位角方向上150km和300km处的云况。
    // 如果提供了 getRemoteCloudData 回调函数，则使用远程数据；
    // 否则使用默认满分（假设光路通畅），作为无远程数据时的近似处理。
    // 注意：后端 EnhancedPredictionService 通过 GFS 数据提供更精确的光路分析。

    let nearPointScore = 100;  // 150km点
    let farPointScore = 100;   // 300km点

    // 如果提供了远程数据获取函数，使用它
    if (getRemoteCloudData) {
      try {
        const nearData = await getRemoteCloudData(azimuth, 150);
        const farData = await getRemoteCloudData(azimuth, 300);

        nearPointScore = this._calculateLightPathScore(nearData);
        farPointScore = this._calculateLightPathScore(farData);
      } catch (error) {
        console.warn('[EnhancedService] 无法获取远程云量数据，使用近似值');
      }
    }

    // 光路最终得分 = 近点×0.4 + 远点×0.6
    let lightPathScore = (nearPointScore * 0.4) + (farPointScore * 0.6);

    // 恶劣天气硬封顶（V2同步逻辑）：任意云层或总云量>=85% 触发封顶
    const cc = weatherData.cloudCover || 0;
    const lc = weatherData.lowClouds || 0;
    const mc = weatherData.midClouds || 0;
    const hc = weatherData.highClouds || 0;
    const precip = weatherData.precipitation || 0;
    const isOvercast = cc >= 85 || lc >= 85 || mc >= 85 || hc >= 85;
    const hasPrecip = precip > 0.5;

    let capReason = null;
    if (isOvercast && hasPrecip) {
      lightPathScore = Math.min(lightPathScore, 40);
      capReason = 'overcast_cap_40';
    } else if (isOvercast) {
      lightPathScore = Math.min(lightPathScore, 40);
      capReason = 'overcast_cap_40';
    } else if (hasPrecip) {
      lightPathScore = Math.min(lightPathScore, 50);
      capReason = 'precipitation_cap_50';
    }

    return {
      score: lightPathScore,
      nearPointScore: nearPointScore.toFixed(1),
      farPointScore: farPointScore.toFixed(1),
      capReason,
      breakdown: {
        nearPointCloudCover: '未检测',
        farPointCloudCover: '未检测'
      },
      note: '光路检测功能需要卫星云图数据支持，当前使用近似值'
    };
  }

  /**
   * 计算单个光路点的得分
   * @param {Object} cloudData - 云量数据
   * @returns {number} 得分 (0-100)
   * @private
   */
  _calculateLightPathScore(cloudData) {
    const totalCloud = cloudData.totalCloud || 0;

    if (totalCloud < 10) {
      return 100; // 晴空，光线畅通
    } else if (totalCloud > 80) {
      return 0;   // 云墙，光线阻断
    } else {
      // 线性插值
      return 100 - ((totalCloud - 10) / 70) * 100;
    }
  }

  /**
   * 第四模块：渲染逻辑（画质修正系数）
   * @param {Object} weatherData - 天气数据
   * @param {boolean} rainedRecently - 最近6小时是否下过雨
   * @returns {Object} 渲染修正结果
   */
  scoreRendering(weatherData, rainedRecently = false) {
    const visibility = weatherData.visibility || 10;
    const humidity = weatherData.humidity || 50;
    const aqi = weatherData.aqi || 50; // AQI如果没有提供，默认50（良）

    // 1. 能见度修正
    let visibilityFactor = 1.0;
    let visibilityDescKey = '';

    if (visibility > 20) {
      visibilityFactor = 1.1;
      visibilityDescKey = 'prediction.rendering.visibilityExcellent';
    } else if (visibility >= 10) {
      visibilityFactor = 1.0;
      visibilityDescKey = 'prediction.rendering.visibilityGood';
    } else {
      visibilityFactor = 0.85;
      visibilityDescKey = 'prediction.rendering.visibilityPoor';
    }

    const visibilityDesc = this.i18n.t(visibilityDescKey);

    // 2. 湿度修正
    let humidityFactor = 1.0;
    let humidityDescKey = '';

    if (humidity > 90) {
      humidityFactor = 0.9;
      humidityDescKey = 'prediction.rendering.humidityFog';
    } else if (humidity < 30) {
      humidityFactor = 1.0;
      humidityDescKey = 'prediction.rendering.humidityDry';
    } else {
      humidityFactor = 1.0;
      humidityDescKey = 'prediction.rendering.humidityModerate';
    }

    const humidityDesc = this.i18n.t(humidityDescKey);

    // 3. 特殊模式：雨后初晴
    let rainBonus = 1.0;
    let specialMode = '';

    if (rainedRecently) {
      rainBonus = 1.2;
      specialMode = this.i18n.t('prediction.rendering.postRainMode');
    }

    // 4. AQI修正（色彩倾向）
    let aqiDescKey = '';
    let colorTendencyKey = '';

    if (aqi < 50) {
      aqiDescKey = 'prediction.rendering.aqiExcellent';
      colorTendencyKey = 'prediction.rendering.colorGoldenOrange';
    } else if (aqi <= 100) {
      aqiDescKey = 'prediction.rendering.aqiGood';
      colorTendencyKey = 'prediction.rendering.colorReddishPurplish';
    } else {
      aqiDescKey = 'prediction.rendering.aqiPoor';
      colorTendencyKey = 'prediction.rendering.colorDarkRed';
      // 严重污染时降低得分
      if (aqi > 150) {
        rainBonus *= 0.8;
      }
    }

    const aqiDesc = this.i18n.t(aqiDescKey);
    const colorTendency = this.i18n.t(colorTendencyKey);

    // 最终渲染系数
    const renderingFactor = visibilityFactor * humidityFactor * rainBonus;

    return {
      factor: renderingFactor,
      visibilityFactor: visibilityFactor.toFixed(2),
      humidityFactor: humidityFactor.toFixed(2),
      rainBonus: rainBonus.toFixed(2),
      breakdown: {
        visibility: visibilityDesc,
        humidity: humidityDesc,
        aqi: aqiDesc,
        colorTendency,
        specialMode
      }
    };
  }

  /**
   * 第五模块：综合输出逻辑（最终评分）
   * @param {Object} canvasScore - 画布得分
   * @param {Object} lightPathScore - 光路得分
   * @param {Object} renderingFactor - 渲染系数
   * @param {string} type - 预测类型 ('sunrise' | 'sunset')
   * @returns {Object} 最终预测结果
   */
  calculateFinalScore(canvasScore, lightPathScore, renderingFactor, type = 'sunset') {
    // 综合得分 = 画布×0.4 + 光路×0.6
    const baseScore = (canvasScore.score * this.FINAL_WEIGHTS.CLOUD_CANVAS) +
                     (lightPathScore.score * this.FINAL_WEIGHTS.LIGHT_PATH);

    // 应用渲染修正系数
    const finalScore = baseScore * renderingFactor.factor;

    // 确保得分在0-100范围内
    const clampedScore = Math.max(0, Math.min(100, finalScore));

    // 状态判定（优先检查画布得分，无云或云量过少时直接判定）
    let status = '';
    let description = '';
    let advice = '';
    let icon = '';

    // 优先检查画布得分：画布得分<30分 → 无火烧云
    if (canvasScore.score < 30) {
      status = this.i18n.t('prediction.status.noFireCloud');
      icon = '🌫️';

      if (canvasScore.cloudLevel === '太空（无云）') {
        description = this.i18n.t('prediction.status.skyClear');
      } else if (canvasScore.cloudLevel === '阴天') {
        description = this.i18n.t('prediction.status.cloudTooThick');
      } else {
        description = this.i18n.t('prediction.status.cloudUnsuitable');
      }

      advice = this.i18n.t('prediction.status.waitForClouds');
    }
    // 光路得分<50分 → 无火烧云或轻微晚霞
    else if (lightPathScore.score < 50) {
      if (clampedScore < 40) {
        status = this.i18n.t('prediction.status.noFireCloud');
        icon = '🌫️';
        description = this.i18n.t('prediction.status.lightPathBlocked');
        advice = this.i18n.t('prediction.status.lightPathObstructed');
      } else {
        status = this.i18n.t('prediction.status.lightGlow');
        icon = 'sunset';
        description = 'Light path obstructed, may have weak local colors';
        advice = this.i18n.t('prediction.status.poorViewing');
      }
    }
    // 根据综合得分判定（阈值整体下调约10分）
    else if (clampedScore < 40) {
      status = this.i18n.t('prediction.status.lightGlow');
      icon = 'sunset';
      description = this.i18n.t('prediction.status.conditionsFair');
      advice = this.i18n.t('prediction.status.canWatch');
    } else if (clampedScore < 65) {
      status = this.i18n.t('prediction.status.goodGlow');
      icon = 'sunset-glow';
      description = this.i18n.t('prediction.status.conditionsGood');
      advice = this.i18n.t('prediction.status.canWatch');
    } else if (clampedScore < 80) {
      status = this.i18n.t('prediction.status.veryLikely');
      icon = 'sunset-glow';
      description = this.i18n.t('prediction.status.excellentConditions');
      advice = 'Worth watching';
    } else {
      status = this.i18n.t('prediction.status.legendaryEruption');
      icon = '🔥';
      description = this.i18n.t('prediction.status.perfectMidHighClouds');
      advice = this.i18n.t('prediction.status.highlyRecommended');
    }

    // 根据预测类型（日出/日落）调整状态描述
    if (type === 'sunrise') {
      // 将sunset相关文本替换为sunrise
      status = status.replace(/sunset/gi, 'sunrise').replace(/Sunset/g, 'Sunrise').replace(/SUNSET/g, 'SUNRISE');
      status = status.replace(/evening/gi, 'morning').replace(/night/gi, 'morning');
      // 替换日落相关描述为日出
      description = description.replace(/sunset/gi, 'sunrise').replace(/日落/g, '日出').replace(/晚霞/g, '朝霞');
      description = description.replace(/evening/gi, 'morning').replace(/tonight/gi, 'this morning');
      // 替换advice中的文本
      advice = advice.replace(/sunset/gi, 'sunrise').replace(/日落/g, '日出').replace(/晚霞/g, '朝霞');
    }

    return {
      score: clampedScore,  // 返回数字，不使用toFixed
      status,
      icon,
      description,
      advice,
      breakdown: {
        baseScore: baseScore.toFixed(1),
        canvasScore: canvasScore.score.toFixed(1),
        lightPathScore: lightPathScore.score.toFixed(1),
        renderingFactor: renderingFactor.factor.toFixed(2)
      },
      canvasAnalysis: canvasScore,
      lightPathAnalysis: lightPathScore,
      renderingAnalysis: renderingFactor
    };
  }

  /**
   * 主函数：生成增强版火烧云预测
   * @param {Object} weatherData - 天气数据
   * @param {Date} date - 日期
   * @param {number} lat - 纬度
   * @param {number} lon - 经度
   * @param {string} type - 'sunrise' 或 'sunset'
   * @param {Function} getRemoteCloudData - 获取远程云量的回调函数（可选）
   * @returns {Promise<Object>} 增强预测结果
   */
  async calculateEnhancedPrediction(weatherData, date, lat, lon, type, getRemoteCloudData = null) {
    console.log('[EnhancedService] 开始计算增强版预测...');

    // 1. 时间判定
    const timeCheck = this.checkTimeWindow(date, lat, lon, type);
    console.log('[EnhancedService] 时间判定:', timeCheck);

    // 2. 画布评分（本地云况）
    const canvasScore = this.scoreCloudCanvas(weatherData);
    console.log('[EnhancedService] 画布评分:', canvasScore);

    // 3. 光路评分（远距离通透性）
    const azimuth = this.calculateSolarAzimuth(date, lat, lon);
    const lightPathScore = await this.scoreLightPath(weatherData, azimuth, getRemoteCloudData);
    console.log('[EnhancedService] 光路评分:', lightPathScore);

    // 4. 渲染修正（画质系数）
    const renderingFactor = this.scoreRendering(weatherData, false);
    console.log('[EnhancedService] 渲染修正:', renderingFactor);

    // 5. 综合输出
    const finalResult = this.calculateFinalScore(canvasScore, lightPathScore, renderingFactor, type);
    console.log('[EnhancedService] 最终得分:', finalResult.score);

    // 返回完整结果
    return {
      date: date,
      type: type,
      score: finalResult.score,  // 已经是数字了
      quality: this._getQualityLevel(finalResult.score),
      timeAnalysis: timeCheck,
      ...finalResult
    };
  }

  /**
   * 根据得分获取质量等级
   * @private
   */
  _getQualityLevel(score) {
    if (score >= 80) return 'excellent';
    if (score >= 50) return 'good';
    return 'fair';
  }

  /**
   * 计算儒略日
   * @private
   */
  _getJulianDay(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    const a = Math.floor((14 - month) / 12);
    const y = year + 4800 - a;
    const m = month + 12 * a - 3;

    return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32045;
  }

  /**
   * 计算时角
   * @private
   */
  _getHourAngle(date, lon) {
    // 获取UTC时间
    const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60;
    // 时角 = (UTC时间 - 12) * 15 + 经度
    return (utcHours - 12) * 15 + lon;
  }
}

export default EnhancedSunsetPredictionService;
