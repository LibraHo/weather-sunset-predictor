const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DEFAULT_DATA_FILE = path.join(os.homedir(), '.xiake', 'users.json');
const WECHAT_PROVIDERS = new Set(['wechat', 'wechat_web', 'wechat_miniprogram']);
const EMAIL_PROVIDER = 'email';
const HASH_ALGORITHM = 'sha256';
const HASH_ITERATIONS = 120000;
const HASH_KEY_LENGTH = 32;

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

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function createInputError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.status = 400;
  return error;
}

function hashSecret(secret) {
  const salt = crypto.randomBytes(16).toString('base64url');
  const hash = crypto.pbkdf2Sync(String(secret), salt, HASH_ITERATIONS, HASH_KEY_LENGTH, HASH_ALGORITHM).toString('base64url');
  return `pbkdf2:${HASH_ALGORITHM}:${HASH_ITERATIONS}:${salt}:${hash}`;
}

function verifySecret(secret, storedHash) {
  const parts = String(storedHash || '').split(':');
  if (parts.length !== 5 || parts[0] !== 'pbkdf2') return false;
  const [, algorithm, iterationsText, salt, expectedHash] = parts;
  const iterations = Number(iterationsText);
  if (!algorithm || !Number.isInteger(iterations) || iterations <= 0 || !salt || !expectedHash) return false;
  const actualHash = crypto.pbkdf2Sync(String(secret), salt, iterations, HASH_KEY_LENGTH, algorithm).toString('base64url');
  return timingSafeEqualString(actualHash, expectedHash);
}

function envSessionSecret() {
  return process.env.AUTH_SECRET ||
    process.env.USER_SESSION_SECRET ||
    process.env.SERVER_TOKEN_SECRET ||
    'xiake-dev-user-session-secret';
}

function isWechatProvider(provider) {
  return WECHAT_PROVIDERS.has(provider);
}

function normalizeWechatProvider(provider) {
  if (!provider || provider === 'wechat') return 'wechat_miniprogram';
  if (provider === 'wechat_web' || provider === 'wechat_miniprogram') return provider;
  const error = new Error(`Unsupported identity provider: ${provider}`);
  error.code = 'UNSUPPORTED_IDENTITY_PROVIDER';
  error.status = 400;
  throw error;
}

function providerMatches(identityProvider, requestedProvider) {
  if (identityProvider === requestedProvider) return true;
  if (requestedProvider === 'wechat' && isWechatProvider(identityProvider)) return true;
  return identityProvider === 'wechat' && isWechatProvider(requestedProvider);
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function createConflictError(message) {
  const error = new Error(message || 'Identity conflict');
  error.code = 'IDENTITY_CONFLICT';
  error.status = 409;
  return error;
}

class UserService {
  constructor(options = {}) {
    this.dataFile = options.dataFile || process.env.USER_DATA_FILE || process.env.XIAKE_USER_DATA_FILE || DEFAULT_DATA_FILE;
    this.sessionSecret = options.sessionSecret || envSessionSecret();
    this.clock = options.clock || (() => new Date());
    this.data = this.normalizeData(options.initialData || this.load());
    this.hydrateUsers();
  }

  load() {
    try {
      if (!fs.existsSync(this.dataFile)) {
        return { users: [], userIdentities: [], sessions: [] };
      }
      const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
      return data && typeof data === 'object' ? data : { users: [], userIdentities: [], sessions: [] };
    } catch (error) {
      console.warn('[UserService] 读取用户数据失败，临时使用空数据:', error.message);
      return { users: [], userIdentities: [], sessions: [] };
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.dataFile), { recursive: true });
    const tmpFile = `${this.dataFile}.tmp`;
    this.hydrateUsers();
    fs.writeFileSync(tmpFile, JSON.stringify({
      users: this.data.users,
      userIdentities: this.data.userIdentities,
      user_identities: this.data.userIdentities,
      sessions: this.data.sessions
    }, null, 2));
    fs.renameSync(tmpFile, this.dataFile);
  }

  normalizeData(data = {}) {
    const timestamp = nowIso();
    const users = (Array.isArray(data.users) ? data.users : []).map(user => ({
      ...user,
      userId: user.userId || user.id || uuidv4(),
      favorites: Array.isArray(user.favorites) ? user.favorites : [],
      recentLocations: Array.isArray(user.recentLocations) ? user.recentLocations : [],
      createdAt: user.createdAt || timestamp,
      updatedAt: user.updatedAt || user.createdAt || timestamp
    }));
    const userIds = new Set(users.map(user => user.userId));
    const rawIdentities = [
      ...(Array.isArray(data.userIdentities) ? data.userIdentities : []),
      ...(Array.isArray(data.user_identities) ? data.user_identities : [])
    ];

    for (const user of users) {
      for (const identity of Array.isArray(user.identities) ? user.identities : []) {
        rawIdentities.push({ ...identity, userId: identity.userId || user.userId });
      }
    }

    const userIdentities = [];
    for (const identity of rawIdentities) {
      if (!identity || !identity.provider) continue;
      const subject = identity.subject || identity.providerUserId || identity.openid || identity.sub;
      if (!subject || !userIds.has(identity.userId)) continue;
      const existing = userIdentities.find(item =>
        item.userId === identity.userId &&
        item.provider === identity.provider &&
        item.subject === String(subject)
      );
      const normalized = {
        ...identity,
        identityId: identity.identityId || identity.id || uuidv4(),
        userId: identity.userId,
        provider: identity.provider,
        subject: String(subject),
        createdAt: identity.createdAt || timestamp,
        updatedAt: identity.updatedAt || identity.createdAt || timestamp
      };
      if (existing) {
        Object.assign(existing, normalized, {
          createdAt: existing.createdAt || normalized.createdAt,
          updatedAt: normalized.updatedAt
        });
      } else {
        userIdentities.push(normalized);
      }
    }

    const sessions = (Array.isArray(data.sessions) ? data.sessions : [])
      .filter(session => session && session.sessionId && userIds.has(session.userId))
      .map(session => ({
        ...session,
        createdAt: session.createdAt || timestamp,
        updatedAt: session.updatedAt || session.createdAt || timestamp
      }));

    return { users, userIdentities, sessions };
  }

  hydrateUsers() {
    for (const user of this.data.users) {
      user.identities = this.data.userIdentities
        .filter(identity => identity.userId === user.userId)
        .map(identity => ({ ...identity }));
      user.favorites = Array.isArray(user.favorites) ? user.favorites : [];
      user.recentLocations = Array.isArray(user.recentLocations) ? user.recentLocations : [];
    }
  }

  findIdentityRecords(provider, subject) {
    return this.data.userIdentities.filter(identity =>
      providerMatches(identity.provider, provider) && identity.subject === String(subject)
    );
  }

  findExactIdentity(provider, subject) {
    return this.data.userIdentities.find(identity =>
      identity.provider === provider && identity.subject === String(subject)
    ) || null;
  }

  findSingleUserId(records, message) {
    const userIds = uniqueValues(records.map(record => record.userId));
    if (userIds.length > 1) {
      throw createConflictError(message);
    }
    return userIds[0] || null;
  }

  findWechatUnionIdentities(unionid) {
    if (!unionid) return [];
    return this.data.userIdentities.filter(identity =>
      isWechatProvider(identity.provider) && identity.unionid === unionid
    );
  }

  createUser(timestamp = nowIso()) {
    const user = {
      userId: uuidv4(),
      identities: [],
      favorites: [],
      recentLocations: [],
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.data.users.push(user);
    return user;
  }

  mergeUsers(targetUserId, sourceUserId) {
    if (!targetUserId || !sourceUserId || targetUserId === sourceUserId) {
      return this.findById(targetUserId);
    }
    const target = this.findById(targetUserId);
    const source = this.findById(sourceUserId);
    if (!target || !source) {
      throw createConflictError('Identity conflict: merge target missing');
    }

    const favoriteIds = new Set((target.favorites || []).map(item => item.id));
    for (const favorite of source.favorites || []) {
      if (!favoriteIds.has(favorite.id)) {
        target.favorites.push(favorite);
        favoriteIds.add(favorite.id);
      }
    }

    const recentById = new Map();
    for (const location of [...(source.recentLocations || []), ...(target.recentLocations || [])]) {
      if (!recentById.has(location.id)) recentById.set(location.id, location);
    }
    target.recentLocations = [...recentById.values()]
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
      .slice(0, 20);

    for (const identity of this.data.userIdentities) {
      if (identity.userId === sourceUserId) identity.userId = targetUserId;
    }
    for (const session of this.data.sessions) {
      if (session.userId === sourceUserId) session.userId = targetUserId;
    }
    this.data.users = this.data.users.filter(user => user.userId !== sourceUserId);
    target.updatedAt = nowIso();
    this.hydrateUsers();
    return target;
  }

  upsertIdentity(userId, identityData) {
    const timestamp = nowIso();
    const subject = String(identityData.subject);
    const exact = this.findExactIdentity(identityData.provider, subject);
    if (exact && exact.userId !== userId) {
      throw createConflictError('Identity conflict: provider subject belongs to another user');
    }
    const target = exact || {
      identityId: uuidv4(),
      userId,
      provider: identityData.provider,
      subject,
      createdAt: timestamp
    };
    Object.assign(target, identityData, {
      userId,
      subject,
      updatedAt: timestamp
    });
    if (!exact) this.data.userIdentities.push(target);
    const user = this.findById(userId);
    if (user) user.updatedAt = timestamp;
    this.hydrateUsers();
    return target;
  }

  findByIdentity(provider, subject) {
    const identity = this.findIdentityRecords(provider, subject)[0];
    return identity ? this.findById(identity.userId) : null;
  }

  findEmailIdentity(email) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return null;
    return this.findExactIdentity(EMAIL_PROVIDER, normalizedEmail);
  }

  findById(userId) {
    return this.data.users.find(user => user.userId === userId) || null;
  }

  upsertWechatUser({ openid, subject, provider: rawProvider, sessionKey, unionid }) {
    const provider = normalizeWechatProvider(rawProvider);
    const identitySubject = String(subject || openid || '');
    if (!openid) {
      const error = new Error('微信 openid 缺失');
      error.code = 'WECHAT_OPENID_MISSING';
      error.status = 502;
      throw error;
    }

    const timestamp = nowIso();
    const subjectRecords = this.findIdentityRecords(provider, identitySubject);
    const subjectUserId = this.findSingleUserId(subjectRecords, 'Identity conflict: wechat subject belongs to multiple users');
    const unionRecords = this.findWechatUnionIdentities(unionid);
    const unionUserId = this.findSingleUserId(unionRecords, 'Identity conflict: wechat unionid belongs to multiple users');

    for (const record of subjectRecords) {
      if (record.unionid && unionid && record.unionid !== unionid) {
        throw createConflictError('Identity conflict: wechat unionid changed for subject');
      }
    }

    let targetUserId = unionUserId || subjectUserId;
    if (subjectUserId && unionUserId && subjectUserId !== unionUserId) {
      this.mergeUsers(unionUserId, subjectUserId);
      targetUserId = unionUserId;
    }

    let user = targetUserId ? this.findById(targetUserId) : this.createUser(timestamp);
    const existingIdentity = subjectRecords.find(record => record.userId === user.userId) || null;
    const identityProvider = existingIdentity?.provider || provider;
    this.upsertIdentity(user.userId, {
      ...(existingIdentity || {}),
      provider: identityProvider,
      subject: identitySubject,
      openid: identitySubject,
      ...(sessionKey ? { sessionKey } : {}),
      ...(unionid ? { unionid } : {})
    });
    user = this.findById(user.userId);
    user.updatedAt = timestamp;
    this.hydrateUsers();
    this.save();
    return user;
  }

  upsertGoogleUser({ sub, subject, email, name, picture }) {
    const identitySubject = String(subject || sub || '');
    if (!identitySubject) {
      const error = new Error('Google sub missing');
      error.code = 'GOOGLE_SUB_MISSING';
      error.status = 502;
      throw error;
    }

    const timestamp = nowIso();
    const subjectRecords = this.findIdentityRecords('google', identitySubject);
    const userId = this.findSingleUserId(subjectRecords, 'Identity conflict: google sub belongs to multiple users');
    const emailIdentity = email ? this.findEmailIdentity(email) : null;
    if (userId && emailIdentity && emailIdentity.userId !== userId) {
      throw createConflictError('Identity conflict: google email belongs to another user');
    }
    const user = userId ? this.findById(userId) : (emailIdentity ? this.findById(emailIdentity.userId) : this.createUser(timestamp));
    this.upsertIdentity(user.userId, {
      provider: 'google',
      subject: identitySubject,
      sub: identitySubject,
      ...(email ? { email } : {}),
      ...(name ? { name } : {}),
      ...(picture ? { picture } : {})
    });
    user.updatedAt = timestamp;
    this.hydrateUsers();
    this.save();
    return user;
  }

  validateEmailPasswordFields({ email, password, recoveryQuestion, recoveryAnswer }, options = {}) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw createInputError('INVALID_EMAIL', 'Valid email is required');
    }
    if (!password || String(password).length < 6) {
      throw createInputError('INVALID_PASSWORD', 'Password must be at least 6 characters');
    }
    if (!options.passwordOnly) {
      if (!String(recoveryQuestion || '').trim()) {
        throw createInputError('INVALID_RECOVERY_QUESTION', 'Recovery question is required');
      }
      if (!String(recoveryAnswer || '').trim()) {
        throw createInputError('INVALID_RECOVERY_ANSWER', 'Recovery answer is required');
      }
    }
    return normalizedEmail;
  }

  setPasswordForUser(userId, credentials = {}) {
    const email = this.validateEmailPasswordFields(credentials);
    const user = this.findById(userId);
    if (!user) {
      const error = new Error('User not found');
      error.code = 'USER_NOT_FOUND';
      error.status = 404;
      throw error;
    }
    const existing = this.findEmailIdentity(email);
    if (existing && existing.userId !== userId) {
      throw createConflictError('Email is already registered');
    }
    this.upsertIdentity(user.userId, {
      ...(existing || {}),
      provider: EMAIL_PROVIDER,
      subject: email,
      email,
      passwordHash: hashSecret(credentials.password),
      recoveryQuestion: String(credentials.recoveryQuestion).trim(),
      recoveryAnswerHash: hashSecret(String(credentials.recoveryAnswer).trim())
    });
    user.email = email;
    user.updatedAt = nowIso();
    this.hydrateUsers();
    this.save();
    return this.findById(user.userId);
  }

  registerEmailUser(credentials = {}) {
    const email = this.validateEmailPasswordFields(credentials);
    if (this.findEmailIdentity(email)) {
      const error = new Error('Email is already registered');
      error.code = 'EMAIL_ALREADY_REGISTERED';
      error.status = 409;
      throw error;
    }
    const user = this.createUser(nowIso());
    return this.setPasswordForUser(user.userId, { ...credentials, email });
  }

  verifyPasswordLogin(email, password) {
    const identity = this.findEmailIdentity(email);
    if (!identity || !identity.passwordHash || !password) return null;
    if (!verifySecret(password, identity.passwordHash)) return null;
    return this.findById(identity.userId);
  }

  getRecoveryQuestion(email) {
    const identity = this.findEmailIdentity(email);
    if (!identity?.recoveryQuestion) return null;
    return { recoveryQuestion: identity.recoveryQuestion };
  }

  resetPasswordWithRecovery({ email, recoveryAnswer, newPassword } = {}) {
    const normalizedEmail = this.validateEmailPasswordFields({
      email,
      password: newPassword,
      recoveryQuestion: 'not-needed',
      recoveryAnswer: 'not-needed'
    });
    const identity = this.findEmailIdentity(normalizedEmail);
    if (!identity?.recoveryAnswerHash) return false;
    if (!verifySecret(String(recoveryAnswer || '').trim(), identity.recoveryAnswerHash)) return false;
    identity.passwordHash = hashSecret(newPassword);
    identity.updatedAt = nowIso();
    const user = this.findById(identity.userId);
    if (user) user.updatedAt = identity.updatedAt;
    this.hydrateUsers();
    this.save();
    return true;
  }

  issueToken(user, options = {}) {
    const sessionId = options.sessionId || uuidv4();
    const issuedAt = Math.floor(this.clock().getTime() / 1000);
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
      sub: user.userId,
      iat: issuedAt,
      jti: sessionId,
      ...(options.expiresAt ? { exp: Math.floor(new Date(options.expiresAt).getTime() / 1000) } : {}),
      ...(options.ttlSeconds ? { exp: issuedAt + Number(options.ttlSeconds) } : {})
    };
    const signingInput = `${jsonBase64url(header)}.${jsonBase64url(payload)}`;
    const signature = crypto.createHmac('sha256', this.sessionSecret).update(signingInput).digest('base64url');
    const token = `${signingInput}.${signature}`;
    const timestamp = nowIso();
    const existingIndex = this.data.sessions.findIndex(session => session.sessionId === sessionId);
    const session = {
      sessionId,
      userId: user.userId,
      tokenHash: hashToken(token),
      createdAt: existingIndex >= 0 ? this.data.sessions[existingIndex].createdAt : timestamp,
      updatedAt: timestamp,
      expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
      revokedAt: null
    };
    if (existingIndex >= 0) this.data.sessions[existingIndex] = session;
    else this.data.sessions.push(session);
    this.save();
    return token;
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
      if (payload.exp && payload.exp <= Math.floor(this.clock().getTime() / 1000)) return null;
      if (payload.jti) {
        const session = this.lookupSession(payload.jti, { includeRevoked: true });
        if (!session || session.revokedAt || session.userId !== payload.sub) return null;
        if (session.expiresAt && new Date(session.expiresAt).getTime() <= this.clock().getTime()) return null;
        if (session.tokenHash && !timingSafeEqualString(session.tokenHash, hashToken(token))) return null;
      }
      return this.findById(payload.sub);
    } catch (error) {
      return null;
    }
  }

  getBearerUser(authorizationHeader = '') {
    const match = String(authorizationHeader).match(/^Bearer\s+(.+)$/i);
    return match ? this.verifyToken(match[1]) : null;
  }

  lookupSession(sessionId, options = {}) {
    const session = this.data.sessions.find(item => item.sessionId === sessionId) || null;
    if (!session) return null;
    if (!options.includeRevoked && session.revokedAt) return null;
    if (session.expiresAt && new Date(session.expiresAt).getTime() <= this.clock().getTime()) return null;
    return session;
  }

  revokeSession(sessionId) {
    const session = this.data.sessions.find(item => item.sessionId === sessionId);
    if (!session || session.revokedAt) return false;
    session.revokedAt = nowIso();
    session.updatedAt = session.revokedAt;
    this.save();
    return true;
  }

  revokeToken(token) {
    try {
      if (!this.verifyToken(token)) return false;
      const parts = String(token || '').split('.');
      if (parts.length !== 3) return false;
      const payload = parseTokenPart(parts[1]);
      return payload.jti ? this.revokeSession(payload.jti) : false;
    } catch (error) {
      return false;
    }
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
