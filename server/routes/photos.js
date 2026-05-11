/**
 * server/routes/photos.js - 照片 API 路由
 *
 * 提供公开的照片查询接口：
 * - GET /api/photos - 返回照片列表
 * - GET /api/photos/:id/thumb - 返回缩略图
 * - GET /api/photos/:id/original - 返回原图
 */

'use strict';

const express = require('express');
const multer = require('multer');
const photoService = require('../services/PhotoService');
const UserService = require('../services/UserService');

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];
const FALLBACK_UPLOAD_MIMES = ['application/octet-stream'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (![...ALLOWED_MIMES, ...FALLBACK_UPLOAD_MIMES].includes(file.mimetype)) {
      const err = new Error(`Unsupported image type: ${file.mimetype}`);
      err.code = 'UNSUPPORTED_MIME';
      return cb(err, false);
    }
    cb(null, true);
  },
});

function extractToken(req) {
  const auth = req.get('authorization') || '';
  if (/^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, '').trim();
  return req.get('x-session-token') || '';
}

function createAuthMiddleware(userService) {
  return (req, res, next) => {
    const user = userService.verifyToken(extractToken(req));
    if (!user) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: '请先登录' }
      });
    }
    req.user = user;
    next();
  };
}

function sendUploadError(res, err) {
  if (err?.code === 'LIMIT_FILE_SIZE' || err?.message?.startsWith('FILE_TOO_LARGE')) {
    return res.status(400).json({
      error: { code: 'FILE_TOO_LARGE', message: '文件过大，最大支持 20MB' }
    });
  }

  if (err?.code === 'UNSUPPORTED_MIME' || err?.message?.startsWith('UNSUPPORTED_MIME')) {
    return res.status(400).json({
      error: { code: 'UNSUPPORTED_MIME', message: '不支持的文件类型，仅支持 JPEG、PNG、HEIC' }
    });
  }

  if (err?.code === 'DAILY_UPLOAD_LIMIT_EXCEEDED') {
    return res.status(429).json({
      error: {
        code: 'DAILY_UPLOAD_LIMIT_EXCEEDED',
        message: `同一 IP 每天最多上传 ${err.limit || 3} 张照片`,
        limit: err.limit,
        used: err.used,
        uploadDay: err.uploadDay,
      }
    });
  }

  return null;
}

function handlePhotoUpload(req, res, next) {
  upload.single('photo')(req, res, (err) => {
    if (!err) return next();
    if (sendUploadError(res, err)) return;
    next(err);
  });
}

function getClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  const candidate = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  return photoService.normalizeClientIp(
    req.headers['cf-connecting-ip'] ||
    req.headers['x-real-ip'] ||
    candidate ||
    req.ip ||
    req.socket?.remoteAddress ||
    ''
  );
}

function parseOptionalCoordinate(value, min, max) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function createRouter(options = {}) {
  const router = express.Router();
  const userService = options.userService || new UserService(options.userServiceOptions);
  const requireUser = createAuthMiddleware(userService);

// ---------------------------------------------------------------------------
// GET /api/photos
// 返回所有照片的元数据（不含原图，含缩略图 URL）
// ---------------------------------------------------------------------------
router.get('/', (req, res) => {
  try {
    const photos = photoService.getPhotos();

    // 为每张照片生成缩略图 URL；内部限额字段不对外暴露
    const withThumbUrls = photos.map(({ uploadIpHash, uploadDay, ...p }) => ({
      ...p,
      thumbUrl: p.thumbFile ? `/api/photos/${p.id}/thumb` : null
    }));

    res.json({ photos: withThumbUrls });
  } catch (err) {
    console.error('[PhotosRoutes] GET /api/photos error:', err);
    res.status(500).json({
      error: {
        code: 'PHOTOS_FETCH_FAILED',
        message: '获取照片列表失败'
      }
    });
  }
});

// ---------------------------------------------------------------------------
// POST /api/photos/upload
// 小程序照片投稿：微信登录 token 保护，复用 PhotoService 存储与限额。
// ---------------------------------------------------------------------------
router.post('/upload', requireUser, handlePhotoUpload, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: { code: 'PHOTO_REQUIRED', message: '请选择要上传的照片' }
      });
    }

    const lat = parseOptionalCoordinate(req.body.lat, -90, 90);
    const lon = parseOptionalCoordinate(req.body.lon, -180, 180);
    const hasValidCoordinate = Number.isFinite(lat) && Number.isFinite(lon);
    const photo = await photoService.savePhoto({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      filename: req.file.originalname,
      lat: hasValidCoordinate ? lat : null,
      lon: hasValidCoordinate ? lon : null,
      takenAt: req.body.takenAt || '',
      locationName: req.body.locationName || '',
      uploaderName: req.body.uploaderName || '',
      uploaderUserId: req.user.userId,
      desc: req.body.desc || req.body.description || '',
      clientIp: getClientIp(req),
    });

    res.status(201).json({ photo });
  } catch (err) {
    console.error('[PhotosRoutes] POST /api/photos/upload error:', err);
    if (sendUploadError(res, err)) return;
    res.status(500).json({
      error: { code: 'UPLOAD_FAILED', message: '上传失败' }
    });
  }
});

// ---------------------------------------------------------------------------
// GET /api/photos/:id/thumb
// 返回指定照片的缩略图文件
// ---------------------------------------------------------------------------
router.get('/:id/thumb', (req, res) => {
  try {
    const { id } = req.params;
    const photo = photoService.getPhotoById(id);

    if (!photo) {
      return res.status(404).json({
        error: {
          code: 'PHOTO_NOT_FOUND',
          message: '照片不存在'
        }
      });
    }

    if (!photo.thumbFile) {
      return res.status(404).json({
        error: {
          code: 'THUMB_NOT_AVAILABLE',
          message: '缩略图不可用'
        }
      });
    }

    const thumbPath = photoService.getThumbPath(photo.thumbFile);
    res.sendFile(thumbPath);
  } catch (err) {
    console.error('[PhotosRoutes] GET /api/photos/:id/thumb error:', err);
    res.status(500).json({
      error: {
        code: 'THUMB_FETCH_FAILED',
        message: '获取缩略图失败'
      }
    });
  }
});

// ---------------------------------------------------------------------------
// GET /api/photos/:id/original
// 返回指定照片的原图文件
// ---------------------------------------------------------------------------
router.get('/:id/original', (req, res) => {
  try {
    const { id } = req.params;
    const photo = photoService.getPhotoById(id);

    if (!photo) {
      return res.status(404).json({
        error: {
          code: 'PHOTO_NOT_FOUND',
          message: '照片不存在'
        }
      });
    }

    const originalPath = photoService.getOriginalPath(photo.origFile);
    res.sendFile(originalPath);
  } catch (err) {
    console.error('[PhotosRoutes] GET /api/photos/:id/original error:', err);
    res.status(500).json({
      error: {
        code: 'ORIGINAL_FETCH_FAILED',
        message: '获取原图失败'
      }
    });
  }
});

  return router;
}

module.exports = createRouter();
module.exports.createRouter = createRouter;
module.exports._test = { createAuthMiddleware, extractToken, parseOptionalCoordinate };
