const DEFAULT_CONFIG = {
  baseUrl: '',
  timeout: 10000,
  sessionToken: null
};

let runtimeConfig = { ...DEFAULT_CONFIG };
let injectedWx = null;

export function configureApi(config = {}) {
  runtimeConfig = { ...runtimeConfig, ...config };
  return { ...runtimeConfig };
}

export function resetApiConfig() {
  runtimeConfig = { ...DEFAULT_CONFIG };
  injectedWx = null;
}

export function setWxInstance(wxInstance) {
  injectedWx = wxInstance;
}

export function getApiConfig() {
  return { ...runtimeConfig };
}

function getWx() {
  if (injectedWx) return injectedWx;
  if (typeof wx !== 'undefined') return wx;
  if (typeof globalThis !== 'undefined' && globalThis.wx) return globalThis.wx;
  return null;
}

function joinUrl(baseUrl = '', path = '') {
  if (/^https?:\/\//i.test(path)) return path;
  const base = String(baseUrl || '').replace(/\/$/, '');
  const suffix = String(path || '').startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

function buildQuery(params = {}) {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '');
  if (!entries.length) return '';
  return entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

export function createApiError(error, fallback = {}) {
  const source = error || {};
  const apiError = new Error(source.message || fallback.message || '请求失败');
  apiError.name = 'ApiError';
  apiError.code = source.code || fallback.code || 'REQUEST_FAILED';
  apiError.status = source.status ?? source.statusCode ?? fallback.status ?? null;
  apiError.data = source.data ?? fallback.data ?? null;
  apiError.isApiError = true;
  return apiError;
}

export function request(pathOrOptions, maybeOptions = {}) {
  const options = typeof pathOrOptions === 'string'
    ? { ...maybeOptions, url: pathOrOptions }
    : { ...pathOrOptions };

  const wxClient = options.wx || getWx();
  if (!wxClient || typeof wxClient.request !== 'function') {
    return Promise.reject(createApiError({ code: 'WX_UNAVAILABLE', message: 'wx.request 不可用' }));
  }

  const method = (options.method || 'GET').toUpperCase();
  const query = buildQuery(options.query || options.params);
  const rawUrl = options.url || options.path || '';
  const separator = rawUrl.includes('?') ? '&' : '?';
  const urlWithQuery = query ? `${rawUrl}${separator}${query}` : rawUrl;
  const fullUrl = joinUrl(options.baseUrl ?? runtimeConfig.baseUrl, urlWithQuery);
  const token = options.sessionToken ?? options.token ?? runtimeConfig.sessionToken;
  const header = {
    'Content-Type': 'application/json',
    'X-Xiake-Client': 'miniprogram',
    ...(options.header || options.headers || {})
  };

  if (token) {
    header['X-Session-Token'] = token;
  }

  return new Promise((resolve, reject) => {
    wxClient.request({
      url: fullUrl,
      method,
      data: options.data,
      header,
      timeout: options.timeout ?? runtimeConfig.timeout,
      success(response = {}) {
        const status = response.statusCode ?? response.status ?? 0;
        const body = response.data;
        if (status >= 200 && status < 300) {
          if (body && body.success === false) {
            reject(createApiError(body.error, { status, data: body }));
            return;
          }
          resolve(body);
          return;
        }
        reject(createApiError(body?.error, {
          status,
          data: body,
          code: body?.error?.code || `HTTP_${status}`,
          message: body?.error?.message || `请求失败（${status}）`
        }));
      },
      fail(error = {}) {
        reject(createApiError(error, {
          code: error.errMsg ? 'WX_REQUEST_FAILED' : 'NETWORK_ERROR',
          message: error.errMsg || error.message || '网络请求失败'
        }));
      }
    });
  });
}

export default {
  configureApi,
  resetApiConfig,
  setWxInstance,
  getApiConfig,
  request,
  createApiError
};
