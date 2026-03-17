/**
 * Tile Proxy - 代理地图瓦片请求，解决浏览器跨域/访问受限问题
 * GET /api/tiles/gaode/:z/:x/:y  — 代理高德地图瓦片
 */
const express = require('express');
const router = express.Router();
const https = require('https');
const http = require('http');

router.get('/gaode/:z/:x/:y', (req, res) => {
  const { z, x, y } = req.params;
  const sub = ['1', '2', '3', '4'][Math.floor(Math.random() * 4)];
  const url = `https://webrd0${sub}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x=${x}&y=${y}&z=${z}`;

  const lib = url.startsWith('https') ? https : http;
  const request = lib.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; sunset-proxy/1.0)',
      'Referer': 'https://map.amap.com/'
    },
    timeout: 8000
  }, (upstream) => {
    res.setHeader('Content-Type', upstream.headers['content-type'] || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    upstream.pipe(res);
  });

  request.on('error', (err) => {
    res.status(502).end();
  });

  request.on('timeout', () => {
    request.destroy();
    res.status(504).end();
  });
});

module.exports = router;
