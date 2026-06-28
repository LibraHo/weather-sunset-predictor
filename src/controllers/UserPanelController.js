import i18n from '../i18n.js';

export default class UserPanelController {
  constructor({ documentRef = document, storageService = null, windowRef = window } = {}) {
    this.document = documentRef;
    this.storageService = storageService;
    this.window = windowRef;
    this.currentUser = null;
    this.authView = 'login';
  }

  async initialize() {
    this.bindActions();
    await this.refresh();
  }

  bindActions() {
    this.byId('account-menu-btn')?.addEventListener('click', (event) => {
      event.stopPropagation();
      this.handleAccountButton();
    });
    this.byId('account-auth-close')?.addEventListener('click', () => this.closeAuthModal());
    this.byId('account-login-google')?.addEventListener('click', () => {
      this.window.location.href = '/auth/google/start';
    });
    this.byId('account-manage-btn')?.addEventListener('click', () => {
      this.closeAccountDropdown();
      this.showManagementPanel();
    });
    this.byId('account-logout-btn')?.addEventListener('click', () => this.logout());
    this.byId('user-login-google')?.addEventListener('click', () => this.openAuthModal('login'));
    this.byId('user-logout-btn')?.addEventListener('click', () => this.logout());

    this.document.querySelectorAll('[data-auth-view]').forEach((button) => {
      button.addEventListener('click', () => this.setAuthView(button.dataset.authView));
    });

    this.byId('account-login-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      this.loginWithEmail(event.currentTarget);
    });
    this.byId('account-register-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      this.registerWithEmail(event.currentTarget);
    });
    this.byId('account-forgot-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      this.resetPassword(event.currentTarget);
    });
    this.byId('account-forgot-email')?.addEventListener('blur', () => this.loadRecoveryQuestion());

    this.byId('account-auth-modal')?.addEventListener('click', (event) => {
      if (event.target === this.byId('account-auth-modal')) this.closeAuthModal();
    });

    this.document.addEventListener('click', (event) => {
      const dropdown = this.byId('account-dropdown');
      const button = this.byId('account-menu-btn');
      if (dropdown && button && !dropdown.contains(event.target) && !button.contains(event.target)) {
        this.closeAccountDropdown();
      }
    });

    this.document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        this.closeAuthModal();
        this.closeAccountDropdown();
      }
    });
  }

  async refresh() {
    const user = await this.fetchCurrentUser();
    this.currentUser = user;
    if (user) {
      this.renderSession(user);
      await this.syncLocalFavoritesToAccount();
      await this.renderCloudLists();
      return;
    }
    this.renderSignedOut();
    this.renderLocalLists();
  }

  async fetchCurrentUser() {
    try {
      const response = await fetch('/auth/me', { credentials: 'include' });
      if (!response.ok) return null;
      const data = await response.json();
      return data.user || null;
    } catch (error) {
      this.showError('');
      return null;
    }
  }

  handleAccountButton() {
    if (this.currentUser) {
      this.openAccountDropdown();
      return;
    }
    this.openAuthModal('login');
  }

  openAuthModal(view = 'login') {
    this.closeAccountDropdown();
    this.setAuthView(view);
    this.byId('account-auth-modal')?.classList.remove('hidden');
  }

  closeAuthModal() {
    this.byId('account-auth-modal')?.classList.add('hidden');
  }

  setAuthView(view) {
    this.authView = ['login', 'register', 'forgot'].includes(view) ? view : 'login';
    this.document.querySelectorAll('[data-auth-view]').forEach((button) => {
      button.classList.toggle('active', button.dataset.authView === this.authView);
    });
    this.document.querySelectorAll('[data-auth-panel]').forEach((panel) => {
      panel.classList.toggle('hidden', panel.dataset.authPanel !== this.authView);
    });
    const titles = {
      login: this.t('account.auth.loginTitle', 'Account login'),
      register: this.t('account.auth.registerTitle', 'Create account'),
      forgot: this.t('account.auth.forgotTitle', 'Reset password')
    };
    this.setText('account-auth-title', titles[this.authView]);
    this.setAuthMessage('', '');
  }

  openAccountDropdown() {
    const dropdown = this.byId('account-dropdown');
    const button = this.byId('account-menu-btn');
    dropdown?.classList.remove('hidden');
    button?.setAttribute('aria-expanded', 'true');
  }

  closeAccountDropdown() {
    const dropdown = this.byId('account-dropdown');
    const button = this.byId('account-menu-btn');
    dropdown?.classList.add('hidden');
    button?.setAttribute('aria-expanded', 'false');
  }

  showManagementPanel() {
    const panel = this.byId('account-management-panel');
    if (!panel) return;
    panel.classList.remove('hidden');
    panel.hidden = false;
    panel.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }

  async renderCloudLists() {
    try {
      const [favorites, uploads, apiApplication] = await Promise.all([
        this.fetchFavorites(),
        this.fetchUploads(),
        this.fetchMyApiApplication()
      ]);
      this.renderList('user-favorites-list', favorites, this.t('account.panel.emptyFavorites', 'No account favorites yet.'));
      this.renderUploads(uploads, this.t('account.panel.emptyUploads', 'No uploaded photos yet.'));
      this.renderApiApplication(apiApplication);
      this.setText('user-favorites-count', String(favorites.length));
      this.setText('user-uploads-count', String(uploads.length));
      this.setText('user-api-count', apiApplication ? '1' : '0');
    } catch (error) {
      this.showError(this.t('account.panel.dataUnavailable', 'Account data is temporarily unavailable.'));
      this.renderLocalLists();
    }
  }

  fetchFavorites() {
    return fetch('/api/user/favorites', { credentials: 'include' })
      .then((response) => this.unwrapListResponse(response, 'favorites'));
  }

  fetchRecentLocations() {
    return fetch('/api/user/recent-locations', { credentials: 'include' })
      .then((response) => this.unwrapListResponse(response, 'recentLocations'));
  }

  fetchUploads() {
    return fetch('/api/photos/mine', { credentials: 'include' })
      .then((response) => this.unwrapListResponse(response, 'photos'));
  }

  fetchMyApiApplication() {
    return fetch('/api/applications/me', { credentials: 'include' })
      .then(async (response) => {
        if (response.status === 401) return null;
        if (!response.ok) throw new Error(`REQUEST_FAILED_${response.status}`);
        const data = await response.json();
        return data.application || null;
      });
  }

  async syncLocalFavoritesToAccount() {
    const favorites = this.getLocalFavoriteLocations();
    if (!this.currentUser || !favorites.length) return;

    await Promise.allSettled(favorites.map((favorite) => fetch('/api/user/favorites', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(favorite)
    })));
  }

  async unwrapListResponse(response, key) {
    if (!response.ok) throw new Error(`REQUEST_FAILED_${response.status}`);
    const data = await response.json();
    return Array.isArray(data) ? data : (data[key] || []);
  }

  renderSession(user) {
    const state = buildSessionState(user, this.sessionLabels());
    this.setText('user-status-label', this.t('account.panel.signedIn'));
    this.setText('user-display-name', state.displayName);
    this.setText('user-identity-summary', state.identitySummary);
    this.byId('user-signed-out-actions')?.classList.add('hidden');
    this.byId('user-logout-btn')?.classList.remove('hidden');
    this.byId('account-menu-btn')?.classList.add('signed-in');
    this.closeAuthModal();
    this.showError('');
  }

  renderSignedOut() {
    this.setText('user-status-label', this.t('account.panel.signedOut', 'Signed out'));
    this.setText('user-display-name', this.t('account.panel.signedOutTitle', 'Sign in to sync your sunset trail'));
    this.setText('user-identity-summary', this.t('account.panel.signedOutSummary', 'Favorite places can sync with your account.'));
    this.byId('user-signed-out-actions')?.classList.remove('hidden');
    this.byId('user-logout-btn')?.classList.add('hidden');
    this.byId('account-menu-btn')?.classList.remove('signed-in');
    this.closeAccountDropdown();
    this.showError('');
  }

  renderLocalLists() {
    const favorites = this.getLocalFavoriteLocations();
    this.renderList('user-favorites-list', favorites, this.t('account.panel.emptyLocalFavorites', 'No local favorites yet.'));
    this.renderUploads([], this.t('account.panel.signInForUploads', 'Sign in to view your uploaded photos.'));
    this.renderApiApplication(null, this.t('account.panel.signInForApi', 'Sign in to view account API applications.'));
    this.setText('user-favorites-count', String(favorites.length));
    this.setText('user-uploads-count', '0');
    this.setText('user-api-count', '0');
  }

  getLocalFavoriteLocations() {
    return this.storageService?.getFavoriteLocations ? this.storageService.getFavoriteLocations() : [];
  }

  getLocalSearchHistory() {
    return this.storageService?.getSearchHistory ? this.storageService.getSearchHistory() : [];
  }

  renderList(id, locations, emptyText) {
    const list = this.byId(id);
    if (!list) return;
    list.innerHTML = '';
    if (!locations.length) {
      const empty = this.document.createElement('li');
      empty.className = 'user-panel-empty';
      empty.textContent = emptyText;
      list.appendChild(empty);
      return;
    }
    locations.forEach((location) => {
      const item = decorateLocation(location, this.locationLabels());
      const li = this.document.createElement('li');
      li.className = 'user-panel-location-row';
      li.innerHTML = `
        <span class="user-panel-location-main">
          <strong>${escapeHtml(item.name)}</strong>
          <small>${escapeHtml(item.meta)}</small>
        </span>
        <span class="user-panel-chevron" aria-hidden="true"></span>
      `;
      li.addEventListener('click', () => this.openLocation(item));
      list.appendChild(li);
    });
  }

  renderApiApplication(application, emptyText = this.t('account.panel.emptyApiApplication')) {
    const list = this.byId('user-recent-list');
    if (!list) return;
    list.innerHTML = '';
    if (!application) {
      const empty = this.document.createElement('li');
      empty.className = 'user-panel-empty';
      empty.textContent = emptyText;
      list.appendChild(empty);
      return;
    }
    const li = this.document.createElement('li');
    li.className = 'user-panel-location-row';
    const status = application.status || this.t('account.panel.statusPending');
    const email = application.email || this.t('account.panel.noEmail');
    const purpose = application.purpose || application.nickname || this.t('account.panel.apiApplicationFallback');
    li.innerHTML = `
      <span class="user-panel-location-main">
        <strong>${escapeHtml(email)}</strong>
        <small>${escapeHtml(status)} - ${escapeHtml(purpose)}</small>
      </span>
      <span class="user-panel-chevron" aria-hidden="true"></span>
    `;
    li.addEventListener('click', () => this.document.querySelector('.home-view-option[data-view="api"]')?.click());
    list.appendChild(li);
  }

  renderUploads(photos, emptyText = this.t('account.panel.emptyUploads')) {
    const list = this.byId('user-uploads-list');
    if (!list) return;
    list.innerHTML = '';
    if (!photos.length) {
      const empty = this.document.createElement('li');
      empty.className = 'user-panel-empty';
      empty.textContent = emptyText;
      list.appendChild(empty);
      return;
    }
    photos.slice(0, 8).forEach((photo) => {
      const li = this.document.createElement('li');
      li.className = 'user-panel-location-row';
      const location = photo.locationName || photo.location || this.t('account.panel.untitledPhoto');
      const status = photo.status || photo.reviewStatus || this.t('account.panel.statusPending');
      const uploadedAt = photo.uploadedAt || photo.createdAt || '';
      li.innerHTML = `
        <span class="user-panel-location-main">
          <strong>${escapeHtml(location)}</strong>
          <small>${escapeHtml(status)}${uploadedAt ? ` - ${escapeHtml(formatDateTime(uploadedAt))}` : ''}</small>
        </span>
        <span class="user-panel-chevron" aria-hidden="true"></span>
      `;
      li.addEventListener('click', () => this.document.querySelector('.home-view-option[data-view="gallery"]')?.click());
      list.appendChild(li);
    });
  }

  async loginWithEmail(form) {
    const payload = this.formPayload(form, ['email', 'password']);
    await this.submitAuth('/auth/login', payload, {
      successMessage: this.t('account.auth.loginSuccess'),
      resetForm: false
    });
  }

  async registerWithEmail(form) {
    const data = new FormData(form);
    const password = String(data.get('password') || '').trim();
    const confirmPassword = String(data.get('confirmPassword') || '').trim();
    if (password !== confirmPassword) {
      this.setAuthMessage(this.t('account.auth.passwordMismatch'), 'error');
      return;
    }
    const payload = this.formPayload(form, ['email', 'password', 'recoveryQuestion', 'recoveryAnswer']);
    await this.submitAuth('/auth/register', payload, {
      successMessage: this.t('account.auth.registerSuccess'),
      form,
      resetForm: true
    });
  }

  async resetPassword(form) {
    const payload = this.formPayload(form, ['email', 'recoveryAnswer', 'newPassword']);
    const data = await this.submitAuth('/auth/password/reset', payload, {
      successMessage: this.t('account.auth.resetSuccess'),
      form,
      resetForm: true,
      refreshAfterSuccess: false
    });
    if (data) this.setAuthView('login');
  }

  async submitAuth(url, payload, options = {}) {
    this.setAuthMessage('', '');
    try {
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error?.message || this.t('account.auth.requestFailed'));
      }
      this.setAuthMessage(options.successMessage || this.t('account.auth.done'), 'success');
      if (options.resetForm) options.form?.reset?.();
      if (options.refreshAfterSuccess !== false) {
        await this.refresh();
      }
      return data;
    } catch (error) {
      this.setAuthMessage(error?.message || this.t('account.auth.requestFailed'), 'error');
      return null;
    }
  }

  async loadRecoveryQuestion() {
    const email = this.byId('account-forgot-email')?.value?.trim();
    const target = this.byId('account-recovery-question');
    if (!email || !target) return;
    try {
      const response = await fetch('/auth/password/recovery-question', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await response.json().catch(() => ({}));
      const question = data?.recoveryQuestion;
      target.textContent = question || this.t('account.auth.recoveryQuestionFallback');
    } catch (error) {
      target.textContent = this.t('account.auth.recoveryQuestionUnavailable');
    }
  }

  formPayload(form, fields) {
    const data = new FormData(form);
    return fields.reduce((payload, field) => {
      payload[field] = String(data.get(field) || '').trim();
      return payload;
    }, {});
  }

  setAuthMessage(message, type = '') {
    const el = this.byId('account-auth-message');
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('error', type === 'error');
    el.classList.toggle('success', type === 'success');
  }

  openLocation(location) {
    const input = this.byId('location-input');
    if (input) input.value = location.name;
    this.document.querySelector('.home-view-option[data-view="forecast"]')?.click();
    input?.focus();
  }

  async logout() {
    try {
      await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (error) {
      // Logout is best effort; the UI still returns to signed-out state.
    }
    this.currentUser = null;
    this.renderSignedOut();
    this.renderLocalLists();
  }

  showError(message) {
    const el = this.byId('user-error');
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('hidden', !message);
  }

  setText(id, text) {
    const el = this.byId(id);
    if (el) el.textContent = text;
  }

  t(key, fallback) {
    if (fallback !== undefined && !i18n.translations?.[i18n.currentLanguage]) {
      return fallback;
    }
    const translated = i18n.t(key);
    return translated === key ? (fallback || key) : translated;
  }

  locationLabels() {
    return {
      sunrise: this.t('account.panel.typeSunrise'),
      sunset: this.t('account.panel.typeSunset'),
      place: this.t('account.panel.typePlace'),
      untitledLocation: this.t('account.panel.untitledLocation'),
      coordinatesPending: this.t('account.panel.coordinatesPending')
    };
  }

  sessionLabels() {
    return {
      userPrefix: this.t('account.panel.userPrefix'),
      connectedSuffix: this.t('account.panel.connectedSuffix'),
      accountConnected: this.t('account.panel.accountConnected')
    };
  }

  byId(id) {
    return this.document.getElementById(id);
  }
}

export function buildSessionState(user = {}, labels = {}) {
  const userId = user.userId || user.id || '';
  const identities = Array.isArray(user.identities) ? user.identities : [];
  const identitySummary = identities.map((identity) => identityLabel(identity.provider)).filter(Boolean).join(', ');
  const userPrefix = labels.userPrefix || 'account.panel.userPrefix';
  const connectedSuffix = labels.connectedSuffix || 'account.panel.connectedSuffix';
  const accountConnected = labels.accountConnected || 'account.panel.accountConnected';
  return {
    displayName: userId ? `${userPrefix} ${String(userId).slice(-6)}` : userPrefix,
    identitySummary: identitySummary ? `${identitySummary} ${connectedSuffix}` : accountConnected
  };
}

export function decorateLocation(location = {}, labels = {}) {
  const name = location.name || location.locationName || location.location || labels.untitledLocation || 'account.panel.untitledLocation';
  const lat = Number(location.lat);
  const lon = Number(location.lon);
  const type = location.type || location.period || '';
  const typeLabel = type === 'sunrise'
    ? (labels.sunrise || 'account.panel.typeSunrise')
    : type === 'sunset'
      ? (labels.sunset || 'account.panel.typeSunset')
      : (labels.place || 'account.panel.typePlace');
  const coordinate = Number.isFinite(lat) && Number.isFinite(lon)
    ? `${lat.toFixed(4)}, ${lon.toFixed(4)}`
    : (labels.coordinatesPending || 'account.panel.coordinatesPending');
  return { ...location, name, meta: `${typeLabel} - ${coordinate}` };
}

function identityLabel(provider) {
  const labels = {
    google: 'Google',
    wechat_miniprogram: 'WeChat Mini Program',
    wechat_mini: 'WeChat Mini Program'
  };
  return labels[provider] || provider || '';
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}
