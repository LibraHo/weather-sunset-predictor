import { configureApi, request } from './api.js';

export async function loginWithWechatCode({ code, profile } = {}) {
  if (!code) {
    throw new Error('WECHAT_CODE_REQUIRED');
  }

  const response = await request('/api/wechat/login', {
    method: 'POST',
    data: { code, profile }
  });
  const session = response?.data || response;
  const sessionToken = session.sessionToken || session.token || null;

  if (sessionToken) {
    configureApi({ sessionToken });
  }

  return {
    userId: session.userId || session.user?.id || null,
    sessionToken,
    user: session.user || null,
    identities: session.identities || []
  };
}

export default { loginWithWechatCode };
