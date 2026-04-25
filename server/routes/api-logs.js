/**
 * server/routes/api-logs.js - API 调用日志 & 定时更新配置 & 管理后台工具 API
 *
 * 包含：
 * - 外部 API 调用日志（既有）
 * - 日志摘要/统计（既有）
 * - 定时配置（既有）
 * - API Token 管理 + API 申请管理（需求45）
 */
'use strict';

const express = require('express');
const router = express.Router();
const apiLog = require('../services/ApiCallLog');
const apiAuditLog = require('../services/ApiAgentAuditLog');
const apiTokenService = new (require('../services/ApiTokenService'))();
const ApiApplicationService = require('../services/ApiApplicationService');
const dailyStats = require('../services/ApiDailyStats');
const fs = require('fs');
const path = require('path');
const os = require('os');

const apiApplications = new ApiApplicationService();

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

function parseIntSafe(value, fallback = 0) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function findTokenById(id) {
  return apiTokenService.getInternalTokenById(id);
}

function normalizeTokenMeta(reqBody = {}) {
  return {
    name: typeof reqBody.name === 'string' ? reqBody.name.trim() : '',
    minuteLimit: parseIntSafe(reqBody.minuteLimit, apiTokenService._blankTokenRecord().minuteLimit),
    dailyLimit: parseIntSafe(reqBody.dailyLimit, apiTokenService._blankTokenRecord().dailyLimit),
    enabled: reqBody.enabled !== false
  };
}

function normalizeScopeStatus(body) {
  if (!body) return 'unknown';
  return body.status || 'pending';
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
  const today = dailyStats.getToday();
  res.json({ success: true, summary, today });
});

// ---------------------------------------------------------------------------
// GET /api/admin/logs/daily — 获取近N天按日聚合统计
// ---------------------------------------------------------------------------
router.get('/logs/daily', (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 30);
  const data = dailyStats.getDaily(days);
  res.json({ success: true, ...data });
});

// ---------------------------------------------------------------------------
// GET /api/admin/logs/hourly — 获取今日每小时统计
// ---------------------------------------------------------------------------
router.get('/logs/hourly', (req, res) => {
  const hourly = apiLog.getHourlyStats();
  res.json({ success: true, hourly });
});

// ---------------------------------------------------------------------------
// GET /api/admin/tokens — Token 列表
// ---------------------------------------------------------------------------
router.get('/tokens', (req, res) => {
  const tokens = apiTokenService.listTokens();
  res.json({ success: true, tokens });
});

// ---------------------------------------------------------------------------
// POST /api/admin/tokens — 创建 token
// ---------------------------------------------------------------------------
router.post('/tokens', (req, res) => {
  try {
    const payload = normalizeTokenMeta(req.body);
    if (!payload.name) {
      return res.status(400).json({ error: { code: 'INVALID_PARAMS', message: 'name is required' } });
    }

    const { token, tokenMeta } = apiTokenService.createToken({
      name: payload.name,
      minuteLimit: payload.minuteLimit,
      dailyLimit: payload.dailyLimit,
      enabled: payload.enabled
    });

    res.status(201).json({ success: true, token, tokenMeta });
  } catch (err) {
    res.status(500).json({ error: { code: err.code || 'CREATE_TOKEN_FAILED', message: err.message || 'create token failed' } });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/tokens/:id — 更新 token（改名/启停/改限流）
// ---------------------------------------------------------------------------
router.patch('/tokens/:id', (req, res) => {
  try {
    const { id } = req.params;
    const patch = {
      name: req.body?.name,
      enabled: req.body?.enabled,
      minuteLimit: parseIntSafe(req.body?.minuteLimit, NaN),
      dailyLimit: parseIntSafe(req.body?.dailyLimit, NaN)
    };

    if (!Number.isFinite(patch.minuteLimit)) {
      delete patch.minuteLimit;
    }
    if (!Number.isFinite(patch.dailyLimit)) {
      delete patch.dailyLimit;
    }

    const tokenMeta = apiTokenService.updateToken(id, patch);
    if (!tokenMeta) {
      return res.status(404).json({ error: { code: 'TOKEN_NOT_FOUND', message: 'token not found' } });
    }

    return res.json({ success: true, token: tokenMeta });
  } catch (err) {
    return res.status(500).json({ error: { code: err.code || 'UPDATE_TOKEN_FAILED', message: err.message || 'update token failed' } });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/tokens/:id — 删除（吊销） token
// ---------------------------------------------------------------------------
router.delete('/tokens/:id', (req, res) => {
  const ok = apiTokenService.deleteToken(req.params.id);
  if (!ok) {
    return res.status(404).json({ error: { code: 'TOKEN_NOT_FOUND', message: 'token not found' } });
  }
  return res.json({ success: true });
});

// ---------------------------------------------------------------------------
// GET /api/admin/applications — 申请列表
// ---------------------------------------------------------------------------
router.get('/applications', (req, res) => {
  const status = req.query.status;
  const list = apiApplications.listApplications().filter((item) => !status || item.status === status);
  res.json({ success: true, applications: list });
});

// ---------------------------------------------------------------------------
// POST /api/admin/applications/:id/review — 审批申请
//  body: { status, remarks, createToken, tokenName, minuteLimit, dailyLimit }
// ---------------------------------------------------------------------------
router.post('/applications/:id/review', (req, res) => {
  try {
    const { id } = req.params;
    const status = normalizeScopeStatus(req.body);
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: { code: 'INVALID_STATUS', message: 'status must be pending/approved/rejected' } });
    }

    const existing = apiApplications.getApplicationById(id);
    if (!existing) {
      return res.status(404).json({ error: { code: 'APPLICATION_NOT_FOUND', message: 'application not found' } });
    }

    const patch = {
      status,
      remarks: req.body?.remarks,
    };

    const app = apiApplications.updateApplication(id, patch);
    if (!app) {
      return res.status(404).json({ error: { code: 'APPLICATION_NOT_FOUND', message: 'application not found' } });
    }

    let createdToken = null;
    if (status === 'approved' && req.body?.createToken) {
      if (!existing.tokenId) {
        const { token, tokenMeta } = apiTokenService.createToken({
          name: (req.body?.tokenName || `api-${existing.email}`).slice(0, 60),
          minuteLimit: parseIntSafe(req.body?.minuteLimit, 120),
          dailyLimit: parseIntSafe(req.body?.dailyLimit, 5000)
        });
        app.tokenId = tokenMeta.id;
        apiApplications.linkToken(id, tokenMeta.id);
        createdToken = token;
      }
    }

    return res.json({ success: true, application: app, token: createdToken });
  } catch (err) {
    return res.status(500).json({ error: { code: err.code || 'REVIEW_FAILED', message: err.message || 'review failed' } });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/audit-logs — 查询审计日志
// ---------------------------------------------------------------------------
router.get('/audit-logs', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;
  const logs = apiAuditLog.list(limit);
  res.json({ success: true, logs });
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
