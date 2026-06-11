'use strict';

const express = require('express');
const multer = require('multer');
const UserService = require('../services/UserService');
const feedbackService = require('../services/FeedbackService');

const SESSION_COOKIE = 'xiake_session';
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 2 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      const err = new Error(`Unsupported image type: ${file.mimetype}`);
      err.code = 'UNSUPPORTED_MIME';
      return cb(err, false);
    }
    cb(null, true);
  }
});

function getCookie(header = '', name) {
  const cookies = String(header).split(';').map((part) => part.trim()).filter(Boolean);
  for (const cookie of cookies) {
    const separator = cookie.indexOf('=');
    if (separator < 0) continue;
    if (cookie.slice(0, separator) === name) return decodeURIComponent(cookie.slice(separator + 1));
  }
  return null;
}

function extractToken(req) {
  const auth = req.get('authorization') || '';
  if (/^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, '').trim();
  return req.get('x-session-token') || getCookie(req.headers.cookie, SESSION_COOKIE) || '';
}

function parsePayload(req) {
  if (req.body?.payload) {
    try {
      return JSON.parse(req.body.payload);
    } catch {
      const error = new Error('反馈数据格式错误');
      error.code = 'INVALID_PAYLOAD';
      error.status = 400;
      throw error;
    }
  }
  return req.body || {};
}

function sendUploadError(res, err) {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, error: { code: 'FILE_TOO_LARGE', message: '图片过大，单张最大 8MB' } });
  }
  if (err?.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({ success: false, error: { code: 'TOO_MANY_FILES', message: '最多上传 2 张图片' } });
  }
  if (err?.code === 'UNSUPPORTED_MIME') {
    return res.status(400).json({ success: false, error: { code: 'UNSUPPORTED_MIME', message: '仅支持 JPEG、PNG、HEIC 图片' } });
  }
  return null;
}

function handleFeedbackUpload(req, res, next) {
  upload.array('photos', 2)(req, res, (err) => {
    if (!err) return next();
    if (sendUploadError(res, err)) return;
    next(err);
  });
}

function createRouter(options = {}) {
  const router = express.Router();
  const userService = options.userService || new UserService(options.userServiceOptions);

  router.post('/', handleFeedbackUpload, (req, res) => {
    try {
      const payload = parsePayload(req);
      const user = userService.verifyToken(extractToken(req));
      if (payload.source === 'home' && !user) {
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '请先登录后再反馈' } });
      }
      const record = feedbackService.createFeedback(payload, req.files || [], {
        user,
        userAgent: req.get('user-agent') || ''
      });
      res.status(201).json({ success: true, feedback: { id: record.id, createdAt: record.createdAt } });
    } catch (error) {
      res.status(error.status || 500).json({
        success: false,
        error: {
          code: error.code || 'FEEDBACK_CREATE_FAILED',
          message: error.message || '反馈提交失败'
        }
      });
    }
  });

  return router;
}

module.exports = createRouter();
module.exports.createRouter = createRouter;
module.exports._test = { extractToken, parsePayload };
