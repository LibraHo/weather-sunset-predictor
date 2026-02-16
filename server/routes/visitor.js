/**
 * 访客计数器路由
 *
 * 提供访客计数的读取和递增功能
 * 使用文件存储持久化访客数据
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const DATA_DIR = path.join(__dirname, '..', 'data');
const COUNT_FILE = path.join(DATA_DIR, 'visitor-count.json');

/**
 * 确保数据目录和文件存在
 */
function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(COUNT_FILE)) {
    fs.writeFileSync(COUNT_FILE, JSON.stringify({ count: 0 }), 'utf-8');
  }
}

/**
 * 读取当前访客数
 * @returns {number}
 */
function readCount() {
  ensureDataFile();
  try {
    const data = JSON.parse(fs.readFileSync(COUNT_FILE, 'utf-8'));
    return data.count || 0;
  } catch {
    return 0;
  }
}

/**
 * 写入访客数
 * @param {number} count
 */
function writeCount(count) {
  ensureDataFile();
  fs.writeFileSync(COUNT_FILE, JSON.stringify({ count }), 'utf-8');
}

/**
 * GET /api/visitor/count
 * 获取当前访客数（不递增）
 */
router.get('/count', (req, res) => {
  const count = readCount();
  res.json({ count });
});

/**
 * POST /api/visitor/count
 * 递增访客数并返回最新值
 */
router.post('/count', (req, res) => {
  let count = readCount();
  count += 1;
  writeCount(count);
  res.json({ count });
});

module.exports = router;
