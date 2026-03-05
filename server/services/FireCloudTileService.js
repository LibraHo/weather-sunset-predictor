const CacheService = require('./CacheService');
const cacheConfig = require('../config/cacheConfig');

class FireCloudTileService {
  constructor() {
    this.cacheService = new CacheService({ defaultTTL: cacheConfig.ttl.FIRECLOUD_OVERLAY });
    // 256x256 红橙渐变占位 PNG（PoC 用）
    this.placeholderTilePng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAIAAADTED8xAAABhUlEQVR42u3TMQEAIAzAMMC/5yFjRxMFPXpn5gBA1w0A8N0AAN8NAPA9AADfDQDw3QAA3w0A8N0AAN8NAPA9AADfDQDw3QAA3w0A8N0AAN8NAPA9AADfDQDw3QAA3w0A8N0AAN8NAPA9AADfDQDw3QAA3w0A8N0AAN8NAPA9AADfDQDw3QAA3w0A8N0AAN8NAPA9AADfDQDw3QAA3w0A8N0AAN8NAPA9AADfDQDw3QAA3w0A8N0AAN8NAPA9AADfDQDw3QAA3w0A8N0AAN8NAPA9AADfDQDw3QAA3w0A8N0AAN8NAPA9AADfDQDw3QAA3w0A8N0AAN8NAPA9AADfDQDw3QAA3w0A8N0AAN8NAPA9AADfDQDw3QAA3w0A8N0AAN8NAPA9AADfDQDw3QAA3w0A8N0AAN8NAPA9AADfDQDw3QAA3w0A8N0AAN8NAPA9AADfDQDw3QAA3w0A8N0AAN8NAPDdAABfCx8vNs2sIE4AAAAASUVORK5CYII=',
      'base64'
    );
  }

  async getGrid({ bbox, zoom = 6, time = Date.now() }) {
    const key = cacheConfig.buildKey('FIRECLOUD_GRID', `${bbox}_${zoom}_${time}`);
    const cached = await this.cacheService.get(key);
    if (cached) return cached;

    const [west, south, east, north] = bbox.split(',').map(Number);
    const cols = Math.min(128, Math.max(16, Math.round(zoom * 8)));
    const rows = cols;

    const cellWidth = (east - west) / cols;
    const cellHeight = (north - south) / rows;

    const values = [];
    for (let y = 0; y < rows; y++) {
      const row = [];
      for (let x = 0; x < cols; x++) {
        const nx = x / cols;
        const ny = y / rows;
        const score = Math.round(
          Math.max(0, Math.min(100, 65 + 35 * Math.sin(nx * Math.PI * 2) * Math.cos(ny * Math.PI * 2)))
        );
        row.push(score);
      }
      values.push(row);
    }

    const payload = {
      type: 'FeatureCollection',
      meta: {
        source: 'firecloud-grid-poc',
        zoom,
        time: Number(time),
        bbox: { west, south, east, north },
        resolution: { rows, cols, cellWidth, cellHeight }
      },
      values
    };

    await this.cacheService.set(key, payload);
    return payload;
  }

  async getTilePng({ z, x, y, time = Date.now() }) {
    const key = cacheConfig.buildKey('FIRECLOUD_TILE', `${z}_${x}_${y}_${time}`);
    const cached = await this.cacheService.get(key);
    if (cached) return Buffer.from(cached, 'base64');

    // Phase 11 PoC：先返回固定瓦片，后续迭代替换为服务端实时渲染
    const encoded = this.placeholderTilePng.toString('base64');
    await this.cacheService.set(key, encoded);
    return this.placeholderTilePng;
  }
}

module.exports = FireCloudTileService;
