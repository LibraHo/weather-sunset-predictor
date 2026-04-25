/**
 * agentAuth.js - Agent API Token 鉴权中间件（需求45.3）
 *
 * 特性：
 * - 支持 Authorization: Bearer <token>
 * - 兼容 X-Xiake-Token
 * - 校验 hash、enabled、scope、quota（分钟/日）
 * - 成功时挂载 req.agentToken 上下文
 */

'use strict';

const ApiTokenService = require('../services/ApiTokenService');

const DEFAULT_SERVICE = new ApiTokenService();

function getTokenFromRequest(req) {
  const auth = req.get('Authorization') || req.get('authorization');
  if (auth) {
    const match = /^Bearer\s+(.+)$/.exec(auth);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  const xToken = req.get('X-Xiake-Token') || req.get('x-xiake-token');
  if (xToken) {
    return String(xToken).trim();
  }

  return null;
}

function getClientIp(req) {
  const forwarded = req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip']);
  if (forwarded) {
    return String(forwarded).split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

function respondUnauthorized(res) {
  return res.status(401).json({
    error: {
      code: 'UNAUTHORIZED',
      message: 'Missing or invalid token'
    }
  });
}

function respondForbidden(res, result) {
  const status = result.status === 429 || result.code === 'RATE_LIMITED' ? 429 : 403;
  return res.status(status).json({
    error: {
      code: result.code,
      message: result.message || 'forbidden'
    }
  });
}

function normalizeScopes(scopes) {
  if (!scopes) return [];
  if (Array.isArray(scopes)) {
    return scopes.filter((s) => typeof s === 'string' && s.trim());
  }
  if (typeof scopes === 'string' && scopes.trim()) {
    return [scopes.trim()];
  }
  return [];
}

function logAuthFailure(auditLogger, req, result, start) {
  if (!auditLogger || typeof auditLogger.fromRequest !== 'function') return;

  auditLogger.fromRequest(req, {
    endpoint: req.path,
    status: result.status,
    elapsedMs: Date.now() - start,
    ip: getClientIp(req),
    userAgent: req?.headers?.['user-agent'],
    errorCode: result.code
  });
}

function logAuthError(auditLogger, req, status, code, start) {
  if (!auditLogger || typeof auditLogger.add !== 'function') return;

  auditLogger.add({
    endpoint: req.path,
    status,
    elapsedMs: Date.now() - start,
    ip: getClientIp(req),
    userAgent: req?.headers?.['user-agent'],
    errorCode: code
  });
}

module.exports = function createAgentAuth(options = {}) {
  const service = options.apiTokenService || DEFAULT_SERVICE;
  const requiredScopes = normalizeScopes(options.requiredScopes || options.scope || []);
  const auditLogger = options.auditLogger;

  return function agentAuthMiddleware(req, res, next) {
    const start = Date.now();

    try {
      const token = getTokenFromRequest(req);
      const result = service.authenticateToken(token, requiredScopes);

      if (!result.ok) {
        logAuthFailure(auditLogger, req, result, start);
        if (result.status === 401) {
          return respondUnauthorized(res);
        }
        return respondForbidden(res, result);
      }

      req.agentToken = result.token;
      return next();
    } catch (err) {
      const status = err.code === 'TOKEN_SECRET_MISSING' ? 503 : 500;
      const code = err.code === 'TOKEN_SECRET_MISSING' ? 'SERVICE_UNAVAILABLE' : 'AUTH_ERROR';
      logAuthError(auditLogger, req, status, code, start);

      return res.status(status).json({
        error: {
          code,
          message: err.message || 'authentication failed'
        }
      });
    }
  };
};
