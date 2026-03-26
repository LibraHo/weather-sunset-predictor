/**
 * SunsetPredictionService - 晚霞预测算法服务
 * 
 * 分析气象数据，计算火烧云（晚霞）出现的可能性和质量
 * 
 * 需求：5.1, 5.2, 5.3, 5.4 - 火烧云预测算法
 * 需求：6.4 - 最佳观赏时间计算
 */

import SunsetPrediction from '../models/SunsetPrediction.js';
import UnifiedSunsetScoringService from './UnifiedSunsetScoringService.js';

class SunsetPredictionService {
  constructor() {
    /**
     * 各气象因素的权重配置（保留兼容旧逻辑，实际评分已迁移至 UnifiedSunsetScoringService）
     *
     * 需求：5.1, 5.2, 5.3, 5.4 - 分析多个气象参数
     */
    this.weights = {
      cloudCover: 0.35,    // 云量权重（最重要）
      humidity: 0.25,      // 湿度权重
      visibility: 0.20,    // 能见度权重
      lowClouds: 0.20      // 低层云权重
    };

    // 统一评分服务
    this.unifiedScoring = new UnifiedSunsetScoringService();
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
  getSunsetTime(date, lat, lon) {
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

    // 计算本地子午线（每个时区15度）
    const timezone = Math.round(lon / 15);
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

    // 创建本地时间（天文学计算已经考虑了经度和时区偏移）
    const sunsetDate = new Date(date);
    sunsetDate.setDate(sunsetDate.getDate() + dayOffset);
    const sunsetLocal = new Date(sunsetDate.getFullYear(), sunsetDate.getMonth(), sunsetDate.getDate(), hours, minutes, 0, 0);

    return sunsetLocal;
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
  getSunriseTime(date, lat, lon) {
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

    // 计算本地子午线（每个时区15度）
    const timezone = Math.round(lon / 15);
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

    // 创建本地时间（天文学计算已经考虑了经度和时区偏移）
    const sunriseDate = new Date(date);
    sunriseDate.setDate(sunriseDate.getDate() + dayOffset);
    const sunriseLocal = new Date(sunriseDate.getFullYear(), sunriseDate.getMonth(), sunriseDate.getDate(), hours, minutes, 0, 0);

    return sunriseLocal;
  }

  /**
   * 评估云量因素得分
   * 
   * 中高层云量在30-70%范围内最佳，使用正态分布曲线评分
   * 
   * @param {number} cloudCover - 云量百分比（0-100）
   * @returns {number} 评分（0-100）
   * 
   * 需求：5.1 - 分析中高层云量（30-70%为最佳）
   */
  scoreCloudCover(cloudCover) {
    // 验证输入
    if (typeof cloudCover !== 'number' || cloudCover < 0 || cloudCover > 100) {
      return 0;
    }

    // 最佳云量范围的中心点
    const optimal = 50;
    // 标准差，控制曲线的宽度
    const sigma = 20;

    // 使用高斯函数计算得分
    // 在30-70%范围内得分最高，向两边递减
    const score = 100 * Math.exp(-Math.pow(cloudCover - optimal, 2) / (2 * sigma * sigma));

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 评估湿度因素得分
   * 
   * 相对湿度在30-70%范围内最佳，使用正态分布曲线评分
   * 
   * @param {number} humidity - 相对湿度百分比（0-100）
   * @returns {number} 评分（0-100）
   * 
   * 需求：5.2 - 评估相对湿度（30-70%为最佳范围）
   */
  scoreHumidity(humidity) {
    // 验证输入
    if (typeof humidity !== 'number' || humidity < 0 || humidity > 100) {
      return 0;
    }

    // 最佳湿度范围的中心点
    const optimal = 50;
    // 标准差，控制曲线的宽度
    const sigma = 20;

    // 使用高斯函数计算得分
    // 在30-70%范围内得分最高，向两边递减
    const score = 100 * Math.exp(-Math.pow(humidity - optimal, 2) / (2 * sigma * sigma));

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 评估能见度因素得分
   * 
   * 能见度越高越好，使用对数曲线评分
   * 
   * @param {number} visibility - 能见度（公里）
   * @returns {number} 评分（0-100）
   * 
   * 需求：5.3 - 考虑能见度因素（高能见度加分）
   */
  scoreVisibility(visibility) {
    // 验证输入
    if (typeof visibility !== 'number' || visibility < 0) {
      return 0;
    }

    // 能见度为0时得分为0
    if (visibility === 0) {
      return 0;
    }

    // 使用对数曲线，能见度越高得分越高
    // 10km能见度得到约70分，20km得到约85分，30km以上接近100分
    const score = 100 * (1 - Math.exp(-visibility / 15));

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 评估低层云因素得分
   * 
   * 低层云越少越好，使用指数衰减曲线评分
   * 
   * @param {number} lowCloudCover - 低层云量百分比（0-100）
   * @returns {number} 评分（0-100）
   * 
   * 需求：5.4 - 检查低层云量（低层云少为佳）
   */
  scoreLowClouds(lowCloudCover) {
    // 验证输入
    if (typeof lowCloudCover !== 'number' || lowCloudCover < 0 || lowCloudCover > 100) {
      return 0;
    }

    // 低层云越少得分越高，使用指数衰减
    // 0%低层云得100分，50%得约13分，100%得约0分
    const score = 100 * Math.exp(-lowCloudCover / 20);

    return Math.max(0, Math.min(100, score));
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
  calculatePrediction(weatherData, date, lat, lon, type = 'sunset') {
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
    const sunsetTime = this.getSunsetTime(date, lat, lon);
    const sunriseTime = this.getSunriseTime(date, lat, lon);

    // 使用统一评分服务计算 score / quality / breakdown
    const unifiedResult = this.unifiedScoring.calculate({
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

    // 保存各因素得分，用于详细展示（兼容旧字段）
    const factors = {
      cloudCover: {
        value: weatherData.cloudCover || 0,
        score: this.scoreCloudCover(weatherData.cloudCover || 0)
      },
      humidity: {
        value: weatherData.humidity || 0,
        score: this.scoreHumidity(weatherData.humidity || 0)
      },
      visibility: {
        value: weatherData.visibility || 0,
        score: this.scoreVisibility(weatherData.visibility || 0)
      },
      lowClouds: {
        value: weatherData.lowClouds ?? weatherData.lowCloudCover ?? weatherData.cloudCover ?? 0,
        score: this.scoreLowClouds(weatherData.lowClouds ?? weatherData.lowCloudCover ?? weatherData.cloudCover ?? 0)
      }
    };

    // 需求12：计算黄金时段和蓝调时段
    const referenceTime = type === 'sunrise' ? sunriseTime : sunsetTime;
    const goldenHour = this.getGoldenHour(referenceTime, type);
    const blueHour = this.getBlueHour(referenceTime, type);

    // 需求12：计算太阳方位角（与评分无关）
    const sunAzimuth = this.getSunAzimuth(date, referenceTime, lat, lon);

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
  getSunAzimuth(date, time, lat, lon) {
    // 获取年份中的第几天
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000)) + 1;

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
    const hours = time.getHours() + time.getMinutes() / 60 + time.getSeconds() / 3600;
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
