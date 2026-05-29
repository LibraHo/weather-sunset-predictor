'use strict';

const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');

const GfsCfgribParserService = require('./GfsCfgribParserService');

const FIELD_WHITELIST = [
  'TCDC', 'LCDC', 'MCDC', 'HCDC', 'RH', 'VIS',
  'APCP', 'PRATE', 'PWAT', 'DSWRF', 'TMP', 'UGRD', 'VGRD'
];

const LEVEL_FILTERS = [
  'lev_entire_atmosphere=on',
  'lev_entire_atmosphere_%28considered_as_a_single_layer%29=on',
  'lev_surface=on',
  'lev_2_m_above_ground=on',
  'lev_10_m_above_ground=on',
  'lev_low_cloud_layer=on',
  'lev_middle_cloud_layer=on',
  'lev_high_cloud_layer=on'
];

const GLOBAL_GFS_GRID_POINTS = 721 * 1440;
const GFS_GLOBAL_FIELD_BYTES_PER_HOUR = 29 * 1024 * 1024;

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

function latestCycle(now) {
  const date = new Date(now);
  const hour = Math.floor(date.getUTCHours() / 6) * 6;
  date.setUTCHours(hour, 0, 0, 0);
  return formatCycle(date);
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

class GfsGridSourceService {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(os.homedir(), '.xiake');
    this.now = options.now || null;
    this.baseUrl = options.baseUrl || 'https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl';
    this.downloadUrl = options.downloadUrl || downloadUrlToFile;
    this.parser = Object.prototype.hasOwnProperty.call(options, 'parser')
      ? options.parser
      : new GfsCfgribParserService();
  }

  buildRequestPlan(config = {}) {
    const bbox = normalizeBbox(config.bbox || { north: 54, south: 18, west: 73, east: 135 });
    const resolution = Number(config.resolution || 0.5);
    const forecastHours = Number.isFinite(Number(config.forecastHours)) ? Number(config.forecastHours) : 48;
    const forecastStepHours = Number.isFinite(Number(config.forecastStepHours)) ? Number(config.forecastStepHours) : 1;
    const cycle = config.cycle || latestCycle(this.now || new Date());
    const hours = [];

    for (let hour = 0; hour <= Math.min(forecastHours, 48); hour += forecastStepHours) {
      hours.push(hour);
    }

    const batches = hours.map(hour => this._buildBatch({ cycle, forecastHour: hour, bbox, resolution }));
    return {
      source: 'gfs',
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
    const validTime = new Date(parseCycle(batch.cycle).getTime() + batch.forecastHour * 60 * 60 * 1000).toISOString();
    const points = records.map(record => ({
      lat: Number(record.lat),
      lon: Number(record.lon),
      weather: this._pickFields(record.values || {}),
      aerosol: {},
      sourceMeta: { gfsForecastHour: batch.forecastHour }
    }));

    return {
      source: 'gfs',
      productType: 'weather_grid',
      schemaVersion: 1,
      cycle: batch.cycle,
      forecastHour: batch.forecastHour,
      validTime,
      grid: {
        bbox: clone(batch.bbox),
        resolution: batch.resolution
      },
      fields: FIELD_WHITELIST.filter(field => points.some(point => point.weather[field] !== undefined)),
      points,
      sourceMeta: {
        requestId: batch.requestId,
        idxUrl: batch.idxUrl,
        dataUrl: batch.dataUrl,
        rawPath: batch.rawPath
      }
    };
  }

  async downloadBatch(batch) {
    if (!batch?.dataUrl || !batch?.rawPath) {
      const err = new Error('GFS batch is missing dataUrl or rawPath');
      err.code = 'GFS_DOWNLOAD_BATCH_INVALID';
      throw err;
    }
    return this.downloadUrl(batch.dataUrl, batch.rawPath);
  }

  async readGridRecords(batch) {
    if (this.parser && typeof this.parser.readGridRecords === 'function') {
      return this.parser.readGridRecords(batch);
    }
    const err = new Error('GFS GRIB2 parser is not configured; install/configure wgrib2 or cfgrib parser before real runs');
    err.code = 'GFS_GRIB_PARSER_NOT_CONFIGURED';
    throw err;
  }

  _buildBatch({ cycle, forecastHour, bbox, resolution }) {
    const forecastToken = `f${pad(forecastHour, 3)}`;
    const file = `gfs.t${cycle.slice(8, 10)}z.pgrb2.0p25.${forecastToken}`;
    const dir = `/gfs.${cycle.slice(0, 8)}/${cycle.slice(8, 10)}/atmos`;
    const query = [
      `file=${file}`,
      ...FIELD_WHITELIST.map(field => `var_${field}=on`),
      ...LEVEL_FILTERS,
      `leftlon=${bbox.west}`,
      `rightlon=${bbox.east}`,
      `toplat=${bbox.north}`,
      `bottomlat=${bbox.south}`,
      `dir=${dir}`
    ].join('&');
    const estimatedBytes = Math.ceil(GFS_GLOBAL_FIELD_BYTES_PER_HOUR * (gridPointCount(bbox, resolution) / GLOBAL_GFS_GRID_POINTS));

    return {
      id: `gfs_${cycle}_${forecastToken}`,
      requestId: `gfs:${cycle}:${forecastToken}`,
      source: 'gfs',
      cycle,
      forecastHour,
      bbox: clone(bbox),
      resolution,
      variables: FIELD_WHITELIST.slice(),
      idxUrl: `https://nomads.ncep.noaa.gov/pub/data/nccf/com/gfs/prod/gfs.${cycle.slice(0, 8)}/${cycle.slice(8, 10)}/atmos/${file}.idx`,
      dataUrl: `${this.baseUrl}?${query}`,
      rawPath: path.join(this.dataDir, 'data', 'raw', 'gfs', cycle, `${file}.grib2`),
      estimatedBytes,
      cleanupRawAfterProcess: true
    };
  }

  _pickFields(values) {
    return FIELD_WHITELIST.reduce((acc, field) => {
      if (values[field] !== undefined) acc[field] = values[field];
      return acc;
    }, {});
  }
}

function downloadUrlToFile(url, targetPath) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    const tmpPath = `${targetPath}.download`;
    const file = fs.createWriteStream(tmpPath);
    let bytesDownloaded = 0;

    const request = https.get(url, response => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        file.destroy();
        fs.rmSync(tmpPath, { force: true });
        const err = new Error(`GFS download failed with HTTP ${response.statusCode}`);
        err.code = 'GFS_DOWNLOAD_HTTP_ERROR';
        response.resume();
        reject(err);
        return;
      }

      response.on('data', chunk => {
        bytesDownloaded += chunk.length;
      });
      response.pipe(file);
    });

    request.on('error', err => {
      file.destroy();
      fs.rmSync(tmpPath, { force: true });
      err.code = err.code || 'GFS_DOWNLOAD_FAILED';
      reject(err);
    });

    file.on('finish', () => {
      file.close(() => {
        fs.renameSync(tmpPath, targetPath);
        resolve({ bytesDownloaded, rawPath: targetPath });
      });
    });
    file.on('error', err => {
      fs.rmSync(tmpPath, { force: true });
      err.code = err.code || 'GFS_DOWNLOAD_WRITE_FAILED';
      reject(err);
    });
  });
}

GfsGridSourceService.FIELD_WHITELIST = FIELD_WHITELIST;

module.exports = GfsGridSourceService;
