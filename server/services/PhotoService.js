/**
 * PhotoService.js - 火烧云照片管理服务（Phase 20 任务 70.1/70.2）
 *
 * 功能：
 * - 初始化存储目录与索引文件
 * - 上传原图、生成 300x300 缩略图
 * - 支持 EXIF GPS 解析（由调用方传入）
 * - 照片 CRUD（列表、删除）
 *
 * 存储结构：
 *   ~/.xiake/photos/
 *     originals/   原始图片
 *     thumbs/      缩略图
 *     photos.json  照片索引
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// ---------------------------------------------------------------------------
// 路径配置（可通过环境变量覆盖）
// ---------------------------------------------------------------------------
const XIAKE_DIR = process.env.XIAKE_DIR
  ? path.resolve(process.env.XIAKE_DIR)
  : path.join(os.homedir(), '.xiake');

const PHOTOS_DIR       = path.join(XIAKE_DIR, 'photos');
const ORIGINALS_DIR    = path.join(PHOTOS_DIR, 'originals');
const THUMBS_DIR       = path.join(PHOTOS_DIR, 'thumbs');
const PHOTOS_INDEX     = path.join(PHOTOS_DIR, 'photos.json');

const THUMB_SIZE       = 300; // px，正方形
const MAX_FILE_SIZE_MB = 20;  // 上传上限（MB）
const ALLOWED_MIMES    = new Set(['image/jpeg', 'image/png', 'image/heic', 'image/heif']);
const OCTET_STREAM_MIME = 'application/octet-stream';
const DAILY_UPLOAD_LIMIT_PER_IP = Math.max(
  0,
  parseInt(process.env.PHOTO_UPLOAD_DAILY_IP_LIMIT || '3', 10) || 0
);
const UPLOAD_DAY_TIME_ZONE = process.env.PHOTO_UPLOAD_DAY_TIME_ZONE || 'Asia/Shanghai';
const IP_HASH_SALT = process.env.PHOTO_UPLOAD_IP_HASH_SALT || process.env.ADMIN_PASSWORD || 'xiake-photo-upload';

// ---------------------------------------------------------------------------
// 内部辅助
// ---------------------------------------------------------------------------

/**
 * 确保目录存在，不存在则递归创建。
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * 读取照片索引。
 * @returns {object[]} 照片元数据数组
 */
function readIndex() {
  try {
    if (!fs.existsSync(PHOTOS_INDEX)) return [];
    const raw = fs.readFileSync(PHOTOS_INDEX, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * 写入照片索引（原子替换：先写临时文件再 rename）。
 * @param {object[]} photos
 */
function writeIndex(photos) {
  ensureDir(PHOTOS_DIR);
  const tmpFile = PHOTOS_INDEX + '.tmp';
  fs.writeFileSync(tmpFile, JSON.stringify(photos, null, 2), 'utf-8');
  fs.renameSync(tmpFile, PHOTOS_INDEX);
}

function getUploadDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: UPLOAD_DAY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function normalizeClientIp(clientIp = '') {
  return String(clientIp)
    .split(',')[0]
    .trim()
    .replace(/^::ffff:/, '');
}

function hashClientIp(clientIp = '') {
  const normalizedIp = normalizeClientIp(clientIp);
  if (!normalizedIp) return null;
  return crypto
    .createHash('sha256')
    .update(`${IP_HASH_SALT}:${normalizedIp}`)
    .digest('hex');
}

function getDailyUploadStatsForIp(clientIp, now = new Date()) {
  const uploadIpHash = hashClientIp(clientIp);
  const uploadDay = getUploadDay(now);

  if (!uploadIpHash) {
    return {
      uploadDay,
      uploadIpHash: null,
      limit: DAILY_UPLOAD_LIMIT_PER_IP,
      used: 0,
      remaining: DAILY_UPLOAD_LIMIT_PER_IP,
    };
  }

  const photos = readIndex();
  const used = photos.filter(photo =>
    photo.uploadIpHash === uploadIpHash && photo.uploadDay === uploadDay
  ).length;

  return {
    uploadDay,
    uploadIpHash,
    limit: DAILY_UPLOAD_LIMIT_PER_IP,
    used,
    remaining: Math.max(DAILY_UPLOAD_LIMIT_PER_IP - used, 0),
  };
}

function assertDailyUploadLimit(clientIp, now = new Date()) {
  if (DAILY_UPLOAD_LIMIT_PER_IP <= 0) return null;

  const stats = getDailyUploadStatsForIp(clientIp, now);
  if (stats.uploadIpHash && stats.used >= DAILY_UPLOAD_LIMIT_PER_IP) {
    const err = new Error(`DAILY_UPLOAD_LIMIT_EXCEEDED: ${stats.used}/${DAILY_UPLOAD_LIMIT_PER_IP}`);
    err.code = 'DAILY_UPLOAD_LIMIT_EXCEEDED';
    err.limit = DAILY_UPLOAD_LIMIT_PER_IP;
    err.used = stats.used;
    err.uploadDay = stats.uploadDay;
    throw err;
  }

  return stats;
}

function detectImageMimeFromBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg';

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buffer.toString('ascii', 8, Math.min(buffer.length, 28));
    if (/hei[cfx]|mif1|msf1/i.test(brand)) return 'image/heic';
  }

  return null;
}

function normalizeImageMime({ buffer, mimeType = '' }) {
  const normalizedMime = String(mimeType || '').toLowerCase();
  if (ALLOWED_MIMES.has(normalizedMime)) return normalizedMime;

  if (normalizedMime === OCTET_STREAM_MIME || !normalizedMime) {
    const detectedMime = detectImageMimeFromBuffer(buffer);
    if (detectedMime) return detectedMime;
  }

  return null;
}

// ---------------------------------------------------------------------------
// 导出函数
// ---------------------------------------------------------------------------

/**
 * 初始化存储目录与空索引。
 * 幂等操作，可多次调用。
 */
function initDirs() {
  ensureDir(PHOTOS_DIR);
  ensureDir(ORIGINALS_DIR);
  ensureDir(THUMBS_DIR);
  if (!fs.existsSync(PHOTOS_INDEX)) {
    writeIndex([]);
  }
}

/**
 * 生成缩略图（300×300 正方形 center-crop）。
 * 使用 sharp（若 sharp 不可用则跳过缩略图生成，仅记录警告）。
 *
 * @param {string} srcPath  原图路径
 * @param {string} dstPath  缩略图目标路径
 * @returns {Promise<boolean>} 成功返回 true，失败返回 false
 */
async function generateThumbnail(srcPath, dstPath) {
  try {
    const sharp = require('sharp');
    await sharp(srcPath)
      .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 85 })
      .toFile(dstPath);
    return true;
  } catch (err) {
    console.warn('[PhotoService] generateThumbnail failed:', err.message);
    return false;
  }
}

/**
 * 保存照片（原图写盘 + 缩略图生成 + 写入索引）。
 *
 * @param {object} opts
 * @param {Buffer}  opts.buffer     图片 Buffer
 * @param {string}  opts.mimeType   MIME 类型（image/jpeg 等）
 * @param {string}  [opts.filename] 原始文件名（仅用于显示，不影响存储路径）
 * @param {number}  [opts.lat]      纬度（EXIF 或手动指定）
 * @param {number}  [opts.lon]      经度（EXIF 或手动指定）
 * @param {string}  [opts.takenAt]  ISO8601 拍摄时间
 * @param {string}  [opts.locationName] 拍摄地点名称
 * @param {string}  [opts.uploaderName] 上传者展示名
 * @param {string}  [opts.uploaderUserId] 上传者用户 ID（小程序登录用户）
 * @param {string}  [opts.desc]     照片描述
 * @param {string}  [opts.clientIp] 上传客户端 IP（用于每日限额，不落明文）
 * @returns {Promise<object>} 已保存的照片元数据
 * @throws {Error} 若 MIME 不合法或 buffer 超限则抛出
 */
async function savePhoto({ buffer, mimeType, filename = '', lat, lon, takenAt, locationName = '', uploaderName = '', uploaderUserId = '', desc = '', clientIp = '' }) {
  const now = new Date();
  const uploadStats = assertDailyUploadLimit(clientIp, now);

  // 校验/修正 MIME：部分浏览器或相册来源会把图片上传成 application/octet-stream
  const normalizedMime = normalizeImageMime({ buffer, mimeType, filename });
  if (!normalizedMime) {
    throw new Error(`UNSUPPORTED_MIME: ${mimeType}`);
  }

  // 校验文件大小
  const sizeMb = buffer.length / (1024 * 1024);
  if (sizeMb > MAX_FILE_SIZE_MB) {
    throw new Error(`FILE_TOO_LARGE: ${sizeMb.toFixed(1)}MB > ${MAX_FILE_SIZE_MB}MB`);
  }

  initDirs();

  const id       = uuidv4();
  const ext      = normalizedMime === 'image/png'
    ? '.png'
    : (normalizedMime === 'image/heic' || normalizedMime === 'image/heif') ? '.heic' : '.jpg';
  const origFile = `${id}${ext}`;
  const thumbFile = `${id}_thumb.jpg`;

  const origPath  = path.join(ORIGINALS_DIR, origFile);
  const thumbPath = path.join(THUMBS_DIR, thumbFile);

  // 写原图
  fs.writeFileSync(origPath, buffer);

  // 生成缩略图
  const thumbOk = await generateThumbnail(origPath, thumbPath);

  const meta = {
    id,
    filename: filename || origFile,
    mimeType: normalizedMime,
    origFile,
    thumbFile: thumbOk ? thumbFile : null,
    lat:     Number.isFinite(lat)  ? lat  : null,
    lon:     Number.isFinite(lon)  ? lon  : null,
    takenAt: takenAt || null,
    locationName: String(locationName || '').trim(),
    uploaderName: String(uploaderName || '').trim(),
    uploaderUserId: String(uploaderUserId || '').trim() || null,
    desc,
    uploadedAt: now.toISOString(),
    uploadDay: uploadStats?.uploadDay || getUploadDay(now),
    uploadIpHash: uploadStats?.uploadIpHash || hashClientIp(clientIp),
    sizeMb: parseFloat(sizeMb.toFixed(3)),
  };

  const photos = readIndex();
  photos.unshift(meta); // 最新在前
  writeIndex(photos);

  return meta;
}

/**
 * 获取所有照片元数据（按 uploadedAt 倒序）。
 * @returns {object[]}
 */
function getPhotos() {
  initDirs();
  return readIndex();
}

function normalizeOptionalText(value) {
  return String(value ?? '').trim();
}

function normalizeOptionalCoordinate(value, min, max) {
  if (value === '' || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) && num >= min && num <= max ? num : null;
}

function normalizeOptionalDate(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * 更新照片元数据，不改动原图/缩略图文件。
 * @param {string} id
 * @param {object} patch
 * @returns {object|null} 更新后的照片，不存在返回 null
 */
function updatePhoto(id, patch = {}) {
  initDirs();
  const photos = readIndex();
  const idx = photos.findIndex(p => p.id === id);
  if (idx === -1) return null;

  const current = photos[idx];
  const next = { ...current };

  if (Object.prototype.hasOwnProperty.call(patch, 'desc')) {
    next.desc = normalizeOptionalText(patch.desc);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'locationName')) {
    next.locationName = normalizeOptionalText(patch.locationName);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'uploaderName')) {
    next.uploaderName = normalizeOptionalText(patch.uploaderName);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'takenAt')) {
    next.takenAt = normalizeOptionalDate(patch.takenAt);
  }

  const hasLat = Object.prototype.hasOwnProperty.call(patch, 'lat');
  const hasLon = Object.prototype.hasOwnProperty.call(patch, 'lon');
  if (hasLat || hasLon) {
    const lat = hasLat ? normalizeOptionalCoordinate(patch.lat, -90, 90) : current.lat;
    const lon = hasLon ? normalizeOptionalCoordinate(patch.lon, -180, 180) : current.lon;
    next.lat = Number.isFinite(lat) && Number.isFinite(lon) ? lat : null;
    next.lon = Number.isFinite(lat) && Number.isFinite(lon) ? lon : null;
  }

  photos[idx] = next;
  writeIndex(photos);
  return next;
}

/**
 * 根据 ID 删除照片（原图 + 缩略图 + 索引条目）。
 * @param {string} id
 * @returns {boolean} 找到并删除返回 true，否则返回 false
 */
function deletePhoto(id) {
  initDirs();
  const photos = readIndex();
  const idx = photos.findIndex(p => p.id === id);
  if (idx === -1) return false;

  const photo = photos[idx];

  // 删除磁盘文件（容错：文件不存在不报错）
  const origPath  = path.join(ORIGINALS_DIR, photo.origFile);
  const thumbPath = photo.thumbFile ? path.join(THUMBS_DIR, photo.thumbFile) : null;

  try { fs.unlinkSync(origPath);  } catch { /* 已不存在 */ }
  if (thumbPath) {
    try { fs.unlinkSync(thumbPath); } catch { /* 已不存在 */ }
  }

  photos.splice(idx, 1);
  writeIndex(photos);
  return true;
}

/**
 * 按 ID 获取单张照片元数据。
 * @param {string} id
 * @returns {object|null}
 */
function getPhotoById(id) {
  return readIndex().find(p => p.id === id) || null;
}

// ---------------------------------------------------------------------------
// 路径工具（供路由层使用）
// ---------------------------------------------------------------------------
function getOriginalPath(origFile) {
  return path.join(ORIGINALS_DIR, origFile);
}

function getThumbPath(thumbFile) {
  return path.join(THUMBS_DIR, thumbFile);
}

module.exports = {
  // 核心操作
  initDirs,
  savePhoto,
  getPhotos,
  updatePhoto,
  deletePhoto,
  getPhotoById,
  generateThumbnail,
  getUploadDay,
  normalizeClientIp,
  hashClientIp,
  getDailyUploadStatsForIp,
  assertDailyUploadLimit,
  // 路径工具
  getOriginalPath,
  getThumbPath,
  // 路径常量（供测试用）
  PHOTOS_DIR,
  ORIGINALS_DIR,
  THUMBS_DIR,
  PHOTOS_INDEX,
  ALLOWED_MIMES,
  detectImageMimeFromBuffer,
  normalizeImageMime,
  MAX_FILE_SIZE_MB,
  DAILY_UPLOAD_LIMIT_PER_IP,
  UPLOAD_DAY_TIME_ZONE,
};
