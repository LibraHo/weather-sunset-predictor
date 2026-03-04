/**
 * RadarChartService - 雷达图渲染服务
 *
 * 使用Canvas渲染周边火烧云雷达图
 * 需求：19.2, 19.4, 19.5, 19.11, 19.12
 */

class RadarChartService {
  constructor() {
    // 颜色配置
    this.colors = {
      excellent: '#4caf50', // 绿色 - 优秀
      good: '#ffc107',       // 黄色 - 良好
      fair: '#9e9e9e',       // 灰色 - 一般
      poor: '#f44336',       // 红色 - 较差
      grid: '#e0e0e0',       // 网格线颜色
      text: '#333333',       // 文本颜色
      background: '#ffffff'  // 背景颜色
    };

    // 暗色主题颜色
    this.darkColors = {
      excellent: '#66bb6a',
      good: '#ffb74d',
      fair: '#bdbdbd',
      poor: '#ef5350',
      grid: '#333333',
      text: '#e0e0e0',
      background: '#1e1e1e'
    };
  }

  /**
   * 获取当前主题颜色
   * @returns {Object} 颜色配置
   * @private
   */
  _getColors() {
    const isDark = document.body.classList.contains('theme-dark');
    return isDark ? this.darkColors : this.colors;
  }

  /**
   * 渲染雷达图
   * @param {string} containerId - 容器ID
   * @param {Object[]} points - 周边点数据数组
   * @param {Object} options - 配置选项
   * @returns {boolean} 是否渲染成功
   *
   * 需求：19.2, 19.4, 19.5, 19.8
   */
  renderRadarChart(containerId, points, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error('[RadarChartService] 容器不存在:', containerId);
      return false;
    }

    // 检查Canvas支持
    const canvas = document.createElement('canvas');
    const supportsCanvas = !!canvas.getContext;
    if (!supportsCanvas) {
      console.warn('[RadarChartService] Canvas不支持，使用降级UI');
      this._renderFallbackUI(container, points);
      return false;
    }

    // 合并选项
    const config = {
      width: options.width || 400,
      height: options.height || 400,
      centerX: options.width ? options.width / 2 : 200,
      centerY: options.height ? options.height / 2 : 200,
      radius: options.radius || 150,
      showLabels: options.showLabels !== false,
      showScores: options.showScores !== false,
      showDistance: options.showDistance !== false,
      onClick: options.onClick || null,
      ...options
    };

    // 设置canvas尺寸
    canvas.width = config.width;
    canvas.height = config.height;
    canvas.style.width = '100%';
    canvas.style.maxWidth = `${config.width}px`;
    canvas.style.height = 'auto';
    canvas.style.cursor = config.onClick ? 'pointer' : 'default';

    // 清空容器
    container.innerHTML = '';
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    const colors = this._getColors();

    // 绘制背景
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, config.width, config.height);

    // 绘制雷达图
    this._drawGrid(ctx, config, colors);
    this._drawData(ctx, points, config, colors);
    this._drawLabels(ctx, points, config, colors);

    // 添加点击事件
    if (config.onClick) {
      this._attachClickHandler(canvas, points, config, config.onClick);
    }

    console.log('[RadarChartService] 雷达图渲染完成');
    return true;
  }

  /**
   * 绘制网格
   * @param {CanvasRenderingContext2D} ctx - Canvas上下文
   * @param {Object} config - 配置
   * @param {Object} colors - 颜色
   * @private
   */
  _drawGrid(ctx, config, colors) {
    const { centerX, centerY, radius } = config;

    // 绘制同心圆（25%, 50%, 75%, 100%）
    const levels = [0.25, 0.5, 0.75, 1];
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;

    levels.forEach(level => {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * level, 0, Math.PI * 2);
      ctx.stroke();
    });

    // 绘制8条轴线
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    directions.forEach((dir, index) => {
      const angle = (index * Math.PI * 2) / 8 - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.stroke();
    });

    // 绘制评分标签
    ctx.fillStyle = colors.text;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    [0.25, 0.5, 0.75, 1].forEach(level => {
      const score = Math.round(level * 100);
      const x = centerX + 10;
      const y = centerY - (radius * level) + 10;
      ctx.fillText(score.toString(), x, y);
    });
  }

  /**
   * 绘制数据
   * @param {CanvasRenderingContext2D} ctx - Canvas上下文
   * @param {Object[]} points - 点数据
   * @param {Object} config - 配置
   * @param {Object} colors - 颜色
   * @private
   */
  _drawData(ctx, points, config, colors) {
    const { centerX, centerY, radius } = config;

    // 绘制填充区域
    ctx.beginPath();
    points.forEach((point, index) => {
      const angle = (index * Math.PI * 2) / 8 - Math.PI / 2;
      const scoreRatio = point.score / 100;
      const x = centerX + Math.cos(angle) * radius * scoreRatio;
      const y = centerY + Math.sin(angle) * radius * scoreRatio;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.closePath();

    // 填充半透明颜色
    ctx.fillStyle = 'rgba(76, 175, 80, 0.3)';
    ctx.fill();

    // 绘制边框线
    ctx.strokeStyle = colors.excellent;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 绘制数据点
    points.forEach((point, index) => {
      const angle = (index * Math.PI * 2) / 8 - Math.PI / 2;
      const scoreRatio = point.score / 100;
      const x = centerX + Math.cos(angle) * radius * scoreRatio;
      const y = centerY + Math.sin(angle) * radius * scoreRatio;

      // 根据评分选择颜色
      let pointColor;
      if (point.score >= 80) {
        pointColor = colors.excellent;
      } else if (point.score >= 60) {
        pointColor = colors.good;
      } else if (point.score >= 40) {
        pointColor = colors.fair;
      } else {
        pointColor = colors.poor;
      }

      // 绘制点
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = pointColor;
      ctx.fill();
      ctx.strokeStyle = colors.background;
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }

  /**
   * 绘制标签
   * @param {CanvasRenderingContext2D} ctx - Canvas上下文
   * @param {Object[]} points - 点数据
   * @param {Object} config - 配置
   * @param {Object} colors - 颜色
   * @private
   */
  _drawLabels(ctx, points, config, colors) {
    const { centerX, centerY, radius } = config;

    ctx.fillStyle = colors.text;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    points.forEach((point, index) => {
      const angle = (index * Math.PI * 2) / 8 - Math.PI / 2;
      const labelRadius = radius + 25;
      const x = centerX + Math.cos(angle) * labelRadius;
      const y = centerY + Math.sin(angle) * labelRadius;

      // 绘制方位标签
      ctx.fillText(point.label, x, y);

      // 绘制距离
      if (config.showDistance) {
        ctx.font = '11px sans-serif';
        const distRadius = radius + 40;
        const distX = centerX + Math.cos(angle) * distRadius;
        const distY = centerY + Math.sin(angle) * distRadius;
        ctx.fillText(`${point.distance}km`, distX, distY);
        ctx.font = 'bold 14px sans-serif';
      }

      // 绘制评分
      if (config.showScores) {
        const scoreRadius = radius * (point.score / 100);
        if (scoreRadius > 20) {
          const scoreX = centerX + Math.cos(angle) * scoreRadius - 15;
          const scoreY = centerY + Math.sin(angle) * scoreRadius - 15;
          ctx.font = 'bold 12px sans-serif';
          ctx.fillStyle = colors.background;
          ctx.fillText(point.score.toString(), scoreX, scoreY);
          ctx.fillStyle = colors.text;
        }
      }
    });
  }

  /**
   * 附加点击处理器
   * @param {HTMLCanvasElement} canvas - Canvas元素
   * @param {Object[]} points - 点数据
   * @param {Object} config - 配置
   * @param {Function} onClick - 点击回调
   * @private
   */
  _attachClickHandler(canvas, points, config, onClick) {
    canvas.addEventListener('click', (event) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (event.clientX - rect.left) * scaleX;
      const y = (event.clientY - rect.top) * scaleY;

      const { centerX, centerY, radius } = config;

      // 检查点击是否在某个方向附近
      points.forEach((point, index) => {
        const angle = (index * Math.PI * 2) / 8 - Math.PI / 2;
        const pointX = centerX + Math.cos(angle) * radius * (point.score / 100);
        const pointY = centerY + Math.sin(angle) * radius * (point.score / 100);

        const distance = Math.sqrt(Math.pow(x - pointX, 2) + Math.pow(y - pointY, 2));

        // 点击容差20像素
        if (distance < 20) {
          onClick(point, index);
        }
      });
    });
  }

  /**
   * 渲染降级UI（当Canvas不支持时）
   * @param {HTMLElement} container - 容器元素
   * @param {Object[]} points - 点数据
   * @private
   */
  _renderFallbackUI(container, points) {
    const table = document.createElement('table');
    table.style.cssText = 'width: 100%; border-collapse: collapse;';

    table.innerHTML = `
      <thead>
        <tr style="background: #f5f5f5;">
          <th style="padding: 8px; border: 1px solid #ddd;">方位</th>
          <th style="padding: 8px; border: 1px solid #ddd;">距离</th>
          <th style="padding: 8px; border: 1px solid #ddd;">评分</th>
          <th style="padding: 8px; border: 1px solid #ddd;">状态</th>
        </tr>
      </thead>
      <tbody>
        ${points.map(point => {
          let statusClass = '';
          let statusText = '';
          if (point.score >= 80) {
            statusClass = 'color: #4caf50;';
            statusText = '优秀';
          } else if (point.score >= 60) {
            statusClass = 'color: #ffc107;';
            statusText = '良好';
          } else if (point.score >= 40) {
            statusClass = 'color: #9e9e9e;';
            statusText = '一般';
          } else {
            statusClass = 'color: #f44336;';
            statusText = '较差';
          }

          return `
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;">${point.name} (${point.label})</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${point.distance}km</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${point.score}分</td>
              <td style="padding: 8px; border: 1px solid #ddd; ${statusClass}">${statusText}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    `;

    container.appendChild(table);
    console.log('[RadarChartService] 降级UI渲染完成');
  }

  /**
   * 销毁雷达图
   * @param {string} containerId - 容器ID
   */
  destroy(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = '';
    }
  }
}

export default RadarChartService;
