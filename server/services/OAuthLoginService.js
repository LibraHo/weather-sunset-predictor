const crypto = require('crypto');
const axios = require('axios');

const WECHAT_WEB_TOKEN_ENDPOINT = 'https://api.weixin.qq.com/sns/oauth2/access_token';
const WECHAT_MINI_SESSION_ENDPOINT = 'https://api.weixin.qq.com/sns/jscode2session';
const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_TOKENINFO_ENDPOINT = 'https://oauth2.googleapis.com/tokeninfo';
const DEFAULT_GOOGLE_TIMEOUT_MS = 10000;

function nowIso() {
  return new Date().toISOString();
}

function createError(code, message, status = 500, details) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  if (details) error.details = details;
  return error;
}

function firstValue(...values) {
  return values.find((value) => typeof value === 'string' && value.trim())?.trim();
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildConfig(config, env) {
  return {
    wechatWebAppId: firstValue(config.wechatWebAppId, config.WECHAT_WEB_APP_ID, env.WECHAT_WEB_APP_ID),
    wechatWebAppSecret: firstValue(config.wechatWebAppSecret, config.WECHAT_WEB_APP_SECRET, env.WECHAT_WEB_APP_SECRET),
    wechatWebRedirectUri: firstValue(
      config.wechatWebRedirectUri,
      config.WECHAT_WEB_REDIRECT_URI,
      env.WECHAT_WEB_REDIRECT_URI,
      'https://sunset.bjhyc.online/auth/wechat/web/callback'
    ),
    wechatMiniAppId: firstValue(
      config.wechatMiniAppId,
      config.WECHAT_MINI_APP_ID,
      config.WECHAT_MINI_APPID,
      env.WECHAT_MINI_APP_ID,
      env.WECHAT_MINI_APPID,
      env.WECHAT_APP_ID,
      env.WECHAT_APPID
    ),
    wechatMiniAppSecret: firstValue(
      config.wechatMiniAppSecret,
      config.WECHAT_MINI_APP_SECRET,
      config.WECHAT_MINI_APPSECRET,
      env.WECHAT_MINI_APP_SECRET,
      env.WECHAT_MINI_APPSECRET,
      env.WECHAT_APP_SECRET,
      env.WECHAT_APPSECRET
    ),
    googleClientId: firstValue(config.googleClientId, config.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_ID),
    googleClientSecret: firstValue(config.googleClientSecret, config.GOOGLE_CLIENT_SECRET, env.GOOGLE_CLIENT_SECRET),
    googleRedirectUri: firstValue(
      config.googleRedirectUri,
      config.GOOGLE_REDIRECT_URI,
      env.GOOGLE_REDIRECT_URI,
      'https://sunset.bjhyc.online/auth/google/callback'
    ),
    googleRequestTimeoutMs: parsePositiveInteger(
      firstValue(config.googleRequestTimeoutMs, config.GOOGLE_OAUTH_TIMEOUT_MS, env.GOOGLE_OAUTH_TIMEOUT_MS),
      DEFAULT_GOOGLE_TIMEOUT_MS
    ),
    googleProxyUrl: firstValue(
      config.googleProxyUrl,
      config.GOOGLE_OAUTH_PROXY,
      env.GOOGLE_OAUTH_PROXY,
      env.HTTPS_PROXY,
      env.HTTP_PROXY
    ),
    stateSecret: firstValue(config.stateSecret, config.AUTH_SECRET, env.AUTH_SECRET, env.USER_SESSION_SECRET, 'xiake-dev-oauth-state-secret')
  };
}

function timingSafeEqualString(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function sanitizeGoogleProfile(profile) {
  return {
    sub: profile.sub,
    ...(profile.email ? { email: profile.email } : {}),
    ...(profile.name ? { name: profile.name } : {}),
    ...(profile.picture || profile.avatar ? { avatar: profile.picture || profile.avatar } : {})
  };
}

function createAxiosProxy(proxyUrl) {
  if (!proxyUrl) return undefined;
  let url;
  try {
    url = new URL(proxyUrl);
  } catch (error) {
    throw createError('GOOGLE_PROXY_INVALID', 'Google OAuth proxy URL is invalid', 500);
  }

  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) {
    throw createError('GOOGLE_PROXY_INVALID', 'Google OAuth proxy URL is invalid', 500);
  }

  return {
    protocol: url.protocol.slice(0, -1),
    host: url.hostname,
    port: Number(url.port || (url.protocol === 'https:' ? 443 : 80)),
    ...(url.username || url.password
      ? { auth: { username: decodeURIComponent(url.username), password: decodeURIComponent(url.password) } }
      : {})
  };
}

function buildGoogleRequestOptions(config) {
  return {
    timeout: config.googleRequestTimeoutMs || DEFAULT_GOOGLE_TIMEOUT_MS,
    ...(config.googleProxyUrl ? { proxy: createAxiosProxy(config.googleProxyUrl) } : {})
  };
}

function isGoogleTimeoutError(error) {
  return ['ETIMEDOUT', 'ECONNABORTED', 'ESOCKETTIMEDOUT'].includes(error?.code)
    || /timeout|timed out/i.test(String(error?.message || ''));
}

function wrapGoogleUpstreamError(error, stage) {
  if (error?.code?.startsWith?.('GOOGLE_')) return error;
  if (isGoogleTimeoutError(error)) {
    return createError('GOOGLE_UPSTREAM_TIMEOUT', `Google OAuth ${stage} timed out`, 504);
  }
  if (error?.response?.status) {
    return createError('GOOGLE_UPSTREAM_REJECTED', `Google OAuth ${stage} failed`, 502, {
      status: error.response.status
    });
  }
  if (error?.code) {
    return createError('GOOGLE_UPSTREAM_UNAVAILABLE', `Google OAuth ${stage} unavailable`, 502);
  }
  return error;
}

class GoogleIdTokenVerifier {
  constructor(options = {}) {
    this.httpClient = options.httpClient || axios;
    this.endpoint = options.endpoint || GOOGLE_TOKENINFO_ENDPOINT;
    this.requestOptions = options.requestOptions || {};
  }

  async verify(idToken, expectedAudience) {
    if (!idToken || typeof idToken !== 'string') {
      throw createError('GOOGLE_ID_TOKEN_MISSING', 'Google id_token is missing', 502);
    }

    let response;
    try {
      response = await this.httpClient.get(this.endpoint, {
        ...this.requestOptions,
        params: { id_token: idToken }
      });
    } catch (error) {
      throw wrapGoogleUpstreamError(error, 'id token verification');
    }
    const payload = response.data || {};
    if (expectedAudience && payload.aud !== expectedAudience) {
      throw createError('GOOGLE_ID_TOKEN_INVALID', 'Google id_token audience is invalid', 401);
    }
    if (!payload.sub) {
      throw createError('GOOGLE_ID_TOKEN_INVALID', 'Google id_token subject is missing', 401);
    }
    return sanitizeGoogleProfile(payload);
  }
}

class OAuthLoginService {
  constructor(options = {}) {
    this.userService = options.userService;
    this.httpClient = options.httpClient || axios;
    const env = options.config ? {} : process.env;
    this.config = buildConfig(options.config || {}, env);
    this.googleRequestOptions = buildGoogleRequestOptions(this.config);
    this.wechatWebTokenEndpoint = options.wechatWebTokenEndpoint || WECHAT_WEB_TOKEN_ENDPOINT;
    this.wechatMiniSessionEndpoint = options.wechatMiniSessionEndpoint || WECHAT_MINI_SESSION_ENDPOINT;
    this.googleTokenEndpoint = options.googleTokenEndpoint || GOOGLE_TOKEN_ENDPOINT;
    this.googleIdTokenVerifier = options.googleIdTokenVerifier || new GoogleIdTokenVerifier({
      httpClient: this.httpClient,
      requestOptions: this.googleRequestOptions
    });
  }

  ensureUserService() {
    if (!this.userService) {
      throw createError('USER_SERVICE_MISSING', 'User service is not configured');
    }
  }

  ensureWechatWebConfig() {
    if (!this.config.wechatWebAppId || !this.config.wechatWebAppSecret) {
      throw createError('WECHAT_WEB_CONFIG_MISSING', 'WeChat web login is not configured');
    }
  }

  ensureWechatMiniConfig() {
    if (!this.config.wechatMiniAppId || !this.config.wechatMiniAppSecret) {
      throw createError('WECHAT_MINI_CONFIG_MISSING', 'WeChat mini-program login is not configured');
    }
  }

  ensureGoogleConfig() {
    if (!this.config.googleClientId || !this.config.googleClientSecret) {
      throw createError('GOOGLE_CONFIG_MISSING', 'Google login is not configured');
    }
  }

  createState(provider) {
    const state = crypto.randomBytes(24).toString('base64url');
    return { state, stateCookie: this.signState(provider, state) };
  }

  signState(provider, state) {
    const payload = `${provider}:${state}`;
    const signature = crypto
      .createHmac('sha256', this.config.stateSecret)
      .update(payload)
      .digest('base64url');
    return `${provider}.${state}.${signature}`;
  }

  validateState(provider, state, stateCookie) {
    if (!provider || !state || !stateCookie || typeof stateCookie !== 'string') {
      throw createError('OAUTH_STATE_INVALID', 'OAuth state is invalid', 400);
    }
    const parts = stateCookie.split('.');
    if (parts.length !== 3 || parts[0] !== provider || parts[1] !== state) {
      throw createError('OAUTH_STATE_INVALID', 'OAuth state is invalid', 400);
    }
    const expected = this.signState(provider, state);
    if (!timingSafeEqualString(expected, stateCookie)) {
      throw createError('OAUTH_STATE_INVALID', 'OAuth state is invalid', 400);
    }
  }

  createWechatWebStart() {
    this.ensureWechatWebConfig();
    const { state, stateCookie } = this.createState('wechat_web');
    const url = new URL('https://open.weixin.qq.com/connect/qrconnect');
    url.searchParams.set('appid', this.config.wechatWebAppId);
    url.searchParams.set('redirect_uri', this.config.wechatWebRedirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'snsapi_login');
    url.searchParams.set('state', state);
    return { state, stateCookie, url: `${url.toString()}#wechat_redirect` };
  }

  createGoogleStart() {
    this.ensureGoogleConfig();
    const { state, stateCookie } = this.createState('google');
    const url = new URL(GOOGLE_AUTH_ENDPOINT);
    url.searchParams.set('client_id', this.config.googleClientId);
    url.searchParams.set('redirect_uri', this.config.googleRedirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    return { state, stateCookie, url: url.toString() };
  }

  async loginWechatWeb(code) {
    this.ensureUserService();
    this.ensureWechatWebConfig();
    if (!code || typeof code !== 'string') {
      throw createError('WECHAT_WEB_CODE_REQUIRED', 'WeChat web authorization code is required', 400);
    }

    const response = await this.httpClient.get(this.wechatWebTokenEndpoint, {
      params: {
        appid: this.config.wechatWebAppId,
        secret: this.config.wechatWebAppSecret,
        code,
        grant_type: 'authorization_code'
      }
    });
    const data = response.data || {};
    if (data.errcode) {
      throw createError('WECHAT_WEB_TOKEN_EXCHANGE_FAILED', 'WeChat web token exchange failed', 502, {
        errcode: data.errcode,
        errmsg: data.errmsg
      });
    }
    if (!data.openid) {
      throw createError('WECHAT_WEB_OPENID_MISSING', 'WeChat web token response is missing openid', 502);
    }

    return this.createSessionForIdentity({
      provider: 'wechat_web',
      subject: data.openid,
      unionid: data.unionid,
      profile: { unionid: data.unionid }
    });
  }

  async loginWechatMini(code) {
    this.ensureUserService();
    this.ensureWechatMiniConfig();
    if (!code || typeof code !== 'string') {
      throw createError('WECHAT_CODE_REQUIRED', 'code is required', 400);
    }

    const response = await this.httpClient.get(this.wechatMiniSessionEndpoint, {
      params: {
        appid: this.config.wechatMiniAppId,
        secret: this.config.wechatMiniAppSecret,
        js_code: code,
        grant_type: 'authorization_code'
      }
    });
    const data = response.data || {};
    if (data.errcode) {
      throw createError('WECHAT_CODE2SESSION_FAILED', 'WeChat code2Session failed', 502, {
        errcode: data.errcode,
        errmsg: data.errmsg
      });
    }
    if (!data.openid) {
      throw createError('WECHAT_OPENID_MISSING', 'WeChat code2Session response is missing openid', 502);
    }

    return this.createSessionForIdentity({
      provider: 'wechat_miniprogram',
      subject: data.openid,
      unionid: data.unionid,
      profile: { unionid: data.unionid }
    });
  }

  async loginGoogle(code) {
    this.ensureUserService();
    this.ensureGoogleConfig();
    if (!code || typeof code !== 'string') {
      throw createError('GOOGLE_CODE_REQUIRED', 'Google authorization code is required', 400);
    }

    const body = new URLSearchParams({
      code,
      client_id: this.config.googleClientId,
      client_secret: this.config.googleClientSecret,
      redirect_uri: this.config.googleRedirectUri,
      grant_type: 'authorization_code'
    });
    let response;
    try {
      response = await this.httpClient.post(this.googleTokenEndpoint, body, {
        ...this.googleRequestOptions,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
    } catch (error) {
      throw wrapGoogleUpstreamError(error, 'token exchange');
    }
    const idToken = response.data?.id_token;
    let profile;
    try {
      profile = await this.verifyGoogleIdToken(idToken);
    } catch (error) {
      throw wrapGoogleUpstreamError(error, 'id token verification');
    }

    return this.createSessionForIdentity({
      provider: 'google',
      subject: profile.sub,
      profile
    });
  }

  async verifyGoogleIdToken(idToken) {
    if (typeof this.googleIdTokenVerifier === 'function') {
      return sanitizeGoogleProfile(await this.googleIdTokenVerifier(idToken, this.config.googleClientId));
    }
    return sanitizeGoogleProfile(await this.googleIdTokenVerifier.verify(idToken, this.config.googleClientId));
  }

  createSessionForIdentity(identity) {
    const user = this.upsertIdentity(identity);
    if (typeof this.userService.issueToken !== 'function') {
      throw createError('USER_SERVICE_ISSUE_TOKEN_MISSING', 'UserService.issueToken is required');
    }
    return { token: this.userService.issueToken(user), user };
  }

  verifyToken(token) {
    if (!token || typeof this.userService?.verifyToken !== 'function') return null;
    return this.userService.verifyToken(token);
  }

  revokeToken(token) {
    if (!token || typeof this.userService?.revokeToken !== 'function') return false;
    return this.userService.revokeToken(token);
  }

  upsertIdentity({ provider, subject, unionid, profile = {} }) {
    if (!provider || !subject) {
      throw createError('IDENTITY_INVALID', 'Identity provider and subject are required', 400);
    }
    if (provider === 'wechat_web' || provider === 'wechat_miniprogram') {
      if (typeof this.userService.upsertWechatUser === 'function') {
        return this.userService.upsertWechatUser({
          provider,
          openid: subject,
          subject,
          unionid,
          sessionKey: profile.sessionKey
        });
      }
    }
    if (provider === 'google') {
      if (typeof this.userService.upsertGoogleUser === 'function') {
        return this.userService.upsertGoogleUser({
          sub: subject,
          subject,
          email: profile.email,
          name: profile.name,
          picture: profile.avatar || profile.picture
        });
      }
    }
    if (typeof this.userService.upsertIdentity === 'function' && this.userService.upsertIdentity.length <= 1) {
      return this.userService.upsertIdentity({ provider, subject, unionid, profile });
    }

    const timestamp = nowIso();
    const users = this.userService.data?.users;
    if (!Array.isArray(users)) {
      throw createError('USER_SERVICE_UPSERT_IDENTITY_MISSING', 'UserService.upsertIdentity is required');
    }

    let user = typeof this.userService.findByIdentity === 'function'
      ? this.userService.findByIdentity(provider, subject)
      : null;

    if (!user && unionid) {
      user = users.find((item) =>
        item.identities?.some((identity) => identity.unionid && identity.unionid === unionid)
      ) || null;
    }

    if (!user) {
      user = {
        userId: crypto.randomUUID(),
        identities: [],
        favorites: [],
        recentLocations: [],
        createdAt: timestamp,
        updatedAt: timestamp
      };
      users.push(user);
    }

    let identity = user.identities.find((item) => item.provider === provider && item.subject === subject);
    if (!identity) {
      identity = { provider, subject, createdAt: timestamp };
      user.identities.push(identity);
    }

    identity.updatedAt = timestamp;
    if (unionid) identity.unionid = unionid;
    if (profile.email) identity.email = profile.email;
    if (profile.name) identity.name = profile.name;
    if (profile.avatar) identity.avatar = profile.avatar;
    user.updatedAt = timestamp;

    if (typeof this.userService.save === 'function') this.userService.save();
    return user;
  }
}

module.exports = OAuthLoginService;
module.exports.GoogleIdTokenVerifier = GoogleIdTokenVerifier;
module.exports._test = {
  buildConfig,
  buildGoogleRequestOptions,
  createError,
  createAxiosProxy,
  sanitizeGoogleProfile,
  wrapGoogleUpstreamError,
  timingSafeEqualString
};
