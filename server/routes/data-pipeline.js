'use strict';

const express = require('express');
const DataPipelineConfigService = require('../services/DataPipelineConfigService');
const DataPipelineRunLogService = require('../services/DataPipelineRunLogService');
const DataPipelineCleanupService = require('../services/DataPipelineCleanupService');
const DataPipelineWorkerService = require('../services/DataPipelineWorkerService');

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
    res.json({
      success: true,
      config,
      estimate: configService.estimate(config),
      currentRun: runLogService.getLatestRun(),
      latestSuccessfulRun: runLogService.getLatestSuccessfulRun(),
      today: runLogService.getDailyStats()
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

      const run = runLogService.createRun(config, { reason: req.body?.reason || 'manual' });
      return res.status(202).json({ success: true, run, estimate });
    } catch (err) {
      return res.status(500).json({ error: { code: err.code || 'DATA_PIPELINE_RUN_CREATE_FAILED', message: err.message } });
    }
  });

  router.post('/runs/:id/retry', (req, res) => {
    try {
      const previous = runLogService.getRun(req.params.id);
      const run = runLogService.createRun(previous.config, { reason: `retry:${previous.id}` });
      res.status(202).json({ success: true, run, previousRunId: previous.id });
    } catch (err) {
      res.status(404).json({ error: { code: err.code || 'DATA_PIPELINE_RUN_NOT_FOUND', message: err.message } });
    }
  });

  router.post('/cleanup', (req, res) => {
    const config = configService.getConfig();
    const run = runLogService.createRun(config, { reason: 'manual-cleanup' });
    const step = runLogService.createStep(run.id, { type: 'cleanup', source: 'local' });
    try {
      const cleanup = cleanupService.cleanup(config.storagePolicy || {});
      const completedStep = runLogService.completeStep(step.id, {
        bytesDownloaded: 0,
        outputPath: 'local-cleanup',
        elapsedMs: 0
      });
      const completedRun = runLogService.completeRun(run.id, { artifactPath: 'local-cleanup' });
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
