'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_BBOXES = {
  china: { north: 54, south: 18, west: 73, east: 135 },
  japan: { north: 46, south: 31, west: 129, east: 146 },
  south_korea: { north: 39.5, south: 33, west: 124, east: 132 },
  china_japan_korea: { north: 54, south: 18, west: 73, east: 146 },
  east_asia: { north: 60, south: 5, west: 70, east: 150 },
  test_small: { north: 41, south: 39, west: 115, east: 117 }
};

const REGION_COUNTRIES = {
  CN: { name: 'China', bbox: DEFAULT_BBOXES.china },
  JP: { name: 'Japan', bbox: DEFAULT_BBOXES.japan },
  KR: { name: 'South Korea', bbox: DEFAULT_BBOXES.south_korea }
};

const DEFAULT_REGION_DEFINITION = {
  type: 'countries',
  countries: ['CN', 'JP', 'KR']
};

const DEFAULT_CONFIG = {
  mode: 'hybrid',
  regionPreset: 'china_japan_korea',
  regionDefinition: DEFAULT_REGION_DEFINITION,
  bbox: DEFAULT_BBOXES.china_japan_korea,
  resolution: 0.5,
  forecastHours: 48,
  forecastStepHours: 1,
  sources: { gfs: true, cams: true, openMeteoFallback: true },
  runtimePolicy: {
    workerConcurrency: 1,
    maxResidentMemoryMb: 512,
    hardMemoryLimitMb: 768,
    reserveMemoryForApiMb: 2048,
    publicRequestCanStartPipeline: false,
    pauseWhenMemoryPressure: true
  },
  storagePolicy: {
    deleteRawAfterMinutes: 60,
    deleteTmpAfterHours: 3,
    keepCacheDays: 3,
    keepTileDays: 3,
    keepLogDays: 7,
    minFreeDiskGb: 3,
    maxRawTmpGb: 5
  }
};

const VALID_MODES = new Set(['openmeteo', 'gfs_cams', 'hybrid', 'cache_only', 'paused']);
const VALID_PRESETS = new Set(['china_japan_korea', 'china', 'japan', 'south_korea', 'east_asia', 'test_small', 'custom_bbox']);
const VALID_RESOLUTIONS = new Set([0.25, 0.5, 1]);
const MAX_BBOX_AREA_DEG2 = 12000;
const MAX_GRID_POINTS = 200000;
const MAX_FORECAST_HOURS = 72;
const GFS_GLOBAL_FIELD_BYTES_PER_HOUR = 29 * 1024 * 1024;
const CAMS_GLOBAL_FIELD_BYTES_PER_CYCLE = 80 * 1024 * 1024;
const GLOBAL_GFS_GRID_POINTS = 721 * 1440;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeConfig(input = {}) {
  const regionPreset = VALID_PRESETS.has(input.regionPreset) ? input.regionPreset : DEFAULT_CONFIG.regionPreset;
  const regionDefinition = normalizeRegionDefinition(input.regionDefinition, regionPreset);
  const regionBbox = bboxFromRegionDefinition(regionDefinition);
  const presetBbox = regionPreset === 'custom_bbox' ? null : DEFAULT_BBOXES[regionPreset];
  const bbox = regionBbox || input.bbox || presetBbox || DEFAULT_CONFIG.bbox;

  return {
    ...clone(DEFAULT_CONFIG),
    ...input,
    mode: VALID_MODES.has(input.mode) ? input.mode : (input.mode || DEFAULT_CONFIG.mode),
    regionPreset,
    regionDefinition,
    bbox: normalizeBbox(bbox),
    resolution: Number(input.resolution || DEFAULT_CONFIG.resolution),
    forecastHours: Number(input.forecastHours || DEFAULT_CONFIG.forecastHours),
    forecastStepHours: Number(input.forecastStepHours || DEFAULT_CONFIG.forecastStepHours),
    sources: {
      ...DEFAULT_CONFIG.sources,
      ...(input.sources || {})
    },
    runtimePolicy: {
      ...DEFAULT_CONFIG.runtimePolicy,
      ...(input.runtimePolicy || {})
    },
    storagePolicy: {
      ...DEFAULT_CONFIG.storagePolicy,
      ...(input.storagePolicy || {})
    }
  };
}

function normalizeRegionDefinition(input, regionPreset) {
  if (regionPreset === 'custom_bbox') {
    return { type: 'bbox' };
  }

  const countries = Array.isArray(input?.countries)
    ? input.countries.map(code => String(code).toUpperCase()).filter(code => REGION_COUNTRIES[code])
    : null;

  if (input?.type === 'countries' && countries?.length) {
    return {
      type: 'countries',
      countries: [...new Set(countries)]
    };
  }

  if (regionPreset === 'china') return { type: 'countries', countries: ['CN'] };
  if (regionPreset === 'japan') return { type: 'countries', countries: ['JP'] };
  if (regionPreset === 'south_korea') return { type: 'countries', countries: ['KR'] };
  if (regionPreset === 'china_japan_korea' || regionPreset === 'east_asia') return clone(DEFAULT_REGION_DEFINITION);
  return clone(DEFAULT_REGION_DEFINITION);
}

function bboxFromRegionDefinition(regionDefinition) {
  if (regionDefinition?.type !== 'countries' || !Array.isArray(regionDefinition.countries)) return null;
  const boxes = regionDefinition.countries.map(code => REGION_COUNTRIES[code]?.bbox).filter(Boolean);
  if (boxes.length === 0) return null;
  return {
    north: Math.max(...boxes.map(box => box.north)),
    south: Math.min(...boxes.map(box => box.south)),
    west: Math.min(...boxes.map(box => box.west)),
    east: Math.max(...boxes.map(box => box.east))
  };
}

function normalizeBbox(bbox = {}) {
  return {
    north: Number(bbox.north),
    south: Number(bbox.south),
    west: Number(bbox.west),
    east: Number(bbox.east)
  };
}

function gridPointCount(bbox, resolution) {
  const latCount = Math.floor((bbox.north - bbox.south) / resolution) + 1;
  const lonCount = Math.floor((bbox.east - bbox.west) / resolution) + 1;
  return Math.max(0, latCount) * Math.max(0, lonCount);
}

class DataPipelineConfigService {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(os.homedir(), '.xiake');
    this.configPath = options.configPath || path.join(this.dataDir, 'data-pipeline-config.json');
    this.freeDiskBytes = options.freeDiskBytes;
  }

  getConfig() {
    try {
      if (!fs.existsSync(this.configPath)) return clone(DEFAULT_CONFIG);
      const raw = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
      return mergeConfig(raw);
    } catch (err) {
      console.warn('[DataPipelineConfig] read failed:', err.message);
      return clone(DEFAULT_CONFIG);
    }
  }

  saveConfig(input) {
    const config = mergeConfig(input);
    const estimate = this.estimate(config);
    if (!estimate.safe) {
      const err = new Error(estimate.reasons.join('; '));
      err.code = 'DATA_PIPELINE_UNSAFE_CONFIG';
      err.estimate = estimate;
      throw err;
    }

    fs.mkdirSync(this.dataDir, { recursive: true });
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8');
    return config;
  }

  estimate(input = this.getConfig()) {
    const config = mergeConfig(input);
    const reasons = [];
    const bbox = config.bbox;
    const bboxAreaDeg2 = Math.max(0, (bbox.north - bbox.south) * (bbox.east - bbox.west));
    const gridPoints = gridPointCount(bbox, config.resolution);
    const forecastHourCount = Math.floor(config.forecastHours / config.forecastStepHours) + 1;

    this._validateConfigShape(config, reasons);

    if (bboxAreaDeg2 > MAX_BBOX_AREA_DEG2) {
      reasons.push(`bbox area ${bboxAreaDeg2} deg2 exceeds max ${MAX_BBOX_AREA_DEG2}`);
    }
    if (gridPoints > MAX_GRID_POINTS) {
      reasons.push(`grid points ${gridPoints} exceeds max ${MAX_GRID_POINTS}`);
    }
    if (config.forecastHours > MAX_FORECAST_HOURS) {
      reasons.push(`forecast hours ${config.forecastHours} exceeds max ${MAX_FORECAST_HOURS}`);
    }

    const gridRatio = gridPoints / GLOBAL_GFS_GRID_POINTS;
    const gfsBytes = config.sources.gfs ? GFS_GLOBAL_FIELD_BYTES_PER_HOUR * forecastHourCount * gridRatio : 0;
    const camsBytes = config.sources.cams ? CAMS_GLOBAL_FIELD_BYTES_PER_CYCLE * gridRatio * Math.ceil(config.forecastHours / 48) : 0;
    const estimatedDownloadBytes = Math.ceil(gfsBytes + camsBytes);
    const estimatedRawTmpBytes = Math.ceil(Math.max(200 * 1024 * 1024, estimatedDownloadBytes * 2));
    const estimatedResidentMemoryMb = Math.ceil(Math.max(128, estimatedRawTmpBytes / Math.max(forecastHourCount, 1) / 1024 ** 2));
    const minFreeDiskBytes = Number(config.storagePolicy.minFreeDiskGb) * 1024 ** 3;
    const maxRawTmpBytes = Number(config.storagePolicy.maxRawTmpGb) * 1024 ** 3;

    if (estimatedRawTmpBytes > maxRawTmpBytes) {
      reasons.push(`raw/tmp estimate ${estimatedRawTmpBytes} bytes exceeds limit ${maxRawTmpBytes}`);
    }

    if (Number.isFinite(this.freeDiskBytes) && this.freeDiskBytes - estimatedRawTmpBytes < minFreeDiskBytes) {
      reasons.push(`disk free space would fall below ${config.storagePolicy.minFreeDiskGb}GB`);
    }

    if (estimatedResidentMemoryMb > Number(config.runtimePolicy.maxResidentMemoryMb)) {
      reasons.push(`resident memory estimate ${estimatedResidentMemoryMb}MB exceeds worker budget ${config.runtimePolicy.maxResidentMemoryMb}MB`);
    }

    return {
      safe: reasons.length === 0,
      reasons,
      config,
      regionDefinition: clone(config.regionDefinition),
      bboxAreaDeg2,
      gridPoints,
      forecastHourCount,
      estimatedDownloadBytes,
      estimatedRawTmpBytes,
      estimatedResidentMemoryMb,
      freeDiskBytes: Number.isFinite(this.freeDiskBytes) ? this.freeDiskBytes : null
    };
  }

  _validateConfigShape(config, reasons) {
    if (!VALID_MODES.has(config.mode)) reasons.push(`mode ${config.mode} is invalid`);
    if (!VALID_PRESETS.has(config.regionPreset)) reasons.push(`region preset ${config.regionPreset} is invalid`);
    if (!VALID_RESOLUTIONS.has(config.resolution)) reasons.push(`resolution ${config.resolution} is invalid`);
    if (!Number.isFinite(config.forecastHours) || config.forecastHours <= 0) reasons.push('forecast hours must be positive');
    if (!Number.isFinite(config.forecastStepHours) || config.forecastStepHours <= 0) reasons.push('forecast step hours must be positive');
    if (!Number.isInteger(Number(config.runtimePolicy.workerConcurrency)) || Number(config.runtimePolicy.workerConcurrency) !== 1) {
      reasons.push('worker concurrency must be exactly 1 on the small production host');
    }
    if (!Number.isFinite(Number(config.runtimePolicy.maxResidentMemoryMb)) || Number(config.runtimePolicy.maxResidentMemoryMb) < 256) {
      reasons.push('worker memory budget must be at least 256MB');
    }
    if (Number(config.runtimePolicy.hardMemoryLimitMb) < Number(config.runtimePolicy.maxResidentMemoryMb)) {
      reasons.push('hard memory limit must be greater than or equal to worker memory budget');
    }
    if (config.runtimePolicy.publicRequestCanStartPipeline !== false) {
      reasons.push('public requests must not be allowed to start the data pipeline');
    }
    if (!Number.isFinite(config.bbox.north) || !Number.isFinite(config.bbox.south) ||
      !Number.isFinite(config.bbox.west) || !Number.isFinite(config.bbox.east)) {
      reasons.push('bbox values must be finite numbers');
      return;
    }
    if (config.bbox.north <= config.bbox.south) reasons.push('bbox north must be greater than south');
    if (config.bbox.east <= config.bbox.west) reasons.push('bbox east must be greater than west');
    if (config.bbox.north > 90 || config.bbox.south < -90) reasons.push('bbox latitude out of range');
    if (config.bbox.east > 180 || config.bbox.west < -180) reasons.push('bbox longitude out of range');
  }
}

DataPipelineConfigService.DEFAULT_CONFIG = DEFAULT_CONFIG;
DataPipelineConfigService.DEFAULT_BBOXES = DEFAULT_BBOXES;

module.exports = DataPipelineConfigService;
