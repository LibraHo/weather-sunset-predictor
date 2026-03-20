const express = require('express');
const router = express.Router();
const axios = require('axios');

/**
 * 地理编码代理路由
 *
 * 将地理编码请求通过后端代理转发给各提供商，解决前端跨域和中国网络限制。
 *
 * 支持的提供商:
 * - nominatim : OpenStreetMap Nominatim，免费，全球可用，无需 Key
 * - gaode     : 高德地图，中国大陆优化，需要免费 API Key（lbs.amap.com）
 * - google    : Google Maps Geocoding，覆盖最全，需付费 Key，后端须能访问 Google
 *
 * 需求：24
 */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const GAODE_BASE     = 'https://restapi.amap.com/v3';
const GOOGLE_BASE    = 'https://maps.googleapis.com/maps/api/geocode';
const OPENMETEO_GEOCODING_BASE = 'https://geocoding-api.open-meteo.com/v1';

// ========== 路由 ==========

/**
 * GET /api/geocoding/search
 * 地名转坐标（正向地理编码）
 *
 * 查询参数:
 * - q:        搜索关键词（必填）
 * - provider: auto | nominatim | gaode | google | openmeteo（可选，默认 auto）
 * - key:      提供商 API Key（gaode / google 必填）
 */
router.get('/search', async (req, res, next) => {
  try {
    const { q, provider = 'auto', key } = req.query;

    if (!q || !q.trim()) {
      return res.status(400).json({
        error: { code: 'INVALID_PARAMS', message: '缺少搜索关键词 q' }
      });
    }

    switch (provider) {
      case 'auto':
        return await handleAutoSearch(res, q.trim(), key);
      case 'gaode':
        return await handleGaodeSearch(res, q.trim(), key);
      case 'google':
        return await handleGoogleSearch(res, q.trim(), key);
      case 'openmeteo':
        return await handleOpenMeteoSearch(res, q.trim());
      default: // nominatim
        return await handleNominatimSearch(res, q.trim());
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/geocoding/reverse
 * 坐标转地名（反向地理编码）
 *
 * 查询参数:
 * - lat:      纬度（必填）
 * - lon:      经度（必填）
 * - provider: auto | nominatim | gaode | google | openmeteo（可选，默认 auto）
 * - key:      提供商 API Key（gaode / google 必填）
 */
router.get('/reverse', async (req, res, next) => {
  try {
    const { lat, lon, provider = 'auto', key } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({
        error: { code: 'INVALID_PARAMS', message: '缺少坐标参数 lat 和 lon' }
      });
    }

    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    if (isNaN(latNum) || isNaN(lonNum)) {
      return res.status(400).json({
        error: { code: 'INVALID_PARAMS', message: '坐标参数格式无效' }
      });
    }

    switch (provider) {
      case 'auto':
        return await handleAutoReverse(res, latNum, lonNum, key);
      case 'gaode':
        return await handleGaodeReverse(res, latNum, lonNum, key);
      case 'google':
        return await handleGoogleReverse(res, latNum, lonNum, key);
      case 'openmeteo':
        return await handleOpenMeteoReverse(res, latNum, lonNum);
      default: // nominatim
        return await handleNominatimReverse(res, latNum, lonNum);
    }
  } catch (error) {
    next(error);
  }
});

// ========== Auto provider（国内优先高德 + 显式回退） ==========

function attachSearchMeta(payload, meta) {
  return {
    ...payload,
    providerUsed: meta.providerUsed,
    fallbackUsed: Boolean(meta.fallbackUsed),
    fallbackReason: meta.fallbackReason || null
  };
}

async function handleAutoSearch(res, query, apiKey) {
  // Auto 策略：先高德（国内优先），失败/无结果再 Open-Meteo
  const effectiveKey = apiKey || process.env.GAODE_API_KEY;

  if (effectiveKey) {
    try {
      const response = await axios.get(`${GAODE_BASE}/geocode/geo`, {
        params: { address: query, key: effectiveKey, output: 'JSON' },
        timeout: 8000
      });
      const data = response.data;
      if (data.status === '1' && data.geocodes && data.geocodes.length > 0) {
        return res.json(attachSearchMeta({
          results: data.geocodes.map(item => {
            const [lonStr, latStr] = item.location.split(',');
            const regionCode = resolveGaodeRegionCode(item.adcode);
            return {
              name: item.formatted_address,
              lat: parseFloat(latStr),
              lon: parseFloat(lonStr),
              type: 'place',
              provider: 'gaode',
              countryCode: 'CN',
              regionCode,
              adcode: item.adcode || null
            };
          })
        }, { providerUsed: 'gaode', fallbackUsed: false }));
      }

      const om = await fetchOpenMeteoResults(query);
      return res.json(attachSearchMeta({ results: om }, {
        providerUsed: 'openmeteo',
        fallbackUsed: true,
        fallbackReason: 'gaode_empty_result'
      }));
    } catch (error) {
      const om = await fetchOpenMeteoResults(query);
      return res.json(attachSearchMeta({ results: om }, {
        providerUsed: 'openmeteo',
        fallbackUsed: true,
        fallbackReason: error.code === 'ECONNABORTED' ? 'gaode_timeout' : 'gaode_error'
      }));
    }
  }

  // 无高德 key 时直接 openmeteo
  const om = await fetchOpenMeteoResults(query);
  return res.json(attachSearchMeta({ results: om }, {
    providerUsed: 'openmeteo',
    fallbackUsed: true,
    fallbackReason: 'missing_gaode_key'
  }));
}

async function handleAutoReverse(res, lat, lon, apiKey) {
  // reverse 也优先高德，失败回退到坐标文本
  const effectiveKey = apiKey || process.env.GAODE_API_KEY;
  if (effectiveKey) {
    try {
      return await handleGaodeReverse(res, lat, lon, effectiveKey);
    } catch (_) {
      return await handleOpenMeteoReverse(res, lat, lon);
    }
  }
  return await handleOpenMeteoReverse(res, lat, lon);
}

// ========== Nominatim (OpenStreetMap) ==========

async function handleNominatimSearch(res, query) {
  console.log(`[Geocoding] Nominatim 搜索: "${query}"`);

  const response = await axios.get(`${NOMINATIM_BASE}/search`, {
    params: { q: query, format: 'json', limit: 5, addressdetails: 1 },
    headers: { 'User-Agent': 'WeatherSunsetPredictor/1.0' },
    timeout: 8000
  });

  const data = response.data;
  if (!data || data.length === 0) return res.json({ results: [] });

  return res.json({
    results: data.map(item => ({
      name: item.display_name,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      type: item.type,
      provider: 'nominatim',
      countryCode: (item.address?.country_code || '').toUpperCase() || null,
      regionCode: deriveNominatimRegionCode(item.address)
    }))
  });
}

async function handleNominatimReverse(res, lat, lon) {
  console.log(`[Geocoding] Nominatim 反向地理编码: ${lat},${lon}`);

  const response = await axios.get(`${NOMINATIM_BASE}/reverse`, {
    params: { lat, lon, format: 'json', addressdetails: 1 },
    headers: { 'User-Agent': 'WeatherSunsetPredictor/1.0' },
    timeout: 8000
  });

  const data = response.data;
  if (!data || !data.display_name) return res.json({ name: null });

  return res.json({
    name: data.display_name,
    lat,
    lon,
    provider: 'nominatim',
    countryCode: (data.address?.country_code || '').toUpperCase() || null,
    regionCode: deriveNominatimRegionCode(data.address)
  });
}

// ========== Open-Meteo Geocoding ==========

async function fetchOpenMeteoResults(query) {
  const response = await axios.get(`${OPENMETEO_GEOCODING_BASE}/search`, {
    params: {
      name: query,
      count: 8,
      language: 'zh',
      format: 'json'
    },
    timeout: 8000
  });

  const results = response.data?.results || [];
  if (!Array.isArray(results) || results.length === 0) {
    return [];
  }

  return results.map((item) => ({
    name: [item.name, item.admin1, item.country].filter(Boolean).join(', '),
    lat: Number(item.latitude),
    lon: Number(item.longitude),
    type: item.feature_code || 'place',
    provider: 'openmeteo',
    countryCode: (item.country_code || '').toUpperCase() || null,
    regionCode: resolveAdminRegionCode(item.admin1)
  }));
}

async function handleOpenMeteoSearch(res, query) {
  console.log(`[Geocoding] Open-Meteo 搜索: "${query}"`);
  const results = await fetchOpenMeteoResults(query);
  return res.json(attachSearchMeta({ results }, {
    providerUsed: 'openmeteo',
    fallbackUsed: false
  }));
}

async function handleOpenMeteoReverse(res, lat, lon) {
  // Open-Meteo geocoding 目前无 reverse 接口，这里返回坐标文本保证流程可用
  return res.json({
    name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
    lat,
    lon,
    provider: 'openmeteo'
  });
}

// ========== 高德地图 (Gaode/Amap) ==========

function requireKey(res, apiKey, providerName) {
  if (!apiKey) {
    res.status(400).json({
      error: { code: 'MISSING_API_KEY', message: `使用${providerName}需要提供 API Key` }
    });
    return false;
  }
  return true;
}

async function handleGaodeSearch(res, query, apiKey) {
  const effectiveKey = apiKey || process.env.GAODE_API_KEY;
  if (!requireKey(res, effectiveKey, '高德地图')) return;
  apiKey = effectiveKey;

  console.log(`[Geocoding] 高德地图搜索: "${query}"`);

  try {
    const response = await axios.get(`${GAODE_BASE}/geocode/geo`, {
      params: { address: query, key: apiKey, output: 'JSON' },
      timeout: 8000
    });

    const data = response.data;
    if (data.status !== '1' || !data.geocodes || data.geocodes.length === 0) {
      // 国际城市在高德经常无结果，自动回退到 Open-Meteo Geocoding
      console.log('[Geocoding] 高德无结果，fallback 到 Open-Meteo');
      return await handleOpenMeteoSearch(res, query);
    }

    return res.json({
      results: data.geocodes.map(item => {
        const [lonStr, latStr] = item.location.split(',');
        const regionCode = resolveGaodeRegionCode(item.adcode);
        return {
          name: item.formatted_address,
          lat: parseFloat(latStr),
          lon: parseFloat(lonStr),
          type: 'place',
          provider: 'gaode',
          countryCode: 'CN',
          regionCode,
          adcode: item.adcode || null
        };
      })
    });
  } catch (error) {
    // 修复：高德超时/网络错误时，也应自动回退到 Open-Meteo
    console.warn(`[Geocoding] 高德请求失败(${error.code || 'ERR'})，fallback 到 Open-Meteo: ${error.message}`);
    return await handleOpenMeteoSearch(res, query);
  }
}

async function handleGaodeReverse(res, lat, lon, apiKey) {
  const effectiveKey = apiKey || process.env.GAODE_API_KEY;
  if (!requireKey(res, effectiveKey, '高德地图')) return;
  apiKey = effectiveKey;

  console.log(`[Geocoding] 高德地图反向地理编码: ${lat},${lon}`);

  const response = await axios.get(`${GAODE_BASE}/geocode/regeo`, {
    params: { location: `${lon},${lat}`, key: apiKey, output: 'JSON', extensions: 'base' },
    timeout: 8000
  });

  const data = response.data;
  if (data.status !== '1' || !data.regeocode?.formatted_address) {
    return res.json({ name: null });
  }

  const adcode = data.regeocode?.addressComponent?.adcode || null;
  return res.json({
    name: data.regeocode.formatted_address,
    lat,
    lon,
    provider: 'gaode',
    countryCode: 'CN',
    regionCode: resolveGaodeRegionCode(adcode),
    adcode
  });
}

// ========== Google Maps Geocoding API ==========

async function handleGoogleSearch(res, query, apiKey) {
  if (!requireKey(res, apiKey, 'Google Maps')) return;

  console.log(`[Geocoding] Google Maps 搜索: "${query}"`);

  const response = await axios.get(`${GOOGLE_BASE}/json`, {
    params: { address: query, key: apiKey },
    timeout: 8000
  });

  const data = response.data;
  if (data.status !== 'OK' || !data.results || data.results.length === 0) {
    return res.json({ results: [] });
  }

  return res.json({
    results: data.results.map(item => ({
      name: item.formatted_address,
      lat: item.geometry.location.lat,
      lon: item.geometry.location.lng,
      type: item.types?.[0] || 'place',
      provider: 'google',
      countryCode: deriveGoogleCountryCode(item.address_components),
      regionCode: deriveGoogleRegionCode(item.address_components)
    }))
  });
}

async function handleGoogleReverse(res, lat, lon, apiKey) {
  if (!requireKey(res, apiKey, 'Google Maps')) return;

  console.log(`[Geocoding] Google Maps 反向地理编码: ${lat},${lon}`);

  const response = await axios.get(`${GOOGLE_BASE}/json`, {
    params: { latlng: `${lat},${lon}`, key: apiKey },
    timeout: 8000
  });

  const data = response.data;
  if (data.status !== 'OK' || !data.results || data.results.length === 0) {
    return res.json({ name: null });
  }

  const first = data.results[0];
  return res.json({
    name: first.formatted_address,
    lat,
    lon,
    provider: 'google',
    countryCode: deriveGoogleCountryCode(first.address_components),
    regionCode: deriveGoogleRegionCode(first.address_components)
  });
}

function resolveAdminRegionCode(admin1 = '') {
  const text = String(admin1 || '');
  if (/台湾|taiwan/i.test(text)) return 'TW';
  if (/香港|hong kong/i.test(text)) return 'HK';
  if (/澳门|macao|macau/i.test(text)) return 'MO';
  return null;
}

function resolveGaodeRegionCode(adcode = '') {
  const code = String(adcode || '');
  if (code.startsWith('71')) return 'TW';
  if (code.startsWith('81')) return 'HK';
  if (code.startsWith('82')) return 'MO';
  return null;
}

function deriveNominatimRegionCode(address = {}) {
  const text = [address?.state, address?.province, address?.county, address?.city, address?.region]
    .filter(Boolean)
    .join(' ');
  return resolveAdminRegionCode(text);
}

function getGoogleAddressShortCode(addressComponents = [], type) {
  if (!Array.isArray(addressComponents)) return null;
  const item = addressComponents.find(component => Array.isArray(component.types) && component.types.includes(type));
  return item?.short_name || null;
}

function deriveGoogleCountryCode(addressComponents = []) {
  const code = getGoogleAddressShortCode(addressComponents, 'country');
  return code ? code.toUpperCase() : null;
}

function deriveGoogleRegionCode(addressComponents = []) {
  const admin1Code = getGoogleAddressShortCode(addressComponents, 'administrative_area_level_1');
  return resolveAdminRegionCode(admin1Code);
}

module.exports = router;
