'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const DataPipelineRunLogService = require('./DataPipelineRunLogService');

function nowMsFrom(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'function') return value().getTime();
  return Date.now();
}

class DataPipelineCleanupService {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(os.homedir(), '.xiake');
    this.rawDir = options.rawDir || path.join(this.dataDir, 'data', 'raw');
    this.tmpDir = options.tmpDir || path.join(this.dataDir, 'data', 'tmp');
    this.gridProductDir = options.gridProductDir || path.join(this.dataDir, 'data', 'cache', 'grid-products');
    this.tileDir = options.tileDir || path.join(this.dataDir, 'data', 'cache', 'tiles');
    this.manifestPath = options.manifestPath || path.join(this.gridProductDir, 'manifest.json');
    this.runLogService = options.runLogService || new DataPipelineRunLogService({ dataDir: this.dataDir });
    this.now = options.now || null;
  }

  cleanup(policy = {}, options = {}) {
    const dryRun = options.dryRun === true;
    const deletedFiles = [];
    let deletedBytes = 0;
    const removeResult = result => {
      deletedFiles.push(...result.deletedFiles);
      deletedBytes += result.deletedBytes;
    };

    removeResult(this._deleteOlderThan(this.rawDir, (Number(policy.deleteRawAfterMinutes) || 60) * 60 * 1000, { dryRun }));
    removeResult(this._deleteOlderThan(this.tmpDir, (Number(policy.deleteTmpAfterHours) || 3) * 60 * 60 * 1000, { dryRun }));
    removeResult(this._deleteOlderThan(this.gridProductDir, (Number(policy.keepCacheDays) || 3) * 24 * 60 * 60 * 1000, {
      excludeNames: new Set(['manifest.json']),
      dryRun
    }));
    removeResult(this._deleteOlderThan(this.tileDir, (Number(policy.keepTileDays) || 3) * 24 * 60 * 60 * 1000, { dryRun }));

    const removedProducts = this._syncGridManifest({ dryRun });
    const prune = typeof this.runLogService.pruneOlderThan === 'function'
      ? (dryRun ? { prunedRuns: 0, prunedSteps: 0 } : this.runLogService.pruneOlderThan({ olderThanDays: Number(policy.keepLogDays) || 7 }))
      : { prunedRuns: 0, prunedSteps: 0 };

    return {
      dryRun,
      deletedFiles,
      deletedBytes,
      removedProducts,
      prunedRuns: prune.prunedRuns,
      prunedSteps: prune.prunedSteps
    };
  }

  _deleteOlderThan(root, maxAgeMs, options = {}) {
    const deletedFiles = [];
    let deletedBytes = 0;
    if (!fs.existsSync(root)) return { deletedFiles, deletedBytes };
    const cutoff = nowMsFrom(this.now) - maxAgeMs;

    for (const filePath of this._walkFiles(root)) {
      if (options.excludeNames?.has(path.basename(filePath))) continue;
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs >= cutoff) continue;
      if (options.dryRun !== true) {
        fs.unlinkSync(filePath);
      }
      deletedFiles.push(filePath);
      deletedBytes += stat.size;
    }

    if (options.dryRun !== true) {
      this._removeEmptyDirs(root);
    }
    return { deletedFiles, deletedBytes };
  }

  _syncGridManifest(options = {}) {
    if (!fs.existsSync(this.manifestPath)) return 0;
    try {
      const manifest = JSON.parse(fs.readFileSync(this.manifestPath, 'utf8'));
      const products = Array.isArray(manifest.products) ? manifest.products : [];
      const kept = products.filter(item => {
        const productPath = item.path || path.join(this.gridProductDir, `${item.productId}.json`);
        return fs.existsSync(productPath);
      });
      if (options.dryRun === true) {
        return products.length - kept.length;
      }
      fs.writeFileSync(this.manifestPath, JSON.stringify({
        ...manifest,
        products: kept
      }, null, 2), 'utf8');
      return products.length - kept.length;
    } catch (err) {
      return 0;
    }
  }

  _walkFiles(root) {
    const out = [];
    for (const name of fs.readdirSync(root)) {
      const filePath = path.join(root, name);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        out.push(...this._walkFiles(filePath));
      } else {
        out.push(filePath);
      }
    }
    return out;
  }

  _removeEmptyDirs(root) {
    if (!fs.existsSync(root)) return;
    for (const name of fs.readdirSync(root)) {
      const filePath = path.join(root, name);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        this._removeEmptyDirs(filePath);
      }
    }
    if (root !== this.dataDir && fs.existsSync(root) && fs.readdirSync(root).length === 0) {
      fs.rmdirSync(root);
    }
  }
}

module.exports = DataPipelineCleanupService;
