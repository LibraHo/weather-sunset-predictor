/**
 * IDWInterpolator - 反距离加权插值工具
 *
 * 将离散评分点插值为连续栅格
 * 使用反距离加权（Inverse Distance Weighting）算法
 */

class IDWInterpolator {
  constructor(options = {}) {
    this.power = options.power || 2; // 幂次，默认 2
    this.maxRadiusKm = options.maxRadiusKm || 350; // 最大搜索半径（公里）
    this.minNeighbors = options.minNeighbors || 3; // 最少邻居数
  }

  /**
   * 计算两点之间的 Haversine 距离（公里）
   * @param {number} lat1, lon1 - 第一个点的经纬度
   * @param {number} lat2, lon2 - 第二个点的经纬度
   * @returns {number} 距离（公里）
   */
  _haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // 地球半径（公里）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * 将经纬度转换为网格坐标
   * @param {number} lat, lon - 经纬度
   * @param {Object} bbox - 边界框 { west, south, east, north }
   * @param {number} resolution - 分辨率（度）
   * @returns {{ x: number, y: number }}
   */
  _latLonToGrid(lat, lon, bbox, resolution) {
    const x = Math.floor((lon - bbox.west) / resolution);
    const y = Math.floor((bbox.north - lat) / resolution);
    return { x, y };
  }

  /**
   * 对单个栅格点进行 IDW 插值
   * @param {number} targetLat, targetLon - 目标点经纬度
   * @param {Array<{ lat, lon, score }>} points - 参考点数组
   * @returns {{ value: number, neighbors: number }}
   */
  _interpolateSingle(targetLat, targetLon, points) {
    let weightedSum = 0;
    let weightSum = 0;
    let neighbors = 0;

    for (const point of points) {
      const distance = this._haversineDistance(targetLat, targetLon, point.lat, point.lon);

      // 超出最大搜索半径，跳过
      if (distance > this.maxRadiusKm) {
        continue;
      }

      // 避免除以零（距离为 0 时直接返回该点值）
      if (distance < 0.01) {
        return { value: point.score, neighbors: 1 };
      }

      const weight = 1 / Math.pow(distance, this.power);
      weightedSum += weight * point.score;
      weightSum += weight;
      neighbors++;
    }

    // 邻居不足，返回 null
    if (neighbors < this.minNeighbors) {
      return { value: null, neighbors };
    }

    // 计算加权平均值
    const interpolatedValue = weightedSum / weightSum;

    return {
      value: Math.round(interpolatedValue),
      neighbors
    };
  }

  /**
   * 将离散点插值为栅格矩阵
   * @param {Array<{ lat, lon, score }>} points - 离散点数组
   * @param {Object} bbox - 边界框 { west, south, east, north }
   * @param {number} resolution - 分辨率（度）
   * @param {Object} options - 可选参数
   * @returns {{ width, height, values, meta }}
   */
  interpolate(points, bbox, resolution, options = {}) {
    const {
      noDataValue = -1,
      progressCallback = null
    } = options;

    // 计算栅格尺寸
    const width = Math.ceil((bbox.east - bbox.west) / resolution);
    const height = Math.ceil((bbox.north - bbox.south) / resolution);

    // 初始化值数组（row-major，一维数组）
    const values = new Array(width * height).fill(noDataValue);

    // 过滤有效的评分点（score 必须是有效数字）
    const validPoints = points.filter(p => typeof p.score === 'number' && !isNaN(p.score) && p.score !== null);

    console.log(`[IDWInterpolator] 开始插值：${validPoints.length} 个有效点 → ${width}x${height} 栅格`);

    // 对每个栅格点进行插值
    let processed = 0;
    const total = width * height;

    for (let y = 0; y < height; y++) {
      const lat = bbox.north - (y + 0.5) * resolution;

      for (let x = 0; x < width; x++) {
        const lon = bbox.west + (x + 0.5) * resolution;

        const { value, neighbors } = this._interpolateSingle(lat, lon, validPoints);

        if (value !== null && value >= 0) {
          // 将值限制在 0-100 范围内
          const clampedValue = Math.max(0, Math.min(100, value));
          values[y * width + x] = clampedValue;
        }

        processed++;

        // 进度回调
        if (progressCallback && processed % 100 === 0) {
          progressCallback(processed / total);
        }
      }
    }

    console.log(`[IDWInterpolator] 插值完成：${width}x${height} 栅格`);

    return {
      width,
      height,
      values,
      meta: {
        algorithm: 'IDW',
        power: this.power,
        maxRadiusKm: this.maxRadiusKm,
        minNeighbors: this.minNeighbors,
        resolution,
        sourcePoints: validPoints.length
      }
    };
  }
}

module.exports = IDWInterpolator;
