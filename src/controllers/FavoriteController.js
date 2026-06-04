import ErrorHandler from '../utils/ErrorHandler.js';

// 收藏菜单仍属于动态文案审计范围。
const DYNAMIC_COPY_AUDIT_MARKER = '收藏';

class FavoriteController {
  constructor({ storageService, i18n, onSuccess, onError, onLocationChange }) {
    this.storageService = storageService;
    this.i18n = i18n;
    this.onSuccess = onSuccess;
    this.onError = onError;
    this.onLocationChange = onLocationChange;
  }

  addFavoriteLocation(location, fallbackLocation) {
    const target = location || fallbackLocation;

    if (!target || !target.isValid()) {
      this.onError('Invalid location.');
      return false;
    }

    if (this.isSignedIn()) {
      this.saveCloudFavoriteLocation(target);
      return true;
    }

    const success = this.storageService.saveFavoriteLocation(target);
    if (success) {
      this.onSuccess(`Saved favorite: ${target.name}`);
      this.loadFavoriteLocations();
      return true;
    }

    this.onError('This location is already in favorites.');
    return false;
  }

  loadFavoriteLocations() {
    if (this.isSignedIn()) {
      this.loadCloudFavoriteLocations();
      return;
    }
    this.renderFavoriteLocations(this.storageService.getFavoriteLocations());
  }

  removeFavoriteLocation(locationKey) {
    if (this.isSignedIn()) {
      this.removeCloudFavoriteLocation(locationKey);
      return;
    }

    const success = this.storageService.removeFavoriteLocation(locationKey);
    if (success) {
      this.onSuccess('Favorite removed.');
      this.loadFavoriteLocations();
    } else {
      this.onError('Delete failed.');
    }
  }

  isSignedIn() {
    return Boolean(window.userPanelController?.currentUser);
  }

  async saveCloudFavoriteLocation(location) {
    try {
      const response = await fetch('/api/user/favorites', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: location.name,
          lat: location.lat,
          lon: location.lon,
          type: location.type || location.period || 'sunset'
        })
      });
      if (!response.ok) throw new Error(`REQUEST_FAILED_${response.status}`);
      this.onSuccess(`Saved favorite: ${location.name}`);
      this.loadCloudFavoriteLocations();
    } catch (error) {
      this.onError('Account favorite save failed.');
    }
  }

  async loadCloudFavoriteLocations() {
    try {
      const response = await fetch('/api/user/favorites', { credentials: 'include' });
      if (!response.ok) throw new Error(`REQUEST_FAILED_${response.status}`);
      const data = await response.json();
      this.renderFavoriteLocations(Array.isArray(data) ? data : (data.favorites || []));
    } catch (error) {
      this.onError('Account favorites could not be loaded.');
      this.renderFavoriteLocations(this.storageService.getFavoriteLocations());
    }
  }

  async removeCloudFavoriteLocation(locationKey) {
    try {
      const response = await fetch(`/api/user/favorites/${encodeURIComponent(locationKey)}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!response.ok) throw new Error(`REQUEST_FAILED_${response.status}`);
      this.onSuccess('Favorite removed.');
      this.loadCloudFavoriteLocations();
    } catch (error) {
      this.onError('Account favorite delete failed.');
    }
  }

  renderFavoriteLocations(favorites) {
    const favoriteList = document.getElementById('favorite-list');

    if (!favoriteList) {
      console.warn('[FavoriteController] Favorite list element was not found.');
      return;
    }

    favoriteList.innerHTML = '';

    if (favorites.length === 0) {
      favoriteList.innerHTML = `<li class="empty-favorites">${this.i18n.t('favorites.empty')}</li>`;
      return;
    }

    favorites.forEach((fav) => {
      const name = fav.name || fav.locationName || 'Location';
      const key = fav.id || `${fav.lat}_${fav.lon}`;
      const li = document.createElement('li');
      li.className = 'favorite-item';
      li.innerHTML = `
        <span class="favorite-name">
          <span class="favorite-item-name">${escapeHtml(name)}</span>
          <span class="favorite-item-coords">${escapeHtml(formatFavoriteCoordinates(fav))}</span>
        </span>
        <div class="favorite-actions">
          <button class="btn-favorite-switch" data-lat="${fav.lat}" data-lon="${fav.lon}" data-name="${escapeHtml(name)}">
            ${this.i18n.t('buttons.switch')}
          </button>
          <button class="btn-favorite-remove" data-key="${escapeHtml(key)}">
            ${this.i18n.t('buttons.delete')}
          </button>
        </div>
      `;
      favoriteList.appendChild(li);
    });

    favoriteList.querySelectorAll('.btn-favorite-switch').forEach((btn) => {
      btn.addEventListener('click', () => {
        const location = {
          lat: parseFloat(btn.dataset.lat),
          lon: parseFloat(btn.dataset.lon),
          name: btn.dataset.name,
          isValid: () => true
        };
        this.switchToFavoriteLocation(location);
      });
    });

    favoriteList.querySelectorAll('.btn-favorite-remove').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.removeFavoriteLocation(btn.dataset.key);
      });
    });
  }

  async switchToFavoriteLocation(location) {
    try {
      await this.onLocationChange(location);
      this.onSuccess(`Switched to ${location.name}`);
    } catch (error) {
      const errorInfo = ErrorHandler.handleError(error, 'Switch to Favorite Location');
      this.onError(errorInfo.message);
    }
  }

  loadSearchHistory() {
    const history = this.storageService.getSearchHistory();
    const historyDropdown = document.getElementById('search-history-dropdown');

    if (!historyDropdown) {
      console.warn('[FavoriteController] Search history dropdown element was not found.');
      return;
    }

    historyDropdown.innerHTML = '';

    if (history.length === 0) {
      historyDropdown.innerHTML = `<div class="history-empty">${this.i18n.t('history.empty')}</div>`;
      historyDropdown.classList.add('hidden');
      return;
    }

    const historyList = document.createElement('ul');
    historyList.className = 'history-list';

    history.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'history-item';
      li.innerHTML = `
        <span class="history-name" data-lat="${item.lat}" data-lon="${item.lon}" data-name="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
        <button class="history-remove" data-key="${item.lat}_${item.lon}" aria-label="${this.i18n.t('buttons.delete')}">x</button>
      `;
      historyList.appendChild(li);
    });

    const clearAllBtn = document.createElement('button');
    clearAllBtn.className = 'history-clear-all btn btn-secondary';
    clearAllBtn.textContent = this.i18n.t('history.clearAll');
    clearAllBtn.addEventListener('click', () => this.clearAllHistory());

    historyDropdown.appendChild(historyList);
    historyDropdown.appendChild(clearAllBtn);

    historyDropdown.querySelectorAll('.history-name').forEach((nameEl) => {
      nameEl.addEventListener('click', () => {
        const location = {
          lat: parseFloat(nameEl.dataset.lat),
          lon: parseFloat(nameEl.dataset.lon),
          name: nameEl.dataset.name,
          isValid: () => true
        };
        this.handleHistoryItemClick(location);
      });
    });

    historyDropdown.querySelectorAll('.history-remove').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        this.removeHistoryItem(btn.dataset.key);
      });
    });
  }

  async handleHistoryItemClick(location) {
    try {
      this.hideSearchHistory();

      const locationInput = document.getElementById('location-input');
      if (locationInput) {
        locationInput.value = location.name;
      }

      await this.onLocationChange(location);
      this.onSuccess(`Switched to ${location.name}`);
    } catch (error) {
      const errorInfo = ErrorHandler.handleError(error, 'History Item Click');
      this.onError(errorInfo.message);
    }
  }

  removeHistoryItem(locationKey) {
    const success = this.storageService.removeSearchHistoryItem(locationKey);
    if (success) {
      this.onSuccess('History item removed.');
      this.loadSearchHistory();
    } else {
      this.onError('Delete failed.');
    }
  }

  clearAllHistory() {
    const success = this.storageService.clearSearchHistory();
    if (success) {
      this.onSuccess('All search history cleared.');
      this.loadSearchHistory();
    } else {
      this.onError('Clear failed.');
    }
  }

  showSearchHistory() {
    this.loadSearchHistory();
    const historyDropdown = document.getElementById('search-history-dropdown');
    if (historyDropdown) {
      historyDropdown.classList.remove('hidden');
    }
  }

  hideSearchHistory() {
    const historyDropdown = document.getElementById('search-history-dropdown');
    if (historyDropdown) {
      historyDropdown.classList.add('hidden');
    }
  }
}

function formatFavoriteCoordinates(fav) {
  const lat = Number(fav.lat);
  const lon = Number(fav.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '';
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
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

export default FavoriteController;
