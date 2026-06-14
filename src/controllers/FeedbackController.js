import i18n from '../i18n.js';

const FEEDBACK_WINDOW_BEFORE_MS = 60 * 60 * 1000;
const FEEDBACK_WINDOW_AFTER_MS = 45 * 60 * 1000;

function t(key, fallback) {
  return i18n?.t ? i18n.t(key, fallback) : fallback;
}

function byId(id) {
  return document.getElementById(id);
}

function getPredictionEventTime(prediction = {}, type = 'sunset') {
  return prediction.eventTime
    || prediction.referenceTime
    || prediction[`${type}Time`]
    || prediction.bestTime
    || prediction.time
    || null;
}

function isFeedbackWindowOpen(eventTime, now = new Date()) {
  const eventMs = new Date(eventTime || '').getTime();
  if (!Number.isFinite(eventMs)) return false;
  const nowMs = now.getTime();
  return nowMs >= eventMs - FEEDBACK_WINDOW_BEFORE_MS && nowMs <= eventMs + FEEDBACK_WINDOW_AFTER_MS;
}

function getPredictionLocation(prediction = {}) {
  return {
    locationName: prediction.locationName || prediction.location?.name || prediction.city || '',
    lat: prediction.lat ?? prediction.location?.lat ?? prediction.location?.latitude ?? null,
    lon: prediction.lon ?? prediction.location?.lon ?? prediction.location?.longitude ?? null
  };
}

function buildPayloadFromPrediction(prediction = {}, type = 'sunset', form) {
  const location = getPredictionLocation(prediction);
  return {
    source: 'card',
    client: 'web',
    feedbackType: form.feedbackType.value,
    comment: form.comment.value,
    nickname: form.nickname.value,
    contactEmail: form.contactEmail.value,
    period: type,
    date: prediction.date || prediction.targetDate || '',
    eventTime: getPredictionEventTime(prediction, type),
    score: prediction.score,
    quality: prediction.quality,
    ...location,
    predictionSnapshot: prediction,
    weatherSnapshot: {
      cloudLayers: prediction.cloudLayers || null,
      weatherSample: prediction.weatherSample || null,
      factors: prediction.factors || null,
      surroundingData: prediction.surroundingData || null
    }
  };
}

export default class FeedbackController {
  constructor({ userPanelController = null } = {}) {
    this.userPanelController = userPanelController;
    this.currentPrediction = null;
    this.currentType = 'sunset';
  }

  initialize() {
    byId('feedback-modal-close')?.addEventListener('click', () => this.closeModal());
    byId('feedback-cancel-btn')?.addEventListener('click', () => this.closeModal());
    byId('feedback-form')?.addEventListener('submit', (event) => this.submitCardFeedback(event));
    byId('feedback-page-login-btn')?.addEventListener('click', () => this.openLogin());
    byId('feedback-page-form')?.addEventListener('submit', (event) => this.submitManualFeedback(event));
    byId('feedback-modal')?.addEventListener('click', (event) => {
      if (event.target === byId('feedback-modal')) this.closeModal();
    });
    this.refreshFeedbackPageAuth();
  }

  setUserPanelController(controller) {
    this.userPanelController = controller;
  }

  openLogin() {
    this.userPanelController?.openAuthModal?.('login');
  }

  async refreshFeedbackPageAuth() {
    try {
      const res = await fetch('/auth/me', { credentials: 'include' });
      const data = res.ok ? await res.json() : {};
      const signedIn = Boolean(data.user);
      byId('feedback-page-signed-out')?.classList.toggle('hidden', signedIn);
      byId('feedback-page-form')?.classList.toggle('hidden', !signedIn);
      return data.user || null;
    } catch {
      byId('feedback-page-signed-out')?.classList.remove('hidden');
      byId('feedback-page-form')?.classList.add('hidden');
      return null;
    }
  }

  openPredictionFeedback(prediction, type = 'sunset') {
    const eventTime = getPredictionEventTime(prediction, type);
    if (!isFeedbackWindowOpen(eventTime)) {
      this.showToast(t('feedback.windowClosed', 'Feedback is only open from 1 hour before the event to 45 minutes after it.'), 'error');
      return;
    }
    this.currentPrediction = prediction;
    this.currentType = type;
    byId('feedback-form')?.reset();
    this.setMessage('');
    byId('feedback-modal')?.classList.remove('hidden');
  }

  closeModal() {
    byId('feedback-modal')?.classList.add('hidden');
  }

  async submitCardFeedback(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = buildPayloadFromPrediction(this.currentPrediction || {}, this.currentType, form);
    await this.submitFormPayload(payload, form, {
      messageTarget: 'feedback-form-message',
      onSuccess: () => this.closeModal()
    });
  }

  async submitManualFeedback(event) {
    event.preventDefault();
    const user = await this.refreshFeedbackPageAuth();
    if (!user) {
      this.setMessage(t('feedback.loginRequired', 'Please sign in before sending feedback.'), 'error', 'feedback-page-message');
      return;
    }

    const form = event.currentTarget;
    const lat = Number(form.lat.value);
    const lon = Number(form.lon.value);
    const period = form.period.value;
    const date = form.date.value;
    this.setMessage(t('feedback.fetchSnapshot', 'Fetching prediction data...'), 'info', 'feedback-page-message');

    let predictionSnapshot;
    try {
      const res = await fetch('/api/prediction/enhanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lon, type: period, date })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.error?.message || t('feedback.rangeExpired', 'This date is outside the feedback range.'));
      }
      predictionSnapshot = data.data || data.prediction || data;
    } catch (error) {
      this.setMessage(error.message || t('feedback.rangeExpired', 'This date is outside the feedback range.'), 'error', 'feedback-page-message');
      return;
    }

    const payload = {
      source: 'home',
      client: 'web',
      feedbackType: form.feedbackType.value,
      comment: form.comment.value,
      period,
      date,
      locationName: form.locationName.value,
      lat,
      lon,
      eventTime: getPredictionEventTime(predictionSnapshot, period),
      score: predictionSnapshot.score,
      quality: predictionSnapshot.quality,
      predictionSnapshot,
      weatherSnapshot: {
        cloudLayers: predictionSnapshot.cloudLayers || null,
        weatherSample: predictionSnapshot.weatherSample || null,
        factors: predictionSnapshot.factors || null
      }
    };
    await this.submitFormPayload(payload, form, {
      messageTarget: 'feedback-page-message',
      onSuccess: () => form.reset()
    });
  }

  async submitFormPayload(payload, form, { messageTarget, onSuccess } = {}) {
    const formData = new FormData();
    formData.set('payload', JSON.stringify(payload));
    const files = Array.from(form.photos?.files || []).slice(0, 2);
    if ((form.photos?.files?.length || 0) > 2) {
      this.setMessage(t('feedback.tooManyPhotos', 'Upload up to 2 images.'), 'error', messageTarget);
      return;
    }
    files.forEach((file) => formData.append('photos', file));

    this.setMessage(t('feedback.submitting', 'Submitting feedback...'), 'info', messageTarget);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.error?.message || t('feedback.submitFailed', 'Feedback submission failed.'));
      }
      this.setMessage(t('feedback.success', 'Feedback submitted. Thanks for helping calibrate the forecast.'), 'success', messageTarget);
      this.showToast(t('feedback.success', 'Feedback submitted. Thanks for helping calibrate the forecast.'));
      onSuccess?.();
    } catch (error) {
      this.setMessage(error.message || t('feedback.submitFailed', 'Feedback submission failed.'), 'error', messageTarget);
    }
  }

  setMessage(message, type = 'info', target = 'feedback-form-message') {
    const el = byId(target);
    if (!el) return;
    el.textContent = message || '';
    el.className = `feedback-message ${type}`;
    el.classList.toggle('hidden', !message);
  }

  showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `share-toast feedback-toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3200);
    setTimeout(() => toast.remove(), 3600);
  }
}

export { isFeedbackWindowOpen, getPredictionEventTime };
