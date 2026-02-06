/**
 * ErrorHandler - 全局错误处理工具类
 * 
 * 提供统一的错误处理和分类功能
 * 将不同类型的错误转换为用户友好的消息和建议操作
 * 
 * 需求：10.1 - 网络连接错误处理
 * 需求：10.2 - API密钥无效处理
 * 需求：10.3 - API请求超时处理
 * 需求：10.4 - 位置解析失败处理
 * 需求：10.5 - 保持应用稳定性，不崩溃
 */

class ErrorHandler {
  /**
   * 错误类型常量
   */
  static ErrorTypes = {
    NETWORK_ERROR: 'NETWORK_ERROR',
    API_KEY_INVALID: 'API_KEY_INVALID',
    API_ERROR: 'API_ERROR',
    RATE_LIMIT: 'RATE_LIMIT',
    TIMEOUT: 'TIMEOUT',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    GEOCODING_ERROR: 'GEOCODING_ERROR',
    STORAGE_ERROR: 'STORAGE_ERROR',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR'
  };

  /**
   * 处理API错误
   * 
   * 根据HTTP状态码返回相应的错误信息和建议操作
   * 
   * @param {Error} error - 错误对象
   * @returns {Object} 包含type、message、action的错误信息对象
   * 
   * 需求：10.2 - API密钥无效处理
   * 需求：10.3 - API请求超时处理
   */
  static handleAPIError(error) {
    // 401/403: API密钥无效
    if (error.status === 401 || error.status === 403) {
      return {
        type: this.ErrorTypes.API_KEY_INVALID,
        message: 'API密钥无效，请检查配置',
        action: 'showAPIKeyModal',
        originalError: error
      };
    }

    // 429: 请求频率限制
    if (error.status === 429) {
      return {
        type: this.ErrorTypes.RATE_LIMIT,
        message: '请求过于频繁，请稍后再试',
        action: 'disableRefreshButton',
        originalError: error
      };
    }

    // 408: 请求超时
    if (error.status === 408 || error.name === 'TimeoutError') {
      return {
        type: this.ErrorTypes.TIMEOUT,
        message: 'API请求超时，请检查网络连接或稍后重试',
        action: 'showRetryButton',
        originalError: error
      };
    }

    // 500+: 服务器错误
    if (error.status >= 500) {
      return {
        type: this.ErrorTypes.API_ERROR,
        message: '服务器错误，请稍后重试',
        action: 'showRetryButton',
        originalError: error
      };
    }

    // 其他API错误
    return {
      type: this.ErrorTypes.API_ERROR,
      message: error.message || '获取天气数据失败，请稍后重试',
      action: 'showRetryButton',
      originalError: error
    };
  }

  /**
   * 处理网络错误
   * 
   * @param {Error} error - 网络错误对象
   * @returns {Object} 包含type、message、action的错误信息对象
   * 
   * 需求：10.1 - 网络连接错误处理
   */
  static handleNetworkError(error) {
    return {
      type: this.ErrorTypes.NETWORK_ERROR,
      message: '网络连接失败，请检查网络设置',
      action: 'showRetryButton',
      originalError: error
    };
  }

  /**
   * 处理数据验证错误
   * 
   * @param {string} field - 验证失败的字段名
   * @param {*} value - 验证失败的值
   * @returns {Object} 包含type、message、action的错误信息对象
   */
  static handleValidationError(field, value) {
    return {
      type: this.ErrorTypes.VALIDATION_ERROR,
      message: `数据验证失败：${field}`,
      action: 'logError',
      details: { field, value }
    };
  }

  /**
   * 处理地理编码错误
   * 
   * @param {Error} error - 地理编码错误对象
   * @returns {Object} 包含type、message、action的错误信息对象
   * 
   * 需求：10.4 - 位置解析失败处理
   */
  static handleGeocodingError(error) {
    let message = '位置解析失败，请尝试不同的位置名称';

    // 根据错误消息提供更具体的提示
    if (error.message.includes('未找到') || error.message.includes('not found')) {
      message = '未找到该位置，请尝试输入更具体的城市名称（如：北京、上海）';
    } else if (error.message.includes('权限') || error.message.includes('permission')) {
      message = '位置权限被拒绝，请在浏览器设置中允许位置访问，或手动输入城市名称';
    } else if (error.message.includes('不支持') || error.message.includes('not supported')) {
      message = '您的浏览器不支持地理定位功能，请手动输入城市名称';
    } else if (error.message.includes('超时') || error.message.includes('timeout')) {
      message = '获取位置超时，请重试或手动输入城市名称';
    } else if (error.message.includes('位置信息不可用')) {
      // 保留原始错误消息
      message = error.message;
    }

    return {
      type: this.ErrorTypes.GEOCODING_ERROR,
      message,
      action: 'showLocationInput',
      originalError: error
    };
  }

  /**
   * 处理存储错误
   * 
   * @param {Error} error - 存储错误对象
   * @returns {Object} 包含type、message、action的错误信息对象
   */
  static handleStorageError(error) {
    let message = '数据存储失败';

    if (error.message.includes('quota') || error.message.includes('exceeded')) {
      message = '浏览器存储空间已满，请清理浏览器数据后重试';
    } else if (error.message.includes('disabled') || error.message.includes('not available')) {
      message = '浏览器存储功能被禁用，部分功能可能无法正常使用';
    }

    return {
      type: this.ErrorTypes.STORAGE_ERROR,
      message,
      action: 'logError',
      originalError: error
    };
  }

  /**
   * 通用错误处理
   * 
   * 根据错误类型自动选择合适的处理方法
   * 
   * @param {Error} error - 错误对象
   * @param {string} context - 错误发生的上下文（可选）
   * @returns {Object} 包含type、message、action的错误信息对象
   * 
   * 需求：10.5 - 保持应用稳定性
   */
  static handleError(error, context = '') {
    // 确保错误对象存在
    if (!error) {
      return {
        type: this.ErrorTypes.UNKNOWN_ERROR,
        message: '发生未知错误',
        action: 'logError',
        context
      };
    }

    // 记录错误到控制台（开发模式）
    console.error(`[ErrorHandler] ${context}:`, error);

    // 根据错误类型或特征选择处理方法
    try {
      // 网络错误
      if (error instanceof TypeError && error.message.includes('fetch')) {
        return this.handleNetworkError(error);
      }

      // API错误（有status属性）
      if (error.status !== undefined) {
        return this.handleAPIError(error);
      }

      // 超时错误
      if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
        return {
          type: this.ErrorTypes.TIMEOUT,
          message: '操作超时，请重试',
          action: 'showRetryButton',
          originalError: error,
          context
        };
      }

      // 地理编码相关错误
      if (error.message.includes('位置') || error.message.includes('定位') ||
          error.message.includes('location') || error.message.includes('geocod')) {
        return this.handleGeocodingError(error);
      }

      // 存储相关错误
      if (error.message.includes('storage') || error.message.includes('localStorage')) {
        return this.handleStorageError(error);
      }

      // 验证错误
      if (error.message.includes('验证') || error.message.includes('invalid') || 
          error.message.includes('validation')) {
        return {
          type: this.ErrorTypes.VALIDATION_ERROR,
          message: error.message || '数据验证失败',
          action: 'logError',
          originalError: error,
          context
        };
      }

      // 默认错误处理
      return {
        type: this.ErrorTypes.UNKNOWN_ERROR,
        message: error.message || '发生未知错误，请稍后重试',
        action: 'logError',
        originalError: error,
        context
      };

    } catch (handlingError) {
      // 错误处理本身出错时的降级方案
      console.error('[ErrorHandler] Error while handling error:', handlingError);
      return {
        type: this.ErrorTypes.UNKNOWN_ERROR,
        message: '系统错误，请刷新页面重试',
        action: 'logError',
        originalError: error,
        context
      };
    }
  }

  /**
   * 检查错误是否可恢复
   * 
   * @param {Object} errorInfo - 错误信息对象
   * @returns {boolean} 如果错误可恢复返回true
   */
  static isRecoverable(errorInfo) {
    const recoverableTypes = [
      this.ErrorTypes.NETWORK_ERROR,
      this.ErrorTypes.TIMEOUT,
      this.ErrorTypes.GEOCODING_ERROR,
      this.ErrorTypes.API_ERROR
    ];

    return recoverableTypes.includes(errorInfo.type);
  }

  /**
   * 获取错误的严重程度
   * 
   * @param {Object} errorInfo - 错误信息对象
   * @returns {string} 'low', 'medium', 'high'
   */
  static getSeverity(errorInfo) {
    switch (errorInfo.type) {
      case this.ErrorTypes.API_KEY_INVALID:
      case this.ErrorTypes.STORAGE_ERROR:
        return 'high';
      
      case this.ErrorTypes.NETWORK_ERROR:
      case this.ErrorTypes.TIMEOUT:
      case this.ErrorTypes.API_ERROR:
        return 'medium';
      
      case this.ErrorTypes.GEOCODING_ERROR:
      case this.ErrorTypes.VALIDATION_ERROR:
      case this.ErrorTypes.RATE_LIMIT:
        return 'low';
      
      default:
        return 'medium';
    }
  }

  /**
   * 格式化错误消息用于日志记录
   * 
   * @param {Object} errorInfo - 错误信息对象
   * @returns {string} 格式化的错误日志
   */
  static formatErrorLog(errorInfo) {
    const timestamp = new Date().toISOString();
    const severity = this.getSeverity(errorInfo);
    
    let log = `[${timestamp}] [${severity.toUpperCase()}] ${errorInfo.type}: ${errorInfo.message}`;
    
    if (errorInfo.context) {
      log += `\n  Context: ${errorInfo.context}`;
    }
    
    if (errorInfo.originalError) {
      log += `\n  Original: ${errorInfo.originalError.message}`;
      if (errorInfo.originalError.stack) {
        log += `\n  Stack: ${errorInfo.originalError.stack}`;
      }
    }
    
    return log;
  }
}

export default ErrorHandler;
