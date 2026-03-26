/**
 * UnifiedSunsetScoringService - 统一火烧云评分服务
 *
 * 为所有预测模块提供统一的火烧云质量评分算法
 * 使用云层结构、大气透明度、云层立体感三个维度进行评分
 * 并通过乘性惩罚系数修正最终得分
 */

class UnifiedSunsetScoringService {
  /**
   * 计算火烧云综合评分
   *
   * @param {Object} weatherData - 天气数据
   * @param {number} weatherData.cloudCover   - 总云量 0-100%
   * @param {number} weatherData.highClouds   - 高云（>6km）0-100%
   * @param {number} weatherData.midClouds    - 中云（2-6km）0-100%
   * @param {number} weatherData.lowClouds    - 低云（<2km）0-100%
   * @param {number} weatherData.visibility   - 能见度 km
   * @param {number} weatherData.humidity     - 湿度 0-100%
   * @param {number} weatherData.precipitation - 降水 mm/h
   * @returns {{ score: number, quality: string, breakdown: Object }}
   */
  calculate(weatherData) {
    const highClouds = weatherData.highClouds ?? 0;
    const midClouds = weatherData.midClouds ?? 0;
    const lowClouds = weatherData.lowClouds ?? 0;
    const visibility = weatherData.visibility ?? 10;
    const humidity = weatherData.humidity ?? 50;
    const precipitation = weatherData.precipitation ?? 0;

    // ── 第一步：基础分 ────────────────────────────────────────────────

    // ① 云层结构（60分）
    const highCloudsScore = 25 * Math.exp(-Math.pow(highClouds - 50, 2) / (2 * 20 * 20));
    const midCloudsScore  = 25 * Math.exp(-Math.pow(midClouds - 35, 2)  / (2 * 15 * 15));
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

    let finalScore = baseScore * lowCloudPenalty * precipPenalty;
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
      finalScore
    };

    return { score: finalScore, quality, breakdown };
  }
}

export default UnifiedSunsetScoringService;
