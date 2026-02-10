/**
 * ToastService - 统一通知服务
 * 提供 success / error / warning / info 四种通知类型
 */
class ToastService {
  constructor() {
    this.containerId = 'toast-container';
    this.defaultDuration = 3000;
  }

  /**
   * 显示通知
   * @param {string} message
   * @param {'success'|'error'|'warning'|'info'} type
   * @param {number} duration
   * @returns {HTMLElement}
   */
  show(message, type = 'info', duration = this.defaultDuration) {
    if (!message) return null;

    const container = this._getOrCreateContainer();
    const toast = document.createElement('div');
    const normalizedType = this._normalizeType(type);

    toast.className = `toast toast-${normalizedType}`;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');

    toast.innerHTML = `
      <span class="toast-message"></span>
      <button class="toast-close" aria-label="关闭通知">×</button>
    `;

    const messageEl = toast.querySelector('.toast-message');
    messageEl.textContent = message;

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => this._removeToast(toast));

    container.appendChild(toast);

    if (duration > 0) {
      window.setTimeout(() => this._removeToast(toast), duration);
    }

    return toast;
  }

  _normalizeType(type) {
    const validTypes = new Set(['success', 'error', 'warning', 'info']);
    return validTypes.has(type) ? type : 'info';
  }

  _getOrCreateContainer() {
    let container = document.getElementById(this.containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = this.containerId;
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  _removeToast(toast) {
    if (toast && toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }
}

const toastService = new ToastService();

export { ToastService };
export default toastService;
