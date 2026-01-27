/**
 * 请求日志中间件
 * 记录请求时间、参数、响应状态，不记录敏感信息
 */

const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // 记录请求信息
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);

  // 记录查询参数（不包含敏感信息）
  if (Object.keys(req.query).length > 0) {
    const safeQuery = { ...req.query };
    // 移除可能存在的敏感参数
    delete safeQuery.api_key;
    delete safeQuery.key;
    console.log('查询参数:', JSON.stringify(safeQuery));
  }

  // 监听响应完成事件
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const status = res.statusCode;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - 状态: ${status} - 耗时: ${duration}ms`);
  });

  next();
};

module.exports = { requestLogger };
