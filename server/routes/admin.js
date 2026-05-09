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
const basicAuth = require('basic-auth');
const exifr = require('exifr');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const photoService = require('../services/PhotoService');

const execAsync = util.promisify(exec);

const router = express.Router();

// ---------------------------------------------------------------------------
// 配置
// ---------------------------------------------------------------------------
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'xiake2024';
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/heic'];

// Memory storage（上传到内存，由 PhotoService 处理写入）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      const err = new Error(`不支持的文件类型: ${file.mimetype}`);
      err.code = 'UNSUPPORTED_MIME';
      return cb(err, false);
    }
    cb(null, true);
  },
});

// ---------------------------------------------------------------------------
// Basic Auth 中间件
// ---------------------------------------------------------------------------
function requireAuth(req, res, next) {
  const credentials = basicAuth(req);

  if (!credentials || credentials.pass !== ADMIN_PASSWORD) {
    res.set('WWW-Authenticate', 'Basic realm="Xiake Photo Admin"');
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: '认证失败'
      }
    });
  }

  next();
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
router.post('/upload', requireAuth, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: {
          code: 'NO_FILE',
          message: '未上传文件'
        }
      });
    }

    // 尝试从 EXIF 解析 GPS
    let lat = null, lon = null;
    try {
      const exif = await exifr.parse(req.file.buffer);
      if (exif && typeof exif.latitude === 'number' && typeof exif.longitude === 'number') {
        lat = exif.latitude;
        lon = exif.longitude;
      }
    } catch (exifErr) {
      console.warn('[AdminRoutes] EXIF 解析失败:', exifErr.message);
    }

    // 如果 EXIF 无 GPS，尝试从请求体获取
    if (lat === null && typeof req.body.lat === 'string') {
      lat = parseFloat(req.body.lat);
    }
    if (lon === null && typeof req.body.lon === 'string') {
      lon = parseFloat(req.body.lon);
    }

    const photo = await photoService.savePhoto({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      filename: req.file.originalname,
      lat,
      lon,
      desc: req.body.description || '',
      clientIp: getClientIp(req),
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
router.get('/admin/quota', (req, res) => {
  res.json(quota.getStats());
});

// 访问统计
const accessLogService = require('../services/AccessLogService');
router.get('/admin/access-stats', requireAuth, (req, res) => {
  res.json(accessLogService.getStats());
});

module.exports = router;
