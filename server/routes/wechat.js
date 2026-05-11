const express = require('express');
const UserService = require('../services/UserService');
const WechatAuthService = require('../services/WechatAuthService');

function errorResponse(res, error) {
  return res.status(error.status || 500).json({
    error: {
      code: error.code || 'INTERNAL_SERVER_ERROR',
      message: error.message || '服务器内部错误',
      ...(error.details ? { details: error.details } : {})
    }
  });
}

function createRouter(options = {}) {
  const router = express.Router();
  const userService = options.userService || new UserService(options.userServiceOptions);
  const wechatAuthService = options.wechatAuthService || new WechatAuthService(options.wechatAuthOptions);

  router.post('/login', async (req, res) => {
    try {
      const code = req.body?.code;
      const session = await wechatAuthService.code2Session(code);
      const user = userService.upsertWechatUser(session);
      const token = userService.issueToken(user);

      res.json({
        token,
        user: {
          userId: user.userId,
          identities: user.identities.map(identity => ({
            provider: identity.provider,
            subject: identity.subject
          }))
        }
      });
    } catch (error) {
      errorResponse(res, error);
    }
  });

  return router;
}

module.exports = createRouter();
module.exports.createRouter = createRouter;
module.exports._test = { errorResponse };
