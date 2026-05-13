import { configureApi, getApiConfig, request } from './api.js';

const SESSION_TOKEN_KEY = 'sessionToken';
const CURRENT_USER_KEY = 'currentUser';

let injectedWx = null;
let memorySessionToken = null;
let memoryCurrentUser = null;

export function setAuthWxInstance(wxInstance) {
  injectedWx = wxInstance;
}

function getWx(options = {}) {
  if (options.wx) return options.wx;
  if (injectedWx) return injectedWx;
  if (typeof wx !== 'undefined') return wx;
  if (typeof globalThis !== 'undefined' && globalThis.wx) return globalThis.wx;
  return null;
}

function safeGetStorage(wxClient, key) {
  if (wxClient && typeof wxClient.getStorageSync === 'function') {
    try {
      return wxClient.getStorageSync(key);
    } catch (error) {
      return null;
    }
  }
  return null;
}

function safeSetStorage(wxClient, key, value) {
  if (wxClient && typeof wxClient.setStorageSync === 'function') {
    try {
      wxClient.setStorageSync(key, value);
    } catch (error) {
      // Storage is best-effort in tests and restricted runtimes.
    }
  }
}

function safeRemoveStorage(wxClient, key) {
  if (wxClient && typeof wxClient.removeStorageSync === 'function') {
    try {
      wxClient.removeStorageSync(key);
    } catch (error) {
      // Storage is best-effort in tests and restricted runtimes.
    }
  }
}

function wxLogin(wxClient) {
  if (!wxClient || typeof wxClient.login !== 'function') {
    return Promise.reject(new Error('WX_LOGIN_UNAVAILABLE'));
  }

  return new Promise((resolve, reject) => {
    wxClient.login({
      success(result = {}) {
        if (result.code) {
          resolve(result.code);
          return;
        }
        reject(new Error('WECHAT_CODE_REQUIRED'));
      },
      fail(error = {}) {
        reject(error instanceof Error ? error : new Error(error.errMsg || error.message || 'WX_LOGIN_FAILED'));
      }
    });
  });
}

export function saveSession(session = {}, options = {}) {
  const wxClient = getWx(options);
  const sessionToken = session.sessionToken || session.token || null;
  const currentUser = session.user || session.currentUser || null;

  memorySessionToken = sessionToken;
  memoryCurrentUser = currentUser;
  configureApi({ sessionToken });

  if (sessionToken) safeSetStorage(wxClient, SESSION_TOKEN_KEY, sessionToken);
  if (currentUser) safeSetStorage(wxClient, CURRENT_USER_KEY, currentUser);

  return { sessionToken, currentUser };
}

export function getSessionToken(options = {}) {
  const wxClient = getWx(options);
  const token = memorySessionToken || safeGetStorage(wxClient, SESSION_TOKEN_KEY) || getApiConfig().sessionToken || null;
  if (token) configureApi({ sessionToken: token });
  return token;
}

export function getCurrentUser(options = {}) {
  const wxClient = getWx(options);
  return memoryCurrentUser || safeGetStorage(wxClient, CURRENT_USER_KEY) || null;
}

export function clearSession(options = {}) {
  const wxClient = getWx(options);
  memorySessionToken = null;
  memoryCurrentUser = null;
  configureApi({ sessionToken: null });
  safeRemoveStorage(wxClient, SESSION_TOKEN_KEY);
  safeRemoveStorage(wxClient, CURRENT_USER_KEY);
}

export async function loginWithWechatCode({ code, profile, wx: wxClient } = {}) {
  if (!code) {
    throw new Error('WECHAT_CODE_REQUIRED');
  }

  const response = await request('/api/wechat/login', {
    method: 'POST',
    data: { code, profile },
    wx: wxClient
  });
  const session = response?.data || response;
  const sessionToken = session.sessionToken || session.token || null;
  const user = session.user || null;
  const userId = session.userId || user?.userId || user?.id || null;
  const identities = session.identities || user?.identities || [];

  saveSession({ ...session, sessionToken }, { wx: wxClient });

  return {
    userId,
    sessionToken,
    user,
    identities
  };
}

export async function loginWithWechat({ profile, wx: wxClient } = {}) {
  const resolvedWx = getWx({ wx: wxClient });
  const code = await wxLogin(resolvedWx);
  return loginWithWechatCode({ code, profile, wx: resolvedWx });
}

export default {
  setAuthWxInstance,
  loginWithWechat,
  loginWithWechatCode,
  saveSession,
  getSessionToken,
  getCurrentUser,
  clearSession
};
