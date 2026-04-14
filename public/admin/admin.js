/**
 * 霞客管理后台 JS
 */

// 图表实例
let accessTrendChart = null;
let apiHourlyChart = null;

// 当前日志Tab
let currentLogTab = 'grid';

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadAll();
  initUploadForm();

  // 自动刷新
  setInterval(() => {
    loadAccessStats();
    loadLogSummary();
    loadLogs();
    loadHealth();
  }, 15000);
  setInterval(loadQueue, 15000);
  setInterval(loadDailyStats, 60000);
});

function initTheme() {
  const toggle = document.getElementById('theme-toggle');
  const saved = localStorage.getItem('admin-theme') || 'theme-dark';
  document.body.className = saved;

  toggle.addEventListener('click', () => {
    const isDark = document.body.classList.contains('theme-dark');
    const next = isDark ? 'theme-light' : 'theme-dark';
    document.body.className = next;
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
    loadPhotos(),
    loadHealth()
  ]);
}

function showMessage(msg, type = 'success') {
  const el = document.getElementById('message');
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
    const res = await fetch('/api/admin/logs?type=' + encodeURIComponent(currentLogTab) + '&limit=50', { credentials: 'include' });
    const data = await res.json();
    const tbody = document.getElementById('logTableBody');
    if (!data.logs?.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty">暂无日志</td></tr>';
      return;
    }
    tbody.innerHTML = data.logs.map(l => {
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
    // 队列状态目前不展示在UI上，可扩展
  } catch (err) {
    console.error('加载队列失败:', err);
  }
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
    const res = await fetch(`/admin/photos/${id}`, { method: 'DELETE', credentials: 'include' });
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
  document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('photoFile');
    if (!fileInput.files[0]) {
      showMessage('请选择照片', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('photo', fileInput.files[0]);
    const desc = document.getElementById('description').value;
    const lat = parseFloat(document.getElementById('lat').value);
    const lon = parseFloat(document.getElementById('lon').value);
    if (desc) formData.append('description', desc);
    if (!isNaN(lat)) formData.append('lat', lat);
    if (!isNaN(lon)) formData.append('lon', lon);

    const btn = document.getElementById('uploadBtn');
    btn.disabled = true;
    btn.textContent = '上传中...';

    try {
      const res = await fetch('/admin/upload', { method: 'POST', credentials: 'include', body: formData });
      const data = await res.json();
      if (res.ok) {
        showMessage('上传成功');
        document.getElementById('uploadForm').reset();
        loadPhotos();
      } else {
        showMessage('上传失败: ' + (data.error?.message || '未知错误'), 'error');
      }
    } catch (err) {
      showMessage('上传失败', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '上传照片';
    }
  });
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
