const express = require('express');
const UserService = require('../services/UserService');
const OAuthLoginService = require('../services/OAuthLoginService');

const SESSION_COOKIE = 'xiake_session';
const STATE_COOKIE = 'xiake_oauth_state';

function sendError(res, error) {
  return res.status(error.status || 500).json({
    error: {
      code: error.code || 'INTERNAL_SERVER_ERROR',
      message: error.message || 'Internal server error',
      ...(error.details ? { details: error.details } : {})
    }
  });
}

function cookieOptions(maxAge) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    ...(maxAge ? { maxAge } : {})
  };
}

function parseCookies(header = '') {
  return String(header)
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separator = part.indexOf('=');
      if (separator < 0) return cookies;
      const key = part.slice(0, separator);
      const value = part.slice(separator + 1);
      cookies[key] = decodeURIComponent(value);
      return cookies;
    }, {});
}

function getBearerToken(req) {
  const match = String(req.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

function serializeUser(user) {
  return {
    userId: user.userId,
    identities: (user.identities || []).map((identity) => ({ provider: identity.provider }))
  };
}

function sendLogin(res, result) {
  res.cookie(SESSION_COOKIE, result.token, cookieOptions(30 * 24 * 60 * 60 * 1000));
  return res.json({
    token: result.token,
    user: serializeUser(result.user)
  });
}

function sendCreatedLogin(res, result) {
  res.cookie(SESSION_COOKIE, result.token, cookieOptions(30 * 24 * 60 * 60 * 1000));
  return res.status(201).json({
    token: result.token,
    user: serializeUser(result.user)
  });
}

function findRequestUser(req, oauthLoginService) {
  const cookies = parseCookies(req.headers.cookie);
  const token = getBearerToken(req) || cookies[SESSION_COOKIE];
  return oauthLoginService.verifyToken(token);
}

function findRequestToken(req) {
  const cookies = parseCookies(req.headers.cookie);
  return getBearerToken(req) || cookies[SESSION_COOKIE] || null;
}

function sendCurrentUser(req, res, oauthLoginService) {
  const user = findRequestUser(req, oauthLoginService);
  if (!user) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Please sign in first' }
    });
  }
  return res.json({ user: serializeUser(user) });
}

function createAttemptLimiter({ maxAttempts = 5, windowMs = 15 * 60 * 1000 } = {}) {
  const attempts = new Map();
  return function checkAttempt(key) {
    const now = Date.now();
    const record = attempts.get(key) || { count: 0, firstAt: now };
    if (now - record.firstAt > windowMs) {
      record.count = 0;
      record.firstAt = now;
    }
    record.count += 1;
    attempts.set(key, record);
    return record.count <= maxAttempts;
  };
}

function createServices(options = {}) {
  const userService = options.userService || new UserService(options.userServiceOptions);
  const oauthLoginService = options.oauthLoginService || new OAuthLoginService({
    ...(options.oauthOptions || {}),
    userService
  });
  return { userService, oauthLoginService };
}

function createRouter(options = {}) {
  const router = express.Router();
  const { userService, oauthLoginService } = createServices(options);
  const allowRecoveryAttempt = options.recoveryAttemptLimiter || createAttemptLimiter();

  router.post('/register', (req, res) => {
    try {
      const user = userService.registerEmailUser({
        email: req.body?.email,
        password: req.body?.password,
        recoveryQuestion: req.body?.recoveryQuestion,
        recoveryAnswer: req.body?.recoveryAnswer
      });
      sendCreatedLogin(res, { user, token: userService.issueToken(user) });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post('/login', (req, res) => {
    try {
      const user = userService.verifyPasswordLogin(req.body?.email, req.body?.password);
      if (!user) {
        return res.status(401).json({
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }
        });
      }
      sendLogin(res, { user, token: userService.issueToken(user) });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post('/password/recovery-question', (req, res) => {
    try {
      const result = userService.getRecoveryQuestion(req.body?.email);
      res.json({
        success: true,
        recoveryQuestion: result?.recoveryQuestion || null
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post('/password/reset', (req, res) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const key = `${req.ip || req.socket?.remoteAddress || 'unknown'}:${email}`;
      if (!allowRecoveryAttempt(key)) {
        return res.status(429).json({
          error: { code: 'TOO_MANY_RECOVERY_ATTEMPTS', message: 'Too many recovery attempts, please try later' }
        });
      }
      const reset = userService.resetPasswordWithRecovery({
        email: req.body?.email,
        recoveryAnswer: req.body?.recoveryAnswer,
        newPassword: req.body?.newPassword
      });
      if (!reset) {
        return res.status(401).json({
          error: { code: 'INVALID_RECOVERY_ANSWER', message: 'Invalid recovery answer' }
        });
      }
      res.json({ success: true });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get('/wechat/web/start', (req, res) => {
    try {
      const flow = oauthLoginService.createWechatWebStart();
      res.cookie(STATE_COOKIE, flow.stateCookie, cookieOptions(10 * 60 * 1000));
      res.redirect(flow.url);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get('/wechat/web/callback', async (req, res) => {
    try {
      oauthLoginService.ensureWechatWebConfig();
      const cookies = parseCookies(req.headers.cookie);
      oauthLoginService.validateState('wechat_web', req.query?.state, cookies[STATE_COOKIE]);
      const result = await oauthLoginService.loginWechatWeb(req.query?.code);
      res.clearCookie(STATE_COOKIE, cookieOptions());
      sendLogin(res, result);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post('/wechat/mini/login', async (req, res) => {
    try {
      const result = await oauthLoginService.loginWechatMini(req.body?.code);
      res.json({
        token: result.token,
        user: serializeUser(result.user)
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get('/google/start', (req, res) => {
    try {
      const flow = oauthLoginService.createGoogleStart();
      res.cookie(STATE_COOKIE, flow.stateCookie, cookieOptions(10 * 60 * 1000));
      res.redirect(flow.url);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get('/google/callback', async (req, res) => {
    try {
      oauthLoginService.ensureGoogleConfig();
      const cookies = parseCookies(req.headers.cookie);
      oauthLoginService.validateState('google', req.query?.state, cookies[STATE_COOKIE]);
      const result = await oauthLoginService.loginGoogle(req.query?.code);
      res.clearCookie(STATE_COOKIE, cookieOptions());
      sendLogin(res, result);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get('/me', (req, res) => sendCurrentUser(req, res, oauthLoginService));

  router.post('/logout', (req, res) => {
    const token = findRequestToken(req);
    if (token) oauthLoginService.revokeToken(token);
    res.clearCookie(SESSION_COOKIE, cookieOptions());
    res.json({ success: true });
  });

  return router;
}

function createApiMeRouter(options = {}) {
  const router = express.Router();
  const { oauthLoginService } = createServices(options);
  router.get('/', (req, res) => sendCurrentUser(req, res, oauthLoginService));
  return router;
}

let defaultRouter;
function defaultAuthRouter(req, res, next) {
  if (!defaultRouter) defaultRouter = createRouter();
  return defaultRouter(req, res, next);
}

module.exports = defaultAuthRouter;
module.exports.createRouter = createRouter;
module.exports.createApiMeRouter = createApiMeRouter;
module.exports._test = {
  SESSION_COOKIE,
  STATE_COOKIE,
  cookieOptions,
  parseCookies,
  createAttemptLimiter,
  findRequestToken,
  serializeUser,
  sendError
};
