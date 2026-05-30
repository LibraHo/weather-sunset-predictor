'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const DataPipelinePlannerService = require('./DataPipelinePlannerService');
const DataPipelineRunLogService = require('./DataPipelineRunLogService');
const GridProductCacheService = require('./GridProductCacheService');
const GfsGridSourceService = require('./GfsGridSourceService');
const CamsAerosolSourceService = require('./CamsAerosolSourceService');

const activeRunKeys = new Set();

function nowMs() {
  return Date.now();
}

class DataPipelineWorkerService {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(os.homedir(), '.xiake');
    this.now = options.now || null;
    this.freeDiskBytes = options.freeDiskBytes;
    this.plannerService = options.plannerService || new DataPipelinePlannerService({
      dataDir: this.dataDir,
      now: this.now,
      freeDiskBytes: this.freeDiskBytes
    });
    this.runLogService = options.runLogService || new DataPipelineRunLogService({
      dataDir: this.dataDir,
      now: this.now
    });
    this.cacheService = options.cacheService || new GridProductCacheService({
      dataDir: this.dataDir,
      now: this.now,
      freeDiskBytes: this.freeDiskBytes
    });
    this.gfsSourceService = options.gfsSourceService || new GfsGridSourceService({
      dataDir: this.dataDir,
      now: this.now
    });
    this.camsSourceService = options.camsSourceService || new CamsAerosolSourceService({
      dataDir: this.dataDir,
      now: this.now
    });
    this.beforeStep = options.beforeStep || null;
    this.stepDelayMs = Number(options.stepDelayMs) || 0;
    this.lockKey = options.lockKey || path.resolve(this.dataDir);
    this._active = false;
  }

  async runOnce({ config = {}, reason = 'manual', dryRun = true } = {}) {
    if (this._active || activeRunKeys.has(this.lockKey)) {
      const err = new Error('data pipeline worker is already running');
      err.code = 'DATA_PIPELINE_WORKER_BUSY';
      throw err;
    }

    this._active = true;
    activeRunKeys.add(this.lockKey);
    let run = null;

    try {
      run = this.runLogService.createRun(config, { reason });
      const plan = this.plannerService.createPlan(config);
      if (!plan.safe) {
        const err = new Error(plan.reasons.join('; '));
        err.code = 'DATA_PIPELINE_UNSAFE_PLAN';
        throw err;
      }

      this.runLogService.startRun(run.id);
      const summary = {
        runId: run.id,
        degraded: false,
        products: [],
        failedSteps: []
      };

      for (const planStep of plan.steps) {
        await this._runStep(run.id, planStep, summary, { dryRun: dryRun === true });
      }

      const completedRun = this.runLogService.completeRun(run.id, {
        artifactPath: this.cacheService.manifestPath
      });

      return {
        status: 'completed',
        degraded: summary.degraded,
        run: completedRun,
        products: summary.products,
        failedSteps: summary.failedSteps
      };
    } catch (err) {
      let latestRun;
      try {
        latestRun = run ? this.runLogService.getRun(run.id) : null;
        if (latestRun && latestRun.status !== 'failed') {
          latestRun = this.runLogService.failRun(run.id, {
            errorCode: err.code || 'DATA_PIPELINE_WORKER_FAILED',
            message: err.message
          });
        }
      } catch (_) {
        latestRun = null;
      }
      return {
        status: 'failed',
        degraded: false,
        run: latestRun,
        error: {
          code: err.code || 'DATA_PIPELINE_WORKER_FAILED',
          message: err.message
        }
      };
    } finally {
      this._active = false;
      activeRunKeys.delete(this.lockKey);
    }
  }

  async _runStep(runId, planStep, summary, options = {}) {
    const dryRun = options.dryRun === true;
    const step = this.runLogService.createStep(runId, {
      type: dryRun ? 'dry_run_fixture' : 'real_grid_download',
      source: planStep.source,
      cycle: planStep.cycle,
      forecastHour: planStep.forecastHour,
      variables: planStep.variables,
      bbox: planStep.bbox,
      retryable: planStep.retryable
    });
    const startedAt = nowMs();

    try {
      if (this.beforeStep) await this.beforeStep(planStep);
      if (this.stepDelayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, this.stepDelayMs));
      }

      const { bytesDownloaded, product } = dryRun
        ? await this._runFixtureStep(planStep)
        : await this._runRealStep(planStep);
      const entry = this.cacheService.writeProduct(product);
      this._cleanupRawIfNeeded(planStep);
      const completedStep = this.runLogService.completeStep(step.id, {
        bytesDownloaded,
        elapsedMs: nowMs() - startedAt,
        outputPath: entry.path
      });

      summary.products.push(entry);
      return completedStep;
    } catch (err) {
      this._cleanupRawIfNeeded(planStep);
      const failedStep = this.runLogService.failStep(step.id, {
        errorCode: err.code || `${String(planStep.source || 'SOURCE').toUpperCase()}_${dryRun ? 'FIXTURE' : 'REAL'}_FAILED`,
        message: err.message,
        retryable: planStep.retryable !== false,
        failRun: planStep.degradeOnFailure === true ? false : true
      });

      summary.failedSteps.push(failedStep);
      if (planStep.degradeOnFailure === true) {
        summary.degraded = true;
        return failedStep;
      }
      throw err;
    }
  }

  async _runFixtureStep(planStep) {
    const bytesDownloaded = this._writeRawPlaceholder(planStep);
    const product = this._normalizeFixtureProduct(planStep);
    return { bytesDownloaded, product };
  }

  async _runRealStep(planStep) {
    const sourceService = this._sourceServiceFor(planStep.source);
    if (!sourceService || typeof sourceService.downloadBatch !== 'function') {
      const err = new Error(`downloader is not configured for source: ${planStep.source}`);
      err.code = `${String(planStep.source || 'SOURCE').toUpperCase()}_DOWNLOADER_NOT_CONFIGURED`;
      throw err;
    }
    if (typeof sourceService.readGridRecords !== 'function') {
      const err = new Error(`parser is not configured for source: ${planStep.source}`);
      err.code = `${String(planStep.source || 'SOURCE').toUpperCase()}_PARSER_NOT_CONFIGURED`;
      throw err;
    }

    const download = await sourceService.downloadBatch(planStep);
    const records = await sourceService.readGridRecords(planStep);
    const product = sourceService.normalizeGridProduct(planStep, records);
    return {
      bytesDownloaded: Number(download?.bytesDownloaded) || 0,
      product
    };
  }

  _sourceServiceFor(source) {
    if (source === 'gfs') return this.gfsSourceService;
    if (source === 'cams') return this.camsSourceService;
    return null;
  }

  _normalizeFixtureProduct(planStep) {
    const records = this._fixtureRecords(planStep);
    if (planStep.source === 'gfs') {
      return this.gfsSourceService.normalizeGridProduct(planStep, records);
    }
    if (planStep.source === 'cams') {
      return this.camsSourceService.normalizeGridProduct(planStep, records);
    }
    const err = new Error(`unsupported pipeline source: ${planStep.source}`);
    err.code = 'DATA_PIPELINE_UNSUPPORTED_SOURCE';
    throw err;
  }

  _fixtureRecords(planStep) {
    const bbox = planStep.bbox || { north: 41, south: 39, west: 115, east: 117 };
    const centerLat = Number(((Number(bbox.north) + Number(bbox.south)) / 2).toFixed(3));
    const centerLon = Number(((Number(bbox.west) + Number(bbox.east)) / 2).toFixed(3));
    const forecastHour = Number.isFinite(planStep.forecastHour)
      ? planStep.forecastHour
      : Array.isArray(planStep.forecastHours) ? planStep.forecastHours[0] : 0;

    if (planStep.source === 'cams') {
      return [
        {
          lat: centerLat,
          lon: centerLon,
          forecastHour,
          values: {
            total_aerosol_optical_depth_550nm: 0.18,
            particulate_matter_10um: 38
          }
        }
      ];
    }

    return [
      {
        lat: centerLat,
        lon: centerLon,
        values: {
          TCDC: 76,
          LCDC: 18,
          MCDC: 42,
          HCDC: 64,
          RH: 52,
          VIS: 18000,
          TMP: 293.15,
          UGRD: 2.1,
          VGRD: -1.3
        }
      }
    ];
  }

  _writeRawPlaceholder(planStep) {
    const rawPath = planStep.rawPath;
    if (!rawPath) return 0;
    fs.mkdirSync(path.dirname(rawPath), { recursive: true });
    const payload = JSON.stringify({
      dryRun: true,
      source: planStep.source,
      cycle: planStep.cycle,
      forecastHour: planStep.forecastHour,
      forecastHours: planStep.forecastHours || null,
      createdAt: this.now instanceof Date ? this.now.toISOString() : new Date().toISOString()
    });
    fs.writeFileSync(rawPath, payload, 'utf8');
    return Buffer.byteLength(payload, 'utf8');
  }

  _cleanupRawIfNeeded(planStep) {
    if (planStep.cleanupRawAfterProcess !== true || !planStep.rawPath) return;
    if (fs.existsSync(planStep.rawPath)) {
      fs.unlinkSync(planStep.rawPath);
      this._removeEmptyParents(path.dirname(planStep.rawPath), path.join(this.dataDir, 'data', 'raw'));
    }
  }

  _removeEmptyParents(currentDir, stopDir) {
    const resolvedStop = path.resolve(stopDir);
    let dir = path.resolve(currentDir);
    while (dir.startsWith(resolvedStop) && dir !== resolvedStop) {
      if (!fs.existsSync(dir) || fs.readdirSync(dir).length > 0) return;
      fs.rmdirSync(dir);
      dir = path.dirname(dir);
    }
    if (dir === resolvedStop && fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
      fs.rmdirSync(dir);
    }
  }
}

module.exports = DataPipelineWorkerService;
