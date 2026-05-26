'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createHash } = require('crypto');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nowFrom(value) {
  return value ? new Date(value) : new Date();
}

class GridProductCacheService {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(os.homedir(), '.xiake');
    this.cacheDir = options.cacheDir || path.join(this.dataDir, 'data', 'cache', 'grid-products');
    this.rawDir = options.rawDir || path.join(this.dataDir, 'data', 'raw');
    this.manifestPath = options.manifestPath || path.join(this.cacheDir, 'manifest.json');
    this.now = options.now || null;
    this.freeDiskBytes = options.freeDiskBytes;
    this.minFreeDiskGb = Number.isFinite(Number(options.minFreeDiskGb)) ? Number(options.minFreeDiskGb) : 3;
  }

  writeProduct(product) {
    const normalized = this._normalizeProduct(product);
    const payload = JSON.stringify(normalized, null, 2);
    const byteSize = Buffer.byteLength(payload, 'utf8');
    this._assertDiskSafe(byteSize);

    fs.mkdirSync(this.cacheDir, { recursive: true });
    const productPath = path.join(this.cacheDir, `${normalized.productId}.json`);
    fs.writeFileSync(productPath, payload, 'utf8');

    const manifest = this.listManifest();
    const entry = {
      productId: normalized.productId,
      source: normalized.source,
      productType: normalized.productType,
      cycle: normalized.cycle || null,
      forecastHour: Number.isFinite(normalized.forecastHour) ? normalized.forecastHour : null,
      forecastHours: Array.isArray(normalized.forecastHours) ? normalized.forecastHours.slice() : null,
      validTime: normalized.validTime || null,
      grid: clone(normalized.grid),
      fields: normalized.fields.slice(),
      pointCount: normalized.points.length,
      byteSize,
      path: productPath,
      createdAt: normalized.createdAt
    };

    manifest.products = [entry, ...manifest.products.filter(item => item.productId !== normalized.productId)];
    fs.writeFileSync(this.manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    return entry;
  }

  readProduct(productId) {
    const productPath = path.join(this.cacheDir, `${productId}.json`);
    if (!fs.existsSync(productPath)) return null;
    return JSON.parse(fs.readFileSync(productPath, 'utf8'));
  }

  listManifest() {
    try {
      if (!fs.existsSync(this.manifestPath)) {
        return { schemaVersion: 1, products: [] };
      }
      const parsed = JSON.parse(fs.readFileSync(this.manifestPath, 'utf8'));
      return {
        schemaVersion: parsed.schemaVersion || 1,
        products: Array.isArray(parsed.products) ? parsed.products : []
      };
    } catch (err) {
      console.warn('[GridProductCache] manifest read failed:', err.message);
      return { schemaVersion: 1, products: [] };
    }
  }

  getLatestProduct(filter = {}) {
    const entry = this.listManifest().products.find(item => {
      if (filter.source && item.source !== filter.source) return false;
      if (filter.productType && item.productType !== filter.productType) return false;
      return true;
    });
    return entry ? this.readProduct(entry.productId) : null;
  }

  cleanupRawTmp({ olderThanMinutes = 60 } = {}) {
    const cutoff = nowFrom(this.now).getTime() - olderThanMinutes * 60 * 1000;
    const deletedFiles = [];
    if (!fs.existsSync(this.rawDir)) return { deletedFiles };

    for (const filePath of this._walkFiles(this.rawDir)) {
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(filePath);
        deletedFiles.push(filePath);
      }
    }
    return { deletedFiles };
  }

  _normalizeProduct(product) {
    const createdAt = nowFrom(this.now).toISOString();
    const base = {
      schemaVersion: product.schemaVersion || 1,
      source: product.source,
      productType: product.productType,
      cycle: product.cycle || null,
      forecastHour: Number.isFinite(product.forecastHour) ? product.forecastHour : null,
      forecastHours: Array.isArray(product.forecastHours) ? product.forecastHours.slice() : null,
      validTime: product.validTime || null,
      grid: clone(product.grid || {}),
      fields: Array.isArray(product.fields) ? product.fields.slice() : [],
      points: Array.isArray(product.points) ? clone(product.points) : [],
      sourceMeta: clone(product.sourceMeta || {}),
      createdAt
    };
    const hash = createHash('sha1')
      .update(JSON.stringify({
        source: base.source,
        productType: base.productType,
        cycle: base.cycle,
        forecastHour: base.forecastHour,
        forecastHours: base.forecastHours,
        validTime: base.validTime,
        grid: base.grid,
        fields: base.fields
      }))
      .digest('hex')
      .slice(0, 12);
    return {
      productId: `${base.source}_${base.productType}_${base.cycle || 'nocycle'}_${hash}`,
      ...base
    };
  }

  _assertDiskSafe(byteSize) {
    if (!Number.isFinite(this.freeDiskBytes)) return;
    const minFreeBytes = this.minFreeDiskGb * 1024 ** 3;
    if (this.freeDiskBytes - byteSize < minFreeBytes) {
      const err = new Error(`free disk would fall below ${this.minFreeDiskGb}GB`);
      err.code = 'GRID_PRODUCT_LOW_DISK';
      throw err;
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
}

module.exports = GridProductCacheService;
