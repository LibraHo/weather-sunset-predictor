/**
 * SunCalculator - 太阳位置计算工具
 *
 * 基于 NOAA 太阳计算器算法，提供日出日落时间、黄金时段、蓝调时段等计算
 *
 * 需求：22.2 - 日出日落计算工具
 *
 * @module server/utils/SunCalculator
 */

/**
 * 计算年份中的第几天
 * @param {Date} date - 日期对象
 * @returns {number} 年份中的第几天 (1-366)
 */
function getDayOfYear(date) {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  return Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000)) + 1;
}

/**
 * 计算分数年（fractional year）
 * @param {number} dayOfYear - 年份中的第几天
 * @returns {number} 分数年（弧度）
 */
function getFractionalYear(dayOfYear) {
  return (2 * Math.PI / 365) * (dayOfYear - 1);
}

/**
 * 计算时间方程（Equation of Time）
 * @param {number} fractionalYear - 分数年（弧度）
 * @returns {number} 时间方程值（分钟）
 */
function getEquationOfTime(fractionalYear) {
  return 229.18 * (
    0.000075 +
    0.001868 * Math.cos(fractionalYear) -
    0.032077 * Math.sin(fractionalYear) -
    0.014615 * Math.cos(2 * fractionalYear) -
    0.040849 * Math.sin(2 * fractionalYear)
  );
}

/**
 * 计算太阳赤纬（Solar Declination）
 * @param {number} fractionalYear - 分数年（弧度）
 * @returns {number} 太阳赤纬（弧度）
 */
function getSolarDeclination(fractionalYear) {
  return 0.006918 -
    0.399912 * Math.cos(fractionalYear) +
    0.070257 * Math.sin(fractionalYear) -
    0.006758 * Math.cos(2 * fractionalYear) +
    0.000907 * Math.sin(2 * fractionalYear) -
    0.002697 * Math.cos(3 * fractionalYear) +
    0.00148 * Math.sin(3 * fractionalYear);
}


/**
 * 解析预测地点实际使用的法定时区偏移。
 *
 * 时间系统规则：
 * 1. 首选 IANA timezone（如 Asia/Shanghai / Asia/Kuala_Lumpur），它代表当地实际法定时间，含 DST。
 * 2. 禁止使用用户浏览器/服务器时区。
 * 3. 只有缺少 IANA timezone 时，才按经度粗略兜底。
 *
 * @param {Date} date - 目标日期/instant
 * @param {number} lon - 经度
 * @param {string|null} timeZone - IANA timezone
 * @returns {number} UTC offset hours
 */
function getTargetTimezoneOffsetHours(date, lon, timeZone = null) {
  if (timeZone && typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).formatToParts(date);

      const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
      const asUtc = Date.UTC(
        Number(values.year),
        Number(values.month) - 1,
        Number(values.day),
        Number(values.hour),
        Number(values.minute),
        Number(values.second)
      );

      return (asUtc - date.getTime()) / 3600000;
    } catch (error) {
      console.warn('[SunCalculator] 无法解析目标时区，回退到经度估算:', timeZone, error.message);
    }
  }

  return Math.round(lon / 15);
}

/**
 * 用目标地点本地日期/时间构造真实 UTC instant。
 * @param {Date} date - 目标日期
 * @param {number} dayOffset - 跨日偏移
 * @param {number} hours - 目标地点本地小时
 * @param {number} minutes - 目标地点本地分钟
 * @param {number} timezoneOffsetHours - 目标地点 UTC offset hours
 * @returns {Date}
 */
function createDateFromTargetLocalTime(date, dayOffset, hours, minutes, timezoneOffsetHours) {
  return new Date(Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + dayOffset,
    hours - timezoneOffsetHours,
    minutes,
    0,
    0
  ));
}

/**
 * 按目标地点 IANA timezone 格式化 HH:mm。
 * @param {Date|string|number} time - 时间
 * @param {string|null} timeZone - IANA timezone
 * @param {string} locale - locale
 * @returns {string}
 */
function formatTimeForZone(time, timeZone = null, locale = 'zh-CN') {
  const date = time instanceof Date ? time : new Date(time);
  if (!date || Number.isNaN(date.getTime())) return '--:--';

  if (timeZone) {
    return new Intl.DateTimeFormat(locale, {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date);
  }

  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * 计算日落时间
 *
 * 使用 NOAA 太阳计算器算法计算指定日期和位置的日落时间
 *
 * @param {Date} date - 日期对象
 * @param {number} lat - 纬度（-90 到 90）
 * @param {number} lon - 经度（-180 到 180）
 * @returns {Date} 日落时间
 * @throws {Error} 参数无效时抛出错误
 */
function getSunsetTime(date, lat, lon, options = {}) {
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

  const dayOfYear = getDayOfYear(date);
  const fractionalYear = getFractionalYear(dayOfYear);
  const eqTime = getEquationOfTime(fractionalYear);
  const declination = getSolarDeclination(fractionalYear);

  // 将纬度转换为弧度
  const latRad = lat * Math.PI / 180;

  // 计算时角 - 日落时太阳在地平线下 0.833 度（考虑大气折射）
  const zenith = 90.833 * Math.PI / 180;
  const cosHourAngle = (Math.cos(zenith) - Math.sin(latRad) * Math.sin(declination)) /
                       (Math.cos(latRad) * Math.cos(declination));

  // 检查极昼/极夜
  if (cosHourAngle > 1) {
    // 极夜 - 太阳不升起
    const midnight = new Date(date);
    midnight.setHours(0, 0, 0, 0);
    return midnight;
  } else if (cosHourAngle < -1) {
    // 极昼 - 太阳不落下
    const midnight = new Date(date);
    midnight.setHours(23, 59, 59, 999);
    return midnight;
  }

  // 计算日落时角（度）
  const hourAngle = Math.acos(cosHourAngle) * 180 / Math.PI;

  // 计算目标地点法定时区对应的本地子午线
  const timezone = getTargetTimezoneOffsetHours(date, lon, options.timezone || options.timeZone || null);
  const localMeridian = timezone * 15;
  const lonOffset = lon - localMeridian;

  // 计算日落时间（本地太阳时，分钟）
  const solarNoon = 720 - 4 * lonOffset - eqTime;
  const sunsetMinutes = solarNoon + 4 * hourAngle;

  // 处理跨日情况
  let sunsetMinutesAdjusted = sunsetMinutes;
  let dayOffset = 0;

  if (sunsetMinutesAdjusted < 0) {
    dayOffset = -1;
    sunsetMinutesAdjusted += 24 * 60;
  } else if (sunsetMinutesAdjusted >= 24 * 60) {
    dayOffset = 1;
    sunsetMinutesAdjusted -= 24 * 60;
  }

  const hours = Math.floor(sunsetMinutesAdjusted / 60);
  const minutes = Math.round(sunsetMinutesAdjusted % 60);

  return createDateFromTargetLocalTime(date, dayOffset, hours, minutes, timezone);
}

/**
 * 计算日出时间
 *
 * 使用 NOAA 太阳计算器算法计算指定日期和位置的日出时间
 *
 * @param {Date} date - 日期对象
 * @param {number} lat - 纬度（-90 到 90）
 * @param {number} lon - 经度（-180 到 180）
 * @returns {Date} 日出时间
 * @throws {Error} 参数无效时抛出错误
 */
function getSunriseTime(date, lat, lon, options = {}) {
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

  const dayOfYear = getDayOfYear(date);
  const fractionalYear = getFractionalYear(dayOfYear);
  const eqTime = getEquationOfTime(fractionalYear);
  const declination = getSolarDeclination(fractionalYear);

  // 将纬度转换为弧度
  const latRad = lat * Math.PI / 180;

  // 计算时角 - 日出时太阳在地平线下 0.833 度
  const zenith = 90.833 * Math.PI / 180;
  const cosHourAngle = (Math.cos(zenith) - Math.sin(latRad) * Math.sin(declination)) /
                       (Math.cos(latRad) * Math.cos(declination));

  // 检查极昼/极夜
  if (cosHourAngle > 1) {
    // 极夜
    const midnight = new Date(date);
    midnight.setHours(0, 0, 0, 0);
    return midnight;
  } else if (cosHourAngle < -1) {
    // 极昼
    const midnight = new Date(date);
    midnight.setHours(0, 0, 0, 1);
    return midnight;
  }

  // 计算日出时角（度）
  const hourAngle = Math.acos(cosHourAngle) * 180 / Math.PI;

  // 计算目标地点法定时区对应的本地子午线
  const timezone = getTargetTimezoneOffsetHours(date, lon, options.timezone || options.timeZone || null);
  const localMeridian = timezone * 15;
  const lonOffset = lon - localMeridian;

  // 计算日出时间（本地太阳时，分钟）
  const solarNoon = 720 - 4 * lonOffset - eqTime;
  const sunriseMinutes = solarNoon - 4 * hourAngle;

  // 处理跨日情况
  let sunriseMinutesAdjusted = sunriseMinutes;
  let dayOffset = 0;

  if (sunriseMinutesAdjusted < 0) {
    dayOffset = -1;
    sunriseMinutesAdjusted += 24 * 60;
  } else if (sunriseMinutesAdjusted >= 24 * 60) {
    dayOffset = 1;
    sunriseMinutesAdjusted -= 24 * 60;
  }

  const hours = Math.floor(sunriseMinutesAdjusted / 60);
  const minutes = Math.round(sunriseMinutesAdjusted % 60);

  return createDateFromTargetLocalTime(date, dayOffset, hours, minutes, timezone);
}

/**
 * 计算黄金时段（Golden Hour）
 *
 * 日出后或日落前 30-60 分钟的时段，光线柔和温暖
 *
 * @param {Date} referenceTime - 参考时间（日出或日落）
 * @param {string} type - 'sunrise' 或 'sunset'
 * @returns {Object} {start, end} 黄金时段的开始和结束时间
 */
function getGoldenHour(referenceTime, type) {
  if (type === 'sunrise') {
    // 日出后 30-60 分钟
    const start = new Date(referenceTime.getTime() + 30 * 60 * 1000);
    const end = new Date(referenceTime.getTime() + 60 * 60 * 1000);
    return { start, end };
  } else {
    // 日落前 30-60 分钟
    const start = new Date(referenceTime.getTime() - 60 * 60 * 1000);
    const end = new Date(referenceTime.getTime() - 30 * 60 * 1000);
    return { start, end };
  }
}

/**
 * 计算蓝调时段（Blue Hour）
 *
 * 日出前或日落后 20-30 分钟的时段，天空呈现深蓝色
 *
 * @param {Date} referenceTime - 参考时间（日出或日落）
 * @param {string} type - 'sunrise' 或 'sunset'
 * @returns {Object} {start, end} 蓝调时段的开始和结束时间
 */
function getBlueHour(referenceTime, type) {
  if (type === 'sunrise') {
    // 日出前 20-30 分钟
    const start = new Date(referenceTime.getTime() - 30 * 60 * 1000);
    const end = new Date(referenceTime.getTime() - 20 * 60 * 1000);
    return { start, end };
  } else {
    // 日落后 20-30 分钟
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
 * @returns {number} 太阳方位角（0-360 度，0 度为正北）
 */
function getSunAzimuth(date, time, lat, lon) {
  const dayOfYear = getDayOfYear(date);
  const fractionalYear = getFractionalYear(dayOfYear);
  const declination = getSolarDeclination(fractionalYear);

  // 计算时角（基于当地时间）
  const hours = time.getHours() + time.getMinutes() / 60 + time.getSeconds() / 3600;
  const hourAngle = (hours - 12) * 15; // 每小时 15 度

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

  // 根据时角调整方位角
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
 */
function analyzeCloudLayers(highClouds, midClouds, lowClouds) {
  const layers = {
    high: highClouds,
    mid: midClouds,
    low: lowClouds,
    description: ''
  };

  const totalClouds = highClouds + midClouds + lowClouds;
  const layerBasedCloudCover = Math.min(
    100,
    Math.max(highClouds, midClouds, lowClouds, totalClouds / 3)
  );

  if (totalClouds < 20) {
    layers.description = '云量较少，可能缺乏足够的云层来散射光线，晚霞效果一般';
  } else if (lowClouds > 50) {
    layers.description = '低层云过多，可能遮挡日落/日出，不利于观赏';
  } else if (midClouds > 30 && midClouds < 70 && highClouds > 20) {
    layers.description = '中高云适中，有利于火烧云形成，预计晚霞效果较好';
  } else if (highClouds > 60) {
    layers.description = '高云较多，可能产生卷云效果，适合拍摄';
  } else if (midClouds > 70) {
    if (lowClouds >= 35 || layerBasedCloudCover >= 85) {
      layers.description = '中层云偏厚，且低云/总云量较高，可能压光导致霞色偏暗';
    } else {
      layers.description = '中层云较多但低云不高，仍可能出霞，成色取决于云层透光性';
    }
  } else {
    layers.description = '云层分布一般，晚霞效果取决于其他气象条件';
  }

  return layers;
}

module.exports = {
  getTargetTimezoneOffsetHours,
  createDateFromTargetLocalTime,
  formatTimeForZone,
  getSunsetTime,
  getSunriseTime,
  getGoldenHour,
  getBlueHour,
  getSunAzimuth,
  analyzeCloudLayers,
  // 内部辅助函数也导出，便于测试
  getDayOfYear,
  getFractionalYear,
  getEquationOfTime,
  getSolarDeclination
};
