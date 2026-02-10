import ErrorHandler from '../utils/ErrorHandler.js';

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
      this.onError('无效的位置信息');
      return false;
    }

    const success = this.storageService.saveFavoriteLocation(target);
    if (success) {
      this.onSuccess(`已收藏：${target.name}`);
      this.loadFavoriteLocations();
      return true;
    }

    this.onError('该位置已在收藏列表中');
    return false;
  }

  loadFavoriteLocations() {
    const favorites = this.storageService.getFavoriteLocations();
    const favoriteList = document.getElementById('favorite-list');

    if (!favoriteList) {
      console.warn('[FavoriteController] 收藏位置列表元素未找到');
      return;
    }

    favoriteList.innerHTML = '';

    if (favorites.length === 0) {
      favoriteList.innerHTML = `<li class="empty-favorites">${this.i18n.t('favorites.empty')}</li>`;
      return;
    }

    favorites.forEach(fav => {
      const li = document.createElement('li');
      li.className = 'favorite-item';
      li.innerHTML = `
        <span class="favorite-name">${fav.name}</span>
        <div class="favorite-actions">
          <button class="btn-favorite-switch" data-lat="${fav.lat}" data-lon="${fav.lon}" data-name="${fav.name}">
            ${this.i18n.t('buttons.switch')}
          </button>
          <button class="btn-favorite-remove" data-key="${fav.lat}_${fav.lon}">
            ${this.i18n.t('buttons.delete')}
          </button>
        </div>
      `;
      favoriteList.appendChild(li);
    });

    favoriteList.querySelectorAll('.btn-favorite-switch').forEach(btn => {
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

    favoriteList.querySelectorAll('.btn-favorite-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        this.removeFavoriteLocation(btn.dataset.key);
      });
    });
  }

  removeFavoriteLocation(locationKey) {
    const success = this.storageService.removeFavoriteLocation(locationKey);
    if (success) {
      this.onSuccess('已删除收藏位置');
      this.loadFavoriteLocations();
    } else {
      this.onError('删除失败');
    }
  }

  async switchToFavoriteLocation(location) {
    try {
      await this.onLocationChange(location);
      this.onSuccess(`已切换到：${location.name}`);
    } catch (error) {
      const errorInfo = ErrorHandler.handleError(error, 'Switch to Favorite Location');
      this.onError(errorInfo.message);
    }
  }

  loadSearchHistory() {
    const history = this.storageService.getSearchHistory();
    const historyDropdown = document.getElementById('search-history-dropdown');

    if (!historyDropdown) {
      console.warn('[FavoriteController] 搜索历史下拉列表元素未找到');
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

    history.forEach(item => {
      const li = document.createElement('li');
      li.className = 'history-item';
      li.innerHTML = `
        <span class="history-name" data-lat="${item.lat}" data-lon="${item.lon}" data-name="${item.name}">📍 ${item.name}</span>
        <button class="history-remove" data-key="${item.lat}_${item.lon}" aria-label="${this.i18n.t('buttons.delete')}">✕</button>
      `;
      historyList.appendChild(li);
    });

    const clearAllBtn = document.createElement('button');
    clearAllBtn.className = 'history-clear-all btn btn-secondary';
    clearAllBtn.textContent = this.i18n.t('history.clearAll');
    clearAllBtn.addEventListener('click', () => this.clearAllHistory());

    historyDropdown.appendChild(historyList);
    historyDropdown.appendChild(clearAllBtn);

    historyDropdown.querySelectorAll('.history-name').forEach(nameEl => {
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

    historyDropdown.querySelectorAll('.history-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
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
      this.onSuccess(`已切换到：${location.name}`);
    } catch (error) {
      const errorInfo = ErrorHandler.handleError(error, 'History Item Click');
      this.onError(errorInfo.message);
    }
  }

  removeHistoryItem(locationKey) {
    const success = this.storageService.removeSearchHistoryItem(locationKey);
    if (success) {
      this.onSuccess('已删除历史记录');
      this.loadSearchHistory();
    } else {
      this.onError('删除失败');
    }
  }

  clearAllHistory() {
    const success = this.storageService.clearSearchHistory();
    if (success) {
      this.onSuccess('已清除所有搜索历史');
      this.loadSearchHistory();
    } else {
      this.onError('清除失败');
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

export default FavoriteController;
