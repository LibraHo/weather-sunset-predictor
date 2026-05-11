const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DEFAULT_DATA_FILE = path.join(os.homedir(), '.xiake', 'users.json');

function nowIso() {
  return new Date().toISOString();
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function jsonBase64url(value) {
  return base64url(JSON.stringify(value));
}

function parseTokenPart(part) {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

function timingSafeEqualString(a, b) {
  const aBuffer = Buffer.from(String(a));
  const bBuffer = Buffer.from(String(b));
  return aBuffer.length === bBuffer.length && crypto.timingSafeEqual(aBuffer, bBuffer);
}

function stableLocationId(name, lat, lon) {
  return `loc:${lat.toFixed(6)}:${lon.toFixed(6)}:${encodeURIComponent(String(name).toLowerCase())}`;
}

class UserService {
  constructor(options = {}) {
    this.dataFile = options.dataFile || process.env.USER_DATA_FILE || process.env.XIAKE_USER_DATA_FILE || DEFAULT_DATA_FILE;
    this.sessionSecret = options.sessionSecret || process.env.USER_SESSION_SECRET || process.env.SERVER_TOKEN_SECRET || 'xiake-dev-user-session-secret';
    this.clock = options.clock || (() => new Date());
    this.data = options.initialData || this.load();
  }

  load() {
    try {
      if (!fs.existsSync(this.dataFile)) {
        return { users: [] };
      }
      const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
      return { users: Array.isArray(data.users) ? data.users : [] };
    } catch (error) {
      console.warn('[UserService] 读取用户数据失败，临时使用空数据:', error.message);
      return { users: [] };
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.dataFile), { recursive: true });
    const tmpFile = `${this.dataFile}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify({ users: this.data.users }, null, 2));
    fs.renameSync(tmpFile, this.dataFile);
  }

  findByIdentity(provider, subject) {
    return this.data.users.find(user =>
      user.identities?.some(identity => identity.provider === provider && identity.subject === subject)
    ) || null;
  }

  findById(userId) {
    return this.data.users.find(user => user.userId === userId) || null;
  }

  upsertWechatUser({ openid, sessionKey, unionid }) {
    if (!openid) {
      const error = new Error('微信 openid 缺失');
      error.code = 'WECHAT_OPENID_MISSING';
      error.status = 502;
      throw error;
    }

    const timestamp = nowIso();
    let user = this.findByIdentity('wechat', openid);

    if (!user) {
      user = {
        userId: uuidv4(),
        identities: [{ provider: 'wechat', subject: openid, unionid, sessionKey, createdAt: timestamp, updatedAt: timestamp }],
        favorites: [],
        recentLocations: [],
        createdAt: timestamp,
        updatedAt: timestamp
      };
      this.data.users.push(user);
    } else {
      const identity = user.identities.find(item => item.provider === 'wechat' && item.subject === openid);
      identity.sessionKey = sessionKey;
      if (unionid) identity.unionid = unionid;
      identity.updatedAt = timestamp;
      user.updatedAt = timestamp;
    }

    this.save();
    return user;
  }

  issueToken(user) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
      sub: user.userId,
      iat: Math.floor(this.clock().getTime() / 1000)
    };
    const signingInput = `${jsonBase64url(header)}.${jsonBase64url(payload)}`;
    const signature = crypto.createHmac('sha256', this.sessionSecret).update(signingInput).digest('base64url');
    return `${signingInput}.${signature}`;
  }

  verifyToken(token) {
    try {
      if (!token || typeof token !== 'string') return null;
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const signingInput = `${parts[0]}.${parts[1]}`;
      const expected = crypto.createHmac('sha256', this.sessionSecret).update(signingInput).digest('base64url');
      if (!timingSafeEqualString(parts[2], expected)) return null;

      const payload = parseTokenPart(parts[1]);
      if (!payload.sub) return null;
      return this.findById(payload.sub);
    } catch (error) {
      return null;
    }
  }

  getBearerUser(authorizationHeader = '') {
    const match = String(authorizationHeader).match(/^Bearer\s+(.+)$/i);
    return match ? this.verifyToken(match[1]) : null;
  }

  normalizeLocation(location = {}) {
    const name = typeof location.name === 'string' ? location.name.trim() : '';
    const lat = Number(location.lat);
    const lon = Number(location.lon);
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      const error = new Error('location.name、location.lat、location.lon 为必填字段');
      error.code = 'INVALID_LOCATION';
      error.status = 400;
      throw error;
    }
    return {
      id: location.id || stableLocationId(name, lat, lon),
      name,
      lat,
      lon,
      ...(location.countryCode ? { countryCode: String(location.countryCode) } : {})
    };
  }

  getFavorites(userId) {
    return this.findById(userId)?.favorites || [];
  }

  addFavorite(userId, location) {
    const user = this.findById(userId);
    if (!user) return null;
    const favorite = { ...this.normalizeLocation(location), createdAt: nowIso() };
    user.favorites = user.favorites || [];
    const existingIndex = user.favorites.findIndex(item => item.id === favorite.id);
    if (existingIndex >= 0) {
      user.favorites[existingIndex] = { ...user.favorites[existingIndex], ...favorite };
    } else {
      user.favorites.push(favorite);
    }
    user.updatedAt = nowIso();
    this.save();
    return favorite;
  }

  deleteFavorite(userId, id) {
    const user = this.findById(userId);
    if (!user) return false;
    const before = user.favorites?.length || 0;
    user.favorites = (user.favorites || []).filter(item => item.id !== id);
    if (user.favorites.length === before) return false;
    user.updatedAt = nowIso();
    this.save();
    return true;
  }

  getRecentLocations(userId) {
    return this.findById(userId)?.recentLocations || [];
  }

  addRecentLocation(userId, location) {
    const user = this.findById(userId);
    if (!user) return null;
    const recent = { ...this.normalizeLocation(location), updatedAt: nowIso() };
    user.recentLocations = (user.recentLocations || []).filter(item => item.id !== recent.id);
    user.recentLocations.unshift(recent);
    user.recentLocations = user.recentLocations.slice(0, 20);
    user.updatedAt = nowIso();
    this.save();
    return recent;
  }
}

module.exports = UserService;
module.exports._test = { base64url, parseTokenPart };
