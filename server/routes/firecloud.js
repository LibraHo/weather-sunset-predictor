/**
 * FireCloud API路由
 *
 * 提供火烧云地图覆盖层API端点
 * 调用Python脚本处理GFS数据并生成PNG覆盖层
 */

import express from 'express';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

/**
 * GET /api/firecloud/overlay
 *
 * 获取火烧云地图覆盖层
 *
 * 查询参数：
 * - lat: 纬度（必需）
 * - lon: 经度（必需）
 * - radius: 半径，单位km（可选，默认200）
 * - type: 预测类型（可选，默认sunset，可选sunrise）
 *
 * 返回：
 * {
 *   image: "data:image/png;base64,...",
 *   bounds: {
 *     north: number,
 *     south: number,
 *     east: number,
 *     west: number
 *   },
 *   timestamp: number
 * }
 */
router.get('/overlay', async (req, res) => {
  const { lat, lon, radius = 200, type = 'sunset' } = req.query;

  // 参数验证
  if (!lat || !lon) {
    return res.status(400).json({
      error: '缺少必需参数',
      message: 'lat和lon参数是必需的'
    });
  }

  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);
  const radiusNum = parseInt(radius);

  // 验证坐标范围
  if (isNaN(latNum) || latNum < -90 || latNum > 90) {
    return res.status(400).json({
      error: '无效的纬度',
      message: '纬度必须在-90到90之间'
    });
  }

  if (isNaN(lonNum) || lonNum < -180 || lonNum > 180) {
    return res.status(400).json({
      error: '无效的经度',
      message: '经度必须在-180到180之间'
    });
  }

  // 验证半径
  if (isNaN(radiusNum) || radiusNum < 50 || radiusNum > 500) {
    return res.status(400).json({
      error: '无效的半径',
      message: '半径必须在50到500公里之间'
    });
  }

  // 验证预测类型
  if (type !== 'sunrise' && type !== 'sunset') {
    return res.status(400).json({
      error: '无效的预测类型',
      message: 'type必须是sunrise或sunset'
    });
  }

  console.log(`[FireCloud API] 处理请求: lat=${latNum}, lon=${lonNum}, radius=${radiusNum}km, type=${type}`);

  try {
    // 构造Python脚本路径
    const scriptPath = path.join(__dirname, '../scripts/gfs_processor.py');

    // 检查脚本是否存在
    try {
      await fs.access(scriptPath);
    } catch (error) {
      console.error('[FireCloud API] Python脚本不存在:', scriptPath);
      return res.status(500).json({
        error: '服务未配置',
        message: 'GFS处理脚本未找到，请确认Python环境已配置'
      });
    }

    // 调用Python脚本
    const pythonProcess = spawn('python', [
      scriptPath,
      '--lat', latNum.toString(),
      '--lon', lonNum.toString(),
      '--radius', radiusNum.toString(),
      '--type', type
    ]);

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error('[Python stderr]:', data.toString());
    });

    pythonProcess.on('close', async (code) => {
      if (code !== 0) {
        console.error(`[FireCloud API] Python脚本失败，退出码: ${code}`);
        console.error(`[FireCloud API] stderr: ${stderr}`);

        return res.status(500).json({
          error: '数据处理失败',
          message: 'Python脚本执行失败',
          details: stderr
        });
      }

      try {
        // 解析stdout（JSON格式）
        const metadata = JSON.parse(stdout);

        // 检查是否有错误
        if (metadata.error) {
          throw new Error(metadata.error);
        }

        console.log('[FireCloud API] Python脚本成功，metadata:', metadata);

        // 读取PNG文件
        const imageBuffer = await fs.readFile(metadata.image_path);

        // 转换为base64
        const imageBase64 = imageBuffer.toString('base64');
        const imageDataUrl = `data:image/png;base64,${imageBase64}`;

        // 清理临时PNG文件
        try {
          await fs.unlink(metadata.image_path);
          console.log('[FireCloud API] 临时文件已清理:', metadata.image_path);
        } catch (cleanupError) {
          console.warn('[FireCloud API] 清理临时文件失败:', cleanupError);
        }

        // 返回结果
        res.json({
          image: imageDataUrl,
          bounds: metadata.bounds,
          timestamp: metadata.timestamp
        });

        console.log('[FireCloud API] 请求处理完成');

      } catch (parseError) {
        console.error('[FireCloud API] 解析Python输出失败:', parseError);
        console.error('[FireCloud API] stdout:', stdout);

        return res.status(500).json({
          error: '数据处理失败',
          message: '无法解析Python脚本输出',
          details: parseError.message
        });
      }
    });

    // 设置超时（60秒）
    setTimeout(() => {
      if (!pythonProcess.killed) {
        console.error('[FireCloud API] Python脚本超时，终止进程');
        pythonProcess.kill('SIGTERM');

        return res.status(500).json({
          error: '请求超时',
          message: 'GFS数据处理超时（>60秒），请稍后重试'
        });
      }
    }, 60000);

  } catch (error) {
    console.error('[FireCloud API] 服务器错误:', error);

    return res.status(500).json({
      error: '内部服务器错误',
      message: error.message
    });
  }
});

/**
 * GET /api/firecloud/health
 *
 * 健康检查端点
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'firecloud',
    timestamp: Date.now()
  });
});

export default router;
