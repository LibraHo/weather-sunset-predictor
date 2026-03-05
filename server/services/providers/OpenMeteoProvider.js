const axios = require('axios');
const BaseWeatherProvider = require('./BaseWeatherProvider');

class OpenMeteoProvider extends BaseWeatherProvider {
  constructor() {
    super('openmeteo');
    this.API_URL = 'https://api.open-meteo.com/v1/forecast';
  }

  async fetchWeatherData(lat, lon, hours = 168, userApiKey = null) {
    const startTime = Date.now();
    
    // Open-Meteo 仅支持查询天数，7天为 168 小时
    const forecastDays = Math.max(1, Math.ceil(hours / 24));
    
    try {
      const response = await axios.get(this.API_URL, {
        params: {
          latitude: lat,
          longitude: lon,
          // 需要的字段：温度,湿度,地表气压,总云量,低云,中云,高云,风速,风向,能见度,降水
          hourly: 'temperature_2m,relative_humidity_2m,surface_pressure,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,wind_speed_10m,wind_direction_10m,visibility,precipitation',
          wind_speed_unit: 'ms',      // 转换为 m/s
          timeformat: 'unixtime',     // unix 秒级时间戳
          timezone: 'UTC',            // 强制 UTC
          forecast_days: forecastDays // 预测天数
        },
        timeout: 10000
      });

      const { hourly } = response.data;
      if (!hourly || !hourly.time) {
        throw new Error('Open-Meteo API 响应格式错误');
      }

      // 将以列为主的数组转换为以行为主的对象数组
      const data = [];
      const totalHours = Math.min(hours, hourly.time.length);

      for (let i = 0; i < totalHours; i++) {
        const timestamp = hourly.time[i] * 1000; // 秒转毫秒
        const humidity = hourly.relative_humidity_2m[i];
        const cloudCover = hourly.cloud_cover[i];
        const precipitation = hourly.precipitation[i];
        
        let visibility = hourly.visibility[i];
        // 如果 API 没有返回能见度或者返回 null，就用基类的估算法
        if (visibility == null) {
          visibility = this.estimateVisibility(humidity, precipitation, cloudCover);
        } else {
          visibility = visibility / 1000; // 米转千米
        }

        data.push({
          timestamp,
          temp: hourly.temperature_2m[i] ?? null,
          humidity: humidity ?? null,
          cloudCover: cloudCover ?? 0,
          windSpeed: hourly.wind_speed_10m[i] ?? null,
          windDirection: hourly.wind_direction_10m[i] ?? null,
          pressure: hourly.surface_pressure[i] ?? null,
          visibility: visibility,
          precipitation: precipitation ?? 0,
          lowClouds: hourly.cloud_cover_low[i] ?? 0,
          midClouds: hourly.cloud_cover_mid[i] ?? 0,
          highClouds: hourly.cloud_cover_high[i] ?? 0
        });
      }

      return {
        hours: totalHours,
        data: data,
        providerMeta: {
          name: this.name,
          latency: Date.now() - startTime,
          dataQuality: 'standard',
          unsupportedFields: ['convPrecip', 'cape'],
          degradedReason: ['Open-Meteo API does not provide cape and convPrecip in this tier']
        }
      };
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
}

module.exports = new OpenMeteoProvider();
module.exports.OpenMeteoProvider = OpenMeteoProvider;
