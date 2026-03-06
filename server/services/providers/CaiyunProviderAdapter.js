const axios = require('axios');
const BaseWeatherProvider = require('./BaseWeatherProvider');

/**
 * CaiyunProviderAdapter（任务 42.3）
 * - 支持鉴权
 * - 错误码映射
 * - 配额/限流告警
 */
class CaiyunProviderAdapter extends BaseWeatherProvider {
  constructor() {
    super('caiyun');
    this.baseUrl = process.env.CAIYUN_API_BASE || 'https://api.caiyunapp.com/v2.6';
    this.apiKey = process.env.CAIYUN_API_KEY || '';
  }

  _pickKey(userApiKey = null) {
    return (userApiKey && String(userApiKey).trim()) || this.apiKey;
  }

  _toMs(tsOrDate) {
    if (typeof tsOrDate === 'number') {
      return tsOrDate > 1e12 ? tsOrDate : tsOrDate * 1000;
    }
    const n = Date.parse(tsOrDate);
    return Number.isNaN(n) ? null : n;
  }

  _mapHourly(result, hours) {
    // 兼容彩云常见结构：result.hourly.{temperature,humidity,...}.each item => { datetime, value }
    const hourly = result?.hourly || {};

    const series = {
      temp: hourly.temperature || [],
      humidity: hourly.humidity || [],
      cloudCover: hourly.cloudrate || [],
      windSpeed: hourly.wind?.map?.((w) => ({ datetime: w.datetime, value: w.speed })) || [],
      windDirection: hourly.wind?.map?.((w) => ({ datetime: w.datetime, value: w.direction })) || [],
      pressure: hourly.pressure || [],
      precipitation: hourly.precipitation || [],
      visibility: hourly.visibility || []
    };

    const len = Math.min(
      hours,
      ...Object.values(series).map((arr) => (Array.isArray(arr) && arr.length ? arr.length : Number.MAX_SAFE_INTEGER))
    );

    if (!Number.isFinite(len) || len === Number.MAX_SAFE_INTEGER || len <= 0) {
      throw new Error('Caiyun API 响应格式错误：hourly 数据缺失');
    }

    const data = [];
    for (let i = 0; i < len; i++) {
      const t = this._toMs(series.temp[i]?.datetime || series.humidity[i]?.datetime);
      if (!t) continue;

      const humidity = series.humidity[i]?.value;
      const cloudCoverRaw = series.cloudCover[i]?.value;
      const cloudCover = cloudCoverRaw == null ? 0 : Math.round(cloudCoverRaw * 100);
      const precipitation = series.precipitation[i]?.value ?? 0;
      const visibility = series.visibility[i]?.value ?? this.estimateVisibility(humidity, precipitation, cloudCover);

      data.push({
        timestamp: t,
        temp: series.temp[i]?.value ?? null,
        humidity: humidity == null ? null : Math.round(humidity * 100),
        cloudCover,
        windSpeed: series.windSpeed[i]?.value ?? null,
        windDirection: series.windDirection[i]?.value ?? null,
        pressure: series.pressure[i]?.value ?? null,
        visibility: visibility,
        precipitation,
        lowClouds: null,
        midClouds: null,
        highClouds: null
      });
    }

    return data;
  }

  async fetchWeatherData(lat, lon, hours = 168, userApiKey = null) {
    const startTime = Date.now();
    const key = this._pickKey(userApiKey);
    if (!key) {
      throw new Error('Caiyun API Key 未配置');
    }

    try {
      const url = `${this.baseUrl}/${key}/${lon},${lat}/weather.json`;
      const response = await axios.get(url, {
        params: {
          hourlysteps: Math.min(hours, 168),
          alert: false,
          dailysteps: 1
        },
        timeout: 10000
      });

      const data = this._mapHourly(response.data?.result, hours);
      if (data.length < 12) {
        throw new Error(`Caiyun 数据条数过少 (${data.length})`);
      }

      return {
        hours: data.length,
        data,
        providerMeta: {
          name: this.name,
          latency: Date.now() - startTime,
          dataQuality: 'standard',
          unsupportedFields: ['cape', 'convPrecip', 'lowClouds', 'midClouds', 'highClouds'],
          degradedReason: ['Caiyun 基础接口缺少 cape/convPrecip 与分层云量，已降级处理']
        }
      };
    } catch (error) {
      if (error.response) {
        const { status, data } = error.response;
        if (status === 401 || status === 403) {
          throw new Error(`Caiyun 鉴权失败 (${status})`);
        }
        if (status === 429) {
          throw new Error(`Caiyun 配额/限流告警 (${status})`);
        }
        throw new Error(`Caiyun API 错误: ${status} - ${JSON.stringify(data)}`);
      }
      if (error.code === 'ECONNABORTED') {
        throw new Error('Caiyun 请求超时');
      }
      throw error;
    }
  }
}

module.exports = new CaiyunProviderAdapter();
module.exports.CaiyunProviderAdapter = CaiyunProviderAdapter;
