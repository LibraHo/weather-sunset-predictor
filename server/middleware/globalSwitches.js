'use strict';

const globalSwitchService = require('../services/GlobalSwitchRuntime');

function blockWeatherPredictionWhenClosed(req, res, next) {
  if (!globalSwitchService.isWeatherPredictionClosed()) return next();
  return res.status(503).json(globalSwitchService.buildWeatherPredictionUnavailable());
}

function blockAgentWeatherPredictionWhenClosed(req, res, next) {
  const blockedAgentPaths = ['/forecast', '/explain', '/map-summary'];
  const shouldBlock = blockedAgentPaths.some(path => req.path === path || req.path.startsWith(`${path}/`));
  if (!shouldBlock) return next();
  return blockWeatherPredictionWhenClosed(req, res, next);
}

function blockPublicSiteWhenClosed(req, res, next) {
  if (!globalSwitchService.isSiteClosed()) return next();

  const allowedPrefixes = [
    '/admin',
    '/api/admin',
    '/api/config/site-state',
    '/health',
    '/styles',
    '/src',
    '/public',
    '/data',
    '/favicon.ico',
    '/config.api.js'
  ];
  if (allowedPrefixes.some(prefix => req.path === prefix || req.path.startsWith(`${prefix}/`))) {
    return next();
  }

  if (req.path.startsWith('/api/')) {
    return res.status(503).json({
      success: false,
      error: {
        code: 'SITE_CLOSED',
        message: 'Site is temporarily unavailable. Please come back later.'
      },
      availability: globalSwitchService.getPublicState()
    });
  }

  res.status(503).type('html').send(globalSwitchService.buildSiteClosedHtml());
}

module.exports = {
  blockAgentWeatherPredictionWhenClosed,
  blockWeatherPredictionWhenClosed,
  blockPublicSiteWhenClosed
};
