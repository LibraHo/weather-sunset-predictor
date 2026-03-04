/**
 * 访客计数器路由
 *
 * 使用 SQLite 持久化存储，数据库位于 ~/.xiake/visitor.db
 * 不受代码更新/重启影响
 */

const express = require('express');
const path = require('path');
const os = require('os');
const fs = require('fs');

const router = express.Router();

// 数据库存在用户 home 目录下，与代码完全隔离
const DB_DIR = path.join(os.homedir(), '.xiake');
const DB_PATH = path.join(DB_DIR, 'visitor.db');

// 初始化 SQLite
let db;
function getDB() {
  if (db) return db;
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    const Database = require('better-sqlite3');
    db = new Database(DB_PATH);
    db.exec(`
      CREATE TABLE IF NOT EXISTS visitor_count (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        count INTEGER NOT NULL DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT OR IGNORE INTO visitor_count (id, count) VALUES (1, 0);
    `);
    console.log('[Visitor] SQLite 数据库已连接:', DB_PATH);
  } catch (err) {
    console.error('[Visitor] SQLite 初始化失败，降级为内存计数:', err.message);
    db = null;
  }
  return db;
}

// 内存计数（SQLite 不可用时的备用）
let memCount = 0;

function readCount() {
  const database = getDB();
  if (database) {
    try {
      const row = database.prepare('SELECT count FROM visitor_count WHERE id = 1').get();
      return row ? row.count : 0;
    } catch (err) {
      console.error('[Visitor] 读取失败:', err.message);
    }
  }
  return memCount;
}

function incrementCount() {
  const database = getDB();
  if (database) {
    try {
      database.prepare(`
        UPDATE visitor_count SET count = count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = 1
      `).run();
      const row = database.prepare('SELECT count FROM visitor_count WHERE id = 1').get();
      return row ? row.count : 0;
    } catch (err) {
      console.error('[Visitor] 递增失败:', err.message);
    }
  }
  memCount += 1;
  return memCount;
}

/**
 * GET /api/visitor/count
 */
router.get('/count', (req, res) => {
  const count = readCount();
  res.json({ count });
});

/**
 * POST /api/visitor/count
 */
router.post('/count', (req, res) => {
  const count = incrementCount();
  res.json({ count });
});

module.exports = router;
