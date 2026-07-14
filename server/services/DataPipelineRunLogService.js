'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { randomUUID } = require('crypto');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nowIso() {
  return new Date().toISOString();
}

class DataPipelineRunLogService {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(os.homedir(), '.xiake');
    this.runsPath = options.runsPath || path.join(this.dataDir, 'data-pipeline-runs.json');
    this.stepsPath = options.stepsPath || path.join(this.dataDir, 'data-pipeline-steps.json');
    this.now = options.now || null;
    this._runs = [];
    this._steps = [];
    this._load();
  }

  _nowIso() {
    if (typeof this.now === 'function') return this.now().toISOString();
    if (this.now instanceof Date) return this.now.toISOString();
    return nowIso();
  }

  createRun(config = {}, meta = {}) {
    const run = {
      id: `run_${randomUUID()}`,
      status: 'queued',
      config: clone(config),
      reason: meta.reason || null,
      artifactPath: null,
      totalBytesDownloaded: 0,
      createdAt: this._nowIso(),
      startedAt: null,
      completedAt: null,
      failedAt: null,
      errorCode: null,
      message: null
    };
    this._runs.unshift(run);
    this._persist();
    return clone(run);
  }

  startRun(runId) {
    const run = this._findRun(runId);
    run.status = 'running';
    run.startedAt = this._nowIso();
    this._persist();
    return clone(run);
  }

  completeRun(runId, patch = {}) {
    const run = this._findRun(runId);
    run.status = 'completed';
    run.completedAt = this._nowIso();
    run.artifactPath = patch.artifactPath || run.artifactPath;
    run.totalBytesDownloaded = this._sumBytes(run.id);
    this._persist();
    return this.getRun(run.id);
  }

  failRun(runId, patch = {}) {
    const run = this._findRun(runId);
    run.status = 'failed';
    run.failedAt = this._nowIso();
    run.errorCode = patch.errorCode || 'DATA_PIPELINE_FAILED';
    run.message = patch.message || null;
    run.totalBytesDownloaded = this._sumBytes(run.id);
    this._persist();
    return this.getRun(run.id);
  }

  createStep(runId, step = {}) {
    this._findRun(runId);
    const row = {
      id: `step_${randomUUID()}`,
      runId,
      type: step.type || 'unknown',
      status: step.status || 'queued',
      source: step.source || null,
      cycle: step.cycle || null,
      forecastHour: Number.isFinite(step.forecastHour) ? step.forecastHour : null,
      variables: Array.isArray(step.variables) ? step.variables.slice() : [],
      bbox: step.bbox || null,
      bytesDownloaded: 0,
      elapsedMs: null,
      outputPath: null,
      errorCode: null,
      message: null,
      retryable: false,
      createdAt: this._nowIso(),
      startedAt: null,
      completedAt: null,
      failedAt: null
    };
    this._steps.unshift(row);
    this._persist();
    return clone(row);
  }

  completeStep(stepId, patch = {}) {
    const step = this._findStep(stepId);
    step.status = 'completed';
    step.completedAt = this._nowIso();
    step.bytesDownloaded = Number(patch.bytesDownloaded) || 0;
    step.elapsedMs = Number.isFinite(patch.elapsedMs) ? patch.elapsedMs : step.elapsedMs;
    step.outputPath = patch.outputPath || step.outputPath;
    this._updateRunBytes(step.runId);
    this._persist();
    return clone(step);
  }

  failStep(stepId, patch = {}) {
    const step = this._findStep(stepId);
    step.status = 'failed';
    step.failedAt = this._nowIso();
    step.errorCode = patch.errorCode || 'STEP_FAILED';
    step.message = patch.message || null;
    step.retryable = Boolean(patch.retryable);
    if (patch.failRun !== false) {
      this.failRun(step.runId, {
        errorCode: step.errorCode,
        message: step.message
      });
    }
    this._persist();
    return clone(step);
  }

  listRuns({ limit = 50 } = {}) {
    return this._runs.slice(0, limit).map(run => ({
      ...clone(run),
      stepCount: this._steps.filter(step => step.runId === run.id).length
    }));
  }

  getRun(runId) {
    const run = this._findRun(runId);
    return {
      ...clone(run),
      totalBytesDownloaded: this._sumBytes(run.id),
      steps: this._steps
        .filter(step => step.runId === run.id)
        .slice()
        .reverse()
        .map(clone)
    };
  }

  getLatestRun() {
    return this._runs.length > 0 ? this.getRun(this._runs[0].id) : null;
  }

  getLatestSuccessfulRun() {
    const run = this._runs.find(item => item.status === 'completed');
    return run ? this.getRun(run.id) : null;
  }

  getDailyStats(date = new Date().toISOString().slice(0, 10)) {
    const runs = this._runs.filter(run => run.createdAt.startsWith(date));
    const steps = this._steps.filter(step => step.createdAt.startsWith(date));
    return {
      date,
      runCount: runs.length,
      failedRunCount: runs.filter(run => run.status === 'failed').length,
      stepCount: steps.length,
      failedStepCount: steps.filter(step => step.status === 'failed').length,
      bytesDownloaded: steps.reduce((sum, step) => sum + (Number(step.bytesDownloaded) || 0), 0)
    };
  }

  failStaleActiveRuns({ staleAfterMs = 2 * 60 * 60 * 1000, errorCode = 'DATA_PIPELINE_STALE_RUN', message = 'stale active pipeline run failed automatically' } = {}) {
    const now = this.now instanceof Date
      ? this.now
      : typeof this.now === 'function'
        ? this.now()
        : new Date();
    const cutoffMs = now.getTime() - Math.max(0, Number(staleAfterMs) || 0);
    const failedRuns = [];

    for (const run of this._runs) {
      if (run.status !== 'running' && run.status !== 'queued') continue;
      const activeSince = new Date(run.startedAt || run.createdAt || 0).getTime();
      if (!Number.isFinite(activeSince) || activeSince > cutoffMs) continue;

      run.status = 'failed';
      run.failedAt = this._nowIso();
      run.errorCode = errorCode;
      run.message = message;
      run.totalBytesDownloaded = this._sumBytes(run.id);
      failedRuns.push(clone(run));

      for (const step of this._steps) {
        if (step.runId !== run.id) continue;
        if (step.status !== 'running' && step.status !== 'queued') continue;
        step.status = 'failed';
        step.failedAt = run.failedAt;
        step.errorCode = errorCode;
        step.message = message;
        step.retryable = true;
      }
    }

    if (failedRuns.length > 0) this._persist();
    return failedRuns;
  }

  pruneOlderThan({ olderThanDays = 7, maxRuns = 200, maxSteps = 2000 } = {}) {
    const nowMs = this.now instanceof Date
      ? this.now.getTime()
      : typeof this.now === 'function'
        ? this.now().getTime()
        : Date.now();
    const cutoff = nowMs - olderThanDays * 24 * 60 * 60 * 1000;
    const keepRunsByAge = this._runs.filter(run => new Date(run.createdAt).getTime() >= cutoff);
    const keptRuns = keepRunsByAge.slice(0, maxRuns);
    const keptRunIds = new Set(keptRuns.map(run => run.id));
    const keepStepsByAge = this._steps.filter(step =>
      keptRunIds.has(step.runId) &&
      new Date(step.createdAt).getTime() >= cutoff
    );
    const keptSteps = keepStepsByAge.slice(0, maxSteps);
    const prunedRuns = this._runs.length - keptRuns.length;
    const prunedSteps = this._steps.length - keptSteps.length;
    this._runs = keptRuns;
    this._steps = keptSteps;
    this._persist();
    return { prunedRuns, prunedSteps };
  }

  _load() {
    try {
      if (fs.existsSync(this.runsPath)) {
        const parsed = JSON.parse(fs.readFileSync(this.runsPath, 'utf8'));
        this._runs = Array.isArray(parsed.runs) ? parsed.runs : [];
      }
      if (fs.existsSync(this.stepsPath)) {
        const parsed = JSON.parse(fs.readFileSync(this.stepsPath, 'utf8'));
        this._steps = Array.isArray(parsed.steps) ? parsed.steps : [];
      }
    } catch (err) {
      console.warn('[DataPipelineRunLog] load failed:', err.message);
      this._runs = [];
      this._steps = [];
    }
  }

  _persist() {
    fs.mkdirSync(this.dataDir, { recursive: true });
    fs.writeFileSync(this.runsPath, JSON.stringify({ runs: this._runs.slice(0, 200) }, null, 2), 'utf8');
    fs.writeFileSync(this.stepsPath, JSON.stringify({ steps: this._steps.slice(0, 2000) }, null, 2), 'utf8');
  }

  _findRun(runId) {
    const run = this._runs.find(item => item.id === runId);
    if (!run) {
      const err = new Error(`run not found: ${runId}`);
      err.code = 'DATA_PIPELINE_RUN_NOT_FOUND';
      throw err;
    }
    return run;
  }

  _findStep(stepId) {
    const step = this._steps.find(item => item.id === stepId);
    if (!step) {
      const err = new Error(`step not found: ${stepId}`);
      err.code = 'DATA_PIPELINE_STEP_NOT_FOUND';
      throw err;
    }
    return step;
  }

  _sumBytes(runId) {
    return this._steps
      .filter(step => step.runId === runId)
      .reduce((sum, step) => sum + (Number(step.bytesDownloaded) || 0), 0);
  }

  _updateRunBytes(runId) {
    const run = this._findRun(runId);
    run.totalBytesDownloaded = this._sumBytes(runId);
  }
}

module.exports = DataPipelineRunLogService;
