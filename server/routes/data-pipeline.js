'use strict';

const express = require('express');
const DataPipelineConfigService = require('../services/DataPipelineConfigService');
const DataPipelineRunLogService = require('../services/DataPipelineRunLogService');
const DataPipelineCleanupService = require('../services/DataPipelineCleanupService');
const DataPipelineWorkerService = require('../services/DataPipelineWorkerService');
const GridProductCacheService = require('../services/GridProductCacheService');

function countPoints(cache) {
  return Array.isArray(cache?.gridPoints) ? cache.gridPoints.length : 0;
}

function summarizeLegacyJobStatus(status = {}) {
  const totalPoints = Number(status.totalPoints || 0);
  const completedPoints = Number(status.completedPoints || 0);
  const cacheCount = Number(status.cacheCount || 0);
  const running = status.running === true;
  return {
    period: status.period || null,
    status: running ? 'running' : (cacheCount > 0 ? 'ready' : 'not-ready'),
    running,
    progress: totalPoints > 0 ? `${completedPoints}/${totalPoints}` : (cacheCount > 0 ? `${cacheCount} cache` : '0/0'),
    totalPoints,
    completedPoints,
    totalBatches: Number(status.totalBatches || 0),
    completedBatches: Number(status.completedBatches || 0),
    cacheUpdatedAt: status.cacheUpdatedAt || null,
    cacheCount,
    cacheStale: status.cacheStale ?? null,
    lastError: status.lastError || null
  };
}

function summarizeProductManifest(productCacheService) {
  let products = [];
  try {
    products = productCacheService.listManifest().products || [];
  } catch (_) {
    products = [];
  }
  const bySource = {};
  let totalBytes = 0;

  for (const item of products) {
    const source = item.source || 'unknown';
    totalBytes += Number(item.byteSize || 0);
    if (!bySource[source]) {
      bySource[source] = {
        productCount: 0,
        pointCount: 0,
        latestCreatedAt: null,
        latestCycle: null
      };
    }
    bySource[source].productCount += 1;
    bySource[source].pointCount += Number(item.pointCount || 0);
    if (!bySource[source].latestCreatedAt || String(item.createdAt || '') > bySource[source].latestCreatedAt) {
      bySource[source].latestCreatedAt = item.createdAt || null;
      bySource[source].latestCycle = item.cycle || null;
    }
  }

  return {
    totalProducts: products.length,
    totalBytes,
    bySource,
    latestProducts: products.slice(0, 6).map(item => ({
      productId: item.productId,
      source: item.source,
      productType: item.productType,
      cycle: item.cycle || null,
      forecastHour: Number.isFinite(item.forecastHour) ? item.forecastHour : null,
      forecastHours: Array.isArray(item.forecastHours) ? item.forecastHours.slice() : null,
      pointCount: Number(item.pointCount || 0),
      byteSize: Number(item.byteSize || 0),
      createdAt: item.createdAt || null
    }))
  };
}

function buildCacheManagementStatus({ config, currentRun, gridService, productCacheService }) {
  const period = 'sunset';
  const active = typeof gridService.getPublicMapCache === 'function'
    ? gridService.getPublicMapCache(period)
    : { mode: config.mode, status: 'not-ready', cache: null };
  const activeCache = active.cache || null;
  const sunrise = typeof gridService.getJobStatus === 'function'
    ? gridService.getJobStatus('sunrise')
    : { period: 'sunrise' };
  const sunset = typeof gridService.getJobStatus === 'function'
    ? gridService.getJobStatus('sunset')
    : { period: 'sunset' };

  return {
    activeMap: {
      period,
      mode: active.mode || config.mode || null,
      status: active.status || (activeCache ? 'ready' : 'not-ready'),
      source: activeCache?.source || null,
      pointCount: countPoints(activeCache),
      updatedAt: activeCache?.updatedAt || null,
      stale: activeCache?.stale ?? null,
      degraded: activeCache?.degraded === true,
      degradedReason: activeCache?.degradedReason || active.degradedReason || null
    },
    pipelineRun: {
      id: currentRun?.id || null,
      status: currentRun?.status || null,
      progress: currentRun ? `${(currentRun.steps || []).filter(step => step.status === 'completed').length}/${(currentRun.steps || []).length || currentRun.stepCount || 0}` : null,
      bytesDownloaded: Number(currentRun?.totalBytesDownloaded || 0),
      reason: currentRun?.reason || null,
      errorCode: currentRun?.errorCode || null,
      message: currentRun?.message || null
    },
    pipelineProducts: summarizeProductManifest(productCacheService),
    legacyOpenMeteo: {
      sunrise: summarizeLegacyJobStatus(sunrise),
      sunset: summarizeLegacyJobStatus(sunset)
    },
    switching: {
      currentMode: config.mode || null,
      modes: ['hybrid', 'gfs_cams', 'openmeteo', 'cache_only', 'paused']
    }
  };
}

function createRouter(deps = {}) {
  const router = express.Router();
  const configService = deps.configService || new DataPipelineConfigService();
  const runLogService = deps.runLogService || new DataPipelineRunLogService();
  const cleanupService = deps.cleanupService || new DataPipelineCleanupService({
    dataDir: configService.dataDir,
    runLogService
  });
  const workerService = deps.workerService || new DataPipelineWorkerService({
    dataDir: configService.dataDir,
    runLogService,
    freeDiskBytes: configService.freeDiskBytes
  });
  const gridService = deps.gridService || require('../services/GridScoreService');
  const productCacheService = deps.productCacheService || new GridProductCacheService({
    dataDir: configService.dataDir,
    freeDiskBytes: configService.freeDiskBytes
  });

  router.get('/config', (req, res) => {
    res.json({ success: true, config: configService.getConfig() });
  });

  router.post('/config', (req, res) => {
    try {
      const config = configService.saveConfig(req.body || {});
      res.json({ success: true, config, estimate: configService.estimate(config) });
    } catch (err) {
      res.status(400).json({
        error: { code: err.code || 'DATA_PIPELINE_CONFIG_INVALID', message: err.message },
        estimate: err.estimate || null
      });
    }
  });

  router.post('/estimate', (req, res) => {
    const estimate = configService.estimate(req.body || configService.getConfig());
    if (!estimate.safe) {
      return res.status(400).json({
        error: { code: 'DATA_PIPELINE_UNSAFE_CONFIG', message: estimate.reasons.join('; ') },
        estimate
      });
    }
    return res.json({ success: true, estimate });
  });

  router.get('/status', (req, res) => {
    const config = configService.getConfig();
    const currentRun = runLogService.getLatestRun();
    res.json({
      success: true,
      config,
      estimate: configService.estimate(config),
      currentRun,
      latestSuccessfulRun: runLogService.getLatestSuccessfulRun(),
      today: runLogService.getDailyStats(),
      cacheManagement: buildCacheManagementStatus({
        config,
        currentRun,
        gridService,
        productCacheService
      })
    });
  });

  router.get('/runs', (req, res) => {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    res.json({ success: true, runs: runLogService.listRuns({ limit }) });
  });

  router.get('/runs/:id', (req, res) => {
    try {
      res.json({ success: true, run: runLogService.getRun(req.params.id) });
    } catch (err) {
      res.status(404).json({ error: { code: err.code || 'DATA_PIPELINE_RUN_NOT_FOUND', message: err.message } });
    }
  });

  router.post('/run', async (req, res) => {
    try {
      const config = configService.getConfig();
      const estimate = configService.estimate(config);
      if (!estimate.safe) {
        return res.status(400).json({
          error: { code: 'DATA_PIPELINE_UNSAFE_CONFIG', message: estimate.reasons.join('; ') },
          estimate
        });
      }
      if (req.body?.dryRun === true) {
        const result = await workerService.runOnce({
          config,
          reason: req.body?.reason || 'dry-run',
          dryRun: true
        });
        const statusCode = result.status === 'completed' ? 200 : 500;
        return res.status(statusCode).json({ success: result.status === 'completed', ...result, estimate });
      }

      const result = await workerService.runOnce({
        config,
        reason: req.body?.reason || 'manual-real-run',
        dryRun: false
      });
      const statusCode = result.status === 'completed' ? 200 : 500;
      return res.status(statusCode).json({ success: result.status === 'completed', ...result, estimate });
    } catch (err) {
      return res.status(500).json({ error: { code: err.code || 'DATA_PIPELINE_RUN_CREATE_FAILED', message: err.message } });
    }
  });

  router.post('/runs/:id/retry', async (req, res) => {
    try {
      const previous = runLogService.getRun(req.params.id);
      const estimate = configService.estimate(previous.config);
      if (!estimate.safe) {
        return res.status(400).json({
          error: { code: 'DATA_PIPELINE_UNSAFE_CONFIG', message: estimate.reasons.join('; ') },
          estimate,
          previousRunId: previous.id
        });
      }
      if (req.body?.dryRun === true) {
        const result = await workerService.runOnce({
          config: previous.config,
          reason: `retry:${previous.id}`,
          dryRun: true
        });
        const statusCode = result.status === 'completed' ? 200 : 500;
        return res.status(statusCode).json({
          success: result.status === 'completed',
          previousRunId: previous.id,
          ...result,
          estimate
        });
      }

      const result = await workerService.runOnce({
        config: previous.config,
        reason: `retry:${previous.id}`,
        dryRun: false
      });
      const statusCode = result.status === 'completed' ? 200 : 500;
      res.status(statusCode).json({
        success: result.status === 'completed',
        previousRunId: previous.id,
        ...result,
        estimate
      });
    } catch (err) {
      res.status(404).json({ error: { code: err.code || 'DATA_PIPELINE_RUN_NOT_FOUND', message: err.message } });
    }
  });

  router.post('/cleanup', (req, res) => {
    const config = configService.getConfig();
    const dryRun = req.body?.dryRun === true;
    const run = runLogService.createRun(config, { reason: dryRun ? 'manual-cleanup-dry-run' : 'manual-cleanup' });
    const step = runLogService.createStep(run.id, { type: 'cleanup', source: 'local' });
    try {
      const cleanup = cleanupService.cleanup(config.storagePolicy || {}, { dryRun });
      const completedStep = runLogService.completeStep(step.id, {
        bytesDownloaded: 0,
        outputPath: dryRun ? 'local-cleanup-dry-run' : 'local-cleanup',
        elapsedMs: 0
      });
      const completedRun = runLogService.completeRun(run.id, { artifactPath: dryRun ? 'local-cleanup-dry-run' : 'local-cleanup' });
      res.json({ success: true, run: completedRun, step: completedStep, cleanup });
    } catch (err) {
      const failedStep = runLogService.failStep(step.id, {
        errorCode: err.code || 'DATA_PIPELINE_CLEANUP_FAILED',
        message: err.message,
        retryable: true
      });
      res.status(500).json({ error: { code: failedStep.errorCode, message: failedStep.message }, run: runLogService.getRun(run.id), step: failedStep });
    }
  });

  return router;
}

module.exports = createRouter();
module.exports.createRouter = createRouter;
