/**
 * server/routes/admin.js - 后台管理路由
 *
 * 功能：
 * - GET /admin - 后台管理页面（内嵌 HTML）
 * - POST /admin/upload - 上传照片（Basic Auth 保护）
 * - DELETE /admin/photos/:id - 删除照片（Basic Auth 保护）
 *
 * 认证：HTTP Basic Auth，密码从 process.env.ADMIN_PASSWORD 获取（默认 xiake2024）
 */

'use strict';

const express = require('express');
const multer = require('multer');
const exifr = require('exifr');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const photoService = require('../services/PhotoService');
const { requireAdminAuth, requireAdminRequestIntegrity } = require('../middleware/adminSecurity');

const execAsync = util.promisify(exec);

const router = express.Router();

// ---------------------------------------------------------------------------
// 配置
// ---------------------------------------------------------------------------
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];
const FALLBACK_UPLOAD_MIMES = ['application/octet-stream'];

// Memory storage（上传到内存，由 PhotoService 处理写入）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (req, file, cb) => {
    if (![...ALLOWED_MIMES, ...FALLBACK_UPLOAD_MIMES].includes(file.mimetype)) {
      const err = new Error(`不支持的文件类型: ${file.mimetype}`);
      err.code = 'UNSUPPORTED_MIME';
      return cb(err, false);
    }
    cb(null, true);
  },
});

function sendUploadValidationError(res, err) {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: {
        code: 'FILE_TOO_LARGE',
        message: '文件过大，最大支持 20MB'
      }
    });
  }

  if (err?.code === 'UNSUPPORTED_MIME') {
    return res.status(400).json({
      error: {
        code: 'UNSUPPORTED_MIME',
        message: '不支持的文件类型，仅支持 JPEG、PNG、HEIC'
      }
    });
  }

  return null;
}

function handlePhotoUpload(req, res, next) {
  upload.single('photo')(req, res, (err) => {
    if (!err) return next();
    if (sendUploadValidationError(res, err)) return;
    next(err);
  });
}

// ---------------------------------------------------------------------------
// Basic Auth 中间件
// ---------------------------------------------------------------------------
function requireAuth(req, res, next) {
  return requireAdminAuth(req, res, next);
}

router.use(requireAdminRequestIntegrity);

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

function hasBodyField(body, key) {
  return Object.prototype.hasOwnProperty.call(body || {}, key);
}

function parseOptionalCoordinate(body, key, min, max) {
  if (!hasBodyField(body, key)) return undefined;
  const raw = body[key];
  if (raw === '' || raw === null || raw === undefined) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= min && value <= max ? value : null;
}

function normalizeOptionalDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function withPhotoUrls(photo = {}) {
  return {
    ...photo,
    thumbUrl: photo.thumbFile ? `/api/photos/${photo.id}/thumb` : null,
    originalUrl: photo.origFile ? `/api/photos/${photo.id}/original` : null
  };
}

// ---------------------------------------------------------------------------
// GET /admin - 后台管理页面
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// GET /admin - 后台管理页面
// ---------------------------------------------------------------------------
router.get('/admin', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/admin/index.html'));
});

// ---------------------------------------------------------------------------
// 运维 API
// ---------------------------------------------------------------------------
router.get('/admin/health-detailed', requireAuth, async (req, res) => {
  try {
    const { stdout: diskOut } = await execAsync("df -h / | awk 'NR==2{print $5}'");
    const { stdout: memOut } = await execAsync("free -h | awk 'NR==2{printf \"%s/%s\",$3,$2}'");
    const { stdout: nodeOut } = await execAsync("pgrep -f 'node index.js' || echo ''");
    const { stdout: uptimeOut } = await execAsync("uptime -p || uptime | awk -F',' '{print $1}'");

    res.json({
      disk: diskOut.trim(),
      memory: memOut.trim(),
      nodeRunning: !!nodeOut.trim(),
      uptime: uptimeOut.trim()
    });
  } catch (err) {
    console.error('[AdminRoutes] health-detailed error:', err);
    res.status(500).json({ error: '获取系统健康状态失败' });
  }
});

router.post('/admin/clear-cache', requireAuth, async (req, res) => {
  try {
    const fs = require('fs').promises;
    const cachePath = path.join(process.env.HOME || '/home/ubuntu', '.xiake', 'grid-cache.json');
    await fs.writeFile(cachePath, JSON.stringify({ cache: {}, version: 2, lastClearedAt: new Date().toISOString() }, null, 2));
    res.json({ success: true });
  } catch (err) {
    console.error('[AdminRoutes] clear-cache error:', err);
    res.status(500).json({ error: '清空缓存失败' });
  }
});

router.post('/admin/trigger-refresh', requireAuth, async (req, res) => {
  try {
    const { period = 'sunset' } = req.body;
    const axios = require('axios');
    const base = `http://localhost:${process.env.PORT || 3000}`;
    const result = await axios.post(`${base}/api/heatmap/refresh`, { period }, { timeout: 10000 });
    res.json({ success: true, data: result.data });
  } catch (err) {
    console.error('[AdminRoutes] trigger-refresh error:', err.message);
    res.status(500).json({ error: '触发刷新失败: ' + err.message });
  }
});

router.post('/admin/restart', requireAuth, async (req, res) => {
  try {
    const { stdout } = await execAsync('pm2 restart weather-sunset-predictor-backend || sudo systemctl restart weather-sunset || true');
    res.json({ success: true, output: stdout });
    setTimeout(() => process.exit(0), 1000);
  } catch (err) {
    console.error('[AdminRoutes] restart error:', err);
    setTimeout(() => process.exit(0), 1000);
    res.json({ success: true, note: '已发送重启信号' });
  }
});

// ---------------------------------------------------------------------------
// POST /admin/upload - 上传照片
// ---------------------------------------------------------------------------
router.post('/upload', requireAuth, handlePhotoUpload, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: {
          code: 'NO_FILE',
          message: '未上传文件'
        }
      });
    }

    // 尝试从 EXIF 解析 GPS 与拍摄时间，后台表单可以覆盖或清空。
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
      console.warn('[AdminRoutes] EXIF 解析失败:', exifErr.message);
    }

    const bodyLat = parseOptionalCoordinate(req.body, 'lat', -90, 90);
    const bodyLon = parseOptionalCoordinate(req.body, 'lon', -180, 180);
    if (bodyLat !== undefined || bodyLon !== undefined) {
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
      desc: req.body.description || '',
      clientIp: getClientIp(req),
      reviewStatus: 'approved',
      reviewedBy: 'admin',
    });

    res.status(201).json({
      success: true,
      photo
    });
  } catch (err) {
    console.error('[AdminRoutes] POST /admin/upload error:', err);

    if (err.message && err.message.startsWith('UNSUPPORTED_MIME')) {
      return res.status(400).json({
        error: {
          code: 'UNSUPPORTED_MIME',
          message: '不支持的文件类型，仅支持 JPEG、PNG、HEIC'
        }
      });
    }

    if (err.message && err.message.startsWith('FILE_TOO_LARGE')) {
      return res.status(400).json({
        error: {
          code: 'FILE_TOO_LARGE',
          message: '文件过大，最大支持 20MB'
        }
      });
    }

    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: {
          code: 'FILE_TOO_LARGE',
          message: '文件过大，最大支持 20MB'
        }
      });
    }

    if (err.code === 'UNSUPPORTED_MIME') {
      return res.status(400).json({
        error: {
          code: 'UNSUPPORTED_MIME',
          message: '不支持的文件类型，仅支持 JPEG、PNG、HEIC'
        }
      });
    }

    if (err.code === 'DAILY_UPLOAD_LIMIT_EXCEEDED') {
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

    res.status(500).json({
      error: {
        code: 'UPLOAD_FAILED',
        message: '上传失败'
      }
    });
  }
});

// ---------------------------------------------------------------------------
// PATCH /admin/photos/:id - 更新照片元数据
// ---------------------------------------------------------------------------
router.get('/admin/photos', requireAuth, (req, res) => {
  try {
    res.json({
      success: true,
      photos: photoService.getPhotos().map(withPhotoUrls)
    });
  } catch (err) {
    console.error('[AdminRoutes] GET /admin/photos error:', err);
    res.status(500).json({
      error: {
        code: 'PHOTOS_FETCH_FAILED',
        message: '获取照片列表失败'
      }
    });
  }
});

router.post('/photos/:id/review', requireAuth, express.json(), (req, res) => {
  try {
    const reviewStatus = req.body?.reviewStatus || req.body?.status;
    const reviewNote = req.body?.reviewNote || req.body?.note || '';
    const reviewed = photoService.reviewPhoto(req.params.id, {
      reviewStatus,
      reviewNote,
      reviewedBy: 'admin'
    });

    if (!reviewed) {
      return res.status(404).json({
        error: {
          code: 'PHOTO_NOT_FOUND',
          message: '照片不存在'
        }
      });
    }

    res.json({ success: true, photo: withPhotoUrls(reviewed) });
  } catch (err) {
    if (err?.code === 'INVALID_REVIEW_STATUS') {
      return res.status(400).json({
        error: {
          code: 'INVALID_REVIEW_STATUS',
          message: 'reviewStatus must be approved or rejected'
        }
      });
    }
    console.error('[AdminRoutes] POST /photos/:id/review error:', err);
    res.status(500).json({
      error: {
        code: 'PHOTO_REVIEW_FAILED',
        message: '审核失败'
      }
    });
  }
});

router.patch('/photos/:id', requireAuth, express.json(), (req, res) => {
  try {
    const { id } = req.params;
    const patch = {};
    if (hasBodyField(req.body, 'description')) patch.desc = req.body.description;
    if (hasBodyField(req.body, 'desc')) patch.desc = req.body.desc;
    if (hasBodyField(req.body, 'locationName')) patch.locationName = req.body.locationName;
    if (hasBodyField(req.body, 'uploaderName')) patch.uploaderName = req.body.uploaderName;
    if (hasBodyField(req.body, 'takenAt')) patch.takenAt = req.body.takenAt;
    if (hasBodyField(req.body, 'lat')) patch.lat = req.body.lat;
    if (hasBodyField(req.body, 'lon')) patch.lon = req.body.lon;

    const updated = photoService.updatePhoto(id, patch);

    if (!updated) {
      return res.status(404).json({
        error: {
          code: 'PHOTO_NOT_FOUND',
          message: '照片不存在'
        }
      });
    }

    res.json({ success: true, photo: updated });
  } catch (err) {
    console.error('[AdminRoutes] PATCH /admin/photos/:id error:', err);
    res.status(500).json({
      error: {
        code: 'UPDATE_FAILED',
        message: '保存失败'
      }
    });
  }
});

// ---------------------------------------------------------------------------
// DELETE /admin/photos/:id - 删除照片
// ---------------------------------------------------------------------------
router.delete('/photos/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const deleted = photoService.deletePhoto(id);

    if (!deleted) {
      return res.status(404).json({
        error: {
          code: 'PHOTO_NOT_FOUND',
          message: '照片不存在'
        }
      });
    }

    res.json({
      success: true,
      message: '删除成功'
    });
  } catch (err) {
    console.error('[AdminRoutes] DELETE /admin/photos/:id error:', err);
    res.status(500).json({
      error: {
        code: 'DELETE_FAILED',
        message: '删除失败'
      }
    });
  }
});

// Open-Meteo 配额统计
const quota = require('../services/OpenMeteoQuota');
router.get('/admin/quota', requireAuth, (req, res) => {
  res.json(quota.getStats());
});

// 访问统计
const accessLogService = require('../services/AccessLogService');
const accessGuardService = require('../services/AccessGuardService');
router.get('/admin/access-stats', requireAuth, (req, res) => {
  res.json(accessLogService.getStats());
});

router.get('/admin/visitor-records', requireAuth, (req, res) => {
  res.json(accessLogService.getVisitorRecords({
    date: req.query.date,
    limit: req.query.limit
  }));
});

router.get('/admin/access-guard', requireAuth, (req, res) => {
  res.json(accessGuardService.getStatus());
});

router.post('/admin/access-guard/config', requireAuth, (req, res) => {
  try {
    const config = accessGuardService.updateConfig(req.body || {});
    res.json({ success: true, config });
  } catch (err) {
    res.status(400).json({
      error: {
        code: err.code || 'ACCESS_GUARD_CONFIG_FAILED',
        message: err.message || '保存防护配置失败'
      }
    });
  }
});

router.post('/admin/access-guard/block', requireAuth, (req, res) => {
  try {
    const entry = accessGuardService.manualBlock(req.body?.ip, req.body?.reason || 'manual_block');
    res.json({ success: true, entry });
  } catch (err) {
    res.status(400).json({
      error: {
        code: err.code || 'ACCESS_GUARD_BLOCK_FAILED',
        message: err.message || '封禁失败'
      }
    });
  }
});

router.post('/admin/access-guard/unblock', requireAuth, (req, res) => {
  try {
    const existed = accessGuardService.unblock(req.body?.ip);
    res.json({ success: true, existed });
  } catch (err) {
    res.status(400).json({
      error: {
        code: err.code || 'ACCESS_GUARD_UNBLOCK_FAILED',
        message: err.message || '解封失败'
      }
    });
  }
});

module.exports = router;
