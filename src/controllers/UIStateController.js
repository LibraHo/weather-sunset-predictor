import toastService from '../services/ToastService.js';

class UIStateController {
  showAPIKeyError(message) {
    const errorElement = document.getElementById('api-key-error');
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.remove('hidden');
    }
  }

  clearAPIKeyError() {
    const errorElement = document.getElementById('api-key-error');
    if (errorElement) {
      errorElement.textContent = '';
      errorElement.classList.add('hidden');
    }
  }

  showLocationError(message) {
    const errorElement = document.getElementById('location-error');
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.remove('hidden');
      errorElement.style.display = 'block';
    }
  }

  clearLocationError() {
    const errorElement = document.getElementById('location-error');
    if (errorElement) {
      errorElement.textContent = '';
      errorElement.classList.add('hidden');
      errorElement.style.display = 'none';
    }
  }

  showLoading(show = true, state = {}) {
    const loadingElement = document.getElementById('loading-indicator');
    if (loadingElement) {
      loadingElement.style.display = show ? 'block' : 'none';
    }

    if (show) {
      this.updateLoadingProgress(state);
    }

    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
      refreshBtn.disabled = show;
    }
  }

  updateLoadingProgress(state = {}) {
    const rawProgress = Number(state.progress ?? 0);
    const progress = Math.max(0, Math.min(100, Number.isFinite(rawProgress) ? rawProgress : 0));
    const progressBar = document.querySelector('#loading-indicator .loading-progress');
    const progressFill = document.getElementById('loading-progress-fill');
    const detailElement = document.getElementById('loading-progress-detail');
    const textElement = document.getElementById('loading-text');

    if (progressBar) {
      progressBar.setAttribute('aria-valuenow', String(Math.round(progress)));
    }
    if (progressFill) {
      progressFill.style.width = `${progress}%`;
    }
    if (detailElement) {
      detailElement.textContent = state.detail || (progress > 0 ? `${Math.round(progress)}%` : '');
    }
    if (textElement && state.message) {
      textElement.textContent = state.message;
    }
  }

  hideLoading() {
    this.showLoading(false);
  }

  showError(message) {
    console.error(message);

    const errorElement = document.getElementById('error-message');
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = 'block';
      errorElement.className = 'error-message show';

      setTimeout(() => {
        errorElement.style.display = 'none';
        errorElement.className = 'error-message';
      }, 5000);
    }

    toastService.show(message, 'error', 5000);
  }

  showSuccess(message) {
    console.log(message);

    const successElement = document.getElementById('success-message');
    if (successElement) {
      successElement.textContent = message;
      successElement.style.display = 'block';
      successElement.className = 'success-message show';

      setTimeout(() => {
        successElement.style.display = 'none';
        successElement.className = 'success-message';
      }, 3000);
    }

    toastService.show(message, 'success', 3000);
  }
}

export default UIStateController;
