'use strict';

const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');

const DATA_DIR = path.join(os.homedir(), '.xiake');
const CACHE_FILE = path.join(DATA_DIR, 'ip-location-cache.json');
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FAILED_CACHE_TTL_MS = 60 * 60 * 1000;
const LOOKUP_TIMEOUT_MS = 3000;

class IpLocationService {
  constructor(options = {}) {
    this._cacheFile = options.cacheFile || CACHE_FILE;
    this._lookupHost = options.lookupHost || 'ip-api.com';
    this._cache = {};
    this._pending = new Set();
    this._load();
  }

  getDisplayLocation(ip) {
    const normalized = this.normalizeIp(ip);
    const localLocation = this._getLocalLocation(normalized);
    if (localLocation) return localLocation;

    const cached = this._cache[normalized];
    const ttl = cached?.failed ? FAILED_CACHE_TTL_MS : CACHE_TTL_MS;
    if (cached && Date.now() - cached.resolvedAt < ttl) {
      return cached.location || '未知归属地';
    }

    this._scheduleLookup(normalized);
    return cached?.location || '查询中';
  }

  normalizeIp(ip) {
    if (!ip) return 'unknown';
    let value = String(ip).split(',')[0].trim();

    if (value.startsWith('::ffff:')) {
      value = value.slice(7);
    }

    if (value.startsWith('[')) {
      const end = value.indexOf(']');
      if (end > 0) value = value.slice(1, end);
    } else {
      const portMatch = value.match(/^(\d+\.\d+\.\d+\.\d+):\d+$/);
      if (portMatch) value = portMatch[1];
    }

    return value || 'unknown';
  }

  _getLocalLocation(ip) {
    if (!ip || ip === 'unknown') return '未知';
    if (ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') return '本机';

    const version = net.isIP(ip);
    if (version === 4) {
      const parts = ip.split('.').map(Number);
      if (parts[0] === 10) return '内网';
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return '内网';
      if (parts[0] === 192 && parts[1] === 168) return '内网';
      if (parts[0] === 169 && parts[1] === 254) return '链路本地';
      if (parts[0] === 0) return '保留地址';
      return null;
    }

    if (version === 6) {
      const lower = ip.toLowerCase();
      if (lower.startsWith('fc') || lower.startsWith('fd')) return '内网';
      if (lower.startsWith('fe80')) return '链路本地';
      return null;
    }

    return '未知';
  }

  _scheduleLookup(ip) {
    if (!ip || this._pending.has(ip) || this._getLocalLocation(ip)) return;

    this._pending.add(ip);
    this._lookupPublicIp(ip)
      .then((location) => {
        this._cache[ip] = {
          location,
          resolvedAt: Date.now()
        };
        this._persist();
      })
      .catch(() => {
        this._cache[ip] = {
          location: '未知归属地',
          resolvedAt: Date.now(),
          failed: true
        };
        this._persist();
      })
      .finally(() => {
        this._pending.delete(ip);
      });
  }

  _lookupPublicIp(ip) {
    return new Promise((resolve, reject) => {
      const pathName = `/json/${encodeURIComponent(ip)}?fields=status,country,regionName,city,query,message`;
      const req = http.get({
        host: this._lookupHost,
        path: pathName,
        timeout: LOOKUP_TIMEOUT_MS
      }, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', chunk => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data.status !== 'success') {
              reject(new Error(data.message || 'lookup failed'));
              return;
            }

            const parts = [data.country, data.regionName, data.city]
              .filter(Boolean)
              .filter((value, index, arr) => arr.indexOf(value) === index);
            resolve(parts.length ? parts.join(' / ') : '未知归属地');
          } catch (err) {
            reject(err);
          }
        });
      });

      req.on('timeout', () => {
        req.destroy(new Error('ip location lookup timeout'));
      });
      req.on('error', reject);
    });
  }

  _load() {
    try {
      if (!fs.existsSync(this._cacheFile)) return;
      const raw = JSON.parse(fs.readFileSync(this._cacheFile, 'utf8'));
      if (raw && typeof raw === 'object') {
        this._cache = raw;
      }
    } catch (err) {
      console.warn('[IpLocationService] load failed:', err.message);
    }
  }

  _persist() {
    try {
      const dir = path.dirname(this._cacheFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this._cacheFile, JSON.stringify(this._cache, null, 2), 'utf8');
    } catch (err) {
      console.warn('[IpLocationService] persist failed:', err.message);
    }
  }
}

module.exports = new IpLocationService();
module.exports.IpLocationService = IpLocationService;
