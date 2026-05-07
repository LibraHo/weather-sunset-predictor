'use strict';

const express = require('express');
const shareStats = require('../services/ShareStatsService');

const router = express.Router();

function clientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || '';
}

// Public endpoint: called by frontend after a completed share action.
router.post('/event', (req, res) => {
  try {
    const summary = shareStats.record({
      action: req.body?.action,
      period: req.body?.period,
      source: req.body?.source,
      userAgent: req.get?.('user-agent') || req.headers['user-agent'] || '',
      ip: clientIp(req)
    });
    res.json({ success: true, today: summary.today, total: summary.total });
  } catch (err) {
    res.status(500).json({ error: { code: 'SHARE_STATS_RECORD_FAILED', message: err.message || 'record failed' } });
  }
});

// Mounted under /api/admin as well, protected by admin Basic Auth there.
router.get('/summary', (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 30);
    res.json(shareStats.getSummary({ days }));
  } catch (err) {
    res.status(500).json({ error: { code: 'SHARE_STATS_SUMMARY_FAILED', message: err.message || 'summary failed' } });
  }
});

module.exports = router;
module.exports._test = { clientIp };
