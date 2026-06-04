'use strict';

const os = require('os');
const path = require('path');

const DataPipelineConfigService = require('./DataPipelineConfigService');
const GfsGridSourceService = require('./GfsGridSourceService');
const CamsAerosolSourceService = require('./CamsAerosolSourceService');

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function parseCycle(cycle) {
  return new Date(`${cycle.slice(0, 4)}-${cycle.slice(4, 6)}-${cycle.slice(6, 8)}T${cycle.slice(8, 10)}:00:00Z`);
}

function forecastValidTime(batch) {
  return new Date(parseCycle(batch.cycle).getTime() + Number(batch.forecastHour || 0) * 60 * 60 * 1000).toISOString();
}

class DataPipelinePlannerService {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(os.homedir(), '.xiake');
    this.now = options.now || null;
    this.freeDiskBytes = options.freeDiskBytes;
  }

  createPlan(input = {}) {
    const configService = new DataPipelineConfigService({
      dataDir: this.dataDir,
      freeDiskBytes: this.freeDiskBytes
    });
    const config = {
      ...configService.getConfig(),
      ...input,
      sources: {
        ...configService.getConfig().sources,
        ...(input.sources || {})
      },
      storagePolicy: {
        ...configService.getConfig().storagePolicy,
        ...(input.storagePolicy || {})
      },
      runtimePolicy: {
        ...configService.getConfig().runtimePolicy,
        ...(input.runtimePolicy || {})
      }
    };

    const forecastHours = Number(config.forecastHours);
    config.forecastHours = Math.min(Number.isFinite(forecastHours) ? forecastHours : 48, 48);

    const estimate = configService.estimate(config);
    const normalizedConfig = estimate.config;
    const requestConfig = {
      ...normalizedConfig,
      bbox: estimate.requestBbox || normalizedConfig.bbox,
      outputBbox: normalizedConfig.bbox
    };

    const gfsPlan = normalizedConfig.sources.gfs
      ? new GfsGridSourceService({ dataDir: this.dataDir, now: this.now }).buildRequestPlan(requestConfig)
      : null;
    const camsPlan = normalizedConfig.sources.cams
      ? new CamsAerosolSourceService({ dataDir: this.dataDir, now: this.now }).buildRequestPlan({
        ...requestConfig,
        forecastValidTimes: gfsPlan?.batches ? gfsPlan.batches.map(forecastValidTime) : null,
        forecastStepHours: Math.max(3, Number(normalizedConfig.forecastStepHours) || 3)
      })
      : null;

    const steps = [
      ...(gfsPlan ? gfsPlan.batches.map(batch => this._toStep(batch)) : []),
      ...(camsPlan ? camsPlan.batches.map(batch => this._toStep(batch)) : [])
    ];
    const estimatedDownloadBytes = (gfsPlan?.estimatedBytes || 0) + (camsPlan?.estimatedBytes || 0);
    const estimatedRawTmpBytes = Math.max(estimate.estimatedRawTmpBytes, estimatedDownloadBytes * 2);
    const maxResidentBytes = Math.ceil(Math.max(64 * 1024 * 1024, Math.min(
      Number(config.runtimePolicy.maxResidentMemoryMb) * 1024 ** 2,
      estimatedRawTmpBytes / Math.max(steps.length, 1)
    )));
    const reasons = estimate.reasons.slice();
    const minFreeDiskBytes = Number(config.storagePolicy.minFreeDiskGb) * 1024 ** 3;

    if (Number.isFinite(this.freeDiskBytes) && this.freeDiskBytes - estimatedRawTmpBytes < minFreeDiskBytes) {
      reasons.push(`disk free space would fall below ${config.storagePolicy.minFreeDiskGb}GB`);
    }

    return {
      safe: reasons.length === 0,
      reasons,
      mode: normalizedConfig.mode,
      windowHours: normalizedConfig.forecastHours,
      bbox: normalizedConfig.bbox,
      requestBbox: estimate.requestBbox || normalizedConfig.bbox,
      resolution: normalizedConfig.resolution,
      sources: [
        ...(gfsPlan ? ['gfs'] : []),
        ...(camsPlan ? ['cams'] : [])
      ],
      runtimePolicy: normalizedConfig.runtimePolicy,
      gfs: gfsPlan,
      cams: camsPlan,
      steps,
      estimate: {
        ...estimate,
        safe: reasons.length === 0,
        reasons,
        estimatedDownloadBytes,
        estimatedRawTmpBytes,
        maxResidentBytes,
        freeDiskBytes: Number.isFinite(this.freeDiskBytes) ? this.freeDiskBytes : null
      }
    };
  }

  _toStep(batch) {
    return {
      id: batch.requestId,
      type: 'fetch_manifest',
      source: batch.source,
      cycle: batch.cycle,
      forecastHour: Number.isFinite(batch.forecastHour) ? batch.forecastHour : null,
      forecastHours: Array.isArray(batch.forecastHours) ? batch.forecastHours.slice() : null,
      variables: batch.variables.slice(),
      bbox: batch.bbox,
      outputBbox: clone(batch.outputBbox || null),
      estimatedBytes: batch.estimatedBytes,
      dataUrl: batch.dataUrl || null,
      idxUrl: batch.idxUrl || null,
      request: clone(batch.request) || null,
      rawPath: batch.rawPath,
      cleanupRawAfterProcess: batch.cleanupRawAfterProcess === true,
      degradeOnFailure: batch.degradeOnFailure === true,
      retryable: true
    };
  }
}

module.exports = DataPipelinePlannerService;
