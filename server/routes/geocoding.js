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

// ========== 高频城市别名映射 ==========
// 需求44：覆盖中美欧主要城市的常用别名，便于搜索补全与结果排序
const CITY_ALIAS_RECORDS = [
  // 中国
  { canonical: 'beijing', zh: ['北京'], en: ['beijing'], aliases: ['bj', '北京', 'beijing'], regionCode: null, countryCode: 'CN' },
  { canonical: 'shanghai', zh: ['上海'], en: ['shanghai'], aliases: ['sh', '上海', 'shanghai'], regionCode: null, countryCode: 'CN' },
  { canonical: 'guangzhou', zh: ['广州'], en: ['guangzhou'], aliases: ['gz', '广州', 'guangzhou'], regionCode: null, countryCode: 'CN' },
  { canonical: 'shenzhen', zh: ['深圳'], en: ['shenzhen'], aliases: ['sz', '深圳', 'shenzhen'], regionCode: null, countryCode: 'CN' },
  { canonical: 'hongkong', zh: ['香港'], en: ['hong kong', 'hongkong', 'hk'], aliases: ['hk', 'hongkong', 'hong kong', '香港'], regionCode: 'HK', countryCode: 'HK' },
  { canonical: 'macao', zh: ['澳门'], en: ['macau', 'macao'], aliases: ['macao', 'macau', '澳门'], regionCode: 'MO', countryCode: 'MO' },
  { canonical: 'taipei', zh: ['台北'], en: ['taipei'], aliases: ['taipei', '台北'], regionCode: 'TW', countryCode: 'TW' },
  { canonical: 'chengdu', zh: ['成都'], en: ['chengdu'], aliases: ['成都', 'chengdu'], regionCode: null, countryCode: 'CN' },
  { canonical: 'chongqing', zh: ['重庆'], en: ['chongqing'], aliases: ['重庆', 'chongqing'], regionCode: null, countryCode: 'CN' },
  { canonical: 'hangzhou', zh: ['杭州'], en: ['hangzhou'], aliases: ['杭州', 'hangzhou'], regionCode: null, countryCode: 'CN' },
  { canonical: 'nanjing', zh: ['南京'], en: ['nanjing'], aliases: ['南京', 'nanjing'], regionCode: null, countryCode: 'CN' },
  { canonical: 'xian', zh: ['西安'], en: ['xian', 'xi an', 'xi-an'], aliases: ['西安', 'xian', 'xi an', 'xi-an'], regionCode: null, countryCode: 'CN' },
  { canonical: 'wuhan', zh: ['武汉'], en: ['wuhan'], aliases: ['武汉', 'wuhan'], regionCode: null, countryCode: 'CN' },
  { canonical: 'xiamen', zh: ['厦门'], en: ['xiamen'], aliases: ['厦门', 'xiamen'], regionCode: null, countryCode: 'CN' },
  { canonical: 'qingdao', zh: ['青岛'], en: ['qingdao'], aliases: ['青岛', 'qingdao'], regionCode: null, countryCode: 'CN' },

  // 美国
  { canonical: 'losangeles', zh: ['洛杉矶'], en: ['los angeles', 'la'], aliases: ['la', 'los angeles', '洛杉矶'], regionCode: 'CA', countryCode: 'US' },
  { canonical: 'newyork', zh: ['纽约'], en: ['new york', 'ny', 'nyc'], aliases: ['nyc', 'new york', 'newyork', 'ny', '纽约'], regionCode: 'NY', countryCode: 'US' },
  { canonical: 'sanfrancisco', zh: ['旧金山'], en: ['san francisco', 'sf'], aliases: ['sf', 'san francisco', '旧金山'], regionCode: 'CA', countryCode: 'US' },
  { canonical: 'washingtondc', zh: ['华盛顿', '华盛顿特区'], en: ['washington dc', 'dc'], aliases: ['dc', 'washington dc', 'washington, dc', '华盛顿'], regionCode: 'DC', countryCode: 'US' },
  { canonical: 'seattle', zh: ['西雅图'], en: ['seattle'], aliases: ['西雅图', 'seattle'], regionCode: 'WA', countryCode: 'US' },
  { canonical: 'chicago', zh: ['芝加哥'], en: ['chicago'], aliases: ['芝加哥', 'chicago'], regionCode: 'IL', countryCode: 'US' },
  { canonical: 'boston', zh: ['波士顿'], en: ['boston'], aliases: ['波士顿', 'boston'], regionCode: 'MA', countryCode: 'US' },
  { canonical: 'lasvegas', zh: ['拉斯维加斯'], en: ['las vegas'], aliases: ['拉斯维加斯', 'las vegas', 'lasvegas'], regionCode: 'NV', countryCode: 'US' },
  { canonical: 'miami', zh: ['迈阿密'], en: ['miami'], aliases: ['迈阿密', 'miami'], regionCode: 'FL', countryCode: 'US' },

  // 欧洲
  { canonical: 'london', zh: ['伦敦'], en: ['london'], aliases: ['伦敦', 'london'], regionCode: 'LND', countryCode: 'GB' },
  { canonical: 'paris', zh: ['巴黎'], en: ['paris'], aliases: ['巴黎', 'paris'], regionCode: 'PAR', countryCode: 'FR' },
  { canonical: 'berlin', zh: ['柏林'], en: ['berlin'], aliases: ['柏林', 'berlin'], regionCode: 'BE', countryCode: 'DE' },
  { canonical: 'rome', zh: ['罗马'], en: ['rome'], aliases: ['罗马', 'rome'], regionCode: 'RM', countryCode: 'IT' },
  { canonical: 'madrid', zh: ['马德里'], en: ['madrid'], aliases: ['马德里', 'madrid'], regionCode: 'MD', countryCode: 'ES' },
  { canonical: 'barcelona', zh: ['巴塞罗那'], en: ['barcelona'], aliases: ['巴塞罗那', 'barcelona'], regionCode: 'B', countryCode: 'ES' },
  { canonical: 'amsterdam', zh: ['阿姆斯特丹'], en: ['amsterdam'], aliases: ['阿姆斯特丹', 'amsterdam'], regionCode: 'NH', countryCode: 'NL' },
  { canonical: 'milan', zh: ['米兰'], en: ['milan'], aliases: ['米兰', 'milan'], regionCode: '25', countryCode: 'IT' },
  { canonical: 'zurich', zh: ['苏黎世'], en: ['zurich'], aliases: ['苏黎世', 'zurich'], regionCode: 'ZH', countryCode: 'CH' },
  { canonical: 'vienna', zh: ['维也纳'], en: ['vienna'], aliases: ['维也纳', 'vienna'], regionCode: '9', countryCode: 'AT' },
  { canonical: 'prague', zh: ['布拉格'], en: ['prague'], aliases: ['布拉格', 'prague'], regionCode: 'PR', countryCode: 'CZ' },
  { canonical: 'athens', zh: ['雅典'], en: ['athens'], aliases: ['雅典', 'athens'], regionCode: 'A', countryCode: 'GR' },
  { canonical: 'istanbul', zh: ['伊斯坦布尔'], en: ['istanbul'], aliases: ['伊斯坦布尔', 'istanbul'], regionCode: '34', countryCode: 'TR' }
];

const CITY_ALIAS_INDEX = (() => {
  const index = new Map();
  CITY_ALIAS_RECORDS.forEach(record => {
    const aliases = new Set(record.aliases || []);
    aliases.add(record.canonical);
    for (const alias of aliases) {
      index.set(alias.toLowerCase(), record);
    }
  });
  return index;
})();

function normalizeAliasToken(input = '') {
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/[\s_\-+,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupeStrings(values = []) {
  const result = [];
  const seen = new Set();
  for (const value of values) {
    if (!value) continue;
    const normalized = normalizeAliasToken(value);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(value.trim());
  }
  return result;
}

function getCityAliasDataForQuery(query) {
  const normalized = normalizeAliasToken(query);
  if (!normalized) return null;
  const direct = CITY_ALIAS_INDEX.get(normalized);
  if (direct) return direct;

  const partial = CITY_ALIAS_RECORDS.find(record =>
    (record.aliases || []).some(alias => normalizeAliasToken(alias) === normalized)
  );
  if (partial) return partial;

  return null;
}

function getAliasTokensForQuery(query) {
  const data = getCityAliasDataForQuery(query);
  if (!data) return [query.trim()];

  return dedupeStrings([
    query,
    ...(data.aliases || []),
    ...(data.zh || []),
    ...(data.en || []),
    data.canonical
  ]);
}

function normalizeQuery(query) {
  if (!query || typeof query !== 'string') return query;
  return normalizeAliasToken(getAliasTokensForQuery(query)[0] || query).trim();
}

/**
 * 给定查询返回所有可用别名与变体（用于合并搜索结果）
 * @param {string} query - 原始查询
 * @returns {string[]} - 所有可能的查询变体
 */
function getQueryVariants(query) {
  if (!query || typeof query !== 'string') return [];
  return dedupeStrings(getAliasTokensForQuery(query));
}

/**
 * 简单别名打分：用于对搜索结果进行重排，提升中文简称/缩写命中的优先级
 * @param {string} resultName
 * @param {string[]} aliases
 * @returns {number}
 */
function scoreResultByAlias(resultName, aliases) {
  const normalizedName = normalizeAliasToken(resultName || '');
  let bestScore = 0;

  aliases.forEach((aliasRaw, aliasIndex) => {
    const alias = normalizeAliasToken(aliasRaw);
    if (!alias) {
      return;
    }

    let score = 0;
    if (normalizedName === alias) {
      score = 100;
    } else if (normalizedName.startsWith(`${alias} `) || normalizedName.includes(` ${alias} `)) {
      score = 90;
    } else if (normalizedName.startsWith(alias) || normalizedName.endsWith(alias) || normalizedName.includes(alias)) {
      score = 70;
    }

    if (score > 0) {
      const weightedScore = score * 1000 + (aliases.length - aliasIndex);
      bestScore = Math.max(bestScore, weightedScore);
    }
  });

  return bestScore;
}

/**
 * 对地理编码结果按别名命中度重排序
 * @param {Array<{name:string}>} results
 * @param {string} query
 */
function rankGeocodingResults(results = [], query = '') {
  const aliases = getAliasTokensForQuery(query);
  const withScore = results.map((item, index) => ({
    ...item,
    __geoAliasMatchScore: scoreResultByAlias(item?.name, aliases),
    __geoAliasIndex: index
  }));

  return withScore
    .sort((a, b) => {
      if (b.__geoAliasMatchScore !== a.__geoAliasMatchScore) {
        return b.__geoAliasMatchScore - a.__geoAliasMatchScore;
      }
      return a.__geoAliasIndex - b.__geoAliasIndex;
    })
    .map(item => {
      const copy = { ...item };
      delete copy.__geoAliasMatchScore;
      delete copy.__geoAliasIndex;
      return copy;
    });
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
  // Auto 策略：高德（国内）+ Open-Meteo（全球）合并，去重后返回
  const effectiveKey = apiKey || process.env.GAODE_API_KEY;

  // 始终获取 Open-Meteo 结果（覆盖全球）
  const omPromise = fetchOpenMeteoResults(query, limit * 2);

  if (effectiveKey) {
    try {
      const response = await axios.get(`${GAODE_BASE}/geocode/geo`, {
        params: { address: query, key: effectiveKey, output: 'JSON' },
        timeout: 8000
      });
      const data = response.data;
      const omResults = await omPromise;

      if (data.status === '1' && data.geocodes && data.geocodes.length > 0) {
        let gaodeResults = data.geocodes.map(item => {
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

        // 合并：高德结果放前面（国内优先），然后 Open-Meteo 结果去重补充
        const seenKeys = new Set(gaodeResults.map(r => `${r.lat.toFixed(4)},${r.lon.toFixed(4)}`));
        for (const r of omResults) {
          const key = `${r.lat.toFixed(4)},${r.lon.toFixed(4)}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            gaodeResults.push(r);
          }
        }
        return res.json(attachSearchMeta({ results: gaodeResults.slice(0, limit) }, { providerUsed: 'gaode+openmeteo', fallbackUsed: false }));
      }

      // 高德无结果，直接返回 Open-Meteo
      return res.json(attachSearchMeta({ results: omResults.slice(0, limit) }, {
        providerUsed: 'openmeteo',
        fallbackUsed: true,
        fallbackReason: 'gaode_empty_result'
      }));
    } catch (error) {
      const omResults = await omPromise;
      return res.json(attachSearchMeta({ results: omResults.slice(0, limit) }, {
        providerUsed: 'openmeteo',
        fallbackUsed: true,
        fallbackReason: error.code === 'ECONNABORTED' ? 'gaode_timeout' : 'gaode_error'
      }));
    }
  }

  // 无高德 key 时直接 openmeteo
  const om = await omPromise;
  return res.json(attachSearchMeta({ results: om.slice(0, limit) }, {
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
                regionCode: resolveAdminRegionCode(item.admin1)
              });
            }
          }
        }
      } catch (error) {
        console.warn(`[Geocoding] Open-Meteo 搜索变体 "${variant}" (${lang}) 失败:`, error.message);
      }
    }
  }

  return rankGeocodingResults(allResults, query);
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

module.exports = router;
module.exports._test = {
  CITY_ALIAS_RECORDS,
  CITY_ALIAS_INDEX,
  normalizeAliasToken,
  getCityAliasDataForQuery,
  getQueryVariants,
  getAliasTokensForQuery,
  scoreResultByAlias,
  rankGeocodingResults
};
