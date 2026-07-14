'use strict';

const DataPipelineConfigService = require('./DataPipelineConfigService');
const DataPipelineWorkerService = require('./DataPipelineWorkerService');
const gridService = require('./GridScoreService');
const rasterService = require('./ChinaRasterService');
const {
  readScheduleConfig,
  getDueScheduleJobs,
  describeSchedule
} = require('./GridRefreshSchedule');

const DEFAULT_PIPELINE_TIMEOUT_MS = 90 * 60 * 1000;
const DEFAULT_STALE_RUN_AFTER_MS = 2 * 60 * 60 * 1000;

function timeoutError(message, code) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function withTimeout(promise, timeoutMs, message, code) {
  const ms = Number(timeoutMs);
  if (!Number.isFinite(ms) || ms <= 0) return promise;
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(timeoutError(message, code)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

class ScheduledGridRefreshService {
  constructor(options = {}) {
    this.intervalMs = Number(options.intervalMs) || 60 * 1000;
    this.readScheduleConfig = options.readScheduleConfig || readScheduleConfig;
    this.getDueScheduleJobs = options.getDueScheduleJobs || getDueScheduleJobs;
    this.describeSchedule = options.describeSchedule || describeSchedule;
    this.configService = options.configService || new DataPipelineConfigService();
    this.workerService = options.workerService || new DataPipelineWorkerService({
      dataDir: this.configService.dataDir,
      freeDiskBytes: this.configService.freeDiskBytes
    });
    this.gridService = options.gridService || gridService;
    this.rasterService = options.rasterService || rasterService;
    this.logger = options.logger || console;
    this.triggeredKeys = options.triggeredKeys || new Set();
    this.pipelineTimeoutMs = Number(options.pipelineTimeoutMs || process.env.DATA_PIPELINE_SCHEDULED_TIMEOUT_MS || DEFAULT_PIPELINE_TIMEOUT_MS);
    this.staleRunAfterMs = Number(options.staleRunAfterMs || process.env.DATA_PIPELINE_STALE_RUN_AFTER_MS || DEFAULT_STALE_RUN_AFTER_MS);
    this.runLogService = options.runLogService || this.workerService.runLogService || null;
    this.scheduleConfig = this.readScheduleConfig();
    this.timer = null;
    this.running = false;
  }

  describe() {
    return this.describeSchedule(this.scheduleConfig);
  }

  reload() {
    this.scheduleConfig = this.readScheduleConfig();
    this.logger.log(`[GridRefresh] 配置已重载，定时刷新时间(CST): ${this.describe()}`);
    return this.scheduleConfig;
  }

  start() {
    if (this.timer) return this.timer;
    this._failStalePipelineRuns('startup');
    this.logger.log(`[GridRefresh] 初始定时刷新时间(CST): ${this.describe()}`);
    this.timer = setInterval(() => {
      this.runDueJobs(new Date()).catch(err => {
        this.logger.error('[GridRefresh] 定时刷新检查失败:', err.message);
      });
    }, this.intervalMs);
    return this.timer;
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async refreshOnStartup(periods = ['sunrise', 'sunset']) {
    await Promise.all(periods.map(period =>
      this.gridService.refreshIfStale(undefined, period).catch(err => {
        this.logger.error(`[GridRefresh] 启动刷新失败 (${period}):`, err.message);
      })
    ));
  }

  async runDueJobs(date = new Date()) {
    const dueJobs = this.getDueScheduleJobs(this.scheduleConfig, date, this.triggeredKeys);
    for (const job of dueJobs) {
      this.triggeredKeys.add(job.triggerKey);
      await this._runScheduledJob(job);
    }
    this._cleanupTriggeredKeys();
    return dueJobs;
  }

  async _runScheduledJob(job) {
    this._failStalePipelineRuns(`before:${job.time}:${job.type}`);
    if (this.running) {
      this.logger.warn(`[GridRefresh] 定时刷新跳过（已有 pipeline 运行中，CST ${job.time})`);
      return;
    }

    this.running = true;
    try {
      const config = this.configService.getConfig();
      if (config.mode === 'openmeteo') {
        this.logger.log(`[GridRefresh] 定时触发 Open-Meteo 缓存刷新（CST ${job.time}, type=${job.type}, label=${job.label || '-'})`);
        await Promise.all(job.periods.map(period => this.gridService.refreshIfStale(undefined, period)));
        if (typeof this.rasterService.invalidateCache === 'function') {
          this.rasterService.invalidateCache('all');
        }
        return;
      }

      this.logger.log(`[GridRefresh] 定时触发 GFS+CAMS pipeline（CST ${job.time}, type=${job.type}, label=${job.label || '-'})`);
      const result = await withTimeout(
        this.workerService.runOnce({
          config,
          reason: `scheduled-grid-refresh:${job.time}:${job.type}`,
          dryRun: false
        }),
        this.pipelineTimeoutMs,
        `scheduled GFS+CAMS pipeline timed out after ${this.pipelineTimeoutMs}ms`,
        'DATA_PIPELINE_SCHEDULED_TIMEOUT'
      );

      if (result.status !== 'completed') {
        const code = result.error?.code || 'DATA_PIPELINE_FAILED';
        const message = result.error?.message || 'unknown error';
        this.logger.error(`[GridRefresh] 定时 pipeline 失败 (${code}): ${message}`);
        return;
      }

      // Public firecloud maps read the fresh grid-products directly. Do not
      // call the legacy Open-Meteo grid refresh here, or the scheduled job can
      // appear to update while still using stale GFS/CAMS products.
      if (typeof this.rasterService.invalidateCache === 'function') {
        this.rasterService.invalidateCache('all');
      }
      this.logger.log(`[GridRefresh] 定时 GFS+CAMS pipeline 完成，已清理 raster 缓存: ${job.periods.join(', ')}`);
    } catch (err) {
      if (err.code === 'DATA_PIPELINE_SCHEDULED_TIMEOUT') {
        this._failStalePipelineRuns('scheduled-timeout', {
          staleAfterMs: this.pipelineTimeoutMs,
          errorCode: err.code,
          message: err.message
        });
      }
      this.logger.error('[GridRefresh] 定时 GFS+CAMS pipeline 异常:', err.message);
    } finally {
      this.running = false;
    }
  }

  _failStalePipelineRuns(context, options = {}) {
    if (!this.runLogService || typeof this.runLogService.failStaleActiveRuns !== 'function') return [];
    const staleAfterMs = Number(options.staleAfterMs || this.staleRunAfterMs);
    const failed = this.runLogService.failStaleActiveRuns({
      staleAfterMs,
      errorCode: options.errorCode || 'DATA_PIPELINE_STALE_RUN',
      message: options.message || `stale pipeline run failed automatically (${context})`
    });
    for (const run of failed) {
      this.logger.warn(`[GridRefresh] 已自动失败 stale pipeline run: ${run.id} (${context})`);
    }
    return failed;
  }

  _cleanupTriggeredKeys() {
    const cutoff = Date.now() - (48 * 60 * 60 * 1000);
    for (const key of this.triggeredKeys) {
      const day = key.slice(0, 10);
      const time = key.slice(11, 16);
      const keyTime = new Date(`${day}T${time}:00+08:00`).getTime();
      if (Number.isFinite(keyTime) && keyTime < cutoff) this.triggeredKeys.delete(key);
    }
  }
}

module.exports = ScheduledGridRefreshService;
module.exports.withTimeout = withTimeout;
