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
  const upperCloudCover = highClouds * CLOUD_WEIGHTS.HIGH + midClouds * CLOUD_WEIGHTS.MID;
  const effectiveCloudCover = upperCloudCover + lowClouds * CLOUD_WEIGHTS.LOW;

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

  // 最终画布得分
  let canvasScore = cloudRangeScore * lowCloudPenalty * overcastPenalty;

  // 高云主导场景加分：当 highClouds > 50% 且 lowClouds < 30% 时，增加 bonus 系数
  let highCloudBonus = 1.0;
  if (highClouds > 50 && lowClouds < 30) {
    highCloudBonus = 1.20; // 1.15~1.2 之间，让画布分达到 75+
    canvasScore = canvasScore * highCloudBonus;
  }

  return {
    score: canvasScore,
    effectiveCloudCover: parseFloat(effectiveCloudCover.toFixed(1)),
    cloudRangeScore: parseFloat(cloudRangeScore.toFixed(1)),
    cloudLevel,
    lowCloudPenalty: parseFloat(lowCloudPenalty.toFixed(2)),
    overcastPenalty: parseFloat(overcastPenalty.toFixed(2)),
    highCloudBonus: parseFloat(highCloudBonus.toFixed(2)),
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

// ========== 云厚评估模块（Phase 22）==========

/**
 * 云厚评估：区分“薄卷云（好幕布）”和“厚云幕（压光）”
 *
 * 三维判定：
 * 1. 辐射法：直射比 = direct / shortwave（低 = 厚云）
 * 2. 水汽法：waterVapour × cloudCover / 100（高 = 含水量大 = 厚云）
 * 3. 天气码兜底：WMO 阴天码直接标厚
 *
 * @param {Object} weatherData - 天气数据（目标时刻）
 * @param {Object|null} prevHourData - 目标时刻前1-2小时的数据（用于辐射比，避免日落时辐射自然为0）
 * @returns {{ thickness: 'thin'|'moderate'|'thick'|'unknown', modifier: number, reasons: string[] }}
 */
function assessCloudThickness(weatherData, prevHourData = null) {
  const cc = weatherData.cloudCover || 0;
  const weatherCode = weatherData.weatherCode;
  const wv = weatherData.waterVapourColumn;

  const signals = []; // 收集判定信号
  let score = 0;      // 正=薄云，负=厚云

  // --- 辐射信号：优先用前1-2小时数据（太阳还有高度），回退用当前时刻 ---
  // 日落时 direct 自然为 0，不代表厚云
  const MIN_SHORTWAVE = 50; // 短波辐射最低阈值，低于此值辐射数据不可靠
  let sw = weatherData.shortwaveRadiation;
  let dr = weatherData.directRadiation;
  let df = weatherData.diffuseRadiation;
  let usedPrevHour = false;

  if ((sw == null || sw < MIN_SHORTWAVE) && prevHourData) {
    const pSw = prevHourData.shortwaveRadiation;
    if (pSw != null && pSw >= MIN_SHORTWAVE) {
      sw = pSw;
      dr = prevHourData.directRadiation;
      df = prevHourData.diffuseRadiation;
      usedPrevHour = true;
    }
  }

  // --- 信号1：直射比 ---
  if (sw != null && dr != null && sw > MIN_SHORTWAVE) {
    const directRatio = dr / sw;
    if (directRatio > 0.6)      { score += 2; signals.push('direct_ratio_high'); }
    else if (directRatio > 0.35) { score += 1; signals.push('direct_ratio_moderate'); }
    else if (directRatio < 0.15) { score -= 2; signals.push('direct_ratio_low'); }
    else                          { score -= 1; signals.push('direct_ratio_low_moderate'); }
    if (usedPrevHour) signals.push('using_prev_hour_radiation');
  }

  // --- 信号2：水汽指数 ---
  if (wv != null) {
    const waterIndex = wv * cc / 100;
    if (waterIndex < 2.5)      { score += 2; signals.push('water_vapour_low'); }
    else if (waterIndex < 4.5) { /* 适中，不加减 */ signals.push('water_vapour_moderate'); }
    else if (waterIndex < 7)   { score -= 1; signals.push('water_vapour_high'); }
    else                       { score -= 2; signals.push('water_vapour_very_high'); }
  }

  // --- 信号3：散射比 ---
  if (sw != null && df != null && sw > MIN_SHORTWAVE) {
    const diffuseRatio = df / sw;
    if (diffuseRatio > 0.7)     { score -= 1; signals.push('diffuse_dominant'); }
    else if (diffuseRatio < 0.3){ score += 1; signals.push('direct_dominant'); }
  }

  // --- 信号4：天气码兜底 ---
  // WMO code 3 = 阴天
  if (weatherCode === 3) { score -= 2; signals.push('wmo_overcast'); }
  // WMO code 45/48 = 雾
  if (weatherCode === 45 || weatherCode === 48) { score -= 2; signals.push('wmo_fog'); }

  // --- 综合判定 ---
  const hasAnySignal = signals.length > 0;

  if (!hasAnySignal) {
    return { thickness: 'unknown', modifier: 1.0, reasons: ['no_cloud_thickness_data'] };
  }

  let thickness, modifier;
  if (score >= 2) {
    thickness = 'thin';
    modifier = 1.1;    // 薄云加分
  } else if (score >= 0) {
    thickness = 'moderate';
    modifier = 1.0;
  } else if (score >= -2) {
    thickness = 'moderate';
    modifier = 0.75;   // 偏厚，适度压分
  } else {
    thickness = 'thick';
    modifier = 0.45;   // 厚云幕，大幅压分
  }

  return { thickness, modifier, reasons: signals, score };
}

/**
 * 厚高云惩罚：高云虽是火烧云画布，但当高云覆盖很高且云厚信号明确时，
 * 实际常表现为整片云幕遮光，仅日落方向局部透光，不能给优秀分。
 */
function assessThickHighCloudPenalty(weatherData, cloudThickness) {
  const cloudCover = weatherData.cloudCover || 0;
  const lowClouds = weatherData.lowClouds || 0;
  const highClouds = weatherData.highClouds || 0;
  const reasons = cloudThickness?.reasons || [];

  const isHighCloudCurtain = highClouds >= 80 && cloudCover >= 60 && lowClouds < 20;
  const isThick = cloudThickness?.thickness === 'thick' || cloudThickness?.modifier <= 0.5;
  const directWeak = reasons.includes('direct_ratio_low') || reasons.includes('direct_ratio_low_moderate');
  const diffuseDominant = reasons.includes('diffuse_dominant');
  const waterHeavy = reasons.includes('water_vapour_very_high');

  if (!isHighCloudCurtain || !isThick || !(directWeak || diffuseDominant || waterHeavy)) {
    return { applied: false, cap: null, reason: null };
  }

  // 直射很弱 + 漫射主导：整片厚云幕，只能期待局部边缘光，接近现场 35–45 分。
  const cap = (directWeak && diffuseDominant) ? 42 : 48;

  return {
    applied: true,
    cap,
    reason: directWeak && diffuseDominant
      ? 'thick_high_cloud_diffuse_cap_42'
      : 'thick_high_cloud_cap_48'
  };
}

function getAerosolMetrics(weatherData) {
  const aod = Number(weatherData.aerosolOpticalDepth ?? weatherData.aod);
  const pm25 = Number(weatherData.pm2_5 ?? weatherData.pm25);
  const pm10 = Number(weatherData.pm10);
  const dust = Number(weatherData.dust);
  return {
    aod: Number.isFinite(aod) ? aod : null,
    pm25: Number.isFinite(pm25) ? pm25 : null,
    pm10: Number.isFinite(pm10) ? pm10 : null,
    dust: Number.isFinite(dust) ? dust : null
  };
}

/**
 * 灰幕/沙尘封顶：高云存在但空气光学条件失效时，不能按“高云画布”给乐观分。
 */
function assessAerosolHazeCap(weatherData) {
  const lowClouds = weatherData.lowClouds || 0;
  const highClouds = weatherData.highClouds || 0;
  const visibility = weatherData.visibility ?? 20;
  const { aod, pm25, pm10, dust } = getAerosolMetrics(weatherData);

  const hasUpperCloudCarrier = highClouds >= 65 && lowClouds <= 20;
  const extremeHaze = (aod != null && aod >= 0.8) || (dust != null && dust >= 300) || (pm10 != null && pm10 >= 250);
  const severeHaze = (aod != null && aod >= 0.55) || (dust != null && dust >= 150) || (pm10 != null && pm10 >= 180) || (pm25 != null && pm25 >= 90) || visibility < 6;
  const moderateHaze = (aod != null && aod >= 0.45) || (dust != null && dust >= 80) || (pm10 != null && pm10 >= 120) || visibility < 8;

  if (hasUpperCloudCarrier && extremeHaze) {
    return { applied: true, cap: 28, level: 'extreme', reason: 'extreme_dust_haze_cap_28', metrics: { aod, pm25, pm10, dust, visibility } };
  }

  if (hasUpperCloudCarrier && severeHaze) {
    return { applied: true, cap: 35, level: 'severe', reason: 'severe_haze_cap_35', metrics: { aod, pm25, pm10, dust, visibility } };
  }

  if (hasUpperCloudCarrier && moderateHaze) {
    return { applied: true, cap: 45, level: 'moderate', reason: 'moderate_haze_cap_45', metrics: { aod, pm25, pm10, dust, visibility } };
  }

  return { applied: false, cap: null, level: null, reason: null, metrics: { aod, pm25, pm10, dust, visibility } };
}

/**
 * 高云载体保底：高云充足、低云稀少、空气不灰时，避免日落低辐射或水汽信号把分数打穿。
 */
function assessHighCloudCarrierAdjustment(weatherData, aerosolHazeCap) {
  const lowClouds = weatherData.lowClouds || 0;
  const midClouds = weatherData.midClouds || 0;
  const highClouds = weatherData.highClouds || 0;
  const visibility = weatherData.visibility ?? 20;
  const precipitation = weatherData.precipitation || 0;

  if (aerosolHazeCap?.applied || precipitation > 0.2) {
    return { applied: false, floor: null, reason: null };
  }

  const { aod, pm10, dust } = getAerosolMetrics(weatherData);
  const airClearEnough = visibility >= 15 && (aod == null || aod <= 0.45) && (pm10 == null || pm10 < 120) && (dust == null || dust < 80);
  const carrierStrong = highClouds >= 85 && lowClouds <= 10 && airClearEnough;

  if (!carrierStrong) {
    return { applied: false, floor: null, reason: null };
  }

  if (midClouds >= 45 || highClouds >= 95) {
    return { applied: true, floor: 68, reason: 'clear_upper_cloud_carrier_floor_68' };
  }

  return { applied: true, floor: 64, reason: 'clear_high_cloud_carrier_floor_64' };
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

  const distances = [20, 50, 100];
  return distances.map((distanceKm) => {
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
  const block = Math.max(0, Math.min(1, geometryBlock * 0.6 + layerOpacity * 0.4));

  return {
    distanceKm: Dkm,
    cloudBaseHeight: sample.cloudBaseHeight,
    criticalElevation: parseFloat(criticalElevation.toFixed(2)),
    block: parseFloat(block.toFixed(3))
  };
}

/**
 * 第三模块：光路逻辑（物理重构版）
 * 基于太阳高度角 + 云底高度 + 多点采样估算光路遮挡概率。
 */
function scoreLightPath(weatherData, solarElevation, azimuth, remoteCloudData = null) {
  const distanceWeights = [0.2, 0.3, 0.5]; // 20/50/100km

  let samples = [];
  let hasRemoteData = false;

  if (remoteCloudData && Array.isArray(remoteCloudData.samples) && remoteCloudData.samples.length >= 3) {
    hasRemoteData = true;
    samples = remoteCloudData.samples.slice(0, 3);
  } else {
    samples = buildLocalLightPathSamples(weatherData);
  }

  const sampleResults = samples.map((s, i) => {
    const r = calcSampleBlock(s, solarElevation);
    return { ...r, weightedBlock: r.block * (distanceWeights[i] || 0.3) };
  });

  // 低云少时降低遮挡概率计算权重（低云少=光路通畅）
  const lowClouds = weatherData.lowClouds || 0;
  let occlusionWeight = 1.0;
  if (lowClouds < 20) {
    occlusionWeight = 0.7; // 低云极少，光路通畅，降低遮挡影响
  } else if (lowClouds < 30) {
    occlusionWeight = 0.85; // 低云较少，光路较通畅
  }

  const rawOcclusionProbability = 1 - sampleResults.reduce((prod, s) => prod * (1 - s.weightedBlock), 1);
  const occlusionProbability = rawOcclusionProbability * occlusionWeight;
  let lightPathScore = 100 * (1 - occlusionProbability);

  // 恶劣天气硬封顶（作用于光路分本身）
  const cloudCover = weatherData.cloudCover || 0;
  const precipitation = weatherData.precipitation || 0;
  const convPrecip = weatherData.convPrecip || 0;
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
    occlusionProbability: parseFloat(occlusionProbability.toFixed(3)),
    samples: sampleResults.map(({ distanceKm, cloudBaseHeight, criticalElevation, block }) => ({
      distanceKm,
      cloudBaseHeight,
      criticalElevation,
      block
    })),
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
      aerosolFactor = 0.95;
      aerosolLevel = 'high';
    } else {
      aerosolFactor = 0.88;
      aerosolLevel = 'very_high';
    }

    const particulateModerate = pm25 > 35 || pm10 > 80 || dust > 50;
    const particulateHigh = pm25 > 75 || pm10 > 150 || dust > 100;
    if (particulateHigh) {
      aerosolFactor = Math.min(aerosolFactor, 0.85);
      aerosolLevel = 'polluted';
    } else if (particulateModerate) {
      aerosolFactor = Math.min(aerosolFactor, 0.94);
      aerosolLevel = aerosolLevel === 'optimal' ? 'moderate_pollution' : aerosolLevel;
    }
    if (visibility < 8 && (aerosolOpticalDepth > 0.35 || particulateModerate)) {
      aerosolFactor = Math.min(aerosolFactor, 0.85);
      aerosolLevel = 'low_visibility_haze';
    }
  }

  // 最终渲染系数 = 能见度 × 湿度 × 雨后加成 × AQI 修正 × 气溶胶修正
  const renderingFactor = visibilityFactor * humidityFactor * rainBonus * aqiFactor * aerosolFactor;

  return {
    factor: parseFloat(renderingFactor.toFixed(2)),
    visibilityFactor: parseFloat(visibilityFactor.toFixed(2)),
    humidityFactor: parseFloat(humidityFactor.toFixed(2)),
    rainBonus: parseFloat(rainBonus.toFixed(2)),
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
  if (score >= 70) return 'excellent';
  if (score >= 40) return 'good';
  return 'fair';
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

  // 阴天+真雾霾（能见度极差）：远处泛橙水平，最多给15分
  const visibility = weatherData.visibility ?? 20;
  if (cloudCover >= 95 && visibility <= 5) {
    return { score: Math.min(score, 15), reason: 'overcast_fog_cap_15' };
  }

  return { score, reason: null };
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
  if (isVeryLowCloud) {
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

  const { remoteCloudData = null, rainedRecently = false, prevHourData = null } = options;

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

  // 3. 画布评分（本地云况）+ 云种乘数
  const canvasScoreRaw = scoreCloudCanvas(weatherData);
  const canvasScore = {
    ...canvasScoreRaw,
    score: Math.min(100, parseFloat((canvasScoreRaw.score * cloudType.canvasMultiplier).toFixed(1)))
  };
  logger.debug('[EnhancedPredictionService]', '画布评分(含云种):', canvasScore.score);

  // 3.5 光路几何模型（需求40）——预测开始时间 + 持续时长
  const cloudBaseM = estimateCloudBaseHeight(weatherData);
  const geometric = geometricLightModel(timeCheck.elevation, cloudBaseM / 1000, lat);
  logger.debug('[EnhancedPredictionService]', '光路几何:', geometric.feasible ? '可行' : '不可行', '开始偏移(min):', geometric.startOffsetMin, '持续(min):', geometric.durationMin);

  const azimuth = calculateSolarAzimuth(dateObj, lat, lon);
  // 优先使用 V2 物理重构算法（回滚开关：LIGHT_PATH_V2_ENABLED=false）
  const v2Result = LightPathV2Service.scoreFromWeatherData(weatherData, timeCheck.elevation, azimuth);
  const lightPathScoreRaw = v2Result !== null
    ? { ...v2Result, hasRemoteData: false, nearPointScore: v2Result.score, farPointScore: v2Result.score, breakdown: { nearPointCloudCover: weatherData.cloudCover || 0, farPointCloudCover: weatherData.cloudCover || 0 } }
    : scoreLightPath(weatherData, timeCheck.elevation, azimuth, remoteCloudData);
  const lightPathScore = {
    ...lightPathScoreRaw,
    score: Math.min(100, parseFloat((lightPathScoreRaw.score * cloudType.lightPathMultiplier).toFixed(1)))
  };
  logger.debug('[EnhancedPredictionService]', '光路评分(含云种):', lightPathScore.score);

  // 4. 渲染修正（画质系数）
  const renderingFactor = scoreRendering(weatherData, rainedRecently);
  logger.debug('[EnhancedPredictionService]', '渲染修正:', renderingFactor.factor);

  // 5. 云厚评估（Phase 22）
  const cloudThickness = assessCloudThickness(weatherData, prevHourData);
  logger.debug('[EnhancedPredictionService]', '云厚评估:', cloudThickness.thickness, 'modifier:', cloudThickness.modifier, 'reasons:', cloudThickness.reasons);

  // 5.5 云厚修正画布分
  if (cloudThickness.modifier !== 1.0) {
    const originalCanvasScore = canvasScore.score;
    canvasScore.score = Math.min(100, parseFloat((canvasScore.score * cloudThickness.modifier).toFixed(1)));
    canvasScore.cloudThicknessModifier = cloudThickness.modifier;
    canvasScore.cloudThickness = cloudThickness.thickness;
    logger.debug('[EnhancedPredictionService]', '云厚修正画布分:', originalCanvasScore, '->', canvasScore.score);
  }

  // 5.6 厚高云惩罚：厚高云不再被简单视为理想画布
  const thickHighCloudPenalty = assessThickHighCloudPenalty(weatherData, cloudThickness);
  if (thickHighCloudPenalty.applied) {
    const originalLightPathScore = lightPathScore.score;
    lightPathScore.score = Math.min(lightPathScore.score, 55);
    lightPathScore.thickHighCloudPenalty = thickHighCloudPenalty;
    lightPathScore.scoreBeforeThickHighCloudPenalty = originalLightPathScore;
    logger.debug('[EnhancedPredictionService]', '厚高云修正光路分:', originalLightPathScore, '->', lightPathScore.score, thickHighCloudPenalty.reason);
  }

  // 6. 综合输出
  const finalResult = calculateFinalScore(canvasScore, lightPathScore, renderingFactor, type);

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
    adjustedStatus = adjustedScore < 40 ? 'light_glow' : 'good_glow';
    adjustedDescription = 'weak_local_colors';
  }

  // 6.8 气溶胶/沙尘灰幕封顶 + 清透高云载体保底（2026-05-06 北京/喀什反例）
  const aerosolHazeCap = assessAerosolHazeCap(weatherData);
  const highCloudCarrierAdjustment = assessHighCloudCarrierAdjustment(weatherData, aerosolHazeCap);

  if (highCloudCarrierAdjustment.applied) {
    adjustedScore = Math.max(adjustedScore, highCloudCarrierAdjustment.floor);
    if (adjustedScore >= 65) {
      adjustedStatus = 'very_likely';
      adjustedDescription = 'excellent_conditions';
    }
  }

  if (aerosolHazeCap.applied) {
    adjustedScore = Math.min(adjustedScore, aerosolHazeCap.cap);
    adjustedStatus = adjustedScore < 40 ? 'no_fire_cloud' : 'light_glow';
    adjustedDescription = aerosolHazeCap.level === 'extreme' ? 'haze_light_suppressed' : 'weak_local_colors';
  }

  // 7. 恶劣天气硬性封顶
  const severeCap = applySevereWeatherCap(adjustedScore, weatherData);
  adjustedScore = severeCap.score;
  if (severeCap.reason && adjustedScore < 40) {
    adjustedStatus = 'no_fire_cloud';
    adjustedDescription = 'cloud_too_thick';
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
    score: adjustedScore,
    quality: getQualityLevel(adjustedScore),
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
      cloudBoundaryKm:      geometric.cloudBoundaryKm,
      startOffsetMin:       geometric.startOffsetMin,
      durationMin:         geometric.durationMin,
      vsun:                geometric.vsun
    },
    ...finalResult,
    breakdown: {
      ...finalResult.breakdown,
      aerosolScattering
    },
    aerosolOpticalDepth: aerosolScattering.aerosolOpticalDepth,
    dust: aerosolScattering.dust,
    pm2_5: aerosolScattering.pm2_5,
    pm10: aerosolScattering.pm10,
    aqi: weatherData.aqi ?? null,
    cloudThickness: {
      thickness: cloudThickness.thickness,
      modifier: cloudThickness.modifier,
      reasons: cloudThickness.reasons
    },
    thickHighCloudPenalty,
    aerosolHazeCap,
    highCloudCarrierAdjustment,
    status: adjustedStatus,
    description: adjustedDescription,
    scoreBeforeOcclusion: finalResult.score,
    score: adjustedScore
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
  cloudTypeClassifier,
  geometricLightModel,
  scoreCloudCanvas,
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

  // 云厚评估（Phase 22）
  assessCloudThickness,
  assessThickHighCloudPenalty,

  // 主函数
  calculateEnhancedPrediction,
  calculateBatchEnhancedPredictions
};
