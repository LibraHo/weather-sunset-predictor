import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(process.cwd());
const readAdminHtml = () => fs.readFileSync(path.join(ROOT, 'public/admin/index.html'), 'utf8');
const readAdminJs = () => fs.readFileSync(path.join(ROOT, 'public/admin/admin.js'), 'utf8');
const readAdminCss = () => fs.readFileSync(path.join(ROOT, 'public/admin/admin.css'), 'utf8');

function getSectionParents(html) {
  const parents = {};
  const stack = [];
  const tagRegex = /<\/?section\b[^>]*>/gi;
  let match;
  while ((match = tagRegex.exec(html))) {
    const tag = match[0];
    if (tag.startsWith('</')) {
      stack.pop();
      continue;
    }
    const id = tag.match(/id="([^"]+)"/)?.[1] || '';
    if (id) parents[id] = stack.at(-1)?.id || null;
    stack.push({ id });
  }
  return { parents, stack };
}

describe('admin page structure', () => {
  test('admin uses console shell navigation and separates major functions into panels', () => {
    const html = readAdminHtml();
    const { parents, stack } = getSectionParents(html);

    expect(html).toContain('class="admin-shell"');
    expect(html).toContain('class="admin-sidebar"');
    expect(html).toContain('class="admin-nav"');
    expect(html).toContain('class="admin-workspace"');
    expect(html).toContain('id="admin-page-title"');
    expect(html).toContain('id="admin-page-subtitle"');
    expect(html).toContain('admin-view-option');
    expect(html).toContain('admin-header');
    expect(html).not.toContain('home-view-menu');
    expect(html).not.toContain('id="home-view-menu-btn"');

    ['dashboard', 'visitors', 'ops', 'logs', 'agent', 'photos'].forEach((view) => {
      expect(html).toContain(`data-admin-panel="${view}"`);
      expect(html).toContain(`data-view="${view}"`);
      expect(html).toContain(`id="admin-panel-${view}"`);
    });
    expect(html).toContain('id="admin-panel-schedule"');
    expect(html).toContain('id="admin-panel-data-pipeline"');
    expect(html).toContain('data-admin-panel="ops"');
    expect(html).not.toContain('data-view="schedule"');
    expect(html).not.toContain('data-view="data-pipeline"');
    expect(html).toContain('队列、定时、数据管线');

    expect(html).not.toContain('admin-entry-grid');
    expect(html).toContain('id="kpi-share-today"');
    expect(html).toContain('id="kpi-share-total"');
    expect(stack).toHaveLength(0);
    expect(parents['admin-panel-logs']).toBeNull();
    expect(parents['admin-panel-agent']).toBeNull();
    expect(parents['admin-panel-photos']).toBeNull();
    expect(parents['admin-panel-data-pipeline']).toBe('admin-panel-ops');
  });

  test('mobile admin navigation exposes every main panel without horizontal scrolling', () => {
    const css = readAdminCss();
    const mobileStart = css.indexOf('@media (max-width: 768px)');
    const mobileCss = css.slice(mobileStart);

    expect(mobileCss).toContain('.admin-nav');
    expect(mobileCss).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(mobileCss).toContain('overflow: visible');
    expect(mobileCss).toContain('.admin-nav-item');
    expect(mobileCss).toContain('min-width: 0');
    expect(mobileCss).toContain('.admin-nav-item small');
    expect(mobileCss).toContain('display: none');
  });

  test('mobile photo management keeps thumbnails visible in narrow layouts', () => {
    const css = readAdminCss();
    const js = readAdminJs();
    const mobileStart = css.indexOf('@media (max-width: 768px)');
    const mobileCss = css.slice(mobileStart);

    expect(css).toContain('.photo-grid');
    expect(css).toContain('min-width: 0');
    expect(css).toContain('.photo-thumb');
    expect(css).toContain('display: block');
    expect(css).toContain('min-height: 160px');
    expect(css).toContain('aspect-ratio: 1 / 1');
    expect(css).toContain('.photo-thumb-placeholder');
    expect(mobileCss).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
    expect(js).toContain('function renderPhotoThumb');
    expect(js).toContain('photo?.thumbUrl || photo?.url || photo?.originalUrl');
    expect(js).toContain('loading="lazy" decoding="async"');
  });

  test('admin panels rely on the workspace header instead of repeating page introductions', () => {
    const html = readAdminHtml();
    const css = readAdminCss();

    expect(html).toContain('class="admin-header"');
    expect(html).toContain('id="admin-page-title"');
    expect(html).toContain('id="admin-page-subtitle"');
    expect(html).not.toContain('class="admin-page-intro"');
    expect(html).not.toContain('admin-page-hero card');
    expect(css).not.toContain('.admin-page-intro');
    expect(css).not.toContain('.admin-page-hero');
  });

  test('dangerous operations live in ops panel, not dashboard', () => {
    const html = readAdminHtml();
    const opsStart = html.indexOf('id="admin-panel-ops"');
    const agentStart = html.indexOf('id="admin-panel-agent"');
    const opsHtml = html.slice(opsStart, agentStart);

    expect(opsHtml).toContain('danger-zone');
    expect(opsHtml).toContain('clearGridCache');
    expect(opsHtml).toContain('restartBackend');
  });

  test('ops center combines operations, schedule, and data pipeline into one navigation target', () => {
    const html = readAdminHtml();
    const js = readAdminJs();
    const opsStart = html.indexOf('id="admin-panel-ops"');
    const agentStart = html.indexOf('id="admin-panel-agent"');
    const opsHtml = html.slice(opsStart, agentStart);

    expect(html).toContain('运维中心');
    expect(html).toContain('Grid 队列状态');
    expect(html).toContain('访问防护');
    expect(html).toContain('定时任务跟随当前方案');
    expect(html).toContain('数据管线');
    expect(opsHtml).toContain('class="ops-center-nav"');
    expect(opsHtml).toContain('href="#ops-status"');
    expect(opsHtml).toContain('href="#ops-mode"');
    expect(opsHtml).toContain('href="#ops-queue"');
    expect(opsHtml).toContain('href="#ops-schedule"');
    expect(opsHtml).toContain('href="#ops-config"');
    expect(opsHtml).toContain('href="#ops-danger"');
    expect(opsHtml).toContain('id="ops-status"');
    expect(opsHtml).toContain('id="ops-mode"');
    expect(opsHtml).toContain('id="ops-queue"');
    expect(opsHtml).toContain('id="admin-panel-schedule"');
    expect(opsHtml).toContain('id="admin-panel-data-pipeline"');
    expect(opsHtml).toContain('id="ops-config"');
    expect(opsHtml).toContain('id="ops-danger"');
    expect(html).not.toContain('<p class="admin-eyebrow">Schedule</p><h1>定时更新配置</h1>');
    expect(html).not.toContain('<p class="admin-eyebrow">Data Pipeline</p><h1>GFS+CAMS 数据管线</h1>');
    expect(js).toContain("schedule: 'ops'");
    expect(js).toContain("'data-pipeline': 'ops'");
    expect(js).toContain('loadQueue(), loadHealth(), loadSchedule(), loadDataPipeline(), loadAccessGuard()');
  });

  test('ops center includes access guard status, block list, and controls', () => {
    const html = readAdminHtml();
    const js = readAdminJs();

    [
      'accessGuardSummary',
      'accessGuardConfigForm',
      'accessGuardEnabled',
      'accessGuardPerMinuteLimit',
      'accessGuardRollingLimit',
      'accessGuardSuspiciousPathLimit',
      'accessGuardBlockMinutes',
      'accessGuardIpInput',
      'accessGuardMsg',
      'accessGuardBlockedBody',
      'accessGuardRecentBody',
      'accessGuardEventsBody',
    ].forEach((id) => expect(html).toContain(`id="${id}"`));

    expect(html).toContain('自动拦截过量访问和敏感路径扫描');
    expect(html).toContain('保存防护配置');
    expect(html).toContain('封禁 IP');
    expect(js).toContain("fetch('/admin/access-guard'");
    expect(js).toContain("fetch('/admin/access-guard/config'");
    expect(js).toContain("fetch('/admin/access-guard/block'");
    expect(js).toContain("fetch('/admin/access-guard/unblock'");
    expect(js).toContain('function loadAccessGuard');
    expect(js).toContain('function saveAccessGuardConfig');
    expect(js).toContain('function blockAccessGuardIp');
    expect(js).toContain('function unblockAccessGuardIp');
    expect(js).toContain('accessGuardConfigDirty');
    expect(js).toContain("form.addEventListener('input'");
    expect(js).toContain('document.activeElement');
    expect(js).toContain('forceConfig');
  });

  test('ops center keeps dangerous operations below normal status and run workflows', () => {
    const html = readAdminHtml();
    const opsStart = html.indexOf('id="admin-panel-ops"');
    const agentStart = html.indexOf('id="admin-panel-agent"');
    const opsHtml = html.slice(opsStart, agentStart);

    const statusIndex = opsHtml.indexOf('id="ops-status"');
    const modeIndex = opsHtml.indexOf('id="ops-mode"');
    const queueIndex = opsHtml.indexOf('id="ops-queue"');
    const scheduleIndex = opsHtml.indexOf('id="admin-panel-schedule"');
    const pipelineIndex = opsHtml.indexOf('id="admin-panel-data-pipeline"');
    const configIndex = opsHtml.indexOf('id="ops-config"');
    const dangerIndex = opsHtml.indexOf('id="ops-danger"');

    [statusIndex, pipelineIndex, modeIndex, queueIndex, scheduleIndex, configIndex, dangerIndex].forEach((index) => {
      expect(index).toBeGreaterThanOrEqual(0);
    });
    expect(statusIndex).toBeLessThan(pipelineIndex);
    expect(pipelineIndex).toBeLessThan(modeIndex);
    expect(modeIndex).toBeLessThan(queueIndex);
    expect(queueIndex).toBeLessThan(scheduleIndex);
    expect(scheduleIndex).toBeLessThan(configIndex);
    expect(configIndex).toBeLessThan(dangerIndex);

    const statusHtml = opsHtml.slice(statusIndex, pipelineIndex);
    const dangerHtml = opsHtml.slice(dangerIndex);
    expect(statusHtml).not.toContain('restartBackend');
    expect(statusHtml).not.toContain('clearGridCache');
    expect(dangerHtml).toContain('restartBackend');
    expect(dangerHtml).toContain('clearGridCache');
    expect(dangerHtml).toContain('cleanupDataPipeline');
    expect(dangerHtml).toContain('confirmDataPipelineRollback');
  });

  test('ops internal anchors only suppress hash replacement while staying in ops', () => {
    const js = readAdminJs();

    expect(js).toContain("activeAdminView === 'ops' && OPS_INTERNAL_ANCHORS.has(currentHash)");
    expect(js).not.toContain("currentHash !== activeAdminView && !OPS_INTERNAL_ANCHORS.has(currentHash)");
  });

  test('data pipeline separates status, config, run controls, danger actions, and history', () => {
    const html = readAdminHtml();
    const pipelineStart = html.indexOf('id="admin-panel-data-pipeline"');
    const agentStart = html.indexOf('id="admin-panel-agent"');
    const pipelineHtml = html.slice(pipelineStart, agentStart);

    ['切换当前方案', '任务队列', '定时任务跟随当前方案', '方案参数', 'Danger Zone'].forEach((label) => {
      expect(pipelineHtml).toContain(label);
    });

    const runStart = pipelineHtml.indexOf('任务队列');
    const dangerStart = pipelineHtml.indexOf('Danger Zone');
    const runHtml = pipelineHtml.slice(runStart, dangerStart);
    const dangerHtml = pipelineHtml.slice(dangerStart);

    expect(runHtml).toContain('startOpenMeteoGridRefresh');
    expect(runHtml).toContain('startDataPipelineDryRun');
    expect(runHtml).toContain('startDataPipelineRun');
    expect(runHtml).not.toContain('confirmDataPipelineRollback');
    expect(dangerHtml).toContain('cleanupDataPipeline');
    expect(dangerHtml).toContain('cleanupDataPipelineDryRun');
    expect(dangerHtml).toContain('confirmDataPipelineRollback');
  });

  test('ops data workspace separates scheme, queues, schedule, and scheme-specific config', () => {
    const html = readAdminHtml();
    const js = readAdminJs();
    const pipelineStart = html.indexOf('id="admin-panel-data-pipeline"');
    const dangerStart = html.indexOf('id="ops-danger"');
    const pipelineHtml = html.slice(pipelineStart, dangerStart);

    [
      'id="ops-mode"',
      'id="ops-queue"',
      'id="ops-schedule"',
      'id="ops-config"',
      'id="legacy-openmeteo-panel"',
      'id="new-gfs-cams-panel"',
      'id="pipeline-new-config-panel"',
      'id="pipeline-legacy-config-panel"',
      'id="pipelineRunStepsBody"',
    ].forEach((token) => expect(pipelineHtml).toContain(token));

    expect(pipelineHtml.indexOf('id="ops-mode"')).toBeLessThan(pipelineHtml.indexOf('id="ops-queue"'));
    expect(pipelineHtml.indexOf('id="ops-queue"')).toBeLessThan(pipelineHtml.indexOf('id="ops-schedule"'));
    expect(pipelineHtml.indexOf('id="ops-schedule"')).toBeLessThan(pipelineHtml.indexOf('id="ops-config"'));

    expect(pipelineHtml).toContain('切换当前方案');
    expect(pipelineHtml).toContain('old / Open-Meteo');
    expect(pipelineHtml).toContain('new / GFS+CAMS');
    expect(pipelineHtml).toContain('任务队列');
    expect(pipelineHtml).toContain('失败原因 / 本地处理');
    expect(pipelineHtml).toContain('定时任务跟随当前方案');
    expect(pipelineHtml).toContain('old 参数');
    expect(pipelineHtml).toContain('new 参数');

    const legacyPanel = pipelineHtml.slice(
      pipelineHtml.indexOf('id="pipeline-legacy-config-panel"'),
      pipelineHtml.indexOf('id="pipeline-new-config-panel"')
    );
    const newPanel = pipelineHtml.slice(pipelineHtml.indexOf('id="pipeline-new-config-panel"'));
    expect(legacyPanel).toContain('Open-Meteo');
    expect(legacyPanel).not.toContain('pipelineRegionPreset');
    expect(legacyPanel).not.toContain('pipelineGfsEnabled');
    expect(newPanel).toContain('pipelineRegionPreset');
    expect(newPanel).toContain('pipelineGfsEnabled');
    expect(newPanel).toContain('pipelineCamsEnabled');

    [
      'ops-status',
      'ops-guard',
      'ops-mode',
      'ops-queue',
      'ops-schedule',
      'ops-pipeline',
      'ops-config',
      'ops-history',
      'ops-danger',
    ].forEach((anchor) => expect(js).toContain(`'${anchor}'`));
    expect(js).toContain('function selectDataPipelineMode');
    expect(js).toContain('renderDataPipelineScheme');
    expect(js).toContain('renderSchemeScopedQueues');
  });

  test('admin console design document captures the new framework', () => {
    const doc = fs.readFileSync(path.join(ROOT, 'docs/admin-console-design.md'), 'utf8');

    expect(doc).toContain('persistent navigation shell');
    expect(doc).toContain('数据管线');
    expect(doc).toContain('Danger Zone');
    expect(doc).toContain('preserve existing DOM IDs');
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
    expect(js).toContain("const ADMIN_VIEWS = new Set(['dashboard', 'visitors', 'ops', 'logs', 'agent', 'photos'])");
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
      'pipelineCacheStatusGrid',
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
      'renderCacheManagementStatus',
      'startOpenMeteoGridRefresh',
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
      '/api/heatmap/refresh',
    ].forEach((endpoint) => expect(js).toContain(endpoint));

    expect(html).toContain('GFS+CAMS');
    expect(html).toContain('dry-run');
    expect(html).toContain('cleanupDataPipeline');
    expect(js).toContain('loadDataPipelineStatus(), loadDataPipelineRuns()');
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
      '<option value="china_japan_korea">中国 + 日本 + 韩国</option>',
      '<option value="japan">日本</option>',
      '<option value="south_korea">韩国</option>',
      '<option value="east_asia">东亚</option>',
      '<option value="test_small">小范围测试</option>',
      '<option value="custom_bbox">自定义地理边界</option>',
    ].forEach((option) => expect(html).toContain(option));

    [
      'pauseDataPipeline',
      'resumeDataPipeline',
      'cleanupDataPipelineDryRun',
      'confirmDataPipelineRollback',
      'saveDataPipelineConfigWithMode',
      'applyDataPipelinePreset',
      'renderDataPipelineSummary',
      'formatDataPipelineFailure',
      'formatBbox',
    ].forEach((fn) => expect(js).toContain(`function ${fn}`));

    [
      '切换当前方案',
      'old / Open-Meteo',
      'new / GFS+CAMS',
      '任务队列',
      '定时任务跟随当前方案',
      '方案参数',
      '业务覆盖范围',
      '不规则区域',
      'pipelineRegionChina',
      'pipelineRegionJapan',
      'pipelineRegionKorea',
      'old 固定 1°',
      '地理边界高级设置',
      '北边界',
      '南边界',
      '西边界',
      '东边界',
      '估算 new 下载量',
      '保存 new 参数',
      'dry-run 本地处理',
      '启动真实 run',
    ].forEach((copy) => expect(html).toContain(copy));

    expect(js).toContain('DATA_PIPELINE_RECOMMENDED_PRESETS');
    expect(js).toContain("showMessage(`已套用「${preset.label}」，下一步点“1 估算下载量”。`");
    expect(js).toContain('await estimateDataPipeline({ silent: true })');
    expect(js).toContain("mode: 'paused'");
    expect(js).toContain("mode: 'gfs_cams'");
    expect(js).toContain('dryRun: true');
    expect(js).toContain("confirm('确认进入 rollback 预案？')");
    expect(js).toContain("confirm('再次确认：当前版本只会记录 rollback 意图，不会改动后端数据。')");
    expect(css).toContain('.pipeline-mode-grid');
    expect(css).toContain('.pipeline-scheme-grid');
    expect(css).toContain('.pipeline-preset-btn');
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
