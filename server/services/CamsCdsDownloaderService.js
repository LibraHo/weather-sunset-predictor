'use strict';

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

class CamsCdsDownloaderService {
  constructor(options = {}) {
    this.pythonPath = options.pythonPath
      || process.env.CAMS_DOWNLOADER_PYTHON
      || process.env.CAMS_PYTHON
      || '/root/.xiake/venv-cams/bin/python';
    this.scriptPath = options.scriptPath
      || process.env.CAMS_DOWNLOADER_SCRIPT
      || path.join(__dirname, '..', 'scripts', 'cams_cds_downloader.py');
    this.timeoutMs = Number(options.timeoutMs || process.env.CAMS_DOWNLOADER_TIMEOUT_MS || 10 * 60 * 1000);
    this.maxBuffer = Number(options.maxBuffer || 8 * 1024 * 1024);
  }

  async downloadBatch(batch = {}) {
    if (!batch.rawPath || !batch.request) {
      const err = new Error('CAMS batch is missing rawPath or request');
      err.code = 'CAMS_DOWNLOAD_BATCH_INVALID';
      throw err;
    }

    fs.mkdirSync(path.dirname(batch.rawPath), { recursive: true });
    const requestPath = `${batch.rawPath}.request.json`;
    fs.writeFileSync(requestPath, JSON.stringify(batch.request, null, 2), 'utf8');

    try {
      const stdout = await this._exec([
        this.scriptPath,
        '--request-json', requestPath,
        '--output', batch.rawPath
      ]);
      const parsed = JSON.parse(stdout);
      return {
        bytesDownloaded: Number(parsed.bytesDownloaded) || 0,
        rawPath: batch.rawPath
      };
    } catch (err) {
      if (err instanceof SyntaxError) {
        const parseErr = new Error(`CAMS downloader returned invalid JSON: ${err.message}`);
        parseErr.code = 'CAMS_DOWNLOADER_INVALID_JSON';
        throw parseErr;
      }
      throw err;
    } finally {
      fs.rmSync(requestPath, { force: true });
    }
  }

  _exec(args) {
    return new Promise((resolve, reject) => {
      execFile(this.pythonPath, args, {
        timeout: this.timeoutMs,
        maxBuffer: this.maxBuffer,
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1'
        }
      }, (error, stdout, stderr) => {
        if (error) {
          const codeMatch = String(stderr || '').match(/CAMS_[A-Z0-9_]+/);
          const err = new Error(`CAMS downloader failed: ${stderr || error.message}`);
          err.code = error.killed ? 'CAMS_DOWNLOADER_TIMEOUT' : (codeMatch ? codeMatch[0] : 'CAMS_DOWNLOAD_FAILED');
          err.stderr = stderr;
          reject(err);
          return;
        }
        resolve(stdout);
      });
    });
  }
}

module.exports = CamsCdsDownloaderService;
