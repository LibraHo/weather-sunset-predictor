/**
 * LanguageSelector 单元测试
 *
 * 覆盖 init/render/attachEventListeners/confirmLanguageChange/changeLanguage/updateText
 * 需求：14（多语言支持）、23.13（UI 组件测试）
 */

import { jest } from '@jest/globals';
import { LanguageSelector } from '@components/LanguageSelector.js';
import i18n from '@/i18n.js';
import toastService from '@services/ToastService.js';

// ---- Mock i18n 单例 ----

function setupI18nMock() {
  jest.spyOn(i18n, 'getLanguage').mockReturnValue('zh-CN');
  jest.spyOn(i18n, 't').mockImplementation((key) => key);
  jest.spyOn(i18n, 'changeLanguage').mockResolvedValue(undefined);
  Object.defineProperty(i18n, 'supportedLanguages', {
    get: jest.fn().mockReturnValue({
      'zh-CN': { name: '简体中文' },
      'en-US': { name: 'English' }
    }),
    configurable: true
  });
}

// ---- 辅助：创建容器并挂载到 DOM ----

function createContainer(id = 'lang-selector-container') {
  const container = document.createElement('div');
  container.id = id;
  document.body.appendChild(container);
  return container;
}

function removeContainer(id = 'lang-selector-container') {
  const el = document.getElementById(id);
  if (el) el.remove();
}

// ---- 测试 ----

describe('LanguageSelector - 初始化', () => {
  beforeEach(() => {
    setupI18nMock();
  });

  afterEach(() => {
    removeContainer();
    jest.restoreAllMocks();
  });

  test('容器存在时正常渲染 select 元素', () => {
    createContainer();
    const selector = new LanguageSelector('lang-selector-container');
    const select = document.getElementById('language-select');
    expect(select).not.toBeNull();
  });

  test('容器不存在时打印 error 且不抛出', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => new LanguageSelector('non-existent-id')).not.toThrow();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('not found'));
  });

  test('render 生成的 option 列表包含所有支持的语言', () => {
    createContainer();
    new LanguageSelector('lang-selector-container');
    const options = document.querySelectorAll('#language-select option');
    expect(options.length).toBe(2); // zh-CN, en-US
  });

  test('当前语言的 option 被标记为 selected', () => {
    createContainer();
    new LanguageSelector('lang-selector-container');
    const selectedOption = document.querySelector('#language-select option[value="zh-CN"]');
    expect(selectedOption.selected).toBe(true);
  });
});

describe('LanguageSelector.attachEventListeners', () => {
  let confirmSpy;

  beforeEach(() => {
    setupI18nMock();
    createContainer();
    confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    removeContainer();
    jest.restoreAllMocks();
  });

  test('select change 事件触发 confirmLanguageChange', async () => {
    const selector = new LanguageSelector('lang-selector-container');
    const confirmSpy2 = jest.spyOn(selector, 'confirmLanguageChange');

    const select = document.getElementById('language-select');
    select.value = 'en-US';
    select.dispatchEvent(new Event('change', { bubbles: true }));

    expect(confirmSpy2).toHaveBeenCalledWith('en-US');
  });

  test('容器没有 select 时 attachEventListeners 不抛出', () => {
    const container = document.getElementById('lang-selector-container');
    container.innerHTML = ''; // 清空，没有 #language-select
    const selector = new LanguageSelector('lang-selector-container');
    // 重新调用不应抛出
    expect(() => selector.attachEventListeners()).not.toThrow();
  });
});

describe('LanguageSelector.confirmLanguageChange', () => {
  beforeEach(() => {
    setupI18nMock();
    createContainer();
  });

  afterEach(() => {
    removeContainer();
    jest.restoreAllMocks();
  });

  test('用户确认后调用 changeLanguage', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    const selector = new LanguageSelector('lang-selector-container');
    const changeSpy = jest.spyOn(selector, 'changeLanguage').mockResolvedValue(undefined);

    selector.confirmLanguageChange('en-US');

    expect(changeSpy).toHaveBeenCalledWith('en-US');
  });

  test('用户取消后调用 render 恢复选项', () => {
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    const selector = new LanguageSelector('lang-selector-container');
    const renderSpy = jest.spyOn(selector, 'render');

    selector.confirmLanguageChange('en-US');

    expect(renderSpy).toHaveBeenCalled();
  });
});

describe('LanguageSelector.changeLanguage', () => {
  let toastSpy;

  beforeEach(() => {
    setupI18nMock();
    createContainer();
    toastSpy = jest.spyOn(toastService, 'show').mockImplementation(() => {});
  });

  afterEach(() => {
    removeContainer();
    jest.restoreAllMocks();
  });

  test('切换成功后 currentLanguage 更新', async () => {
    const selector = new LanguageSelector('lang-selector-container');
    await selector.changeLanguage('en-US');
    expect(selector.currentLanguage).toBe('en-US');
  });

  test('切换成功后分发 languageChanged 事件', async () => {
    const selector = new LanguageSelector('lang-selector-container');
    const handler = jest.fn();
    window.addEventListener('languageChanged', handler);

    await selector.changeLanguage('en-US');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.language).toBe('en-US');

    window.removeEventListener('languageChanged', handler);
  });

  test('i18n.changeLanguage 抛出异常时显示 toast error', async () => {
    i18n.changeLanguage.mockRejectedValue(new Error('i18n error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const selector = new LanguageSelector('lang-selector-container');

    await selector.changeLanguage('en-US');

    expect(toastSpy).toHaveBeenCalledWith(
      expect.stringContaining('失败'),
      'error',
      expect.any(Number)
    );
  });
});

describe('LanguageSelector.updateText', () => {
  beforeEach(() => {
    setupI18nMock();
    createContainer();
  });

  afterEach(() => {
    removeContainer();
    jest.restoreAllMocks();
  });

  test('updateText 更新 label 文本', () => {
    i18n.t.mockImplementation((key) => key === 'settings.languageLabel' ? '语言' : key);
    const selector = new LanguageSelector('lang-selector-container');

    // 渲染后 label 使用 t() 返回值
    selector.updateText();

    const label = selector.container.querySelector('label');
    expect(label).not.toBeNull();
    expect(label.textContent).toContain('语言');
  });

  test('容器内无 label 时不抛出', () => {
    const selector = new LanguageSelector('lang-selector-container');
    selector.container.innerHTML = ''; // 清空
    expect(() => selector.updateText()).not.toThrow();
  });
});
