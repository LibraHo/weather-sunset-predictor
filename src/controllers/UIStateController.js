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

  showLoading(show = true) {
    const loadingElement = document.getElementById('loading-indicator');
    if (loadingElement) {
      loadingElement.style.display = show ? 'block' : 'none';
    }

    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
      refreshBtn.disabled = show;
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
