/**
 * FireCloudService - 火烧云覆盖层后端服务
 *
 * 封装 Python GFS 处理器调用逻辑，提供缓存和错误处理
 *
 * 需求：20.11, 22 (Phase 6)
 */

const { spawn } = require('child_process');
const fs = require('fs/promises');
const path = require('path');
const CacheService = require('./CacheService.js');
const cacheConfig = require('../config/cacheConfig.js');

class FireCloudService {
  constructor() {
    this.scriptPath = path.join(__dirname, '../scripts/gfs_processor.py');
    this.cacheService = new CacheService({ defaultTTL: cacheConfig.ttl.FIRECLOUD_OVERLAY });
    this.timeout = 60000; // 60秒超时
  }

  /**
   * 生成火烧云覆盖层
   * @param {number} lat - 纬度
   * @param {number} lon - 经度
   * @param {number} radius - 半径（公里）
   * @param {string} type - 预测类型 ('sunrise' | 'sunset')
   * @returns {Promise<Object>} 覆盖层数据 { image, bounds, timestamp }
   */
  async generateOverlay(lat, lon, radius = 200, type = 'sunset') {
    // 检查缓存
    const cacheKey = cacheConfig.buildKey('GFS_OVERLAY', `${lat.toFixed(2)}_${lon.toFixed(2)}_${radius}_${type}`);
    const cachedResult = await this.cacheService.get(cacheKey);

    if (cachedResult) {
      console.log('[FireCloudService] 使用缓存数据');
      return cachedResult;
    }

    // 检查 Python 脚本是否存在
    await this._ensureScriptExists();

    // 调用 Python GFS 处理器
    const result = await this._executePythonProcessor(lat, lon, radius, type);

    // 缓存结果
    await this.cacheService.set(cacheKey, result);
    console.log('[FireCloudService] 结果已缓存');

    return result;
  }

  /**
   * 检查 Python 脚本是否存在
   * @private
   */
  async _ensureScriptExists() {
    try {
      await fs.access(this.scriptPath);
    } catch (error) {
      throw Object.assign(
        new Error('GFS处理脚本未找到，请确认Python环境已配置'),
        { code: 'SCRIPT_NOT_FOUND' }
      );
    }
  }

  /**
   * 执行 Python GFS 处理器
   * @param {number} lat - 纬度
   * @param {number} lon - 经度
   * @param {number} radius - 半径
   * @param {string} type - 类型
   * @returns {Promise<Object>} 处理结果
   * @private
   */
  async _executePythonProcessor(lat, lon, radius, type) {
    return new Promise((resolve, reject) => {
      console.log(`[FireCloudService] 调用 Python 处理器: lat=${lat}, lon=${lon}, radius=${radius}, type=${type}`);

      const pythonProcess = spawn('python3', [
        this.scriptPath,
        '--lat', lat.toString(),
        '--lon', lon.toString(),
        '--radius', radius.toString(),
        '--type', type
      ]);

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // 超时处理
      const timeoutHandle = setTimeout(() => {
        if (!pythonProcess.killed) {
          pythonProcess.kill('SIGTERM');
          reject(Object.assign(
            new Error('GFS数据处理超时（>60秒），请稍后重试'),
            { code: 'TIMEOUT' }
          ));
        }
      }, this.timeout);

      pythonProcess.on('close', async (code) => {
        clearTimeout(timeoutHandle);

        if (code !== 0) {
          console.error(`[FireCloudService] Python 脚本失败，退出码: ${code}`);
          return reject(Object.assign(
            new Error('Python脚本执行失败'),
            { code: 'PYTHON_ERROR', details: stderr }
          ));
        }

        try {
          const metadata = JSON.parse(stdout);

          if (metadata.error) {
            throw new Error(metadata.error);
          }

          // 读取 PNG 文件并转为 base64
          const imageBuffer = await fs.readFile(metadata.image_path);
          const imageBase64 = imageBuffer.toString('base64');
          const imageDataUrl = `data:image/png;base64,${imageBase64}`;

          // 清理临时 PNG 文件
          try {
            await fs.unlink(metadata.image_path);
          } catch (cleanupError) {
            console.warn('[FireCloudService] 清理临时文件失败:', cleanupError.message);
          }

          resolve({
            image: imageDataUrl,
            bounds: metadata.bounds,
            timestamp: metadata.timestamp
          });

        } catch (parseError) {
          reject(Object.assign(
            new Error('无法解析Python脚本输出'),
            { code: 'PARSE_ERROR', details: parseError.message }
          ));
        }
      });

      pythonProcess.on('error', (error) => {
        clearTimeout(timeoutHandle);
        reject(Object.assign(
          new Error(`启动Python进程失败: ${error.message}`),
          { code: 'SPAWN_ERROR' }
        ));
      });
    });
  }

  /**
   * 清除覆盖层缓存
   */
  async clearCache() {
    await this.cacheService.clear();
    console.log('[FireCloudService] 缓存已清除');
  }

  /**
   * 健康检查
   * @returns {Promise<Object>} 健康状态
   */
  async healthCheck() {
    let scriptExists = false;
    try {
      await fs.access(this.scriptPath);
      scriptExists = true;
    } catch (e) {
      // script not found
    }

    return {
      status: scriptExists ? 'ok' : 'degraded',
      scriptExists,
      scriptPath: this.scriptPath,
      cacheSize: this.cacheService.getStats ? this.cacheService.getStats().total : 0,
      timestamp: Date.now()
    };
  }
}

module.exports = FireCloudService;
