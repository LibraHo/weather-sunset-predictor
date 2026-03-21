/**
 * 访客计数器路由
 *
 * 纯内存计数（移除 better-sqlite3 原生扩展，避免在 Node v22 下 malloc 崩溃）
 * 重启后计数重置，可接受，稳定性优先。
 */

const express = require('express');
const router = express.Router();

let memCount = 0;

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
  memCount += 1;
  res.json({ count: memCount });
});

module.exports = router;
