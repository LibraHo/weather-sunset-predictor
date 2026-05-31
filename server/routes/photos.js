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
const exifr = require('exifr');
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

function isApprovedPhoto(photo = {}) {
  return photoService.normalizeReviewStatus(photo.reviewStatus) === 'approved';
}

function isPhotoOwner(photo = {}, user = {}) {
  return String(photo.uploaderUserId || '') === String(user.userId || '');
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

function sanitizeBasePhoto(photo = {}) {
  const {
    uploadIpHash,
    uploadDay,
    uploaderUserId,
    userId,
    ownerUserId,
    owner,
    identity,
    identities,
    openid,
    unionid,
    ...publicPhoto
  } = photo;
  return publicPhoto;
}

function sanitizePublicPhoto(photo = {}) {
  const {
    reviewNote,
    reviewedAt,
    reviewedBy,
    ...publicPhoto
  } = sanitizeBasePhoto(photo);
  return publicPhoto;
}

function sanitizeUserPhoto(photo = {}) {
  return sanitizeBasePhoto(photo);
}

function emitOptionalAnalytics(req, analyticsHook, event) {
  const hook = analyticsHook || req.app?.locals?.analyticsHook;
  if (typeof hook !== 'function') return;
  Promise.resolve().then(() => {
    try {
      Promise.resolve(hook(event)).catch(() => {});
    } catch {
      // Analytics must never block the primary photo flow.
    }
  });
}

function parseOptionalCoordinate(value, min, max) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function hasBodyField(body, key) {
  return Object.prototype.hasOwnProperty.call(body || {}, key);
}

function normalizeOptionalDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function createRouter(options = {}) {
  const router = express.Router();
  const userService = options.userService || new UserService(options.userServiceOptions);
  const requireUser = createAuthMiddleware(userService);
  const analyticsHook = options.analyticsHook;

// ---------------------------------------------------------------------------
// GET /api/photos
// 返回所有照片的元数据（不含原图，含缩略图 URL）
// ---------------------------------------------------------------------------
router.get('/', (req, res) => {
  try {
    const photos = photoService.getPublicPhotos();

    // 为每张照片生成缩略图 URL；内部限额字段不对外暴露
    const withThumbUrls = photos.map((photo) => ({
      ...sanitizePublicPhoto(photo),
      thumbUrl: photo.thumbFile ? `/api/photos/${photo.id}/thumb` : null
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

    let lat = null, lon = null, takenAt = null;
    try {
      const exif = await exifr.parse(req.file.buffer);
      if (exif && typeof exif.latitude === 'number' && typeof exif.longitude === 'number') {
        lat = exif.latitude;
        lon = exif.longitude;
      }
      const exifTakenAt = exif?.DateTimeOriginal || exif?.CreateDate || exif?.ModifyDate;
      takenAt = normalizeOptionalDate(exifTakenAt);
    } catch (exifErr) {
      console.warn('[PhotosRoutes] EXIF parse failed:', exifErr.message);
    }

    const bodyLat = parseOptionalCoordinate(req.body.lat, -90, 90);
    const bodyLon = parseOptionalCoordinate(req.body.lon, -180, 180);
    if (hasBodyField(req.body, 'lat') || hasBodyField(req.body, 'lon')) {
      lat = Number.isFinite(bodyLat) && Number.isFinite(bodyLon) ? bodyLat : null;
      lon = Number.isFinite(bodyLat) && Number.isFinite(bodyLon) ? bodyLon : null;
    }
    if (hasBodyField(req.body, 'takenAt')) {
      takenAt = normalizeOptionalDate(req.body.takenAt);
    }

    const photo = await photoService.savePhoto({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      filename: req.file.originalname,
      lat,
      lon,
      takenAt,
      locationName: req.body.locationName || '',
      uploaderName: req.body.uploaderName || '',
      uploaderUserId: req.user.userId,
      desc: req.body.desc || req.body.description || '',
      clientIp: getClientIp(req),
      reviewStatus: 'pending',
    });

    emitOptionalAnalytics(req, analyticsHook, {
      eventName: 'photo_upload',
      userId: req.user.userId,
      targetType: 'photo',
      targetId: photo.id,
      status: 'success'
    });

    res.status(201).json({ photo: sanitizeUserPhoto(photo) });
  } catch (err) {
    console.error('[PhotosRoutes] POST /api/photos/upload error:', err);
    if (sendUploadError(res, err)) return;
    res.status(500).json({
      error: { code: 'UPLOAD_FAILED', message: '上传失败' }
    });
  }
});

// ---------------------------------------------------------------------------
// GET /api/photos/mine
// 杩斿洖褰撳墠鐧诲綍鐢ㄦ埛鐨勪笂浼犵収鐗囷紙鍚鏍哥姸鎬侊級
// ---------------------------------------------------------------------------
router.get('/mine', requireUser, (req, res) => {
  try {
    const photos = photoService.getPhotosByUser(req.user.userId).map((photo) => ({
      ...sanitizeUserPhoto(photo),
      thumbUrl: photo.thumbFile ? `/api/photos/${photo.id}/thumb` : null
    }));
    res.json({ photos });
  } catch (err) {
    console.error('[PhotosRoutes] GET /api/photos/mine error:', err);
    res.status(500).json({
      error: { code: 'USER_PHOTOS_FETCH_FAILED', message: '鑾峰彇鎴戠殑鐓х墖澶辫触' }
    });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/photos/mine/:id
// 鐧诲綍鐢ㄦ埛淇敼鑷繁鐨勭収鐗囧厓鏁版嵁锛屼慨鏀瑰悗閲嶆柊杩涘叆寰呭
// ---------------------------------------------------------------------------
router.patch('/mine/:id', requireUser, express.json(), (req, res) => {
  try {
    const updated = photoService.updateUserPhoto(req.params.id, req.user.userId, req.body || {});
    if (!updated) {
      return res.status(404).json({
        error: { code: 'PHOTO_NOT_FOUND', message: '鐓х墖涓嶅瓨鍦ㄦ垨鏃犳潈淇敼' }
      });
    }
    res.json({ photo: sanitizeUserPhoto(updated) });
  } catch (err) {
    console.error('[PhotosRoutes] PATCH /api/photos/mine/:id error:', err);
    res.status(500).json({
      error: { code: 'USER_PHOTO_UPDATE_FAILED', message: '淇濆瓨澶辫触' }
    });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/photos/mine/:id
// 鐧诲綍鐢ㄦ埛鍒犻櫎鑷繁鐨勪笂浼犵収鐗?
// ---------------------------------------------------------------------------
router.delete('/mine/:id', requireUser, (req, res) => {
  try {
    const deleted = photoService.deleteUserPhoto(req.params.id, req.user.userId);
    if (!deleted) {
      return res.status(404).json({
        error: { code: 'PHOTO_NOT_FOUND', message: '鐓х墖涓嶅瓨鍦ㄦ垨鏃犳潈鍒犻櫎' }
      });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[PhotosRoutes] DELETE /api/photos/mine/:id error:', err);
    res.status(500).json({
      error: { code: 'USER_PHOTO_DELETE_FAILED', message: '鍒犻櫎澶辫触' }
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
router.get('/:id/original', requireUser, (req, res) => {
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

    if (!isApprovedPhoto(photo) && !isPhotoOwner(photo, req.user)) {
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
