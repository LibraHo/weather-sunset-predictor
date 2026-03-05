/**
 * 预测数据时序验证器
 * 用于检查 API 返回的天气数据是否出现乱序、重复、大量缺口等质量问题
 */
class ForecastSequenceValidator {
  /**
   * 验证并修复数据时序
   * @param {Array<Object>} data - 原始天气预测数据数组
   * @returns {{ validData: Array<Object>, quality: string, issues: Array<string> }}
   * @throws {Error} 当数据严重损坏无法修复时抛出异常
   */
  validateAndRepair(data) {
    if (!data || !Array.isArray(data) || data.length === 0) {
      throw new Error('ForecastSequenceValidator: 数据为空或格式不正确');
    }

    const issues = [];
    let quality = 'excellent'; // excellent | degraded | poor

    // 首先检测乱序和重复（使用集合检查全局重复，使用循环检查相邻乱序）
    let isOutOfOrder = false;
    let hasDuplicates = false;
    const seenTimestamps = new Set();

    for (let i = 0; i < data.length; i++) {
      if (seenTimestamps.has(data[i].timestamp)) {
        hasDuplicates = true;
      }
      seenTimestamps.add(data[i].timestamp);
      
      if (i > 0 && data[i].timestamp < data[i - 1].timestamp) {
        isOutOfOrder = true;
      }
    }

    let uniqueData = data;
    if (isOutOfOrder || hasDuplicates) {
      if (isOutOfOrder) issues.push('数据时序错乱，已重新排序');
      if (hasDuplicates) issues.push('存在重复的时间戳，已去重');
      quality = 'degraded';

      const dataMap = new Map();
      for (const item of data) {
        // 如果有重复的，这里用后者覆盖前者（或者保留前者，这里用覆盖）
        dataMap.set(item.timestamp, item);
      }
      uniqueData = Array.from(dataMap.values()).sort((a, b) => a.timestamp - b.timestamp);
    }

    // 2. 缺口检测（Hourly 数据应该相隔 3600000 毫秒 / 1小时，但也可能是 3小时 Windy 免费版的跨度）
    // 如果最大缺口超过 6 小时，认为数据有严重断层
    let maxGapHours = 0;
    for (let i = 1; i < uniqueData.length; i++) {
      const gapMs = uniqueData[i].timestamp - uniqueData[i - 1].timestamp;
      const gapHours = gapMs / (1000 * 60 * 60);
      if (gapHours > maxGapHours) {
        maxGapHours = gapHours;
      }
    }

    if (maxGapHours > 3 && maxGapHours <= 6) {
      issues.push(`存在最大 ${maxGapHours} 小时的数据缺口`);
      quality = 'degraded';
    } else if (maxGapHours > 6) {
      // 超过6小时的缺口，数据质量太差，直接拒绝并交由兜底服务处理
      throw new Error(`ForecastSequenceValidator: 数据存在严重的缺口 (${maxGapHours} 小时)`);
    }

    // 3. 总量检查
    if (uniqueData.length < 12) {
      throw new Error(`ForecastSequenceValidator: 数据条数过少 (${uniqueData.length} 条)`);
    }

    return {
      validData: uniqueData,
      quality: quality,
      issues: issues
    };
  }
}

module.exports = new ForecastSequenceValidator();
module.exports.ForecastSequenceValidator = ForecastSequenceValidator;
