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

    ['dashboard', 'visitors', 'ops', 'logs', 'schedule', 'data-pipeline', 'agent', 'photos'].forEach((view) => {
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
      'clientStatsBody',
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
    expect(js).toContain("const ADMIN_VIEWS = new Set(['dashboard', 'visitors', 'ops', 'logs', 'schedule', 'data-pipeline', 'agent', 'photos'])");
    expect(js).toContain("fetch('/admin/visitor-records?'");
    expect(js).toContain('renderClientStats');
    expect(html).toContain('visitor-ip-table');
    expect(html).toContain('visitor-record-table');
    expect(js).toContain('class="visitor-path-cell"');
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

  test('data pipeline panel manages GFS+CAMS config, estimates, runs, and cleanup', () => {
    const html = readAdminHtml();
    const js = readAdminJs();

    [
      'pipelineMode',
      'pipelineRegionPreset',
      'pipelineBboxNorth',
      'pipelineBboxSouth',
      'pipelineBboxWest',
      'pipelineBboxEast',
      'pipelineResolution',
      'pipelineForecastHours',
      'pipelineGfsEnabled',
      'pipelineCamsEnabled',
      'pipelineOpenMeteoFallback',
      'pipelineStatusGrid',
      'pipelineEstimateGrid',
      'pipelineRunReason',
      'pipelineRunsBody',
      'pipelineRunStepsBody',
      'pipelineConfigMsg',
      'pipelineRunMsg',
    ].forEach((id) => expect(html).toContain(`id="${id}"`));

    [
      'loadDataPipeline',
      'loadDataPipelineStatus',
      'loadDataPipelineConfig',
      'loadDataPipelineRuns',
      'estimateDataPipeline',
      'saveDataPipelineConfig',
      'startDataPipelineRun',
      'startDataPipelineDryRun',
      'retryDataPipelineRun',
      'cleanupDataPipeline',
      'renderDataPipelineStatus',
      'renderDataPipelineRuns',
      'renderDataPipelineRunDetail',
      'collectDataPipelineConfig',
      'formatBytes',
    ].forEach((fn) => expect(js).toContain(`function ${fn}`));

    [
      '/api/admin/data-pipeline/status',
      '/api/admin/data-pipeline/config',
      '/api/admin/data-pipeline/estimate',
      '/api/admin/data-pipeline/run',
      '/api/admin/data-pipeline/runs?limit=20',
      '/api/admin/data-pipeline/cleanup',
      '/api/admin/data-pipeline/runs/',
    ].forEach((endpoint) => expect(js).toContain(endpoint));

    expect(html).toContain('GFS+CAMS');
    expect(html).toContain('dry-run');
    expect(html).toContain('cleanupDataPipeline');
    expect(js).toContain("case 'data-pipeline'");
    expect(js).toContain("activeAdminView === 'data-pipeline'");
  });

  test('data pipeline admin exposes 53.13-53.15 operations and budget fields', () => {
    const html = readAdminHtml();
    const js = readAdminJs();
    const css = fs.readFileSync(path.join(ROOT, 'public/admin/admin.css'), 'utf8');

    [
      'pipelineModeBadge',
      'pipelineRangeBadge',
      'pipelineCurrentProgress',
      'pipelineLatestProduct',
      'pipelineTodayDownload',
      'pipelineFailureReason',
      'pipelineDiskBudget',
      'pipelineMemoryBudget',
      'pipelineEstimateNotice',
      'pipelinePauseBtn',
      'pipelineResumeBtn',
      'pipelineCleanupDryRunBtn',
      'pipelineRollbackBtn',
    ].forEach((id) => expect(html).toContain(`id="${id}"`));

    [
      '<option value="china">中国</option>',
      '<option value="east_asia">东亚</option>',
      '<option value="test_small">小范围测试</option>',
      '<option value="custom_bbox">自定义 bbox</option>',
    ].forEach((option) => expect(html).toContain(option));

    [
      'pauseDataPipeline',
      'resumeDataPipeline',
      'cleanupDataPipelineDryRun',
      'confirmDataPipelineRollback',
      'saveDataPipelineConfigWithMode',
      'renderDataPipelineSummary',
      'formatDataPipelineFailure',
      'formatBbox',
    ].forEach((fn) => expect(js).toContain(`function ${fn}`));

    expect(js).toContain('await estimateDataPipeline({ silent: true })');
    expect(js).toContain("mode: 'paused'");
    expect(js).toContain("mode: 'gfs_cams'");
    expect(js).toContain('dryRun: true');
    expect(js).toContain("confirm('确认进入 rollback 预案？')");
    expect(js).toContain("confirm('再次确认：当前版本只会记录 rollback 意图，不会改动后端数据。')");
    expect(css).toContain('.pipeline-summary-grid');
    expect(css).toContain('.pipeline-danger-actions');
    expect(css).toContain('overflow-wrap: anywhere');
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

  test('visitor record tables stay inside mobile admin cards', () => {
    const html = readAdminHtml();
    const js = readAdminJs();
    const css = fs.readFileSync(path.join(ROOT, 'public/admin/admin.css'), 'utf8');

    expect(html).toContain('class="admin-table visitor-ip-table"');
    expect(html).toContain('class="admin-table visitor-record-table"');
    expect(js).toContain('class="visitor-path-cell"');
    expect(css).toContain('.two-col > *');
    expect(css).toContain('min-width: 0');
    expect(css).toContain('max-width: 100%');
    expect(css).toContain('overflow: auto');
    expect(css).toContain('.visitor-record-table');
    expect(css).toContain('min-width: 720px');
    expect(css).toContain('.visitor-path-cell');
    expect(css).toContain('overflow-wrap: anywhere');
  });
});
