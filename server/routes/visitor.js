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

let memCount = loadCount();

function ensureDataDir() {
  fs.mkdirSync(path.dirname(VISITOR_COUNT_FILE), { recursive: true });
}

function parseCount(raw) {
  const data = JSON.parse(raw);
  const count = Number(data?.count ?? data?.visitorCount ?? 0);
  return Number.isFinite(count) && count >= 0 ? Math.floor(count) : 0;
}

function loadCount() {
  try {
    if (fs.existsSync(VISITOR_COUNT_FILE)) {
      return parseCount(fs.readFileSync(VISITOR_COUNT_FILE, 'utf8'));
    }
  } catch (error) {
    console.warn('[VisitorCounter] 读取访客计数失败，临时使用内存计数:', error.message);
  }
  return 0;
}

function isBotUserAgent(userAgent = '') {
  return /bot|spider|crawler|crawl|headless|censys|mj12|semrush|ahrefs|bytespider|petalbot|bingpreview|facebookexternalhit|python|curl|wget|go-http|scrapy|httpclient|zgrab|nmap|scan/i.test(String(userAgent));
}

function isCountableVisit(req) {
  const userAgent = req.get?.('user-agent') || req.headers?.['user-agent'] || '';
  return !isBotUserAgent(userAgent);
}

function saveCount(count) {
  try {
    ensureDataDir();
    const payload = JSON.stringify({ count, updatedAt: new Date().toISOString() }, null, 2);
    const tmpFile = `${VISITOR_COUNT_FILE}.tmp`;
    fs.writeFileSync(tmpFile, payload);
    fs.renameSync(tmpFile, VISITOR_COUNT_FILE);
  } catch (error) {
    console.warn('[VisitorCounter] 持久化访客计数失败，继续使用内存计数:', error.message);
  }
}

/**
 * GET /api/visitor/count
 */
router.get('/count', (req, res) => {
  res.json({ count: memCount });
});

/**
 * POST /api/visitor/count
 */
router.post('/count', (req, res) => {
  if (!isCountableVisit(req)) {
    return res.json({ count: memCount, ignored: true, reason: 'bot_user_agent' });
  }

  memCount += 1;
  saveCount(memCount);
  res.json({ count: memCount });
});

module.exports = router;
module.exports._test = { parseCount, loadCount, saveCount, isBotUserAgent, isCountableVisit, VISITOR_COUNT_FILE };
