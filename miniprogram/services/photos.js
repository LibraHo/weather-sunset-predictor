import { createApiError, getApiConfig, request } from './api.js';
import { getSessionToken, loginWithWechat } from './auth.js';

const PHOTOS_PATH = '/api/photos';
const MY_PHOTOS_PATH = '/api/photos/mine';
const PHOTO_UPLOAD_PATH = '/api/photos/upload';

function getWx(options = {}) {
  if (options.wx) return options.wx;
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

function normalizeImageUrl(value, baseUrl = '') {
  if (!value) return '';
  const url = String(value);
  if (/^(https?:|wxfile:|cloud:|data:|file:)/i.test(url)) return url;
  if (url.startsWith('//')) return `https:${url}`;
  return joinUrl(baseUrl, url);
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function parseNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseUploadBody(data) {
  if (typeof data !== 'string') return data;
  if (!data.trim()) return {};
  try {
    return JSON.parse(data);
  } catch (error) {
    return { raw: data };
  }
}

function normalizePhotosPayload(payload) {
  const source = payload?.data ?? payload;
  if (Array.isArray(source)) return source;
  if (Array.isArray(source?.photos)) return source.photos;
  if (Array.isArray(source?.items)) return source.items;
  if (Array.isArray(source?.results)) return source.results;
  if (Array.isArray(payload?.photos)) return payload.photos;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function normalizeUploadPayload(payload) {
  const source = payload?.data ?? payload;
  return source?.photo ?? source;
}

export function normalizePhoto(photo = {}, options = {}) {
  const location = photo.location || {};
  const uploader = photo.uploader || photo.user || {};
  const id = firstDefined(photo.id, photo.photoId, photo._id, '');
  const baseUrl = options.baseUrl ?? getApiConfig().baseUrl;
  const thumbUrl = normalizeImageUrl(firstDefined(
    photo.thumbUrl,
    photo.thumbnailUrl,
    photo.thumbnail_url,
    photo.thumb_url,
    photo.thumbnail,
    photo.coverUrl,
    photo.cover_url,
    photo.urls?.thumb,
    id ? joinUrl(baseUrl, `/api/photos/${encodeURIComponent(id)}/thumb`) : ''
  ), baseUrl);
  const originalUrl = normalizeImageUrl(firstDefined(
    photo.originalUrl,
    photo.original_url,
    photo.url,
    photo.imageUrl,
    photo.original,
    photo.fullUrl,
    photo.full_url,
    photo.urls?.original,
    id ? joinUrl(baseUrl, `/api/photos/${encodeURIComponent(id)}/original`) : ''
  ), baseUrl);

  return {
    id,
    lat: parseNumber(firstDefined(photo.lat, photo.latitude, location.lat, location.latitude)),
    lon: parseNumber(firstDefined(photo.lon, photo.lng, photo.longitude, location.lon, location.lng, location.longitude)),
    locationName: firstDefined(photo.locationName, photo.location_name, photo.placeName, location.name, ''),
    uploaderName: firstDefined(photo.uploaderName, photo.uploader_name, uploader.name, uploader.nickName, uploader.nickname, ''),
    takenAt: firstDefined(photo.takenAt, photo.taken_at, photo.capturedAt, photo.createdAt, null),
    uploadedAt: firstDefined(photo.uploadedAt, photo.uploaded_at, photo.createdAt, null),
    desc: firstDefined(photo.desc, photo.description, photo.caption, ''),
    reviewStatus: firstDefined(photo.reviewStatus, photo.review_status, 'approved'),
    reviewNote: firstDefined(photo.reviewNote, photo.review_note, ''),
    reviewedAt: firstDefined(photo.reviewedAt, photo.reviewed_at) ?? null,
    thumbUrl,
    originalUrl
  };
}

export function buildPhotoUploadFormData(photo = {}) {
  const fields = {
    locationName: photo.locationName,
    uploaderName: photo.uploaderName,
    takenAt: photo.takenAt,
    lat: photo.lat,
    lon: photo.lon,
    desc: photo.desc
  };

  return Object.fromEntries(
    Object.entries(fields)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => [key, String(value)])
  );
}

function toPhotoServiceError(error, fallback = {}) {
  return createApiError(error?.error || error, fallback);
}

function createAuthUnavailableError() {
  return toPhotoServiceError({
    code: 'MINI_LOGIN_UNAVAILABLE',
    message: '当前无法完成小程序基础登录，照片上传暂不可用；预测、地图和收藏可继续使用。'
  }, { status: 401 });
}

function rejectUploadResponse(response = {}) {
  const status = response.statusCode ?? response.status ?? 0;
  const body = parseUploadBody(response.data);
  const serverError = body?.error || (body?.success === false ? body?.error : null);

  return toPhotoServiceError(serverError, {
    status,
    data: body,
    code: serverError?.code || `HTTP_${status}`,
    message: serverError?.message || `上传失败（${status}）`
  });
}

async function resolveUploadToken(options = {}, wxClient) {
  const config = getApiConfig();
  const explicitToken = firstDefined(options.authorizationToken, options.bearerToken, options.sessionToken, options.token);
  if (explicitToken) return explicitToken;

  const existingToken = getSessionToken({ wx: wxClient }) || config.sessionToken;
  if (existingToken) return existingToken;

  if (options.autoLogin === false) return null;
  let session = null;
  try {
    session = await loginWithWechat({ wx: wxClient, profile: options.profile });
  } catch (error) {
    return null;
  }
  return session?.sessionToken || session?.token || null;
}

function buildUploadHeader(token, options = {}) {
  const header = { ...(options.header || options.headers || {}) };
  if (!token) return header;

  const useBearer = options.useAuthorization === true
    || options.authType === 'bearer'
    || options.tokenType === 'bearer'
    || options.authorizationToken
    || options.bearerToken;

  if (useBearer) {
    header.Authorization = `Bearer ${token}`;
  } else {
    header['X-Session-Token'] = token;
  }
  return header;
}

export async function listPhotos(options = {}) {
  const config = getApiConfig();
  const response = await request(PHOTOS_PATH, {
    method: 'GET',
    query: options.query || options.params,
    wx: options.wx,
    baseUrl: options.baseUrl,
    timeout: options.timeout,
    header: options.header || options.headers,
    sessionToken: options.sessionToken || options.token
  });

  return normalizePhotosPayload(response).map((photo) => normalizePhoto(photo, {
    baseUrl: options.baseUrl ?? config.baseUrl
  }));
}

export async function listMyPhotos(options = {}) {
  const config = getApiConfig();
  const wxClient = getWx(options);
  const token = await resolveUploadToken(options, wxClient);
  if (!token) return [];
  const response = await request(MY_PHOTOS_PATH, {
    method: 'GET',
    wx: wxClient,
    baseUrl: options.baseUrl,
    timeout: options.timeout,
    header: buildUploadHeader(token, options),
    sessionToken: token
  });

  return normalizePhotosPayload(response).map((photo) => normalizePhoto(photo, {
    baseUrl: options.baseUrl ?? config.baseUrl
  }));
}

export async function updateMyPhoto(id, patch = {}, options = {}) {
  const config = getApiConfig();
  const wxClient = getWx(options);
  const token = await resolveUploadToken(options, wxClient);
  if (!token) throw createAuthUnavailableError();
  const response = await request(`${MY_PHOTOS_PATH}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    data: patch,
    wx: wxClient,
    baseUrl: options.baseUrl,
    timeout: options.timeout,
    header: buildUploadHeader(token, options),
    sessionToken: token
  });
  return normalizePhoto(normalizeUploadPayload(response), {
    baseUrl: options.baseUrl ?? config.baseUrl
  });
}

export async function deleteMyPhoto(id, options = {}) {
  const wxClient = getWx(options);
  const token = await resolveUploadToken(options, wxClient);
  if (!token) throw createAuthUnavailableError();
  await request(`${MY_PHOTOS_PATH}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    wx: wxClient,
    baseUrl: options.baseUrl,
    timeout: options.timeout,
    header: buildUploadHeader(token, options),
    sessionToken: token
  });
  return true;
}

export async function uploadPhoto(photo = {}, options = {}) {
  const wxClient = getWx(options);
  if (!wxClient || typeof wxClient.uploadFile !== 'function') {
    throw toPhotoServiceError({ code: 'WX_UNAVAILABLE', message: 'wx.uploadFile 不可用' });
  }
  if (!photo.filePath) {
    throw toPhotoServiceError({ code: 'FILE_PATH_REQUIRED', message: 'filePath 必填' });
  }

  const config = getApiConfig();
  const token = await resolveUploadToken(options, wxClient);
  if (!token) throw createAuthUnavailableError();
  const url = joinUrl(options.baseUrl ?? config.baseUrl, options.path || PHOTO_UPLOAD_PATH);
  const formData = buildPhotoUploadFormData(photo);
  const header = buildUploadHeader(token, options);

  return new Promise((resolve, reject) => {
    const uploadTask = wxClient.uploadFile({
      url,
      filePath: photo.filePath,
      name: options.name || 'photo',
      formData,
      header,
      timeout: options.timeout ?? config.timeout,
      success(response = {}) {
        const status = response.statusCode ?? response.status ?? 0;
        const body = parseUploadBody(response.data);

        if (status >= 200 && status < 300 && body?.success !== false) {
          resolve(normalizePhoto(normalizeUploadPayload(body)));
          return;
        }
        reject(rejectUploadResponse({ ...response, data: body }));
      },
      fail(error = {}) {
        reject(toPhotoServiceError(error, {
          code: error.errMsg ? 'WX_UPLOAD_FAILED' : 'NETWORK_ERROR',
          message: error.errMsg || error.message || '照片上传失败'
        }));
      }
    });

    if (uploadTask && typeof uploadTask.onProgressUpdate === 'function' && typeof options.onProgress === 'function') {
      uploadTask.onProgressUpdate(options.onProgress);
    }
  });
}

export default {
  listPhotos,
  listMyPhotos,
  uploadPhoto,
  updateMyPhoto,
  deleteMyPhoto,
  normalizePhoto,
  buildPhotoUploadFormData
};
