'use strict';

const ADMIN_REALM = 'Xiake Admin Console';

function getAdminCredentials() {
  return {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'xiake2024',
  };
}

function parseBasicAuthHeader(header = '') {
  const match = /^Basic\s+(.+)$/i.exec(header);
  if (!match) return null;

  let decoded;
  try {
    decoded = Buffer.from(match[1], 'base64').toString('utf8');
  } catch {
    return null;
  }

  const idx = decoded.indexOf(':');
  if (idx === -1) return null;

  return {
    name: decoded.slice(0, idx),
    pass: decoded.slice(idx + 1),
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
  const credentials = parseBasicAuthHeader(req.get('Authorization'));

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
  parseBasicAuthHeader,
  requireAdminAuth,
  setAdminAuthChallenge,
};
