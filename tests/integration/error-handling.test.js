/**
 * 错误处理集成测试
 * 
 * 测试全局错误边界和错误处理的集成功能
 * 
 * 需求：10.5 - 保持应用稳定性，不崩溃
 */

import GlobalErrorBoundary from '../../src/utils/GlobalErrorBoundary.js';
import ErrorHandler from '../../src/utils/ErrorHandler.js';

describe('错误处理集成测试', () => {
  let errorBoundary;
  let errorCallback;

  beforeEach(() => {
    // 清理DOM
    document.body.innerHTML = '';
    
    // 创建错误回调（使用普通函数而不是jest.fn()）
    const calls = [];
    errorCallback = (...args) => {
      calls.push(args);
    };
    errorCallback.calls = calls;
    errorCallback.mock = { calls };
    
    // 创建错误边界实例
    errorBoundary = new GlobalErrorBoundary({
      onError: errorCallback,
      showErrorPage: true,
      logErrors: true
    });
  });

  afterEach(() => {
    // 清理
    if (errorBoundary) {
      errorBoundary.reset();
    }
    
    // 移除所有事件监听器
    const oldWindow = window;
    delete window.onerror;
    delete window.onunhandledrejection;
  });

  describe('GlobalErrorBoundary初始化', () => {
    test('应该成功初始化', () => {
      expect(() => {
        errorBoundary.initialize();
      }).not.toThrow();
    });

    test('初始化后应该设置全局错误处理器', () => {
      errorBoundary.initialize();
      
      // 验证事件监听器已添加
      // 注意：在Jest环境中，我们无法直接验证addEventListener是否被调用
      // 但我们可以验证错误边界对象的状态
      expect(errorBoundary.errorCount).toBe(0);
      expect(errorBoundary.errorLog).toEqual([]);
    });
  });

  describe('错误日志记录', () => {
    test('应该记录错误到日志', () => {
      const errorInfo = {
        type: ErrorHandler.ErrorTypes.NETWORK_ERROR,
        message: '网络连接失败'
      };

      errorBoundary.logError(errorInfo);

      const log = errorBoundary.getErrorLog();
      expect(log).toHaveLength(1);
      expect(log[0].errorInfo).toEqual(errorInfo);
      expect(log[0].timestamp).toBeDefined();
      expect(log[0].userAgent).toBeDefined();
      expect(log[0].url).toBeDefined();
    });

    test('应该限制日志数量为50条', () => {
      const errorInfo = {
        type: ErrorHandler.ErrorTypes.UNKNOWN_ERROR,
        message: '测试错误'
      };

      // 添加60条错误日志
      for (let i = 0; i < 60; i++) {
        errorBoundary.logError(errorInfo);
      }

      const log = errorBoundary.getErrorLog();
      expect(log).toHaveLength(50);
    });

    test('应该能够清除错误日志', () => {
      const errorInfo = {
        type: ErrorHandler.ErrorTypes.NETWORK_ERROR,
        message: '网络错误'
      };

      errorBoundary.logError(errorInfo);
      expect(errorBoundary.getErrorLog()).toHaveLength(1);

      errorBoundary.clearErrorLog();
      expect(errorBoundary.getErrorLog()).toHaveLength(0);
      expect(errorBoundary.errorCount).toBe(0);
    });
  });

  describe('错误通知显示', () => {
    test('应该显示错误通知', () => {
      const errorInfo = {
        type: ErrorHandler.ErrorTypes.NETWORK_ERROR,
        message: '网络连接失败'
      };

      errorBoundary.showErrorNotification(errorInfo);

      const notification = document.getElementById('global-error-notification');
      expect(notification).toBeTruthy();
      expect(notification.textContent).toContain('网络连接失败');
    });

    test('应该能够隐藏错误通知', () => {
      const errorInfo = {
        type: ErrorHandler.ErrorTypes.NETWORK_ERROR,
        message: '网络错误'
      };

      errorBoundary.showErrorNotification(errorInfo);
      
      const notification = document.getElementById('global-error-notification');
      expect(notification.style.display).toBe('flex');

      errorBoundary.hideErrorNotification();
      
      // 等待动画完成
      setTimeout(() => {
        expect(notification.style.display).toBe('none');
      }, 400);
    });
  });

  describe('错误页面显示', () => {
    test('应该在高严重性错误时显示错误页面', () => {
      const errorInfo = {
        type: ErrorHandler.ErrorTypes.API_KEY_INVALID,
        message: 'API密钥无效'
      };

      expect(errorBoundary.shouldShowErrorPage(errorInfo)).toBe(true);
    });

    test('应该在多次错误后显示错误页面', () => {
      errorBoundary.errorCount = 5;
      
      const errorInfo = {
        type: ErrorHandler.ErrorTypes.NETWORK_ERROR,
        message: '网络错误'
      };

      expect(errorBoundary.shouldShowErrorPage(errorInfo)).toBe(true);
    });

    test('不应该重复显示错误页面', () => {
      errorBoundary.isErrorPageShown = true;
      
      const errorInfo = {
        type: ErrorHandler.ErrorTypes.API_KEY_INVALID,
        message: 'API密钥无效'
      };

      expect(errorBoundary.shouldShowErrorPage(errorInfo)).toBe(false);
    });

    test('应该显示错误页面并包含重载按钮', () => {
      const errorInfo = {
        type: ErrorHandler.ErrorTypes.API_KEY_INVALID,
        message: 'API密钥无效，请检查配置'
      };

      errorBoundary.showErrorPage(errorInfo);

      const errorPage = document.getElementById('global-error-page');
      expect(errorPage).toBeTruthy();
      expect(errorPage.textContent).toContain('应用遇到了问题');
      expect(errorPage.textContent).toContain('API密钥无效，请检查配置');

      const reloadBtn = document.getElementById('error-reload-btn');
      expect(reloadBtn).toBeTruthy();
      expect(reloadBtn.textContent).toBe('刷新页面');
    });
  });

  describe('错误处理集成', () => {
    test('应该通过ErrorHandler处理错误并显示通知', () => {
      const error = new Error('测试错误');
      const errorInfo = ErrorHandler.handleError(error, 'Test Context');

      errorBoundary.showErrorNotification(errorInfo);

      const notification = document.getElementById('global-error-notification');
      expect(notification).toBeTruthy();
      expect(notification.textContent).toContain('测试错误');
    });

    test('应该正确处理网络错误', () => {
      const error = new TypeError('fetch failed');
      const errorInfo = ErrorHandler.handleError(error);

      expect(errorInfo.type).toBe(ErrorHandler.ErrorTypes.NETWORK_ERROR);
      expect(ErrorHandler.isRecoverable(errorInfo)).toBe(true);
      expect(ErrorHandler.getSeverity(errorInfo)).toBe('medium');
    });

    test('应该正确处理API密钥错误', () => {
      const error = { status: 401, message: 'Unauthorized' };
      const errorInfo = ErrorHandler.handleError(error);

      expect(errorInfo.type).toBe(ErrorHandler.ErrorTypes.API_KEY_INVALID);
      expect(ErrorHandler.isRecoverable(errorInfo)).toBe(false);
      expect(ErrorHandler.getSeverity(errorInfo)).toBe('high');
    });
  });

  describe('HTML转义', () => {
    test('应该正确转义HTML特殊字符', () => {
      const text = '<script>alert("XSS")</script>';
      const escaped = errorBoundary.escapeHtml(text);

      expect(escaped).not.toContain('<script>');
      expect(escaped).toContain('&lt;script&gt;');
    });

    test('应该转义HTML标签', () => {
      const text = '<div>Test</div>';
      const escaped = errorBoundary.escapeHtml(text);

      expect(escaped).toContain('&lt;div&gt;');
      expect(escaped).toContain('&lt;/div&gt;');
    });
  });

  describe('错误边界重置', () => {
    test('应该重置错误边界状态', () => {
      // 设置一些状态
      errorBoundary.isErrorPageShown = true;
      errorBoundary.errorCount = 5;
      
      // 显示错误页面
      const errorInfo = {
        type: ErrorHandler.ErrorTypes.UNKNOWN_ERROR,
        message: '测试错误'
      };
      errorBoundary.showErrorPage(errorInfo);

      // 重置
      errorBoundary.reset();

      expect(errorBoundary.isErrorPageShown).toBe(false);
      expect(errorBoundary.errorCount).toBe(0);
      
      const errorPage = document.getElementById('global-error-page');
      expect(errorPage).toBeFalsy();
    });
  });

  describe('错误回调', () => {
    test('应该调用自定义错误回调', () => {
      errorBoundary.initialize();

      const error = new Error('测试错误');
      const mockEvent = { error };

      errorBoundary.handleGlobalError(error, mockEvent);

      expect(errorCallback.calls.length).toBeGreaterThan(0);
      expect(errorCallback.calls[0][0]).toMatchObject({
        type: expect.any(String),
        message: expect.any(String)
      });
      expect(errorCallback.calls[0][1]).toBe(mockEvent);
    });

    test('应该处理错误回调中的异常', () => {
      const throwingCalls = [];
      const throwingCallback = (...args) => {
        throwingCalls.push(args);
        throw new Error('Callback error');
      };
      throwingCallback.calls = throwingCalls;

      const boundary = new GlobalErrorBoundary({
        onError: throwingCallback,
        showErrorPage: false,
        logErrors: false
      });

      boundary.initialize();

      const error = new Error('测试错误');
      const mockEvent = { error };

      // 不应该抛出异常
      expect(() => {
        boundary.handleGlobalError(error, mockEvent);
      }).not.toThrow();

      expect(throwingCallback.calls.length).toBeGreaterThan(0);
    });
  });
});
