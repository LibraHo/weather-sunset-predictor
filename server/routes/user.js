const express = require('express');
const UserService = require('../services/UserService');

const SESSION_COOKIE = 'xiake_session';

function sendError(res, error) {
  return res.status(error.status || 500).json({
    error: {
      code: error.code || 'INTERNAL_SERVER_ERROR',
      message: error.message || '服务器内部错误',
      ...(error.details ? { details: error.details } : {})
    }
  });
}

function createAuthMiddleware(userService) {
  return (req, res, next) => {
    const user = userService.getBearerUser(req.get('authorization')) ||
      userService.verifyToken(getCookie(req.headers.cookie, SESSION_COOKIE));
    if (!user) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: '请先登录' }
      });
    }
    req.user = user;
    next();
  };
}

function getCookie(header = '', name) {
  const cookies = String(header)
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
  for (const cookie of cookies) {
    const separator = cookie.indexOf('=');
    if (separator < 0) continue;
    if (cookie.slice(0, separator) === name) {
      return decodeURIComponent(cookie.slice(separator + 1));
    }
  }
  return null;
}

function createRouter(options = {}) {
  const router = express.Router();
  const userService = options.userService || new UserService(options.userServiceOptions);
  const requireUser = createAuthMiddleware(userService);

  router.use(requireUser);

  router.get('/favorites', (req, res) => {
    res.json({ favorites: userService.getFavorites(req.user.userId) });
  });

  router.post('/favorites', (req, res) => {
    try {
      const favorite = userService.addFavorite(req.user.userId, req.body?.location || req.body);
      res.status(201).json({ favorite });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.delete('/favorites/:id', (req, res) => {
    const deleted = userService.deleteFavorite(req.user.userId, req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: { code: 'FAVORITE_NOT_FOUND', message: '收藏不存在' } });
    }
    res.json({ success: true });
  });

  router.get('/recent-locations', (req, res) => {
    res.json({ recentLocations: userService.getRecentLocations(req.user.userId) });
  });

  router.post('/recent-locations', (req, res) => {
    try {
      const location = userService.addRecentLocation(req.user.userId, req.body?.location || req.body);
      res.status(201).json({ location });
    } catch (error) {
      sendError(res, error);
    }
  });

  return router;
}

module.exports = createRouter();
module.exports.createRouter = createRouter;
module.exports._test = { createAuthMiddleware, sendError, getCookie };
