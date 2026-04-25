/**
 * ApiApplicationService.js - 需求45 API 申请持久化服务
 *
 * 用途：
 * - 用户提交 API 申请（仅前台）
 * - 管理后台审核与备注
 * - 通过审批可一键关联 tokenId
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const XIAKE_DATA_DIR = process.env.XIAKE_DATA_DIR || path.join(os.homedir(), '.xiake');
const APPLICATION_FILE = process.env.API_APPLICATION_STORAGE_PATH || path.join(XIAKE_DATA_DIR, 'api-applications.json');

const ALLOWED_STATUS = new Set(['pending', 'approved', 'rejected']);

class ApiApplicationService {
  constructor(options = {}) {
    this.applicationFile = options.applicationFile || APPLICATION_FILE;
    this.applications = [];
    this._load();
  }

  _ensureDir() {
    fs.mkdirSync(path.dirname(this.applicationFile), { recursive: true });
  }

  _load() {
    try {
      if (fs.existsSync(this.applicationFile)) {
        const raw = JSON.parse(fs.readFileSync(this.applicationFile, 'utf8'));
        const list = Array.isArray(raw?.applications) ? raw.applications : Array.isArray(raw) ? raw : [];
        this.applications = list
          .filter((item) => item && typeof item === 'object')
          .map((item) => this._normalize(item));
      }
    } catch (err) {
      console.warn('[ApiApplicationService] 读取申请文件失败:', err.message);
      this.applications = [];
    }
  }

  _persist() {
    try {
      this._ensureDir();
      const payload = {
        schemaVersion: 1,
        updatedAt: new Date().toISOString(),
        applications: this.applications
      };
      const tmp = `${this.applicationFile}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf8');
      fs.renameSync(tmp, this.applicationFile);
    } catch (err) {
      console.warn('[ApiApplicationService] 持久化申请失败:', err.message);
    }
  }

  _normalize(item = {}) {
    const now = new Date().toISOString();
    const email = String(item.email || '').trim();
    const contact = String(item.contact || '').trim();

    return {
      id: item.id || uuidv4(),
      email,
      contact,
      purpose: typeof item.purpose === 'string' ? item.purpose.trim() : '',
      expectedCallVolume: Number.isFinite(item.expectedCallVolume) ? Math.max(0, Math.floor(item.expectedCallVolume)) : null,
      status: ALLOWED_STATUS.has(item.status) ? item.status : 'pending',
      remarks: typeof item.remarks === 'string' ? item.remarks : '',
      tokenId: item.tokenId || null,
      createdAt: item.createdAt || now,
      updatedAt: item.updatedAt || now,
    };
  }

  _touch(item) {
    item.updatedAt = new Date().toISOString();
  }

  _getById(id) {
    return this.applications.find((item) => item.id === id) || null;
  }

  submitApplication(payload = {}) {
    this._load();
    const email = String(payload.email || '').trim();
    const contact = String(payload.contact || '').trim();

    if (!email || !contact) {
      const err = new Error('email and contact are required');
      err.code = 'INVALID_PARAMS';
      throw err;
    }

    const entry = this._normalize({
      ...payload,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'pending',
      tokenId: null,
    });

    entry.email = email;
    entry.contact = contact;

    this.applications.unshift(entry);
    this._persist();
    return this._toPublic(entry);
  }

  listApplications() {
    this._load();
    return this.applications.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  updateApplication(id, patch = {}) {
    this._load();
    const record = this._getById(id);
    if (!record) {
      return null;
    }

    if (patch.status !== undefined) {
      if (!ALLOWED_STATUS.has(patch.status)) {
        const err = new Error('invalid status');
        err.code = 'INVALID_STATUS';
        throw err;
      }
      record.status = patch.status;
    }

    if (typeof patch.remarks === 'string') {
      record.remarks = patch.remarks;
    }

    if (patch.tokenId === null || typeof patch.tokenId === 'string') {
      record.tokenId = patch.tokenId || null;
    }

    this._touch(record);
    this._persist();
    return this._toPublic(record);
  }

  linkToken(id, tokenId) {
    this._load();
    const record = this._getById(id);
    if (!record) {
      return null;
    }

    const normalizedToken = tokenId ? String(tokenId) : null;
    record.tokenId = normalizedToken;
    this._touch(record);
    this._persist();
    return this._toPublic(record);
  }

  canAssociateToken(id) {
    this._load();
    const record = this._getById(id);
    if (!record) return false;
    return record.status !== 'rejected';
  }

  getApplicationById(id) {
    this._load();
    const record = this._getById(id);
    return record ? this._toPublic(record) : null;
  }

  _toPublic(item) {
    if (!item) return null;
    return {
      ...item,
      // 永不返回 token 明文（未来扩展可存储加密字段时继续保持隔离）
      tokenHash: undefined,
      tokenSecret: undefined
    };
  }
}

module.exports = ApiApplicationService;
