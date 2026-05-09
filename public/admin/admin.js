/**
 * 霞客管理后台 JS
 */

// 图表实例
let accessTrendChart = null;
let apiHourlyChart = null;

// 当前日志Tab
let currentLogTab = 'grid';
let activeAdminView = 'dashboard';
let refreshTimer = null;
let slowRefreshTimer = null;

const ADMIN_VIEWS = new Set(['dashboard', 'ops', 'logs', 'schedule', 'agent', 'photos']);

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initAdminNavigation();
  initUploadForm();
  initTokenForm();
  initTokenEditForm();
  loadActiveView();

  refreshTimer = setInterval(refreshActiveView, 15000);
  slowRefreshTimer = setInterval(() => {
    if (activeAdminView === 'logs') loadDailyStats();
  }, 60000);
});

function initTheme() {
  const toggle = document.getElementById('theme-toggle');
  const saved = localStorage.getItem('admin-theme') || 'theme-dark';
  document.body.className = `admin-body ${saved}`;

  toggle.addEventListener('click', () => {
    const isDark = document.body.classList.contains('theme-dark');
    const next = isDark ? 'theme-light' : 'theme-dark';
    document.body.className = `admin-body ${next}`;
    localStorage.setItem('admin-theme', next);
    // 重绘图表以适配新主题
    loadAccessStats();
    loadLogSummary();
  });
}

async function loadAll() {
  await Promise.all([
    loadAccessStats(),
    loadLogSummary(),
    loadLogs(),
    loadQueue(),
    loadDailyStats(),
    loadSchedule(),
    loadTokens(),
    loadApplications(),
    loadAuditLogs(),
    loadAgentUsageStats(),
    loadPhotos(),
    loadHealth(),
    loadShareStats()
  ]);
}

function initAdminNavigation() {
  const btn = document.getElementById('home-view-menu-btn');
  const dropdown = document.getElementById('home-view-menu-dropdown');
  const options = Array.from(document.querySelectorAll('.admin-view-option[data-view], .admin-entry-card[data-view]'));

  const getViewFromHash = () => {
    const view = window.location.hash.replace(/^#/, '') || 'dashboard';
    return ADMIN_VIEWS.has(view) ? view : 'dashboard';
  };

  const closeMenu = () => {
    if (!dropdown || !btn) return;
    dropdown.classList.add('hidden');
    btn.setAttribute('aria-expanded', 'false');
  };

  const openMenu = () => {
    if (!dropdown || !btn) return;
    dropdown.classList.remove('hidden');
    btn.setAttribute('aria-expanded', 'true');
  };

  window.setAdminView = (view) => {
    activeAdminView = ADMIN_VIEWS.has(view) ? view : 'dashboard';
    document.querySelectorAll('[data-admin-panel]').forEach((panel) => {
      const show = panel.dataset.adminPanel === activeAdminView;
      panel.classList.toggle('hidden', !show);
      panel.hidden = !show;
    });
    options.forEach((option) => {
      const active = option.dataset.view === activeAdminView;
      option.classList.toggle('active', active);
      option.setAttribute('aria-checked', String(active));
      option.setAttribute('aria-pressed', String(active));
    });
    if (window.location.hash.replace(/^#/, '') !== activeAdminView) {
      history.replaceState(null, '', `#${activeAdminView}`);
    }
    loadActiveView();
  };

  if (btn && dropdown) {
    btn.addEventListener('click', () => {
      dropdown.classList.contains('hidden') ? openMenu() : closeMenu();
    });
    document.addEventListener('click', (event) => {
      if (!dropdown.contains(event.target) && !btn.contains(event.target)) closeMenu();
    });
  }

  options.forEach((option) => {
    option.addEventListener('click', () => {
      window.setAdminView(option.dataset.view);
      closeMenu();
    });
  });

  window.addEventListener('hashchange', () => window.setAdminView(getViewFromHash()));
  window.setAdminView(getViewFromHash());
}

async function loadActiveView() {
  switch (activeAdminView) {
    case 'dashboard':
      await Promise.all([loadAccessStats(), loadLogSummary(), loadHealth(), loadShareStats()]);
      break;
    case 'ops':
      await Promise.all([loadQueue(), loadHealth()]);
      break;
    case 'logs':
      await Promise.all([loadLogSummary(), loadLogs(), loadDailyStats()]);
      break;
    case 'schedule':
      await loadSchedule();
      break;
    case 'agent':
      await Promise.all([loadTokens(), loadApplications(), loadAgentUsageStats(), loadAuditLogs()]);
      break;
    case 'photos':
      await loadPhotos();
      break;
    default:
      break;
  }
}

function refreshActiveView() {
  if (activeAdminView === 'dashboard') {
    Promise.all([loadAccessStats(), loadLogSummary(), loadHealth(), loadShareStats()]);
  } else if (activeAdminView === 'ops') {
    Promise.all([loadQueue(), loadHealth()]);
  } else if (activeAdminView === 'logs') {
    Promise.all([loadLogSummary(), loadLogs()]);
  }
}

function formatStatus(v) {
  return v ? '<span class="status-ok">启用</span>' : '<span class="status-err">禁用</span>';
}

function showMessage(msg, type = 'success', targetId = 'message') {
  const el = document.getElementById(targetId);
  if (!el) return;
  el.textContent = msg;
  el.className = 'admin-message ' + type;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 5000);
}

// =================== 访问统计 & 图表 ===================
async function loadAccessStats() {
  try {
    const res = await fetch('/admin/access-stats', { credentials: 'include' });
    const data = await res.json();

    document.getElementById('kpi-today-pv').textContent = data.today?.pv ?? '--';
    document.getElementById('kpi-today-uv').textContent = data.today?.uv ?? '--';
    document.getElementById('kpi-today-ip').textContent = data.today?.ips ?? '--';

    // IP 表格
    const ipBody = document.getElementById('ipStatsBody');
    if (data.topIps?.length) {
      ipBody.innerHTML = data.topIps.map(item =>
        `<tr><td>${escapeHtml(item.ip)}</td><td>${item.count}</td></tr>`
      ).join('');
    } else {
      ipBody.innerHTML = '<tr><td colspan="2" class="empty">暂无数据</td></tr>';
    }

    // 7天趋势图
    renderAccessTrendChart(data.dailyTrend || []);
  } catch (err) {
    console.error('加载访问统计失败:', err);
  }
}

function renderAccessTrendChart(dailyTrend) {
  const ctx = document.getElementById('accessTrendChart');
  if (!ctx) return;

  const labels = dailyTrend.map(d => d.day.slice(5)); // MM-DD
  const pvData = dailyTrend.map(d => d.pv);
  const uvData = dailyTrend.map(d => d.uv);

  const isDark = document.body.classList.contains('theme-dark');
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const textColor = isDark ? '#ccc' : '#333';

  if (accessTrendChart) accessTrendChart.destroy();

  accessTrendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'PV', data: pvData, borderColor: '#ff9800', backgroundColor: 'rgba(255,152,0,0.1)', tension: 0.3, fill: true },
        { label: 'UV', data: uvData, borderColor: '#4a90e2', backgroundColor: 'rgba(74,144,226,0.1)', tension: 0.3, fill: true }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: textColor } } },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: textColor } },
        y: { grid: { color: gridColor }, ticks: { color: textColor }, beginAtZero: true }
      }
    }
  });
}

// =================== 分享统计 ===================
async function loadShareStats() {
  try {
    const res = await fetch('/api/admin/share/summary?days=7', { credentials: 'include' });
    const data = await res.json();
    document.getElementById('kpi-share-today').textContent = data.today?.total ?? '--';
    document.getElementById('kpi-share-total').textContent = `累计 ${data.total?.total ?? '--'}`;
  } catch (err) {
    console.error('加载分享统计失败:', err);
  }
}

// =================== 系统健康 ===================
async function loadHealth() {
  try {
    const res = await fetch('/admin/health-detailed', { credentials: 'include' });
    const data = await res.json();

    document.getElementById('health-disk').textContent = data.disk || '--';
    document.getElementById('health-mem').textContent = data.memory || '--';
    document.getElementById('health-node').textContent = data.nodeRunning ? '✅ 运行中' : '❌ 未运行';
    document.getElementById('health-uptime').textContent = data.uptime || '--';
  } catch (err) {
    console.error('加载系统健康失败:', err);
  }
}

// =================== 运维工具箱 ===================
async function clearGridCache() {
  if (!confirm('确定清空 Grid 缓存吗？')) return;
  try {
    const res = await fetch('/admin/clear-cache', { method: 'POST', credentials: 'include' });
    const data = await res.json();
    showMessage(data.success ? '缓存已清空' : '清空失败', data.success ? 'success' : 'error');
  } catch (err) {
    showMessage('请求失败: ' + err.message, 'error');
  }
}

async function triggerRefresh(period) {
  if (!confirm(`确定手动刷新 ${period === 'sunset' ? '晚霞' : '朝霞'} 数据吗？`)) return;
  try {
    const res = await fetch('/admin/trigger-refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period })
    });
    const data = await res.json();
    showMessage(data.success ? '刷新任务已触发' : '触发失败', data.success ? 'success' : 'error');
  } catch (err) {
    showMessage('请求失败: ' + err.message, 'error');
  }
}

async function restartBackend() {
  if (!confirm('确定重启后端进程吗？服务会短暂中断。')) return;
  try {
    const res = await fetch('/admin/restart', { method: 'POST', credentials: 'include' });
    const data = await res.json();
    showMessage(data.success ? '重启指令已发送，请稍候刷新页面' : '重启失败', data.success ? 'success' : 'error');
  } catch (err) {
    showMessage('请求失败: ' + err.message, 'error');
  }
}

// =================== API 日志 & KPI ===================
async function loadLogSummary() {
  try {
    const res = await fetch('/api/admin/logs/summary', { credentials: 'include' });
    const data = await res.json();
    if (!data.summary) return;
    const s = data.summary;
    const today = data.today || {};
    const tc = today.calls || {};

    document.getElementById('kpi-weather-day').textContent = tc.weather?.total ?? s.weather?.lastDay ?? '--';
    document.getElementById('kpi-grid-day').textContent = tc.grid?.total ?? s.grid?.lastDay ?? '--';

    // 错误率
    const gridErr = s.grid?.errorsLastHour ?? 0;
    const gridTotal = s.grid?.lastHour ?? 1;
    const errRate = gridTotal > 0 ? ((gridErr / gridTotal) * 100).toFixed(1) + '%' : '0%';
    document.getElementById('kpi-error-rate').textContent = errRate;
    document.getElementById('kpi-error-card').classList.toggle('kpi-card-alert', parseFloat(errRate) > 5);

    // 24h API 分布图
    renderApiHourlyChart(s.hourlyBreakdown || generateMockHourly());
  } catch (err) {
    console.error('加载日志摘要失败:', err);
  }
}

function generateMockHourly() {
  const arr = [];
  for (let i = 0; i < 24; i++) arr.push({ hour: String(i).padStart(2, '0') + ':00', grid: 0, weather: 0 });
  return arr;
}

function renderApiHourlyChart(hourly) {
  const ctx = document.getElementById('apiHourlyChart');
  if (!ctx) return;

  const labels = hourly.map(h => h.hour);
  const gridData = hourly.map(h => h.grid || 0);
  const weatherData = hourly.map(h => h.weather || 0);

  const isDark = document.body.classList.contains('theme-dark');
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const textColor = isDark ? '#ccc' : '#333';

  if (apiHourlyChart) apiHourlyChart.destroy();

  apiHourlyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Grid', data: gridData, backgroundColor: '#ff9800', borderRadius: 4 },
        { label: 'Weather', data: weatherData, backgroundColor: '#4a90e2', borderRadius: 4 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: textColor } } },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: textColor } },
        y: { grid: { color: gridColor }, ticks: { color: textColor }, beginAtZero: true }
      }
    }
  });
}

async function loadLogs() {
  try {
    const typeParam = currentLogTab === 'errors' ? '' : currentLogTab;
    const res = await fetch('/api/admin/logs?type=' + encodeURIComponent(typeParam) + '&limit=80', { credentials: 'include' });
    const data = await res.json();
    const tbody = document.getElementById('logTableBody');
    const rawLogs = data.logs || [];
    const logs = currentLogTab === 'errors'
      ? rawLogs.filter((l) => Number(l.status) >= 400 || l.error)
      : rawLogs;
    if (!logs.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty">暂无日志</td></tr>';
      return;
    }
    tbody.innerHTML = logs.map(l => {
      const time = new Date(l.time).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const statusClass = l.status >= 200 && l.status < 400 ? 'status-ok' : 'status-err';
      return `<tr>
        <td>${time}</td>
        <td>${escapeHtml(l.endpoint || '-')}</td>
        <td class="${statusClass}">${l.status}</td>
        <td>${l.durationMs}ms</td>
        <td class="status-err">${escapeHtml(l.error || '-')}</td>
      </tr>`;
    }).join('');
  } catch (err) {
    console.error('加载日志失败:', err);
  }
}

function switchLogTab(type, btn) {
  currentLogTab = type;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadLogs();
}

// =================== 队列状态 ===================
async function loadQueue() {
  try {
    const [sunsetRes, sunriseRes] = await Promise.all([
      fetch('/api/heatmap/status?period=sunset'),
      fetch('/api/heatmap/status?period=sunrise')
    ]);
    const [sunset, sunrise] = await Promise.all([sunsetRes.json(), sunriseRes.json()]);
    renderQueueStatus([sunset, sunrise]);
  } catch (err) {
    console.error('加载队列失败:', err);
    const el = document.getElementById('queueStatusGrid');
    if (el) el.innerHTML = '<p class="empty">队列状态加载失败</p>';
  }
}

function renderQueueStatus(items) {
  const el = document.getElementById('queueStatusGrid');
  if (!el) return;
  el.innerHTML = items.map((item) => {
    const total = Number(item.totalPoints || 0);
    const completed = Number(item.completedPoints || 0);
    const progress = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
    const title = item.period === 'sunrise' ? '朝霞' : '晚霞';
    const state = item.running ? '运行中' : '空闲';
    const eta = item.etaSeconds == null ? '-' : `${Math.ceil(Number(item.etaSeconds) / 60)} 分钟`;
    const error = item.lastError ? `<div class="queue-error">${escapeHtml(item.lastError)}</div>` : '';
    return `<div class="queue-card">
      <div class="queue-head"><strong>${title}</strong><span class="${item.running ? 'status-ok' : ''}">${state}</span></div>
      <div class="queue-progress"><span style="width:${progress}%"></span></div>
      <div class="queue-meta">
        <span>${completed}/${total || '-'}</span>
        <span>成功 ${Number(item.successPoints || 0)}</span>
        <span>失败 ${Number(item.errorPoints || 0)}</span>
        <span>ETA ${eta}</span>
      </div>
      ${error}
    </div>`;
  }).join('');
}

// =================== 每日统计 ===================
async function loadDailyStats() {
  try {
    const res = await fetch('/api/admin/logs/daily?days=7', { credentials: 'include' });
    const data = await res.json();
    const tbody = document.getElementById('dailyStatsBody');
    const days = data.days || [];

    if (!days.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="empty">暂无数据</td></tr>';
      return;
    }

    tbody.innerHTML = days.map(d => {
      const c = d.calls || {};
      const grid = c.grid || { total: 0, fail: 0 };
      const weather = c.weather || { total: 0, fail: 0 };
      const gaode = c.gaode || { total: 0, fail: 0 };
      const gaodeTile = c.gaode_tile || { total: 0, fail: 0 };
      const retries = d.retries || {};

      const totalCalls = (grid.total || 0) + (weather.total || 0) + (gaode.total || 0) + (gaodeTile.total || 0);
      const totalFail = (grid.fail || 0) + (weather.fail || 0) + (gaode.fail || 0) + (gaodeTile.fail || 0);

      return `<tr>
        <td>${d.day}</td>
        <td>${totalCalls}</td>
        <td class="${totalFail > 0 ? 'status-err' : 'status-ok'}">${totalFail}</td>
        <td>${grid.total || 0}</td>
        <td>${weather.total || 0}</td>
        <td>${(gaode.total || 0) + (gaodeTile.total || 0)}</td>
        <td>${retries.attempts || 0}</td>
        <td class="status-ok">${retries.recovered || 0}</td>
        <td class="${(retries.failedAfterRetry || 0) > 0 ? 'status-err' : ''}">${retries.failedAfterRetry || 0}</td>
      </tr>`;
    }).join('');
  } catch (err) {
    console.error('加载每日统计失败:', err);
  }
}

// =================== 定时配置 ===================
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
    scheduleJobs = [
      { time: '10:00', type: 'both', label: '上午刷新' },
      { time: '22:00', type: 'both', label: '晚间刷新' }
    ];
    renderScheduleJobs();
  }
}

function renderScheduleJobs() {
  const container = document.getElementById('scheduleJobs');
  container.innerHTML = scheduleJobs.map((job, i) => `
    <div class="schedule-job-row">
      <input type="time" value="${job.time}" onchange="scheduleJobs[${i}].time=this.value">
      <select onchange="scheduleJobs[${i}].type=this.value">
        <option value="both" ${job.type === 'both' ? 'selected' : ''}>朝霞+晚霞</option>
        <option value="sunrise" ${job.type === 'sunrise' ? 'selected' : ''}>仅朝霞</option>
        <option value="sunset" ${job.type === 'sunset' ? 'selected' : ''}>仅晚霞</option>
      </select>
      <input type="text" value="${escapeHtml(job.label || '')}" placeholder="备注" onchange="scheduleJobs[${i}].label=this.value">
      <button class="btn btn-danger btn-sm" onclick="removeScheduleJob(${i})">删除</button>
    </div>
  `).join('');
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
    msgEl.textContent = data.success ? '✅ 配置已保存' : '❌ 保存失败';
    msgEl.className = 'admin-message ' + (data.success ? 'success' : 'error');
  } catch (err) {
    msgEl.textContent = '❌ 保存失败: ' + err.message;
    msgEl.className = 'admin-message error';
  }
  msgEl.classList.remove('hidden');
  setTimeout(() => msgEl.classList.add('hidden'), 5000);
}

// =================== 照片管理 ===================
async function loadPhotos() {
  try {
    const res = await fetch('/api/photos');
    const data = await res.json();
    renderPhotos(data.photos || []);
  } catch (err) {
    console.error('加载照片失败:', err);
  }
}

function renderPhotos(photos) {
  const grid = document.getElementById('photoGrid');
  if (!photos.length) {
    grid.innerHTML = '<p class="empty">暂无照片</p>';
    return;
  }
  grid.innerHTML = photos.map(p => `
    <div class="photo-card">
      <img class="photo-thumb" src="${p.thumbUrl}" alt="${escapeHtml(p.filename)}">
      <div class="photo-info">
        <div class="photo-desc">${escapeHtml(p.desc || '无描述')}</div>
        <div class="photo-meta">${p.lat && p.lon ? `📍 ${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}` : '📍 无位置'}</div>
        <button class="btn btn-danger btn-sm" style="width:100%" onclick="deletePhoto('${p.id}')">删除</button>
      </div>
    </div>
  `).join('');
}

async function deletePhoto(id) {
  if (!confirm('确定删除这张照片吗？')) return;
  try {
    const res = await fetch(`/photos/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) {
      showMessage('删除成功');
      loadPhotos();
    } else {
      showMessage('删除失败', 'error');
    }
  } catch (err) {
    showMessage('删除失败', 'error');
  }
}

function initUploadForm() {
  const form = document.getElementById('uploadForm');
  const fileInput = document.getElementById('photoFile');
  const selectedName = document.getElementById('selectedPhotoName');
  const progress = document.getElementById('uploadProgress');
  const progressBar = document.getElementById('uploadProgressBar');
  const progressText = document.getElementById('uploadProgressText');
  const feedback = document.getElementById('uploadFeedback');
  const gpsStatus = document.getElementById('photoGpsStatus');
  const latInput = document.getElementById('lat');
  const lonInput = document.getElementById('lon');

  if (!form || !fileInput) return;

  const setProgress = (percent, text) => {
    if (progress) progress.classList.remove('hidden');
    if (progressBar) progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    if (progressText) progressText.textContent = text;
  };

  const resetProgress = () => {
    if (progress) progress.classList.add('hidden');
    if (progressBar) progressBar.style.width = '0%';
    if (progressText) progressText.textContent = '等待上传';
  };

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (selectedName) {
      selectedName.textContent = file ? `已选择：${file.name}` : '尚未选择照片';
    }
    resetProgress();
    if (feedback) feedback.classList.add('hidden');
    await autofillPhotoGpsFromExif(file, gpsStatus);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!fileInput.files[0]) {
      showMessage('请选择照片', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('photo', fileInput.files[0]);
    const desc = document.getElementById('description').value;
    const lat = parseFloat(latInput?.value || '');
    const lon = parseFloat(lonInput?.value || '');
    if (!isValidPhotoCoordinate(lat, lon)) {
      const message = '照片位置是必填项：请手动填写有效经纬度。';
      showMessage(message, 'error', 'uploadFeedback');
      updateGpsStatus(gpsStatus, message, 'error');
      return;
    }
    if (desc) formData.append('description', desc);
    formData.append('lat', lat);
    formData.append('lon', lon);

    const btn = document.getElementById('uploadBtn');
    btn.disabled = true;
    btn.textContent = '上传中...';

    setProgress(0, '准备上传...');
    if (feedback) feedback.classList.add('hidden');

    try {
      const data = await uploadPhotoWithProgress(formData, (percent) => {
        setProgress(percent, `上传中 ${percent}%`);
      });

      setProgress(100, '上传完成');
      showMessage('上传成功', 'success', 'uploadFeedback');
      form.reset();
      if (selectedName) selectedName.textContent = '尚未选择照片';
      loadPhotos();
      setTimeout(resetProgress, 1200);
    } catch (err) {
      const message = err?.message || '未知错误';
      setProgress(100, '上传失败');
      showMessage('上传失败: ' + message, 'error', 'uploadFeedback');
    } finally {
      btn.disabled = false;
      btn.textContent = '上传照片';
    }
  });
}

function updateGpsStatus(statusEl, text, type = '') {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.className = `photo-gps-status ${type}`.trim();
}

function isValidPhotoCoordinate(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

function setPhotoCoordinate(lat, lon, statusEl, source = '已设置位置') {
  const latInput = document.getElementById('lat');
  const lonInput = document.getElementById('lon');
  if (!isValidPhotoCoordinate(lat, lon)) return false;
  if (latInput) latInput.value = lat.toFixed(6);
  if (lonInput) lonInput.value = lon.toFixed(6);
  updateGpsStatus(statusEl, `${source}：${lat.toFixed(6)}, ${lon.toFixed(6)}`, 'success');
  return true;
}

async function autofillPhotoGpsFromExif(file, statusEl) {
  if (!file) {
    updateGpsStatus(statusEl, '地理位置必填：选择照片后会尝试读取 EXIF；没有位置请手动填写经纬度。');
    return;
  }

  if (!window.exifr?.gps) {
    updateGpsStatus(statusEl, '浏览器端 EXIF 读取库未加载；位置仍然必填，请手动填写经纬度。', 'warning');
    return;
  }

  updateGpsStatus(statusEl, '正在读取照片位置信息...');

  try {
    const gps = await window.exifr.gps(file);
    const lat = Number(gps?.latitude);
    const lon = Number(gps?.longitude);

    if (!isValidPhotoCoordinate(lat, lon)) {
      updateGpsStatus(statusEl, '这张照片没有可用地理位置信息；位置是必填项，请手动填写经纬度。', 'warning');
      return;
    }

    setPhotoCoordinate(lat, lon, statusEl, '已读取位置');
  } catch (err) {
    updateGpsStatus(statusEl, '读取照片位置信息失败；位置是必填项，请手动填写经纬度。', 'error');
  }
}

function uploadPhotoWithProgress(formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/upload');
    xhr.withCredentials = true;

    xhr.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable) {
        onProgress(15);
        return;
      }
      const percent = Math.max(1, Math.min(99, Math.round((event.loaded / event.total) * 100)));
      onProgress(percent);
    });

    xhr.addEventListener('load', () => {
      let data = {};
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : {};
      } catch {
        data = {};
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
      } else {
        reject(new Error(data.error?.message || `HTTP ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('网络错误')));
    xhr.addEventListener('abort', () => reject(new Error('上传已取消')));
    xhr.send(formData);
  });
}

// =================== API Token 管理 ===================
async function loadTokens() {
  try {
    const res = await fetch('/api/admin/tokens', { credentials: 'include' });
    const data = await res.json();
    const tbody = document.getElementById('tokenTableBody');

    const tokens = data.tokens || [];
    if (!tokens.length) {
      tbody.innerHTML = '<tr><td colspan="11" class="empty">暂无 Token</td></tr>';
      return;
    }

    tbody.innerHTML = tokens.map((t) => {
      const usage = t.usageCount || 0;
      const expiresAt = t.expiresAt ? new Date(t.expiresAt).toLocaleString('zh-CN') : '长期';
      return `<tr>\n        <td><input type="checkbox" class="token-select" value="${escapeHtml(t.id)}"></td>\n        <td>${escapeHtml(t.name || '-')}</td>\n        <td>${formatStatus(t.enabled)}</td>\n        <td>${escapeHtml(t.trustedUser || '-')}</td>\n        <td>${t.nonCommercial === false ? '否' : '是'}</td>\n        <td>${escapeHtml(expiresAt)}</td>\n        <td>${escapeHtml(String(t.minuteLimit || 0))}</td>\n        <td>${escapeHtml(String(t.dailyLimit || 0))}</td>\n        <td>${escapeHtml(String(usage))}</td>\n        <td>${escapeHtml(t.note || '-')}</td>\n        <td>\n          <button class="btn btn-secondary" onclick="editToken('${t.id}')">编辑</button>\n          <button class="btn btn-secondary" onclick="toggleToken('${t.id}', ${t.enabled ? 'false' : 'true'})">${t.enabled ? '停用' : '启用'}</button>\n          <button class="btn btn-secondary" onclick="deleteToken('${t.id}')">删除</button>\n        </td>\n      </tr>`;
    }).join('');
  } catch (err) {
    const tbody = document.getElementById('tokenTableBody');
    tbody.innerHTML = '<tr><td colspan="11" class="empty">加载失败</td></tr>';
  }
}

async function toggleToken(id, enabled) {
  try {
    const res = await fetch(`/api/admin/tokens/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
    const data = await res.json();
    if (!res.ok) {
      showMessage(data?.error?.message || '更新失败', 'error');
      return;
    }
    await loadTokens();
  } catch (err) {
    showMessage(err.message, 'error');
  }
}

async function deleteToken(id) {
  if (!confirm('确定删除该 Token？')) return;
  try {
    const res = await fetch(`/api/admin/tokens/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) {
      showMessage(data?.error?.message || '删除失败', 'error');
      return;
    }
    await loadTokens();
    showMessage('删除成功', 'success');
  } catch (err) {
    showMessage(err.message, 'error');
  }
}

function initTokenForm() {
  const form = document.getElementById('tokenCreateForm');
  const btn = document.getElementById('createTokenBtn');
  const msg = document.getElementById('tokenMsg');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = String(document.getElementById('tokenName').value || '').trim();
    const minuteLimit = parseInt(document.getElementById('tokenMinuteLimit').value || '', 10);
    const dailyLimit = parseInt(document.getElementById('tokenDailyLimit').value || '', 10);
    const enabled = document.getElementById('tokenEnabled').checked;
    const trustedUser = String(document.getElementById('tokenTrustedUser')?.value || '').trim();
    const note = String(document.getElementById('tokenNote')?.value || '').trim();
    const expiresAtInput = String(document.getElementById('tokenExpiresAt')?.value || '').trim();
    const nonCommercial = document.getElementById('tokenNonCommercial')?.checked !== false;

    if (!name) {
      msg.textContent = '名称不能为空';
      msg.className = 'admin-message error';
      msg.classList.remove('hidden');
      return;
    }

    btn.disabled = true;
    btn.textContent = '创建中...';
    try {
      const body = { name, enabled };
      if (Number.isFinite(minuteLimit)) body.minuteLimit = minuteLimit;
      if (Number.isFinite(dailyLimit)) body.dailyLimit = dailyLimit;
      if (trustedUser) body.trustedUser = trustedUser;
      if (note) body.note = note;
      if (expiresAtInput) body.expiresAt = new Date(expiresAtInput).toISOString();
      body.nonCommercial = nonCommercial;

      const res = await fetch('/api/admin/tokens', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) {
        msg.textContent = data?.error?.message || '创建失败';
        msg.className = 'admin-message error';
        msg.classList.remove('hidden');
        return;
      }

      msg.textContent = `创建成功，明文 Token: ${data.token}`;
      msg.className = 'admin-message success';
      msg.classList.remove('hidden');
      form.reset();
      loadTokens();
      setTimeout(() => {
        msg.classList.add('hidden');
      }, 12000);
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'admin-message error';
      msg.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = '创建 Token';
    }
  });
}


async function editToken(id) {
  try {
    const listRes = await fetch('/api/admin/tokens', { credentials: 'include' });
    const listData = await listRes.json();
    const token = (listData.tokens || []).find((item) => item.id === id);
    if (!token) {
      showMessage('未找到 Token', 'error');
      return;
    }
    openTokenEditor(token);
  } catch (err) {
    showMessage(err.message, 'error');
  }
}

function toDatetimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

function openTokenEditor(token) {
  document.getElementById('editTokenId').value = token.id || '';
  document.getElementById('editTokenName').value = token.name || '';
  document.getElementById('editTokenTrustedUser').value = token.trustedUser || '';
  document.getElementById('editTokenMinuteLimit').value = token.minuteLimit || '';
  document.getElementById('editTokenDailyLimit').value = token.dailyLimit || '';
  document.getElementById('editTokenExpiresAt').value = toDatetimeLocal(token.expiresAt);
  document.getElementById('editTokenNote').value = token.note || '';
  document.getElementById('editTokenEnabled').checked = token.enabled !== false;
  document.getElementById('editTokenNonCommercial').checked = token.nonCommercial !== false;
  document.getElementById('tokenEditModal').classList.remove('hidden');
}

function closeTokenEditor() {
  document.getElementById('tokenEditModal')?.classList.add('hidden');
}

function initTokenEditForm() {
  const form = document.getElementById('tokenEditForm');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = document.getElementById('editTokenId').value;
    const expiresAtInput = document.getElementById('editTokenExpiresAt').value;
    const patch = {
      name: document.getElementById('editTokenName').value.trim(),
      trustedUser: document.getElementById('editTokenTrustedUser').value.trim(),
      minuteLimit: parseInt(document.getElementById('editTokenMinuteLimit').value, 10),
      dailyLimit: parseInt(document.getElementById('editTokenDailyLimit').value, 10),
      expiresAt: expiresAtInput ? new Date(expiresAtInput).toISOString() : null,
      note: document.getElementById('editTokenNote').value.trim(),
      enabled: document.getElementById('editTokenEnabled').checked,
      nonCommercial: document.getElementById('editTokenNonCommercial').checked
    };
    if (!Number.isFinite(patch.minuteLimit)) delete patch.minuteLimit;
    if (!Number.isFinite(patch.dailyLimit)) delete patch.dailyLimit;
    try {
      const updateRes = await fetch('/api/admin/tokens/' + id, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });
      const updateData = await updateRes.json();
      if (!updateRes.ok) {
        showMessage(updateData?.error?.message || '更新失败', 'error');
        return;
      }
      closeTokenEditor();
      await loadTokens();
      showMessage('更新成功', 'success');
    } catch (err) {
      showMessage(err.message, 'error');
    }
  });
}

async function batchDisableSelectedTokens() {
  const ids = Array.from(document.querySelectorAll('.token-select:checked')).map((el) => el.value).filter(Boolean);
  if (!ids.length) {
    showMessage('请先选择要批量禁用的 Token', 'error');
    return;
  }
  const note = prompt('批量禁用备注', 'invited user access disabled') || 'batch disabled';
  if (!confirm(`确定禁用 ${ids.length} 个 Token？`)) return;
  try {
    const res = await fetch('/api/admin/tokens/batch-disable', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, note })
    });
    const data = await res.json();
    if (!res.ok) {
      showMessage(data?.error?.message || '批量禁用失败', 'error');
      return;
    }
    await loadTokens();
    showMessage(`已禁用 ${data.disabledCount || 0} 个 Token`, 'success');
  } catch (err) {
    showMessage(err.message, 'error');
  }
}

// =================== API 申请管理 ===================
function _statusOptions(selected = 'pending') {
  const options = [
    ['pending', '待审核'],
    ['approved', '已通过'],
    ['rejected', '已拒绝']
  ];
  return options
    .map(([value, label]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`)
    .join('');
}

async function loadApplications() {
  try {
    const res = await fetch('/api/admin/applications', { credentials: 'include' });
    const data = await res.json();
    const apps = data.applications || [];
    const tbody = document.getElementById('applicationTableBody');

    if (!apps.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty">暂无申请</td></tr>';
      return;
    }

    tbody.innerHTML = apps.map(app => {
      const remark = escapeHtml(app.remarks || '');
      const status = escapeHtml(app.status || 'pending');
      const tokenId = escapeHtml(app.tokenId || '-');
      return `<tr>\n        <td>${escapeHtml(app.email || '-')}</td>\n        <td>${escapeHtml(app.contact || '-')}</td>\n        <td>${escapeHtml(app.purpose || '-')}</td>\n        <td>${app.expectedCallVolume == null ? '-' : escapeHtml(String(app.expectedCallVolume))}</td>\n        <td>\n          <select onchange="setApplicationStatus('${app.id}', this.value)">\n            ${_statusOptions(status)}\n          </select>\n        </td>\n        <td><input id="remark-${app.id}" value="${remark}" style="width: 140px;" /></td>\n        <td>${tokenId}</td>\n        <td>\n          <button class="btn btn-secondary" onclick="approveApplication('${app.id}')">审批通过并建Token</button>\n          <button class="btn btn-secondary" onclick="rejectApplication('${app.id}')">拒绝</button>\n        </td>\n      </tr>`;
    }).join('');
  } catch (err) {
    const tbody = document.getElementById('applicationTableBody');
    tbody.innerHTML = '<tr><td colspan="8" class="empty">加载失败</td></tr>';
  }
}

async function setApplicationStatus(id, status) {
  const remarks = document.getElementById(`remark-${id}`)?.value || '';
  try {
    const res = await fetch(`/api/admin/applications/${id}/review`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, remarks })
    });
    const data = await res.json();
    if (!res.ok) {
      showMessage(data?.error?.message || '更新失败', 'error');
      return;
    }
    loadApplications();
  } catch (err) {
    showMessage(err.message, 'error');
  }
}

async function approveApplication(id) {
  const remarks = document.getElementById(`remark-${id}`)?.value || '';
  try {
    const res = await fetch(`/api/admin/applications/${id}/review`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved', remarks, createToken: true })
    });
    const data = await res.json();
    if (!res.ok) {
      showMessage(data?.error?.message || '审批失败', 'error');
      return;
    }

    if (data.token) {
      showMessage(`已通过并创建 Token: ${data.token}`, 'success');
    } else {
      showMessage('已更新审核状态', 'success');
    }

    await Promise.all([loadApplications(), loadTokens()]);
  } catch (err) {
    showMessage(err.message, 'error');
  }
}

async function rejectApplication(id) {
  const remarks = document.getElementById(`remark-${id}`)?.value || '';
  await setApplicationStatus(id, 'rejected');
}

// =================== Agent 审计日志 ===================

async function loadAgentUsageStats() {
  try {
    const res = await fetch('/api/admin/agent-usage', { credentials: 'include' });
    const data = await res.json();
    const tbody = document.getElementById('agentUsageTableBody');
    const rows = Array.isArray(data.tokens) ? data.tokens : [];

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty">暂无数据</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map((item) => {
      const recent = Array.isArray(item.recentCalls) && item.recentCalls.length
        ? item.recentCalls
            .map((r) => `${new Date(r.at).toLocaleString('zh-CN')} ${r.endpoint} ${r.status} ${r.errorCode || ''}`)
            .join('<br/>')
        : '暂无';

      return `<tr>
        <td>${escapeHtml(item.name || '-')}</td>
        <td>${Number(item.todayCalls || 0)}</td>
        <td>${escapeHtml(item.todayErrorRate || '0%')}</td>
        <td>${item.dailyRemaining == null ? '-' : Number(item.dailyRemaining)}</td>
        <td>${recent}</td>
      </tr>`;
    }).join('');
  } catch (err) {
    const tbody = document.getElementById('agentUsageTableBody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty">加载失败</td></tr>';
    }
  }
}

async function loadAuditLogs() {
  try {
    const res = await fetch('/api/admin/audit-logs?limit=20', { credentials: 'include' });
    const data = await res.json();
    const logs = data.logs || [];
    const tbody = document.getElementById('auditLogTableBody');

    if (!logs.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty">暂无日志</td></tr>';
      return;
    }

    tbody.innerHTML = logs.map((log) => {
      const t = new Date(log.createdAt).toLocaleString('zh-CN');
      return `<tr>\n        <td>${t}</td>\n        <td>${escapeHtml(log.tokenId || '-')}</td>\n        <td>${escapeHtml(log.endpoint || '-')}</td>\n        <td>${escapeHtml(String(log.status || 0))}</td>\n        <td>${escapeHtml(String(log.elapsedMs || 0))}</td>\n        <td>${escapeHtml(log.errorCode || '-')}</td>\n      </tr>`;
    }).join('');
  } catch (err) {
    const tbody = document.getElementById('auditLogTableBody');
    tbody.innerHTML = '<tr><td colspan="6" class="empty">加载失败</td></tr>';
  }
}

// =================== 工具函数 ===================

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
