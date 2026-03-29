/**
 * server/routes/api-logs.js - API 调用日志 & 定时更新配置 API
 *
 * 所有路由需要 Basic Auth
 */
'use strict';

const express = require('express');
const router = express.Router();
const apiLog = require('../services/ApiCallLog');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ---------------------------------------------------------------------------
// 定时更新配置
// ---------------------------------------------------------------------------
const SCHEDULE_CONFIG_DIR = path.join(os.homedir(), '.xiake');
const SCHEDULE_CONFIG_PATH = path.join(SCHEDULE_CONFIG_DIR, 'schedule-config.json');

const DEFAULT_SCHEDULE = {
  enabled: true,
  jobs: [
    { time: '10:00', type: 'both', label: '上午刷新' },
    { time: '22:00', type: 'both', label: '晚间刷新' }
  ]
};

function _readScheduleConfig() {
  try {
    if (!fs.existsSync(SCHEDULE_CONFIG_PATH)) {
      return { ...DEFAULT_SCHEDULE };
    }
    const raw = fs.readFileSync(SCHEDULE_CONFIG_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[ScheduleConfig] 读取配置失败:', err.message);
    return { ...DEFAULT_SCHEDULE };
  }
}

function _writeScheduleConfig(config) {
  if (!fs.existsSync(SCHEDULE_CONFIG_DIR)) {
    fs.mkdirSync(SCHEDULE_CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(SCHEDULE_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// GET /api/admin/logs — 获取最近日志
// ---------------------------------------------------------------------------
router.get('/logs', (req, res) => {
  const { type, limit } = req.query;
  const logs = apiLog.getLogs({
    type: type || undefined,
    limit: Math.min(parseInt(limit) || 50, 200)
  });
  res.json({ success: true, logs });
});

// ---------------------------------------------------------------------------
// GET /api/admin/logs/summary — 获取统计摘要
// ---------------------------------------------------------------------------
router.get('/logs/summary', (req, res) => {
  const summary = apiLog.getSummary();
  res.json({ success: true, summary });
});

// ---------------------------------------------------------------------------
// GET /api/admin/schedule — 获取定时更新配置
// ---------------------------------------------------------------------------
router.get('/schedule', (req, res) => {
  const config = _readScheduleConfig();
  res.json({ success: true, config });
});

// ---------------------------------------------------------------------------
// POST /api/admin/schedule — 保存定时更新配置
// ---------------------------------------------------------------------------
router.post('/schedule', (req, res) => {
  try {
    const config = req.body;
    if (!config || !Array.isArray(config.jobs)) {
      return res.status(400).json({
        error: { code: 'INVALID_CONFIG', message: '配置格式错误，需要 jobs 数组' }
      });
    }
    // 验证每个 job
    for (const job of config.jobs) {
      if (!/^\d{2}:\d{2}$/.test(job.time)) {
        return res.status(400).json({
          error: { code: 'INVALID_TIME', message: `时间格式错误: ${job.time}，应为 HH:MM` }
        });
      }
      if (!['sunrise', 'sunset', 'both'].includes(job.type)) {
        return res.status(400).json({
          error: { code: 'INVALID_TYPE', message: `类型错误: ${job.type}，应为 sunrise/sunset/both` }
        });
      }
    }
    config.enabled = config.enabled !== false;
    _writeScheduleConfig(config);

    // 通知调度器重新加载（通过全局事件）
    if (global.__scheduleReload) {
      global.__scheduleReload();
    }

    res.json({ success: true, config });
  } catch (err) {
    console.error('[ScheduleConfig] 保存失败:', err);
    res.status(500).json({
      error: { code: 'SAVE_FAILED', message: '保存配置失败' }
    });
  }
});

module.exports = router;
