/**
 * logger - 轻量级日志工具
 *
 * 根据 LOG_LEVEL 环境变量或 NODE_ENV 控制日志输出级别，
 * 避免生产环境产生大量调试日志。
 *
 * 日志级别（由低到高）：debug < info < warn < error < silent
 *
 * 配置方式：
 *   LOG_LEVEL=debug   # 输出所有日志
 *   LOG_LEVEL=info    # 默认（production 时为 warn）
 *   LOG_LEVEL=warn    # 只输出 warn/error
 *   LOG_LEVEL=error   # 只输出 error
 *   LOG_LEVEL=silent  # 关闭所有日志
 *
 * @module server/utils/logger
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 };

function resolveLevel() {
  const envLevel = (process.env.LOG_LEVEL || '').toLowerCase();
  if (LEVELS[envLevel] !== undefined) return envLevel;
  // 生产环境默认 warn，开发环境默认 info
  return process.env.NODE_ENV === 'production' ? 'warn' : 'info';
}

let currentLevelName = resolveLevel();
let currentLevel = LEVELS[currentLevelName];

const logger = {
  /**
   * 动态修改日志级别（主要用于测试）
   * @param {string} level - 'debug' | 'info' | 'warn' | 'error' | 'silent'
   */
  setLevel(level) {
    if (LEVELS[level] === undefined) throw new Error(`未知日志级别: ${level}`);
    currentLevelName = level;
    currentLevel = LEVELS[level];
  },

  getLevel() {
    return currentLevelName;
  },

  /**
   * @param {string} prefix - 服务名前缀，例如 '[EnhancedPredictionService]'
   * @param {...any} args
   */
  debug(prefix, ...args) {
    if (currentLevel <= LEVELS.debug) {
      console.debug(`[DEBUG] ${prefix}`, ...args);
    }
  },

  info(prefix, ...args) {
    if (currentLevel <= LEVELS.info) {
      console.log(`[INFO] ${prefix}`, ...args);
    }
  },

  warn(prefix, ...args) {
    if (currentLevel <= LEVELS.warn) {
      console.warn(`[WARN] ${prefix}`, ...args);
    }
  },

  error(prefix, ...args) {
    if (currentLevel <= LEVELS.error) {
      console.error(`[ERROR] ${prefix}`, ...args);
    }
  }
};

module.exports = logger;
