/**
 * GlobalErrorBoundary - 全局错误边界
 * 
 * 捕获未处理的错误和Promise拒绝，防止应用崩溃
 * 提供用户友好的错误页面和恢复选项
 * 
 * 需求：10.5 - 保持应用稳定性，不崩溃
 */

import ErrorHandler from './ErrorHandler.js';

class GlobalErrorBoundary {
  /**
   * 创建GlobalErrorBoundary实例
   * @param {Object} options - 配置选项
   * @param {Function} options.onError - 错误回调函数
   * @param {boolean} options.showErrorPage - 是否显示错误页面
   * @param {boolean} options.logErrors - 是否记录错误日志
   */
  constructor(options = {}) {
    this.options = {
      onError: options.onError || null,
      showErrorPage: options.showErrorPage !== false,
      logErrors: options.logErrors !== false
    };

    this.errorCount = 0;
    this.errorLog = [];
    this.isErrorPageShown = false;
  }

  /**
   * 初始化全局错误边界
   * 
   * 设置全局错误处理器和未处理的Promise拒绝处理器
   */
  initialize() {
    // 捕获全局JavaScript错误
    window.addEventListener('error', (event) => {
      this.handleGlobalError(event.error || new Error(event.message), event);
      // 阻止默认的错误处理（防止在控制台显示红色错误）
      event.preventDefault();
    });

    // 捕获未处理的Promise拒绝
    window.addEventListener('unhandledrejection', (event) => {
      this.handleUnhandledRejection(event.reason, event);
      // 阻止默认的错误处理
      event.preventDefault();
    });

    console.log('[GlobalErrorBoundary] Initialized');
  }

  /**
   * 处理全局错误
   * 
   * @param {Error} error - 错误对象
   * @param {ErrorEvent} event - 错误事件对象
   */
  handleGlobalError(error, event) {
    this.errorCount++;

    // 使用ErrorHandler处理错误
    const errorInfo = ErrorHandler.handleError(error, 'Global Error');

    // 记录错误日志
    if (this.options.logErrors) {
      this.logError(errorInfo);
    }

    // 调用自定义错误回调
    if (this.options.onError) {
      try {
        this.options.onError(errorInfo, event);
      } catch (callbackError) {
        console.error('[GlobalErrorBoundary] Error in onError callback:', callbackError);
      }
    }

    // 显示错误页面（如果错误严重且尚未显示）
    if (this.shouldShowErrorPage(errorInfo)) {
      this.showErrorPage(errorInfo);
    } else {
      // 显示错误提示
      this.showErrorNotification(errorInfo);
    }
  }

  /**
   * 处理未处理的Promise拒绝
   * 
   * @param {*} reason - 拒绝原因
   * @param {PromiseRejectionEvent} event - Promise拒绝事件对象
   */
  handleUnhandledRejection(reason, event) {
    this.errorCount++;

    // 将reason转换为Error对象
    const error = reason instanceof Error ? reason : new Error(String(reason));

    // 使用ErrorHandler处理错误
    const errorInfo = ErrorHandler.handleError(error, 'Unhandled Promise Rejection');

    // 记录错误日志
    if (this.options.logErrors) {
      this.logError(errorInfo);
    }

    // 调用自定义错误回调
    if (this.options.onError) {
      try {
        this.options.onError(errorInfo, event);
      } catch (callbackError) {
        console.error('[GlobalErrorBoundary] Error in onError callback:', callbackError);
      }
    }

    // 显示错误提示
    this.showErrorNotification(errorInfo);
  }

  /**
   * 判断是否应该显示错误页面
   * 
   * @param {Object} errorInfo - 错误信息对象
   * @returns {boolean}
   */
  shouldShowErrorPage(errorInfo) {
    // 如果已经显示错误页面，不再重复显示
    if (this.isErrorPageShown) {
      return false;
    }

    // 如果配置不显示错误页面
    if (!this.options.showErrorPage) {
      return false;
    }

    // 高严重性错误显示错误页面
    const severity = ErrorHandler.getSeverity(errorInfo);
    if (severity === 'high') {
      return true;
    }

    // 短时间内多次错误（可能是循环错误）
    if (this.errorCount >= 5) {
      return true;
    }

    return false;
  }

  /**
   * 显示错误页面
   * 
   * @param {Object} errorInfo - 错误信息对象
   */
  showErrorPage(errorInfo) {
    this.isErrorPageShown = true;

    // 创建错误页面容器
    const errorPage = document.createElement('div');
    errorPage.id = 'global-error-page';
    errorPage.className = 'global-error-page';
    errorPage.innerHTML = `
      <div class="error-page-content">
        <div class="error-icon">⚠️</div>
        <h1>应用遇到了问题</h1>
        <p class="error-message">${this.escapeHtml(errorInfo.message)}</p>
        <div class="error-actions">
          <button id="error-reload-btn" class="btn btn-primary">刷新页面</button>
          <button id="error-details-btn" class="btn btn-secondary">查看详情</button>
        </div>
        <div id="error-details" class="error-details hidden">
          <h3>错误详情</h3>
          <pre>${this.escapeHtml(ErrorHandler.formatErrorLog(errorInfo))}</pre>
        </div>
      </div>
    `;

    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
      .global-error-page {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
        padding: 20px;
      }
      
      .error-page-content {
        background: white;
        border-radius: 8px;
        padding: 40px;
        max-width: 600px;
        width: 100%;
        text-align: center;
      }
      
      .error-icon {
        font-size: 64px;
        margin-bottom: 20px;
      }
      
      .error-page-content h1 {
        color: #d32f2f;
        margin-bottom: 16px;
      }
      
      .error-message {
        color: #666;
        margin-bottom: 24px;
        font-size: 16px;
      }
      
      .error-actions {
        display: flex;
        gap: 12px;
        justify-content: center;
        margin-bottom: 20px;
      }
      
      .error-details {
        text-align: left;
        background: #f5f5f5;
        padding: 16px;
        border-radius: 4px;
        margin-top: 20px;
      }
      
      .error-details pre {
        white-space: pre-wrap;
        word-wrap: break-word;
        font-size: 12px;
        color: #333;
        margin: 0;
      }
      
      .error-details.hidden {
        display: none;
      }
    `;

    // 添加到页面
    document.body.appendChild(style);
    document.body.appendChild(errorPage);

    // 绑定事件
    document.getElementById('error-reload-btn').addEventListener('click', () => {
      window.location.reload();
    });

    document.getElementById('error-details-btn').addEventListener('click', () => {
      const details = document.getElementById('error-details');
      details.classList.toggle('hidden');
    });
  }

  /**
   * 显示错误通知
   * 
   * @param {Object} errorInfo - 错误信息对象
   */
  showErrorNotification(errorInfo) {
    // 查找或创建错误通知容器
    let notification = document.getElementById('global-error-notification');
    
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'global-error-notification';
      notification.className = 'global-error-notification';
      
      // 添加样式
      const style = document.createElement('style');
      style.textContent = `
        .global-error-notification {
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: #d32f2f;
          color: white;
          padding: 16px 24px;
          border-radius: 4px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          z-index: 10000;
          max-width: 500px;
          display: flex;
          align-items: center;
          gap: 12px;
          animation: slideDown 0.3s ease-out;
        }
        
        @keyframes slideDown {
          from {
            transform: translateX(-50%) translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
          }
        }
        
        .global-error-notification.fade-out {
          animation: fadeOut 0.3s ease-out forwards;
        }
        
        @keyframes fadeOut {
          to {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
          }
        }
        
        .error-notification-icon {
          font-size: 24px;
        }
        
        .error-notification-content {
          flex: 1;
        }
        
        .error-notification-close {
          background: none;
          border: none;
          color: white;
          font-size: 20px;
          cursor: pointer;
          padding: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
      `;
      
      document.head.appendChild(style);
      document.body.appendChild(notification);
    }

    // 设置通知内容
    notification.innerHTML = `
      <span class="error-notification-icon">⚠️</span>
      <div class="error-notification-content">${this.escapeHtml(errorInfo.message)}</div>
      <button class="error-notification-close" aria-label="关闭">×</button>
    `;

    // 显示通知
    notification.style.display = 'flex';
    notification.classList.remove('fade-out');

    // 绑定关闭按钮
    const closeBtn = notification.querySelector('.error-notification-close');
    closeBtn.addEventListener('click', () => {
      this.hideErrorNotification();
    });

    // 5秒后自动隐藏
    setTimeout(() => {
      this.hideErrorNotification();
    }, 5000);
  }

  /**
   * 隐藏错误通知
   */
  hideErrorNotification() {
    const notification = document.getElementById('global-error-notification');
    if (notification) {
      notification.classList.add('fade-out');
      setTimeout(() => {
        notification.style.display = 'none';
      }, 300);
    }
  }

  /**
   * 记录错误日志
   * 
   * @param {Object} errorInfo - 错误信息对象
   */
  logError(errorInfo) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      errorInfo,
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    this.errorLog.push(logEntry);

    // 限制日志数量
    if (this.errorLog.length > 50) {
      this.errorLog.shift();
    }

    // 输出到控制台
    console.error(ErrorHandler.formatErrorLog(errorInfo));

    // 可以在这里添加发送错误日志到服务器的逻辑
    // this.sendErrorToServer(logEntry);
  }

  /**
   * 获取错误日志
   * 
   * @returns {Array} 错误日志数组
   */
  getErrorLog() {
    return [...this.errorLog];
  }

  /**
   * 清除错误日志
   */
  clearErrorLog() {
    this.errorLog = [];
    this.errorCount = 0;
  }

  /**
   * 转义HTML特殊字符
   * 
   * @param {string} text - 要转义的文本
   * @returns {string} 转义后的文本
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 重置错误边界状态
   */
  reset() {
    this.isErrorPageShown = false;
    this.errorCount = 0;
    
    // 移除错误页面
    const errorPage = document.getElementById('global-error-page');
    if (errorPage) {
      errorPage.remove();
    }
    
    // 隐藏错误通知
    this.hideErrorNotification();
  }
}

export default GlobalErrorBoundary;
