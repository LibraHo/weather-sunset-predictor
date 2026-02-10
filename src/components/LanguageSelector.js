/**
 * 语言选择器组件
 * 允许用户切换界面语言
 */
import i18n from '../i18n.js';
import toastService from '../services/ToastService.js';

export class LanguageSelector {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.currentLanguage = i18n.getLanguage();
    this.init();
  }

  init() {
    if (!this.container) {
      console.error('Language selector container not found');
      return;
    }

    this.render();
    this.attachEventListeners();
  }

  render() {
    const languages = i18n.supportedLanguages;
    const options = Object.entries(languages)
      .map(([code, info]) => {
        const selected = code === this.currentLanguage ? 'selected' : '';
        return `<option value="${code}" ${selected}>${info.name}</option>`;
      })
      .join('');

    this.container.innerHTML = `
      <div class="language-selector">
        <label for="language-select">${i18n.t('settings.languageLabel')}</label>
        <select id="language-select" class="language-select">
          ${options}
        </select>
      </div>
    `;
  }

  attachEventListeners() {
    const select = this.container.querySelector('#language-select');
    if (!select) return;

    select.addEventListener('change', (e) => {
      const newLanguage = e.target.value;
      this.confirmLanguageChange(newLanguage);
    });
  }

  confirmLanguageChange(newLanguage) {
    // 显示确认对话框
    const confirmed = confirm(
      i18n.t('languageSelector.confirmChangeMessage')
    );

    if (confirmed) {
      this.changeLanguage(newLanguage);
    } else {
      // 取消选择，恢复当前语言
      this.render();
      this.attachEventListeners();
    }
  }

  async changeLanguage(newLanguage) {
    try {
      // 切换语言
      await i18n.changeLanguage(newLanguage);
      this.currentLanguage = newLanguage;

      // 重新渲染语言选择器
      this.render();
      this.attachEventListeners();

      // 触发语言切换事件，通知其他组件刷新
      window.dispatchEvent(new CustomEvent('languageChanged', {
        detail: { language: newLanguage }
      }));

      // 刷新页面内容（可选：如果需要完全刷新）
      // window.location.reload();
    } catch (error) {
      console.error('Failed to change language:', error);
      toastService.show('语言切换失败，请重试', 'error', 4000);
    }
  }

  /**
   * 更新语言选择器文本（用于语言切换后）
   */
  updateText() {
    const label = this.container.querySelector('label');
    if (label) {
      label.textContent = i18n.t('settings.languageLabel');
    }
  }
}

export default LanguageSelector;
