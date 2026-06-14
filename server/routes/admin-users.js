'use strict';

const express = require('express');
const UserService = require('../services/UserService');
const photoService = require('../services/PhotoService');
const analyticsService = require('../services/AnalyticsService');

function createRouter(options = {}) {
  const router = express.Router();
  const userService = options.userService || new UserService(options.userServiceOptions);
  const photos = options.photoService || photoService;
  const analytics = options.analyticsService || analyticsService;

  function reloadUsers() {
    if (typeof userService.load === 'function') {
      userService.data = userService.normalizeData(userService.load());
      userService.hydrateUsers();
    }
  }

  router.get('/', (req, res) => {
    reloadUsers();
    const photoCounts = new Map();
    if (typeof photos.getPhotos === 'function') {
      for (const photo of photos.getPhotos()) {
        if (!photo.uploaderUserId) continue;
        photoCounts.set(photo.uploaderUserId, (photoCounts.get(photo.uploaderUserId) || 0) + 1);
      }
    }
    res.json({
      success: true,
      users: userService
        .listAdminUsers({ query: req.query.q || req.query.query || '' })
        .map(user => ({ ...user, photosCount: photoCounts.get(user.userId) || 0 }))
    });
  });

  router.get('/:userId', (req, res) => {
    reloadUsers();
    const user = userService.getAdminUserDetail(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'user not found' } });
    }
    const photosCount = typeof photos.getPhotosByUser === 'function' ? photos.getPhotosByUser(user.userId).length : 0;
    return res.json({ success: true, user: { ...user, photosCount } });
  });

  router.patch('/:userId', (req, res) => {
    reloadUsers();
    const user = userService.updateAdminUser(req.params.userId, {
      disabled: req.body?.disabled,
      adminNote: req.body?.adminNote
    });
    if (!user) {
      return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'user not found' } });
    }
    return res.json({ success: true, user });
  });

  router.post('/:userId/revoke-sessions', (req, res) => {
    reloadUsers();
    if (!userService.findById(req.params.userId)) {
      return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'user not found' } });
    }
    const revokedCount = userService.revokeUserSessions(req.params.userId);
    return res.json({ success: true, revokedCount, user: userService.getAdminUserDetail(req.params.userId) });
  });

  router.delete('/:userId', (req, res) => {
    reloadUsers();
    const userId = req.params.userId;
    if (!userService.findById(userId)) {
      return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'user not found' } });
    }

    const userPhotos = typeof photos.getPhotosByUser === 'function' ? photos.getPhotosByUser(userId) : [];
    let deletedPhotos = 0;
    for (const photo of userPhotos) {
      if (photos.deletePhoto(photo.id)) deletedPhotos += 1;
    }
    const analyticsResult = typeof analytics.deleteByUserId === 'function'
      ? analytics.deleteByUserId(userId)
      : { deletedEvents: 0 };
    const deleted = userService.deleteUser(userId);

    return res.json({
      success: true,
      deleted,
      deletedPhotos,
      deletedAnalyticsEvents: analyticsResult.deletedEvents || 0
    });
  });

  return router;
}

module.exports = createRouter();
module.exports.createRouter = createRouter;
