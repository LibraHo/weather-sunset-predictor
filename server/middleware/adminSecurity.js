'use strict';

const crypto = require('crypto');
const basicAuth = require('basic-auth');

const ADMIN_REALM = 'Xiake Photo Admin';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function getAdminConfig() {
  return {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || ''
  };
}

function safeEqual(a = '', b = '') {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function unauthorized(res) {
  res.set('WWW-Authenticate', `Basic realm="${ADMIN_REALM}"`);
  return res.status(401).json({
    error: {
      code: 'UNAUTHORIZED',
      message: '认证失败'
    }
  });
}

function requireAdminAuth(req, res, next) {
  const config = getAdminConfig();
  if (!config.password) {
    return res.status(503).json({
      error: {
        code: 'ADMIN_AUTH_NOT_CONFIGURED',
        message: 'Admin auth is not configured'
      }
    });
  }

  const credentials = basicAuth(req);
  const valid = credentials &&
    safeEqual(credentials.name, config.username) &&
    safeEqual(credentials.pass, config.password);

  if (!valid) return unauthorized(res);
  return next();
}

function getRequestOrigin(req) {
  const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
  const host = req.get('host');
  return host ? `${protocol}://${host}` : null;
}

function isSameOriginUrl(rawUrl, expectedOrigin) {
  if (!rawUrl || !expectedOrigin) return true;
  try {
    return new URL(rawUrl).origin === expectedOrigin;
  } catch (_) {
    return false;
  }
}

function requireAdminRequestIntegrity(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const fetchSite = String(req.get('sec-fetch-site') || '').toLowerCase();
  if (fetchSite === 'cross-site') {
    return res.status(403).json({ error: { code: 'CSRF_BLOCKED', message: 'Cross-site admin request blocked' } });
  }

  const expectedOrigin = getRequestOrigin(req);
  const origin = req.get('origin');
  const referer = req.get('referer');
  if (origin && !isSameOriginUrl(origin, expectedOrigin)) {
    return res.status(403).json({ error: { code: 'CSRF_BLOCKED', message: 'Cross-site admin request blocked' } });
  }
  if (!origin && referer && !isSameOriginUrl(referer, expectedOrigin)) {
    return res.status(403).json({ error: { code: 'CSRF_BLOCKED', message: 'Cross-site admin request blocked' } });
  }

  return next();
}

module.exports = {
  requireAdminAuth,
  requireAdminRequestIntegrity
};
