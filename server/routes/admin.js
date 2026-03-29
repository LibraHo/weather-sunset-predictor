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
    .quota-section {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 18px;
      margin-bottom: 20px;
    }
    .quota-section h2 {
      margin-bottom: 12px;
      color: #4ecdc4;
    }
    .quota-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 10px;
    }
    .quota-item {
      background: rgba(0,0,0,0.28);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 8px;
      padding: 10px 12px;
    }
    .quota-k {
      color: #9aa4b2;
      font-size: 0.78rem;
      margin-bottom: 4px;
    }
    .quota-v {
      color: #fff;
      font-size: 1rem;
      font-weight: 600;
    }
    .queue-row {
      margin-top: 10px;
      color: #b8c1cc;
      font-size: 0.84rem;
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

    /* API 调用日志 */
    .tab-bar {
      display: flex;
      gap: 0;
      margin-bottom: 12px;
      border-bottom: 2px solid rgba(255,255,255,0.1);
    }
    .tab-btn {
      padding: 8px 18px;
      background: none;
      border: none;
      color: #9aa4b2;
      font-size: 0.9rem;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
      transition: all 0.2s;
    }
    .tab-btn.active {
      color: #4ecdc4;
      border-bottom-color: #4ecdc4;
    }
    .tab-btn:hover {
      color: #fff;
    }
    .log-table-wrap {
      max-height: 400px;
      overflow-y: auto;
      border-radius: 6px;
    }
    .log-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8rem;
    }
    .log-table th {
      position: sticky;
      top: 0;
      background: #1a1a2e;
      color: #9aa4b2;
      text-align: left;
      padding: 6px 8px;
      border-bottom: 1px solid rgba(255,255,255,0.15);
      white-space: nowrap;
    }
    .log-table td {
      padding: 5px 8px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      color: #ccc;
      white-space: nowrap;
      max-width: 180px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .log-table tr:hover td {
      background: rgba(255,255,255,0.03);
    }
    .status-ok { color: #2ecc71; }
    .status-err { color: #e74c3c; }
    .status-warn { color: #f39c12; }

    /* 定时配置 */
    .schedule-jobs {
      margin-top: 12px;
    }
    .schedule-job-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      background: rgba(0,0,0,0.2);
      border-radius: 6px;
      margin-bottom: 8px;
    }
    .schedule-job-row input[type="time"] {
      padding: 6px 10px;
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 4px;
      background: rgba(0,0,0,0.3);
      color: #fff;
      font-size: 0.9rem;
    }
    .schedule-job-row select {
      padding: 6px 10px;
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 4px;
      background: rgba(0,0,0,0.3);
      color: #fff;
      font-size: 0.9rem;
    }
    .schedule-job-row input[type="text"] {
      width: 120px;
      padding: 6px 10px;
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 4px;
      background: rgba(0,0,0,0.3);
      color: #fff;
      font-size: 0.9rem;
    }
    .btn-sm {
      padding: 6px 14px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.85rem;
      transition: all 0.2s;
    }
    .btn-add { background: #4ecdc4; color: #000; }
    .btn-add:hover { background: #3dbdb5; }
    .btn-del { background: #e74c3c; color: #fff; }
    .btn-del:hover { background: #c0392b; }
    .btn-save {
      width: 100%;
      padding: 10px;
      background: linear-gradient(135deg, #4ecdc4 0%, #44a08d 100%);
      border: none;
      border-radius: 6px;
      color: #fff;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      margin-top: 12px;
      transition: transform 0.2s;
    }
    .btn-save:hover { transform: translateY(-2px); }
    @media (max-width: 768px) {
      .photo-grid {
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      }
      .schedule-job-row { flex-wrap: wrap; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔥 霞客照片管理后台</h1>

    <div id="message" class="message hidden"></div>

    <div class="quota-section">
      <h2>📊 API 配额统计</h2>
      <div class="quota-grid" id="quotaGrid">
        <div class="quota-item"><div class="quota-k">今日调用</div><div class="quota-v" id="q-count">--</div></div>
        <div class="quota-item"><div class="quota-k">每日上限</div><div class="quota-v" id="q-limit">--</div></div>
        <div class="quota-item"><div class="quota-k">剩余配额</div><div class="quota-v" id="q-remaining">--</div></div>
        <div class="quota-item"><div class="quota-k">使用率</div><div class="quota-v" id="q-percent">--</div></div>
        <div class="quota-item"><div class="quota-k">网格接口可用</div><div class="quota-v" id="q-grid">--</div></div>
        <div class="quota-item"><div class="quota-k">天气接口可用</div><div class="quota-v" id="q-weather">--</div></div>
      </div>
    </div>

    <div class="quota-section">
      <h2>🧵 刷新队列状态</h2>
      <div class="quota-grid" id="queueGrid">
        <div class="quota-item"><div class="quota-k">sunset 运行中</div><div class="quota-v" id="qs-running">--</div></div>
        <div class="quota-item"><div class="quota-k">sunset 批次</div><div class="quota-v" id="qs-batch">--</div></div>
        <div class="quota-item"><div class="quota-k">sunset 进度</div><div class="quota-v" id="qs-progress">--</div></div>
        <div class="quota-item"><div class="quota-k">sunrise 运行中</div><div class="quota-v" id="qr-running">--</div></div>
        <div class="quota-item"><div class="quota-k">sunrise 批次</div><div class="quota-v" id="qr-batch">--</div></div>
        <div class="quota-item"><div class="quota-k">sunrise 进度</div><div class="quota-v" id="qr-progress">--</div></div>
      </div>
      <div class="queue-row" id="queueMeta">上次刷新：--</div>
    </div>

    <div class="quota-section">
      <h2>📊 调用统计</h2>
      <div class="quota-grid">
        <div class="quota-item"><div class="quota-k">今日 Grid 调用</div><div class="quota-v" id="st-grid-day">--</div></div>
        <div class="quota-item"><div class="quota-k">今日 Weather 调用</div><div class="quota-v" id="st-weather-day">--</div></div>
        <div class="quota-item"><div class="quota-k">今日高德调用</div><div class="quota-v" id="st-gaode-day">--</div></div>
        <div class="quota-item"><div class="quota-k">最近1小时请求</div><div class="quota-v" id="st-last-hour">--</div></div>
        <div class="quota-item"><div class="quota-k">Grid 平均耗时</div><div class="quota-v" id="st-grid-avg">--</div></div>
        <div class="quota-item"><div class="quota-k">Grid 错误(1h)</div><div class="quota-v" id="st-grid-err">--</div></div>
      </div>
    </div>

    <div class="quota-section">
      <h2>📋 API 调用日志</h2>
      <div class="tab-bar">
        <button class="tab-btn active" onclick="switchLogTab('grid')">火烧云网格</button>
        <button class="tab-btn" onclick="switchLogTab('weather,gaode,gaode_tile')">天气查询 & 高德</button>
      </div>
      <div class="log-table-wrap">
        <table class="log-table">
          <thead><tr><th>时间</th><th>接口</th><th>参数</th><th>状态</th><th>耗时(ms)</th><th>错误</th></tr></thead>
          <tbody id="logTableBody"><tr><td colspan="6" style="text-align:center;color:#888">加载中...</td></tr></tbody>
        </table>
      </div>
    </div>

    <div class="quota-section">
      <h2>⏰ 定时更新配置</h2>
      <div id="scheduleJobs" class="schedule-jobs"></div>
      <button class="btn-sm btn-add" onclick="addScheduleJob()">+ 添加时间点</button>
      <button class="btn-save" onclick="saveSchedule()">保存配置</button>
      <div id="scheduleMsg" class="message hidden" style="margin-top:10px"></div>
    </div>

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

    async function loadQuota() {
      try {
        const res = await fetch('/admin/quota');
        const q = await res.json();
        document.getElementById('q-count').textContent = q.count ?? '--';
        document.getElementById('q-limit').textContent = q.limit ?? '--';
        document.getElementById('q-remaining').textContent = q.remaining ?? '--';
        document.getElementById('q-percent').textContent = (q.usagePercent != null ? q.usagePercent + '%' : '--');
        document.getElementById('q-grid').textContent = q.gridAllowed ? '✅ 可用' : '❌ 受限';
        document.getElementById('q-weather').textContent = q.weatherAllowed ? '✅ 可用' : '❌ 受限';
      } catch (err) {
        console.error('加载配额失败:', err);
      }
    }

    async function loadQueue() {
      try {
        const [sunsetRes, sunriseRes] = await Promise.all([
          fetch('/api/heatmap/status?period=sunset'),
          fetch('/api/heatmap/status?period=sunrise')
        ]);
        const sunset = await sunsetRes.json();
        const sunrise = await sunriseRes.json();

        const fmtPct = (x, y) => {
          if (!y) return '--';
          return ((x / y) * 100).toFixed(1) + '%';
        };

        document.getElementById('qs-running').textContent = sunset.running ? '🟢 运行中' : '⚪ 空闲';
        document.getElementById('qs-batch').textContent = (sunset.completedBatches || 0) + '/' + (sunset.totalBatches || 0);
        document.getElementById('qs-progress').textContent = (sunset.completedPoints || 0) + '/' + (sunset.totalPoints || 0) + ' (' + fmtPct(sunset.completedPoints || 0, sunset.totalPoints || 0) + ')';

        document.getElementById('qr-running').textContent = sunrise.running ? '🟢 运行中' : '⚪ 空闲';
        document.getElementById('qr-batch').textContent = (sunrise.completedBatches || 0) + '/' + (sunrise.totalBatches || 0);
        document.getElementById('qr-progress').textContent = (sunrise.completedPoints || 0) + '/' + (sunrise.totalPoints || 0) + ' (' + fmtPct(sunrise.completedPoints || 0, sunrise.totalPoints || 0) + ')';

        var ts = [sunset.updatedAt, sunrise.updatedAt].filter(Boolean).sort().pop();
        document.getElementById('queueMeta').textContent = '上次刷新：' + (ts ? new Date(ts).toLocaleString('zh-CN') : '--');
      } catch (err) {
        console.error('加载队列失败:', err);
      }
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
    loadQuota();
    loadQueue();
    loadPhotos();
    loadLogSummary();
    loadLogs();
    loadSchedule();
    setInterval(loadQuota, 30000);
    setInterval(loadQueue, 15000);
    setInterval(() => { loadLogs(); loadLogSummary(); }, 15000);

    // ---- API 调用日志 ----
    let currentLogTab = 'grid';

    function switchLogTab(type) {
      currentLogTab = type;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      event.target.classList.add('active');
      loadLogs();
    }

    async function loadLogs() {
      try {
        const res = await fetch('/api/admin/logs?type=' + encodeURIComponent(currentLogTab) + '&limit=50', { credentials: 'include' });
        const data = await res.json();
        const tbody = document.getElementById('logTableBody');
        if (!data.logs || data.logs.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#888">暂无日志</td></tr>';
          return;
        }
        tbody.innerHTML = data.logs.map(l => {
          const time = new Date(l.time).toLocaleString('zh-CN');
          const statusClass = l.status >= 200 && l.status < 400 ? 'status-ok' : (l.status >= 400 ? 'status-err' : 'status-warn');
          const params = l.params ? Object.entries(l.params).map(([k,v]) => k + '=' + v).join(', ') : '-';
          return '<tr>' +
            '<td>' + time + '</td>' +
            '<td>' + (l.endpoint || '-') + '</td>' +
            '<td title="' + (params || '').replace(/"/g, '&quot;') + '">' + (params || '-') + '</td>' +
            '<td class="' + statusClass + '">' + l.status + '</td>' +
            '<td>' + l.durationMs + '</td>' +
            '<td class="status-err">' + (l.error || '-') + '</td>' +
            '</tr>';
        }).join('');
      } catch (err) {
        console.error('加载日志失败:', err);
      }
    }

    async function loadLogSummary() {
      try {
        const res = await fetch('/api/admin/logs/summary', { credentials: 'include' });
        const data = await res.json();
        if (!data.summary) return;
        const s = data.summary;
        document.getElementById('st-grid-day').textContent = s.grid?.lastDay ?? '--';
        document.getElementById('st-weather-day').textContent = s.weather?.lastDay ?? '--';
        document.getElementById('st-gaode-day').textContent = (s.gaode?.lastDay ?? 0) + (s.gaodeTile?.lastDay ?? 0);
        document.getElementById('st-last-hour').textContent = s.lastHourTotal ?? '--';
        document.getElementById('st-grid-avg').textContent = s.grid?.avgDurationLastHour != null ? s.grid.avgDurationLastHour + 'ms' : '--';
        document.getElementById('st-grid-err').textContent = s.grid?.errorsLastHour ?? '--';
      } catch (err) {
        console.error('加载统计失败:', err);
      }
    }

    // ---- 定时更新配置 ----
    let scheduleJobs = [];

    async function loadSchedule() {
      try {
        const res = await fetch('/api/admin/schedule', { credentials: 'include' });
        const data = await res.json();
        scheduleJobs = data.config?.jobs || [
          { time: '10:00', type: 'both', label: '上午刷新' },
          { time: '22:00', type: 'both', label: '晚间刷新' }
        ];
        renderScheduleJobs();
      } catch (err) {
        console.error('加载定时配置失败:', err);
        scheduleJobs = [
          { time: '10:00', type: 'both', label: '上午刷新' },
          { time: '22:00', type: 'both', label: '晚间刷新' }
        ];
        renderScheduleJobs();
      }
    }

    function renderScheduleJobs() {
      const container = document.getElementById('scheduleJobs');
      container.innerHTML = scheduleJobs.map((job, i) => {
        return '<div class="schedule-job-row">' +
          '<input type="time" value="' + job.time + '" onchange="scheduleJobs[' + i + '].time=this.value">' +
          '<select onchange="scheduleJobs[' + i + '].type=this.value">' +
            '<option value="both"' + (job.type === 'both' ? ' selected' : '') + '>朝霞+晚霞</option>' +
            '<option value="sunrise"' + (job.type === 'sunrise' ? ' selected' : '') + '>仅朝霞</option>' +
            '<option value="sunset"' + (job.type === 'sunset' ? ' selected' : '') + '>仅晚霞</option>' +
          '</select>' +
          '<input type="text" value="' + (job.label || '') + '" placeholder="备注" onchange="scheduleJobs[' + i + '].label=this.value">' +
          '<button class="btn-sm btn-del" onclick="removeScheduleJob(' + i + ')">删除</button>' +
          '</div>';
      }).join('');
    }

    function addScheduleJob() {
      scheduleJobs.push({ time: '12:00', type: 'both', label: '' });
      renderScheduleJobs();
    }

    function removeScheduleJob(i) {
      scheduleJobs.splice(i, 1);
      renderScheduleJobs();
    }

    async function saveSchedule() {
      const msgEl = document.getElementById('scheduleMsg');
      try {
        const res = await fetch('/api/admin/schedule', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: true, jobs: scheduleJobs })
        });
        const data = await res.json();
        if (data.success) {
          msgEl.textContent = '✅ 配置已保存';
          msgEl.className = 'message success';
        } else {
          msgEl.textContent = '❌ 保存失败: ' + (data.error?.message || '未知错误');
          msgEl.className = 'message error';
        }
      } catch (err) {
        msgEl.textContent = '❌ 保存失败: ' + err.message;
        msgEl.className = 'message error';
      }
      msgEl.classList.remove('hidden');
      setTimeout(() => msgEl.classList.add('hidden'), 5000);
    }
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

// Open-Meteo 配额统计
const quota = require('../services/OpenMeteoQuota');
router.get('/admin/quota', (req, res) => {
  res.json(quota.getStats());
});

module.exports = router;
