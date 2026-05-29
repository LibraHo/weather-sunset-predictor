'use strict';

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

class GfsCfgribParserService {
  constructor(options = {}) {
    this.pythonPath = options.pythonPath
      || process.env.GFS_GRIB_PARSER_PYTHON
      || '/root/.xiake/venv-gfs/bin/python';
    this.scriptPath = options.scriptPath
      || process.env.GFS_GRIB_PARSER_SCRIPT
      || path.join(__dirname, '..', 'scripts', 'gfs_grid_parser.py');
    this.timeoutMs = Number(options.timeoutMs || process.env.GFS_GRIB_PARSER_TIMEOUT_MS || 120000);
    this.maxBuffer = Number(options.maxBuffer || 32 * 1024 * 1024);
  }

  async readGridRecords(batch = {}) {
    if (!batch.rawPath || !fs.existsSync(batch.rawPath)) {
      const err = new Error(`GFS raw file not found: ${batch.rawPath || 'missing rawPath'}`);
      err.code = 'GFS_RAW_FILE_NOT_FOUND';
      throw err;
    }

    const bbox = batch.bbox || {};
    const args = [
      this.scriptPath,
      '--input', batch.rawPath,
      '--resolution', String(batch.resolution || 0.5),
      '--north', String(bbox.north),
      '--south', String(bbox.south),
      '--west', String(bbox.west),
      '--east', String(bbox.east),
    ];

    const stdout = await this._exec(args);
    let parsed;
    try {
      parsed = JSON.parse(stdout);
    } catch (err) {
      const parseErr = new Error(`GFS parser returned invalid JSON: ${err.message}`);
      parseErr.code = 'GFS_GRIB_PARSER_INVALID_JSON';
      throw parseErr;
    }

    if (!Array.isArray(parsed.records)) {
      const err = new Error('GFS parser output is missing records array');
      err.code = 'GFS_GRIB_PARSER_INVALID_OUTPUT';
      throw err;
    }
    return parsed.records;
  }

  _exec(args) {
    return new Promise((resolve, reject) => {
      execFile(this.pythonPath, args, {
        timeout: this.timeoutMs,
        maxBuffer: this.maxBuffer,
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1',
        },
      }, (error, stdout, stderr) => {
        if (error) {
          const err = new Error(`GFS GRIB2 parser failed: ${stderr || error.message}`);
          err.code = error.killed ? 'GFS_GRIB_PARSER_TIMEOUT' : 'GFS_GRIB_PARSER_FAILED';
          err.stderr = stderr;
          reject(err);
          return;
        }
        resolve(stdout);
      });
    });
  }
}

module.exports = GfsCfgribParserService;
