/**
 * ApiTokenService.js - 需求45 代号：Agent API Token 基础安全层
 *
 * 目标：
 * - 提供 token 持久化存储（JSON fallback，保留后续 SQLite 迁移边界）
 * - 生成并保存 token 哈希（仅存储 hash，不保存明文）
 * - 支持分钟/日维度用量控制、启用开关、scope 校验所需的数据模型
 *
 * 字段（持久化）：
 * - id/name/prefix/tokenHash/scopes/enabled/minuteLimit/dailyLimit
 * - note/nonCommercial/expiresAt/trustedUser
 * - createdAt/lastUsedAt/usageCount
 * - _minuteWindow/_minuteUsage /_dailyWindow/_dailyUsage（内部字段，便于限流）
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const XIAKE_DATA_DIR = process.env.XIAKE_DATA_DIR || path.join(os.homedir(), '.xiake');
const TOKEN_FILE = process.env.API_TOKEN_STORAGE_PATH || path.join(XIAKE_DATA_DIR, 'api-tokens.json');

const DEFAULT_MINUTE_LIMIT = 120;
const DEFAULT_DAILY_LIMIT = 3;

const LEGAL_PREFIXES = ['xiake_live_', 'xiake_test_'];

class ApiTokenService {
  constructor(options = {}) {
    this.tokenFile = options.tokenFile || TOKEN_FILE;
    this.secret = options.secret || process.env.SERVER_TOKEN_SECRET;
    this.tokens = [];
    this._loaded = false;
    this._load();
  }

  // ---- 工具 ----

  _ensureDir() {
    fs.mkdirSync(path.dirname(this.tokenFile), { recursive: true });
  }

  _nowMinuteWindow() {
    return new Date().toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
  }

  _nowDayWindow() {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  }

  _normalizeScopes(scopes = []) {
    const list = Array.isArray(scopes) ? scopes : [scopes];
    const uniq = new Set();
    for (const scope of list) {
      if (typeof scope === 'string' && scope.trim()) {
        uniq.add(scope.trim());
      }
    }
    return Array.from(uniq);
  }

  _blankTokenRecord(overrides = {}) {
    const now = new Date().toISOString();
    return {
      id: uuidv4(),
      name: overrides.name || 'unnamed',
      prefix: overrides.prefix,
      tokenHash: overrides.tokenHash,
      scopes: this._normalizeScopes(overrides.scopes),
      enabled: overrides.enabled !== false,
      minuteLimit: Number.isFinite(overrides.minuteLimit) && overrides.minuteLimit > 0 ? Math.floor(overrides.minuteLimit) : DEFAULT_MINUTE_LIMIT,
      dailyLimit: Number.isFinite(overrides.dailyLimit) && overrides.dailyLimit > 0 ? Math.floor(overrides.dailyLimit) : DEFAULT_DAILY_LIMIT,
      note: typeof overrides.note === 'string' ? overrides.note : '',
      nonCommercial: overrides.nonCommercial !== false,
      expiresAt: typeof overrides.expiresAt === 'string' && overrides.expiresAt.trim() ? overrides.expiresAt.trim() : null,
      trustedUser: typeof overrides.trustedUser === 'string' ? overrides.trustedUser : '',
      createdAt: now,
      lastUsedAt: null,
      usageCount: 0,
      _minuteWindow: this._nowMinuteWindow(),
      _minuteUsage: 0,
      _dailyWindow: this._nowDayWindow(),
      _dailyUsage: 0,
    };
  }

  _load() {
    try {
      if (fs.existsSync(this.tokenFile)) {
        const raw = JSON.parse(fs.readFileSync(this.tokenFile, 'utf8'));
        const tokens = Array.isArray(raw?.tokens) ? raw.tokens : Array.isArray(raw) ? raw : [];
        this.tokens = tokens
          .filter((item) => item && typeof item === 'object')
          .map((item) => ({
            ...this._blankTokenRecord(item),
            ...item,
            scopes: this._normalizeScopes(item.scopes),
            _minuteWindow: item._minuteWindow || this._nowMinuteWindow(),
            _minuteUsage: Number.isFinite(item._minuteUsage) ? Math.max(0, Math.floor(item._minuteUsage)) : 0,
            _dailyWindow: item._dailyWindow || this._nowDayWindow(),
            _dailyUsage: Number.isFinite(item._dailyUsage) ? Math.max(0, Math.floor(item._dailyUsage)) : 0,
          }));
      }
    } catch (err) {
      console.warn('[ApiTokenService] 读取 token 文件失败:', err.message);
      this.tokens = [];
    }
    this._loaded = true;
  }

  _persist() {
    try {
      this._ensureDir();
      const payload = {
        schemaVersion: 1,
        updatedAt: new Date().toISOString(),
        tokens: this.tokens
      };
      const tmpFile = `${this.tokenFile}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(payload, null, 2), 'utf8');
      fs.renameSync(tmpFile, this.tokenFile);
    } catch (err) {
      console.warn('[ApiTokenService] 持久化 token 文件失败:', err.message);
    }
  }

  _hashToken(token, secret = this.secret) {
    return crypto.createHash('sha256').update(`${token}${secret}`).digest('hex');
  }

  _ensureFeatureEnabled() {
    if (!this.secret && process.env.NODE_ENV === 'production') {
      const err = new Error('SERVER_TOKEN_SECRET missing in production');
      err.code = 'TOKEN_SECRET_MISSING';
      throw err;
    }
  }

  _toPublic(tokenRecord) {
    const {
      tokenHash,
      _minuteWindow,
      _minuteUsage,
      _dailyWindow,
      _dailyUsage,
      ...publicRecord
    } = tokenRecord;
    return {
      ...publicRecord,
      // 维持只读模型，避免后续直接误写内部字段
      ...(tokenRecord && { prefix: tokenRecord.prefix }),
    };
  }

  _resetMinuteWindowIfNeeded(token) {
    const now = this._nowMinuteWindow();
    if (token._minuteWindow !== now) {
      token._minuteWindow = now;
      token._minuteUsage = 0;
    }
  }

  _resetDailyWindowIfNeeded(token) {
    const now = this._nowDayWindow();
    if (token._dailyWindow !== now) {
      token._dailyWindow = now;
      token._dailyUsage = 0;
    }
  }

  _findByHash(tokenHash) {
    return this.tokens.find((t) => t.tokenHash === tokenHash) || null;
  }

  _findById(id) {
    return this.tokens.find((t) => t.id === id) || null;
  }

  // ---- 公共能力 ----

  createToken({ name = 'untitled', scopes = ['forecast:read'], minuteLimit, dailyLimit, enabled = true, note = '', nonCommercial = true, expiresAt = null, trustedUser = '' } = {}) {
    this._ensureFeatureEnabled();

    const prefix = process.env.NODE_ENV === 'production' ? 'xiake_live_' : 'xiake_test_';
    const random = crypto.randomBytes(24).toString('base64url');
    const token = `${prefix}${random}`;
    const record = this._blankTokenRecord({
      name,
      scopes,
      enabled,
      minuteLimit,
      dailyLimit,
      note,
      nonCommercial,
      expiresAt,
      trustedUser,
      prefix,
      tokenHash: this._hashToken(token, this.secret)
    });

    this.tokens.push(record);
    this._persist();

    return {
      token,
      tokenMeta: this._toPublic(record)
    };
  }

  listTokens() {
    return this.tokens.map((t) => this._toPublic(t));
  }

  getTokenById(id) {
    const tokenRecord = this._findById(id);
    return tokenRecord ? this._toPublic(tokenRecord) : null;
  }

  getInternalTokenById(id) {
    return this._findById(id);
  }

  getTokenByHash(token) {
    this._load();
    const hashed = this._hashToken(token);
    return this._findByHash(hashed);
  }

  authenticateToken(rawToken, requiredScopes = []) {
    this._ensureFeatureEnabled();

    if (!rawToken || typeof rawToken !== 'string') {
      return { ok: false, code: 'UNAUTHORIZED', status: 401, message: 'missing token' };
    }

    const token = rawToken.trim();
    const hasPrefix = LEGAL_PREFIXES.some((p) => token.startsWith(p));
    if (!hasPrefix || token.length < 16) {
      return { ok: false, code: 'UNAUTHORIZED', status: 401, message: 'invalid token format' };
    }

    let found;
    try {
      found = this.getTokenByHash(token);
    } catch {
      return { ok: false, code: 'UNAUTHORIZED', status: 401, message: 'invalid secret' };
    }

    if (!found) {
      return { ok: false, code: 'UNAUTHORIZED', status: 401, message: 'invalid token' };
    }

    if (!found.enabled) {
      return { ok: false, code: 'TOKEN_DISABLED', status: 403, message: 'token disabled' };
    }

    if (found.expiresAt) {
      const expiresAt = new Date(found.expiresAt).getTime();
      if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
        return { ok: false, code: 'TOKEN_EXPIRED', status: 403, message: 'token expired' };
      }
    }

    const required = this._normalizeScopes(requiredScopes);
    if (required.length > 0) {
      const scopes = new Set(found.scopes);
      for (const s of required) {
        if (!scopes.has(s)) {
          return {
            ok: false,
            code: 'SCOPE_DENIED',
            status: 403,
            message: `missing scope: ${s}`
          };
        }
      }
    }

    this._resetMinuteWindowIfNeeded(found);
    if (found._minuteUsage >= found.minuteLimit) {
      return {
        ok: false,
        code: 'RATE_LIMITED',
        status: 429,
        message: 'minute quota exceeded'
      };
    }

    this._resetDailyWindowIfNeeded(found);
    if (found._dailyUsage >= found.dailyLimit) {
      return {
        ok: false,
        code: 'RATE_LIMITED',
        status: 429,
        message: 'daily quota exceeded'
      };
    }

    found._minuteUsage += 1;
    found._dailyUsage += 1;
    found.usageCount += 1;
    found.lastUsedAt = new Date().toISOString();

    this._persist();

    return {
      ok: true,
      token: this._toPublic(found),
      status: 200
    };
  }

  updateToken(id, patch = {}) {
    const tokenRecord = this._findById(id);
    if (!tokenRecord) {
      return null;
    }

    if (typeof patch.name === 'string' && patch.name.trim()) {
      tokenRecord.name = patch.name.trim();
    }

    if (typeof patch.enabled === 'boolean') {
      tokenRecord.enabled = patch.enabled;
    }

    if (Number.isFinite(patch.minuteLimit) && patch.minuteLimit > 0) {
      tokenRecord.minuteLimit = Math.floor(patch.minuteLimit);
    }

    if (Number.isFinite(patch.dailyLimit) && patch.dailyLimit > 0) {
      tokenRecord.dailyLimit = Math.floor(patch.dailyLimit);
    }

    if (Array.isArray(patch.scopes)) {
      tokenRecord.scopes = this._normalizeScopes(patch.scopes);
    }

    if (typeof patch.note === 'string') {
      tokenRecord.note = patch.note.trim();
    }

    if (typeof patch.nonCommercial === 'boolean') {
      tokenRecord.nonCommercial = patch.nonCommercial;
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'expiresAt')) {
      tokenRecord.expiresAt = typeof patch.expiresAt === 'string' && patch.expiresAt.trim() ? patch.expiresAt.trim() : null;
    }

    if (typeof patch.trustedUser === 'string') {
      tokenRecord.trustedUser = patch.trustedUser.trim();
    }

    this._persist();
    return this._toPublic(tokenRecord);
  }

  listInternalTokens() {
    return this.tokens
      .slice()
      .map((tokenRecord) => ({
        ...tokenRecord,
        tokenHash: undefined,
        _minuteWindow: tokenRecord._minuteWindow,
        _minuteUsage: tokenRecord._minuteUsage,
        _dailyWindow: tokenRecord._dailyWindow,
        _dailyUsage: tokenRecord._dailyUsage
      }));
  }

  batchDisableTokens(ids = [], note = '') {
    const idSet = new Set(Array.isArray(ids) ? ids.filter(Boolean) : []);
    const disabled = [];
    for (const tokenRecord of this.tokens) {
      if (!idSet.has(tokenRecord.id)) continue;
      tokenRecord.enabled = false;
      if (typeof note === 'string' && note.trim()) {
        tokenRecord.note = tokenRecord.note ? `${tokenRecord.note}; ${note.trim()}` : note.trim();
      }
      disabled.push(this._toPublic(tokenRecord));
    }
    if (disabled.length > 0) {
      this._persist();
    }
    return disabled;
  }

  deleteToken(id) {
    const idx = this.tokens.findIndex((t) => t.id === id);
    if (idx < 0) {
      return false;
    }

    this.tokens.splice(idx, 1);
    this._persist();
    return true;
  }

  resetUsage(id) {
    const tokenRecord = this._findById(id);
    if (!tokenRecord) return null;

    tokenRecord._minuteWindow = this._nowMinuteWindow();
    tokenRecord._minuteUsage = 0;
    tokenRecord._dailyWindow = this._nowDayWindow();
    tokenRecord._dailyUsage = 0;
    tokenRecord.usageCount = 0;
    tokenRecord.lastUsedAt = null;
    this._persist();
    return this._toPublic(tokenRecord);
  }
}

module.exports = ApiTokenService;
