/**
 * LightPathV2Service - 光路评分 V2 物理重构
 *
 * 基于物理遮挡的多点采样算法，替代旧的经验型两点模型。
 * 需求：35，任务：55/59
 *
 * 算法流程：
 * 1. 沿光路在太阳反向方向采样 3 个点（20/50/100km）
 * 2. 各点计算 criticalElevation = atan(cloudBaseHeight / distanceMeters) * (180/π)
 * 3. 单点遮挡强度：block_i = sigmoid(criticalElevation_i - solarElevation) * layerWeight_i
 * 4. 全路径遮挡：occlusionProbability = 1 - Π(1 - block_i)
 * 5. 光路分：lightPathScore = 100 * (1 - occlusionProbability)
 */

// ========== 常量 ==========

const SAMPLE_DISTANCES_KM = [20, 50, 100];

const LAYER_WEIGHTS = {
  LOW:  0.7,
  MID:  0.2,
  HIGH: 0.1
};

// 需要封顶的恶劣天气码（WMO）
const PRECIPITATION_WEATHER_CODES = new Set([
  51, 53, 55,           // 毛毛雨
  61, 63, 65,           // 雨
  71, 73, 75, 77,       // 雪
  80, 81, 82,           // 阵雨
  85, 86,               // 阵雪
  95, 96, 99            // 雷暴
]);

// ========== 辅助函数 ==========

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

/**
 * 估算云底高度（当 weatherData 未提供时的回退）
 */
function estimateCloudBaseHeight(weatherData) {
  const low = weatherData.lowClouds || 0;
  const mid = weatherData.midClouds || 0;
  if (low > 60) return 700;
  if (low > 30) return 1000;
  if (mid > 50) return 1800;
  return 2200;
}

// ========== 核心算法 ==========

/**
 * 计算单点遮挡强度
 * @param {number} cloudBaseHeight - 云底高度（米）
 * @param {number} distanceKm - 采样距离（km）
 * @param {number} solarElevation - 太阳高度角（度）
 * @param {number} lowClouds - 低云量（0-100）
 * @param {number} midClouds - 中云量（0-100）
 * @param {number} highClouds - 高云量（0-100）
 * @returns {Object} 单点采样结果
 */
function computeSampleBlock(cloudBaseHeight, distanceKm, solarElevation, lowClouds, midClouds, highClouds) {
  const distanceMeters = distanceKm * 1000;
  const criticalElevation = Math.atan(cloudBaseHeight / distanceMeters) * (180 / Math.PI);

  const lowBlock  = sigmoid(criticalElevation - solarElevation) * LAYER_WEIGHTS.LOW  * (lowClouds  / 100);
  const midBlock  = sigmoid(criticalElevation - solarElevation) * LAYER_WEIGHTS.MID  * (midClouds  / 100);
  const highBlock = sigmoid(criticalElevation - solarElevation) * LAYER_WEIGHTS.HIGH * (highClouds / 100);

  const block = Math.min(1, lowBlock + midBlock + highBlock);

  return {
    distanceKm,
    cloudBaseHeight,
    criticalElevation: parseFloat(criticalElevation.toFixed(2)),
    block: parseFloat(block.toFixed(4))
  };
}

/**
 * 计算光路评分 V2
 *
 * @param {Object} params
 * @param {number} params.solarElevation   - 太阳高度角（度）
 * @param {number} params.solarAzimuth     - 太阳方位角（度）
 * @param {number|null} params.cloudBaseHeight  - 云底高度（米，可为 null）
 * @param {number} params.lowClouds        - 低云量（0-100）
 * @param {number} params.midClouds        - 中云量（0-100）
 * @param {number} params.highClouds       - 高云量（0-100）
 * @param {number} params.cloudCover       - 总云量（0-100）
 * @param {number} params.precipitation    - 降水量（mm/h）
 * @param {number} params.convPrecip       - 对流降水（mm/h）
 * @param {number|null} params.weatherCode - WMO 天气码
 * @returns {Object} 光路评分结果
 */
function scoreLightPathV2(params) {
  const {
    solarElevation = 0,
    solarAzimuth = 270,
    cloudBaseHeight: rawCloudBaseHeight = null,
    lowClouds = 0,
    midClouds = 0,
    highClouds = 0,
    cloudCover = 0,
    precipitation = 0,
    convPrecip = 0,
    weatherCode = null
  } = params || {};

  // 云底高度：优先使用传入值，回退到估算
  const cloudBaseHeight = (typeof rawCloudBaseHeight === 'number' && Number.isFinite(rawCloudBaseHeight) && rawCloudBaseHeight > 0)
    ? rawCloudBaseHeight
    : estimateCloudBaseHeight({ lowClouds, midClouds });

  // 1. 沿光路采样 3 点
  const samples = SAMPLE_DISTANCES_KM.map(distanceKm =>
    computeSampleBlock(cloudBaseHeight, distanceKm, solarElevation, lowClouds, midClouds, highClouds)
  );

  // 2. 全路径遮挡概率：1 - Π(1 - block_i)
  const occlusionProbability = 1 - samples.reduce((prod, s) => prod * (1 - s.block), 1);

  // 3. 光路分
  let lightPathScore = 100 * (1 - occlusionProbability);

  // 4. 恶劣天气硬封顶
  let capReason = null;

  const isPrecipCode = typeof weatherCode === 'number' && PRECIPITATION_WEATHER_CODES.has(weatherCode);
  const hasPrecipitation = precipitation > 0.5 || convPrecip > 0.5 || isPrecipCode;

  // 低云也参与封顶判断：低云>=85 视同 overcast
  const isOvercast = cloudCover >= 85 || lowClouds >= 85;

  if (isOvercast && hasPrecipitation) {
    // 同时命中取更严格上限（overcast_cap_40 < precipitation_cap_50）
    lightPathScore = Math.min(lightPathScore, 40);
    capReason = 'overcast_cap_40';
  } else if (isOvercast) {
    lightPathScore = Math.min(lightPathScore, 40);
    capReason = 'overcast_cap_40';
  } else if (hasPrecipitation) {
    lightPathScore = Math.min(lightPathScore, 50);
    capReason = 'precipitation_cap_50';
  }

  // 5. 任务59：异常告警
  if (isOvercast && lightPathScore > 60) {
    console.warn(`[LightPathV2] ANOMALY: cloudCover=${cloudCover} lowClouds=${lowClouds} but lightPathScore=${lightPathScore.toFixed(1)} > 60`);
  }

  const explain = capReason
    ? (capReason === 'overcast_cap_40' ? '阴天触发光路分封顶40' : '降水触发光路分封顶50')
    : (lightPathScore >= 70 ? '光路通畅' : lightPathScore >= 40 ? '光路部分遮挡' : '光路严重遮挡');

  return {
    score: parseFloat(lightPathScore.toFixed(1)),
    occlusionProbability: parseFloat(occlusionProbability.toFixed(4)),
    samples,
    capReason,
    explain
  };
}

/**
 * 兼容接口：从 weatherData 对象中提取参数并调用 V2 算法
 * 支持回滚开关：LIGHT_PATH_V2_ENABLED=false 时返回 null（调用方回退旧算法）
 *
 * @param {Object} weatherData
 * @param {number} solarElevation
 * @param {number} solarAzimuth
 * @returns {Object|null}
 */
function scoreFromWeatherData(weatherData, solarElevation, solarAzimuth) {
  if (process.env.LIGHT_PATH_V2_ENABLED === 'false') {
    return null;
  }

  return scoreLightPathV2({
    solarElevation,
    solarAzimuth,
    cloudBaseHeight: weatherData.cloudBaseHeight ?? null,
    lowClouds:       weatherData.lowClouds  || 0,
    midClouds:       weatherData.midClouds  || 0,
    highClouds:      weatherData.highClouds || 0,
    cloudCover:      weatherData.cloudCover || 0,
    precipitation:   weatherData.precipitation || 0,
    convPrecip:      weatherData.convPrecip || 0,
    weatherCode:     weatherData.weatherCode ?? null
  });
}

// ========== 导出 ==========

module.exports = {
  scoreLightPathV2,
  scoreFromWeatherData,
  SAMPLE_DISTANCES_KM,
  LAYER_WEIGHTS,
  PRECIPITATION_WEATHER_CODES
};
