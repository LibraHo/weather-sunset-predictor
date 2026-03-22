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
const photoService = require('../services/PhotoService');

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

// ---------------------------------------------------------------------------
// GET /admin - 后台管理页面
// ---------------------------------------------------------------------------
router.get('/admin', requireAuth, (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>霞客照片管理后台</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #eee;
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    h1 {
      text-align: center;
      margin-bottom: 30px;
      color: #ff6b35;
      font-size: 2rem;
    }
    .upload-section {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 30px;
    }
    .upload-section h2 {
      margin-bottom: 16px;
      color: #4ecdc4;
    }
    .form-group {
      margin-bottom: 16px;
    }
    label {
      display: block;
      margin-bottom: 6px;
      color: #aaa;
      font-size: 0.9rem;
    }
    input[type="text"],
    input[type="number"],
    textarea {
      width: 100%;
      padding: 10px;
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 6px;
      background: rgba(0,0,0,0.3);
      color: #fff;
      font-size: 1rem;
    }
    textarea {
      min-height: 80px;
      resize: vertical;
    }
    .file-input-wrapper {
      position: relative;
      border: 2px dashed rgba(255,255,255,0.3);
      border-radius: 8px;
      padding: 30px;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s;
    }
    .file-input-wrapper:hover {
      border-color: #ff6b35;
      background: rgba(255,107,53,0.05);
    }
    .file-input-wrapper input[type="file"] {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      opacity: 0;
      cursor: pointer;
    }
    .file-input-text {
      color: #aaa;
      pointer-events: none;
    }
    button.btn-upload {
      width: 100%;
      padding: 12px;
      background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
      border: none;
      border-radius: 6px;
      color: #fff;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s;
    }
    button.btn-upload:hover {
      transform: translateY(-2px);
    }
    button.btn-upload:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
    .photos-section {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 24px;
    }
    .photos-section h2 {
      margin-bottom: 16px;
      color: #4ecdc4;
    }
    .photo-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
    }
    .photo-card {
      background: rgba(0,0,0,0.3);
      border-radius: 8px;
      overflow: hidden;
      position: relative;
    }
    .photo-thumb {
      width: 100%;
      height: 200px;
      object-fit: cover;
    }
    .photo-info {
      padding: 12px;
    }
    .photo-desc {
      font-size: 0.85rem;
      color: #ccc;
      margin-bottom: 8px;
      max-height: 40px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .photo-meta {
      font-size: 0.75rem;
      color: #888;
      margin-bottom: 8px;
    }
    .btn-delete {
      width: 100%;
      padding: 8px;
      background: #e74c3c;
      border: none;
      border-radius: 4px;
      color: #fff;
      font-size: 0.85rem;
      cursor: pointer;
    }
    .btn-delete:hover {
      background: #c0392b;
    }
    .message {
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 16px;
      text-align: center;
    }
    .message.success {
      background: rgba(46, 204, 113, 0.2);
      color: #2ecc71;
    }
    .message.error {
      background: rgba(231, 76, 60, 0.2);
      color: #e74c3c;
    }
    .hidden { display: none; }
    @media (max-width: 768px) {
      .photo-grid {
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔥 霞客照片管理后台</h1>

    <div id="message" class="message hidden"></div>

    <div class="upload-section">
      <h2>📤 上传新照片</h2>
      <form id="uploadForm">
        <div class="form-group">
          <div class="file-input-wrapper">
            <input type="file" id="photoFile" accept="image/jpeg,image/png,image/heic" required>
            <div class="file-input-text">
              <span>点击或拖拽照片到此处</span><br>
              <small>支持 JPEG、PNG、HEIC（最大 20MB）</small>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label>描述</label>
          <textarea id="description" placeholder="描述这张照片..."></textarea>
        </div>
        <div class="form-group">
          <label>位置（若 EXIF 无 GPS 信息，可手动填写）</label>
          <div style="display: flex; gap: 10px;">
            <input type="number" id="lat" placeholder="纬度" step="any">
            <input type="number" id="lon" placeholder="经度" step="any">
          </div>
        </div>
        <button type="submit" class="btn-upload" id="uploadBtn">上传照片</button>
      </form>
    </div>

    <div class="photos-section">
      <h2>📷 已上传照片</h2>
      <div id="photoGrid" class="photo-grid">
        <p style="grid-column: 1/-1; text-align: center; color: #888;">加载中...</p>
      </div>
    </div>
  </div>

  <script>
    let photos = [];

    function showMessage(msg, type = 'success') {
      const el = document.getElementById('message');
      el.textContent = msg;
      el.className = 'message ' + type;
      el.classList.remove('hidden');
      setTimeout(() => el.classList.add('hidden'), 5000);
    }

    async function loadPhotos() {
      try {
        const res = await fetch('/api/photos');
        const data = await res.json();
        photos = data.photos || [];
        renderPhotos();
      } catch (err) {
        console.error('加载照片失败:', err);
        showMessage('加载照片失败', 'error');
      }
    }

    function renderPhotos() {
      const grid = document.getElementById('photoGrid');
      if (photos.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #888;">暂无照片</p>';
        return;
      }

      grid.innerHTML = photos.map(p => \`
        <div class="photo-card" data-id="\${p.id}">
          <img class="photo-thumb" src="\${p.thumbUrl}" alt="\${p.filename}">
          <div class="photo-info">
            <div class="photo-desc">\${p.desc || '无描述'}</div>
            <div class="photo-meta">
              \${p.lat && p.lon ? \`📍 \${p.lat.toFixed(4)}, \${p.lon.toFixed(4)}\` : '📍 无位置'}
              <br>
              \${p.uploadedAt ? new Date(p.uploadedAt).toLocaleString('zh-CN') : ''}
            </div>
            <button class="btn-delete" onclick="deletePhoto('\${p.id}')">删除</button>
          </div>
        </div>
      \`).join('');
    }

    async function deletePhoto(id) {
      if (!confirm('确定要删除这张照片吗？')) return;

      try {
        const res = await fetch(\`/admin/photos/\${id}\`, {
          method: 'DELETE',
          credentials: 'include'
        });

        if (res.ok) {
          showMessage('删除成功');
          await loadPhotos();
        } else {
          const data = await res.json();
          showMessage('删除失败: ' + (data.error?.message || '未知错误'), 'error');
        }
      } catch (err) {
        console.error('删除失败:', err);
        showMessage('删除失败', 'error');
      }
    }

    document.getElementById('uploadForm').addEventListener('submit', async (e) => {
      e.preventDefault();

      const fileInput = document.getElementById('photoFile');
      const description = document.getElementById('description').value;
      const lat = parseFloat(document.getElementById('lat').value);
      const lon = parseFloat(document.getElementById('lon').value);

      if (!fileInput.files[0]) {
        showMessage('请选择照片', 'error');
        return;
      }

      const formData = new FormData();
      formData.append('photo', fileInput.files[0]);
      if (description) formData.append('description', description);
      if (!isNaN(lat)) formData.append('lat', lat);
      if (!isNaN(lon)) formData.append('lon', lon);

      const btn = document.getElementById('uploadBtn');
      btn.disabled = true;
      btn.textContent = '上传中...';

      try {
        const res = await fetch('/admin/upload', {
          method: 'POST',
          credentials: 'include',
          body: formData
        });

        const data = await res.json();

        if (res.ok) {
          showMessage('上传成功！');
          document.getElementById('uploadForm').reset();
          await loadPhotos();
        } else {
          showMessage('上传失败: ' + (data.error?.message || '未知错误'), 'error');
        }
      } catch (err) {
        console.error('上传失败:', err);
        showMessage('上传失败', 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = '上传照片';
      }
    });

    // 初始加载
    loadPhotos();
  </script>
</body>
</html>
  `;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
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

module.exports = router;
