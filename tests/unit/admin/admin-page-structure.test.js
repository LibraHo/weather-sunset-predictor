import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(process.cwd());
const readAdminHtml = () => fs.readFileSync(path.join(ROOT, 'public/admin/index.html'), 'utf8');
const readAdminJs = () => fs.readFileSync(path.join(ROOT, 'public/admin/admin.js'), 'utf8');

describe('admin page structure', () => {
  test('admin uses home-style menu and separates major functions into panels', () => {
    const html = readAdminHtml();

    expect(html).toContain('header-top-row');
    expect(html).toContain('header-right-group');
    expect(html).toContain('home-view-menu');
    expect(html).toContain('id="home-view-menu-btn"');
    expect(html).toContain('id="home-view-menu-dropdown"');
    expect(html).toContain('admin-view-option');
    expect(html).not.toContain('admin-header');
    expect(html).not.toContain('admin-view-menu');

    ['dashboard', 'ops', 'logs', 'schedule', 'agent', 'photos'].forEach((view) => {
      expect(html).toContain(`data-admin-panel="${view}"`);
      expect(html).toContain(`data-view="${view}"`);
      expect(html).toContain(`id="admin-panel-${view}"`);
    });

    expect(html).toContain('admin-entry-grid');
    expect(html).toContain('id="kpi-share-today"');
    expect(html).toContain('id="kpi-share-total"');
  });

  test('dangerous operations live in ops panel, not dashboard', () => {
    const html = readAdminHtml();
    const opsStart = html.indexOf('id="admin-panel-ops"');
    const logsStart = html.indexOf('id="admin-panel-logs"');
    const opsHtml = html.slice(opsStart, logsStart);

    expect(opsHtml).toContain('danger-zone');
    expect(opsHtml).toContain('clearGridCache');
    expect(opsHtml).toContain('restartBackend');
  });

  test('restored new admin keeps every legacy admin capability reachable in panels', () => {
    const html = readAdminHtml();
    const js = readAdminJs();

    [
      'kpi-today-pv',
      'kpi-today-uv',
      'kpi-today-ip',
      'kpi-weather-day',
      'kpi-grid-day',
      'kpi-error-rate',
      'accessTrendChart',
      'apiHourlyChart',
      'healthGrid',
      'queueStatusGrid',
      'logTableBody',
      'dailyStatsBody',
      'scheduleJobs',
      'tokenCreateForm',
      'tokenTableBody',
      'applicationTableBody',
      'agentUsageTableBody',
      'auditLogTableBody',
      'uploadForm',
      'photoGrid',
    ].forEach((id) => expect(html).toContain(`id="${id}"`));

    [
      'loadAccessStats',
      'loadHealth',
      'loadQueue',
      'loadLogs',
      'loadDailyStats',
      'loadSchedule',
      'loadTokens',
      'loadApplications',
      'loadAgentUsageStats',
      'loadAuditLogs',
      'loadPhotos',
      'clearGridCache',
      'triggerRefresh',
      'restartBackend',
    ].forEach((fn) => expect(js).toContain(`function ${fn}`));
  });

  test('does not fall back to the old emoji long-page admin shell', () => {
    const html = readAdminHtml();

    expect(html).not.toContain('🧰 运维工具箱');
    expect(html).not.toContain('📤 上传新照片');
    expect(html).not.toContain('📷 已上传照片');
    expect(html).not.toContain('🔑 API Token 管理');
    expect(html).not.toContain('📋 API 调用日志');
  });
});
