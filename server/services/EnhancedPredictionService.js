/**
  const CloudLayerEstimator = require('./CloudLayerEstimator.js');
  const LightPathService = require('./LightPathService.js');
 * Enhanced Prediction Service - 增强版火烧云预测服务 (后端版)
 *
 * 基于物理模型的火烧云预测系统，包含四个核心模块：
 * 1. 时间判定逻辑（触发机制）
 * 2. 画布逻辑（本地云况评分）
 * 3. 光路逻辑（光路通透评分）
 * 4. 渲染逻辑（画质修正系数）
 *
 * 需求：22 (前后端分离 - Phase 3)
 * @author Backend Migration v1.0
 */

const SunCalculator = require('../utils/SunCalculator.js');
const logger = require('../utils/logger.js');
const CloudLayerEstimator = require('./CloudLayerEstimator.js');

// ========== 常量定义 ==========

const SOLAR_ELEVATION_WINDOW = {
  SUNRISE_START: -6,  // 日出前太阳高度角（度）
  SUNRISE_END: 5,
  SUNSET_START: -5,
  SUNSET_END: 6
};

const CLOUD_WEIGHTS = {
  HIGH: 0.3,    // 高云权重
  MID: 0.5,     // 中云权重（最高）
  LOW: 0.2      // 低云权重（通常是干扰项）
};

const LIGHT_PATH_WEIGHTS = {
  NEAR: 0.4,    // 150km点权重
  FAR: 0.6      // 300km点权重（更重要）
};

const FINAL_WEIGHTS = {
  CLOUD_CANVAS: 0.4,   // 本地云况（画布）
  LIGHT_PATH: 0.6      // 光路通透（权重更高）
};

// ========== 辅助函数 ==========

/**
 * 计算儒略日
 * @param {Date} date - 日期
 * @returns {number} 儒略日
 */
function getJulianDay(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;

  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32045;
}

/**
 * 计算太阳高度角（Solar Elevation Angle）
 *
 * 基于 NOAA 算法，使用 UTC 时间 + 经度偏移推算真太阳时，
 * 再由时角和赤纬计算实际太阳高度角。
 *
 * @param {Date} date - 日期时间（UTC）
 * @param {number} lat - 纬度（-90 到 90）
 * @param {number} lon - 经度（-180 到 180）
 * @returns {number} 太阳高度角（度，范围 -90 到 90，正值表示在地平线上方）
 */
function calculateSolarElevation(date, lat, lon) {
  const dayOfYear = SunCalculator.getDayOfYear(date);
  const fractionalYear = SunCalculator.getFractionalYear(dayOfYear);
  const eqTime = SunCalculator.getEquationOfTime(fractionalYear);
  const declination = SunCalculator.getSolarDeclination(fractionalYear);

  // 将当前 UTC 时间转换为真太阳时（分钟）
  // 公式：真太阳时 = UTC分钟数 + 时差修正 + 经度补偿（每度4分钟）
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const apparentSolarMinutes = utcMinutes + eqTime + 4 * lon;

  // 时角（度）：真太阳正午为0°，每小时15°，上午为负
  const hourAngleDeg = (apparentSolarMinutes - 720) / 4;
  const hourAngleRad = hourAngleDeg * Math.PI / 180;

  const latRad = lat * Math.PI / 180;

  // 太阳高度角：sin(elev) = sin(lat)*sin(decl) + cos(lat)*cos(decl)*cos(HRA)
  const sinElevation = Math.sin(latRad) * Math.sin(declination) +
                       Math.cos(latRad) * Math.cos(declination) * Math.cos(hourAngleRad);

  const elevationRad = Math.asin(Math.max(-1, Math.min(1, sinElevation)));
  return parseFloat((elevationRad * 180 / Math.PI).toFixed(2));
}

/**
 * 计算太阳方位角（Solar Azimuth）
 * @param {Date} date - 日期时间
 * @param {number} lat - 纬度
 * @param {number} lon - 经度
 * @returns {number} 太阳方位角（度，0-360）
 */
function calculateSolarAzimuth(date, lat, lon) {
  // 使用 SunCalculator 的精确算法
  // getSunAzimuth 需要 (date, time, lat, lon) 四个参数
  return SunCalculator.getSunAzimuth(date, date, lat, lon);
}

// ========== 核心评分模块 ==========

/**
 * 第一模块：时间判定逻辑（触发机制）
 * @param {Date} date - 当前时间
 * @param {number} lat - 纬度
 * @param {number} lon - 经度
 * @param {string} type - 'sunrise' 或 'sunset'
 * @returns {Object} 时间判定结果
 */
function checkTimeWindow(date, lat, lon, type) {
  const elevation = calculateSolarElevation(date, lat, lon);

  let inWindow = false;
  let optimalMoment = null;
  let windowDescription = '';

  if (type === 'sunset') {
    // 日落窗口：-5° 到 +6°
    inWindow = elevation >= -5 && elevation <= 6;

    // 最佳爆发时刻
    if (elevation >= -6 && elevation <= -4) {
      optimalMoment = 'high_cloud_eruption'; // 烧高云爆发时刻（日落后15-25分钟）
    } else if (elevation >= -2 && elevation <= 2) {
      optimalMoment = 'mid_cloud_eruption';  // 烧中云爆发时刻（日落时分）
    } else if (elevation >= 2 && elevation <= 5) {
      optimalMoment = 'low_cloud_moment';    // 烧低云时刻（极少见）
    }

    windowDescription = `solar_elevation:${elevation.toFixed(1)}`;
  } else {
    // 日出窗口（类似逻辑，镜像处理）
    inWindow = elevation >= -6 && elevation <= 5;

    if (elevation >= -6 && elevation <= -4) {
      optimalMoment = 'sunrise_high_cloud_eruption'; // 朝霞高云爆发时刻
    } else if (elevation >= -2 && elevation <= 2) {
      optimalMoment = 'sunrise_mid_cloud_eruption';  // 朝霞中云爆发时刻
    }

    windowDescription = `solar_elevation:${elevation.toFixed(1)}`;
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
function scoreCloudCanvas(weatherData) {
  const lowClouds = weatherData.lowClouds || 0;
  const midClouds = weatherData.midClouds || 0;
  const highClouds = weatherData.highClouds || 0;

  // Bug 2 修复：总云量改用最大值（更符合物理叠加）
  const layerBasedCloudCover = Math.min(
    100,
    Math.max(
      lowClouds,
      midClouds,
      highClouds,
      (lowClouds + midClouds + highClouds) / 3
    )
  );
  const totalCloudCover = Math.max(
    0,
    Math.min(100, weatherData.cloudCover ?? layerBasedCloudCover)
  );

  // 阴天关键字兜底（有些天气源会直接给出"阴天/overcast"文案）
  const weatherConditionText = [
    weatherData.weatherMain,
    weatherData.weather,
    weatherData.weatherText,
    weatherData.weatherDescription,
    weatherData.condition
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const hasOvercastKeyword = /(overcast|阴天|阴)/.test(weatherConditionText);

  // 1. 计算有效云量（加权）
  const effectiveCloudCover =
    (highClouds * CLOUD_WEIGHTS.HIGH) +
    (midClouds * CLOUD_WEIGHTS.MID) +
    (lowClouds * CLOUD_WEIGHTS.LOW);

  // 2. 云量区间评分（梯形函数）
  let cloudRangeScore = 0;
  let cloudLevel = '';

  if (effectiveCloudCover <= 10) {
    cloudRangeScore = 10;
    cloudLevel = 'space';       // 太空（无云）
  } else if (effectiveCloudCover <= 30) {
    // 线性插值：10% -> 40分, 30% -> 70分
    cloudRangeScore = 40 + (effectiveCloudCover - 10) / 20 * 30;
    cloudLevel = 'fair';        // 画布稀疏
  } else if (effectiveCloudCover <= 70) {
    // 完美区间：70-100分
    cloudRangeScore = 70 + (effectiveCloudCover - 30) / 40 * 30;
    cloudLevel = 'perfect';     // 完美画布
  } else if (effectiveCloudCover <= 90) {
    // 线性下降：70% -> 60分, 90% -> 30分
    cloudRangeScore = 60 - (effectiveCloudCover - 70) / 20 * 30;
    cloudLevel = 'crowded';     // 画布拥挤
  } else {
    cloudRangeScore = 0;
    cloudLevel = 'overcast';    // 阴天
  }

  // 3. 低云惩罚
  let lowCloudPenalty = 1.0;
  let penaltyReason = '';

  if (lowClouds < 20) {
    lowCloudPenalty = 1.0;
    penaltyReason = 'no_low_cloud_obstruction';
  } else if (lowClouds > 80) {
    lowCloudPenalty = 0.1;
    penaltyReason = 'too_many_low_clouds';
  } else {
    // 线性衰减：20% -> 1.0, 80% -> 0.1
    lowCloudPenalty = 1.0 - (lowClouds - 20) / 60 * 0.9;
    penaltyReason = 'low_cloud_amount';
  }

  // 4. 阴天抑制：总云量过高时，强制压低画布得分，避免"阴天高分"
  let overcastPenalty = 1.0;

  // Bug 2 修复：阴天惩罚阈值从 85% 提前到 65%
  if (totalCloudCover >= 65) {
    // 65%-100%线性衰减：1.0 -> 0.05
    overcastPenalty = 1.0 - ((totalCloudCover - 65) / 35) * 0.95;
    overcastPenalty = Math.max(0.05, overcastPenalty);
  }

  if (hasOvercastKeyword) {
    // 文案明确为阴天时，进一步抑制，避免误报
    overcastPenalty *= 0.2;
  }

  // 最终画布得分
  const canvasScore = cloudRangeScore * lowCloudPenalty * overcastPenalty;

  return {
    score: canvasScore,
    effectiveCloudCover: parseFloat(effectiveCloudCover.toFixed(1)),
    cloudRangeScore: parseFloat(cloudRangeScore.toFixed(1)),
    cloudLevel,
    lowCloudPenalty: parseFloat(lowCloudPenalty.toFixed(2)),
    overcastPenalty: parseFloat(overcastPenalty.toFixed(2)),
    totalCloudCover: parseFloat(totalCloudCover.toFixed(1)),
    hasOvercastKeyword,
    penaltyReason,
    penaltyValue: lowClouds,
    breakdown: {
      lowClouds: parseFloat(lowClouds.toFixed(1)),
      midClouds: parseFloat(midClouds.toFixed(1)),
      highClouds: parseFloat(highClouds.toFixed(1))
    }
  };
}

/**
 * 计算单个光路点的得分
 * @param {Object} cloudData - 云量数据
 * @returns {number} 得分 (0-100)
 */
function calculateLightPathPointScore(cloudData) {
  const totalCloud = cloudData.totalCloud || 0;

  if (totalCloud < 10) {
    // 修复：几乎无云不应给满分，否则会抬高总分
    return 35;
  } else if (totalCloud > 80) {
    return 0;   // 云墙，光线阻断
  } else {
    // 线性插值
    return 100 - ((totalCloud - 10) / 70) * 100;
  }
}

/**
 * 第三模块：光路逻辑（光路通透评分）
 * @param {Object} weatherData - 本地天气数据
 * @param {number} azimuth - 太阳方位角
 * @param {Object} remoteCloudData - 远程云量数据 { near: {totalCloud}, far: {totalCloud} }
 * @returns {Object} 光路评分结果
 */
function scoreLightPath(weatherData, azimuth, remoteCloudData = null) {
  // 修复：无远端数据时不再默认100分，改为中性分
  let nearPointScore = 50;  // 150km点
  let farPointScore = 50;   // 300km点
  let nearPointCloudCover = null;
  let farPointCloudCover = null;

  // 如果提供了远程云量数据，使用它
  // Bug 1 修复：当没有远程数据时，用本地云量估算光路
  if (remoteCloudData && remoteCloudData.near && remoteCloudData.far) {
    if (remoteCloudData.near) {
      nearPointScore = calculateLightPathPointScore(remoteCloudData.near);
      nearPointCloudCover = remoteCloudData.near.totalCloud;
    }
    if (remoteCloudData.far) {
      farPointScore = calculateLightPathPointScore(remoteCloudData.far);
      farPointCloudCover = remoteCloudData.far.totalCloud;
    }
  } else {
    // 没有远程数据时用本地云量估算
    const lowClouds = weatherData.lowClouds || 0;
    const midClouds = weatherData.midClouds || 0;
    const highClouds = weatherData.highClouds || 0;
    const localTotalCloud = Math.min(100, Math.max(lowClouds, midClouds, highClouds, weatherData.cloudCover || 0));
    const estimatedScore = calculateLightPathPointScore({ totalCloud: localTotalCloud });
    nearPointScore = estimatedScore;
    farPointScore = estimatedScore;
    nearPointCloudCover = localTotalCloud;
    farPointCloudCover = localTotalCloud;
  }

  // 光路最终得分 = 近点×0.4 + 远点×0.6
  const lightPathScore = (nearPointScore * LIGHT_PATH_WEIGHTS.NEAR) +
                         (farPointScore * LIGHT_PATH_WEIGHTS.FAR);

  return {
    score: lightPathScore,
    nearPointScore: parseFloat(nearPointScore.toFixed(1)),
    farPointScore: parseFloat(farPointScore.toFixed(1)),
    breakdown: {
      nearPointCloudCover: nearPointCloudCover,
      farPointCloudCover: farPointCloudCover
    },
    hasRemoteData: remoteCloudData !== null
  };
}

/**
 * 第四模块：渲染逻辑（画质修正系数）
 * @param {Object} weatherData - 天气数据
 * @param {boolean} rainedRecently - 最近6小时是否下过雨
 * @returns {Object} 渲染修正结果
 */
function scoreRendering(weatherData, rainedRecently = false) {
  const visibility = weatherData.visibility || 10;
  const humidity = weatherData.humidity || 50;
  const aqi = weatherData.aqi || 50; // AQI如果没有提供，默认50（良）

  // 1. 能见度修正
  let visibilityFactor = 1.0;
  let visibilityLevel = '';

  if (visibility > 20) {
    visibilityFactor = 1.1;
    visibilityLevel = 'excellent';  // 能见度极佳
  } else if (visibility >= 10) {
    visibilityFactor = 1.0;
    visibilityLevel = 'good';       // 能见度良好
  } else {
    visibilityFactor = 0.8;
    visibilityLevel = 'poor';       // 能见度差
  }

  // 2. 湿度修正
  let humidityFactor = 1.0;
  let humidityLevel = '';

  if (humidity > 90) {
    humidityFactor = 0.9;
    humidityLevel = 'fog';          // 可能起雾
  } else if (humidity < 30) {
    humidityFactor = 1.0;
    humidityLevel = 'dry';          // 干燥
  } else {
    humidityFactor = 1.0;
    humidityLevel = 'moderate';     // 适中
  }

  // 3. 特殊模式：雨后初晴
  let rainBonus = 1.0;
  let specialMode = null;

  if (rainedRecently) {
    rainBonus = 1.2;
    specialMode = 'post_rain';      // 雨后初晴模式
  }

  // 4. AQI修正（色彩倾向 + 独立惩罚系数）
  let aqiLevel = '';
  let colorTendency = '';
  let aqiFactor = 1.0;  // 独立于 rainBonus，避免语义混淆

  if (aqi < 50) {
    aqiLevel = 'excellent';          // 空气优
    colorTendency = 'golden_orange'; // 金橙色调
    aqiFactor = 1.0;
  } else if (aqi <= 100) {
    aqiLevel = 'good';               // 空气良
    colorTendency = 'reddish_purple'; // 红紫色调
    aqiFactor = 1.0;
  } else {
    aqiLevel = 'poor';               // 空气差
    colorTendency = 'dark_red';      // 暗红色调
    // 严重污染（AQI > 150）单独施加惩罚
    aqiFactor = aqi > 150 ? 0.8 : 1.0;
  }

  // 最终渲染系数 = 能见度 × 湿度 × 雨后加成 × AQI 修正
  const renderingFactor = visibilityFactor * humidityFactor * rainBonus * aqiFactor;

  return {
    factor: parseFloat(renderingFactor.toFixed(2)),
    visibilityFactor: parseFloat(visibilityFactor.toFixed(2)),
    humidityFactor: parseFloat(humidityFactor.toFixed(2)),
    rainBonus: parseFloat(rainBonus.toFixed(2)),
    aqiFactor: parseFloat(aqiFactor.toFixed(2)),
    breakdown: {
      visibility: visibilityLevel,
      humidity: humidityLevel,
      aqi: aqiLevel,
      colorTendency,
      specialMode
    }
  };
}

/**
 * 根据得分获取质量等级
 *
 * 阈值与 GaussianScore.getQualityLevel 保持一致（需求：5.6-5.8）：
 * excellent ≥ 70，good ≥ 40，fair < 40
 *
 * @param {number} score - 预测得分（0-100）
 * @returns {string} 质量等级：'excellent' | 'good' | 'fair'
 */
function getQualityLevel(score) {
  if (score >= 70) return 'excellent';
  if (score >= 40) return 'good';
  return 'fair';
}

/**
 * 第五模块：综合输出逻辑（最终评分）
 * @param {Object} canvasScore - 画布得分
 * @param {Object} lightPathScore - 光路得分
 * @param {Object} renderingFactor - 渲染系数
 * @param {string} type - 预测类型 ('sunrise' | 'sunset')
 * @returns {Object} 最终预测结果
 */
function calculateFinalScore(canvasScore, lightPathScore, renderingFactor, type = 'sunset') {
  // 综合得分 = 画布×0.4 + 光路×0.6
  const baseScore = (canvasScore.score * FINAL_WEIGHTS.CLOUD_CANVAS) +
                   (lightPathScore.score * FINAL_WEIGHTS.LIGHT_PATH);

  // 应用渲染修正系数
  const finalScore = baseScore * renderingFactor.factor;

  // 确保得分在0-100范围内
  const clampedScore = Math.max(0, Math.min(100, finalScore));

  // 状态判定（返回状态码，由前端翻译）
  let status = '';
  let description = '';
  let advice = '';
  let icon = '';

  // 优先检查画布得分：画布得分<30分 → 无火烧云
  if (canvasScore.score < 30) {
    status = 'no_fire_cloud';
    icon = 'cloudy';  // 🌫️

    if (canvasScore.cloudLevel === 'space') {
      description = 'sky_clear';
    } else if (canvasScore.cloudLevel === 'overcast') {
      description = 'cloud_too_thick';
    } else {
      description = 'cloud_unsuitable';
    }

    advice = 'wait_for_clouds';
  }
  // 光路得分<50分 → 无火烧云或轻微晚霞
  else if (lightPathScore.score < 50) {
    if (clampedScore < 40) {
      status = 'no_fire_cloud';
      icon = 'cloudy';
      description = 'light_path_blocked';
      advice = 'light_path_obstructed';
    } else {
      status = 'light_glow';
      icon = 'sunset';  // 🌅
      description = 'weak_local_colors';
      advice = 'poor_viewing';
    }
  }
  // 根据综合得分判定
  else if (clampedScore < 50) {
    status = 'light_glow';
    icon = 'sunset';
    description = 'conditions_fair';
    advice = 'can_watch';
  } else if (clampedScore < 70) {
    status = 'good_glow';
    icon = 'city_sunset';  // 🌆
    description = 'conditions_good';
    advice = 'can_watch';
  } else if (clampedScore < 85) {
    status = 'very_likely';
    icon = 'city_sunset';
    description = 'excellent_conditions';
    advice = 'worth_watching';
  } else {
    status = 'legendary_eruption';
    icon = 'fire';  // 🔥
    description = 'perfect_mid_high_clouds';
    advice = 'highly_recommended';
  }

  // 分数与状态保持一致，避免"无火烧云"却出现高分
  let displayScore = clampedScore;

  // 修复：云量极低（无云）时强制封顶，避免出现70+误报
  const hasEffectiveCloud = Number.isFinite(canvasScore.effectiveCloudCover);
  const isVeryLowCloud = canvasScore.cloudLevel === 'space' || (hasEffectiveCloud && canvasScore.effectiveCloudCover < 10);
  if (isVeryLowCloud) {
    status = 'no_fire_cloud';
    description = 'sky_clear';
    advice = 'wait_for_clouds';
    icon = 'cloudy';
    displayScore = Math.min(displayScore, 35);
  }

  // 修复：无远端数据时，光路评分不能抬高上限
  if (!lightPathScore.hasRemoteData) {
    displayScore = Math.min(displayScore, 69.9);
  }

  if (status === 'no_fire_cloud') {
    displayScore = Math.min(displayScore, 39.9);
  } else if (status === 'light_glow') {
    displayScore = Math.min(displayScore, 59.9);
  }

  return {
    score: parseFloat(displayScore.toFixed(1)),
    status,
    icon,
    description,
    advice,
    type,
    breakdown: {
      baseScore: parseFloat(baseScore.toFixed(1)),
      canvasScore: parseFloat(canvasScore.score.toFixed(1)),
      lightPathScore: parseFloat(lightPathScore.score.toFixed(1)),
      renderingFactor: renderingFactor.factor,
      unclampedFinalScore: parseFloat(clampedScore.toFixed(1))
    },
    canvasAnalysis: canvasScore,
    lightPathAnalysis: lightPathScore,
    renderingAnalysis: renderingFactor
  };
}

/**
 * 主函数：生成增强版火烧云预测
 * @param {Object} weatherData - 天气数据
 * @param {Date|string} date - 日期
 * @param {number} lat - 纬度
 * @param {number} lon - 经度
 * @param {string} type - 'sunrise' 或 'sunset'
 * @param {Object} options - 可选参数
 * @param {Object} options.remoteCloudData - 远程云量数据
 * @param {boolean} options.rainedRecently - 最近是否下雨
 * @returns {Object} 增强预测结果
 */
function calculateEnhancedPrediction(weatherData, date, lat, lon, type, options = {}) {
  // 确保 date 是 Date 对象
  const dateObj = date instanceof Date ? date : new Date(date);

  const { remoteCloudData = null, rainedRecently = false } = options;

  logger.debug('[EnhancedPredictionService]', '开始计算增强版预测...');

  // 1. 时间判定
  const timeCheck = checkTimeWindow(dateObj, lat, lon, type);
  logger.debug('[EnhancedPredictionService]', '时间判定:', timeCheck);

  // 2. 画布评分（本地云况）
  const canvasScore = scoreCloudCanvas(weatherData);
  logger.debug('[EnhancedPredictionService]', '画布评分:', canvasScore.score);

  // 3. 光路评分（远距离通透性）
  const azimuth = calculateSolarAzimuth(dateObj, lat, lon);
  const lightPathScore = scoreLightPath(weatherData, azimuth, remoteCloudData);
  logger.debug('[EnhancedPredictionService]', '光路评分:', lightPathScore.score);

  // 4. 渲染修正（画质系数）
  const renderingFactor = scoreRendering(weatherData, rainedRecently);
  logger.debug('[EnhancedPredictionService]', '渲染修正:', renderingFactor.factor);

  // 5. 综合输出
  const finalResult = calculateFinalScore(canvasScore, lightPathScore, renderingFactor, type);
  logger.debug('[EnhancedPredictionService]', '最终得分:', finalResult.score);

  // 返回完整结果
  return {
    date: dateObj.toISOString(),
    type: type,
    score: finalResult.score,
    quality: getQualityLevel(finalResult.score),
    timeAnalysis: timeCheck,
    ...finalResult
  };
}

/**
 * 批量计算增强预测（多天）
 * @param {Object} weatherDataArray - 天气数据数组
 * @param {number} lat - 纬度
 * @param {number} lon - 经度
 * @param {string} type - 'sunrise' 或 'sunset'
 * @returns {Array} 预测结果数组
 */
function calculateBatchEnhancedPredictions(weatherDataArray, lat, lon, type) {
  return weatherDataArray.map(item => {
    return calculateEnhancedPrediction(
      item.weather,
      item.date,
      lat,
      lon,
      type,
      { rainedRecently: item.rainedRecently || false }
    );
  });
}

// ========== 导出 ==========

module.exports = {
  // 常量
  SOLAR_ELEVATION_WINDOW,
  CLOUD_WEIGHTS,
  LIGHT_PATH_WEIGHTS,
  FINAL_WEIGHTS,

  // 辅助函数
  getJulianDay,
  calculateSolarElevation,
  calculateSolarAzimuth,

  // 核心评分模块
  checkTimeWindow,
  scoreCloudCanvas,
  scoreLightPath,
  scoreRendering,
  calculateLightPathPointScore,

  // 综合评分
  calculateFinalScore,
  getQualityLevel,

  // 主函数
  calculateEnhancedPrediction,
  calculateBatchEnhancedPredictions
};

