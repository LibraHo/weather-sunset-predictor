/**
 * API application routes.
 *
 * Public submission allows anonymous applications, but when a valid user
 * session token is provided the application is linked to the server userId.
 */

'use strict';

const express = require('express');
const ApiApplicationService = require('../services/ApiApplicationService');
const UserService = require('../services/UserService');

function extractBearerToken(req) {
  const auth = req.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(auth);
  return match ? match[1].trim() : '';
}

function getOptionalUser(req, userService) {
  const token = extractBearerToken(req);
  if (!token) return null;
  try {
    if (typeof userService.load === 'function') {
      userService.data = userService.load();
    }
    return userService.verifyToken(token) || null;
  } catch {
    return null;
  }
}

function emitOptionalAnalytics(req, analyticsHook, event) {
  const hook = analyticsHook || req.app?.locals?.analyticsHook;
  if (typeof hook !== 'function') return;
  Promise.resolve().then(() => {
    try {
      Promise.resolve(hook(event)).catch(() => {});
    } catch {
      // Analytics must never block API application submission.
    }
  });
}

function toSubmissionResponse(application) {
  return {
    id: application.id,
    email: application.email,
    contact: application.contact,
    countryRegion: application.countryRegion,
    nickname: application.nickname,
    purpose: application.purpose,
    expectedCallVolume: application.expectedCallVolume,
    status: application.status,
    remarks: application.remarks,
    userId: application.userId || null,
    ownerType: application.ownerType || (application.userId ? 'user' : 'anonymous'),
    createdAt: application.createdAt
  };
}

function createRouter(options = {}) {
  const router = express.Router();
  const service = options.service || new ApiApplicationService(options.serviceOptions);
  const userService = options.userService || new UserService(options.userServiceOptions);
  const analyticsHook = options.analyticsHook;

  router.post('/', (req, res) => {
    try {
      const user = getOptionalUser(req, userService);
      const application = service.submitApplication({
        ...(req.body || {}),
        userId: user?.userId || null
      });

      emitOptionalAnalytics(req, analyticsHook, {
        eventName: 'api_application_submit',
        userId: application.userId || null,
        ownerType: application.ownerType,
        targetType: 'api_application',
        targetId: application.id,
        status: 'success'
      });

      return res.status(201).json({
        success: true,
        application: toSubmissionResponse(application)
      });
    } catch (err) {
      const status = err.code === 'INVALID_PARAMS' ? 400 : 500;
      return res.status(status).json({
        error: { code: err.code || 'SUBMIT_FAILED', message: err.message || 'submit failed' }
      });
    }
  });

  router.get('/', (req, res) => {
    const status = req.query?.status;
    const list = service
      .listApplications()
      .filter((item) => !status || item.status === status)
      .map((item) => ({
        id: item.id,
        status: item.status,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }));

    return res.json({ success: true, applications: list });
  });

  return router;
}

module.exports = createRouter();
module.exports.createRouter = createRouter;
module.exports._test = { extractBearerToken, getOptionalUser, toSubmissionResponse };
