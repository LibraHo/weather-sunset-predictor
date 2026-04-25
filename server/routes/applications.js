/**
 * API 申请路由（前台入口）
 */

'use strict';

const express = require('express');
const router = express.Router();
const ApiApplicationService = require('../services/ApiApplicationService');

const service = new ApiApplicationService();

// POST /api/applications
// 最小字段：email, contact；用途 purpose / expectedCallVolume 可选
router.post('/', (req, res) => {
  try {
    const application = service.submitApplication(req.body || {});
    return res.status(201).json({ success: true, application: {
      id: application.id,
      email: application.email,
      contact: application.contact,
      purpose: application.purpose,
      expectedCallVolume: application.expectedCallVolume,
      status: application.status,
      remarks: application.remarks,
      createdAt: application.createdAt
    } });
  } catch (err) {
    const status = err.code === 'INVALID_PARAMS' ? 400 : 500;
    return res.status(status).json({
      error: { code: err.code || 'SUBMIT_FAILED', message: err.message || 'submit failed' }
    });
  }
});

// GET /api/applications/public?（仅返回最小公共字段，避免泄露敏感信息）
router.get('/', (req, res) => {
  const status = req.query?.status;
  const list = service
    .listApplications()
    .filter((item) => !status || item.status === status)
    .map((item) => ({
      id: item.id,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }));

  return res.json({ success: true, applications: list });
});

module.exports = router;
