'use strict';

const os = require('os');
const path = require('path');

const CamsCdsDownloaderService = require('./CamsCdsDownloaderService');
const CamsNetcdfParserService = require('./CamsNetcdfParserService');

const FIELD_WHITELIST = [
  'total_aerosol_optical_depth_550nm'
];

const GLOBAL_CAMS_GRID_POINTS = 451 * 900;
const CAMS_GLOBAL_FIELD_BYTES_PER_CYCLE = 80 * 1024 * 1024;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function pad(value, size = 2) {
  return String(value).padStart(size, '0');
}

function formatCycle(date) {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}${pad(date.getUTCHours())}`;
}

function parseCycle(cycle) {
  return new Date(`${cycle.slice(0, 4)}-${cycle.slice(4, 6)}-${cycle.slice(6, 8)}T${cycle.slice(8, 10)}:00:00Z`);
}

function latestForecastCycle(now) {
  const date = new Date(now);
  date.setUTCHours(date.getUTCHours() - 18, 0, 0, 0);
  const hour = date.getUTCHours() >= 12 ? 12 : 0;
  date.setUTCHours(hour, 0, 0, 0);
  return formatCycle(date);
}

function forecastHours(config = {}, cycle = null) {
  if (Array.isArray(config.forecastValidTimes) && cycle) {
    const cycleMs = parseCycle(cycle).getTime();
    return config.forecastValidTimes
      .map(value => Math.round((new Date(value).getTime() - cycleMs) / (60 * 60 * 1000)))
      .filter(hour => Number.isInteger(hour) && hour >= 0 && hour <= 120);
  }

  const windowHours = Math.min(Number(config.forecastHours) || 48, 48);
  const stepHours = Math.max(1, Number(config.forecastStepHours) || 3);
  const out = [];
  for (let hour = 0; hour <= windowHours; hour += stepHours) {
    out.push(hour);
  }
  return out;
}

function normalizeBbox(bbox) {
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

class CamsAerosolSourceService {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(os.homedir(), '.xiake');
    this.now = options.now || null;
    this.batchForecastCount = options.batchForecastCount || 1;
    this.downloader = Object.prototype.hasOwnProperty.call(options, 'downloader')
      ? options.downloader
      : new CamsCdsDownloaderService();
    this.parser = Object.prototype.hasOwnProperty.call(options, 'parser')
      ? options.parser
      : new CamsNetcdfParserService();
  }

  buildRequestPlan(config = {}) {
    const bbox = normalizeBbox(config.bbox || { north: 54, south: 18, west: 73, east: 135 });
    const resolution = Number(config.resolution || 0.5);
    const cycle = config.camsForecastCycle || config.camsCycle || latestForecastCycle(this.now || new Date());
    const hours = forecastHours(config, cycle);
    const batches = hours.map(forecastHour => this._buildForecastBatch({ cycle, bbox, resolution, forecastHour }));

    return {
      source: 'cams',
      cycle,
      bbox,
      resolution,
      forecastHours: hours,
      variables: FIELD_WHITELIST.slice(),
      batches,
      estimatedBytes: batches.reduce((sum, batch) => sum + batch.estimatedBytes, 0)
    };
  }

  normalizeGridProduct(batch, records = []) {
    const forecastHour = batch.productType === 'analysis' ? null : (batch.forecastHours.length === 1 ? batch.forecastHours[0] : null);
    const validTime = batch.productType === 'analysis'
      ? parseCycle(batch.cycle).toISOString()
      : (Number.isFinite(forecastHour)
        ? new Date(parseCycle(batch.cycle).getTime() + forecastHour * 60 * 60 * 1000).toISOString()
        : null);
    const points = records.map(record => ({
      lat: Number(record.lat),
      lon: Number(record.lon),
      weather: {},
      aerosol: this._pickFields(record.values || {}),
      sourceMeta: {
        camsProductType: batch.productType || 'forecast',
        camsForecastHour: Number.isFinite(record.forecastHour) ? record.forecastHour : (batch.forecastHours || [])[0],
        interpolation: 'deferred-bilinear'
      }
    }));

    return {
      source: 'cams',
      productType: 'aerosol_grid',
      schemaVersion: 1,
      cycle: batch.cycle,
      forecastHour,
      forecastHours: batch.forecastHours.slice(),
      validTime,
      grid: {
        bbox: clone(batch.bbox),
        resolution: batch.resolution
      },
      interpolation: {
        targetResolution: batch.resolution,
        method: 'deferred-bilinear'
      },
      fields: FIELD_WHITELIST.filter(field => points.some(point => point.aerosol[field] !== undefined)),
      points,
      sourceMeta: {
        requestId: batch.requestId,
        rawPath: batch.rawPath,
        productType: batch.productType || 'forecast'
      }
    };
  }

  async downloadBatch(batch) {
    if (this.downloader && typeof this.downloader.downloadBatch === 'function') {
      return this.downloader.downloadBatch(batch);
    }
    const err = new Error('CAMS downloader is not configured; configure an ADS/CDS API downloader before real aerosol runs');
    err.code = 'CAMS_DOWNLOADER_NOT_CONFIGURED';
    throw err;
  }

  async readGridRecords(batch) {
    if (this.parser && typeof this.parser.readGridRecords === 'function') {
      return this.parser.readGridRecords(batch);
    }
    const err = new Error('CAMS NetCDF parser is not configured; install/configure netCDF/xarray parser before real aerosol runs');
    err.code = 'CAMS_NETCDF_PARSER_NOT_CONFIGURED';
    throw err;
  }

  _buildForecastBatch({ cycle, bbox, resolution, forecastHour }) {
    const estimatedBytes = Math.ceil(
      CAMS_GLOBAL_FIELD_BYTES_PER_CYCLE *
      (gridPointCount(bbox, resolution) / GLOBAL_CAMS_GRID_POINTS) *
      (1 / 17)
    );
    const paddedHour = pad(forecastHour, 3);

    return {
      id: `cams_${cycle}_f${paddedHour}`,
      requestId: `cams:${cycle}:f${paddedHour}`,
      source: 'cams',
      productType: 'forecast',
      cycle,
      forecastHour,
      forecastHours: [forecastHour],
      bbox: clone(bbox),
      resolution,
      variables: FIELD_WHITELIST.slice(),
      request: {
        dataset: 'cams-global-atmospheric-composition-forecasts',
        productType: 'forecast',
        type: 'forecast',
        format: 'netcdf',
        date: `${cycle.slice(0, 4)}-${cycle.slice(4, 6)}-${cycle.slice(6, 8)}`,
        time: `${cycle.slice(8, 10)}:00`,
        leadtime_hour: [String(forecastHour)],
        variable: FIELD_WHITELIST.slice(),
        area: [bbox.north, bbox.west, bbox.south, bbox.east]
      },
      rawPath: path.join(this.dataDir, 'data', 'raw', 'cams', cycle, `cams_${cycle}_f${paddedHour}.nc`),
      estimatedBytes,
      cleanupRawAfterProcess: true,
      degradeOnFailure: true
    };
  }

  _pickFields(values) {
    return FIELD_WHITELIST.reduce((acc, field) => {
      if (values[field] !== undefined) acc[field] = values[field];
      return acc;
    }, {});
  }
}

CamsAerosolSourceService.FIELD_WHITELIST = FIELD_WHITELIST;

module.exports = CamsAerosolSourceService;
