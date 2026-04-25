/**
 * ApiAgentAuditLog.js - 需求45 审计日志服务
 *
 * 记录 /api/agent/* 调用日志，字段包含：
 * tokenId / endpoint / status / elapsedMs / createdAt / ipHash / userAgent / errorCode
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const XIAKE_DATA_DIR = process.env.XIAKE_DATA_DIR || path.join(os.homedir(), '.xiake');
const AUDIT_FILE = process.env.API_AGENT_AUDIT_LOG_PATH || path.join(XIAKE_DATA_DIR, 'agent-audit-logs.json');
const DEFAULT_IP_SALT = process.env.SERVER_TOKEN_SECRET || 'xiake-agent-audit';

const MAX_RECORDS = 1000;

class ApiAgentAuditLog {
  constructor() {
    this.auditFile = AUDIT_FILE;
    this.ipSalt = process.env.API_AGENT_IP_HASH_SALT || DEFAULT_IP_SALT;
    this._records = [];
    this._load();
  }

  _ensureDir() {
    fs.mkdirSync(path.dirname(this.auditFile), { recursive: true });
  }

  _load() {
    try {
      if (fs.existsSync(this.auditFile)) {
        const raw = JSON.parse(fs.readFileSync(this.auditFile, 'utf8'));
        if (Array.isArray(raw?.records)) {
          this._records = raw.records.slice(-MAX_RECORDS);
        }
      }
    } catch (err) {
      console.warn('[ApiAgentAuditLog] 读取日志失败:', err.message);
      this._records = [];
    }
  }

  _persist() {
    try {
      this._ensureDir();
      const payload = {
        schemaVersion: 1,
        updatedAt: new Date().toISOString(),
        records: this._records
      };
      const tmp = `${this.auditFile}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf8');
      fs.renameSync(tmp, this.auditFile);
    } catch (err) {
      console.warn('[ApiAgentAuditLog] 持久化日志失败:', err.message);
    }
  }

  _hashIp(ip = '') {
    return crypto.createHash('sha256').update(`${String(ip)}|${this.ipSalt}`).digest('hex');
  }

  _normalizeUserAgent(rawUA = '') {
    return String(rawUA || '').slice(0, 120);
  }

  _getClientIP(req) {
    const forwarded = req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip']);
    if (forwarded) {
      return String(forwarded).split(',')[0].trim();
    }
    return req.ip || req.connection?.remoteAddress || 'unknown';
  }

  add(opts = {}) {
    const record = {
      createdAt: new Date().toISOString(),
      tokenId: opts.tokenId || null,
      endpoint: opts.endpoint || '',
      status: Number(opts.status) || 0,
      elapsedMs: Number.isFinite(opts.elapsedMs) ? Math.max(0, Math.round(opts.elapsedMs)) : null,
      ipHash: this._hashIp(opts.ip || ''),
      userAgent: this._normalizeUserAgent(opts.userAgent),
      errorCode: opts.errorCode || null
    };

    this._records.push(record);
    if (this._records.length > MAX_RECORDS) {
      this._records = this._records.slice(-MAX_RECORDS);
    }

    this._persist();
    return record;
  }

  fromRequest(req, result = {}) {
    const ip = this._getClientIP(req);
    const tokenId = result?.token?.id || null;
    return this.add({
      tokenId,
      endpoint: result.endpoint || req?.path || req?.originalUrl || '',
      status: result.status,
      elapsedMs: result.elapsedMs,
      ip,
      userAgent: req?.headers?.['user-agent'],
      errorCode: result.errorCode
    });
  }

  list(limit = 50) {
    const n = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    return this._records
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, n);
  }
}

module.exports = new ApiAgentAuditLog();
