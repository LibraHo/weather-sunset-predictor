const axios = require('axios');
const BaseWeatherProvider = require('./BaseWeatherProvider');

class OpenMeteoProvider extends BaseWeatherProvider {
  constructor() {
    super('openmeteo');
    this.API_URL = 'https://api.open-meteo.com/v1/forecast';
  }

  /**
   * 基于气压层湿度+位势高度估算云底高度（米）
   * 规则：取最低一层 RH>=90% 的 geopotential height
   */
  estimateCloudBaseHeight(hourly, i) {
    const levels = [
      { rh: hourly.relative_humidity_925hPa?.[i], h: hourly.geopotential_height_925hPa?.[i] },
      { rh: hourly.relative_humidity_850hPa?.[i], h: hourly.geopotential_height_850hPa?.[i] },
      { rh: hourly.relative_humidity_700hPa?.[i], h: hourly.geopotential_height_700hPa?.[i] },
      { rh: hourly.relative_humidity_500hPa?.[i], h: hourly.geopotential_height_500hPa?.[i] }
    ];

    const firstSaturated = levels.find(l => typeof l.rh === 'number' && l.rh >= 90 && typeof l.h === 'number');
    return firstSaturated ? firstSaturated.h : null;
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
          // + 试验：气压层湿度/位势高度（用于估算云底高度）
          hourly: 'temperature_2m,relative_humidity_2m,surface_pressure,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,wind_speed_10m,wind_direction_10m,visibility,precipitation,showers,cape,weather_code,relative_humidity_925hPa,relative_humidity_850hPa,relative_humidity_700hPa,relative_humidity_500hPa,geopotential_height_925hPa,geopotential_height_850hPa,geopotential_height_700hPa,geopotential_height_500hPa',
          wind_speed_unit: 'ms',      // 转换为 m/s
          timeformat: 'unixtime',     // unix 秒级时间戳
          timezone: 'auto',           // 按查询位置自动时区
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

        const cloudBaseHeight = this.estimateCloudBaseHeight(hourly, i);

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
          convPrecip: hourly.showers?.[i] ?? 0,
          cape: hourly.cape?.[i] ?? null,
          lowClouds: hourly.cloud_cover_low[i] ?? 0,
          midClouds: hourly.cloud_cover_mid[i] ?? 0,
          highClouds: hourly.cloud_cover_high[i] ?? 0,
          weatherCode: hourly.weather_code?.[i] ?? null,
          cloudBaseHeight
        });
      }

      return {
        hours: totalHours,
        data: data,
        providerMeta: {
          name: this.name,
          latency: Date.now() - startTime,
          timezone: response.data?.timezone || null,
          utcOffsetSeconds: response.data?.utc_offset_seconds ?? null,
          dataQuality: 'standard',
          unsupportedFields: [],
          degradedReason: []
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
