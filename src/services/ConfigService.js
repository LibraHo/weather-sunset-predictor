/**
 * ConfigService - 配置文件服务
 *
 * 从本地配置文件（config.json）读取应用配置
 * 优先级：config.json > localStorage
 *
 * 需求：支持从配置文件读取API密钥，避免每次都要重新输入
 */
class ConfigService {
  constructor() {
    this.config = null;
    this.configFilePath = 'config.json';
  }

  /**
   * 加载配置文件
   * @returns {Promise<Object|null>} 配置对象，如果文件不存在则返回null
   */
  async loadConfig() {
    try {
      console.log('[ConfigService] 尝试加载配置文件:', this.configFilePath);

      const response = await fetch(this.configFilePath);

      if (!response.ok) {
        console.log('[ConfigService] 配置文件不存在或无法访问');
        return null;
      }

      this.config = await response.json();
      console.log('[ConfigService] 配置文件加载成功:', this.config);
      return this.config;

    } catch (error) {
      console.log('[ConfigService] 加载配置文件失败:', error.message);
      return null;
    }
  }

  /**
   * 从配置获取API密钥
   * @returns {string|null} API密钥，如果未配置则返回null
   */
  getAPIKey() {
    if (this.config && this.config.apiKey) {
      console.log('[ConfigService] 从配置文件读取API密钥');
      return this.config.apiKey;
    }
    return null;
  }

  /**
   * 检查配置文件是否存在
   * @returns {boolean} 配置文件是否存在
   */
  hasConfigFile() {
    return this.config !== null;
  }

  /**
   * 获取配置对象
   * @returns {Object|null} 配置对象
   */
  getConfig() {
    return this.config;
  }

  /**
   * 获取使用Mock API的配置
   * @returns {boolean|null} 是否使用Mock API，如果未配置则返回null
   */
  getUseMockAPI() {
    if (this.config && typeof this.config.useMockAPI !== 'undefined') {
      return this.config.useMockAPI;
    }
    return null;
  }
}

export default ConfigService;
