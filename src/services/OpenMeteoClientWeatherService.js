/**
 * OpenMeteoClientWeatherService
 *
 * Emergency browser-side weather fetcher. This is not the default data path:
 * normal production flow remains frontend -> backend -> provider. The client
 * fetcher is only used when WEATHER_FETCH_MODE asks for a browser fallback.
 */

import WeatherData from '../models/WeatherData.js';

const FORECAST_API_URL = 'https://api.open-meteo.com/v1/forecast';
const AIR_QUALITY_API_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const ALLOWED_MODELS = ['ecmwf_ifs025', 'gfs_seamless', 'best_match'];

class OpenMeteoClientWeatherService {
  constructor() {
    this.timeout = 15000;
  }

  _createTimeoutError() {
    const error = new Error('Request timeout, please retry');
    error.code = 'WEATHER_UPSTREAM_TIMEOUT';
    return error;
  }

  _withTimeout(url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    return fetch(url, { signal: controller.signal })
      .catch((error) => {
        if (error?.name === 'AbortError' || error?.code === 20) {
          throw this._createTimeoutError();
        }
        throw error;
      })
      .finally(() => clearTimeout(timeoutId));
  }

  _buildUrl(baseUrl, params) {
    const url = new URL(baseUrl);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, value);
      }
    });
    return url.toString();
  }

  _estimateVisibility(humidity, precipitation, cloudCover) {
    let visibility = 20;
    if (humidity > 80) visibility -= (humidity - 80) * 0.3;
    if (precipitation > 0) visibility -= Math.min(precipitation * 5, 10);
    if (cloudCover > 90) visibility -= 2;
    return Math.max(1, Math.min(30, visibility));
  }

  async _fetchJson(url) {
    const response = await this._withTimeout(url);
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Open-Meteo client request failed: HTTP ${response.status} ${text}`.trim());
    }
    return response.json();
  }

  async _fetchAirQuality(lat, lon, hours, forecastDays) {
    const url = this._buildUrl(AIR_QUALITY_API_URL, {
      latitude: lat,
      longitude: lon,
      hourly: 'aerosol_optical_depth,dust,pm2_5,pm10,us_aqi,european_aqi',
      timeformat: 'unixtime',
      timezone: 'auto',
      forecast_days: forecastDays
    });

    try {
      const payload = await this._fetchJson(url);
      const hourly = payload?.hourly;
      if (!hourly?.time) return new Map();

      const totalHours = Math.min(hours, hourly.time.length);
      const airByTimestamp = new Map();
      for (let i = 0; i < totalHours; i += 1) {
        airByTimestamp.set(hourly.time[i] * 1000, {
          aerosolOpticalDepth: hourly.aerosol_optical_depth?.[i] ?? null,
          dust: hourly.dust?.[i] ?? null,
          pm2_5: hourly.pm2_5?.[i] ?? null,
          pm10: hourly.pm10?.[i] ?? null,
          aqi: hourly.us_aqi?.[i] ?? hourly.european_aqi?.[i] ?? null
        });
      }
      return airByTimestamp;
    } catch (error) {
      console.warn('[OpenMeteoClientWeatherService] air-quality fallback failed:', error.message);
      return new Map();
    }
  }

  async fetchWeatherData(lat, lon, hours = 168, weatherModel = 'ecmwf_ifs025') {
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      throw new Error('Invalid coordinates');
    }
    if (hours < 1 || hours > 168) {
      throw new Error('Forecast hours must be between 1 and 168');
    }

    const forecastDays = Math.max(1, Math.ceil(hours / 24));
    const model = ALLOWED_MODELS.includes(weatherModel) ? weatherModel : 'ecmwf_ifs025';
    const url = this._buildUrl(FORECAST_API_URL, {
      latitude: lat,
      longitude: lon,
      hourly: 'temperature_2m,relative_humidity_2m,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,wind_speed_10m,wind_direction_10m,visibility,precipitation,surface_pressure,shortwave_radiation,direct_radiation,diffuse_radiation,total_column_integrated_water_vapour',
      wind_speed_unit: 'ms',
      timeformat: 'unixtime',
      timezone: 'auto',
      forecast_days: forecastDays,
      models: model
    });

    const payload = await this._fetchJson(url);
    const hourly = payload?.hourly;
    if (!hourly?.time) {
      throw new Error('Open-Meteo client response missing hourly data');
    }

    const airByTimestamp = await this._fetchAirQuality(lat, lon, hours, forecastDays);
    const totalHours = Math.min(hours, hourly.time.length);
    const dataArray = [];

    for (let i = 0; i < totalHours; i += 1) {
      const timestamp = hourly.time[i] * 1000;
      const humidity = hourly.relative_humidity_2m?.[i] ?? null;
      const precipitation = hourly.precipitation?.[i] ?? 0;
      const cloudCover = hourly.cloud_cover?.[i] ?? 0;
      const visibilityMeters = hourly.visibility?.[i];
      const weatherData = new WeatherData(
        timestamp,
        hourly.temperature_2m?.[i] ?? null,
        humidity,
        cloudCover,
        hourly.wind_speed_10m?.[i] ?? null,
        hourly.surface_pressure?.[i] ?? null,
        visibilityMeters != null ? visibilityMeters / 1000 : this._estimateVisibility(humidity, precipitation, cloudCover),
        hourly.cloud_cover_low?.[i] ?? 0,
        precipitation,
        hourly.wind_direction_10m?.[i] ?? 0,
        hourly.cloud_cover_high?.[i] ?? 0,
        hourly.cloud_cover_mid?.[i] ?? 0
      );

      weatherData.shortwaveRadiation = hourly.shortwave_radiation?.[i] ?? null;
      weatherData.directRadiation = hourly.direct_radiation?.[i] ?? null;
      weatherData.diffuseRadiation = hourly.diffuse_radiation?.[i] ?? null;
      weatherData.waterVapourColumn = hourly.total_column_integrated_water_vapour?.[i] ?? null;
      weatherData.timezone = payload.timezone || null;
      Object.assign(weatherData, airByTimestamp.get(timestamp) || {});
      dataArray.push(weatherData);
    }

    dataArray.providerMeta = {
      name: 'openmeteo-client-fallback',
      weatherModel: model,
      timezone: payload.timezone || null,
      utcOffsetSeconds: payload.utc_offset_seconds ?? null,
      cloudSource: `Open-Meteo ${model} (client fallback)`,
      dataQuality: 'client-fallback'
    };

    return dataArray;
  }
}

export default OpenMeteoClientWeatherService;
