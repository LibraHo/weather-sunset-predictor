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
    expect(html).toContain('admin-header');
    expect(html).not.toContain('admin-view-menu');

    ['dashboard', 'visitors', 'ops', 'logs', 'schedule', 'agent', 'photos'].forEach((view) => {
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
      'visitorDate',
      'visitorIpBody',
      'visitorRecordBody',
      'logTableBody',
      'dailyStatsBody',
      'scheduleJobs',
      'tokenCreateForm',
      'tokenTableBody',
      'applicationTableBody',
      'agentUsageTableBody',
      'auditLogTableBody',
      'uploadForm',
      'photoFile',
      'selectedPhotoName',
      'uploadProgress',
      'uploadProgressBar',
      'uploadProgressText',
      'uploadFeedback',
      'photoGpsStatus',
      'parseAddressBtn',
      'parsePhotoCoordsBtn',
      'parsePhotoTakenAtBtn',
      'photoGrid',
      'photoEditModal',
      'photoEditForm',
      'editPhotoId',
    ].forEach((id) => expect(html).toContain(`id="${id}"`));

    [
      'loadAccessStats',
      'loadHealth',
      'loadQueue',
      'loadVisitorRecords',
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
      'isValidPhotoCoordinate',
      'setPhotoCoordinate',
      'parseUploadAddress',
      'parseUploadPhotoCoordinates',
      'parseUploadPhotoTakenAt',
      'readPhotoExifMetadata',
      'autofillPhotoGpsFromExif',
      'autofillPhotoMetadataFromExif',
      'reverseGeocodePhotoLocation',
      'initPhotoEditForm',
      'openPhotoEditor',
      'closePhotoEditor',
      'uploadPhotoWithProgress',
    ].forEach((fn) => expect(js).toContain(`function ${fn}`));

    expect(js).toContain("fileInput.addEventListener('change'");
    expect(js).toContain('已选择：${file.name}');
    expect(js).toContain("selectedName.textContent = '尚未选择照片'");
    expect(html).toContain('纬度（可选）');
    expect(html).toContain('经度（可选）');
    expect(html).toContain('解析地址');
    expect(html).toContain('解析经纬度');
    expect(html).toContain('解析拍摄时间');
    expect(html).toContain('字段都可以留空或手动修改');
    expect(html).toContain('访客记录');
    expect(html).toContain('日期（北京时间）');
    expect(js).toContain("const ADMIN_VIEWS = new Set(['dashboard', 'visitors', 'ops', 'logs', 'schedule', 'agent', 'photos'])");
    expect(js).toContain("fetch('/admin/visitor-records?'");
    expect(js).toContain('getBeijingDateInputValue');
    expect(html).toContain('编辑照片信息');
    expect(html).not.toContain('在地图上选择位置');
    expect(html).not.toContain('leaflet@1.9.4');
    expect(js).toContain('window.exifr.parse(file)');
    expect(js).toContain('/api/geocoding/reverse');
    expect(js).not.toContain('位置是必填项');
    expect(js).toContain("showMessage(message, 'error', 'uploadFeedback')");
    expect(js).not.toContain('window.L.map');
    expect(js).toContain("浏览器端 EXIF 读取库未加载");
    expect(js).toContain("xhr.upload.addEventListener('progress'");
    expect(js).toContain("showMessage('上传成功', 'success', 'uploadFeedback')");
    expect(js).toContain("showMessage('上传失败: ' + message, 'error', 'uploadFeedback')");
  });

  test('does not fall back to the old emoji long-page admin shell', () => {
    const html = readAdminHtml();

    expect(html).not.toContain('🧰 运维工具箱');
    expect(html).not.toContain('📤 上传新照片');
    expect(html).not.toContain('📷 已上传照片');
    expect(html).not.toContain('🔑 API Token 管理');
    expect(html).not.toContain('📋 API 调用日志');
  });

  test('queue status summarizes raw provider errors before rendering', () => {
    const js = readAdminJs();
    const css = fs.readFileSync(path.join(ROOT, 'public/admin/admin.css'), 'utf8');

    expect(js).toContain('function summarizeQueueError');
    expect(js).toContain('Open-Meteo Batch API 错误');
    expect(js).toContain('message.length > 96');
    expect(js).toContain('title="${escapeHtml(String(item.lastError))}"');
    expect(js).not.toContain('${escapeHtml(item.lastError)}</div>');
    expect(css).toContain('overflow-wrap: anywhere');
  });
});
