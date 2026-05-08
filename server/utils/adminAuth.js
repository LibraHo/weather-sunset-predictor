'use strict';

const basicAuth = require('basic-auth');

const ADMIN_REALM = 'Xiake Admin Console';

function getAdminCredentials() {
  return {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'xiake2024',
  };
}

function setAdminAuthChallenge(res) {
  res.set('WWW-Authenticate', `Basic realm="${ADMIN_REALM}"`);
}

function isValidAdminCredentials(credentials) {
  const expected = getAdminCredentials();
  return Boolean(
    credentials &&
    credentials.name === expected.username &&
    credentials.pass === expected.password
  );
}

function requireAdminAuth(req, res, next) {
  const credentials = basicAuth(req);

  if (!isValidAdminCredentials(credentials)) {
    setAdminAuthChallenge(res);
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: '认证失败'
      }
    });
  }

  next();
}

module.exports = {
  ADMIN_REALM,
  getAdminCredentials,
  isValidAdminCredentials,
  requireAdminAuth,
  setAdminAuthChallenge,
};
