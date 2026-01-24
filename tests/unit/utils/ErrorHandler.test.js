/**
 * ErrorHandler单元测试
 * 
 * 测试错误处理工具类的各种错误类型处理
 * 
 * 需求：10.1, 10.2, 10.3, 10.4, 10.5
 */

import ErrorHandler from '../../../src/utils/ErrorHandler.js';

describe('ErrorHandler', () => {
  describe('handleAPIError', () => {
    test('应该正确处理401错误（API密钥无效）', () => {
      const error = { status: 401, message: 'Unauthorized' };
      const result = ErrorHandler.handleAPIError(error);

      expect(result.type).toBe(ErrorHandler.ErrorTypes.API_KEY_INVALID);
      expect(result.message).toBe('API密钥无效，请检查配置');
      expect(result.action).toBe('showAPIKeyModal');
      expect(result.originalError).toBe(error);
    });

    test('应该正确处理403错误（API密钥无效）', () => {
      const error = { status: 403, message: 'Forbidden' };
      const result = ErrorHandler.handleAPIError(error);

      expect(result.type).toBe(ErrorHandler.ErrorTypes.API_KEY_INVALID);
      expect(result.message).toBe('API密钥无效，请检查配置');
      expect(result.action).toBe('showAPIKeyModal');
    });

    test('应该正确处理429错误（请求频率限制）', () => {
      const error = { status: 429, message: 'Too Many Requests' };
      const result = ErrorHandler.handleAPIError(error);

      expect(result.type).toBe(ErrorHandler.ErrorTypes.RATE_LIMIT);
      expect(result.message).toBe('请求过于频繁，请稍后再试');
      expect(result.action).toBe('disableRefreshButton');
    });

    test('应该正确处理408错误（请求超时）', () => {
      const error = { status: 408, message: 'Request Timeout' };
      const result = ErrorHandler.handleAPIError(error);

      expect(result.type).toBe(ErrorHandler.ErrorTypes.TIMEOUT);
      expect(result.message).toBe('API请求超时，请检查网络连接或稍后重试');
      expect(result.action).toBe('showRetryButton');
    });

    test('应该正确处理500错误（服务器错误）', () => {
      const error = { status: 500, message: 'Internal Server Error' };
      const result = ErrorHandler.handleAPIError(error);

      expect(result.type).toBe(ErrorHandler.ErrorTypes.API_ERROR);
      expect(result.message).toBe('服务器错误，请稍后重试');
      expect(result.action).toBe('showRetryButton');
    });

    test('应该正确处理其他API错误', () => {
      const error = { status: 400, message: 'Bad Request' };
      const result = ErrorHandler.handleAPIError(error);

      expect(result.type).toBe(ErrorHandler.ErrorTypes.API_ERROR);
      expect(result.message).toBe('Bad Request');
      expect(result.action).toBe('showRetryButton');
    });

    test('应该处理没有消息的错误', () => {
      const error = { status: 400 };
      const result = ErrorHandler.handleAPIError(error);

      expect(result.type).toBe(ErrorHandler.ErrorTypes.API_ERROR);
      expect(result.message).toBe('获取天气数据失败，请稍后重试');
    });
  });

  describe('handleNetworkError', () => {
    test('应该正确处理网络错误', () => {
      const error = new TypeError('fetch failed');
      const result = ErrorHandler.handleNetworkError(error);

      expect(result.type).toBe(ErrorHandler.ErrorTypes.NETWORK_ERROR);
      expect(result.message).toBe('网络连接失败，请检查网络设置');
      expect(result.action).toBe('showRetryButton');
      expect(result.originalError).toBe(error);
    });
  });

  describe('handleValidationError', () => {
    test('应该正确处理验证错误', () => {
      const result = ErrorHandler.handleValidationError('latitude', 'invalid');

      expect(result.type).toBe(ErrorHandler.ErrorTypes.VALIDATION_ERROR);
      expect(result.message).toBe('数据验证失败：latitude');
      expect(result.action).toBe('logError');
      expect(result.details).toEqual({ field: 'latitude', value: 'invalid' });
    });
  });

  describe('handleGeocodingError', () => {
    test('应该处理位置未找到错误', () => {
      const error = new Error('位置未找到');
      const result = ErrorHandler.handleGeocodingError(error);

      expect(result.type).toBe(ErrorHandler.ErrorTypes.GEOCODING_ERROR);
      expect(result.message).toContain('未找到该位置');
      expect(result.action).toBe('showLocationInput');
    });

    test('应该处理权限拒绝错误', () => {
      const error = new Error('位置权限被拒绝');
      const result = ErrorHandler.handleGeocodingError(error);

      expect(result.type).toBe(ErrorHandler.ErrorTypes.GEOCODING_ERROR);
      expect(result.message).toContain('权限被拒绝');
      expect(result.action).toBe('showLocationInput');
    });

    test('应该处理不支持地理定位错误', () => {
      const error = new Error('浏览器不支持地理定位');
      const result = ErrorHandler.handleGeocodingError(error);

      expect(result.type).toBe(ErrorHandler.ErrorTypes.GEOCODING_ERROR);
      expect(result.message).toContain('不支持地理定位');
      expect(result.action).toBe('showLocationInput');
    });

    test('应该处理超时错误', () => {
      const error = new Error('获取位置超时');
      const result = ErrorHandler.handleGeocodingError(error);

      expect(result.type).toBe(ErrorHandler.ErrorTypes.GEOCODING_ERROR);
      expect(result.message).toContain('超时');
      expect(result.action).toBe('showLocationInput');
    });

    test('应该处理通用地理编码错误', () => {
      const error = new Error('Unknown geocoding error');
      const result = ErrorHandler.handleGeocodingError(error);

      expect(result.type).toBe(ErrorHandler.ErrorTypes.GEOCODING_ERROR);
      expect(result.message).toBe('位置解析失败，请尝试不同的位置名称');
      expect(result.action).toBe('showLocationInput');
    });
  });

  describe('handleStorageError', () => {
    test('应该处理存储空间已满错误', () => {
      const error = new Error('quota exceeded');
      const result = ErrorHandler.handleStorageError(error);

      expect(result.type).toBe(ErrorHandler.ErrorTypes.STORAGE_ERROR);
      expect(result.message).toContain('存储空间已满');
      expect(result.action).toBe('logError');
    });

    test('应该处理存储被禁用错误', () => {
      const error = new Error('localStorage is disabled');
      const result = ErrorHandler.handleStorageError(error);

      expect(result.type).toBe(ErrorHandler.ErrorTypes.STORAGE_ERROR);
      expect(result.message).toContain('存储功能被禁用');
      expect(result.action).toBe('logError');
    });

    test('应该处理通用存储错误', () => {
      const error = new Error('Storage error');
      const result = ErrorHandler.handleStorageError(error);

      expect(result.type).toBe(ErrorHandler.ErrorTypes.STORAGE_ERROR);
      expect(result.message).toBe('数据存储失败');
      expect(result.action).toBe('logError');
    });
  });

  describe('handleError', () => {
    test('应该处理null错误', () => {
      const result = ErrorHandler.handleError(null, 'Test Context');

      expect(result.type).toBe(ErrorHandler.ErrorTypes.UNKNOWN_ERROR);
      expect(result.message).toBe('发生未知错误');
      expect(result.context).toBe('Test Context');
    });

    test('应该处理undefined错误', () => {
      const result = ErrorHandler.handleError(undefined, 'Test Context');

      expect(result.type).toBe(ErrorHandler.ErrorTypes.UNKNOWN_ERROR);
      expect(result.message).toBe('发生未知错误');
    });

    test('应该识别并处理网络错误', () => {
      const error = new TypeError('fetch failed');
      const result = ErrorHandler.handleError(error);

      expect(result.type).toBe(ErrorHandler.ErrorTypes.NETWORK_ERROR);
      expect(result.message).toBe('网络连接失败，请检查网络设置');
    });

    test('应该识别并处理API错误', () => {
      const error = { status: 401, message: 'Unauthorized' };
      const result = ErrorHandler.handleError(error);

      expect(result.type).toBe(ErrorHandler.ErrorTypes.API_KEY_INVALID);
    });

    test('应该识别并处理超时错误', () => {
      const error = new Error('Request timeout');
      const result = ErrorHandler.handleError(error);

      expect(result.type).toBe(ErrorHandler.ErrorTypes.TIMEOUT);
      expect(result.message).toBe('操作超时，请重试');
    });

    test('应该识别并处理地理编码错误', () => {
      const error = new Error('位置解析失败');
      const result = ErrorHandler.handleError(error);

      expect(result.type).toBe(ErrorHandler.ErrorTypes.GEOCODING_ERROR);
    });

    test('应该识别并处理存储错误', () => {
      const error = new Error('localStorage error');
      const result = ErrorHandler.handleError(error);

      expect(result.type).toBe(ErrorHandler.ErrorTypes.STORAGE_ERROR);
    });

    test('应该识别并处理验证错误', () => {
      const error = new Error('验证失败');
      const result = ErrorHandler.handleError(error);

      expect(result.type).toBe(ErrorHandler.ErrorTypes.VALIDATION_ERROR);
    });

    test('应该处理未知错误类型', () => {
      const error = new Error('Some unknown error');
      const result = ErrorHandler.handleError(error);

      expect(result.type).toBe(ErrorHandler.ErrorTypes.UNKNOWN_ERROR);
      expect(result.message).toBe('Some unknown error');
    });

    test('应该在错误处理失败时提供降级方案', () => {
      // 创建一个会导致处理失败的特殊错误对象
      const error = {
        get message() {
          throw new Error('Cannot access message');
        }
      };

      const result = ErrorHandler.handleError(error);

      expect(result.type).toBe(ErrorHandler.ErrorTypes.UNKNOWN_ERROR);
      expect(result.message).toBe('系统错误，请刷新页面重试');
    });
  });

  describe('isRecoverable', () => {
    test('网络错误应该是可恢复的', () => {
      const errorInfo = { type: ErrorHandler.ErrorTypes.NETWORK_ERROR };
      expect(ErrorHandler.isRecoverable(errorInfo)).toBe(true);
    });

    test('超时错误应该是可恢复的', () => {
      const errorInfo = { type: ErrorHandler.ErrorTypes.TIMEOUT };
      expect(ErrorHandler.isRecoverable(errorInfo)).toBe(true);
    });

    test('地理编码错误应该是可恢复的', () => {
      const errorInfo = { type: ErrorHandler.ErrorTypes.GEOCODING_ERROR };
      expect(ErrorHandler.isRecoverable(errorInfo)).toBe(true);
    });

    test('API错误应该是可恢复的', () => {
      const errorInfo = { type: ErrorHandler.ErrorTypes.API_ERROR };
      expect(ErrorHandler.isRecoverable(errorInfo)).toBe(true);
    });

    test('API密钥无效错误不应该是可恢复的', () => {
      const errorInfo = { type: ErrorHandler.ErrorTypes.API_KEY_INVALID };
      expect(ErrorHandler.isRecoverable(errorInfo)).toBe(false);
    });

    test('存储错误不应该是可恢复的', () => {
      const errorInfo = { type: ErrorHandler.ErrorTypes.STORAGE_ERROR };
      expect(ErrorHandler.isRecoverable(errorInfo)).toBe(false);
    });
  });

  describe('getSeverity', () => {
    test('API密钥无效应该是高严重性', () => {
      const errorInfo = { type: ErrorHandler.ErrorTypes.API_KEY_INVALID };
      expect(ErrorHandler.getSeverity(errorInfo)).toBe('high');
    });

    test('存储错误应该是高严重性', () => {
      const errorInfo = { type: ErrorHandler.ErrorTypes.STORAGE_ERROR };
      expect(ErrorHandler.getSeverity(errorInfo)).toBe('high');
    });

    test('网络错误应该是中等严重性', () => {
      const errorInfo = { type: ErrorHandler.ErrorTypes.NETWORK_ERROR };
      expect(ErrorHandler.getSeverity(errorInfo)).toBe('medium');
    });

    test('超时错误应该是中等严重性', () => {
      const errorInfo = { type: ErrorHandler.ErrorTypes.TIMEOUT };
      expect(ErrorHandler.getSeverity(errorInfo)).toBe('medium');
    });

    test('地理编码错误应该是低严重性', () => {
      const errorInfo = { type: ErrorHandler.ErrorTypes.GEOCODING_ERROR };
      expect(ErrorHandler.getSeverity(errorInfo)).toBe('low');
    });

    test('验证错误应该是低严重性', () => {
      const errorInfo = { type: ErrorHandler.ErrorTypes.VALIDATION_ERROR };
      expect(ErrorHandler.getSeverity(errorInfo)).toBe('low');
    });

    test('未知错误应该是中等严重性', () => {
      const errorInfo = { type: ErrorHandler.ErrorTypes.UNKNOWN_ERROR };
      expect(ErrorHandler.getSeverity(errorInfo)).toBe('medium');
    });
  });

  describe('formatErrorLog', () => {
    test('应该格式化基本错误日志', () => {
      const errorInfo = {
        type: ErrorHandler.ErrorTypes.NETWORK_ERROR,
        message: '网络连接失败'
      };

      const log = ErrorHandler.formatErrorLog(errorInfo);

      expect(log).toContain('MEDIUM');
      expect(log).toContain('NETWORK_ERROR');
      expect(log).toContain('网络连接失败');
    });

    test('应该包含上下文信息', () => {
      const errorInfo = {
        type: ErrorHandler.ErrorTypes.API_ERROR,
        message: 'API调用失败',
        context: 'Fetching weather data'
      };

      const log = ErrorHandler.formatErrorLog(errorInfo);

      expect(log).toContain('Context: Fetching weather data');
    });

    test('应该包含原始错误信息', () => {
      const originalError = new Error('Original error message');
      const errorInfo = {
        type: ErrorHandler.ErrorTypes.UNKNOWN_ERROR,
        message: '未知错误',
        originalError
      };

      const log = ErrorHandler.formatErrorLog(errorInfo);

      expect(log).toContain('Original: Original error message');
    });

    test('应该包含堆栈跟踪', () => {
      const originalError = new Error('Test error');
      const errorInfo = {
        type: ErrorHandler.ErrorTypes.UNKNOWN_ERROR,
        message: '测试错误',
        originalError
      };

      const log = ErrorHandler.formatErrorLog(errorInfo);

      expect(log).toContain('Stack:');
    });
  });

  describe('边缘情况', () => {
    test('应该处理空字符串消息', () => {
      const error = new Error('');
      const result = ErrorHandler.handleError(error);

      expect(result.message).toBe('发生未知错误，请稍后重试');
    });

    test('应该处理没有message属性的错误对象', () => {
      const error = { status: 500 };
      const result = ErrorHandler.handleAPIError(error);

      expect(result.message).toBe('服务器错误，请稍后重试');
    });

    test('应该处理TimeoutError名称的错误', () => {
      const error = { name: 'TimeoutError', message: 'Timeout' };
      const result = ErrorHandler.handleAPIError(error);

      expect(result.type).toBe(ErrorHandler.ErrorTypes.TIMEOUT);
    });
  });
});
