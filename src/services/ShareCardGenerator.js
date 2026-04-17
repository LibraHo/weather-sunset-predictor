/**
 * ShareCardGenerator - 分享卡片图片生成器
 * 
 * 使用纯 Canvas API 绘制分享卡片，支持朝霞和晚霞两种配色
 * 尺寸：750x1334 (9:16 竖屏)
 * 
 * 需求：分享功能 - 生成可保存/分享的卡片图片
 */

class ShareCardGenerator {
  constructor() {
    // 卡片尺寸 (9:16 竖屏)
    this.width = 750;
    this.height = 1334;
    
    // 配色方案
    this.themes = {
      sunrise: {
        // 朝霞：暖橙粉渐变背景
        background: {
          top: '#FF9A56',
          middle: '#FF6B8A',
          bottom: '#FFC3A0'
        },
        accent: '#FF6B8A',
        text: '#FFFFFF',
        textSecondary: 'rgba(255, 255, 255, 0.85)',
        gauge: {
          excellent: '#FF6B8A',
          good: '#FFB347',
          fair: '#87CEEB'
        }
      },
      sunset: {
        // 晚霞：深橙红渐变背景
        background: {
          top: '#FF4500',
          middle: '#FF6347',
          bottom: '#FF8C00'
        },
        accent: '#FF4500',
        text: '#FFFFFF',
        textSecondary: 'rgba(255, 255, 255, 0.85)',
        gauge: {
          excellent: '#FF4500',
          good: '#FF8C00',
          fair: '#87CEEB'
        }
      }
    };
  }

  /**
   * 生成分享卡片图片
   * 
   * @param {SunsetPrediction} prediction - 预测对象
   * @param {string} locationName - 地点名称
   * @param {string} period - 时段：'sunrise' 或 'sunset'
   * @returns {Promise<Blob>} PNG 格式的 Blob 对象
   */
  async generateShareCard(prediction, locationName, period) {
    const canvas = this._createCanvas();
    const ctx = canvas.getContext('2d');
    
    // 确定主题
    const theme = period === 'sunrise' ? this.themes.sunrise : this.themes.sunset;
    const typeLabel = period === 'sunrise' ? '朝霞' : '晚霞';
    
    // 绘制背景
    this._drawBackground(ctx, theme);
    
    // 绘制顶部品牌区域
    this._drawHeader(ctx, theme);
    
    // 绘制环形仪表盘
    this._drawGauge(ctx, prediction.score, prediction.getQualityLabel(), theme);
    
    // 绘制地点、日期、时段信息
    this._drawLocationInfo(ctx, locationName, prediction.date, typeLabel, theme);
    
    // 绘制云层分析摘要
    this._drawCloudSummary(ctx, prediction.cloudLayers, theme);
    
    // 绘制底部水印
    this._drawFooter(ctx, theme);
    
    // 转换为 Blob
    return this._canvasToBlob(canvas);
  }

  /**
   * 创建 Canvas 元素
   * @private
   */
  _createCanvas() {
    if (typeof document !== 'undefined') {
      // 浏览器环境
      const canvas = document.createElement('canvas');
      canvas.width = this.width;
      canvas.height = this.height;
      return canvas;
    } else {
      // Node.js 环境（需要 node-canvas 等库支持）
      throw new Error('Canvas not available in current environment');
    }
  }

  /**
   * 绘制渐变背景
   * @private
   */
  _drawBackground(ctx, theme) {
    const { width, height } = this;
    
    // 创建三色渐变
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, theme.background.top);
    gradient.addColorStop(0.5, theme.background.middle);
    gradient.addColorStop(1, theme.background.bottom);
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // 添加装饰性圆形光晕
    this._drawDecorativeGlows(ctx, theme);
  }

  /**
   * 绘制装饰性光晕
   * @private
   */
  _drawDecorativeGlows(ctx, theme) {
    // 左上角光晕
    const glow1 = ctx.createRadialGradient(0, 0, 0, 100, 100, 300);
    glow1.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    glow1.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glow1;
    ctx.fillRect(0, 0, this.width, this.height);
    
    // 右下角光晕
    const glow2 = ctx.createRadialGradient(
      this.width, this.height, 0,
      this.width - 100, this.height - 100, 250
    );
    glow2.addColorStop(0, 'rgba(255, 200, 150, 0.2)');
    glow2.addColorStop(1, 'rgba(255, 200, 150, 0)');
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  /**
   * 绘制顶部品牌区域
   * @private
   */
  _drawHeader(ctx, theme) {
    const centerX = this.width / 2;
    const startY = 80;
    
    // 品牌图标（简化版太阳）
    ctx.save();
    ctx.translate(centerX, startY + 30);
    
    // 绘制太阳
    ctx.beginPath();
    ctx.arc(0, 0, 25, 0, Math.PI * 2);
    ctx.fillStyle = theme.text;
    ctx.fill();
    
    // 太阳光芒
    ctx.strokeStyle = theme.text;
    ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 35, Math.sin(angle) * 35);
      ctx.lineTo(Math.cos(angle) * 45, Math.sin(angle) * 45);
      ctx.stroke();
    }
    ctx.restore();
    
    // 品牌名称
    ctx.fillStyle = theme.text;
    ctx.font = 'bold 36px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('霞客 Sunset Voyager', centerX, startY + 100);
    
    // 副标题
    ctx.fillStyle = theme.textSecondary;
    ctx.font = '24px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText('捕捉天空最美的瞬间', centerX, startY + 140);
  }

  /**
   * 绘制环形仪表盘
   * @private
   */
  _drawGauge(ctx, score, qualityLabel, theme) {
    const centerX = this.width / 2;
    const centerY = 450;
    const radius = 140;
    const lineWidth = 20;
    
    // 确定颜色
    let color = theme.gauge.fair;
    if (score >= 70) {
      color = theme.gauge.excellent;
    } else if (score >= 40) {
      color = theme.gauge.good;
    }
    
    // 绘制背景圆环
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    
    // 绘制进度圆环
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + (Math.PI * 2 * score / 100);
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();
    
    // 绘制分数
    ctx.fillStyle = theme.text;
    ctx.font = 'bold 72px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(score.toString(), centerX, centerY - 10);
    
    // 绘制"分"字
    ctx.font = '24px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText('分', centerX + 50, centerY + 10);
    
    // 绘制质量等级
    ctx.font = 'bold 32px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = color;
    ctx.fillText(qualityLabel, centerX, centerY + 60);
  }

  /**
   * 绘制地点、日期、时段信息
   * @private
   */
  _drawLocationInfo(ctx, locationName, date, typeLabel, theme) {
    const centerX = this.width / 2;
    const startY = 680;
    
    // 地点名称
    ctx.fillStyle = theme.text;
    ctx.font = 'bold 48px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(locationName, centerX, startY);
    
    // 日期格式化
    const dateStr = this._formatDate(date);
    
    // 日期和时段
    ctx.fillStyle = theme.textSecondary;
    ctx.font = '28px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(`${dateStr} · ${typeLabel}`, centerX, startY + 50);
  }

  /**
   * 绘制云层分析摘要
   * @private
   */
  _drawCloudSummary(ctx, cloudLayers, theme) {
    const centerX = this.width / 2;
    const startY = 820;
    const maxWidth = 600;
    
    // 摘要卡片背景
    const cardHeight = 120;
    const cardY = startY - 30;
    
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.roundRect(centerX - maxWidth / 2, cardY, maxWidth, cardHeight, 20);
    ctx.fill();
    ctx.restore();
    
    // 标题
    ctx.fillStyle = theme.text;
    ctx.font = 'bold 24px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('云层分析', centerX, startY + 20);
    
    // 摘要内容
    let summary = this._generateCloudSummary(cloudLayers);
    
    ctx.fillStyle = theme.textSecondary;
    ctx.font = '22px "PingFang SC", "Microsoft YaHei", sans-serif';
    
    // 自动换行
    this._wrapText(ctx, summary, centerX, startY + 60, maxWidth - 60, 32);
  }

  /**
   * 生成云层分析摘要文字
   * @private
   */
  _generateCloudSummary(cloudLayers) {
    if (!cloudLayers || !cloudLayers.description) {
      return '云层条件适中，可能出现火烧云效果';
    }
    
    // 优先使用 description，否则根据云层数据生成
    if (cloudLayers.description.length <= 30) {
      return cloudLayers.description;
    }
    
    // 截断过长的描述
    return cloudLayers.description.substring(0, 28) + '...';
  }

  /**
   * 绘制底部水印
   * @private
   */
  _drawFooter(ctx, theme) {
    const centerX = this.width / 2;
    const footerY = this.height - 60;
    
    // 分隔线
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(100, footerY - 30);
    ctx.lineTo(this.width - 100, footerY - 30);
    ctx.stroke();
    
    // 品牌水印
    ctx.fillStyle = theme.textSecondary;
    ctx.font = '20px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('sunset.bjhyc.online', centerX, footerY);
    
    // 小图标
    ctx.font = '16px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText('🌅 霞客 · 记录每一次绚丽', centerX, footerY + 25);
  }

  /**
   * 格式化日期
   * @private
   */
  _formatDate(date) {
    if (!date) return '日期未知';
    
    const d = date instanceof Date ? date : new Date(date);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const weekDay = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
    
    return `${year}年${month}月${day}日 ${weekDay}`;
  }

  /**
   * 文本自动换行
   * @private
   */
  _wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const chars = text.split('');
    let line = '';
    let testLine = '';
    let lineArray = [];
    
    for (let n = 0; n < chars.length; n++) {
      testLine += chars[n];
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      
      if (testWidth > maxWidth && n > 0) {
        lineArray.push(line);
        line = chars[n];
        testLine = chars[n];
      } else {
        line = testLine;
      }
    }
    lineArray.push(line);
    
    // 最多显示两行
    const displayLines = lineArray.slice(0, 2);
    for (let k = 0; k < displayLines.length; k++) {
      ctx.fillText(displayLines[k], x, y + k * lineHeight);
    }
  }

  /**
   * 将 Canvas 转换为 PNG Blob
   * @private
   */
  _canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
      if (canvas.toBlob) {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas toBlob failed'));
          }
        }, 'image/png');
      } else {
        // 降级方案：使用 data URL 转换
        try {
          const dataURL = canvas.toDataURL('image/png');
          const byteString = atob(dataURL.split(',')[1]);
          const mimeString = dataURL.split(',')[0].split(':')[1].split(';')[0];
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
          }
          
          const blob = new Blob([ab], { type: mimeString });
          resolve(blob);
        } catch (error) {
          reject(error);
        }
      }
    });
  }
}

// 导出单例实例
const shareCardGenerator = new ShareCardGenerator();

/**
 * 生成分享卡片图片
 * 
 * @param {SunsetPrediction} prediction - 预测对象
 * @param {string} locationName - 地点名称
 * @param {string} period - 时段：'sunrise' 或 'sunset'
 * @returns {Promise<Blob>} PNG 格式的 Blob 对象
 */
export function generateShareCard(prediction, locationName, period) {
  return shareCardGenerator.generateShareCard(prediction, locationName, period);
}

export default ShareCardGenerator;
