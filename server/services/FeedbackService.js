'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const XIAKE_DIR = path.join(process.env.HOME || '/home/ubuntu', '.xiake');
const FEEDBACK_DIR = path.join(XIAKE_DIR, 'feedback');
const IMAGE_DIR = path.join(FEEDBACK_DIR, 'images');
const FEEDBACK_INDEX = path.join(FEEDBACK_DIR, 'feedback.json');

const TYPE_LABELS = {
  missed: '漏报',
  wrong: '误报',
  overstated: '虚报'
};

function initDirs() {
  fs.mkdirSync(IMAGE_DIR, { recursive: true });
  if (!fs.existsSync(FEEDBACK_INDEX)) {
    fs.writeFileSync(FEEDBACK_INDEX, JSON.stringify([], null, 2), 'utf8');
  }
}

function readIndex() {
  initDirs();
  try {
    const parsed = JSON.parse(fs.readFileSync(FEEDBACK_INDEX, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeIndex(rows) {
  initDirs();
  const tmp = `${FEEDBACK_INDEX}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(rows, null, 2), 'utf8');
  fs.renameSync(tmp, FEEDBACK_INDEX);
}

function normalizeText(value, max = 1000) {
  return String(value || '').trim().slice(0, max);
}

function normalizeType(value) {
  const type = String(value || '').trim();
  return TYPE_LABELS[type] ? type : null;
}

function normalizePeriod(value) {
  const period = String(value || '').trim();
  return ['sunrise', 'sunset'].includes(period) ? period : null;
}

function normalizeNumber(value, min, max) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function safeJson(value, fallback = null) {
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function getExtension(mimeType = '') {
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/heic') return '.heic';
  if (mimeType === 'image/heif') return '.heif';
  return '.jpg';
}

function saveImages(files = [], id) {
  initDirs();
  return files.slice(0, 2).map((file, index) => {
    const storedName = `${id}-${index + 1}-${crypto.randomBytes(4).toString('hex')}${getExtension(file.mimetype)}`;
    fs.writeFileSync(path.join(IMAGE_DIR, storedName), file.buffer);
    return {
      storedName,
      originalName: normalizeText(file.originalname, 160),
      mimeType: file.mimetype,
      size: file.size
    };
  });
}

function saveBase64Images(images = [], id, offset = 0) {
  initDirs();
  if (!Array.isArray(images)) return [];
  return images.slice(0, Math.max(0, 2 - offset)).map((image, index) => {
    const rawData = String(image?.data || image?.base64 || '');
    const mimeType = String(image?.mimeType || 'image/jpeg');
    const cleanBase64 = rawData.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    if (!buffer.length || buffer.length > 8 * 1024 * 1024) {
      const error = new Error('图片数据无效或过大');
      error.code = 'INVALID_IMAGE_DATA';
      error.status = 400;
      throw error;
    }
    const storedName = `${id}-${offset + index + 1}-${crypto.randomBytes(4).toString('hex')}${getExtension(mimeType)}`;
    fs.writeFileSync(path.join(IMAGE_DIR, storedName), buffer);
    return {
      storedName,
      originalName: normalizeText(image?.name || `feedback-${offset + index + 1}`, 160),
      mimeType,
      size: buffer.length
    };
  });
}

function isFeedbackWindowOpen(eventTime, now = new Date()) {
  const eventMs = new Date(eventTime || '').getTime();
  if (!Number.isFinite(eventMs)) return false;
  const nowMs = now.getTime();
  return nowMs >= eventMs - 60 * 60 * 1000 && nowMs <= eventMs + 45 * 60 * 1000;
}

function buildRecord(payload = {}, files = [], context = {}) {
  const feedbackType = normalizeType(payload.feedbackType || payload.type);
  if (!feedbackType) {
    const error = new Error('请选择反馈类型');
    error.code = 'INVALID_FEEDBACK_TYPE';
    error.status = 400;
    throw error;
  }

  const source = normalizeText(payload.source || 'card', 40);
  const period = normalizePeriod(payload.period || payload.predictionType);
  if (!period) {
    const error = new Error('请选择朝霞或晚霞');
    error.code = 'INVALID_PERIOD';
    error.status = 400;
    throw error;
  }

  const eventTime = normalizeText(payload.eventTime || payload.referenceTime || '', 80);
  if (source === 'card' && !isFeedbackWindowOpen(eventTime, context.now || new Date())) {
    const error = new Error('反馈暂未开放。反馈只在日出/日落前 1 小时到事件后 45 分钟内开放。');
    error.code = 'FEEDBACK_WINDOW_CLOSED';
    error.status = 403;
    throw error;
  }

  const predictionSnapshot = safeJson(payload.predictionSnapshot, null);
  const weatherSnapshot = safeJson(payload.weatherSnapshot, null);
  if (source === 'home' && !predictionSnapshot) {
    const error = new Error('已经超出可反馈的日期范围，无法抓取预测快照。');
    error.code = 'PREDICTION_SNAPSHOT_REQUIRED';
    error.status = 422;
    throw error;
  }

  const id = crypto.randomUUID();
  const uploadedImages = saveImages(files, id);
  const images = [
    ...uploadedImages,
    ...saveBase64Images(payload.photos || payload.images || [], id, uploadedImages.length)
  ];
  const nowIso = (context.now || new Date()).toISOString();

  return {
    id,
    createdAt: nowIso,
    source,
    feedbackType,
    feedbackTypeLabel: TYPE_LABELS[feedbackType],
    comment: normalizeText(payload.comment, 3000),
    nickname: normalizeText(payload.nickname, 80),
    contactEmail: normalizeText(payload.contactEmail, 160),
    userId: context.user?.userId || null,
    userEmail: context.user?.email || null,
    locationName: normalizeText(payload.locationName, 160),
    lat: normalizeNumber(payload.lat, -90, 90),
    lon: normalizeNumber(payload.lon, -180, 180),
    date: normalizeText(payload.date, 20),
    period,
    eventTime,
    score: normalizeNumber(payload.score, 0, 100),
    quality: normalizeText(payload.quality, 80),
    predictionSnapshot,
    weatherSnapshot,
    client: normalizeText(payload.client || '', 40),
    userAgent: normalizeText(context.userAgent || '', 240),
    images,
    status: 'open'
  };
}

function createFeedback(payload, files, context) {
  const record = buildRecord(payload, files, context);
  const rows = readIndex();
  rows.unshift(record);
  writeIndex(rows);
  return record;
}

function listFeedback({ limit = 200 } = {}) {
  return readIndex().slice(0, Math.max(1, Math.min(500, Number(limit) || 200)));
}

function getImagePath(storedName) {
  const safeName = path.basename(String(storedName || ''));
  if (!safeName) return null;
  const filePath = path.join(IMAGE_DIR, safeName);
  return fs.existsSync(filePath) ? filePath : null;
}

module.exports = {
  TYPE_LABELS,
  createFeedback,
  getImagePath,
  isFeedbackWindowOpen,
  listFeedback,
  _test: { buildRecord, normalizeType, readIndex, writeIndex }
};
