const axios = require('axios');
const BaseWeatherProvider = require('./BaseWeatherProvider');
const quota = require('../OpenMeteoQuota');
const apiLog = require('../ApiCallLog');

class OpenMeteoProvider extends BaseWeatherProvider {
  constructor() {
    super('openmeteo');
    this.API_URL = 'https://api.open-meteo.com/v1/forecast';
    this.MAX_RETRIES = 4;
    this.RETRY_BASE_MS = 1200;
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  _parseRetryAfterMs(error) {
    const raw = error?.response?.headers?.['retry-after'];
    const seconds = Number(raw);
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.ceil(seconds * 1000);
    }

    // Open-Meteo 常见 429 文案："Please try again in one minute."
    const reason = String(error?.response?.data?.reason || error?.response?.data?.message || '').toLowerCase();
    if (reason.includes('one minute') || reason.includes('60')) {
      return 60 * 1000;
    }

    return null;
  }

  async _getWithRetry(params, timeoutMs = 15000, label = 'request') {
    // 记录本次调用
    quota.record(1);
    const tracker = apiLog.track('grid', label || 'open-meteo', params);
    let lastError = null;
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const response = await axios.get(this.API_URL, { params, timeout: timeoutMs });
        tracker.ok(response.status);
        return response;
      } catch (error) {
        lastError = error;
        const status = error?.response?.status;
        // 429 = 日配额耗尽，重试无意义，直接失败
        if (status === 429) {
          tracker.fail(error, status);
          break;
        }
        const retryable = status === 503 || error?.code === 'ECONNABORTED';
        if (!retryable || attempt >= this.MAX_RETRIES) {
          tracker.fail(error, status || 0);
          break;
        }
        const retryAfter = this._parseRetryAfterMs(error);
        const backoff = this.RETRY_BASE_MS * Math.pow(2, attempt - 1);
        const min429WaitMs = status === 429 ? 60 * 1000 : 0;
        const waitMs = Math.max(retryAfter || 0, backoff, min429WaitMs);
        tracker.retry({ status: status || 0, waitMs, attempt });
        console.warn(`[Open-Meteo API] ${label} 第${attempt}次失败(status=${status || error.code}), ${waitMs}ms后重试`);
        await this._sleep(waitMs);
      }
    }
    throw lastError;
  }

  _normalizeHourlyResult(raw, hours, model, startTime, fallbackName = this.name) {
    const { hourly } = raw || {};
    if (!hourly || !hourly.time) {
      throw new Error('Open-Meteo API 响应格式错误');
    }

    const data = [];
    const totalHours = Math.min(hours, hourly.time.length);

    for (let i = 0; i < totalHours; i++) {
      const timestamp = hourly.time[i] * 1000;
      const humidity = hourly.relative_humidity_2m[i];
      const cloudCover = hourly.cloud_cover[i];
      const precipitation = hourly.precipitation[i];

      let visibility = hourly.visibility[i];
      if (visibility == null) {
        visibility = this.estimateVisibility(humidity, precipitation, cloudCover);
      } else {
        visibility = visibility / 1000;
      }

      data.push({
        timestamp,
        temp: hourly.temperature_2m[i] ?? null,
        humidity: humidity ?? null,
        cloudCover: cloudCover ?? 0,
        windSpeed: hourly.wind_speed_10m[i] ?? null,
        windDirection: hourly.wind_direction_10m[i] ?? null,
        visibility,
        precipitation: precipitation ?? 0,
        lowClouds: hourly.cloud_cover_low[i] ?? 0,
        midClouds: hourly.cloud_cover_mid[i] ?? 0,
        highClouds: hourly.cloud_cover_high[i] ?? 0
      });
    }

    return {
      hours: totalHours,
      data,
      providerMeta: {
        name: fallbackName,
        latency: Date.now() - startTime,
        timezone: raw?.timezone || null,
        utcOffsetSeconds: raw?.utc_offset_seconds ?? null,
        weatherModel: model,
        models: [model],
        cloudSource: {
          ecmwf_ifs025: 'Open-Meteo ECMWF IFS 025',
          gfs_seamless: 'Open-Meteo GFS Seamless',
          best_match: 'Open-Meteo Best Match'
        }[model] || `Open-Meteo ${model}`,
        unsupportedFields: [],
        degradedReason: []
      }
    };
  }

  async fetchWeatherData(lat, lon, hours = 168, userApiKey = null, weatherModel = 'ecmwf_ifs025') {
    const startTime = Date.now();
    
    // Open-Meteo 仅支持查询天数，7天为 168 小时
    const forecastDays = Math.max(1, Math.ceil(hours / 24));

    const ALLOWED_MODELS = ['ecmwf_ifs025', 'gfs_seamless', 'best_match'];
    const model = ALLOWED_MODELS.includes(weatherModel) ? weatherModel : 'ecmwf_ifs025';

    const BASE_PARAMS = {
      latitude: lat,
      longitude: lon,
      hourly: 'temperature_2m,relative_humidity_2m,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,wind_speed_10m,wind_direction_10m,visibility,precipitation',
      wind_speed_unit: 'ms',
      timeformat: 'unixtime',
      timezone: 'auto',
      forecast_days: forecastDays
    };
    
    try {
      // 使用 ECMWF IFS 025 模型（与 Windy 同源，精度更高）
      const response = await this._getWithRetry(
        { ...BASE_PARAMS, models: model },
        10000,
        `single(${lat},${lon})`
      );
      return this._normalizeHourlyResult(response.data, hours, model, startTime, this.name);
    } catch (error) {
      console.error('[Open-Meteo API] 请求失败:', error.message);
      if (error.response) {
        throw new Error(`Open-Meteo API 错误: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('Open-Meteo 请求超时，请检查网络连接');
      } else {
        throw error;
      }
    }
  }

  async fetchWeatherDataBatch(points, hours = 24, weatherModel = 'ecmwf_ifs025') {
    const startTime = Date.now();
    const pointList = Array.isArray(points) ? points : [];
    if (pointList.length === 0) {
      return {};
    }

    const forecastDays = Math.max(1, Math.ceil(hours / 24));
    const ALLOWED_MODELS = ['ecmwf_ifs025', 'gfs_seamless', 'best_match'];
    const model = ALLOWED_MODELS.includes(weatherModel) ? weatherModel : 'ecmwf_ifs025';

    const BASE_PARAMS = {
      latitude: pointList.map(p => p.lat).join(','),
      longitude: pointList.map(p => p.lon).join(','),
      hourly: 'temperature_2m,relative_humidity_2m,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,wind_speed_10m,wind_direction_10m,visibility,precipitation',
      wind_speed_unit: 'ms',
      timeformat: 'unixtime',
      timezone: 'auto',
      forecast_days: forecastDays,
      models: model
    };

    try {
      const response = await this._getWithRetry(
        BASE_PARAMS,
        15000,
        `batch(points=${pointList.length})`
      );

      const payload = Array.isArray(response.data) ? response.data : [response.data];
      if (payload.length !== pointList.length) {
        throw new Error(`Open-Meteo 批量返回数量异常: expected=${pointList.length}, actual=${payload.length}`);
      }

      const weatherMap = {};
      for (let i = 0; i < pointList.length; i++) {
        const point = pointList[i];
        const key = `${point.lat},${point.lon}`;
        weatherMap[key] = this._normalizeHourlyResult(payload[i], hours, model, startTime, this.name);
      }

      return weatherMap;
    } catch (error) {
      console.error('[Open-Meteo API] 批量请求失败:', error.message);
      if (error.response) {
        throw new Error(`Open-Meteo Batch API 错误: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('Open-Meteo 批量请求超时，请检查网络连接');
      } else {
        throw error;
      }
    }
  }
}

module.exports = new OpenMeteoProvider();
module.exports.OpenMeteoProvider = OpenMeteoProvider;
