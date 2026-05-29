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
let photoCache = [];
let dataPipelineConfigCache = null;

const ADMIN_VIEW_ALIASES = {
  schedule: 'ops',
  'data-pipeline': 'ops'
};
const ADMIN_VIEWS = new Set(['dashboard', 'visitors', 'ops', 'logs', 'agent', 'photos']);
const ADMIN_VIEW_META = {
  dashboard: ['运行总览', '状态优先、操作分区，快速判断霞客当前运行情况。'],
  visitors: ['访客分析', '按北京时间查看 PV、UV、IP 和访问明细。'],
  ops: ['运维中心', '队列、定时任务、GFS+CAMS 数据管线集中管理。'],
  logs: ['日志', '集中查看外部 API 调用、错误率和每日统计。'],
  agent: ['API Token', 'Token 创建、申请审核、用量和审计日志。'],
  photos: ['照片管理', '上传、解析和管理分享地图照片。']
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initAdminNavigation();
  initUploadForm();
  initPhotoEditForm();
  initTokenForm();
  initTokenEditForm();
  initDataPipelineForm();

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
    loadVisitorRecords(),
    loadDailyStats(),
    loadSchedule(),
    loadDataPipeline(),
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
    const rawView = window.location.hash.replace(/^#/, '') || 'dashboard';
    const view = ADMIN_VIEW_ALIASES[rawView] || rawView;
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
    const normalizedView = ADMIN_VIEW_ALIASES[view] || view;
    activeAdminView = ADMIN_VIEWS.has(normalizedView) ? normalizedView : 'dashboard';
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
      if (active) {
        option.setAttribute('aria-current', 'page');
      } else {
        option.removeAttribute('aria-current');
      }
    });
    updateAdminPageHeading(activeAdminView);
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

function updateAdminPageHeading(view) {
  const [title, subtitle] = ADMIN_VIEW_META[view] || ADMIN_VIEW_META.dashboard;
  const titleEl = document.getElementById('admin-page-title');
  const subtitleEl = document.getElementById('admin-page-subtitle');
  if (titleEl) titleEl.textContent = title;
  if (subtitleEl) subtitleEl.textContent = subtitle;
}

async function loadActiveView() {
  switch (activeAdminView) {
    case 'dashboard':
      await Promise.all([loadAccessStats(), loadLogSummary(), loadHealth(), loadShareStats()]);
      break;
    case 'ops':
      await Promise.all([loadQueue(), loadHealth(), loadSchedule(), loadDataPipeline()]);
      break;
    case 'visitors':
      await loadVisitorRecords();
      break;
    case 'logs':
      await Promise.all([loadLogSummary(), loadLogs(), loadDailyStats()]);
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
    Promise.all([loadQueue(), loadHealth(), loadDataPipelineStatus(), loadDataPipelineRuns()]);
  } else if (activeAdminView === 'visitors') {
    loadVisitorRecords();
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
        `<tr><td>${escapeHtml(item.ip)}</td><td>${escapeHtml(item.location || '--')}</td><td>${item.count}</td></tr>`
      ).join('');
    } else {
      ipBody.innerHTML = '<tr><td colspan="3" class="empty">暂无数据</td></tr>';
    }

    // 7天趋势图
    renderClientStats(data.clientBreakdown || []);
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

function renderClientStats(rows = []) {
  const tbody = document.getElementById('clientStatsBody');
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="3" class="empty">暂无客户端数据</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map((item) => `
    <tr>
      <td>${escapeHtml(formatClientLabel(item.client))}</td>
      <td>${Number(item.pv || 0)}</td>
      <td>${Number(item.uv || 0)}</td>
    </tr>
  `).join('');
}

function getBeijingDateInputValue() {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const pad = n => String(n).padStart(2, '0');
  return now.getUTCFullYear() + '-' + pad(now.getUTCMonth() + 1) + '-' + pad(now.getUTCDate());
}

async function loadVisitorRecords() {
  const dateInput = document.getElementById('visitorDate');
  if (!dateInput) return;
  if (!dateInput.value) dateInput.value = getBeijingDateInputValue();

  try {
    const params = new URLSearchParams({ date: dateInput.value, limit: '500' });
    const res = await fetch('/admin/visitor-records?' + params.toString(), { credentials: 'include' });
    const data = await res.json();

    document.getElementById('visitor-pv').textContent = data.summary?.pv ?? '--';
    document.getElementById('visitor-uv').textContent = data.summary?.uv ?? '--';
    document.getElementById('visitor-ip-count').textContent = data.summary?.ips ?? '--';

    const ipBody = document.getElementById('visitorIpBody');
    if (data.topIps?.length) {
      ipBody.innerHTML = data.topIps.map(item =>
        '<tr><td>' + escapeHtml(item.ip) + '</td><td>' + escapeHtml(item.location || '--') + '</td><td>' + Number(item.count || 0) + '</td></tr>'
      ).join('');
    } else {
      ipBody.innerHTML = '<tr><td colspan="3" class="empty">暂无 IP 数据</td></tr>';
    }

    const recordBody = document.getElementById('visitorRecordBody');
    if (data.records?.length) {
      recordBody.innerHTML = data.records.map(item =>
        '<tr><td>' + escapeHtml(item.time || '--') + '</td><td>' + escapeHtml(formatClientLabel(item.client)) + '</td><td>' + escapeHtml(item.ip || '--') + '</td><td>' + escapeHtml(item.location || '--') + '</td><td>' + escapeHtml(item.method || '--') + '</td><td class="visitor-path-cell">' + escapeHtml(item.path || '--') + '</td></tr>'
      ).join('');
    } else {
      recordBody.innerHTML = '<tr><td colspan="6" class="empty">暂无访问明细</td></tr>';
    }
  } catch (err) {
    console.error('加载访客记录失败:', err);
    const ipBody = document.getElementById('visitorIpBody');
    const recordBody = document.getElementById('visitorRecordBody');
    if (ipBody) ipBody.innerHTML = '<tr><td colspan="3" class="empty">访客 IP 加载失败</td></tr>';
    if (recordBody) recordBody.innerHTML = '<tr><td colspan="6" class="empty">访问明细加载失败</td></tr>';
  }
}

function formatClientLabel(client) {
  if (client === 'miniprogram') return '微信小程序';
  if (client === 'web') return '网页';
  return client || '--';
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
    const [sunsetRes, sunriseRes, scheduleRes] = await Promise.all([
      fetch('/api/heatmap/status?period=sunset'),
      fetch('/api/heatmap/status?period=sunrise'),
      fetch('/api/admin/schedule', { credentials: 'include' })
    ]);
    const [sunset, sunrise, scheduleData] = await Promise.all([
      sunsetRes.json(), sunriseRes.json(), scheduleRes.json()
    ]);
    const schedule = scheduleData?.config?.jobs || [];
    renderQueueStatus([sunset, sunrise], schedule);
  } catch (err) {
    console.error('加载队列失败:', err);
    const el = document.getElementById('queueStatusGrid');
    if (el) el.innerHTML = '<p class="empty">队列状态加载失败</p>';
  }
}

function calcNextSchedule(jobs, period, label) {
  const now = new Date();
  let next = null;
  for (const job of jobs) {
    if (!job.enabled && job.enabled !== undefined) continue;
    if (job.type !== period && job.type !== 'both') continue;
    const [h, m] = String(job.time || '').split(':').map(Number);
    if (isNaN(h) || isNaN(m)) continue;
    const t = new Date(now);
    t.setHours(h, m, 0, 0);
    if (t <= now) t.setDate(t.getDate() + 1);
    if (!next || t < next) next = t;
  }
  if (!next) return '无计划';
  const diffMin = Math.round((next - now) / 60000);
  if (diffMin < 60) return `${diffMin} 分钟后`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)} 小时 ${diffMin % 60} 分钟后`;
  return `${label} ${next.getHours().toString().padStart(2,'0')}:${next.getMinutes().toString().padStart(2,'0')}`;
}

function renderQueueStatus(items, schedule = []) {
  const el = document.getElementById('queueStatusGrid');
  if (!el) return;
  el.innerHTML = items.map((item) => {
    const total = Number(item.totalPoints || 0);
    const completed = Number(item.completedPoints || 0);
    const progress = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
    const title = item.period === 'sunrise' ? '朝霞' : '晚霞';
    const label = item.period === 'sunrise' ? '明天' : '今天';
    const stateClass = item.running ? 'queue-badge-running' : 'queue-badge-idle';
    const stateText = item.running ? '⚡ 运行中' : '✓ 空闲';
    const eta = item.etaSeconds == null ? '-' : `${Math.ceil(Number(item.etaSeconds) / 60)} 分钟`;
    const cacheCount = Number(item.cacheCount || 0);
    const jobTime = formatPhotoDateTime(item.finishedAt) || null;
    const cacheTime = formatPhotoDateTime(item.cacheUpdatedAt) || '--';
    // 上次有效更新时间：优先用 job 完成时间，没有则用缓存时间
    const lastUpdate = jobTime || cacheTime;
    const cacheStateText = item.cacheStale === true ? '已过期' : (item.cacheStale === false ? '可用' : '无缓存');
    const cacheStateClass = item.cacheStale === true ? 'cache-stale' : (item.cacheStale === false ? 'cache-fresh' : 'cache-none');
    const nextSchedule = calcNextSchedule(schedule, item.period, label);
    const gridPoints = total > 0 ? `${completed}/${total}` : (cacheCount > 0 ? `${cacheCount} (缓存)` : '<span class="queue-no-data">无数据</span>');
    const errorText = summarizeQueueError(item.lastError);
    const error = errorText ? `<div class="queue-error" title="${escapeHtml(String(item.lastError))}">⚠ ${escapeHtml(errorText)}</div>` : '';
    return `<div class="queue-card">
      <div class="queue-card-header">
        <div class="queue-title-row"><strong>${title} Grid</strong><span class="queue-badge ${stateClass}">${stateText}</span></div>
        <div class="queue-times">
          <div class="queue-time-item"><span class="queue-time-label">上次更新</span><span class="queue-time-value">${escapeHtml(lastUpdate)}</span></div>
          <div class="queue-time-item"><span class="queue-time-label">下次更新</span><span class="queue-time-value">${escapeHtml(nextSchedule)}</span></div>
        </div>
      </div>
      <div class="queue-progress"><span style="width:${progress}%"></span></div>
      <div class="queue-meta">
        <span>网格点 ${gridPoints}</span>
        <span>成功 ${Number(item.successPoints || 0)}</span>
        <span>失败 ${Number(item.errorPoints || 0)}</span>
        ${item.running ? `<span>ETA ${eta}</span>` : ''}
      </div>
      <div class="queue-cache">
        <span>缓存 ${cacheCount || '-'} 点</span>
        <span class="${cacheStateClass}">${escapeHtml(cacheStateText)}</span>
      </div>
      <div class="queue-actions">
        <button class="btn btn-secondary btn-sm" onclick="triggerRefresh('${item.period}')">🔄 手动刷新</button>
      </div>
      ${error}
    </div>`;
  }).join('');
}

function summarizeQueueError(error) {
  if (!error) return '';
  let message = String(error)
    .replace(/\\r|\\n|\r|\n/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;[^&]*?&gt;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const status = message.match(/\b(4\d\d|5\d\d)\b/)?.[1];
  const title = message.match(/\b(\d{3}\s+[^-;]+)/)?.[1]?.trim();
  if (message.includes('Open-Meteo Batch API') && (title || status)) {
    message = `Open-Meteo Batch API 错误: ${title || status}`;
  }

  return message.length > 96 ? `${message.slice(0, 93)}...` : message;
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

// =================== GFS+CAMS 数据管线 ===================
const DATA_PIPELINE_PRESET_BBOXES = {
  china: { north: 54, south: 18, west: 73, east: 135 },
  east_asia: { north: 60, south: 5, west: 70, east: 150 },
  test_small: { north: 41, south: 39, west: 115, east: 117 }
};

const DATA_PIPELINE_PRESET_LABELS = {
  china: '中国',
  east_asia: '东亚',
  test_small: '小范围测试',
  custom_bbox: '自定义 bbox'
};

const DATA_PIPELINE_MODE_LABELS = {
  gfs_cams: 'GFS+CAMS',
  hybrid: 'Hybrid',
  openmeteo: 'Open-Meteo',
  cache_only: '仅缓存',
  paused: '暂停'
};

const DATA_PIPELINE_RECOMMENDED_PRESETS = {
  'safe-test': {
    label: '先跑小范围',
    mode: 'gfs_cams',
    regionPreset: 'test_small',
    resolution: 1,
    forecastHours: 24,
    sources: { gfs: true, cams: true, openMeteoFallback: true }
  },
  'china-balanced': {
    label: '中国均衡',
    mode: 'gfs_cams',
    regionPreset: 'china',
    resolution: 0.5,
    forecastHours: 48,
    sources: { gfs: true, cams: true, openMeteoFallback: true }
  },
  'fallback-only': {
    label: '只用 Open-Meteo',
    mode: 'openmeteo',
    regionPreset: 'china',
    resolution: 0.5,
    forecastHours: 48,
    sources: { gfs: false, cams: false, openMeteoFallback: true }
  }
};

async function loadDataPipeline() {
  await loadDataPipelineConfig();
  await Promise.all([loadDataPipelineStatus(), loadDataPipelineRuns()]);
}

async function loadDataPipelineConfig() {
  try {
    const res = await fetch('/api/admin/data-pipeline/config', { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || '加载配置失败');
    dataPipelineConfigCache = data.config || null;
    fillDataPipelineForm(dataPipelineConfigCache);
    renderDataPipelineEstimate(data.estimate || null);
  } catch (err) {
    showMessage('加载数据管线配置失败: ' + err.message, 'error', 'pipelineConfigMsg');
  }
}

async function loadDataPipelineStatus() {
  try {
    const res = await fetch('/api/admin/data-pipeline/status', { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || '加载状态失败');
    dataPipelineConfigCache = data.config || dataPipelineConfigCache;
    if (data.config) fillDataPipelineForm(data.config);
    renderDataPipelineStatus(data);
    renderDataPipelineEstimate(data.estimate || null);
  } catch (err) {
    const el = document.getElementById('pipelineStatusGrid');
    if (el) el.innerHTML = '<p class="empty">数据管线状态加载失败</p>';
  }
}

async function loadDataPipelineRuns() {
  try {
    const res = await fetch('/api/admin/data-pipeline/runs?limit=20', { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || '加载 runs 失败');
    renderDataPipelineRuns(data.runs || []);
  } catch (err) {
    const tbody = document.getElementById('pipelineRunsBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="empty">运行记录加载失败</td></tr>';
  }
}

function fillDataPipelineForm(config = {}) {
  const bbox = config.bbox || DATA_PIPELINE_PRESET_BBOXES.china;
  setInputValue('pipelineMode', config.mode || 'gfs_cams');
  setInputValue('pipelineRegionPreset', config.regionPreset || 'china');
  setInputValue('pipelineBboxNorth', bbox.north);
  setInputValue('pipelineBboxSouth', bbox.south);
  setInputValue('pipelineBboxWest', bbox.west);
  setInputValue('pipelineBboxEast', bbox.east);
  setInputValue('pipelineResolution', config.resolution || 0.5);
  setInputValue('pipelineForecastHours', config.forecastHours || 48);
  setCheckedValue('pipelineGfsEnabled', config.sources?.gfs !== false);
  setCheckedValue('pipelineCamsEnabled', config.sources?.cams !== false);
  setCheckedValue('pipelineOpenMeteoFallback', config.sources?.openMeteoFallback !== false);
}

function initDataPipelineForm() {
  const preset = document.getElementById('pipelineRegionPreset');
  if (!preset) return;
  preset.addEventListener('change', () => {
    const bbox = DATA_PIPELINE_PRESET_BBOXES[preset.value];
    if (!bbox) return;
    setInputValue('pipelineBboxNorth', bbox.north);
    setInputValue('pipelineBboxSouth', bbox.south);
    setInputValue('pipelineBboxWest', bbox.west);
    setInputValue('pipelineBboxEast', bbox.east);
    showMessage('范围已切换，保存前请先估算。', 'success', 'pipelineConfigMsg');
  });
}

function applyDataPipelinePreset(name) {
  const preset = DATA_PIPELINE_RECOMMENDED_PRESETS[name];
  if (!preset) return;
  const bbox = DATA_PIPELINE_PRESET_BBOXES[preset.regionPreset];
  setInputValue('pipelineMode', preset.mode);
  setInputValue('pipelineRegionPreset', preset.regionPreset);
  setInputValue('pipelineResolution', preset.resolution);
  setInputValue('pipelineForecastHours', preset.forecastHours);
  if (bbox) {
    setInputValue('pipelineBboxNorth', bbox.north);
    setInputValue('pipelineBboxSouth', bbox.south);
    setInputValue('pipelineBboxWest', bbox.west);
    setInputValue('pipelineBboxEast', bbox.east);
  }
  setCheckedValue('pipelineGfsEnabled', preset.sources.gfs);
  setCheckedValue('pipelineCamsEnabled', preset.sources.cams);
  setCheckedValue('pipelineOpenMeteoFallback', preset.sources.openMeteoFallback);
  showMessage(`已套用「${preset.label}」，下一步点“1 估算下载量”。`, 'success', 'pipelineConfigMsg');
}

function collectDataPipelineConfig() {
  const storagePolicy = dataPipelineConfigCache?.storagePolicy || {};
  const forecastStepHours = Number(dataPipelineConfigCache?.forecastStepHours || 1);
  return {
    ...(dataPipelineConfigCache || {}),
    mode: getInputValue('pipelineMode') || 'gfs_cams',
    regionPreset: getInputValue('pipelineRegionPreset') || 'china',
    bbox: {
      north: Number(getInputValue('pipelineBboxNorth')),
      south: Number(getInputValue('pipelineBboxSouth')),
      west: Number(getInputValue('pipelineBboxWest')),
      east: Number(getInputValue('pipelineBboxEast'))
    },
    resolution: Number(getInputValue('pipelineResolution') || 0.5),
    forecastHours: Number(getInputValue('pipelineForecastHours') || 48),
    forecastStepHours,
    sources: {
      gfs: Boolean(document.getElementById('pipelineGfsEnabled')?.checked),
      cams: Boolean(document.getElementById('pipelineCamsEnabled')?.checked),
      openMeteoFallback: Boolean(document.getElementById('pipelineOpenMeteoFallback')?.checked)
    },
    storagePolicy
  };
}

async function estimateDataPipeline(options = {}) {
  try {
    const payload = collectDataPipelineConfig();
    const res = await fetch('/api/admin/data-pipeline/estimate', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    renderDataPipelineEstimate(data.estimate || null);
    if (!options.silent) {
      showMessage(data.estimate?.safe ? '估算通过，配置在安全阈值内' : (data.error?.message || '估算未通过'), data.estimate?.safe ? 'success' : 'error', 'pipelineConfigMsg');
    }
    return { ok: res.ok, data };
  } catch (err) {
    if (!options.silent) showMessage('估算失败: ' + err.message, 'error', 'pipelineConfigMsg');
    return { ok: false, error: err };
  }
}

async function saveDataPipelineConfig() {
  try {
    const estimateResult = await estimateDataPipeline({ silent: true });
    if (!estimateResult.ok) {
      const message = estimateResult.data?.error?.message || estimateResult.error?.message || '估算未通过';
      showMessage('保存已停止: ' + message, 'error', 'pipelineConfigMsg');
      return;
    }
    const res = await fetch('/api/admin/data-pipeline/config', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(collectDataPipelineConfig())
    });
    const data = await res.json().catch(() => ({}));
    renderDataPipelineEstimate(data.estimate || null);
    if (!res.ok) throw new Error(data.error?.message || '保存失败');
    dataPipelineConfigCache = data.config || dataPipelineConfigCache;
    fillDataPipelineForm(dataPipelineConfigCache);
    showMessage('数据管线配置已保存', 'success', 'pipelineConfigMsg');
    await loadDataPipelineStatus();
  } catch (err) {
    showMessage('保存失败: ' + err.message, 'error', 'pipelineConfigMsg');
  }
}

async function saveDataPipelineConfigWithMode(mode) {
  const previousMode = getInputValue('pipelineMode') || dataPipelineConfigCache?.mode || 'gfs_cams';
  setInputValue('pipelineMode', mode);
  await saveDataPipelineConfig();
  if (mode === 'paused') return;
  if (!getInputValue('pipelineMode')) setInputValue('pipelineMode', previousMode);
}

async function pauseDataPipeline() {
  if (!confirm('确认暂停数据管线？公共地图仍会读取已有缓存。')) return;
  await saveDataPipelineConfigWithMode({ mode: 'paused' }.mode);
}

async function resumeDataPipeline() {
  const defaultResumePatch = { mode: 'gfs_cams' };
  const resumePatch = { mode: dataPipelineConfigCache?.mode && dataPipelineConfigCache.mode !== 'paused'
    ? dataPipelineConfigCache.mode
    : defaultResumePatch.mode };
  if (!confirm('确认恢复数据管线？恢复后仍需手动 run 或等待调度。')) return;
  await saveDataPipelineConfigWithMode(resumePatch.mode);
}

async function startDataPipelineRun() {
  if (!confirm('确认执行真实 GFS/CAMS run？会访问外部数据源，按当前配置分批下载并写入 cache。')) return;
  await postDataPipelineRun('/api/admin/data-pipeline/run', {
    reason: getInputValue('pipelineRunReason') || 'manual-real-run',
    dryRun: false
  }, 'pipelineRunMsg');
}

async function startDataPipelineDryRun() {
  if (!confirm('确认执行本地 dry-run？会写入一轮小样本 GFS+CAMS 产物和 run 记录，不会访问外部网络。')) return;
  await postDataPipelineRun('/api/admin/data-pipeline/run', {
    reason: getInputValue('pipelineRunReason') || 'dry-run',
    dryRun: true
  }, 'pipelineRunMsg');
}

async function startOpenMeteoGridRefresh(period) {
  const safePeriod = period === 'sunrise' ? 'sunrise' : 'sunset';
  const label = safePeriod === 'sunrise' ? '朝霞' : '晚霞';
  if (!confirm(`确认刷新 Open-Meteo ${label}网格？会拉取、插值并写入旧版 Grid 缓存。`)) return;
  try {
    const res = await fetch('/api/heatmap/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period: safePeriod })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error?.message || 'Open-Meteo 刷新启动失败');
    showMessage(data.message || `Open-Meteo ${label}刷新已启动`, 'success', 'pipelineRunMsg');
    await loadDataPipelineStatus();
  } catch (err) {
    showMessage('Open-Meteo 刷新失败: ' + err.message, 'error', 'pipelineRunMsg');
  }
}

async function retryDataPipelineRun(id) {
  if (!confirm('确认重试这个数据管线 run？')) return;
  await postDataPipelineRun(`/api/admin/data-pipeline/runs/${encodeURIComponent(id)}/retry`, {}, 'pipelineRunMsg');
}

async function cleanupDataPipeline() {
  if (!confirm('确认触发数据管线 cleanup？')) return;
  await postDataPipelineRun('/api/admin/data-pipeline/cleanup', {}, 'pipelineRunMsg');
}

async function cleanupDataPipelineDryRun() {
  await postDataPipelineRun('/api/admin/data-pipeline/cleanup', { dryRun: true }, 'pipelineRunMsg');
}

function confirmDataPipelineRollback() {
  if (!confirm('确认进入 rollback 预案？')) return;
  if (!confirm('再次确认：当前版本只会记录 rollback 意图，不会改动后端数据。')) return;
  showMessage('rollback 占位已确认：后端回滚执行器尚未接入。', 'error', 'pipelineRunMsg');
}

async function postDataPipelineRun(url, payload, targetId) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error?.message || '请求失败');
    showMessage(data.note || `已创建 run: ${data.run?.id || '--'}`, 'success', targetId);
    await Promise.all([loadDataPipelineStatus(), loadDataPipelineRuns()]);
  } catch (err) {
    showMessage('请求失败: ' + err.message, 'error', targetId);
  }
}

async function renderDataPipelineRunDetail(id) {
  try {
    const res = await fetch(`/api/admin/data-pipeline/runs/${encodeURIComponent(id)}`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || '加载 run 详情失败');
    const tbody = document.getElementById('pipelineRunStepsBody');
    const steps = data.run?.steps || [];
    if (!steps.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty">暂无步骤记录</td></tr>';
      return;
    }
    tbody.innerHTML = steps.map((step) => `
      <tr>
        <td>${escapeHtml(step.type || '-')}</td>
        <td>${escapeHtml(step.source || '-')}</td>
        <td>${renderPipelineStatusBadge(step.status)}</td>
        <td>${step.forecastHour == null ? '-' : 'f' + String(step.forecastHour).padStart(3, '0')}</td>
        <td>${formatBytes(step.bytesDownloaded || 0)}</td>
        <td class="status-err" title="${escapeHtml(step.message || '')}">${escapeHtml(step.errorCode || step.message || '-')}</td>
      </tr>
    `).join('');
  } catch (err) {
    const tbody = document.getElementById('pipelineRunStepsBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="empty">Run 详情加载失败</td></tr>';
  }
}

function renderDataPipelineStatus(data = {}) {
  const el = document.getElementById('pipelineStatusGrid');
  if (!el) return;
  const current = data.currentRun || null;
  const latest = data.latestSuccessfulRun || null;
  const today = data.today || {};
  const config = data.config || {};
  renderDataPipelineSummary(data);
  renderCacheManagementStatus(data.cacheManagement || null);
  el.innerHTML = `
    <div class="pipeline-stat"><span>方案</span><strong>${escapeHtml(config.mode || '--')}</strong></div>
    <div class="pipeline-stat"><span>范围</span><strong>${escapeHtml(config.regionPreset || '--')}</strong></div>
    <div class="pipeline-stat"><span>当前 run</span><strong>${current ? renderPipelineStatusBadge(current.status) : '--'}</strong></div>
    <div class="pipeline-stat"><span>当前进度</span><strong>${current ? getDataPipelineRunProgress(current) : '--'}</strong></div>
    <div class="pipeline-stat"><span>今日 runs</span><strong>${Number(today.runCount || 0)} / 失败 ${Number(today.failedRunCount || 0)}</strong></div>
    <div class="pipeline-stat"><span>今日下载</span><strong>${formatBytes(today.bytesDownloaded || 0)}</strong></div>
    <div class="pipeline-stat"><span>最近成功</span><strong>${latest ? escapeHtml(formatPhotoDateTime(latest.completedAt) || latest.id) : '--'}</strong></div>
    <div class="pipeline-stat"><span>失败原因</span><strong>${escapeHtml(formatDataPipelineFailure(current))}</strong></div>
  `;
}

function renderCacheManagementStatus(cacheManagement) {
  const el = document.getElementById('pipelineCacheStatusGrid');
  if (!el) return;
  if (!cacheManagement) {
    el.innerHTML = '<p class="empty">缓存状态加载中...</p>';
    return;
  }
  const active = cacheManagement.activeMap || {};
  const products = cacheManagement.pipelineProducts || {};
  const gfs = products.bySource?.gfs || {};
  const cams = products.bySource?.cams || {};
  const legacy = cacheManagement.legacyOpenMeteo || {};
  const sunrise = legacy.sunrise || {};
  const sunset = legacy.sunset || {};

  el.innerHTML = `
    <div class="pipeline-stat"><span>公开地图</span><strong>${escapeHtml(active.source || '--')} / ${escapeHtml(active.status || '--')}</strong></div>
    <div class="pipeline-stat"><span>公开模式</span><strong>${escapeHtml(active.mode || '--')}${active.degraded ? ' degraded' : ''}</strong></div>
    <div class="pipeline-stat"><span>公开缓存点</span><strong>${Number(active.pointCount || 0).toLocaleString('zh-CN')}</strong></div>
    <div class="pipeline-stat"><span>公开更新时间</span><strong>${escapeHtml(formatPhotoDateTime(active.updatedAt) || '--')}</strong></div>
    <div class="pipeline-stat"><span>GFS 产品</span><strong>${Number(gfs.productCount || 0)} / ${Number(gfs.pointCount || 0).toLocaleString('zh-CN')} 点</strong></div>
    <div class="pipeline-stat"><span>CAMS 产品</span><strong>${Number(cams.productCount || 0)} / ${Number(cams.pointCount || 0).toLocaleString('zh-CN')} 点</strong></div>
    <div class="pipeline-stat"><span>Pipeline 缓存</span><strong>${Number(products.totalProducts || 0)} 个 / ${formatBytes(products.totalBytes || 0)}</strong></div>
    <div class="pipeline-stat"><span>Open-Meteo 晚霞</span><strong>${formatLegacyCacheProgress(sunset)}</strong></div>
    <div class="pipeline-stat"><span>Open-Meteo 朝霞</span><strong>${formatLegacyCacheProgress(sunrise)}</strong></div>
    <div class="pipeline-stat"><span>降级原因</span><strong>${escapeHtml(active.degradedReason || '--')}</strong></div>
  `;
}

function formatLegacyCacheProgress(status = {}) {
  const state = status.status || (status.running ? 'running' : '--');
  const progress = status.progress || '--';
  const cache = Number(status.cacheCount || 0);
  const stale = status.cacheStale === true ? ' stale' : '';
  return `${escapeHtml(state)} ${escapeHtml(progress)} / cache ${cache}${stale}`;
}

function renderDataPipelineSummary(data = {}) {
  const config = data.config || dataPipelineConfigCache || {};
  const estimate = data.estimate || {};
  const current = data.currentRun || null;
  const latest = data.latestSuccessfulRun || null;
  const today = data.today || {};
  const modeLabel = DATA_PIPELINE_MODE_LABELS[config.mode] || config.mode || '--';
  const presetLabel = DATA_PIPELINE_PRESET_LABELS[config.regionPreset] || config.regionPreset || '--';
  setTextContent('pipelineModeBadge', modeLabel);
  setTextContent('pipelineRangeBadge', `${presetLabel} ${formatBbox(config.bbox)}`);
  setTextContent('pipelineCurrentProgress', current ? `${renderPlainStatus(current.status)} ${getDataPipelineRunProgress(current)}` : '--');
  setTextContent('pipelineLatestProduct', latest ? `${formatPhotoDateTime(latest.completedAt) || latest.id} ${formatBytes(latest.totalBytesDownloaded || 0)}` : '--');
  setTextContent('pipelineTodayDownload', formatBytes(today.bytesDownloaded || 0));
  setTextContent('pipelineFailureReason', formatDataPipelineFailure(current));
  setTextContent('pipelineDiskBudget', estimate.freeDiskBytes == null
    ? `${formatBytes(estimate.estimatedRawTmpBytes || 0)} raw/tmp`
    : `${formatBytes(estimate.freeDiskBytes)} free / ${formatBytes(estimate.estimatedRawTmpBytes || 0)} raw/tmp`);
  setTextContent('pipelineMemoryBudget', estimate.estimatedResidentMemoryMb
    ? `${estimate.estimatedResidentMemoryMb} MB worker`
    : `${config.runtimePolicy?.maxResidentMemoryMb || 512} MB worker`);
}

function formatDataPipelineFailure(run) {
  if (!run || run.status !== 'failed') return '--';
  return run.errorCode || run.message || 'failed';
}

function renderPlainStatus(status) {
  if (status === 'completed') return 'completed';
  if (status === 'failed') return 'failed';
  return status || 'unknown';
}

function formatBbox(bbox = {}) {
  if (![bbox.north, bbox.south, bbox.west, bbox.east].every((v) => Number.isFinite(Number(v)))) return '';
  return `N${bbox.north}/S${bbox.south}/W${bbox.west}/E${bbox.east}`;
}

function renderDataPipelineEstimate(estimate) {
  const el = document.getElementById('pipelineEstimateGrid');
  if (!el) return;
  if (!estimate) {
    el.innerHTML = '<p class="empty">等待估算...</p>';
    return;
  }
  const reasons = Array.isArray(estimate.reasons) && estimate.reasons.length
    ? `<div class="pipeline-reasons">${estimate.reasons.map((r) => `<span>${escapeHtml(r)}</span>`).join('')}</div>`
    : '<div class="pipeline-reasons"><span>安全阈值内</span></div>';
  el.innerHTML = `
    <div class="pipeline-stat"><span>安全性</span><strong>${estimate.safe ? '<span class="status-ok">安全</span>' : '<span class="status-err">需调整</span>'}</strong></div>
    <div class="pipeline-stat"><span>网格点</span><strong>${Number(estimate.gridPoints || 0).toLocaleString('zh-CN')}</strong></div>
    <div class="pipeline-stat"><span>预报步数</span><strong>${Number(estimate.forecastHourCount || 0)}</strong></div>
    <div class="pipeline-stat"><span>预计下载</span><strong>${formatBytes(estimate.estimatedDownloadBytes || 0)}</strong></div>
    <div class="pipeline-stat"><span>预计 raw/tmp</span><strong>${formatBytes(estimate.estimatedRawTmpBytes || 0)}</strong></div>
    <div class="pipeline-stat"><span>bbox 面积</span><strong>${Number(estimate.bboxAreaDeg2 || 0).toLocaleString('zh-CN')} deg²</strong></div>
    ${reasons}
  `;
}

function renderDataPipelineRuns(runs = []) {
  const tbody = document.getElementById('pipelineRunsBody');
  if (!tbody) return;
  if (!runs.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">暂无运行记录</td></tr>';
    return;
  }
  tbody.innerHTML = runs.map((run) => {
    const progress = getDataPipelineRunProgress(run);
    const id = escapeHtml(run.id);
    const jsId = escapeJsString(run.id);
    return `<tr>
      <td>${escapeHtml(formatPhotoDateTime(run.createdAt) || '--')}</td>
      <td>${renderPipelineStatusBadge(run.status)}</td>
      <td>${escapeHtml(run.reason || '-')}</td>
      <td>${progress}</td>
      <td>${formatBytes(run.totalBytesDownloaded || 0)}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="renderDataPipelineRunDetail('${jsId}')" title="${id}">详情</button>
        <button class="btn btn-secondary btn-sm" onclick="retryDataPipelineRun('${jsId}')">重试</button>
      </td>
    </tr>`;
  }).join('');
}

function getDataPipelineRunProgress(run = {}) {
  const steps = Array.isArray(run.steps) ? run.steps : [];
  const total = steps.length || Number(run.stepCount || 0);
  if (!total) return run.status || '--';
  const completed = steps.length
    ? steps.filter((step) => step.status === 'completed').length
    : (run.status === 'completed' ? total : 0);
  return `${completed}/${total}`;
}

function renderPipelineStatusBadge(status) {
  const value = escapeHtml(status || 'unknown');
  const ok = status === 'completed';
  const bad = status === 'failed';
  const cls = ok ? 'status-ok' : (bad ? 'status-err' : 'queue-badge-running');
  return `<span class="${cls}">${value}</span>`;
}

function setInputValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value == null ? '' : String(value);
}

function setCheckedValue(id, checked) {
  const el = document.getElementById(id);
  if (el) el.checked = Boolean(checked);
}

function setTextContent(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value == null || value === '' ? '--' : String(value);
}

function getInputValue(id) {
  return document.getElementById(id)?.value?.trim() || '';
}

function escapeJsString(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let n = bytes / 1024;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(n >= 10 ? 1 : 2)} ${units[i]}`;
}

// =================== 照片管理 ===================
async function loadPhotos() {
  try {
    const res = await fetch('/api/photos');
    const data = await res.json();
    photoCache = data.photos || [];
    renderPhotos(photoCache);
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
        <div class="photo-desc">${escapeHtml(p.locationName || p.desc || '无描述')}</div>
        <div class="photo-meta">坐标：${formatPhotoCoordinate(p)}</div>
        <div class="photo-meta">拍摄：${escapeHtml(formatPhotoDateTime(p.takenAt) || '--')}</div>
        <div class="photo-meta">上传：${escapeHtml(formatPhotoDateTime(p.uploadedAt) || '--')}</div>
        <div class="photo-meta">上传者：${escapeHtml(p.uploaderName || '--')}</div>
        <div class="photo-actions">
          <button class="btn btn-secondary btn-sm" onclick="openPhotoEditor('${p.id}')">编辑</button>
          <button class="btn btn-danger btn-sm" onclick="deletePhoto('${p.id}')">删除</button>
        </div>
      </div>
    </div>
  `).join('');
}

function formatPhotoCoordinate(photo) {
  const lat = Number(photo?.lat);
  const lon = Number(photo?.lon);
  return isValidPhotoCoordinate(lat, lon) ? `${lat.toFixed(4)}, ${lon.toFixed(4)}` : '--';
}

function formatPhotoDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

function toDateTimeLocalInput(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (num) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
  const parseAddressBtn = document.getElementById('parseAddressBtn');
  const parsePhotoCoordsBtn = document.getElementById('parsePhotoCoordsBtn');
  const parsePhotoTakenAtBtn = document.getElementById('parsePhotoTakenAtBtn');

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
    await autofillPhotoMetadataFromExif(file, gpsStatus);
  });

  parseAddressBtn?.addEventListener('click', () => parseUploadAddress(gpsStatus));
  parsePhotoCoordsBtn?.addEventListener('click', () => parseUploadPhotoCoordinates(fileInput.files?.[0], gpsStatus));
  parsePhotoTakenAtBtn?.addEventListener('click', () => parseUploadPhotoTakenAt(fileInput.files?.[0], gpsStatus));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!fileInput.files[0]) {
      showMessage('请选择照片', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('photo', fileInput.files[0]);
    const desc = document.getElementById('description').value;
    const locationName = document.getElementById('locationName')?.value?.trim() || '';
    const uploaderName = document.getElementById('uploaderName')?.value?.trim() || '';
    const takenAt = document.getElementById('takenAt')?.value || '';
    const latRaw = latInput?.value?.trim() || '';
    const lonRaw = lonInput?.value?.trim() || '';
    const lat = parseFloat(latRaw);
    const lon = parseFloat(lonRaw);
    if ((latRaw || lonRaw) && !isValidPhotoCoordinate(lat, lon)) {
      const message = '经纬度格式不正确；也可以清空坐标后直接上传。';
      showMessage(message, 'error', 'uploadFeedback');
      updateGpsStatus(gpsStatus, message, 'error');
      return;
    }
    if (desc) formData.append('description', desc);
    if (locationName) formData.append('locationName', locationName);
    if (uploaderName) formData.append('uploaderName', uploaderName);
    formData.append('takenAt', takenAt ? new Date(takenAt).toISOString() : '');
    formData.append('lat', isValidPhotoCoordinate(lat, lon) ? String(lat) : '');
    formData.append('lon', isValidPhotoCoordinate(lat, lon) ? String(lon) : '');

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

async function parseUploadAddress(statusEl) {
  const locationInput = document.getElementById('locationName');
  const query = locationInput?.value?.trim() || '';
  if (!query) {
    updateGpsStatus(statusEl, '请先填写拍摄地点，再解析地址。', 'warning');
    return;
  }

  updateGpsStatus(statusEl, '正在解析地址...');
  try {
    const res = await fetch(`/api/geocoding/search?q=${encodeURIComponent(query)}&provider=auto&limit=1`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error?.message || '地址解析失败');
    const first = Array.isArray(data.results) ? data.results[0] : null;
    const lat = Number(first?.lat);
    const lon = Number(first?.lon);
    if (!isValidPhotoCoordinate(lat, lon)) {
      updateGpsStatus(statusEl, '没有解析到可用坐标；可以换一个更完整的地址。', 'warning');
      return;
    }
    setPhotoCoordinate(lat, lon, statusEl, '地址已解析');
    if (locationInput && first?.name) locationInput.value = first.name;
  } catch (err) {
    updateGpsStatus(statusEl, `地址解析失败：${err?.message || '未知错误'}`, 'error');
  }
}

async function parseUploadPhotoCoordinates(file, statusEl) {
  if (!file) {
    updateGpsStatus(statusEl, '请先选择照片，再重新解析经纬度。', 'warning');
    return;
  }

  updateGpsStatus(statusEl, '正在重新读取照片经纬度...');
  try {
    const meta = await readPhotoExifMetadata(file);
    if (!isValidPhotoCoordinate(meta.lat, meta.lon)) {
      updateGpsStatus(statusEl, '照片里没有读取到可用经纬度；可以手动填写或清空。', 'warning');
      return;
    }
    setPhotoCoordinate(meta.lat, meta.lon, statusEl, '已重新读取位置');
    const locationInput = document.getElementById('locationName');
    const name = await reverseGeocodePhotoLocation(meta.lat, meta.lon);
    if (locationInput && name) locationInput.value = name;
    updateGpsStatus(statusEl, name ? `已重新填写经纬度和地点：${name}` : '已重新填写经纬度；未解析到地点名称。', 'success');
  } catch (err) {
    updateGpsStatus(statusEl, `读取经纬度失败：${err?.message || '未知错误'}`, 'error');
  }
}

async function parseUploadPhotoTakenAt(file, statusEl) {
  if (!file) {
    updateGpsStatus(statusEl, '请先选择照片，再重新解析拍摄时间。', 'warning');
    return;
  }

  updateGpsStatus(statusEl, '正在重新读取拍摄时间...');
  try {
    const meta = await readPhotoExifMetadata(file);
    const takenInput = document.getElementById('takenAt');
    const localValue = toDateTimeLocalInput(meta.takenAt);
    if (!takenInput || !localValue) {
      updateGpsStatus(statusEl, '照片里没有读取到拍摄时间；可以手动填写或清空。', 'warning');
      return;
    }
    takenInput.value = localValue;
    updateGpsStatus(statusEl, '已重新填写拍摄时间。', 'success');
  } catch (err) {
    updateGpsStatus(statusEl, `读取拍摄时间失败：${err?.message || '未知错误'}`, 'error');
  }
}

async function autofillPhotoGpsFromExif(file, statusEl) {
  return autofillPhotoMetadataFromExif(file, statusEl);
}

async function readPhotoExifMetadata(file) {
  if (!window.exifr?.parse && !window.exifr?.gps) {
    throw new Error('浏览器端 EXIF 读取库未加载');
  }

  const meta = window.exifr.parse ? await window.exifr.parse(file) : {};
  const gps = meta?.latitude !== undefined ? meta : await window.exifr.gps(file);
  return {
    lat: Number(gps?.latitude),
    lon: Number(gps?.longitude),
    takenAt: meta?.DateTimeOriginal || meta?.CreateDate || meta?.ModifyDate || null
  };
}

async function autofillPhotoMetadataFromExif(file, statusEl) {
  if (!file) {
    updateGpsStatus(statusEl, '选择照片后会尝试读取 EXIF 位置和拍摄时间；字段都可以留空或手动修改。');
    return;
  }

  if (!window.exifr?.parse && !window.exifr?.gps) {
    updateGpsStatus(statusEl, '浏览器端 EXIF 读取库未加载；字段可以手动填写或留空。', 'warning');
    return;
  }

  updateGpsStatus(statusEl, '正在读取照片信息...');

  try {
    const meta = await readPhotoExifMetadata(file);
    const { lat, lon, takenAt } = meta;
    const takenInput = document.getElementById('takenAt');
    const locationInput = document.getElementById('locationName');
    const filled = [];

    if (takenInput && takenAt && !takenInput.value) {
      const localValue = toDateTimeLocalInput(takenAt);
      if (localValue) {
        takenInput.value = localValue;
        filled.push('拍摄时间');
      }
    }

    if (isValidPhotoCoordinate(lat, lon)) {
      setPhotoCoordinate(lat, lon, statusEl, '已读取位置');
      filled.push('位置');
      if (locationInput && !locationInput.value.trim()) {
        const name = await reverseGeocodePhotoLocation(lat, lon);
        if (name) {
          locationInput.value = name;
          filled.push('地点');
        }
      }
      updateGpsStatus(statusEl, `已自动填写：${filled.join('、') || '照片信息'}；可继续手动修改或清空。`, 'success');
      return;
    }

    updateGpsStatus(statusEl, filled.length ? `已自动填写：${filled.join('、')}；位置可留空或手动填写。` : '没有读取到可用位置和时间；字段可以留空。', filled.length ? 'success' : 'warning');
  } catch (err) {
    updateGpsStatus(statusEl, '读取照片信息失败；字段可以手动填写或留空。', 'error');
  }
}

async function reverseGeocodePhotoLocation(lat, lon) {
  try {
    const res = await fetch(`/api/geocoding/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&provider=auto`);
    if (!res.ok) return '';
    const data = await res.json();
    return data.name || data.formattedAddress || data.address || data.locationName || '';
  } catch {
    return '';
  }
}

function openPhotoEditor(id) {
  const photo = photoCache.find(item => item.id === id);
  if (!photo) return;
  document.getElementById('editPhotoId').value = photo.id;
  document.getElementById('editPhotoDescription').value = photo.desc || '';
  document.getElementById('editPhotoLocationName').value = photo.locationName || '';
  document.getElementById('editPhotoUploaderName').value = photo.uploaderName || '';
  document.getElementById('editPhotoTakenAt').value = toDateTimeLocalInput(photo.takenAt);
  document.getElementById('editPhotoLat').value = Number.isFinite(Number(photo.lat)) ? Number(photo.lat).toFixed(6) : '';
  document.getElementById('editPhotoLon').value = Number.isFinite(Number(photo.lon)) ? Number(photo.lon).toFixed(6) : '';
  document.getElementById('photoEditFeedback')?.classList.add('hidden');
  document.getElementById('photoEditModal')?.classList.remove('hidden');
}

function closePhotoEditor() {
  document.getElementById('photoEditModal')?.classList.add('hidden');
}

function initPhotoEditForm() {
  const form = document.getElementById('photoEditForm');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = document.getElementById('editPhotoId')?.value;
    const latRaw = document.getElementById('editPhotoLat')?.value?.trim() || '';
    const lonRaw = document.getElementById('editPhotoLon')?.value?.trim() || '';
    const lat = parseFloat(latRaw);
    const lon = parseFloat(lonRaw);
    if ((latRaw || lonRaw) && !isValidPhotoCoordinate(lat, lon)) {
      showMessage('经纬度格式不正确；也可以清空坐标。', 'error', 'photoEditFeedback');
      return;
    }

    const takenAt = document.getElementById('editPhotoTakenAt')?.value || '';
    const payload = {
      description: document.getElementById('editPhotoDescription')?.value?.trim() || '',
      locationName: document.getElementById('editPhotoLocationName')?.value?.trim() || '',
      uploaderName: document.getElementById('editPhotoUploaderName')?.value?.trim() || '',
      takenAt: takenAt ? new Date(takenAt).toISOString() : '',
      lat: isValidPhotoCoordinate(lat, lon) ? lat : '',
      lon: isValidPhotoCoordinate(lat, lon) ? lon : ''
    };

    try {
      const res = await fetch(`/photos/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error?.message || '保存失败');
      showMessage('保存成功', 'success', 'photoEditFeedback');
      closePhotoEditor();
      loadPhotos();
    } catch (err) {
      showMessage('保存失败: ' + (err?.message || '未知错误'), 'error', 'photoEditFeedback');
    }
  });
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
      return `<tr>\n        <td>${escapeHtml(app.email || '-')}</td>\n        <td>${escapeHtml(app.countryRegion || '-')}</td>\n        <td>${escapeHtml(app.nickname || app.contact || '-')}</td>\n        <td>${escapeHtml(app.purpose || '-')}</td>\n        <td>\n          <select onchange="setApplicationStatus('${app.id}', this.value)">\n            ${_statusOptions(status)}\n          </select>\n        </td>\n        <td><input id="remark-${app.id}" value="${remark}" style="width: 140px;" /></td>\n        <td>${tokenId}</td>\n        <td>\n          <button class="btn btn-secondary" onclick="approveApplication('${app.id}')">审批通过并建Token</button>\n          <button class="btn btn-secondary" onclick="rejectApplication('${app.id}')">拒绝</button>\n        </td>\n      </tr>`;
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
