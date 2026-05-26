/**
 * 访客计数器路由
 *
 * 使用 JSON 文件持久化到 ~/.xiake/visitor-count.json。
 * 不使用 better-sqlite3，避免 Node v22 原生扩展崩溃；部署/重启不能清空计数。
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');

const router = express.Router();
const VISITOR_DATA_DIR = process.env.XIAKE_DATA_DIR || path.join(os.homedir(), '.xiake');
const VISITOR_COUNT_FILE = process.env.VISITOR_COUNT_FILE || path.join(VISITOR_DATA_DIR, 'visitor-count.json');

let memState = loadState();

function ensureDataDir() {
  fs.mkdirSync(path.dirname(VISITOR_COUNT_FILE), { recursive: true });
}

function normalizeStoredCount(value) {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? Math.floor(count) : 0;
}

function normalizeClientSource(value = '') {
  const source = String(value || '').trim().toLowerCase();
  if (['miniprogram', 'miniapp', 'wechat-miniprogram', 'wechat_miniprogram', 'wx', 'weapp'].includes(source)) {
    return 'miniprogram';
  }
  if (['web', 'browser', 'h5', 'website'].includes(source)) return 'web';
  return 'unknown';
}

function sanitizeClientBreakdown(byClient = {}) {
  const result = {};
  for (const [key, value] of Object.entries(byClient || {})) {
    const client = normalizeClientSource(key);
    if (client === 'unknown') continue;
    const count = normalizeStoredCount(value);
    if (count > 0) result[client] = (result[client] || 0) + count;
  }
  return result;
}

function parseState(raw) {
  const data = JSON.parse(raw);
  return {
    count: normalizeStoredCount(data?.count ?? data?.visitorCount),
    byClient: sanitizeClientBreakdown(data?.byClient)
  };
}

function parseCount(raw) {
  return parseState(raw).count;
}

function loadState() {
  try {
    if (fs.existsSync(VISITOR_COUNT_FILE)) {
      return parseState(fs.readFileSync(VISITOR_COUNT_FILE, 'utf8'));
    }
  } catch (error) {
    console.warn('[VisitorCounter] 读取访客计数失败，临时使用内存计数:', error.message);
  }
  return { count: 0, byClient: {} };
}

function loadCount() {
  return loadState().count;
}

function isBotUserAgent(userAgent = '') {
  return /bot|spider|crawler|crawl|headless|censys|mj12|semrush|ahrefs|bytespider|petalbot|bingpreview|facebookexternalhit|python|curl|wget|go-http|scrapy|httpclient|zgrab|nmap|scan/i.test(String(userAgent));
}

function isCountableVisit(req) {
  const userAgent = req.get?.('user-agent') || req.headers?.['user-agent'] || '';
  return !isBotUserAgent(userAgent);
}

function saveState(state) {
  try {
    ensureDataDir();
    const payload = JSON.stringify({
      count: normalizeStoredCount(state?.count),
      byClient: sanitizeClientBreakdown(state?.byClient),
      updatedAt: new Date().toISOString()
    }, null, 2);
    const tmpFile = `${VISITOR_COUNT_FILE}.tmp`;
    fs.writeFileSync(tmpFile, payload);
    fs.renameSync(tmpFile, VISITOR_COUNT_FILE);
  } catch (error) {
    console.warn('[VisitorCounter] 持久化访客计数失败，继续使用内存计数:', error.message);
  }
}

function saveCount(count) {
  saveState({ count, byClient: {} });
}

function getRequestClient(req) {
  return normalizeClientSource(
    req.get?.('x-xiake-client')
    || req.headers?.['x-xiake-client']
    || req.body?.client
    || req.body?.source
    || req.query?.client
    || req.query?.source
  );
}

function buildCountResponse(extra = {}) {
  return {
    count: memState.count,
    byClient: { ...memState.byClient },
    ...extra
  };
}

/**
 * GET /api/visitor/count
 */
router.get('/count', (req, res) => {
  res.json(buildCountResponse());
});

/**
 * POST /api/visitor/count
 */
router.post('/count', (req, res) => {
  if (!isCountableVisit(req)) {
    return res.json(buildCountResponse({ ignored: true, reason: 'bot_user_agent' }));
  }

  const client = getRequestClient(req);
  memState.count += 1;
  if (client !== 'unknown') {
    memState.byClient[client] = (memState.byClient[client] || 0) + 1;
  }
  saveState(memState);
  res.json(buildCountResponse({ client }));
});

module.exports = router;
module.exports._test = {
  parseCount,
  parseState,
  loadCount,
  loadState,
  saveCount,
  saveState,
  normalizeClientSource,
  isBotUserAgent,
  isCountableVisit,
  VISITOR_COUNT_FILE
};
