const axios = require('axios');
const BaseWeatherProvider = require('./BaseWeatherProvider');
const quota = require('../OpenMeteoQuota');
const apiLog = require('../ApiCallLog');
const { startProfile, logProfile } = require('../../utils/ProfileLogger');

class OpenMeteoProvider extends BaseWeatherProvider {
  constructor() {
    super('openmeteo');
    this.API_URL = 'https://api.open-meteo.com/v1/forecast';
    this.AIR_QUALITY_API_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
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

  _formatResponseError(error, fallbackLabel = 'Open-Meteo API') {
    const status = error?.response?.status || 0;
    const data = error?.response?.data;
    let detail = '';

    if (data && typeof data === 'object') {
      detail = data.reason || data.message || data.error || JSON.stringify(data);
    } else if (typeof data === 'string') {
      const title = data.match(/<title>(.*?)<\/title>/i)?.[1];
      const heading = data.match(/<h1>(.*?)<\/h1>/i)?.[1];
      detail = title || heading || data;
    }

    detail = String(detail || error?.message || '请求失败')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\\r|\\n|\r|\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (detail.length > 120) {
      detail = `${detail.slice(0, 117)}...`;
    }

    return `${fallbackLabel} 错误: ${status}${detail ? ` - ${detail}` : ''}`;
  }

  async _getWithRetry(params, timeoutMs = 15000, label = 'request', url = this.API_URL, logType = 'grid', retryOptions = {}) {
    // 记录本次调用
    quota.record(1);
    const tracker = apiLog.track(logType, label || 'open-meteo', params);
    let lastError = null;
    const maxRetries = Math.max(1, Number(retryOptions.maxRetries) || this.MAX_RETRIES);
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.get(url, { params, timeout: timeoutMs });
        tracker.ok(response.status);
        return response;
      } catch (error) {
        lastError = error;
        const status = error?.response?.status;
        // 429 = 频率限制，优先读取 Retry-After header，否则固定等 60s，然后重试
        if (status === 429) {
          if (attempt >= maxRetries) {
            tracker.fail(error, status);
            break;
          }
          const retryAfter = this._parseRetryAfterMs(error);
          const waitMs = retryAfter || 60 * 1000; // 优先 header，否则 60s
          console.warn(`[Open-Meteo API] ${label} 遇到 429，等待 ${waitMs}ms 后重试 (attempt=${attempt})`);
          tracker.retry({ status: 429, waitMs, attempt });
          await this._sleep(waitMs);
          // 不 break，继续重试
          continue;
        }
        const retryable = status === 503 || error?.code === 'ECONNABORTED';
        if (!retryable || attempt >= maxRetries) {
          tracker.fail(error, status || 0);
          break;
        }
        const retryAfter = this._parseRetryAfterMs(error);
        const backoff = this.RETRY_BASE_MS * Math.pow(2, attempt - 1);
        const waitMs = Math.max(retryAfter || 0, backoff);
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
        highClouds: hourly.cloud_cover_high[i] ?? 0,
        pressure: hourly.surface_pressure[i] != null ? hourly.surface_pressure[i] : null,
        // 云厚评估字段（Phase 22）
        shortwaveRadiation: hourly.shortwave_radiation?.[i] ?? null,
        directRadiation: hourly.direct_radiation?.[i] ?? null,
        diffuseRadiation: hourly.diffuse_radiation?.[i] ?? null,
        waterVapourColumn: hourly.total_column_integrated_water_vapour?.[i] ?? null
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

  async _fetchAirQualityData(lat, lon, hours = 168, forecastDays = 7, fetchOptions = {}) {
    const params = {
      latitude: lat,
      longitude: lon,
      hourly: 'aerosol_optical_depth,dust,pm2_5,pm10,us_aqi,european_aqi',
      timeformat: 'unixtime',
      timezone: 'auto',
      forecast_days: forecastDays
    };

    const response = await this._getWithRetry(
      params,
      fetchOptions.airQualityTimeoutMs || 10000,
      `air-quality(${lat},${lon})`,
      this.AIR_QUALITY_API_URL,
      'air_quality',
      fetchOptions
    );

    const hourly = response.data?.hourly;
    if (!hourly?.time) {
      throw new Error('Open-Meteo Air Quality API 响应格式错误');
    }

    const totalHours = Math.min(hours, hourly.time.length);
    const airByTimestamp = new Map();
    for (let i = 0; i < totalHours; i++) {
      airByTimestamp.set(hourly.time[i] * 1000, {
        aerosolOpticalDepth: hourly.aerosol_optical_depth?.[i] ?? null,
        dust: hourly.dust?.[i] ?? null,
        pm2_5: hourly.pm2_5?.[i] ?? null,
        pm10: hourly.pm10?.[i] ?? null,
        aqi: hourly.us_aqi?.[i] ?? hourly.european_aqi?.[i] ?? null,
        usAqi: hourly.us_aqi?.[i] ?? null,
        europeanAqi: hourly.european_aqi?.[i] ?? null
      });
    }

    return airByTimestamp;
  }

  async _fetchAirQualityDataBatch(points, hours = 24, forecastDays = 1, fetchOptions = {}) {
    const pointList = Array.isArray(points) ? points : [];
    if (pointList.length === 0) return {};

    const params = {
      latitude: pointList.map(p => p.lat).join(','),
      longitude: pointList.map(p => p.lon).join(','),
      hourly: 'aerosol_optical_depth,dust,pm2_5,pm10,us_aqi,european_aqi',
      timeformat: 'unixtime',
      timezone: 'auto',
      forecast_days: forecastDays
    };

    const response = await this._getWithRetry(
      params,
      fetchOptions.airQualityTimeoutMs || 15000,
      `air-quality-batch(points=${pointList.length})`,
      this.AIR_QUALITY_API_URL,
      'air_quality',
      fetchOptions
    );

    const payload = Array.isArray(response.data) ? response.data : [response.data];
    if (payload.length !== pointList.length) {
      throw new Error(`Open-Meteo Air Quality 批量返回数量异常: expected=${pointList.length}, actual=${payload.length}`);
    }

    const result = {};
    for (let i = 0; i < pointList.length; i += 1) {
      const point = pointList[i];
      const hourly = payload[i]?.hourly;
      if (!hourly?.time) {
        throw new Error(`Open-Meteo Air Quality 批量响应格式错误: point=${point.lat},${point.lon}`);
      }

      const totalHours = Math.min(hours, hourly.time.length);
      const airByTimestamp = new Map();
      for (let h = 0; h < totalHours; h += 1) {
        airByTimestamp.set(hourly.time[h] * 1000, {
          aerosolOpticalDepth: hourly.aerosol_optical_depth?.[h] ?? null,
          dust: hourly.dust?.[h] ?? null,
          pm2_5: hourly.pm2_5?.[h] ?? null,
          pm10: hourly.pm10?.[h] ?? null,
          aqi: hourly.us_aqi?.[h] ?? hourly.european_aqi?.[h] ?? null,
          usAqi: hourly.us_aqi?.[h] ?? null,
          europeanAqi: hourly.european_aqi?.[h] ?? null
        });
      }
      result[`${point.lat},${point.lon}`] = airByTimestamp;
    }

    return result;
  }

  _mergeAirQualityData(weatherResult, airByTimestamp) {
    if (!weatherResult?.data || !airByTimestamp) return weatherResult;
    weatherResult.data = weatherResult.data.map(item => ({
      ...item,
      ...(airByTimestamp.get(item.timestamp) || {})
    }));
    return weatherResult;
  }

  async fetchWeatherData(lat, lon, hours = 168, userApiKey = null, weatherModel = 'ecmwf_ifs025', fetchOptions = {}) {
    const startTime = Date.now();
    
    // Open-Meteo 仅支持查询天数，7天为 168 小时
    const forecastDays = Math.max(1, Math.ceil(hours / 24));

    const ALLOWED_MODELS = ['ecmwf_ifs025', 'gfs_seamless', 'best_match'];
    const model = ALLOWED_MODELS.includes(weatherModel) ? weatherModel : 'ecmwf_ifs025';

    const BASE_PARAMS = {
      latitude: lat,
      longitude: lon,
      hourly: 'temperature_2m,relative_humidity_2m,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,wind_speed_10m,wind_direction_10m,visibility,precipitation,surface_pressure,shortwave_radiation,direct_radiation,diffuse_radiation,total_column_integrated_water_vapour',
      wind_speed_unit: 'ms',
      timeformat: 'unixtime',
      timezone: 'auto',
      forecast_days: forecastDays
    };
    
    try {
      // 使用 ECMWF IFS 025 模型（与 Windy 同源，精度更高）
      const forecastProfile = startProfile();
      let response;
      try {
        response = await this._getWithRetry(
          { ...BASE_PARAMS, models: model },
          fetchOptions.timeoutMs || 10000,
          `single(${lat},${lon})`,
          this.API_URL,
          'grid',
          fetchOptions
        );
        logProfile('openmeteo.fetchWeatherData', 'weather_forecast', forecastProfile, {
          status: 'ok',
          lat,
          lon,
          hours,
          forecastDays,
          model
        });
      } catch (forecastError) {
        logProfile('openmeteo.fetchWeatherData', 'weather_forecast', forecastProfile, {
          status: 'error',
          lat,
          lon,
          hours,
          forecastDays,
          model,
          error: forecastError.message
        });
        throw forecastError;
      }
      const result = this._normalizeHourlyResult(response.data, hours, model, startTime, this.name);

      if (fetchOptions.includeAirQuality === false) {
        logProfile('openmeteo.fetchWeatherData', 'air_quality', startProfile(), {
          status: 'skipped',
          lat,
          lon,
          hours,
          reason: 'includeAirQuality=false'
        });
        result.providerMeta.unsupportedFields.push('air_quality');
        result.providerMeta.degradedReason.push('air_quality_skipped');
      } else {
        const airProfile = startProfile();
        try {
          const airByTimestamp = await this._fetchAirQualityData(lat, lon, hours, forecastDays, fetchOptions);
          this._mergeAirQualityData(result, airByTimestamp);
          result.providerMeta.airQualitySource = 'openmeteo_air_quality';
          logProfile('openmeteo.fetchWeatherData', 'air_quality', airProfile, {
            status: 'ok',
            lat,
            lon,
            hours,
            forecastDays
          });
        } catch (airError) {
          logProfile('openmeteo.fetchWeatherData', 'air_quality', airProfile, {
            status: 'degraded',
            lat,
            lon,
            hours,
            forecastDays,
            error: airError.message
          });
          console.warn('[Open-Meteo Air Quality API] 请求失败，按无气溶胶数据降级:', airError.message);
          result.providerMeta.unsupportedFields.push('air_quality');
          result.providerMeta.degradedReason.push('air_quality_unavailable');
        }
      }

      return result;
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

  async fetchWeatherDataBatch(points, hours = 24, weatherModel = 'ecmwf_ifs025', fetchOptions = {}) {
    const startTime = Date.now();
    const pointList = Array.isArray(points) ? points : [];
    if (pointList.length === 0) {
      return {};
    }

    const forecastDays = Math.max(1, Math.ceil(hours / 24));
    const ALLOWED_MODELS = ['ecmwf_ifs025', 'gfs_seamless', 'best_match'];
    const model = ALLOWED_MODELS.includes(weatherModel) ? weatherModel : 'ecmwf_ifs025';

    const hourlyFields = fetchOptions.fields === 'lightPath'
      ? 'temperature_2m,relative_humidity_2m,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,wind_speed_10m,wind_direction_10m,visibility,precipitation,surface_pressure,weather_code'
      : 'temperature_2m,relative_humidity_2m,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,wind_speed_10m,wind_direction_10m,visibility,precipitation,surface_pressure,shortwave_radiation,direct_radiation,diffuse_radiation,total_column_integrated_water_vapour';

    const BASE_PARAMS = {
      latitude: pointList.map(p => p.lat).join(','),
      longitude: pointList.map(p => p.lon).join(','),
      hourly: hourlyFields,
      wind_speed_unit: 'ms',
      timeformat: 'unixtime',
      timezone: 'auto',
      forecast_days: forecastDays,
      models: model
    };

    try {
      const forecastProfile = startProfile();
      let response;
      try {
        response = await this._getWithRetry(
          BASE_PARAMS,
          fetchOptions.timeoutMs || 15000,
          `batch(points=${pointList.length})`,
          undefined,
          'forecast',
          fetchOptions
        );
        logProfile('openmeteo.fetchWeatherDataBatch', 'weather_forecast', forecastProfile, {
          status: 'ok',
          points: pointList.length,
          hours,
          forecastDays,
          model
        });
      } catch (forecastError) {
        logProfile('openmeteo.fetchWeatherDataBatch', 'weather_forecast', forecastProfile, {
          status: 'error',
          points: pointList.length,
          hours,
          forecastDays,
          model,
          error: forecastError.message
        });
        throw forecastError;
      }

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

      if (fetchOptions.includeAirQuality === false) {
        logProfile('openmeteo.fetchWeatherDataBatch', 'air_quality', startProfile(), {
          status: 'skipped',
          points: pointList.length,
          hours,
          forecastDays,
          reason: 'includeAirQuality=false'
        });
        for (const point of pointList) {
          const key = `${point.lat},${point.lon}`;
          const meta = weatherMap[key]?.providerMeta;
          if (meta) {
            meta.unsupportedFields = meta.unsupportedFields || [];
            meta.degradedReason = meta.degradedReason || [];
            meta.unsupportedFields.push('air_quality');
            meta.degradedReason.push('air_quality_skipped');
          }
        }
        return weatherMap;
      }

      const airProfile = startProfile();
      try {
        const airQualityMap = await this._fetchAirQualityDataBatch(pointList, hours, forecastDays, fetchOptions);
        for (const point of pointList) {
          const key = `${point.lat},${point.lon}`;
          this._mergeAirQualityData(weatherMap[key], airQualityMap[key]);
          weatherMap[key].providerMeta.airQualitySource = 'openmeteo_air_quality';
        }
        logProfile('openmeteo.fetchWeatherDataBatch', 'air_quality', airProfile, {
          status: 'ok',
          points: pointList.length,
          hours,
          forecastDays
        });
      } catch (airError) {
        logProfile('openmeteo.fetchWeatherDataBatch', 'air_quality', airProfile, {
          status: 'degraded',
          points: pointList.length,
          hours,
          forecastDays,
          error: airError.message
        });
        console.warn('[Open-Meteo Air Quality API] 批量请求失败，地图格点按无气溶胶数据降级:', airError.message);
        for (const point of pointList) {
          const key = `${point.lat},${point.lon}`;
          const meta = weatherMap[key]?.providerMeta;
          if (meta) {
            meta.unsupportedFields = meta.unsupportedFields || [];
            meta.degradedReason = meta.degradedReason || [];
            meta.unsupportedFields.push('air_quality');
            meta.degradedReason.push('air_quality_unavailable');
          }
        }
      }

      return weatherMap;
    } catch (error) {
      console.error('[Open-Meteo API] 批量请求失败:', error.message);
      if (error.response) {
        throw new Error(this._formatResponseError(error, 'Open-Meteo Batch API'));
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
