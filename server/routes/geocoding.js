const express = require('express');
const router = express.Router();
const axios = require('axios');

/**
 * 地理编码代理路由
 *
 * 支持多个地理编码服务提供商，解决中国大陆 Google/Nominatim 访问问题。
 *
 * 支持的提供商:
 * - nominatim: OpenStreetMap Nominatim (免费，全球可用)
 * - gaode: 高德地图 (中国大陆优化，需要 API Key)
 *
 * 需求：24
 */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const GAODE_BASE = 'https://restapi.amap.com/v3';

/**
 * GET /api/geocoding/search
 * 地名转坐标（正向地理编码）
 *
 * 查询参数:
 * - q: 搜索关键词 (必填)
 * - provider: nominatim | gaode (可选，默认 nominatim)
 * - key: 提供商 API Key (gaode 必填)
 */
router.get('/search', async (req, res, next) => {
  try {
    const { q, provider = 'nominatim', key } = req.query;

    if (!q || !q.trim()) {
      return res.status(400).json({
        error: { code: 'INVALID_PARAMS', message: '缺少搜索关键词 q' }
      });
    }

    if (provider === 'gaode') {
      return await handleGaodeSearch(req, res, q.trim(), key);
    } else {
      return await handleNominatimSearch(req, res, q.trim());
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
 * - lat: 纬度 (必填)
 * - lon: 经度 (必填)
 * - provider: nominatim | gaode (可选，默认 nominatim)
 * - key: 提供商 API Key (gaode 必填)
 */
router.get('/reverse', async (req, res, next) => {
  try {
    const { lat, lon, provider = 'nominatim', key } = req.query;

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

    if (provider === 'gaode') {
      return await handleGaodeReverse(req, res, latNum, lonNum, key);
    } else {
      return await handleNominatimReverse(req, res, latNum, lonNum);
    }
  } catch (error) {
    next(error);
  }
});

// ========== Nominatim 处理函数 ==========

async function handleNominatimSearch(req, res, query) {
  const url = `${NOMINATIM_BASE}/search`;
  const params = {
    q: query,
    format: 'json',
    limit: 5,
    addressdetails: 1
  };

  console.log(`[Geocoding] Nominatim 搜索: "${query}"`);

  const response = await axios.get(url, {
    params,
    headers: { 'User-Agent': 'WeatherSunsetPredictor/1.0' },
    timeout: 8000
  });

  const data = response.data;
  if (!data || data.length === 0) {
    return res.json({ results: [] });
  }

  const results = data.map(item => ({
    name: item.display_name,
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon),
    type: item.type,
    provider: 'nominatim'
  }));

  return res.json({ results });
}

async function handleNominatimReverse(req, res, lat, lon) {
  const url = `${NOMINATIM_BASE}/reverse`;
  const params = {
    lat,
    lon,
    format: 'json',
    addressdetails: 1
  };

  console.log(`[Geocoding] Nominatim 反向地理编码: ${lat},${lon}`);

  const response = await axios.get(url, {
    params,
    headers: { 'User-Agent': 'WeatherSunsetPredictor/1.0' },
    timeout: 8000
  });

  const data = response.data;
  if (!data || !data.display_name) {
    return res.json({ name: null });
  }

  return res.json({
    name: data.display_name,
    lat,
    lon,
    provider: 'nominatim'
  });
}

// ========== 高德地图 处理函数 ==========

async function handleGaodeSearch(req, res, query, apiKey) {
  if (!apiKey) {
    return res.status(400).json({
      error: { code: 'MISSING_API_KEY', message: '使用高德地图需要提供 API Key' }
    });
  }

  const url = `${GAODE_BASE}/geocode/geo`;
  const params = {
    address: query,
    key: apiKey,
    output: 'JSON'
  };

  console.log(`[Geocoding] 高德地图搜索: "${query}"`);

  const response = await axios.get(url, { params, timeout: 8000 });
  const data = response.data;

  if (data.status !== '1' || !data.geocodes || data.geocodes.length === 0) {
    return res.json({ results: [] });
  }

  const results = data.geocodes.map(item => {
    const [lonStr, latStr] = item.location.split(',');
    return {
      name: item.formatted_address,
      lat: parseFloat(latStr),
      lon: parseFloat(lonStr),
      type: 'place',
      provider: 'gaode'
    };
  });

  return res.json({ results });
}

async function handleGaodeReverse(req, res, lat, lon, apiKey) {
  if (!apiKey) {
    return res.status(400).json({
      error: { code: 'MISSING_API_KEY', message: '使用高德地图需要提供 API Key' }
    });
  }

  const url = `${GAODE_BASE}/geocode/regeo`;
  const params = {
    location: `${lon},${lat}`,
    key: apiKey,
    output: 'JSON',
    radius: 1000,
    extensions: 'base'
  };

  console.log(`[Geocoding] 高德地图反向地理编码: ${lat},${lon}`);

  const response = await axios.get(url, { params, timeout: 8000 });
  const data = response.data;

  if (data.status !== '1' || !data.regeocode || !data.regeocode.formatted_address) {
    return res.json({ name: null });
  }

  return res.json({
    name: data.regeocode.formatted_address,
    lat,
    lon,
    provider: 'gaode'
  });
}

module.exports = router;
