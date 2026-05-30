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
    if (this.running) {
      this.logger.warn(`[GridRefresh] 定时刷新跳过（已有 pipeline 运行中，CST ${job.time})`);
      return;
    }

    this.running = true;
    try {
      this.logger.log(`[GridRefresh] 定时触发 GFS+CAMS pipeline（CST ${job.time}, type=${job.type}, label=${job.label || '-'})`);
      const config = this.configService.getConfig();
      const result = await this.workerService.runOnce({
        config,
        reason: `scheduled-grid-refresh:${job.time}:${job.type}`,
        dryRun: false
      });

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
      this.logger.error('[GridRefresh] 定时 GFS+CAMS pipeline 异常:', err.message);
    } finally {
      this.running = false;
    }
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
