import { request } from './api.js';

export function submitFeedback(payload = {}) {
  return request('/api/feedback', {
    method: 'POST',
    data: payload
  });
}

export function isFeedbackWindowOpen(eventTime, now = new Date()) {
  const eventMs = new Date(eventTime || '').getTime();
  if (!Number.isFinite(eventMs)) return false;
  const nowMs = now.getTime();
  return nowMs >= eventMs - 60 * 60 * 1000 && nowMs <= eventMs + 45 * 60 * 1000;
}

export function getPredictionEventTime(prediction = {}) {
  return prediction.eventTime
    || prediction.referenceTime
    || prediction.bestTime
    || prediction.time
    || null;
}
