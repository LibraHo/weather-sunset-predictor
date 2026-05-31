'use strict';

const express = require('express');
const analyticsService = require('../services/AnalyticsService');

const DEFAULT_WINDOW_MS = 60 * 1000;
const DEFAULT_MAX_REQUESTS = 60;

const EVENT_FIELDS = [
  'channel',
  'eventName',
  'visitorHash',
  'userId',
  'path',
  'referrerType',
  'deviceType',
  'region',
  'targetType',
  'status',
  'elapsedMs',
  'errorCode'
];

function getClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  const forwarded = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  return String(
    req.headers['cf-connecting-ip']
    || req.headers['x-real-ip']
    || forwarded
    || req.ip
    || req.socket?.remoteAddress
    || ''
  ).split(',')[0].replace(/^::ffff:/, '').trim();
}

function inferChannel(req, body = {}) {
  const raw = body.channel || req.get?.('x-xiake-client') || req.headers['x-xiake-client'] || '';
  const source = String(raw || '').trim().toLowerCase();
  if (['miniprogram', 'miniapp', 'wechat-miniprogram', 'wechat_miniprogram', 'wx', 'weapp'].includes(source)) {
    return 'miniprogram';
  }
  if (['web', 'browser', 'h5', 'website'].includes(source)) return 'web';
  if (['server', 'admin', 'api'].includes(source)) return source;
  return body.channel || 'web';
}

function inferDeviceType(req, body = {}) {
  if (body.deviceType) return body.deviceType;
  const ua = String(req.get?.('user-agent') || req.headers['user-agent'] || '').toLowerCase();
  if (/bot|spider|crawler|curl|wget|python|headless/.test(ua)) return 'bot';
  if (/miniprogram|micromessenger/.test(ua) || inferChannel(req, body) === 'miniprogram') return 'miniprogram';
  if (/ipad|tablet/.test(ua)) return 'tablet';
  if (/mobile|android|iphone/.test(ua)) return 'mobile';
  if (!ua) return 'unknown';
  return 'desktop';
}

function inferReferrerType(req, body = {}) {
  if (body.referrerType) return body.referrerType;
  const ref = String(req.get?.('referer') || req.get?.('referrer') || '');
  if (!ref) return 'direct';
  try {
    const origin = `${req.protocol || 'http'}://${req.get?.('host') || req.headers.host || 'localhost'}`;
    const refUrl = new URL(ref, origin);
    const current = new URL(origin);
    if (refUrl.hostname === current.hostname) return 'internal';
    if (/google|bing|baidu|duckduckgo|yahoo/i.test(refUrl.hostname)) return 'search';
    if (/weibo|wechat|facebook|twitter|x\.com|instagram/i.test(refUrl.hostname)) return 'social';
    return 'external';
  } catch (error) {
    return 'unknown';
  }
}

function copyWhitelistedBody(body = {}) {
  const event = {};
  for (const field of EVENT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) event[field] = body[field];
  }
  return event;
}

function validatePayload(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'payload must be an object';
  }
  if (body.eventName !== undefined && String(body.eventName).length > 80) {
    return 'eventName is too long';
  }
  if (body.path !== undefined && String(body.path).length > 2048) {
    return 'path is too long';
  }
  if (body.visitorHash !== undefined && String(body.visitorHash).length > 128) {
    return 'visitorHash is too long';
  }
  if (body.userId !== undefined && String(body.userId).length > 128) {
    return 'userId is too long';
  }
  return null;
}

function createRateLimiter({ service, windowMs, max }) {
  const buckets = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = service.hashIp(getClientIp(req)) || 'ip_unknown';
    const bucket = buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    bucket.count += 1;
    if (bucket.count > max) {
      res.set('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
      return res.status(429).json({
        error: { code: 'ANALYTICS_RATE_LIMIT', message: 'Too many analytics events' }
      });
    }
    return next();
  };
}

function buildEventInput(req) {
  const body = req.body || {};
  const event = copyWhitelistedBody(body);
  event.channel = inferChannel(req, body);
  event.deviceType = inferDeviceType(req, body);
  event.referrerType = inferReferrerType(req, body);
  event.ip = getClientIp(req);
  event.userAgent = req.get?.('user-agent') || req.headers['user-agent'] || '';
  return event;
}

function createRouter(options = {}) {
  const router = express.Router();
  const env = options.env || process.env;
  const service = options.service || analyticsService;
  const rateLimitOptions = options.rateLimit || {};
  const windowMs = Math.max(1000, Number(rateLimitOptions.windowMs || env.ANALYTICS_EVENT_RATE_LIMIT_WINDOW_MS || DEFAULT_WINDOW_MS));
  const max = Math.max(1, Number(rateLimitOptions.max || env.ANALYTICS_EVENT_RATE_LIMIT_MAX || DEFAULT_MAX_REQUESTS));

  router.post('/event', createRateLimiter({ service, windowMs, max }), (req, res) => {
    try {
      const validationError = validatePayload(req.body);
      if (validationError) {
        return res.status(400).json({
          error: { code: 'INVALID_ANALYTICS_EVENT', message: validationError }
        });
      }

      const result = service.recordEvent(buildEventInput(req));
      return res.status(202).json({
        success: true,
        accepted: result.accepted,
        ignored: result.ignored,
        reason: result.reason,
        eventId: result.eventId
      });
    } catch (error) {
      return res.status(500).json({
        error: { code: 'ANALYTICS_EVENT_FAILED', message: error.message || 'record analytics event failed' }
      });
    }
  });

  return router;
}

module.exports = createRouter();
module.exports.createRouter = createRouter;
module.exports._test = {
  buildEventInput,
  copyWhitelistedBody,
  getClientIp,
  inferChannel,
  inferDeviceType,
  inferReferrerType,
  validatePayload
};
