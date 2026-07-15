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
const LightPathV2Service = require('./LightPathV2Service.js');
const LayerBrightnessService = require('./LayerBrightnessService.js');
const { ALGORITHM_VERSION } = require('./AlgorithmVersion.js');
const { getQualityLevel: getSharedQualityLevel } = require('../config/qualityLevels');

// ========== 常量定义 ==========

const SOLAR_ELEVATION_WINDOW = {
  SUNRISE_START: -6,  // 日出前太阳高度角（度）
  SUNRISE_END: 5,
  SUNSET_START: -5,
  SUNSET_END: 6
};

const CLOUD_WEIGHTS = {
  HIGH: 0.75,   // 高云权重小幅上调（卷云/高积云是火烧云最佳载体）
  MID:  0.45,   // 中云次之（高积云/高层云）
  LOW:  0.10    // 低云权重最低（层云/积云通常遮挡光路）
};

const LIGHT_PATH_WEIGHTS = {
  NEAR: 0.4,    // 150km点权重
  FAR: 0.6      // 300km点权重（更重要）
};

const FINAL_WEIGHTS = {
  CLOUD_CANVAS: 0.8,   // 本地云况（主）
  LIGHT_PATH: 0.2      // 光路约束（保守权重）
};

const SOLAR_DIRECTION_SAMPLE_DISTANCES_KM = [10, 25, 50, 75, 100];
const SOLAR_DIRECTION_SAMPLE_WEIGHTS = [0.25, 0.30, 0.25, 0.14, 0.06];
const SOLAR_DIRECTION_SAMPLE_WEIGHT_BY_DISTANCE = Object.freeze(
  SOLAR_DIRECTION_SAMPLE_DISTANCES_KM.reduce((acc, distanceKm, index) => {
    acc[distanceKm] = SOLAR_DIRECTION_SAMPLE_WEIGHTS[index];
    return acc;
  }, {})
);
const VISIBLE_CARRIER_SAMPLE_DISTANCES_KM = [0, 10, 25, 50, 75, 100];
const VISIBLE_CARRIER_SAMPLE_WEIGHTS = [0.15, 0.20, 0.25, 0.22, 0.12, 0.06];
const VISIBLE_CARRIER_SAMPLE_WEIGHT_BY_DISTANCE = Object.freeze(
  VISIBLE_CARRIER_SAMPLE_DISTANCES_KM.reduce((acc, distanceKm, index) => {
    acc[distanceKm] = VISIBLE_CARRIER_SAMPLE_WEIGHTS[index];
    return acc;
  }, {})
);
const UPPER_CLOUD_SIGNAL_LOW_CLOUD_LIFT = 12;
const UPPER_CLOUD_SIGNAL_LOW_CLOUD_SCALE = 8;
const VISIBLE_SECTOR_LAYER_HEIGHT_KM = Object.freeze({
  mid: 4.5,
  high: 8.5
});

// ========== 辅助函数 ==========

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smoothStep(edge0, edge1, value) {
  if (!Number.isFinite(value)) return 0;
  if (edge0 === edge1) return value >= edge1 ? 1 : 0;
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function upperCloudSignal(cloudPercent) {
  const cloud = clamp(Number(cloudPercent) || 0, 0, 100);
  if (cloud <= 0) return 0;
  const lowCloudPresence = 1 - Math.exp(-cloud / UPPER_CLOUD_SIGNAL_LOW_CLOUD_SCALE);
  const saturationFade = Math.pow(clamp(1 - cloud / 70, 0, 1), 2);
  const lowAmountLift = UPPER_CLOUD_SIGNAL_LOW_CLOUD_LIFT * lowCloudPresence * saturationFade;
  return clamp(cloud + lowAmountLift, 0, 100);
}

function getCloudTypeAdditiveAdjustment(cloudType) {
  switch (cloudType?.type) {
    case 'stratus':
      return { canvasBonus: -30, lightGateDelta: -0.35, reason: 'stratus_blocks_light' };
    case 'stratocumulus':
      return { canvasBonus: -4, lightGateDelta: -0.08, reason: 'low_cloud_partial_block' };
    case 'altostratus':
      return { canvasBonus: 4, lightGateDelta: 0.00, reason: 'upper_cloud_carrier' };
    case 'altocumulus':
      return { canvasBonus: 6, lightGateDelta: 0.00, reason: 'mid_cloud_carrier' };
    case 'clear':
      return { canvasBonus: -25, lightGateDelta: 0.04, reason: 'clear_but_no_cloud_canvas' };
    case 'mixed':
      return { canvasBonus: -8, lightGateDelta: -0.06, reason: 'mixed_cloud_layers' };
    default:
      return { canvasBonus: 0, lightGateDelta: 0, reason: 'neutral_cloud_type' };
  }
}

function getCloudThicknessCanvasAdjustment(cloudThickness, canvasScoreBeforeThickness = null) {
  const modifier = Number(cloudThickness?.modifier ?? 1);
  const thickness = cloudThickness?.thickness || 'unknown';
  if (modifier > 1) {
    return { adjustment: 5, reason: 'thin_cloud_bonus' };
  }
  const pressure = Number.isFinite(Number(cloudThickness?.pressure))
    ? clamp(Number(cloudThickness.pressure), 0, 1)
    : (thickness === 'thick' || modifier <= 0.5 ? 1 : null);
  const baseScore = Number(canvasScoreBeforeThickness);
  if (pressure != null && Number.isFinite(baseScore) && baseScore > 0) {
    const maxPenalty = baseScore * 0.30;
    const adjustment = -Math.round(maxPenalty * pressure);
    return {
      adjustment,
      pressure: parseFloat(pressure.toFixed(2)),
      maxPenalty: parseFloat(maxPenalty.toFixed(1)),
      baseScore: parseFloat(baseScore.toFixed(1)),
      penaltyRatio: 0.30,
      reason: adjustment < 0 ? 'cloud_thickness_pressure_penalty' : 'neutral_cloud_thickness'
    };
  }
  if (modifier < 1) {
    const fallbackBase = Number.isFinite(baseScore) && baseScore > 0 ? baseScore : 100;
    return {
      adjustment: -Math.round(fallbackBase * 0.30 * clamp(1 - modifier, 0, 1)),
      reason: 'moderate_thick_cloud_penalty'
    };
  }
  return { adjustment: 0, reason: 'neutral_cloud_thickness' };
}

function getRenderingScoreAdjustment(renderingFactor) {
  const factor = Number(renderingFactor?.factor ?? 1);
  if (!Number.isFinite(factor)) {
    return { adjustment: 0, reason: 'rendering_unknown' };
  }
  if (factor >= 1) {
    return {
      adjustment: parseFloat(clamp((factor - 1) * 50, 0, 9).toFixed(1)),
      reason: 'positive_rendering_bonus'
    };
  }
  return {
    adjustment: parseFloat((-clamp((1 - factor) * 55, 0, 25)).toFixed(1)),
    reason: 'negative_rendering_penalty'
  };
}

function applyRenderingToGatedScore(gatedScore, renderingFactor, renderingAdjustment) {
  const factor = Number(renderingFactor?.factor ?? 1);
  if (!Number.isFinite(factor)) {
    return {
      score: gatedScore,
      adjustment: 0,
      factor: 1,
      reason: 'rendering_unknown'
    };
  }

  if (factor < 1) {
    const boundedFactor = clamp(factor, 0.45, 1);
    const score = gatedScore * boundedFactor;
    return {
      score,
      adjustment: parseFloat((score - gatedScore).toFixed(1)),
      factor: boundedFactor,
      reason: 'negative_rendering_multiplier'
    };
  }

  const adjustment = Number(renderingAdjustment?.adjustment ?? 0);
  return {
    score: gatedScore + adjustment,
    adjustment,
    factor,
    reason: renderingAdjustment?.reason || 'positive_rendering_bonus'
  };
}

function scoreRangePeak(value, min, peak, max) {
  if (!Number.isFinite(value) || value <= min || value >= max) return 0;
  if (value === peak) return 1;
  if (value < peak) return (value - min) / (peak - min);
  return (max - value) / (max - peak);
}

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

// ========== 云种判别（需求39，Phase 19 任务67.1）==========

/**
 * 根据分层云量判别主导云种及评分乘数
 * 来源：sunsetbot.top 火烧云预报教程 章节2
 *
 * @param {number} low   - 低云量 % (0-2500m)
 * @param {number} mid   - 中云量 % (2500-7000m)
 * @param {number} high  - 高云量 % (7000m+)
 * @param {number|null} cloudBaseHeightM - 云底高度(m)，可选，提供时更准确
 * @returns {{type, label, labelEn, canvasMultiplier, lightPathMultiplier, reason}}
 */
function cloudTypeClassifier(low, mid, high, cloudBaseHeightM = null) {
  // 若有云底高度，层云判别更准确（层云云底 < 500m）
  const isDefinitelyStratus = cloudBaseHeightM !== null && cloudBaseHeightM < 500 && low > 40;

  // 各层主导分数
  const dominant = Math.max(low, mid, high);

  let type, label, labelEn, canvasMultiplier, lightPathMultiplier, reason;

  if (isDefinitelyStratus || low > 70) {
    // 层云型：低云超厚，几乎封死
    type             = 'stratus';
    label            = '层云（强遮挡）';
    labelEn          = 'Stratus (blocking)';
    canvasMultiplier  = 0.4;
    lightPathMultiplier = 0.5;
    reason           = '低云超过70%，光线难以穿透';
  } else if (low > 40) {
    // 层积云型：低云为主，有一定遮挡
    type             = 'stratocumulus';
    label            = '层积云';
    labelEn          = 'Stratocumulus';
    canvasMultiplier  = 1.0;
    lightPathMultiplier = 1.0;
    reason           = '低云主导，层积云型';
  } else if (low < 20 && high >= mid && high > 25) {
    // 高层云/卷层云型：高云主导，低云少，最佳
    type             = 'altostratus';
    label            = '高层云（最佳画布）';
    labelEn          = 'Altostratus (optimal)';
    canvasMultiplier  = 1.2;
    lightPathMultiplier = 1.1;
    reason           = '高云主导且低云干扰少，最利于火烧云';
  } else if (low < 20 && mid > 25) {
    // 高积云/中层云型：中云主导，低云少，很好
    type             = 'altocumulus';
    label            = '高积云（优质画布）';
    labelEn          = 'Altocumulus (good)';
    canvasMultiplier  = 1.15;
    lightPathMultiplier = 1.0;
    reason           = '中云主导且低云干扰少，利于火烧云';
  } else if (dominant < 10) {
    // 几乎无云：有光无云，火烧云条件差
    type             = 'clear';
    label            = '少云';
    labelEn          = 'Clear (few clouds)';
    canvasMultiplier  = 0.6;
    lightPathMultiplier = 1.2;
    reason           = '云量过少，缺乏"画布"';
  } else {
    // 混合型
    type             = 'mixed';
    label            = '混合云层';
    labelEn          = 'Mixed';
    canvasMultiplier  = 0.85;
    lightPathMultiplier = 0.9;
    reason           = '多层混合云，条件一般';
  }

  return { type, label, labelEn, canvasMultiplier, lightPathMultiplier, reason };
}

// ========== 第二模块：画布评分 ==========

/**
 * 第二模块：画布逻辑（本地云况评分）
 * @param {Object} weatherData - 天气数据
 * @returns {Object} 画布评分结果
 */
function scoreCloudCanvas(weatherData) {
  const lowClouds = weatherData.lowClouds || 0;
  const midClouds = weatherData.midClouds || 0;
  const highClouds = weatherData.highClouds || 0;
  const midCloudSignal = upperCloudSignal(midClouds);
  const highCloudSignal = upperCloudSignal(highClouds);

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

  // 1. 计算有效云量（只用中高云，低云不算画布）
  // 气象学依据：中云(高积云/高层云)和高云(卷云)都能散射红橙色光，是火烧云的画布
  // 低云(层云/积云)主要遮挡视线，不算画布贡献
  const upperCloudCover = highCloudSignal * CLOUD_WEIGHTS.HIGH + midCloudSignal * CLOUD_WEIGHTS.MID;
  const effectiveCloudCover = upperCloudCover;

  // 2. 云量区间评分（基于中高云画布，低云单独惩罚）
  let cloudRangeScore = 0;
  let cloudLevel = '';

  if (upperCloudCover <= 10) {
    cloudRangeScore = 10;
    cloudLevel = 'space';       // 太空（无云）
  } else if (upperCloudCover <= 30) {
    cloudRangeScore = 40 + (upperCloudCover - 10) / 20 * 30;
    cloudLevel = 'fair';
  } else if (upperCloudCover <= 70) {
    cloudRangeScore = 70 + (upperCloudCover - 30) / 40 * 30;
    cloudLevel = 'perfect';
  } else if (upperCloudCover <= 100) {
    // 中高云充足时缓降：70->50分
    cloudRangeScore = 70 - (upperCloudCover - 70) / 30 * 20;
    cloudLevel = 'crowded';
  } else {
    // 中高云极厚（>100加权值）：画布密集但仍有色彩
    cloudRangeScore = 43;
    cloudLevel = 'crowded';
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

  // 4. 阴天抑制：惩罚重点放在“低云遮挡”，中高云不做过重惩罚
  let overcastPenalty = 1.0;

  // 低云主导惩罚：55%-100%线性衰减 1.0 -> 0.2
  if (lowClouds >= 55) {
    overcastPenalty = 1.0 - ((lowClouds - 55) / 45) * 0.8;
    overcastPenalty = Math.max(0.2, overcastPenalty);
  }

  // 总云量极高且存在一定低云时，给轻惩罚，避免中层云场景被重罚
  if (totalCloudCover >= 92 && lowClouds >= 20) {
    const totalCloudPenalty = 1.0 - ((totalCloudCover - 92) / 8) * 0.25; // 1.0 -> 0.75
    overcastPenalty = Math.min(overcastPenalty, Math.max(0.75, totalCloudPenalty));
  }

  if (hasOvercastKeyword && lowClouds >= 35) {
    // 文案明确为阴天且低云明显时，再额外抑制
    overcastPenalty *= 0.5;
  }

  // 最终画布得分：低云/阴天仍作为门控乘法。
  let canvasScore = cloudRangeScore * lowCloudPenalty * overcastPenalty;

  // 高云主导场景是同一类“画布载体”证据，改为加分，不再与云种/薄云连续相乘。
  let highCloudBonus = 0;
  if (highClouds > 50 && lowClouds < 30) {
    highCloudBonus = clamp((highClouds - 50) / 50 * 6, 0, 6);
    canvasScore += highCloudBonus;
  }

  return {
    score: canvasScore,
    effectiveCloudCover: parseFloat(effectiveCloudCover.toFixed(1)),
    cloudRangeScore: parseFloat(cloudRangeScore.toFixed(1)),
    cloudLevel,
    lowCloudPenalty: parseFloat(lowCloudPenalty.toFixed(2)),
    overcastPenalty: parseFloat(overcastPenalty.toFixed(2)),
    highCloudBonus: parseFloat(highCloudBonus.toFixed(1)),
    totalCloudCover: parseFloat(totalCloudCover.toFixed(1)),
    hasOvercastKeyword,
    penaltyReason,
    penaltyValue: lowClouds,
    breakdown: {
      lowClouds: parseFloat(lowClouds.toFixed(1)),
      midClouds: parseFloat(midClouds.toFixed(1)),
      highClouds: parseFloat(highClouds.toFixed(1)),
      midCloudSignal: parseFloat(midCloudSignal.toFixed(1)),
      highCloudSignal: parseFloat(highCloudSignal.toFixed(1))
    }
  };
}

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

/**
 * 兼容旧接口：按分层云量估算单点通透分（0-100）
 */
function calculateLightPathPointScore(cloudData) {
  const low = cloudData.lowCloud ?? cloudData.lowClouds ?? 0;
  const mid = cloudData.midCloud ?? cloudData.midClouds ?? 0;
  const high = cloudData.highCloud ?? cloudData.highClouds ?? 0;
  const opacity = (low * 0.7 + mid * 0.2 + high * 0.1) / 100;
  return parseFloat((100 * (1 - Math.max(0, Math.min(1, opacity)))).toFixed(1));
}

function estimateCloudBaseHeight(weatherData) {
  if (typeof weatherData.cloudBaseHeight === 'number' && Number.isFinite(weatherData.cloudBaseHeight)) {
    return weatherData.cloudBaseHeight;
  }
  const low = weatherData.lowClouds || 0;
  const mid = weatherData.midClouds || 0;
  const high = weatherData.highClouds || 0;

  // 高云主导场景：高云 > 50% 且低云 < 30%，使用高云高度（6-8km）
  if (high > 50 && low < 30) {
    return 7000; // 高云底高度约7km
  }

  if (low > 60) return 700;
  if (low > 30) return 1000;
  if (mid > 50) return 1800;
  return 2200;
}

function getCloudBaseHeightMeta(weatherData) {
  const observed = Number(weatherData.cloudBaseHeight);
  if (Number.isFinite(observed) && observed > 0) {
    return {
      heightM: observed,
      source: 'provider',
      reason: 'provider_cloud_base_height'
    };
  }

  const low = Number(weatherData.lowClouds || 0);
  const mid = Number(weatherData.midClouds || 0);
  const high = Number(weatherData.highClouds || 0);
  const heightM = estimateCloudBaseHeight(weatherData);
  let reason = 'estimated_default_cloud_base_height';
  if (high > 50 && low < 30) {
    reason = 'estimated_high_cloud_dominant';
  } else if (low > 60) {
    reason = 'estimated_dense_low_cloud';
  } else if (low > 30) {
    reason = 'estimated_low_cloud';
  } else if (mid > 50) {
    reason = 'estimated_mid_cloud';
  }

  return {
    heightM,
    source: 'estimated',
    reason
  };
}

// ========== 云厚评估模块（Phase 22）==========

function hasClearAirForUpperCloudCarrier(weatherData) {
  const visibility = Number(weatherData.visibility ?? 20);
  const precipitation = Number(weatherData.precipitation || 0);
  const { aod, pm25, pm10, dust } = getAerosolMetrics(weatherData);

  return precipitation <= 0.2
    && visibility >= 15
    && (aod == null || aod <= 0.45)
    && (pm25 == null || pm25 < 65)
    && (pm10 == null || pm10 < 120)
    && (dust == null || dust < 80);
}

function isFavorableDenseUpperCloudCarrier(weatherData) {
  const lowClouds = Number(weatherData.lowClouds || 0);
  const midClouds = Number(weatherData.midClouds || 0);
  const highClouds = Number(weatherData.highClouds || 0);

  return highClouds >= 80
    && midClouds >= 30
    && lowClouds <= 10
    && hasClearAirForUpperCloudCarrier(weatherData);
}

function isFavorableOpeningUpperCloudCarrier(weatherData, context = {}) {
  const lowClouds = Number(weatherData.lowClouds || 0);
  const midClouds = Number(weatherData.midClouds || 0);
  const highClouds = Number(weatherData.highClouds || 0);
  const lightPathScore = Number(context.lightPathScore?.score ?? context.lightPathScore ?? 0);
  const directionalReason = context.lightPathScore?.directionalAnalysis?.reason || '';
  const hasDirectionalOpening = directionalReason.includes('opening');

  return lowClouds <= 10
    && midClouds >= 45
    && highClouds >= 40
    && (lightPathScore >= 65 || hasDirectionalOpening)
    && hasClearAirForUpperCloudCarrier(weatherData);
}

function assessUpperCloudCarrierContext(weatherData, context = {}) {
  const lowClouds = Number(weatherData.lowClouds || 0);
  const midClouds = Number(weatherData.midClouds || 0);
  const highClouds = Number(weatherData.highClouds || 0);
  const precipitation = Number(weatherData.precipitation ?? weatherData.rain ?? weatherData.showers ?? 0);
  const lightPathScore = Number(context.lightPathScore?.score ?? context.lightPathScore ?? 0);
  const directional = context.lightPathScore?.directionalAnalysis || {};
  const directionalReason = directional.reason || '';
  const directionalLowMid = Number(directional.lowMid);
  const directionalHigh = Number(directional.high);
  const hasDirectionalOpening = directionalReason.includes('opening');
  const directionOpenEnough = hasDirectionalOpening
    && Number.isFinite(directionalLowMid)
    && directionalLowMid <= 15
    && Number.isFinite(directionalHigh)
    && directionalHigh >= 60;

  const hasLocalUpperCloud = directionOpenEnough
    ? (highClouds >= 55 || (highClouds >= 40 && midClouds >= 35))
    : (highClouds >= 40 && midClouds >= 35);
  const localUpperCarrier = lowClouds <= 10 && hasLocalUpperCloud;
  const clearAir = precipitation <= 0.2 && hasClearAirForUpperCloudCarrier(weatherData);
  const lightOpen = lightPathScore >= 70 || directionOpenEnough;

  if (localUpperCarrier && clearAir && lightOpen) {
    return {
      favorable: true,
      strength: directionOpenEnough ? 1.2 : 0.8,
      reason: directionOpenEnough ? 'upper_cloud_direction_opening' : 'upper_cloud_clear_light_path'
    };
  }

  return {
    favorable: false,
    strength: 0,
    reason: null
  };
}

function isFavorableDirectionalHighCloudCarrier(weatherData, context = {}) {
  const highClouds = Number(weatherData.highClouds || 0);
  const precipitation = Number(weatherData.precipitation ?? weatherData.rain ?? weatherData.showers ?? 0);
  const carrier = assessUpperCloudCarrierContext(weatherData, context);
  return highClouds >= 55
    && precipitation <= 0.2
    && carrier.favorable
    && carrier.reason === 'upper_cloud_direction_opening';
}

/**
 * 云厚评估：区分“薄卷云（好幕布）”和“厚云幕（压光）”
 *
 * 判定信号：
 * 1. 水汽法：waterVapour × cloudCover / 100（高 = 含水量大，但需结合云型/光路判断）
 * 2. 天气码兜底：WMO 阴天码直接标厚
 * 3. 低云覆盖：低云多时才作为明确遮光厚云
 *
 * @param {Object} weatherData - 天气数据（目标时刻）
 * @param {Object|null} prevHourData - 目标时刻前1-2小时的数据（仅用于展示辐射证据，不参与云厚扣分）
 * @returns {{ thickness: 'thin'|'moderate'|'thick'|'unknown', modifier: number, reasons: string[] }}
 */
function assessCloudThickness(weatherData, prevHourData = null, context = {}) {
  const cc = weatherData.cloudCover || 0;
  const weatherCode = weatherData.weatherCode;
  const wv = weatherData.waterVapourColumn;
  const lowClouds = Number(weatherData.lowClouds || 0);

  const signals = []; // 收集判定信号
  let thinEvidence = 0;
  let thickEvidence = 0;

  // --- 辐射信号：单独的低辐射不参与扣分；只有与厚中云和灰空气同时出现才作为透射证据。 ---
  const targetShortwaveRadiation = Number(weatherData.shortwaveRadiation);
  const targetDirectRadiation = Number(weatherData.directRadiation);
  let sw = weatherData.shortwaveRadiation;
  let df = weatherData.diffuseRadiation;
  let usedPrevHour = false;
  let diffuseRatio = null;
  let waterIndex = null;

  if ((sw == null || sw <= 0) && prevHourData) {
    const pSw = prevHourData.shortwaveRadiation;
    if (pSw != null && pSw > 0) {
      sw = pSw;
      df = prevHourData.diffuseRadiation;
      usedPrevHour = true;
    }
  }

  // --- 信号2：水汽指数 ---
  // waterVapourColumn 是整层大气水汽，不等于云光学厚度；雨后/夏季高云场景只作为弱风险。
  if (wv != null) {
    waterIndex = wv * cc / 100;
    const upperCarrier = assessUpperCloudCarrierContext(weatherData, context);
    if (waterIndex < 2.5)      { thinEvidence += 1.5; signals.push('water_vapour_low'); }
    else if (waterIndex < 4.5) { /* 适中，不加减 */ signals.push('water_vapour_moderate'); }
    else if (waterIndex < 7)   { thickEvidence += upperCarrier.favorable ? 0.25 : 0.5; signals.push('water_vapour_high'); }
    else                       { thickEvidence += upperCarrier.favorable ? 0.6 : 1.0; signals.push('water_vapour_very_high'); }
  }

  // --- 展示证据：散射比不再作为厚云扣分输入 ---
  if (sw != null && df != null && sw > 0) {
    diffuseRatio = df / sw;
  }

  const highClouds = Number(weatherData.highClouds || 0);
  const midClouds = Number(weatherData.midClouds || 0);
  const { aod, pm25, pm10 } = getAerosolMetrics(weatherData);
  const aqi = Number(weatherData.aqi);
  const isMidCloudCurtain = cc >= 90 && lowClouds <= 10 && midClouds >= 70 && highClouds < 45;
  const hasWeakDirectLight =
    Number.isFinite(targetDirectRadiation) && targetDirectRadiation <= 5 &&
    Number.isFinite(targetShortwaveRadiation) && targetShortwaveRadiation <= 40;
  const hasGrayAir =
    (aod != null && aod >= 0.55) ||
    (pm25 != null && pm25 >= 55) ||
    (pm10 != null && pm10 >= 100) ||
    (Number.isFinite(aqi) && aqi >= 150) ||
    (Number.isFinite(waterIndex) && waterIndex >= 30);
  if (isMidCloudCurtain && hasWeakDirectLight && hasGrayAir) {
    thickEvidence += 3.0;
    signals.push('low_solar_transmission');
  }

  // --- 信号4：天气码兜底 ---
  // WMO code 3 = 阴天
  if (weatherCode === 3) { thickEvidence += 2; signals.push('wmo_overcast'); }
  // WMO code 45/48 = 雾
  if (weatherCode === 45 || weatherCode === 48) { thickEvidence += 2; signals.push('wmo_fog'); }

  if (lowClouds >= 60) {
    thickEvidence += 1.4;
    signals.push('low_cloud_curtain');
  } else if (lowClouds >= 35) {
    thickEvidence += 0.7;
    signals.push('low_cloud_partial_curtain');
  }

  const thickEvidenceBeforeCarrierRelief = thickEvidence;
  const upperCarrierContext = assessUpperCloudCarrierContext(weatherData, context);
  let carrierEvidenceRelief = 0;
  if (upperCarrierContext.favorable && thickEvidence > 0) {
    carrierEvidenceRelief = upperCarrierContext.strength;
    thickEvidence = Math.max(0, thickEvidence - carrierEvidenceRelief);
    signals.push(upperCarrierContext.reason);
  }

  // --- 综合判定 ---
  const hasAnySignal = signals.length > 0;

  if (!hasAnySignal) {
    return { thickness: 'unknown', modifier: 1.0, reasons: ['no_cloud_thickness_data'] };
  }

  const score = parseFloat((thinEvidence - thickEvidence).toFixed(2));
  const highOnlyUpperCarrier = lowClouds <= 10 && highClouds >= 80 && midClouds < 30;
  const carrierRelief = highOnlyUpperCarrier ? 0.08 : 0;
  if (carrierRelief > 0) {
    signals.push('high_only_upper_canvas_relief');
  }
  const pressureNet = thinEvidence - thickEvidenceBeforeCarrierRelief;
  const evidencePressure = smoothStep(1.5, 4.5, thickEvidenceBeforeCarrierRelief);
  const netPressure = smoothStep(0.8, 4.0, -pressureNet);
  const diffusePressure = 0;
  const waterPressure = Number.isFinite(waterIndex) ? smoothStep(4.5, 11.0, waterIndex) : 0;
  const rawPressure = clamp(
    evidencePressure * 0.35
      + netPressure * 0.30
      + waterPressure * 0.10,
    0,
    1
  );
  const pressure = clamp(rawPressure - carrierRelief, 0, 1);
  const evidence = {
    thin: parseFloat(thinEvidence.toFixed(2)),
    thick: parseFloat(thickEvidence.toFixed(2)),
    rawThick: parseFloat(thickEvidenceBeforeCarrierRelief.toFixed(2)),
    net: score,
    rawNet: parseFloat(pressureNet.toFixed(2)),
    carrierEvidenceRelief: parseFloat(carrierEvidenceRelief.toFixed(2)),
    diffuseRatio: Number.isFinite(diffuseRatio) ? parseFloat(diffuseRatio.toFixed(3)) : null,
    waterIndex: Number.isFinite(waterIndex) ? parseFloat(waterIndex.toFixed(2)) : null,
    evidencePressure: parseFloat(evidencePressure.toFixed(2)),
    netPressure: parseFloat(netPressure.toFixed(2)),
    diffusePressure: parseFloat(diffusePressure.toFixed(2)),
    waterPressure: parseFloat(waterPressure.toFixed(2)),
    rawPressure: parseFloat(rawPressure.toFixed(2)),
    carrierRelief: parseFloat(carrierRelief.toFixed(2)),
    pressure: parseFloat(pressure.toFixed(2))
  };

  let thickness, modifier;
  if (score >= 1.5) {
    thickness = 'thin';
    modifier = 1.1;    // 薄云加分
  } else if (score >= 0) {
    thickness = 'moderate';
    modifier = 1.0;
  } else if (thickEvidence < 3.0 || score >= -1.8) {
    thickness = 'moderate';
    modifier = parseFloat(clamp(1 - pressure * 0.65, 0.55, 1).toFixed(2));
  } else {
    thickness = 'thick';
    modifier = parseFloat(clamp(1 - pressure * 0.65, 0.45, 1).toFixed(2));
  }

  if (thickness === 'thick' && isFavorableDenseUpperCloudCarrier(weatherData)) {
    signals.push('dense_upper_cloud_carrier_softened');
    return { thickness: 'moderate', modifier: Math.max(modifier, 0.75), pressure: evidence.pressure, reasons: signals, score, evidence };
  }

  if (thickness === 'thick' && isFavorableOpeningUpperCloudCarrier(weatherData, context)) {
    signals.push('opening_upper_cloud_carrier_softened');
    return { thickness: 'moderate', modifier: Math.max(modifier, 0.62), pressure: evidence.pressure, reasons: signals, score, evidence };
  }

  if (thickness === 'thick' && isFavorableDirectionalHighCloudCarrier(weatherData, context)) {
    signals.push('directional_high_cloud_carrier_softened');
    const highOnlyOpening = Number(weatherData.midClouds || 0) < 30;
    return { thickness: 'moderate', modifier: Math.max(modifier, highOnlyOpening ? 0.66 : 0.62), pressure: evidence.pressure, reasons: signals, score, evidence };
  }

  return { thickness, modifier, pressure: evidence.pressure, reasons: signals, score, evidence };
}

/**
 * 厚高云惩罚：高云虽是火烧云画布，但当高云覆盖很高且云厚信号明确时，
 * 实际常表现为整片云幕遮光，仅日落方向局部透光，不能给优秀分。
 */
function assessThickHighCloudPenalty(weatherData, cloudThickness) {
  const cloudCover = weatherData.cloudCover || 0;
  const lowClouds = weatherData.lowClouds || 0;
  const midClouds = weatherData.midClouds || 0;
  const highClouds = weatherData.highClouds || 0;
  const waterVapour = Number(weatherData.waterVapourColumn);
  const reasons = cloudThickness?.reasons || [];

  const isHighCloudCurtain = highClouds >= 80 && cloudCover >= 60 && lowClouds < 20;
  const isThick = cloudThickness?.thickness === 'thick' || cloudThickness?.modifier <= 0.5;
  const diffuseDominant = reasons.includes('diffuse_dominant');
  const waterIndex = Number.isFinite(waterVapour) ? waterVapour * cloudCover / 100 : null;
  const waterHeavy = reasons.includes('water_vapour_very_high')
    && Number.isFinite(waterIndex)
    && waterIndex >= 12
    && midClouds < 30;
  const softenedCarrier = reasons.includes('dense_upper_cloud_carrier_softened')
    || reasons.includes('opening_upper_cloud_carrier_softened')
    || reasons.includes('directional_high_cloud_carrier_softened')
    || reasons.includes('upper_cloud_direction_opening')
    || reasons.includes('upper_cloud_clear_light_path');

  if (softenedCarrier) {
    return {
      applied: false,
      cap: null,
      reason: (reasons.includes('opening_upper_cloud_carrier_softened') || reasons.includes('upper_cloud_clear_light_path'))
        ? 'opening_upper_cloud_carrier_canvas_only'
        : (reasons.includes('directional_high_cloud_carrier_softened') || reasons.includes('upper_cloud_direction_opening')
          ? 'directional_high_cloud_carrier_canvas_only'
          : 'dense_upper_cloud_carrier_canvas_only')
    };
  }

  if (!isHighCloudCurtain || (!(isThick && diffuseDominant) && !waterHeavy)) {
    return { applied: false, cap: null, reason: null };
  }

  // 不再用漫射占比单独判厚；只有水汽柱+高云覆盖都很高时，才视为整片厚云幕。
  const cap = diffuseDominant ? 42 : 48;

  return {
    applied: true,
    cap,
    reason: diffuseDominant
      ? 'thick_high_cloud_diffuse_cap_42'
      : 'water_heavy_high_cloud_cap_48'
  };
}

function maybeSuppressWaterHeavyHighCloudCap(thickHighCloudPenalty, visibleSectorCarrier, weatherData = {}) {
  if (!thickHighCloudPenalty?.applied || thickHighCloudPenalty.reason !== 'water_heavy_high_cloud_cap_48') {
    return thickHighCloudPenalty;
  }

  const lowClouds = Number(weatherData.lowClouds || 0);
  const precipitation = Number(weatherData.precipitation ?? weatherData.rain ?? weatherData.showers ?? 0);
  const visibility = Number(weatherData.visibility ?? 20);
  const visibleScore = Number(visibleSectorCarrier?.score ?? 0);
  const upperSignal = Number(visibleSectorCarrier?.metrics?.upperSignal ?? 0);
  const lowMidBlock = Number(visibleSectorCarrier?.metrics?.lowMidBlock ?? 100);
  const hasStrongSideCarrier = visibleSectorCarrier?.applied
    && visibleScore >= 40
    && upperSignal >= 45
    && lowMidBlock <= 35;

  if (!hasStrongSideCarrier || lowClouds > 10 || precipitation > 0.2 || visibility < 10) {
    return thickHighCloudPenalty;
  }

  return {
    applied: false,
    cap: null,
    reason: 'visible_sector_relief_from_water_heavy_high_cloud_cap',
    suppressed: true,
    originalCap: thickHighCloudPenalty.cap,
    originalReason: thickHighCloudPenalty.reason,
    metrics: {
      visibleSectorScore: parseFloat(visibleScore.toFixed(1)),
      visibleSectorUpperSignal: parseFloat(upperSignal.toFixed(1)),
      visibleSectorLowMidBlock: parseFloat(lowMidBlock.toFixed(1)),
      visibility
    }
  };
}

function parseOptionalFiniteMetric(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function getAerosolMetrics(weatherData) {
  const aod = parseOptionalFiniteMetric(weatherData.aerosolOpticalDepth ?? weatherData.aod);
  const pm25 = parseOptionalFiniteMetric(weatherData.pm2_5 ?? weatherData.pm25);
  const pm10 = parseOptionalFiniteMetric(weatherData.pm10);
  const dust = parseOptionalFiniteMetric(weatherData.dust);
  return {
    aod,
    pm25,
    pm10,
    dust
  };
}

/**
 * 气溶胶弱载体：适度薄霾/气溶胶可以承接一点红橙散射，
 * 但必须被光路激活，且只提供普通红日落的中低分上限。
 */
function scoreAerosolCarrier(weatherData, lightPathScore = {}) {
  const { aod, pm25, pm10, dust } = getAerosolMetrics(weatherData);
  const visibility = Number(weatherData.visibility ?? 20);
  const lowClouds = Number(weatherData.lowClouds || 0);
  const precipitation = Number(weatherData.precipitation ?? weatherData.rain ?? 0);
  const lightPath = Number(lightPathScore?.score ?? lightPathScore ?? 0);

  const hasVisibilityHazeProxy = visibility >= 7 && visibility <= 12 && precipitation <= 0.2 && lowClouds < 40;
  const hasAerosolSignal = aod != null || pm25 != null || pm10 != null || dust != null || hasVisibilityHazeProxy;
  if (!hasAerosolSignal) {
    return {
      score: 0,
      activatedScore: 0,
      lightPathActivation: parseFloat(clamp((lightPath - 45) / 35, 0, 1).toFixed(2)),
      level: 'unknown',
      reason: 'aerosol_data_missing',
      metrics: { aod, pm25, pm10, dust, visibility }
    };
  }

  const heavyHaze = visibility < 8 ||
    (aod != null && aod >= 0.85) ||
    (pm25 != null && pm25 >= 90) ||
    (pm10 != null && pm10 >= 180) ||
    (dust != null && dust >= 120);
  if (heavyHaze || lowClouds >= 40 || precipitation > 0.2) {
    return {
      score: 0,
      activatedScore: 0,
      lightPathActivation: parseFloat(clamp((lightPath - 45) / 35, 0, 1).toFixed(2)),
      level: 'blocked',
      reason: heavyHaze ? 'heavy_haze_suppresses_aerosol_carrier' : 'aerosol_carrier_not_visible',
      metrics: { aod, pm25, pm10, dust, visibility }
    };
  }

  const aodScore = aod == null ? 0 : scoreRangePeak(aod, 0.06, 0.52, 0.86) * 38;
  const pm25Score = pm25 == null ? 0 : scoreRangePeak(pm25, 8, 45, 85) * 32;
  const pm10Score = pm10 == null ? 0 : scoreRangePeak(pm10, 18, 75, 160) * 28;
  const visibilityHazeScore = hasVisibilityHazeProxy ? scoreRangePeak(visibility, 7, 9, 12) * 60 : 0;
  const dustPenalty = dust != null && dust > 50 ? clamp((dust - 50) / 70, 0, 1) * 10 : 0;
  const visibilityPenalty = visibility < 12 ? clamp((12 - visibility) / 4, 0, 1) * 12 : 0;

  const rawScore = clamp(Math.max(aodScore, pm25Score, pm10Score, visibilityHazeScore) - dustPenalty - visibilityPenalty, 0, 38);
  const cloudPathActivation = clamp((lightPath - 45) / 35, 0, 1);
  const hasModerateAerosol = rawScore >= 14 && visibility >= 8 && lowClouds < 40;
  const aerosolScatteringActivation = hasModerateAerosol ? 0.82 : 0;
  const lightPathActivation = Math.max(cloudPathActivation, aerosolScatteringActivation);
  const activatedScore = rawScore * lightPathActivation;
  const level = activatedScore >= 30 ? 'warm_disk' : (activatedScore >= 12 ? 'weak_warmth' : 'weak');

  return {
    score: parseFloat(rawScore.toFixed(1)),
    activatedScore: parseFloat(activatedScore.toFixed(1)),
    lightPathActivation: parseFloat(lightPathActivation.toFixed(2)),
    cloudPathActivation: parseFloat(cloudPathActivation.toFixed(2)),
    aerosolScatteringActivation: parseFloat(aerosolScatteringActivation.toFixed(2)),
    level,
    reason: activatedScore >= 12
      ? (aerosolScatteringActivation > cloudPathActivation ? 'aerosol_carrier_activated_by_clear_air_scattering' : 'aerosol_carrier_activated_by_light_path')
      : 'aerosol_carrier_too_weak',
    metrics: { aod, pm25, pm10, dust, visibility }
  };
}

function getSolarDirectionSampleWeight(sample, index) {
  const distanceKey = Math.round(Number(sample?.distanceKm));
  if (Number.isFinite(distanceKey) && SOLAR_DIRECTION_SAMPLE_WEIGHT_BY_DISTANCE[distanceKey] != null) {
    return SOLAR_DIRECTION_SAMPLE_WEIGHT_BY_DISTANCE[distanceKey];
  }
  return SOLAR_DIRECTION_SAMPLE_WEIGHTS[index] || 0.1;
}

function getVisibleCarrierSampleWeight(sample, index) {
  const distanceKey = Math.round(Number(sample?.distanceKm));
  if (Number.isFinite(distanceKey) && VISIBLE_CARRIER_SAMPLE_WEIGHT_BY_DISTANCE[distanceKey] != null) {
    return VISIBLE_CARRIER_SAMPLE_WEIGHT_BY_DISTANCE[distanceKey];
  }
  return VISIBLE_CARRIER_SAMPLE_WEIGHTS[index] || 0.1;
}

function scoreVisibleSectorAzimuthFactor(offsetDeg) {
  const offset = Math.abs(Number(offsetDeg) || 0);
  if (offset < 0.001) return 0.72;
  if (offset <= 22) return 1;
  if (offset <= 35) return 1 - smoothStep(22, 35, offset) * 0.10;
  return clamp(0.90 - smoothStep(35, 55, offset) * 0.45, 0.45, 0.90);
}

function scoreVisibleSectorElevationFactor(distanceKm, layerHeightKm) {
  const distance = Math.max(Number(distanceKm) || 0, 1);
  const height = Math.max(Number(layerHeightKm) || 0, 0.1);
  const elevationDeg = Math.atan(height / distance) * 180 / Math.PI;
  const horizonLift = smoothStep(1.5, 4.5, elevationDeg);
  const overheadPenalty = 1 - smoothStep(24, 48, elevationDeg) * 0.38;
  return {
    elevationDeg,
    factor: clamp(horizonLift * overheadPenalty, 0.18, 1)
  };
}

function scoreVisibleSectorAirFactor(weatherData = {}, visibility = 20) {
  const humidity = Number(weatherData.humidity ?? 55);
  const aod = Number(weatherData.aerosolOpticalDepth ?? weatherData.aod ?? 0.18);
  const pm25 = Number(weatherData.pm2_5 ?? weatherData.pm25 ?? 25);
  const pm10 = Number(weatherData.pm10 ?? 35);

  const visibilityFactor = clamp(0.62 + smoothStep(6, 24, Number(visibility) || 0) * 0.38, 0.62, 1);
  const humidityFactor = clamp(1 - Math.max(0, humidity - 75) / 25 * 0.20, 0.80, 1);
  const aodFactor = clamp(1 - Math.max(0, aod - 0.18) / 0.42 * 0.26, 0.74, 1);
  const pmFactor = clamp(1 - Math.max(0, Math.max(pm25 - 35, pm10 - 70) / 80) * 0.18, 0.82, 1);
  return clamp(visibilityFactor * humidityFactor * aodFactor * pmFactor, 0.45, 1);
}

function scoreVisibleSectorPathFactor(lightPath) {
  return clamp(0.62 + smoothStep(45, 82, Number(lightPath) || 0) * 0.38, 0.62, 1);
}

function isDirectionalCorridorBlocked(reason = '') {
  return reason.includes('blocked_corridor') || reason.includes('cloud_wall');
}

function buildLocalVisibleCarrierSample(weatherData = {}) {
  return {
    distanceKm: 0,
    lowCloud: Number(weatherData.lowClouds ?? weatherData.lowCloudCover ?? 0),
    midCloud: Number(weatherData.midClouds ?? 0),
    highCloud: Number(weatherData.highClouds ?? 0),
    totalCloud: Number(weatherData.cloudCover ?? 0)
  };
}

function scoreDirectionalCurtainCarrier(remoteCloudData, lightPathScore = {}, weatherData = {}) {
  const remoteSamples = Array.isArray(remoteCloudData?.samples)
    ? remoteCloudData.samples.filter(sample => sample && !sample.error)
    : [];
  if (remoteSamples.length < 4) {
    return { applied: false, score: 0, floor: null, reason: 'no_directional_samples' };
  }

  const directionalReason = lightPathScore?.directionalAnalysis?.reason || '';
  if (isDirectionalCorridorBlocked(directionalReason)) {
    return { applied: false, score: 0, floor: null, reason: 'directional_blocked_corridor' };
  }

  const samples = [buildLocalVisibleCarrierSample(weatherData), ...remoteSamples];
  const totalWeight = samples.reduce((sum, sample, index) => sum + getVisibleCarrierSampleWeight(sample, index), 0);
  const avg = (key) => samples.reduce((sum, sample, index) => (
    sum + Number(sample[key] || 0) * getVisibleCarrierSampleWeight(sample, index)
  ), 0) / totalWeight;

  const low = avg('lowCloud');
  const mid = avg('midCloud');
  const high = avg('highCloud');
  const midSignal = upperCloudSignal(mid);
  const highSignal = upperCloudSignal(high);
  const upperSignal = clamp(highSignal * 0.9 + midSignal * 0.75, 0, 100);
  const lowMidBlock = low * 0.75 + mid * 0.20;
  const lightPath = Number(lightPathScore?.score ?? 0);
  const precipitation = Number(weatherData.precipitation ?? weatherData.rain ?? weatherData.showers ?? 0);
  const visibility = Number(weatherData.visibility ?? 20);
  const hasDirectionalOpening = directionalReason.includes('opening');
  const hasOpenPath = hasDirectionalOpening || lightPath >= 65;

  if (upperSignal < 18 || (!hasDirectionalOpening && lightPath < 55) || precipitation > 1 || visibility < 6) {
    return {
      applied: false,
      score: 0,
      floor: null,
      reason: upperSignal < 18 ? 'directional_upper_cloud_too_weak' : ((!hasDirectionalOpening && lightPath < 55) ? 'light_path_not_open' : (visibility < 6 ? 'visibility_blocks_directional_curtain' : 'precipitation_blocks_directional_curtain')),
      metrics: {
        low: parseFloat(low.toFixed(1)),
        mid: parseFloat(mid.toFixed(1)),
        high: parseFloat(high.toFixed(1)),
        midSignal: parseFloat(midSignal.toFixed(1)),
        highSignal: parseFloat(highSignal.toFixed(1)),
        upperSignal: parseFloat(upperSignal.toFixed(1)),
        lowMidBlock: parseFloat(lowMidBlock.toFixed(1)),
        visibility
      }
    };
  }

  let score = 20 + (Math.min(upperSignal, 80) - 18) / 62 * 38;
  if (upperSignal > 80) {
    score += Math.min((upperSignal - 80) / 20 * 4, 4);
  }
  if (lowMidBlock > 28) {
    score -= Math.min((lowMidBlock - 28) / 32 * 14, 14);
  }
  if (precipitation > 0.2) {
    score *= 0.85;
  }

  // A common Beijing sunset pattern: the user's visible cloud canvas is not
  // overhead, but in the solar-direction corridor. If the path is open and
  // weighted mid cloud is substantial, treat it as a local visible carrier,
  // while still limiting it below widespread high-cloud eruptions.
  const directionalMidGlow = hasOpenPath && mid >= 44 && high < 20 && lowMidBlock <= 36 && visibility >= 10;
  if (directionalMidGlow) {
    const lightPathBonus = Math.max(0, Math.min((lightPath - 65) / 20 * 5, 5));
    const midGlowScore = 56 + Math.min((mid - 44) / 26 * 6, 6) + lightPathBonus;
    score = Math.min(Math.max(score, midGlowScore), 60);
  }

  score = parseFloat(clamp(score, 0, 62).toFixed(1));
  const floor = directionalMidGlow
    ? (lowMidBlock >= 32 ? 46 : 52)
    : (score >= 42
      ? (lowMidBlock >= 38 ? 30 : 35)
      : (score >= 30 ? 24 : null));

  return {
    applied: score >= 24,
    score,
    floor,
    reason: directionalMidGlow ? 'solar_direction_mid_cloud_glow_carrier' : (floor != null ? 'solar_direction_curtain_carrier' : 'directional_curtain_weak'),
    metrics: {
      low: parseFloat(low.toFixed(1)),
      mid: parseFloat(mid.toFixed(1)),
      high: parseFloat(high.toFixed(1)),
      midSignal: parseFloat(midSignal.toFixed(1)),
      highSignal: parseFloat(highSignal.toFixed(1)),
      upperSignal: parseFloat(upperSignal.toFixed(1)),
      lowMidBlock: parseFloat(lowMidBlock.toFixed(1)),
      lightPath: Number.isFinite(lightPath) ? parseFloat(lightPath.toFixed(1)) : null,
      visibility,
      directionalMidGlow
    },
    sampleWeights: samples.map((sample, index) => ({
      distanceKm: sample.distanceKm,
      weight: parseFloat(getVisibleCarrierSampleWeight(sample, index).toFixed(2))
    }))
  };
}

function scoreRemoteLayerCarriers(remoteCloudData, lightPathScore = {}, weatherData = {}) {
  const remoteSamples = Array.isArray(remoteCloudData?.samples)
    ? remoteCloudData.samples.filter(sample => sample && !sample.error)
    : [];
  if (remoteSamples.length < 4) {
    return { applied: false, reason: 'no_directional_samples', metrics: null };
  }

  const directionalReason = lightPathScore?.directionalAnalysis?.reason || '';
  if (isDirectionalCorridorBlocked(directionalReason)) {
    return { applied: false, reason: 'directional_blocked_corridor', metrics: null };
  }

  const precipitation = Number(weatherData.precipitation ?? weatherData.rain ?? weatherData.showers ?? 0);
  const recentPrecipitation6h = Number(weatherData.recentPrecipitation6h ?? 0);
  const recentRainHours = Number(weatherData.recentRainHours ?? 0);
  const humidity = Number(weatherData.humidity ?? 0);
  const waterVapour = Number(weatherData.waterVapourColumn);
  const wetVeil = precipitation > 0.2
    || recentPrecipitation6h >= 0.5
    || recentRainHours >= 2
    || (precipitation > 0 && humidity >= 86)
    || (precipitation > 0 && Number.isFinite(waterVapour) && waterVapour >= 34);
  if (wetVeil) {
    return { applied: false, reason: 'wet_veil_blocks_remote_carrier', metrics: null };
  }

  const totalWeight = remoteSamples.reduce((sum, sample, index) => sum + getSolarDirectionSampleWeight(sample, index), 0);
  const avg = (key) => remoteSamples.reduce((sum, sample, index) => (
    sum + Number(sample[key] || 0) * getSolarDirectionSampleWeight(sample, index)
  ), 0) / totalWeight;

  const low = avg('lowCloud');
  const mid = avg('midCloud');
  const high = avg('highCloud');
  const total = avg('totalCloud');
  const midSignal = upperCloudSignal(mid);
  const highSignal = upperCloudSignal(high);
  const lowMidBlock = low * 0.75 + mid * 0.25;
  const lightPath = Number(lightPathScore?.score ?? 0);
  const pathOpen = directionalReason.includes('opening') || lightPath >= 55;
  const upperSignal = clamp(highSignal * 0.9 + midSignal * 0.75, 0, 100);

  return {
    applied: pathOpen && upperSignal >= 18,
    reason: pathOpen ? 'remote_layer_carriers' : 'light_path_not_open',
    remoteHighCarrier: clamp(highSignal * 0.42, 0, 32),
    remoteMidCarrier: clamp(midSignal * 0.30, 0, 24),
    remoteLowBlock: clamp(lowMidBlock, 0, 100),
    metrics: {
      low: parseFloat(low.toFixed(1)),
      mid: parseFloat(mid.toFixed(1)),
      high: parseFloat(high.toFixed(1)),
      total: Number.isFinite(total) ? parseFloat(total.toFixed(1)) : null,
      midSignal: parseFloat(midSignal.toFixed(1)),
      highSignal: parseFloat(highSignal.toFixed(1)),
      upperSignal: parseFloat(upperSignal.toFixed(1)),
      lowMidBlock: parseFloat(lowMidBlock.toFixed(1)),
      lightPath: Number.isFinite(lightPath) ? parseFloat(lightPath.toFixed(1)) : null
    },
    sampleWeights: remoteSamples.map((sample, index) => ({
      distanceKm: sample.distanceKm,
      weight: parseFloat(getSolarDirectionSampleWeight(sample, index).toFixed(2))
    }))
  };
}

function scoreVisibleSectorCarrier(remoteCloudData, lightPathScore = {}, weatherData = {}) {
  const sectorSamples = Array.isArray(remoteCloudData?.visibleSectorSamples)
    ? remoteCloudData.visibleSectorSamples.filter(sample => sample && !sample.error)
    : [];
  if (sectorSamples.length < 8) {
    return { applied: false, score: 0, floor: null, reason: 'no_visible_sector_samples', bestDirection: null, metrics: null };
  }

  const precipitation = Number(weatherData.precipitation ?? weatherData.rain ?? weatherData.showers ?? 0);
  const visibility = Number(weatherData.visibility ?? 20);
  const lightPath = Number(lightPathScore?.score ?? 0);
  const directionalReason = lightPathScore?.directionalAnalysis?.reason || '';
  const pathOpen = directionalReason.includes('opening') || lightPath >= 55;
  if (!pathOpen || precipitation > 1 || visibility < 6) {
    return {
      applied: false,
      score: 0,
      floor: null,
      reason: !pathOpen ? 'light_path_not_open' : (visibility < 6 ? 'visibility_blocks_visible_sector' : 'precipitation_blocks_visible_sector'),
      bestDirection: null,
      metrics: { lightPath: Number.isFinite(lightPath) ? parseFloat(lightPath.toFixed(1)) : null, visibility }
    };
  }

  const byOffset = new Map();
  sectorSamples.forEach((sample) => {
    const offset = Number(sample.offsetDeg ?? 0);
    const key = Number.isFinite(offset) ? offset : 0;
    if (!byOffset.has(key)) byOffset.set(key, []);
    byOffset.get(key).push(sample);
  });

  const pathFactor = scoreVisibleSectorPathFactor(lightPath);
  const airFactor = scoreVisibleSectorAirFactor(weatherData, visibility);

  const directionScores = Array.from(byOffset.entries()).map(([offsetDeg, samples]) => {
    if (samples.length < 4) {
      return {
        offsetDeg,
        bearing: Number(samples[0]?.sectorBearing ?? samples[0]?.bearing ?? null),
        score: 0,
        low: 0,
        mid: 0,
        high: 0,
        total: null,
        midSignal: 0,
        highSignal: 0,
        upperSignal: 0,
        lowMidBlock: 100,
        azimuthFactor: scoreVisibleSectorAzimuthFactor(offsetDeg),
        pathFactor,
        airFactor,
        illuminationFactor: 0,
        midIlluminated: 0,
        highIlluminated: 0,
        sampleCount: samples.length,
        weakReason: 'insufficient_direction_samples'
      };
    }
    const totalWeight = samples.reduce((sum, sample, index) => sum + getSolarDirectionSampleWeight(sample, index), 0);
    const avg = (key) => samples.reduce((sum, sample, index) => (
      sum + Number(sample[key] || 0) * getSolarDirectionSampleWeight(sample, index)
    ), 0) / totalWeight;
    const avgIlluminated = (key, layerHeightKm, layerWeight) => samples.reduce((sum, sample, index) => {
      const cloud = upperCloudSignal(Number(sample[key] || 0));
      const elevation = scoreVisibleSectorElevationFactor(sample.distanceKm, layerHeightKm);
      const sampleWeight = getSolarDirectionSampleWeight(sample, index);
      return sum + cloud * elevation.factor * layerWeight * sampleWeight;
    }, 0) / totalWeight;

    const low = avg('lowCloud');
    const mid = avg('midCloud');
    const high = avg('highCloud');
    const total = avg('totalCloud');
    const midSignal = upperCloudSignal(mid);
    const highSignal = upperCloudSignal(high);
    const azimuthFactor = scoreVisibleSectorAzimuthFactor(offsetDeg);
    const midIlluminated = avgIlluminated('midCloud', VISIBLE_SECTOR_LAYER_HEIGHT_KM.mid, 0.88);
    const highIlluminated = avgIlluminated('highCloud', VISIBLE_SECTOR_LAYER_HEIGHT_KM.high, 1.00);
    const illuminationFactor = clamp(azimuthFactor * pathFactor * airFactor, 0, 1.05);
    const upperSignal = clamp((highIlluminated * 0.90 + midIlluminated * 0.82) * illuminationFactor, 0, 100);
    const lowMidBlock = low * 0.75 + mid * 0.20;

    let score = 0;
    if (upperSignal >= 18 && lowMidBlock <= 55) {
      score = 24 + (Math.min(upperSignal, 88) - 18) / 70 * 34;
      if (upperSignal > 88) score += Math.min((upperSignal - 88) / 12 * 4, 4);
      if (lowMidBlock > 28) score -= Math.min((lowMidBlock - 28) / 27 * 16, 16);
    }

    return {
      offsetDeg,
      bearing: Number(samples[0]?.sectorBearing ?? samples[0]?.bearing ?? null),
      score: clamp(score, 0, 62),
      low,
      mid,
      high,
      total,
      midSignal,
      highSignal,
      upperSignal,
      lowMidBlock,
      azimuthFactor,
      pathFactor,
      airFactor,
      illuminationFactor,
      midIlluminated,
      highIlluminated,
      sampleCount: samples.length
    };
  });

  const best = directionScores.reduce((winner, item) => (!winner || item.score > winner.score) ? item : winner, null);
  if (!best || best.score < 24) {
    return {
      applied: false,
      score: parseFloat((best?.score || 0).toFixed(1)),
      floor: null,
      reason: 'visible_sector_carrier_weak',
      bestDirection: best?.bearing == null ? null : {
        offsetDeg: best.offsetDeg,
        bearing: parseFloat(best.bearing.toFixed(1))
      },
      metrics: best ? {
        upperSignal: parseFloat(best.upperSignal.toFixed(1)),
        lowMidBlock: parseFloat(best.lowMidBlock.toFixed(1)),
        illuminationFactor: parseFloat(best.illuminationFactor.toFixed(2)),
        lightPath: Number.isFinite(lightPath) ? parseFloat(lightPath.toFixed(1)) : null
      } : null,
      directions: directionScores.map(item => ({
        offsetDeg: item.offsetDeg,
        bearing: Number.isFinite(item.bearing) ? parseFloat(item.bearing.toFixed(1)) : null,
        score: parseFloat(item.score.toFixed(1)),
        upperSignal: parseFloat(item.upperSignal.toFixed(1)),
        lowMidBlock: parseFloat(item.lowMidBlock.toFixed(1)),
        illuminationFactor: parseFloat(item.illuminationFactor.toFixed(2)),
        weakReason: item.weakReason || null
      }))
    };
  }

  const score = parseFloat(clamp(best.score, 0, 62).toFixed(1));
  return {
    applied: true,
    score,
    floor: best.lowMidBlock >= 38 ? 28 : 34,
    reason: 'visible_sunset_sector_carrier',
    bestDirection: {
      offsetDeg: best.offsetDeg,
      bearing: Number.isFinite(best.bearing) ? parseFloat(best.bearing.toFixed(1)) : null
    },
    metrics: {
      low: parseFloat(best.low.toFixed(1)),
      mid: parseFloat(best.mid.toFixed(1)),
      high: parseFloat(best.high.toFixed(1)),
      total: Number.isFinite(best.total) ? parseFloat(best.total.toFixed(1)) : null,
      midSignal: parseFloat(best.midSignal.toFixed(1)),
      highSignal: parseFloat(best.highSignal.toFixed(1)),
      upperSignal: parseFloat(best.upperSignal.toFixed(1)),
      lowMidBlock: parseFloat(best.lowMidBlock.toFixed(1)),
      azimuthFactor: parseFloat(best.azimuthFactor.toFixed(2)),
      pathFactor: parseFloat(best.pathFactor.toFixed(2)),
      airFactor: parseFloat(best.airFactor.toFixed(2)),
      illuminationFactor: parseFloat(best.illuminationFactor.toFixed(2)),
      midIlluminated: parseFloat(best.midIlluminated.toFixed(1)),
      highIlluminated: parseFloat(best.highIlluminated.toFixed(1)),
      lightPath: Number.isFinite(lightPath) ? parseFloat(lightPath.toFixed(1)) : null,
      visibility
    },
    directions: directionScores.map(item => ({
      offsetDeg: item.offsetDeg,
      bearing: Number.isFinite(item.bearing) ? parseFloat(item.bearing.toFixed(1)) : null,
      score: parseFloat(item.score.toFixed(1)),
      upperSignal: parseFloat(item.upperSignal.toFixed(1)),
      lowMidBlock: parseFloat(item.lowMidBlock.toFixed(1)),
      illuminationFactor: parseFloat(item.illuminationFactor.toFixed(2)),
      weakReason: item.weakReason || null
    }))
  };
}

function buildCarrierScore(canvasScore, aerosolCarrierScore, directionalCurtainCarrier = null, remoteLayerCarriers = null, visibleSectorCarrier = null) {
  const cloudScore = Number(canvasScore?.score ?? 0);
  const aerosolScore = Number(aerosolCarrierScore?.activatedScore ?? 0);
  const directionalScore = directionalCurtainCarrier?.applied ? Number(directionalCurtainCarrier.score || 0) : 0;
  const remoteScore = remoteLayerCarriers?.applied
    ? Math.max(
      Number(remoteLayerCarriers.remoteHighCarrier || 0),
      Number(remoteLayerCarriers.remoteMidCarrier || 0)
    )
    : 0;
  const visibleSectorScore = visibleSectorCarrier?.applied ? Number(visibleSectorCarrier.score || 0) : 0;
  const maxScore = Math.max(cloudScore, aerosolScore, directionalScore, remoteScore, visibleSectorScore);
  const activeCarrier = maxScore === directionalScore && directionalScore > cloudScore && directionalScore >= aerosolScore
    ? 'directional_curtain'
    : (maxScore === visibleSectorScore && visibleSectorScore > cloudScore && visibleSectorScore >= aerosolScore ? 'visible_sector'
      : (maxScore === remoteScore && remoteScore > cloudScore && remoteScore >= aerosolScore ? 'remote_layer' : (aerosolScore > cloudScore ? 'aerosol' : 'cloud')));

  return {
    ...canvasScore,
    score: parseFloat(maxScore.toFixed(1)),
    cloudCanvasScore: parseFloat(cloudScore.toFixed(1)),
    aerosolCarrierScore,
    directionalCurtainCarrier,
    remoteLayerCarriers,
    visibleSectorCarrier,
    activeCarrier
  };
}

/**
 * 灰幕/沙尘封顶：高云存在但空气光学条件失效时，不能按“高云画布”给乐观分。
 */
function assessAerosolHazeCap(weatherData, context = {}) {
  const lowClouds = weatherData.lowClouds || 0;
  const highClouds = weatherData.highClouds || 0;
  const midClouds = weatherData.midClouds || 0;
  const visibility = weatherData.visibility ?? 20;
  const { aod, pm25, pm10, dust } = getAerosolMetrics(weatherData);
  const pathOpen = context.pathOpen === true;
  const scoringAirMode = context.airMode || null;

  const hasUpperCloudCarrier = (highClouds >= 65 || (midClouds >= 45 && highClouds >= 45)) && lowClouds <= 20;
  const opticalHazeSevere = (aod != null && aod >= 0.55) || (dust != null && dust >= 150) || visibility < 8;
  const particulateSevere = (pm10 != null && pm10 >= 180) || (pm25 != null && pm25 >= 90);
  const transparentPath = visibility >= 12 && (aod == null || aod < 0.55) && (dust == null || dust < 150);
  const extremeHaze = (aod != null && aod >= 0.8) || (dust != null && dust >= 300) || (pm10 != null && pm10 >= 250 && !transparentPath);
  const severeHaze = opticalHazeSevere || (particulateSevere && !transparentPath);
  const wetHazePathOpenMidRendering =
    pathOpen &&
    scoringAirMode === 'wet_haze_path_open_mid_rendering' &&
    visibility >= 10 &&
    (aod == null || aod < 0.7) &&
    (dust == null || dust < 80) &&
    (pm10 == null || pm10 < 150);
  const warmScatteringHaze =
    pathOpen &&
    visibility >= 12 &&
    (aod == null || aod < 0.8) &&
    (pm25 == null || pm25 < 65) &&
    (pm10 == null || pm10 < 120) &&
    (dust == null || dust < 150);
  const moderateHaze = (aod != null && aod >= 0.45) || (dust != null && dust >= 80) || (pm10 != null && pm10 >= 120) || visibility < 8;

  if (hasUpperCloudCarrier && extremeHaze) {
    return { applied: true, cap: 28, level: 'extreme', reason: 'extreme_dust_haze_cap_28', metrics: { aod, pm25, pm10, dust, visibility } };
  }

  if (hasUpperCloudCarrier && severeHaze && wetHazePathOpenMidRendering) {
    return { applied: false, cap: null, level: 'wet_haze_mid', reason: 'wet_haze_path_open_mid_rendering', metrics: { aod, pm25, pm10, dust, visibility } };
  }

  if (hasUpperCloudCarrier && severeHaze && warmScatteringHaze) {
    return { applied: false, cap: null, level: 'warm_scattering', reason: 'haze_warm_scattering_path_open', metrics: { aod, pm25, pm10, dust, visibility } };
  }

  if (hasUpperCloudCarrier && severeHaze) {
    return { applied: true, cap: 35, level: 'severe', reason: 'severe_haze_cap_35', metrics: { aod, pm25, pm10, dust, visibility } };
  }

  if (hasUpperCloudCarrier && moderateHaze) {
    if (pathOpen && transparentPath) {
      return { applied: false, cap: null, level: 'moderate_transparent', reason: 'transparent_path_particulate_damping_only', metrics: { aod, pm25, pm10, dust, visibility } };
    }
    return { applied: true, cap: 45, level: 'moderate', reason: 'moderate_haze_cap_45', metrics: { aod, pm25, pm10, dust, visibility } };
  }

  return { applied: false, cap: null, level: null, reason: null, metrics: { aod, pm25, pm10, dust, visibility } };
}

function assessVisibleSunsetSectorCap(weatherData, carrierScore, lightPathScore, lightPathGate, remoteCloudData = null) {
  const lowClouds = Number(weatherData.lowClouds || 0);
  const midClouds = Number(weatherData.midClouds || 0);
  const highClouds = Number(weatherData.highClouds || 0);
  const cloudCarrier = Number(carrierScore?.score ?? 0);
  const pathScore = Number(lightPathScore?.score ?? 0);
  const pathGate = Number(lightPathGate?.gate ?? 0);
  const directionalReason = lightPathScore?.directionalAnalysis?.reason || lightPathGate?.reason || '';
  const pathOpen = pathGate >= 0.85 || directionalReason.includes('opening');
  const localUpperCarrier = highClouds * 0.65 + midClouds * 0.35;
  // Current directional samples start at 25 km. Use the first three points as a
  // visible-sector proxy; a future sampling revision should add a 10-15 km
  // point for foreground western clouds without changing this cap's semantics.
  const samples = Array.isArray(remoteCloudData?.samples)
    ? remoteCloudData.samples.filter(sample => sample && !sample.error).slice(0, 3)
    : [];
  const sectorUpperCarrier = samples.length > 0
    ? samples.reduce((sum, sample) => (
      sum + Number(sample.highCloud || 0) * 0.65 + Number(sample.midCloud || 0) * 0.35
    ), 0) / samples.length
    : 0;
  const visibleSectorCarrier = Math.max(localUpperCarrier, sectorUpperCarrier);
  const metrics = {
    localUpperCarrier: parseFloat(localUpperCarrier.toFixed(1)),
    sectorUpperCarrier: parseFloat(sectorUpperCarrier.toFixed(1)),
    visibleSectorCarrier: parseFloat(visibleSectorCarrier.toFixed(1)),
    pathScore: Number.isFinite(pathScore) ? parseFloat(pathScore.toFixed(1)) : null,
    pathGate: Number.isFinite(pathGate) ? parseFloat(pathGate.toFixed(2)) : null
  };

  if (!pathOpen || lowClouds > 25 || pathScore < 65 || cloudCarrier < 65) {
    return { applied: false, cap: null, reason: null, metrics };
  }

  if (visibleSectorCarrier >= 70) {
    return { applied: false, cap: null, reason: 'visible_sunset_sector_participation_sufficient', metrics };
  }

  return {
    applied: true,
    cap: visibleSectorCarrier >= 50 ? 68 : 66,
    reason: 'visible_sunset_sector_cap',
    metrics
  };
}

function assessWarmScatteringUpperCarrierAdjustment(weatherData, carrierScore, lightPathScore, lightPathGate, remoteCloudData = null, context = {}) {
  if (context.scoringContext === 'map_grid_simplified') {
    return { applied: false, reason: 'map_grid_simplified_no_point_carrier_lift' };
  }

  const lowClouds = Number(weatherData.lowClouds || 0);
  const midClouds = Number(weatherData.midClouds || 0);
  const highClouds = Number(weatherData.highClouds || 0);
  const visibility = Number(weatherData.visibility ?? 20);
  const precipitation = Number(weatherData.precipitation ?? weatherData.rain ?? weatherData.showers ?? 0);
  const cloudCarrier = clamp(Number(carrierScore?.score ?? 0), 0, 100);
  const pathScore = clamp(Number(lightPathScore?.score ?? 0), 0, 100);
  const pathGate = clamp(Number(lightPathGate?.gate ?? 0), 0, 1.12);
  const directionalReason = lightPathScore?.directionalAnalysis?.reason || lightPathGate?.reason || '';
  const pathOpen = pathGate >= 0.85 || directionalReason.includes('opening');
  const { aod, pm25, pm10, dust } = getAerosolMetrics(weatherData);
  const upperCloudCarrier = highClouds * 0.65 + midClouds * 0.35;
  const moderateWarmAir =
    visibility >= 12 &&
    (aod != null && aod >= 0.45 && aod < 0.8) &&
    (pm25 == null || pm25 < 65) &&
    (pm10 == null || pm10 < 120) &&
    (dust == null || dust < 150);
  const samples = Array.isArray(remoteCloudData?.samples)
    ? remoteCloudData.samples.filter(sample => sample && !sample.error)
    : [];
  const nearSamples = samples.filter(sample => Number(sample.distanceKm) <= 25);
  const nearUpperCarrier = nearSamples.length > 0
    ? nearSamples.reduce((sum, sample) => (
      sum + Number(sample.highCloud || 0) * 0.65 + Number(sample.midCloud || 0) * 0.35
    ), 0) / nearSamples.length
    : 0;
  const directionalUpperCarrier = Number(lightPathScore?.directionalAnalysis?.upperSignal ?? 0);

  if (
    pathOpen &&
    lowClouds <= 10 &&
    precipitation <= 0.2 &&
    upperCloudCarrier >= 90 &&
    pathScore >= 85 &&
    moderateWarmAir &&
    (nearUpperCarrier >= 70 || directionalUpperCarrier >= 80)
  ) {
    const adjustedCarrier = Math.max(cloudCarrier, 63.2);
    return {
      applied: adjustedCarrier > cloudCarrier,
      reason: adjustedCarrier > cloudCarrier ? 'full_upper_cloud_warm_scattering_participation' : 'carrier_already_sufficient',
      originalCarrier: parseFloat(cloudCarrier.toFixed(1)),
      adjustedCarrier: parseFloat(adjustedCarrier.toFixed(1)),
      metrics: {
        localUpperCarrier: parseFloat(upperCloudCarrier.toFixed(1)),
        nearUpperCarrier: parseFloat(nearUpperCarrier.toFixed(1)),
        directionalUpperCarrier: Number.isFinite(directionalUpperCarrier) ? parseFloat(directionalUpperCarrier.toFixed(1)) : null,
        pathScore: parseFloat(pathScore.toFixed(1)),
        pathGate: parseFloat(pathGate.toFixed(2)),
        aod,
        pm25,
        pm10,
        dust,
        visibility
      }
    };
  }

  return {
    applied: false,
    reason: 'full_upper_cloud_warm_scattering_not_matched',
    metrics: {
      localUpperCarrier: parseFloat(upperCloudCarrier.toFixed(1)),
      nearUpperCarrier: parseFloat(nearUpperCarrier.toFixed(1)),
      directionalUpperCarrier: Number.isFinite(directionalUpperCarrier) ? parseFloat(directionalUpperCarrier.toFixed(1)) : null,
      pathScore: parseFloat(pathScore.toFixed(1)),
      pathGate: parseFloat(pathGate.toFixed(2))
    }
  };
}

function normalizeRange(value, min, max) {
  if (!Number.isFinite(value) || value <= min) return 0;
  if (value >= max) return 1;
  return (value - min) / (max - min);
}

function assessGrayVeilAirRendering(weatherData, remoteCloudData = null) {
  const lowClouds = Number(weatherData.lowClouds || 0);
  const midClouds = Number(weatherData.midClouds || 0);
  const highClouds = Number(weatherData.highClouds || 0);
  const visibility = Number(weatherData.visibility ?? 20);
  const waterVapour = Number(weatherData.waterVapourColumn);
  const { aod, pm25, pm10, dust } = getAerosolMetrics(weatherData);
  const localUpperCarrier = highClouds * 0.65 + midClouds * 0.35;
  const samples = Array.isArray(remoteCloudData?.samples)
    ? remoteCloudData.samples.filter(sample => sample && !sample.error)
    : [];
  const sampleUpperCarriers = samples.map(sample => (
    Number(sample.highCloud || 0) * 0.65 + Number(sample.midCloud || 0) * 0.35
  ));
  const sampleTotalClouds = samples.map(sample => Number(sample.totalCloud || 0));
  const remoteUpperCarrier = sampleUpperCarriers.length > 0
    ? sampleUpperCarriers.reduce((sum, value) => sum + value, 0) / sampleUpperCarriers.length
    : 0;
  const remoteTotalCloud = sampleTotalClouds.length > 0
    ? sampleTotalClouds.reduce((sum, value) => sum + value, 0) / sampleTotalClouds.length
    : 0;
  const transparentPath = visibility >= 12 && (aod == null || aod < 0.55) && (dust == null || dust < 150);
  const transparentParticulateRelief =
    transparentPath &&
    (!Number.isFinite(waterVapour) || waterVapour < 32) &&
    remoteTotalCloud < 92;
  const fullVeilPressure = Math.min(
    normalizeRange(localUpperCarrier, 82, 98),
    samples.length >= 4 ? normalizeRange(remoteUpperCarrier, 78, 94) : 0,
    samples.length >= 4 ? normalizeRange(remoteTotalCloud, 90, 98) : 0
  );
  const opticalPollutionPressure = Math.max(
    aod == null ? 0 : normalizeRange(aod, 0.30, 0.52),
    dust == null ? 0 : normalizeRange(dust, 80, 160),
    visibility < 12 ? normalizeRange(12 - visibility, 0, 6) : 0
  );
  const particulatePressure = Math.max(
    pm25 == null ? 0 : normalizeRange(pm25, 55, 95),
    pm10 == null ? 0 : normalizeRange(pm10, 75, 170)
  );
  const pollutionPressure = transparentParticulateRelief
    ? Math.max(opticalPollutionPressure, particulatePressure * 0.35)
    : Math.max(opticalPollutionPressure, particulatePressure);
  const grayVeilPressure = fullVeilPressure * pollutionPressure;
  const factor = parseFloat((1 - grayVeilPressure * 0.38).toFixed(2));
  return {
    applied: lowClouds <= 20 && grayVeilPressure >= 0.25,
    factor: clamp(factor, 0.62, 1),
    pressure: parseFloat(grayVeilPressure.toFixed(2)),
    reason: 'full_upper_cloud_gray_veil_air_rendering',
    metrics: {
      localUpperCarrier: parseFloat(localUpperCarrier.toFixed(1)),
      remoteUpperCarrier: samples.length ? parseFloat(remoteUpperCarrier.toFixed(1)) : null,
      remoteTotalCloud: samples.length ? parseFloat(remoteTotalCloud.toFixed(1)) : null,
      fullVeilPressure: parseFloat(fullVeilPressure.toFixed(2)),
      pollutionPressure: parseFloat(pollutionPressure.toFixed(2)),
      aod,
      pm25,
      pm10,
      dust,
      visibility
    }
  };
}

function assessSunsetScoringV2(weatherData, carrierScore, lightPathScore, lightPathGate, renderingFactor, remoteCloudData = null, context = {}) {
  const lowClouds = Number(weatherData.lowClouds || 0);
  const midClouds = Number(weatherData.midClouds || 0);
  const highClouds = Number(weatherData.highClouds || 0);
  const visibility = Number(weatherData.visibility ?? 20);
  const precipitation = Number(weatherData.precipitation ?? weatherData.rain ?? weatherData.showers ?? 0);
  const recentRainSignal = Number(weatherData.recentRainSignal ?? 0);
  const recentPrecipitation6h = Number(weatherData.recentPrecipitation6h ?? 0);
  const humidity = Number(weatherData.humidity ?? 55);
  const waterVapour = Number(weatherData.waterVapourColumn);
  const { aod, pm25, pm10, dust } = getAerosolMetrics(weatherData);

  let cloudCarrier = clamp(Number(carrierScore?.score ?? 0), 0, 100);
  const pathScore = clamp(Number(lightPathScore?.score ?? 0), 0, 100);
  const pathGate = clamp(Number(lightPathGate?.gate ?? 0), 0, 1.12);
  const directionalReason = lightPathScore?.directionalAnalysis?.reason || lightPathGate?.reason || '';
  const pathOpen = pathGate >= 0.85 || directionalReason.includes('opening');
  const pathBlocked = pathGate <= 0.45 || isDirectionalCorridorBlocked(directionalReason);
  const upperCloudCarrier = highClouds * 0.65 + midClouds * 0.35;
  const cloudCanReceiveLight = upperCloudCarrier >= 45 && lowClouds <= 35;
  const transparentPath = visibility >= 12 && (aod == null || aod < 0.55) && (dust == null || dust < 150);
  const heavyAir =
    visibility < 8 ||
    (aod != null && aod >= 0.8) ||
    (dust != null && dust >= 150) ||
    (!transparentPath && ((pm25 != null && pm25 >= 90) || (pm10 != null && pm10 >= 180)));
  const moderateAir =
    (aod != null && aod >= 0.45) ||
    (pm25 != null && pm25 >= 25) ||
    (pm10 != null && pm10 >= 70) ||
    (dust != null && dust >= 70);
  const extremeAir =
    visibility < 4 ||
    (aod != null && aod >= 1.1) ||
    (dust != null && dust >= 180) ||
    (!transparentPath && ((pm25 != null && pm25 >= 120) || (pm10 != null && pm10 >= 220)));
  const hardRain = precipitation > 1.0;
  const softRainOrWetVeil = precipitation > 0.2 || (recentRainSignal >= 0.75 && recentPrecipitation6h >= 1.5);
  const hardBlocked = hardRain || lowClouds >= 60 || pathBlocked || extremeAir;
  const softBlocked = !hardBlocked && (softRainOrWetVeil || visibility < 6);
  const grayVeilAirRendering = assessGrayVeilAirRendering(weatherData, remoteCloudData);
  const pathOpenWetHaze =
    pathOpen &&
    cloudCanReceiveLight &&
    !hardBlocked &&
    lowClouds <= 30 &&
    visibility >= 5 &&
    (
      visibility <= 10 ||
      humidity >= 88 ||
      (Number.isFinite(waterVapour) && waterVapour >= 40)
    ) &&
    (
      (aod != null && aod >= 0.65) ||
      (pm25 != null && pm25 >= 60) ||
      (pm10 != null && pm10 >= 80)
    ) &&
    !softRainOrWetVeil;

  let airFactor = Number(renderingFactor?.factor ?? 1);
  let airMode = renderingFactor?.breakdown?.specialMode || 'neutral';
  if (pathOpen && cloudCanReceiveLight && grayVeilAirRendering.applied && !heavyAir && !hardBlocked) {
    airFactor = Math.min(airFactor, grayVeilAirRendering.factor);
    airMode = 'gray_veil_air_suppression';
  } else if (pathOpen && cloudCanReceiveLight && moderateAir && !heavyAir && !hardBlocked && !softBlocked) {
    const aerosolWarmth = Math.max(
      aod == null ? 0 : scoreRangePeak(aod, 0.35, 0.62, 0.8),
      pm25 == null ? 0 : scoreRangePeak(pm25, 20, 42, 65),
      pm10 == null ? 0 : scoreRangePeak(pm10, 60, 95, 130),
      dust == null ? 0 : scoreRangePeak(dust, 60, 95, 150)
    );
    airFactor = parseFloat((1.02 + aerosolWarmth * 0.10).toFixed(2));
    airMode = 'warm_scattering_path_open';
  } else if (pathOpenWetHaze) {
    airFactor = Math.max(airFactor, softBlocked ? 0.72 : 0.76);
    airMode = 'wet_haze_path_open_mid_rendering';
  } else if (heavyAir || visibility < 8) {
    airFactor = Math.min(airFactor, 0.75);
    airMode = 'heavy_haze_suppression';
  }

  const warmScatteringUpperCarrierAdjustment = airMode === 'warm_scattering_path_open'
    ? assessWarmScatteringUpperCarrierAdjustment(weatherData, carrierScore, lightPathScore, lightPathGate, remoteCloudData, context)
    : { applied: false, reason: 'air_mode_not_warm_scattering_path_open' };
  if (warmScatteringUpperCarrierAdjustment.applied) {
    cloudCarrier = warmScatteringUpperCarrierAdjustment.adjustedCarrier;
  }

  const pathFactor = pathOpen ? Math.max(1, pathGate) : pathGate;
  const rawScoreBeforeWetHazeFloor = clamp(cloudCarrier * pathFactor * airFactor, 0, 100);
  const wetHazeMidScoreFloor = airMode === 'wet_haze_path_open_mid_rendering'
    ? (softBlocked ? 42 : 46)
    : null;
  const wetHazeMidScoreCap = airMode === 'wet_haze_path_open_mid_rendering' ? 55 : null;
  const rawScoreAfterWetHaze = wetHazeMidScoreFloor == null
    ? rawScoreBeforeWetHazeFloor
    : Math.min(Math.max(rawScoreBeforeWetHazeFloor, wetHazeMidScoreFloor), wetHazeMidScoreCap);
  const grayVeilScoreCap = airMode === 'gray_veil_air_suppression' && grayVeilAirRendering.pressure >= 0.35 ? 45 : null;
  const rawScore = grayVeilScoreCap == null
    ? rawScoreAfterWetHaze
    : Math.min(rawScoreAfterWetHaze, grayVeilScoreCap);
  const visibleSunsetSectorCap = assessVisibleSunsetSectorCap(weatherData, carrierScore, lightPathScore, lightPathGate, remoteCloudData);
  const score = visibleSunsetSectorCap.applied
    ? Math.min(rawScore, visibleSunsetSectorCap.cap)
    : rawScore;
  return {
    applied: !hardBlocked && cloudCanReceiveLight && pathScore >= 50,
    score: parseFloat(score.toFixed(1)),
    rawScore: parseFloat(rawScore.toFixed(1)),
    rawScoreBeforeWetHazeFloor: parseFloat(rawScoreBeforeWetHazeFloor.toFixed(1)),
    grayVeilScoreCap,
    cloudCarrier: parseFloat(cloudCarrier.toFixed(1)),
    pathFactor: parseFloat(pathFactor.toFixed(2)),
    airFactor,
    airMode,
    pathOpen,
    hardBlocked,
    softBlocked,
    grayVeilAirRendering,
    warmScatteringUpperCarrierAdjustment,
    visibleSunsetSectorCap,
    wetHazeMidScoreFloor,
    wetHazeMidScoreCap,
    metrics: {
      upperCloudCarrier: parseFloat(upperCloudCarrier.toFixed(1)),
      lowClouds,
      visibility,
      precipitation,
      recentRainSignal: Number.isFinite(recentRainSignal) ? parseFloat(recentRainSignal.toFixed(2)) : null,
      recentPrecipitation6h: Number.isFinite(recentPrecipitation6h) ? parseFloat(recentPrecipitation6h.toFixed(2)) : null,
      aod,
      pm25,
      pm10,
      dust
    }
  };
}

/**
 * 高云载体保底：高云充足、低云稀少、空气不灰时，避免日落低辐射或水汽信号把分数打穿。
 */
function assessHighCloudCarrierAdjustment(weatherData, aerosolHazeCap, thickHighCloudPenalty = null) {
  const lowClouds = weatherData.lowClouds || 0;
  const midClouds = weatherData.midClouds || 0;
  const highClouds = weatherData.highClouds || 0;
  const visibility = weatherData.visibility ?? 20;
  const precipitation = weatherData.precipitation || 0;

  if (aerosolHazeCap?.applied || thickHighCloudPenalty?.applied || precipitation > 0.2) {
    return { applied: false, floor: null, reason: null };
  }

  const { aod, pm25, pm10, dust } = getAerosolMetrics(weatherData);
  const hasAirQualityMetric = [aod, pm25, pm10, dust].some(value => Number.isFinite(value));
  const airClearEnough = hasAirQualityMetric
    && visibility >= 15
    && (aod == null || aod <= 0.45)
    && (pm25 == null || pm25 < 65)
    && (pm10 == null || pm10 < 120)
    && (dust == null || dust < 80);
  const carrierStrong = ((highClouds >= 85) || (highClouds >= 80 && midClouds >= 30)) && lowClouds <= 10 && airClearEnough;

  if (!carrierStrong) {
    return { applied: false, floor: null, reason: null };
  }

  if (midClouds >= 45 || highClouds >= 95) {
    return { applied: true, floor: 68, reason: 'clear_upper_cloud_carrier_floor_68' };
  }

  if (midClouds >= 30 && highClouds >= 80) {
    return { applied: true, floor: 54, reason: 'clear_upper_cloud_carrier_floor_54' };
  }

  return { applied: true, floor: 64, reason: 'clear_high_cloud_carrier_floor_64' };
}

/**
 * 晴空通透提示：不改变火烧云指数，只在“无云但日落本身通透”的场景调整结论/出门建议。
 */
function assessClearSunsetViewingAdvice(weatherData, canvasScore, lightPathScore, context = {}) {
  const lowClouds = Number(weatherData.lowClouds || 0);
  const midClouds = Number(weatherData.midClouds || 0);
  const highClouds = Number(weatherData.highClouds || 0);
  const upperCloudCover = Number.isFinite(Number(canvasScore?.effectiveCloudCover))
    ? Number(canvasScore.effectiveCloudCover)
    : highClouds * CLOUD_WEIGHTS.HIGH + midClouds * CLOUD_WEIGHTS.MID;
  const visibility = Number(weatherData.visibility ?? 20);
  const precipitation = Number(weatherData.precipitation ?? weatherData.rain ?? weatherData.precipitationProbability ?? 0);
  const lightPath = Number(lightPathScore?.score ?? 0);
  const weatherConditionText = [
    weatherData.weatherMain,
    weatherData.weather,
    weatherData.weatherText,
    weatherData.weatherDescription,
    weatherData.condition
  ].filter(Boolean).join(' ').toLowerCase();
  const overcastText = /(overcast|阴天|陰天|阴|陰)/.test(weatherConditionText);

  const clearSkyCarrierMissing = canvasScore?.cloudLevel === 'space' || upperCloudCover < 12;
  const directionalCarrierApplied = context.directionalCurtainCarrier?.applied === true;
  const visibleSectorCarrierApplied = context.visibleSectorCarrier?.applied === true
    || canvasScore?.activeCarrier === 'visible_sector';
  const hardBlocked =
    context.aerosolHazeCap?.applied ||
    context.severeCap?.reason ||
    context.occlusion?.occluded ||
    context.geometric?.feasible === false ||
    context.postRainAdjustment?.cap != null ||
    overcastText;

  const applied = Boolean(
    clearSkyCarrierMissing &&
    !directionalCarrierApplied &&
    !visibleSectorCarrierApplied &&
    lowClouds <= 20 &&
    precipitation <= 0.2 &&
    visibility >= 15 &&
    lightPath >= 50 &&
    !hardBlocked
  );

  return {
    applied,
    reason: applied ? 'clear_sunset_transparent' : null,
    metrics: {
      upperCloudCover: parseFloat(upperCloudCover.toFixed(1)),
      lowClouds: parseFloat(lowClouds.toFixed(1)),
      visibility: parseFloat(visibility.toFixed(1)),
      precipitation: parseFloat(precipitation.toFixed(2)),
      lightPath: Number.isFinite(lightPath) ? parseFloat(lightPath.toFixed(1)) : null,
      directionalCarrierApplied,
      visibleSectorCarrierApplied
    }
  };
}

// ========== 光路几何模型（需求40，Phase 19 任务67.2）==========

/**
 * 火烧云几何光路模型
 * 来源：sunsetbot.top 火烧云预报教程 章节1.2
 *
 * 公式：
 *   d_max = h_cloud_km / tan(sunAlt_rad)   → 光线能覆盖的最远云底距离
 *   t_duration = h_cloud_km / (v_sun * sin(sunAlt_rad))  → 持续时长(min)
 *   t_start_offset = (d_cloud / v_sun) - t_duration      → 日落后开始时间(min)
 *
 * @param {number} sunAltitudeDeg    - 太阳高度角（度，日落约为 -0.8°）
 * @param {number} cloudBaseKm       - 云底高度（km）
 * @param {number} lat               - 纬度（用于修正 v_sun）
 * @returns {{feasible, cloudBoundaryKm, startOffsetMin, durationMin, sunAltitudeDeg, cloudBaseKm}}
 */
function geometricLightModel(sunAltitudeDeg, cloudBaseKm, lat = 35) {
  // 太阳线速度：纬度修正（cos(lat)），北京(40°N)约 21km/min，赤道约 27.5km/min
  const v_sun = 27.5 * Math.cos(lat * Math.PI / 180);  // km/min

  // 若太阳高度角过高（>15°）或过低（<-6°），几何上无法形成典型火烧云
  if (sunAltitudeDeg > 15 || sunAltitudeDeg < -6) {
    return {
      feasible: false,
      reason: sunAltitudeDeg > 15 ? '太阳高度角过高，非黄昏时段' : '太阳已沉入地平线过深',
      sunAltitudeDeg: parseFloat(sunAltitudeDeg.toFixed(2)),
      cloudBaseKm: parseFloat(cloudBaseKm.toFixed(2)),
      cloudBoundaryKm: null,
      startOffsetMin: null,
      durationMin: null,
      vsun: parseFloat(v_sun.toFixed(1))
    };
  }

  const sunAltRad = sunAltitudeDeg * Math.PI / 180;

  // 避免 tan(0) 除零：高度角绝对值 < 0.1° 时用近似
  const tanAlt = Math.abs(sunAltRad) < 0.00175 ? 0.00175 : Math.tan(Math.abs(sunAltRad));
  const sinAlt = Math.max(Math.abs(Math.sin(sunAltRad)), 0.00175);

  // 最大光路距离（km）
  const d_max = cloudBaseKm / tanAlt;

  // 持续时长（分钟）
  const t_duration = cloudBaseKm / (v_sun * sinAlt);

  // 估算云边界距离：用 d_max 的 60% 作为典型值（无实测云边界时）
  const cloudBoundaryKm = parseFloat((d_max * 0.6).toFixed(1));

  // 开始偏移（日落后多少分钟开始出现火烧云）
  const t_start_raw = (cloudBoundaryKm / v_sun) - t_duration;
  const t_start_offset = parseFloat(Math.max(0, t_start_raw).toFixed(1));

  const feasible = d_max > 10 && t_duration > 0.5;

  return {
    feasible,
    reason: feasible ? '几何条件满足，可能出现火烧云' : '云底太低或距离不足',
    sunAltitudeDeg: parseFloat(sunAltitudeDeg.toFixed(2)),
    cloudBaseKm: parseFloat(cloudBaseKm.toFixed(2)),
    d_maxKm: parseFloat(d_max.toFixed(1)),
    cloudBoundaryKm,
    startOffsetMin: t_start_offset,
    durationMin: parseFloat(t_duration.toFixed(1)),
    vsun: parseFloat(v_sun.toFixed(1))
  };
}

function buildLocalLightPathSamples(weatherData) {
  const baseH = estimateCloudBaseHeight(weatherData);
  const low = weatherData.lowClouds || 0;
  const mid = weatherData.midClouds || 0;
  const high = weatherData.highClouds || 0;

  return SOLAR_DIRECTION_SAMPLE_DISTANCES_KM.map((distanceKm) => {
    const factor = 0.9 + (distanceKm / 200); // 远处略保守
    return {
      distanceKm,
      cloudBaseHeight: baseH,
      lowCloud: Math.min(100, low * factor),
      midCloud: Math.min(100, mid * factor),
      highCloud: Math.min(100, high * factor)
    };
  });
}

function calcSampleBlock(sample, solarElevation) {
  const Hkm = (sample.cloudBaseHeight || 1000) / 1000;
  const Dkm = sample.distanceKm || 50;
  const criticalElevation = Math.atan(Hkm / Dkm) * 180 / Math.PI;

  const low = sample.lowCloud || 0;
  const mid = sample.midCloud || 0;
  const high = sample.highCloud || 0;

  const layerOpacity = (low * 0.7 + mid * 0.2 + high * 0.1) / 100;
  const geometryBlock = sigmoid((criticalElevation - solarElevation) * 1.2);
  const block = Math.max(0, Math.min(1, geometryBlock * layerOpacity));

  return {
    distanceKm: Dkm,
    cloudBaseHeight: sample.cloudBaseHeight,
    criticalElevation: parseFloat(criticalElevation.toFixed(2)),
    block: parseFloat(block.toFixed(3))
  };
}

function analyzeRemoteLightPath(samples) {
  const valid = Array.isArray(samples) ? samples.filter(s => !s.error) : [];
  if (valid.length === 0) return { available: false, modifier: 1, cap: null, reason: 'no_remote_samples' };

  const totalWeight = valid.reduce((sum, sample, index) => sum + getSolarDirectionSampleWeight(sample, index), 0);
  const avg = (key) => valid.reduce((sum, sample, index) => (
    sum + Number(sample[key] || 0) * getSolarDirectionSampleWeight(sample, index)
  ), 0) / totalWeight;
  const lowMid = avg('lowCloud') * 0.65 + avg('midCloud') * 0.35;
  const high = avg('highCloud');
  const maxSampleLowMid = valid.reduce((max, sample) => {
    const sampleLowMid = Number(sample.lowCloud || 0) * 0.65 + Number(sample.midCloud || 0) * 0.35;
    return Math.max(max, sampleLowMid);
  }, 0);
  const blockedCorridor = lowMid >= 68 || (lowMid >= 38 && maxSampleLowMid >= 78);
  const opening = lowMid <= 28 && high >= 25;
  const clearCorridor = lowMid <= 22;

  if (blockedCorridor) {
    return {
      available: true,
      modifier: 0.72,
      cap: 48,
      reason: 'solar_direction_blocked_corridor',
      lowMid: parseFloat(lowMid.toFixed(1)),
      high: parseFloat(high.toFixed(1)),
      maxSampleLowMid: parseFloat(maxSampleLowMid.toFixed(1))
    };
  }

  if (opening) {
    return {
      available: true,
      modifier: clearCorridor ? 1.12 : 1.06,
      cap: null,
      reason: clearCorridor ? 'solar_direction_clear_opening' : 'solar_direction_partial_opening',
      lowMid: parseFloat(lowMid.toFixed(1)),
      high: parseFloat(high.toFixed(1))
    };
  }

  return {
    available: true,
    modifier: lowMid >= 55 ? 0.92 : 1.0,
    cap: lowMid >= 55 ? 64 : null,
    reason: lowMid >= 55 ? 'solar_direction_cloudy_corridor' : 'solar_direction_neutral',
    lowMid: parseFloat(lowMid.toFixed(1)),
    high: parseFloat(high.toFixed(1))
  };
}

/**
 * 第三模块：光路逻辑（物理重构版）
 * 基于太阳高度角 + 云底高度 + 多点采样估算光路遮挡概率。
 */
function scoreLightPath(weatherData, solarElevation, azimuth, remoteCloudData = null) {
  let samples = [];
  let hasRemoteData = false;

  if (remoteCloudData && Array.isArray(remoteCloudData.samples) && remoteCloudData.samples.length >= 4) {
    hasRemoteData = true;
    samples = remoteCloudData.samples.slice(0, SOLAR_DIRECTION_SAMPLE_DISTANCES_KM.length);
  } else {
    samples = buildLocalLightPathSamples(weatherData);
  }

  const sampleResults = samples.map((s, i) => {
    const r = calcSampleBlock(s, solarElevation);
    return { ...r, weightedBlock: r.block * getSolarDirectionSampleWeight(s, i) };
  });

  const rawOcclusionProbability = 1 - sampleResults.reduce((prod, s) => prod * (1 - s.weightedBlock), 1);
  const nearRemoteBlock = hasRemoteData && sampleResults.slice(0, 3).some(s => Number(s.block || 0) >= 0.65);
  const remoteBlockSignal = hasRemoteData && (rawOcclusionProbability >= 0.45 || nearRemoteBlock);

  // 低云少时降低遮挡概率计算权重；但太阳方向远端采样已显示明显遮挡时，不能用本地点低云少来抵消。
  const lowClouds = weatherData.lowClouds || 0;
  const midClouds = weatherData.midClouds || 0;
  const highClouds = weatherData.highClouds || 0;
  let occlusionWeight = 1.0;
  if (!remoteBlockSignal && lowClouds < 20) {
    occlusionWeight = 0.7; // 低云极少，光路通畅，降低遮挡影响
  } else if (!remoteBlockSignal && lowClouds < 30) {
    occlusionWeight = 0.85; // 低云较少，光路较通畅
  }

  const occlusionProbability = rawOcclusionProbability * occlusionWeight;
  let lightPathScore = 100 * (1 - occlusionProbability);
  const directionalAnalysis = hasRemoteData ? analyzeRemoteLightPath(samples) : null;
  if (directionalAnalysis?.available) {
    lightPathScore *= directionalAnalysis.modifier;
    if (directionalAnalysis.cap != null) {
      lightPathScore = Math.min(lightPathScore, directionalAnalysis.cap);
    }
  }

  // 恶劣天气硬封顶（作用于光路分本身）
  const cloudCover = weatherData.cloudCover || 0;
  const precipitation = weatherData.precipitation || 0;
  const convPrecip = weatherData.convPrecip || 0;
  const recentPrecipitation6h = Number(weatherData.recentPrecipitation6h || 0);
  const recentRainHours = Number(weatherData.recentRainHours || 0);
  const weatherCode = weatherData.weatherCode;
  const isRainSnowCode = typeof weatherCode === 'number' && (
    (weatherCode >= 51 && weatherCode <= 67) ||
    (weatherCode >= 71 && weatherCode <= 77) ||
    (weatherCode >= 80 && weatherCode <= 86)
  );

  // 光路封顶：只看低云遮挡和降水，中高云不影响光路
  // 气象学依据：中高云是光路散射体（产生色彩），不是遮挡体
  let capReason = null;
  if (cloudCover >= 85 && lowClouds > Math.max(midClouds, highClouds)) {
    // 只有低云主导的总云量极高时才封顶
    lightPathScore = Math.min(lightPathScore, 40);
    capReason = 'overcast_cap_40';
  }
  // 降水封顶：低云高时才封顶（可能在下雨）；低云不高时不封顶（可能是雨后，有利火烧云）
  if ((precipitation > 1 || convPrecip > 1 || isRainSnowCode) && lowClouds > 40) {
    lightPathScore = Math.min(lightPathScore, 50);
    capReason = capReason || 'precipitation_cap_50';
  }

  // 兼容旧字段：near/far 映射到前两个采样点
  const nearPointScore = 100 * (1 - (sampleResults[0]?.block || 0));
  const farPointScore = 100 * (1 - (sampleResults[2]?.block || 0));

  return {
    score: parseFloat(lightPathScore.toFixed(1)),
    rawOcclusionProbability: parseFloat(rawOcclusionProbability.toFixed(3)),
    occlusionProbability: parseFloat(occlusionProbability.toFixed(3)),
    occlusionWeight: parseFloat(occlusionWeight.toFixed(2)),
    remoteBlockSignal,
    azimuth,
    source: hasRemoteData ? (remoteCloudData.source || 'remote_samples') : 'local_estimate',
    samples: sampleResults.map(({ distanceKm, cloudBaseHeight, criticalElevation, block }) => ({
      distanceKm,
      cloudBaseHeight,
      criticalElevation,
      block
    })),
    directionalAnalysis,
    capReason,
    explain: capReason ? '恶劣天气触发光路分封顶' : '基于太阳几何与分层云量的光路估算',
    // --- deprecated fields (Phase 13 兼容窗口，Phase 14 移除) ---
    /** @deprecated 使用 samples[0] 替代 */
    nearPointScore: parseFloat(nearPointScore.toFixed(1)),
    /** @deprecated 使用 samples[2] 替代 */
    farPointScore: parseFloat(farPointScore.toFixed(1)),
    /** @deprecated 远程采样已移除，始终为 false */
    hasRemoteData,
    /** @deprecated 使用 samples[].cloudBaseHeight 替代 */
    breakdown: {
      nearPointCloudCover: weatherData.cloudCover || 0,
      farPointCloudCover: weatherData.cloudCover || 0
    }
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
  const aerosolOpticalDepth = Number(weatherData.aerosolOpticalDepth ?? weatherData.aod);
  const pm25 = Number(weatherData.pm2_5 ?? weatherData.pm25 ?? 0);
  const pm10 = Number(weatherData.pm10 ?? 0);
  const dust = Number(weatherData.dust ?? 0);
  const hasAerosolMetric = Number.isFinite(aerosolOpticalDepth)
    || Number.isFinite(Number(weatherData.pm2_5 ?? weatherData.pm25))
    || Number.isFinite(Number(weatherData.pm10))
    || Number.isFinite(Number(weatherData.dust));
  const transparentAerosolPath = hasAerosolMetric
    && visibility >= 12
    && (!Number.isFinite(aerosolOpticalDepth) || aerosolOpticalDepth <= 0.55)
    && dust < 150;
  const moderateAerosolWithGoodVisibility = transparentAerosolPath
    && pm25 < 90
    && pm10 < 150
    && dust < 120;
  const explicitRainSignal = Number(weatherData.recentRainSignal);
  const rainSignal = Number.isFinite(explicitRainSignal)
    ? clamp(explicitRainSignal, 0, 1)
    : (rainedRecently ? 1 : 0);

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

  // 3. 特殊模式：雨后初晴 / 湿灰幕
  let rainBonus = 1.0;
  let specialMode = null;

  const recentRain = Number(weatherData.recentPrecipitation6h || 0);
  const waterVapour = Number(weatherData.waterVapourColumn);
  const aerosolBad = (Number.isFinite(aerosolOpticalDepth) && aerosolOpticalDepth > 0.45) || pm25 > 75 || pm10 > 120 || dust > 80;
  const waterVapourGrayCurtain = Number.isFinite(waterVapour) && waterVapour >= 38;
  const grayCurtain = aerosolBad || visibility < 8 || humidity > 92 || waterVapourGrayCurtain;

  if (rainSignal > 0) {
    const cleanAfterRain = visibility >= 12 && !aerosolBad && humidity <= 90;
    const hasPostRainDiscriminators = recentRain > 0 || Number.isFinite(aerosolOpticalDepth) || pm25 > 0 || pm10 > 0 || dust > 0 || Number.isFinite(waterVapour);
    const effectiveRain = rainSignal >= 0.6;

    if (!hasPostRainDiscriminators) {
      rainBonus = parseFloat((1 + 0.2 * rainSignal).toFixed(2));
      specialMode = 'post_rain';
    } else if (grayCurtain && effectiveRain) {
      const grayPenalty = recentRain >= 2 ? 0.22 : 0.12;
      rainBonus = parseFloat((1 - grayPenalty * rainSignal).toFixed(2));
      specialMode = 'post_rain_gray_curtain';
    } else if (grayCurtain) {
      rainBonus = 1.0;
      specialMode = 'humid_haze_gray_curtain';
    } else if (cleanAfterRain && effectiveRain) {
      rainBonus = parseFloat((1 + 0.15 * rainSignal).toFixed(2));
      specialMode = 'post_rain_clear';
    } else {
      rainBonus = 1.0;
      specialMode = 'post_rain_neutral';
    }
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
    // AQI 偏高但能见度仍好、光学厚度未到灰幕级时，多表现为暖色散射，不直接按纯负面扣分。
    aqiFactor = aqi > 150 && !transparentAerosolPath ? 0.8 : 1.0;
  }

  let aerosolFactor = 1.0;
  let aerosolLevel = 'unknown';
  if (Number.isFinite(aerosolOpticalDepth)) {
    if (aerosolOpticalDepth < 0.08) {
      aerosolFactor = 0.98;
      aerosolLevel = 'low';
    } else if (aerosolOpticalDepth <= 0.35) {
      aerosolFactor = 1.06;
      aerosolLevel = 'optimal';
    } else if (aerosolOpticalDepth <= 0.7) {
      aerosolFactor = moderateAerosolWithGoodVisibility ? 0.9 : 0.95;
      aerosolLevel = 'high';
    } else {
      aerosolFactor = 0.88;
      aerosolLevel = 'very_high';
    }

    const particulateModerate = pm25 > 35 || pm10 > 80 || dust > 50;
    const particulateHigh = pm25 > 75 || pm10 > 150 || dust > 100;
    if (particulateHigh) {
      aerosolFactor = Math.min(aerosolFactor, transparentAerosolPath ? 0.95 : 0.85);
      aerosolLevel = 'polluted';
    } else if (particulateModerate) {
      aerosolFactor = Math.min(aerosolFactor, moderateAerosolWithGoodVisibility ? 0.9 : 0.94);
      aerosolLevel = aerosolLevel === 'optimal' ? 'moderate_pollution' : aerosolLevel;
    }
    if (visibility < 8 && (aerosolOpticalDepth > 0.35 || particulateModerate)) {
      aerosolFactor = Math.min(aerosolFactor, 0.85);
      aerosolLevel = 'low_visibility_haze';
    }
  }

  // 最终渲染系数 = 能见度 × 湿度 × 雨后加成 × AQI 修正 × 气溶胶修正。
  // 低能见度、雨后灰幕、AQI 与 AOD 往往描述同一团湿霾；非极端污染下给软下限，
  // 避免同一证据被连乘到过低，但保留极端沙尘/重霾的重罚。
  const rawRenderingFactor = visibilityFactor * humidityFactor * rainBonus * aqiFactor * aerosolFactor;
  const correlatedWetHaze =
    visibility >= 5 &&
    visibility < 8 &&
    (specialMode === 'post_rain_gray_curtain' || specialMode === 'humid_haze_gray_curtain');
  const extremeParticulate =
    (Number.isFinite(aerosolOpticalDepth) && aerosolOpticalDepth >= 0.65) ||
    pm25 >= 90 ||
    pm10 >= 150 ||
    dust >= 120;
  const correlationFloor = correlatedWetHaze && !extremeParticulate ? 0.52 : null;
  const renderingFactor = correlationFloor == null
    ? rawRenderingFactor
    : Math.max(rawRenderingFactor, correlationFloor);

  return {
    factor: parseFloat(renderingFactor.toFixed(2)),
    rawFactor: parseFloat(rawRenderingFactor.toFixed(2)),
    correlationFloor,
    visibilityFactor: parseFloat(visibilityFactor.toFixed(2)),
    humidityFactor: parseFloat(humidityFactor.toFixed(2)),
    rainBonus: parseFloat(rainBonus.toFixed(2)),
    rainSignal: parseFloat(rainSignal.toFixed(2)),
    aqiFactor: parseFloat(aqiFactor.toFixed(2)),
    aerosolFactor: parseFloat(aerosolFactor.toFixed(2)),
    breakdown: {
      visibility: visibilityLevel,
      humidity: humidityLevel,
      aqi: aqiLevel,
      aerosol: aerosolLevel,
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
  return getSharedQualityLevel(score);
}

/**
 * 太阳遮挡判定（试验版）
 *
 * 使用云底高度（m）和距离（km）计算临界太阳高度角：
 *   critical = atan(H / D)
 * 当太阳高度角低于临界角，认为远端云墙开始遮挡直射光。
 */
function checkSolarOcclusion(solarElevation, lightPathCloudData, fallbackCloudBaseHeight = null) {
  const far = lightPathCloudData?.far || null;
  const cloudBaseHeightM = far?.cloudBaseHeight ?? fallbackCloudBaseHeight;

  if (typeof cloudBaseHeightM !== 'number' || !Number.isFinite(cloudBaseHeightM)) {
    return { occluded: false, reason: 'no_cloud_base_height' };
  }

  // 山地/局地天气下使用更短光路距离，减少远距离误判
  const distanceKm = 120;
  const cloudBaseHeightKm = cloudBaseHeightM / 1000;
  const criticalElevation = Math.atan(cloudBaseHeightKm / distanceKm) * 180 / Math.PI;

  if (solarElevation < criticalElevation) {
    return {
      occluded: true,
      reason: 'distant_cloud_wall',
      cloudBaseHeightM: parseFloat(cloudBaseHeightM.toFixed(0)),
      distanceKm,
      criticalElevation: parseFloat(criticalElevation.toFixed(2))
    };
  }

  return {
    occluded: false,
    reason: 'light_path_clear',
    cloudBaseHeightM: parseFloat(cloudBaseHeightM.toFixed(0)),
    distanceKm,
    criticalElevation: parseFloat(criticalElevation.toFixed(2))
  };
}

/**
 * 恶劣天气硬性封顶，避免雨雪/阴天出现高分
 * 
 * 修复：不再仅凭 total cloudCover >= 85 就硬封顶35分
 * 改为：低云遮挡主导（lowClouds >= 60 且 totalCloudCover >= 85）时才重罚
 * 高云主导场景（highClouds 高但 lowClouds 低）不再被误伤
 */
function applySevereWeatherCap(score, weatherData) {
  const cloudCover = weatherData.cloudCover || 0;
  const lowClouds = weatherData.lowClouds || 0;
  const midClouds = weatherData.midClouds || 0;
  const highClouds = weatherData.highClouds || 0;
  const precipitation = weatherData.precipitation || 0;
  const convPrecip = weatherData.convPrecip || 0;
  const recentPrecipitation6h = Number(weatherData.recentPrecipitation6h || 0);
  const recentRainHours = Number(weatherData.recentRainHours || 0);
  const weatherCode = weatherData.weatherCode;

  // Open-Meteo WMO weather codes: 51-67 雨/冻雨, 71-77 雪, 80-86 阵雨/阵雪
  const isRainSnowCode = typeof weatherCode === 'number' && (
    (weatherCode >= 51 && weatherCode <= 67) ||
    (weatherCode >= 71 && weatherCode <= 77) ||
    (weatherCode >= 80 && weatherCode <= 86)
  );

  // 降水封顶：低云高时才封顶（大概率在下雨），低云不高可能是雨后
  if ((precipitation > 1 || convPrecip > 1 || isRainSnowCode) && lowClouds > 40) {
    return { score: Math.min(score, 45), reason: 'precipitation_cap_45' };
  }

  // 低云遮挡主导才重罚：低云高 + 总云量高
  // 避免高云主导（如 highClouds=90, lowClouds=10）被误伤
  const isLowCloudDominant = lowClouds >= 60 && cloudCover >= 85;
  const isOvercastWithLowCloud = cloudCover >= 85 && lowClouds > Math.max(midClouds, highClouds);
  
  if (isLowCloudDominant || isOvercastWithLowCloud) {
    return { score: Math.min(score, 35), reason: 'overcast_cap_35' };
  }

  // 总云量很高 + 低能见度是强负面信号，但不应单独打死。
  // 低云很少、光路仍开、云载体较好时，仍可能有局部暖色。
  const visibility = weatherData.visibility ?? 20;
  if (cloudCover >= 95 && visibility <= 5) {
    return { score: Math.min(score, 35), reason: 'overcast_low_visibility_cap_35' };
  }

  const isMidCloudOvercastCurtain = cloudCover >= 95 && midClouds >= 60 && highClouds < 20 && lowClouds < 20;
  const hasRecentRainSignal = precipitation > 0 || convPrecip > 0 || recentPrecipitation6h >= 0.3 || recentRainHours >= 2 || isRainSnowCode;
  const aerosolOpticalDepth = Number(weatherData.aerosolOpticalDepth ?? weatherData.aod);
  const pm25 = Number(weatherData.pm2_5 ?? weatherData.pm25 ?? 0);
  const pm10 = Number(weatherData.pm10 ?? 0);
  const dust = Number(weatherData.dust ?? 0);
  const waterVapour = Number(weatherData.waterVapourColumn);
  const hasGrayCurtainEvidence =
    (Number.isFinite(aerosolOpticalDepth) && aerosolOpticalDepth > 0.35) ||
    pm25 > 35 || pm10 > 80 || dust > 50 ||
    (Number.isFinite(waterVapour) && waterVapour > 30) ||
    visibility < 10;
  if (isMidCloudOvercastCurtain && hasRecentRainSignal && hasGrayCurtainEvidence) {
    const noHighCloudCarrier = highClouds < 10;
    const stronglyBlockedLightPath = visibility < 8;
    const cap = noHighCloudCarrier && stronglyBlockedLightPath ? 5 : 15;
    return {
      score: Math.min(score, cap),
      reason: cap <= 5 ? 'no_visible_sunset_path_cap_5' : 'no_visible_sunset_path_cap_15'
    };
  }

  return { score, reason: null };
}

function buildLightPathGate(lightPathScore, cloudTypeAdjustment = {}) {
  const score = clamp(Number(lightPathScore?.score ?? 0), 0, 100);
  let gate;
  if (score >= 85) {
    gate = 1.0 + (score - 85) / 15 * 0.08;
  } else if (score >= 70) {
    gate = 0.88 + (score - 70) / 15 * 0.12;
  } else if (score >= 50) {
    gate = 0.65 + (score - 50) / 20 * 0.23;
  } else {
    gate = 0.25 + score / 50 * 0.40;
  }

  const directionalReason = lightPathScore?.directionalAnalysis?.reason || '';
  if (isDirectionalCorridorBlocked(directionalReason)) {
    gate = Math.min(gate, 0.42);
  } else if (directionalReason.includes('opening')) {
    gate = Math.min(Math.max(gate, 0.90), 0.96);
  } else if (directionalReason.includes('cloudy_corridor')) {
    gate = Math.min(gate, 0.78);
  }

  gate += Number(cloudTypeAdjustment?.lightGateDelta || 0);

  let cap = null;
  let reason = directionalReason || 'light_path_score_gate';
  gate = parseFloat(clamp(gate, 0.25, 1.12).toFixed(2));
  return { gate, cap, reason, lightPathScore: parseFloat(score.toFixed(1)) };
}

function calculateGatedFinalScore(canvasScore, lightPathScore, renderingFactor, type = 'sunset', context = {}) {
  const lightPathGate = context.lightPathGate || buildLightPathGate(lightPathScore);
  const layerBrightness = context.layerBrightness || null;
  const brightnessMultiplier = clamp(Number(layerBrightness?.brightnessMultiplier ?? layerBrightness?.brightnessGate ?? 1), 0, 1.05);
  const dimEvidenceCount = Array.isArray(layerBrightness?.dimEvidence) ? layerBrightness.dimEvidence.length : 0;
  const particulateCap = Number(layerBrightness?.factors?.particulateCap ?? 1.08);
  const airTransmissionFloor = Math.min(dimEvidenceCount === 0 ? 0.91 : 0.72, particulateCap);
  const airTransmissionFactor = clamp(Number(layerBrightness?.factors?.airTransmission ?? 1), airTransmissionFloor, 1.08);
  const parsedBaseRenderingFactor = Number(renderingFactor?.factor ?? 1);
  const baseRenderingFactor = Number.isFinite(parsedBaseRenderingFactor) ? parsedBaseRenderingFactor : 1;
  const localUpperSignal = Number(layerBrightness?.layers?.highSignal ?? 0);
  const remoteUpperSignal = Number(layerBrightness?.layers?.remoteHigh ?? 0);
  const directRatio = Number(layerBrightness?.factors?.directRatio ?? 1);
  const hasAerosolDimEvidence = Array.isArray(layerBrightness?.dimEvidence)
    && layerBrightness.dimEvidence.includes('high_aod');
  const diffuseDimNoRemoteCap = localUpperSignal >= 80
    && remoteUpperSignal <= 0
    && directRatio < 0.05
    && hasAerosolDimEvidence
    ? 0.74
    : null;
  const weakUpperHazeCap = localUpperSignal > 0
    && localUpperSignal < 45
    && remoteUpperSignal < 35
    && directRatio < 0.18
    && hasAerosolDimEvidence
    ? 0.648
    : null;
  const moderateDirectionalHazeCap = canvasScore.activeCarrier === 'directional_curtain'
    && localUpperSignal < 30
    && Number(layerBrightness?.layers?.directionalUpper ?? 0) < 70
    && hasAerosolDimEvidence
    ? 0.83
    : null;
  const airRenderingFactor = {
    ...renderingFactor,
    factor: clamp(Math.min(baseRenderingFactor, airTransmissionFactor, weakUpperHazeCap ?? 1.12, diffuseDimNoRemoteCap ?? 1.12, moderateDirectionalHazeCap ?? 1.12), 0.18, 1.12)
  };
  const renderingAdjustment = context.renderingAdjustment || getRenderingScoreAdjustment(airRenderingFactor);
  const carrierScore = Number(canvasScore.score || 0);
  const weightedCarrierScore = Number(layerBrightness?.weightedCarrierScore);
  const brightnessBaseScore = Number.isFinite(weightedCarrierScore)
    ? clamp(weightedCarrierScore, 0, 100)
    : carrierScore * brightnessMultiplier;
  const rendered = applyRenderingToGatedScore(brightnessBaseScore, airRenderingFactor, renderingAdjustment);
  const layerBrightnessAdjustment = {
    score: parseFloat(brightnessBaseScore.toFixed(1)),
    applied: brightnessBaseScore < carrierScore || brightnessMultiplier < 1,
    reason: layerBrightness?.reason || null,
    multiplier: parseFloat(brightnessMultiplier.toFixed(2)),
    effectiveBrightness: layerBrightness?.effectiveBrightness ?? null,
    originalScore: parseFloat(carrierScore.toFixed(1))
  };
  const directionalCurtainCarrier = context.directionalCurtainCarrier || canvasScore.directionalCurtainCarrier || null;
  const remoteLayerCarriers = context.remoteLayerCarriers || canvasScore.remoteLayerCarriers || null;
  const visibleSectorCarrier = context.visibleSectorCarrier || canvasScore.visibleSectorCarrier || null;
  const directionalFloor = canvasScore.activeCarrier === 'directional_curtain' && directionalCurtainCarrier?.applied && lightPathGate.cap == null && lightPathGate.gate >= 0.75
    ? directionalCurtainCarrier.floor
    : null;
  const finalScore = directionalFloor != null
    ? Math.max(rendered.score, directionalFloor)
    : rendered.score;
  const clampedScore = clamp(finalScore, 0, 100);

  const legacy = calculateFinalScore(canvasScore, lightPathScore, { ...renderingFactor, factor: 1.0 }, type);
  let status = legacy.status;
  let description = legacy.description;
  let advice = legacy.advice;
  let icon = legacy.icon;

  if (lightPathGate.gate <= 0.45 || lightPathGate.cap != null) {
    status = clampedScore < 40 ? 'no_fire_cloud' : 'light_glow';
    description = 'light_path_blocked';
    advice = 'light_path_obstructed';
    icon = 'cloudy';
  } else if (clampedScore < 40) {
    status = 'light_glow';
    description = 'conditions_fair';
    advice = 'can_watch';
    icon = 'sunset';
  } else if (clampedScore < 65) {
    status = 'good_glow';
    description = 'conditions_good';
    advice = 'can_watch';
    icon = 'city_sunset';
  } else if (clampedScore < 82) {
    status = 'very_likely';
    description = 'excellent_conditions';
    advice = 'worth_watching';
    icon = 'city_sunset';
  } else {
    status = 'legendary_eruption';
    description = 'perfect_mid_high_clouds';
    advice = 'highly_recommended';
    icon = 'fire';
  }

  let displayScore = clampedScore;
  if (lightPathGate.cap != null) {
    displayScore = Math.min(displayScore, lightPathGate.cap);
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
      baseScore: parseFloat(brightnessBaseScore.toFixed(1)),
      canvasScore: parseFloat((canvasScore.cloudCanvasScore ?? canvasScore.score).toFixed(1)),
      carrierScore: parseFloat(canvasScore.score.toFixed(1)),
      activeCarrier: canvasScore.activeCarrier || 'cloud',
      aerosolCarrierScore: canvasScore.aerosolCarrierScore || null,
      directionalCurtainCarrier,
      remoteLayerCarriers,
      visibleSectorCarrier,
      lightPathScore: parseFloat(lightPathScore.score.toFixed(1)),
      lightPathGate: lightPathGate.gate,
      brightnessMultiplier: layerBrightnessAdjustment.multiplier,
      weightedCarrierScore: parseFloat(brightnessBaseScore.toFixed(1)),
      layerContributionFormula: layerBrightness?.formula || 'carrier_brightness_multiplier',
      layerContributions: Array.isArray(layerBrightness?.layerContributions) ? layerBrightness.layerContributions : [],
      airTransmissionFactor: parseFloat(airTransmissionFactor.toFixed(2)),
      airTransmissionFloor,
      baseRenderingFactor: parseFloat(baseRenderingFactor.toFixed(2)),
      weakUpperHazeCap,
      diffuseDimNoRemoteCap,
      layerBrightnessAdjustment,
      renderingAdjustment: rendered.adjustment,
      renderingFactor: airRenderingFactor.factor,
      renderingMode: rendered.reason,
      directionalFloor,
      unclampedFinalScore: parseFloat(clampedScore.toFixed(1))
    },
    canvasAnalysis: canvasScore,
    carrierAnalysis: canvasScore,
    aerosolCarrierScore: canvasScore.aerosolCarrierScore || null,
    directionalCurtainCarrier,
    remoteLayerCarriers,
    visibleSectorCarrier,
    lightPathAnalysis: lightPathScore,
    lightPathGate,
    layerBrightnessAdjustment,
    renderingAdjustment: {
      ...renderingAdjustment,
      adjustment: rendered.adjustment,
      reason: rendered.reason
    },
    renderingAnalysis: airRenderingFactor
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
function calculateFinalScore(canvasScore, lightPathScore, renderingFactor, type = 'sunset') {
  // 综合得分 = 载体×0.8 + 光路×0.2
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
  // 根据综合得分判定（阈值整体下调约10分）
  else if (clampedScore < 40) {
    status = 'light_glow';
    icon = 'sunset';
    description = 'conditions_fair';
    advice = 'can_watch';
  } else if (clampedScore < 65) {
    status = 'good_glow';
    icon = 'city_sunset';  // 🌆
    description = 'conditions_good';
    advice = 'can_watch';
  } else if (clampedScore < 80) {
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
  const aerosolCarrierActive = canvasScore.activeCarrier === 'aerosol' &&
    Number(canvasScore.aerosolCarrierScore?.activatedScore) >= 12;
  if (isVeryLowCloud && !aerosolCarrierActive) {
    status = 'no_fire_cloud';
    description = 'sky_clear';
    advice = 'wait_for_clouds';
    icon = 'cloudy';
    displayScore = Math.min(displayScore, 35);
  }

  // 修复：无远端数据时，光路评分不能抬高上限（但高云主导场景放宽限制）
  if (!lightPathScore.hasRemoteData) {
    // 高云主导场景放宽到85分，普通场景保持69.9上限
    const isHighCloudDominant = canvasScore.breakdown?.highClouds > 50 && canvasScore.breakdown?.lowClouds < 30;
    const cap = isHighCloudDominant ? 85 : 69.9;
    displayScore = Math.min(displayScore, cap);
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
      canvasScore: parseFloat((canvasScore.cloudCanvasScore ?? canvasScore.score).toFixed(1)),
      carrierScore: parseFloat(canvasScore.score.toFixed(1)),
      activeCarrier: canvasScore.activeCarrier || 'cloud',
      aerosolCarrierScore: canvasScore.aerosolCarrierScore || null,
      lightPathScore: parseFloat(lightPathScore.score.toFixed(1)),
      renderingFactor: renderingFactor.factor,
      unclampedFinalScore: parseFloat(clampedScore.toFixed(1))
    },
    canvasAnalysis: canvasScore,
    carrierAnalysis: canvasScore,
    aerosolCarrierScore: canvasScore.aerosolCarrierScore || null,
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

  const { remoteCloudData = null, rainedRecently = false, prevHourData = null, scoringContext = null } = options;

  logger.debug('[EnhancedPredictionService]', '开始计算增强版预测...');

  // 1. 时间判定
  const timeCheck = checkTimeWindow(dateObj, lat, lon, type);
  logger.debug('[EnhancedPredictionService]', '时间判定:', timeCheck);

  // 2. 云种判别（需求39）
  const cloudType = cloudTypeClassifier(
    weatherData.lowClouds  || 0,
    weatherData.midClouds  || 0,
    weatherData.highClouds || 0,
    weatherData.cloudBaseHeight ?? null
  );
  logger.debug('[EnhancedPredictionService]', '云种判别:', cloudType.type, cloudType.reason);

  // 3. 画布评分（本地云况）+ 云种加分。正向证据用加分，避免重复连乘。
  const canvasScoreRaw = scoreCloudCanvas(weatherData);
  const cloudTypeAdjustment = getCloudTypeAdditiveAdjustment(cloudType);
  const effectiveCloudTypeAdjustment = (
    cloudTypeAdjustment.reason === 'clear_but_no_cloud_canvas' &&
    Number(canvasScoreRaw.effectiveCloudCover || 0) > 10
  )
    ? { canvasBonus: 0, lightGateDelta: cloudTypeAdjustment.lightGateDelta, reason: 'weak_upper_cloud_canvas_present' }
    : cloudTypeAdjustment;
  const canvasScore = {
    ...canvasScoreRaw,
    score: parseFloat(clamp(canvasScoreRaw.score + effectiveCloudTypeAdjustment.canvasBonus, 0, 100).toFixed(1)),
    cloudTypeAdjustment: effectiveCloudTypeAdjustment
  };
  logger.debug('[EnhancedPredictionService]', '画布评分(含云种):', canvasScore.score);

  // 3.5 光路几何模型（需求40）——预测开始时间 + 持续时长
  const cloudBaseMeta = getCloudBaseHeightMeta(weatherData);
  const geometric = geometricLightModel(timeCheck.elevation, cloudBaseMeta.heightM / 1000, lat);
  logger.debug('[EnhancedPredictionService]', '光路几何:', geometric.feasible ? '可行' : '不可行', '开始偏移(min):', geometric.startOffsetMin, '持续(min):', geometric.durationMin);

  const azimuth = calculateSolarAzimuth(dateObj, lat, lon);
  // 优先使用 V2 物理重构算法（回滚开关：LIGHT_PATH_V2_ENABLED=false）
  const v2Result = LightPathV2Service.scoreFromWeatherData(weatherData, timeCheck.elevation, azimuth);
  const hasDirectionalRemoteSamples = remoteCloudData && Array.isArray(remoteCloudData.samples) && remoteCloudData.samples.length >= 4;
  const lightPathScoreRaw = (v2Result !== null && !hasDirectionalRemoteSamples)
    ? { ...v2Result, hasRemoteData: false, nearPointScore: v2Result.score, farPointScore: v2Result.score, breakdown: { nearPointCloudCover: weatherData.cloudCover || 0, farPointCloudCover: weatherData.cloudCover || 0 } }
    : scoreLightPath(weatherData, timeCheck.elevation, azimuth, remoteCloudData);
  const lightPathScore = {
    ...lightPathScoreRaw,
    score: parseFloat(lightPathScoreRaw.score.toFixed(1)),
    cloudTypeLightPathDelta: cloudTypeAdjustment.lightGateDelta
  };
  logger.debug('[EnhancedPredictionService]', '光路评分(含云种):', lightPathScore.score);

  // 4. 渲染修正（画质系数）
  const renderingFactor = scoreRendering(weatherData, rainedRecently);
  logger.debug('[EnhancedPredictionService]', '渲染修正:', renderingFactor.factor);

  // 5. 云厚评估（Phase 22）
  const cloudThickness = assessCloudThickness(weatherData, prevHourData, { lightPathScore });
  logger.debug('[EnhancedPredictionService]', '云厚评估:', cloudThickness.thickness, 'modifier:', cloudThickness.modifier, 'reasons:', cloudThickness.reasons);

  // 5.5 云厚修正画布分
  const cloudThicknessAdjustment = getCloudThicknessCanvasAdjustment(cloudThickness, canvasScore.score);
  if (cloudThicknessAdjustment.adjustment !== 0) {
    const originalCanvasScore = canvasScore.score;
    canvasScore.score = parseFloat(clamp(canvasScore.score + cloudThicknessAdjustment.adjustment, 0, 100).toFixed(1));
    canvasScore.cloudThicknessModifier = cloudThickness.modifier;
    canvasScore.cloudThicknessAdjustment = cloudThicknessAdjustment;
    canvasScore.cloudThickness = cloudThickness.thickness;
    logger.debug('[EnhancedPredictionService]', '云厚修正画布分:', originalCanvasScore, '->', canvasScore.score);
  }

  // 5.6 厚高云惩罚：厚高云不再被简单视为理想画布
  let thickHighCloudPenalty = assessThickHighCloudPenalty(weatherData, cloudThickness);
  if (thickHighCloudPenalty.applied) {
    const originalLightPathScore = lightPathScore.score;
    lightPathScore.score = Math.min(lightPathScore.score, 55);
    lightPathScore.thickHighCloudPenalty = thickHighCloudPenalty;
    lightPathScore.scoreBeforeThickHighCloudPenalty = originalLightPathScore;
    logger.debug('[EnhancedPredictionService]', '厚高云修正光路分:', originalLightPathScore, '->', lightPathScore.score, thickHighCloudPenalty.reason);
  }

  // 6. 综合输出：云画布 + 气溶胶弱载体统一进入“载体分”
  const aerosolCarrierScore = scoreAerosolCarrier(weatherData, lightPathScore);
  const directionalCurtainCarrier = scoreDirectionalCurtainCarrier(remoteCloudData, lightPathScore, weatherData);
  const remoteLayerCarriers = scoreRemoteLayerCarriers(remoteCloudData, lightPathScore, weatherData);
  const visibleSectorCarrier = scoreVisibleSectorCarrier(remoteCloudData, lightPathScore, weatherData);
  const suppressedThickHighCloudPenalty = maybeSuppressWaterHeavyHighCloudCap(thickHighCloudPenalty, visibleSectorCarrier, weatherData);
  if (suppressedThickHighCloudPenalty !== thickHighCloudPenalty) {
    lightPathScore.thickHighCloudPenalty = suppressedThickHighCloudPenalty;
    thickHighCloudPenalty = suppressedThickHighCloudPenalty;
  }
  const carrierScore = buildCarrierScore(canvasScore, aerosolCarrierScore, directionalCurtainCarrier, remoteLayerCarriers, visibleSectorCarrier);
  const lightPathGate = buildLightPathGate(lightPathScore, cloudTypeAdjustment);
  const layerBrightness = LayerBrightnessService.scoreLayerBrightness({
    weatherData,
    timeAnalysis: timeCheck,
    lightPathScore,
    lightPathGate,
    renderingFactor,
    cloudThickness,
    type,
    directionalCurtainCarrier,
    remoteLayerCarriers,
    visibleSectorCarrier,
    carrierScore
  });
  logger.debug('[EnhancedPredictionService]', '载体评分:', carrierScore.score, 'active:', carrierScore.activeCarrier, 'aerosol:', aerosolCarrierScore);
  logger.debug('[EnhancedPredictionService]', '分层亮度:', layerBrightness.effectiveBrightness, 'multiplier:', layerBrightness.brightnessMultiplier, 'gate:', layerBrightness.brightnessGate);
  const finalResult = calculateGatedFinalScore(carrierScore, lightPathScore, renderingFactor, type, {
    lightPathGate,
    layerBrightness,
    directionalCurtainCarrier,
    remoteLayerCarriers,
    visibleSectorCarrier
  });

  // 6. 太阳遮挡判定（试验版，温和惩罚）
  const occlusion = checkSolarOcclusion(
    timeCheck.elevation,
    remoteCloudData,
    weatherData.cloudBaseHeight
  );

  let adjustedScore = finalResult.score;
  let adjustedStatus = finalResult.status;
  let adjustedDescription = finalResult.description;

  // 6.5 几何不可行硬性上限（需求40.2）
  if (!geometric.feasible) {
    adjustedScore = Math.min(adjustedScore, 30);
    adjustedStatus = 'no_fire_cloud';
    adjustedDescription = 'cloud_too_thick';
    logger.warn('[EnhancedPredictionService]', '几何条件不满足，设置上限30:', geometric.reason);
  }

  if (occlusion.occluded) {
    adjustedScore = parseFloat((adjustedScore * 0.75).toFixed(1));
    if (adjustedScore < 40) {
      adjustedStatus = 'no_fire_cloud';
      adjustedDescription = 'light_path_blocked';
    }
  }

  if (thickHighCloudPenalty.applied) {
    adjustedScore = Math.min(adjustedScore, thickHighCloudPenalty.cap);
    adjustedStatus = 'light_glow';
    adjustedDescription = 'weak_local_colors';
  }

  const scoringV2 = type === 'sunset'
    ? assessSunsetScoringV2(weatherData, carrierScore, lightPathScore, lightPathGate, renderingFactor, remoteCloudData, { scoringContext })
    : { applied: false };
  const visibleSunsetSectorCap = type === 'sunset'
    ? (scoringV2.visibleSunsetSectorCap
      || assessVisibleSunsetSectorCap(weatherData, carrierScore, lightPathScore, lightPathGate, remoteCloudData))
    : { applied: false, cap: null, reason: null };
  const airClearEnoughForPositiveCalibration = Number(finalResult.breakdown?.renderingFactor ?? 1) >= 0.75
    || scoringV2.warmScatteringUpperCarrierAdjustment?.applied
    || scoringV2.airMode === 'wet_haze_path_open_mid_rendering';
  const wetHazePathOpenCalibration =
    scoringV2.airMode === 'wet_haze_path_open_mid_rendering' &&
    scoringV2.pathOpen === true &&
    Number(weatherData.visibility ?? 20) >= 10 &&
    Number(weatherData.lowClouds || 0) <= 20;
  if (!thickHighCloudPenalty.applied && scoringV2.applied && scoringV2.airMode === 'gray_veil_air_suppression' && scoringV2.score < adjustedScore) {
    adjustedScore = scoringV2.score;
    if (adjustedScore < 46) {
      adjustedStatus = 'light_glow';
      adjustedDescription = 'weak_local_colors';
    } else {
      adjustedStatus = 'good_glow';
      adjustedDescription = 'conditions_good';
    }
  } else if ((!thickHighCloudPenalty.applied || wetHazePathOpenCalibration) && airClearEnoughForPositiveCalibration && scoringV2.applied && scoringV2.score > adjustedScore) {
    adjustedScore = scoringV2.score;
    if (adjustedScore >= 82) {
      adjustedStatus = 'legendary_eruption';
      adjustedDescription = 'perfect_mid_high_clouds';
    } else if (adjustedScore >= 65) {
      adjustedStatus = 'very_likely';
      adjustedDescription = 'excellent_conditions';
    } else if (adjustedScore >= 40) {
      adjustedStatus = 'good_glow';
      adjustedDescription = 'conditions_good';
    }
  }

  // 6.8 气溶胶/沙尘灰幕封顶 + 清透高云载体保底（2026-05-06 北京/喀什反例）
  const aerosolHazeCap = assessAerosolHazeCap(weatherData, { pathOpen: scoringV2.pathOpen === true, airMode: scoringV2.airMode });
  let highCloudCarrierAdjustment = assessHighCloudCarrierAdjustment(weatherData, aerosolHazeCap, thickHighCloudPenalty);

  const airClearEnoughForCarrierFloor = Number(finalResult.breakdown?.renderingFactor ?? 1) >= 0.90;
  if (highCloudCarrierAdjustment.applied && airClearEnoughForCarrierFloor && lightPathGate.cap == null && (lightPathGate.gate >= 0.82 || !lightPathScore.hasRemoteData)) {
    adjustedScore = Math.max(adjustedScore, highCloudCarrierAdjustment.floor);
    if (adjustedScore >= 65) {
      adjustedStatus = 'very_likely';
      adjustedDescription = 'excellent_conditions';
    } else if (adjustedScore >= 40) {
      adjustedStatus = 'good_glow';
      adjustedDescription = 'conditions_good';
    }
  } else if (highCloudCarrierAdjustment.applied) {
    highCloudCarrierAdjustment = {
      ...highCloudCarrierAdjustment,
      applied: false,
      suppressed: true,
      suppressReason: airClearEnoughForCarrierFloor ? 'light_path_gate_not_open' : 'air_rendering_not_clear'
    };
  }

  let layerBrightnessAdjustment = finalResult.layerBrightnessAdjustment || finalResult.breakdown?.layerBrightnessAdjustment || {
    applied: false,
    multiplier: layerBrightness.brightnessMultiplier,
    effectiveBrightness: layerBrightness.effectiveBrightness,
    reason: layerBrightness.reason,
    originalScore: carrierScore.score
  };
  const scoringV2AlreadyIncludesAirRendering = scoringV2.airMode === 'wet_haze_path_open_mid_rendering';
  if (adjustedScore > finalResult.score && !scoringV2.warmScatteringUpperCarrierAdjustment?.applied && !scoringV2AlreadyIncludesAirRendering) {
    const postCalibrationBrightnessAdjustment = LayerBrightnessService.applyLayerBrightnessMultiplier(adjustedScore, layerBrightness);
    if (postCalibrationBrightnessAdjustment.applied && postCalibrationBrightnessAdjustment.score < adjustedScore) {
      layerBrightnessAdjustment = {
        ...postCalibrationBrightnessAdjustment,
        postCalibrationApplied: true
      };
      adjustedScore = layerBrightnessAdjustment.score;
    }
  }
  if (layerBrightnessAdjustment.postCalibrationApplied) {
    adjustedScore = layerBrightnessAdjustment.score;
    if (adjustedStatus === 'no_fire_cloud') {
      adjustedDescription = adjustedDescription || 'light_path_blocked';
    } else if (adjustedScore < 20 && layerBrightnessAdjustment.reason === 'layer_brightness_unlit') {
      adjustedStatus = 'no_fire_cloud';
      adjustedDescription = 'light_path_blocked';
    } else if (adjustedScore < 40) {
      adjustedStatus = 'light_glow';
      adjustedDescription = 'weak_local_colors';
    } else if (adjustedScore < 65) {
      adjustedStatus = 'good_glow';
      adjustedDescription = 'conditions_good';
    }
  }

  if (aerosolHazeCap.applied) {
    adjustedScore = Math.min(adjustedScore, aerosolHazeCap.cap);
    adjustedStatus = adjustedScore < 40 ? 'no_fire_cloud' : 'light_glow';
    adjustedDescription = aerosolHazeCap.level === 'extreme' ? 'haze_light_suppressed' : 'weak_local_colors';
  }

  if (visibleSunsetSectorCap.applied) {
    const scoreBeforeVisibleSectorCap = adjustedScore;
    adjustedScore = Math.min(adjustedScore, visibleSunsetSectorCap.cap);
    if (adjustedScore < scoreBeforeVisibleSectorCap && adjustedScore >= 65) {
      adjustedStatus = 'very_likely';
      adjustedDescription = 'excellent_conditions';
    } else if (adjustedScore < scoreBeforeVisibleSectorCap && adjustedScore >= 40) {
      adjustedStatus = 'good_glow';
      adjustedDescription = 'conditions_good';
    }
  }

  const postRainMode = renderingFactor.breakdown?.specialMode || null;
  let postRainAdjustment = { applied: false, mode: postRainMode, cap: null, reason: null };
  if (postRainMode === 'post_rain_gray_curtain' || postRainMode === 'humid_haze_gray_curtain') {
    const lowMid = (weatherData.lowClouds || 0) * 0.6 + (weatherData.midClouds || 0) * 0.4;
    const directionalReason = lightPathScore.directionalAnalysis?.reason || '';
    const directionalWall = isDirectionalCorridorBlocked(directionalReason);
    const directionalOpening = directionalReason.includes('opening');
    const cap = directionalOpening ? null : (postRainMode === 'humid_haze_gray_curtain' || directionalWall || lowMid >= 55 ? 42 : 50);
    if (cap != null) {
      adjustedScore = Math.min(adjustedScore, cap);
      adjustedStatus = adjustedScore < 40 ? 'no_fire_cloud' : 'light_glow';
      adjustedDescription = 'haze_light_suppressed';
    }
    const prefix = postRainMode === 'humid_haze_gray_curtain' ? 'humid_haze_gray_curtain' : 'post_rain_gray_curtain';
    postRainAdjustment = { applied: true, mode: postRainMode, cap, reason: directionalOpening ? `${prefix}_direction_opening_softened` : (directionalWall ? `${prefix}_direction_wall` : `${prefix}_cap`) };
  } else if (postRainMode === 'post_rain_clear') {
    postRainAdjustment = { applied: true, mode: postRainMode, cap: null, reason: 'post_rain_clear_bonus' };
  }

  // 7. 恶劣天气硬性封顶
  const severeCap = applySevereWeatherCap(adjustedScore, weatherData);
  adjustedScore = severeCap.score;
  if (severeCap.reason && adjustedScore < 40) {
    adjustedStatus = 'no_fire_cloud';
    adjustedDescription = 'cloud_too_thick';
  }

  const clearSunsetAdvice = type === 'sunset'
    ? assessClearSunsetViewingAdvice(weatherData, carrierScore, lightPathScore, {
      aerosolHazeCap,
      severeCap,
      occlusion,
      geometric,
      postRainAdjustment,
      directionalCurtainCarrier,
      visibleSectorCarrier
    })
    : { applied: false, reason: null, metrics: null };
  let adjustedAdvice = finalResult.advice;
  if (clearSunsetAdvice.applied) {
    adjustedStatus = 'no_fire_cloud';
    adjustedDescription = 'clear_sunset_transparent';
    adjustedAdvice = 'casual_viewing_ok';
    adjustedScore = Math.min(adjustedScore, 39.9);
  }

  if (thickHighCloudPenalty.applied && adjustedScore <= thickHighCloudPenalty.cap) {
    adjustedStatus = adjustedScore < 40 ? 'no_fire_cloud' : 'light_glow';
    adjustedDescription = 'weak_local_colors';
  }

  if (!aerosolHazeCap.applied && (layerBrightness.dimEvidence || []).length >= 3 && adjustedScore <= 45) {
    adjustedStatus = adjustedScore < 40 ? 'no_fire_cloud' : 'light_glow';
    adjustedDescription = 'weak_local_colors';
  }

  logger.debug('[EnhancedPredictionService]', '最终得分:', adjustedScore, 'occlusion:', occlusion, 'severeCap:', severeCap.reason);

  const aerosolScattering = {
    factor: renderingFactor.aerosolFactor,
    level: renderingFactor.breakdown?.aerosol || 'unknown',
    aerosolOpticalDepth: Number.isFinite(Number(weatherData.aerosolOpticalDepth ?? weatherData.aod))
      ? Number(weatherData.aerosolOpticalDepth ?? weatherData.aod)
      : null,
    pm2_5: Number.isFinite(Number(weatherData.pm2_5 ?? weatherData.pm25))
      ? Number(weatherData.pm2_5 ?? weatherData.pm25)
      : null,
    pm10: Number.isFinite(Number(weatherData.pm10)) ? Number(weatherData.pm10) : null,
    dust: Number.isFinite(Number(weatherData.dust)) ? Number(weatherData.dust) : null
  };

  // 返回完整结果
  return {
    date: dateObj.toISOString(),
    type: type,
    timeAnalysis: timeCheck,
    occlusionAnalysis: occlusion,
    severeWeatherCap: severeCap,
    cloudType: {
      type:                cloudType.type,
      label:               cloudType.label,
      labelEn:             cloudType.labelEn,
      canvasMultiplier:    cloudType.canvasMultiplier,
      lightPathMultiplier: cloudType.lightPathMultiplier,
      reason:              cloudType.reason
    },
    geometricModel: {
      feasible:            geometric.feasible,
      reason:              geometric.reason,
      sunAltitudeDeg:      geometric.sunAltitudeDeg,
      cloudBaseKm:         geometric.cloudBaseKm,
      cloudBaseSource:     cloudBaseMeta.source,
      cloudBaseReason:     cloudBaseMeta.reason,
      observedCloudBaseHeightM: cloudBaseMeta.source === 'provider' ? cloudBaseMeta.heightM : null,
      cloudBoundaryKm:      geometric.cloudBoundaryKm,
      startOffsetMin:       geometric.startOffsetMin,
      durationMin:         geometric.durationMin,
      vsun:                geometric.vsun
    },
    ...finalResult,
    score: adjustedScore,
    quality: getQualityLevel(adjustedScore),
    breakdown: {
      ...finalResult.breakdown,
      aerosolScattering,
      layerBrightness,
      layerBrightnessAdjustment
    },
    aerosolOpticalDepth: aerosolScattering.aerosolOpticalDepth,
    dust: aerosolScattering.dust,
    pm2_5: aerosolScattering.pm2_5,
    pm10: aerosolScattering.pm10,
    aqi: weatherData.aqi ?? null,
    cloudThickness: {
      thickness: cloudThickness.thickness,
      modifier: cloudThickness.modifier,
      pressure: cloudThickness.pressure,
      reasons: cloudThickness.reasons,
      score: cloudThickness.score,
      evidence: cloudThickness.evidence
    },
    thickHighCloudPenalty,
    layerBrightness,
    layerBrightnessAdjustment,
    aerosolHazeCap,
    scoringV2,
    visibleSunsetSectorCap,
    highCloudCarrierAdjustment,
    aerosolCarrierScore,
    directionalCurtainCarrier,
    remoteLayerCarriers,
    visibleSectorCarrier,
    postRainAdjustment,
    clearSunsetAdvice,
    algorithm: {
      name: 'EnhancedPredictionService',
      version: ALGORITHM_VERSION
    },
    status: adjustedStatus,
    description: adjustedDescription,
    advice: adjustedAdvice,
    scoreBeforeOcclusion: finalResult.score,
    score: adjustedScore
  };
}

/**
 * 火烧云地图网格使用的简化分支。
 *
 * 地图数据来自 GFS/CAMS 区域格点，缺少单点预测的 10/25/50/75/100km
 * 太阳方向精细采样，因此只使用格点自身云、辐射、水汽和空气质量字段。
 */
const MAP_SIMPLIFIED_SCORE_CAP = 78;

function calculateMapSimplifiedPrediction(weatherData, date, lat, lon, type) {
  const result = calculateEnhancedPrediction(weatherData, date, lat, lon, type, {
    scoringContext: 'map_grid_simplified'
  });
  const cappedScore = Math.min(Number(result.score) || 0, MAP_SIMPLIFIED_SCORE_CAP);
  return {
    ...result,
    score: cappedScore,
    scoringContext: 'map_grid_simplified',
    mapSimplifiedScoring: {
      applied: true,
      reason: 'gfs_cams_grid_without_point_light_path_samples',
      usesRemoteLightPathSamples: false,
      cap: MAP_SIMPLIFIED_SCORE_CAP,
      originalScore: result.score,
      capped: cappedScore !== result.score
    },
    algorithm: {
      ...(result.algorithm || {}),
      mode: 'map_grid_simplified'
    }
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
  SOLAR_DIRECTION_SAMPLE_DISTANCES_KM,
  SOLAR_DIRECTION_SAMPLE_WEIGHTS,
  VISIBLE_CARRIER_SAMPLE_DISTANCES_KM,
  VISIBLE_CARRIER_SAMPLE_WEIGHTS,
  UPPER_CLOUD_SIGNAL_LOW_CLOUD_LIFT,
  UPPER_CLOUD_SIGNAL_LOW_CLOUD_SCALE,
  ALGORITHM_VERSION,

  // 辅助函数
  getJulianDay,
  calculateSolarElevation,
  calculateSolarAzimuth,
  upperCloudSignal,

  // 核心评分模块
  checkTimeWindow,
  cloudTypeClassifier,
  geometricLightModel,
  scoreCloudCanvas,
  scoreAerosolCarrier,
  scoreDirectionalCurtainCarrier,
  scoreRemoteLayerCarriers,
  scoreVisibleSectorCarrier,
  buildCarrierScore,
  scoreLightPath,
  scoreRendering,
  calculateLightPathPointScore,

  // 综合评分
  calculateFinalScore,
  getQualityLevel,
  checkSolarOcclusion,
  applySevereWeatherCap,
  assessAerosolHazeCap,
  assessHighCloudCarrierAdjustment,
  assessClearSunsetViewingAdvice,

  // 云厚评估（Phase 22）
  assessCloudThickness,
  assessThickHighCloudPenalty,

  // 主函数
  calculateEnhancedPrediction,
  calculateMapSimplifiedPrediction,
  calculateBatchEnhancedPredictions
};
