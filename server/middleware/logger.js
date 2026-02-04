/**
 * 请求日志中间件（增强版）
 *
 * 记录API请求的详细信息，包括参数、响应时间、错误信息
 * 支持性能监控和调试
 *
 * 需求：22 (前后端分离 - Phase 4)
 */

/**
 * 请求日志中间件
 *
 * @param {Object} options - 配置选项
 * @param {boolean} options.enableTiming - 是否记录响应时间，默认true
 * @param {boolean} options.enableBody - 是否记录请求体，默认false
 * @param {number} options.slowRequestThreshold - 慢请求阈值（毫秒），默认1000ms
 * @returns {Function} Express中间件函数
 */
function requestLogger(options = {}) {
  const {
    enableTiming = true,
    enableBody = false,
    slowRequestThreshold = 1000
  } = options;

  return (req, res, next) => {
    // 记录请求开始时间
    const startTime = Date.now();

    // 生成请求ID
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // 将请求ID添加到请求对象
    req.requestId = requestId;

    // 记录请求开始
    const logData = {
      requestId,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      timestamp: new Date().toISOString()
    };

    // 记录查询参数（过滤敏感信息）
    if (Object.keys(req.query).length > 0) {
      const safeQuery = { ...req.query };
      delete safeQuery.api_key;
      delete safeQuery.key;
      delete safeQuery.password;
      logData.query = safeQuery;
    }

    // 记录请求体（可选）
    if (enableBody && req.body && Object.keys(req.body).length > 0) {
      const sanitizedBody = { ...req.body };
      const sensitiveFields = ['password', 'apiKey', 'api_key', 'token', 'key'];

      sensitiveFields.forEach(field => {
        if (sanitizedBody[field]) {
          sanitizedBody[field] = '***FILTERED***';
        }
      });

      logData.body = sanitizedBody;
    }

    console.log(`[Request START] ${req.method} ${req.originalUrl}`, JSON.stringify(logData));

    // 监听响应完成事件
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const responseLog = {
        requestId,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      };

      // 判断是否为慢请求
      if (duration > slowRequestThreshold) {
        responseLog.slowRequest = true;
        console.warn(`[Request SLOW] ${req.method} ${req.originalUrl} - ${duration}ms`, JSON.stringify(responseLog));
      } else {
        console.log(`[Request END] ${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`, JSON.stringify(responseLog));
      }
    });

    next();
  };
}

/**
 * 错误日志中间件
 * 记录错误堆栈和相关信息
 */
function errorLogger() {
  return (err, req, res, next) => {
    const errorLog = {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      errorName: err.name,
      errorMessage: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    };

    console.error(`[Request ERROR] ${req.method} ${req.originalUrl}`, JSON.stringify(errorLog));

    // 继续传递错误
    next(err);
  };
}

module.exports = {
  requestLogger,
  errorLogger
};
