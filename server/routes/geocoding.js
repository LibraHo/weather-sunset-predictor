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

// ========== 通用查询标准化 ==========
// 城市名称多语言映射表（非硬编码优先规则，仅用于查询扩展）
const CITY_NAME_MAPPINGS = {
  // 中文 -> 英文
  '槟城': ['George Town', 'Penang Malaysia'],
  '乔治市': ['George Town'],
  '吉隆坡': ['Kuala Lumpur'],
  '新加坡': ['Singapore'],
  '曼谷': ['Bangkok'],
  '东京': ['Tokyo'],
  '首尔': ['Seoul'],
  '纽约': ['New York'],
  '伦敦': ['London'],
  '巴黎': ['Paris'],
  '悉尼': ['Sydney'],
  '墨尔本': ['Melbourne'],
  '洛杉矶': ['Los Angeles'],
  '旧金山': ['San Francisco'],
  '温哥华': ['Vancouver'],
  '多伦多': ['Toronto'],
  // 英文 -> 中文（反向映射）
  'penang': ['槟城', 'George Town'],
  'george town': ['乔治市'],
  'kuala lumpur': ['吉隆坡'],
  'singapore': ['新加坡'],
  'bangkok': ['曼谷'],
  'tokyo': ['东京'],
  'seoul': ['首尔'],
  'new york': ['纽约'],
  'london': ['伦敦'],
  'paris': ['巴黎'],
  'sydney': ['悉尼'],
  'melbourne': ['墨尔本'],
  'los angeles': ['洛杉矶'],
  'san francisco': ['旧金山'],
  'vancouver': ['温哥华'],
  'toronto': ['多伦多'],
};

/**
 * 标准化查询：将中文城市名转换为英文，以提高 Open-Meteo 等服务的搜索成功率
 * 这不是硬编码优先规则，只是查询扩展以提高可检索性
 * @param {string} query - 原始查询
 * @returns {string} - 标准化后的查询
 */
function normalizeQuery(query) {
  if (!query || typeof query !== 'string') return query;
  
  const normalizedQuery = query.trim().toLowerCase();
  const mapping = CITY_NAME_MAPPINGS[normalizedQuery];
  
  // 如果找到映射，返回英文名称（第一个）用于搜索
  if (mapping && mapping.length > 0) {
    // 检查原始查询是否已经是英文
    if (/^[a-zA-Z\s]+$/.test(normalizedQuery)) {
      return query.trim(); // 已经是英文，保持原样
    }
    // 返回英文映射，同时保留原始查询用于后续合并结果
    return mapping[0];
  }
  
  return query.trim();
}

/**
 * 获取查询的所有可能变体（用于合并搜索结果）
 * @param {string} query - 原始查询
 * @returns {string[]} - 所有可能的查询变体
 */
function getQueryVariants(query) {
  if (!query || typeof query !== 'string') return [query];
  
  const normalizedQuery = query.trim().toLowerCase();
  const mapping = CITY_NAME_MAPPINGS[normalizedQuery];
  
  if (mapping) {
    // 返回原始查询 + 映射的变体
    return [query.trim(), ...mapping];
  }
  
  // 检查是否有反向映射（英文查中文）
  for (const [key, values] of Object.entries(CITY_NAME_MAPPINGS)) {
    if (values.some(v => v.toLowerCase() === normalizedQuery)) {
      // 找到反向映射，返回原始查询 + 中文名
      const chineseName = key;
      if (chineseName !== normalizedQuery) {
        return [query.trim(), chineseName];
      }
    }
  }
  
  return [query.trim()];
}

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
    const { q, provider = 'auto', key, limit = '8' } = req.query;

    if (!q || !q.trim()) {
      return res.status(400).json({
        error: { code: 'INVALID_PARAMS', message: '缺少搜索关键词 q' }
      });
    }

    const limitNum = parseInt(limit, 10) || 8;

    switch (provider) {
      case 'auto':
        return await handleAutoSearch(res, q.trim(), key, limitNum);
      case 'gaode':
        return await handleGaodeSearch(res, q.trim(), key, limitNum);
      case 'google':
        return await handleGoogleSearch(res, q.trim(), key, limitNum);
      case 'openmeteo':
        return await handleOpenMeteoSearch(res, q.trim(), limitNum);
      default: // nominatim
        return await handleNominatimSearch(res, q.trim(), limitNum);
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

async function handleAutoSearch(res, query, apiKey, limit = 8) {
  const effectiveKey = apiKey || process.env.GAODE_API_KEY;
  const resultSets = [];
  const errors = [];

  try {
    resultSets.push(...await fetchOpenMeteoResults(query, limit * 3));
  } catch (error) {
    errors.push(`openmeteo:${error.message}`);
  }

  if (effectiveKey) {
    try {
      const response = await axios.get(`${GAODE_BASE}/geocode/geo`, {
        params: { address: query, key: effectiveKey, output: 'JSON' },
        timeout: 8000
      });
      const data = response.data;
      if (data.status === '1' && data.geocodes && data.geocodes.length > 0) {
        resultSets.push(...data.geocodes.map(item => {
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
        }));
      }
    } catch (error) {
      errors.push(`gaode:${error.code || error.message}`);
    }
  }

  const ranked = rankGeocodingResults(query, resultSets).slice(0, limit);
  return res.json(attachSearchMeta({
    results: ranked,
    rankDebug: ranked.map(r => ({ name: r.name, provider: r.provider, score: r.rankScore, reason: r.rankReason }))
  }, {
    providerUsed: effectiveKey ? 'ranked(openmeteo+gaode)' : 'ranked(openmeteo)',
    fallbackUsed: errors.length > 0 || !effectiveKey,
    fallbackReason: errors.length ? errors.join(';') : (!effectiveKey ? 'missing_gaode_key' : null)
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

async function handleNominatimSearch(res, query, limit = 5) {
  console.log(`[Geocoding] Nominatim 搜索: "${query}"`);

  // 获取查询的所有变体（中英文）
  const variants = getQueryVariants(query);
  const allResults = [];
  const seenKeys = new Set(); // 用于去重

  for (const variant of variants) {
    try {
      const response = await axios.get(`${NOMINATIM_BASE}/search`, {
        params: { q: variant, format: 'json', limit: limit, addressdetails: 1 },
        headers: { 'User-Agent': 'WeatherSunsetPredictor/1.0' },
        timeout: 8000
      });

      const data = response.data || [];
      for (const item of data) {
        // 使用坐标作为唯一键去重
        const key = `${parseFloat(item.lat).toFixed(4)},${parseFloat(item.lon).toFixed(4)}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          allResults.push({
            name: item.display_name,
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon),
            type: item.type,
            provider: 'nominatim',
            countryCode: (item.address?.country_code || '').toUpperCase() || null,
            regionCode: deriveNominatimRegionCode(item.address)
          });
        }
      }
    } catch (error) {
      console.warn(`[Geocoding] Nominatim 搜索变体 "${variant}" 失败:`, error.message);
      // 继续尝试下一个变体
    }
  }

  return res.json({ results: allResults.slice(0, limit) });
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

async function fetchOpenMeteoResults(query, limit = 8) {
  // 获取查询的所有变体（中英文）
  const variants = getQueryVariants(query);
  const allResults = [];
  const seenKeys = new Set(); // 用于去重

  // 对每个变体同时用中英文语言搜索，提高国际城市命中率
  const languages = ['zh', 'en'];

  for (const variant of variants) {
    for (const lang of languages) {
      try {
        const response = await axios.get(`${OPENMETEO_GEOCODING_BASE}/search`, {
          params: {
            name: variant,
            count: limit,
            language: lang,
            format: 'json'
          },
          timeout: 8000
        });

        const results = response.data?.results || [];
        if (Array.isArray(results)) {
          for (const item of results) {
            // 使用坐标作为唯一键去重
            const key = `${item.latitude.toFixed(4)},${item.longitude.toFixed(4)}`;
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              allResults.push({
                name: [item.name, item.admin1, item.country].filter(Boolean).join(', '),
                lat: Number(item.latitude),
                lon: Number(item.longitude),
                type: item.feature_code || 'place',
                provider: 'openmeteo',
                countryCode: (item.country_code || '').toUpperCase() || null,
                regionCode: resolveAdminRegionCode(item.admin1),
                population: item.population ?? null,
                admin1: item.admin1 ?? null,
                country: item.country ?? null
              });
            }
          }
        }
      } catch (error) {
        console.warn(`[Geocoding] Open-Meteo 搜索变体 "${variant}" (${lang}) 失败:`, error.message);
      }
    }
  }

  return allResults;
}

async function handleOpenMeteoSearch(res, query, limit = 8) {
  console.log(`[Geocoding] Open-Meteo 搜索: "${query}"`);
  const results = await fetchOpenMeteoResults(query, limit);
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

async function handleGaodeSearch(res, query, apiKey, limit = 8) {
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
      return await handleOpenMeteoSearch(res, query, limit);
    }

    let results = data.geocodes.map(item => {
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
    });

    return res.json({
      results: results.slice(0, limit)
    });
  } catch (error) {
    // 修复：高德超时/网络错误时，也应自动回退到 Open-Meteo
    console.warn(`[Geocoding] 高德请求失败(${error.code || 'ERR'})，fallback 到 Open-Meteo: ${error.message}`);
    return await handleOpenMeteoSearch(res, query, limit);
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

async function handleGoogleSearch(res, query, apiKey, limit = 5) {
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

  let results = data.results.map(item => ({
    name: item.formatted_address,
    lat: item.geometry.location.lat,
    lon: item.geometry.location.lng,
    type: item.types?.[0] || 'place',
    provider: 'google',
    countryCode: deriveGoogleCountryCode(item.address_components),
    regionCode: deriveGoogleRegionCode(item.address_components)
  }));

  return res.json({
    results: results.slice(0, limit)
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


function normalizeSearchText(text = '') {
  return String(text || '').trim().toLowerCase().replace(/[\s,，·・._-]+/g, '');
}

function isLikelyChinaQuery(query = '') {
  const q = String(query || '').trim().toLowerCase();
  return /中国|北京|上海|广州|深圳|香港|澳门|台湾|台北|成都|重庆|杭州|南京|西安|武汉|厦门|青岛|天津|苏州|长沙|郑州|昆明|大连/.test(q)
    || /^(bj|sh|gz|sz|hk)$/.test(q);
}

function getQueryAliases(query = '') {
  const q = normalizeSearchText(query);
  const aliases = new Set([q]);
  const groups = [
    ['tokyo', '东京', '東京'],
    ['losangeles', 'la', '洛杉矶', '洛杉磯'],
    ['newyork', 'nyc', '纽约', '紐約'],
    ['sanfrancisco', 'sf', '旧金山', '舊金山'],
    ['london', '伦敦', '倫敦'],
    ['paris', '巴黎'],
    ['beijing', 'bj', '北京'],
    ['shanghai', 'sh', '上海'],
    ['hongkong', 'hk', '香港']
  ];
  for (const group of groups) {
    if (group.includes(q)) group.forEach(v => aliases.add(v));
  }
  return aliases;
}

function populationScore(population) {
  const n = Number(population);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(35, Math.log10(n) * 5);
}

function rankGeocodingResults(query, results = []) {
  const aliases = getQueryAliases(query);
  const chinaQuery = isLikelyChinaQuery(query);
  const seen = new Map();

  for (const item of results) {
    if (!item || !Number.isFinite(Number(item.lat)) || !Number.isFinite(Number(item.lon))) continue;
    const key = `${Number(item.lat).toFixed(4)},${Number(item.lon).toFixed(4)}`;
    if (!seen.has(key)) seen.set(key, item);
  }

  return Array.from(seen.values()).map(item => {
    const nameNorm = normalizeSearchText(item.name);
    const country = String(item.countryCode || '').toUpperCase();
    const feature = String(item.type || '').toUpperCase();
    const reasons = [];
    let score = 0;

    if ([...aliases].some(a => nameNorm === a || nameNorm.startsWith(a))) {
      score += 100;
      reasons.push('exact_or_prefix');
    } else if ([...aliases].some(a => nameNorm.includes(a))) {
      score += 55;
      reasons.push('contains_alias');
    }

    const pop = populationScore(item.population);
    if (pop) { score += pop; reasons.push('population'); }

    if (/PPLC|PPLA|PPLA2|PPLA3|PPLA4/.test(feature)) {
      score += 20;
      reasons.push('admin_city');
    }

    if (item.provider === 'openmeteo') {
      score += 15;
      reasons.push('global_provider');
    }
    if (item.provider === 'gaode') {
      if (chinaQuery) {
        score += 25;
        reasons.push('china_query_gaode_bonus');
      } else {
        score -= 30;
        reasons.push('non_china_gaode_penalty');
      }
    }

    if (!chinaQuery && country === 'CN') {
      score -= 25;
      reasons.push('non_china_query_cn_penalty');
    }

    return {
      ...item,
      rankScore: Number(score.toFixed(2)),
      rankReason: reasons.join('|') || 'default'
    };
  }).sort((a, b) => b.rankScore - a.rankScore);
}

module.exports = router;
module.exports._private = { rankGeocodingResults, getQueryAliases, isLikelyChinaQuery };
