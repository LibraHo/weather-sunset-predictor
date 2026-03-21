/**
 * IdwInterpolator - 反距离加权（IDW）插值工具
 *
 * 用于将离散散点评分插值为连续栅格数据。
 * 首版参数（可通过 options 覆盖）：
 *   power = 2
 *   maxRadiusKm = 350
 *   minNeighbors = 3
 *
 * 坐标系：WGS-84，简化球面距离（Haversine）。
 */

const EARTH_RADIUS_KM = 6371;

/**
 * 计算两点之间的球面距离（km）
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} 距离（km）
 */
function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

class IdwInterpolator {
  /**
   * @param {Object} [options]
   * @param {number} [options.power=2]         权重指数（越大越局部化）
   * @param {number} [options.maxRadiusKm=350] 最大搜索半径（km）
   * @param {number} [options.minNeighbors=3]  最少邻居数，不足则输出 noData
   */
  constructor(options = {}) {
    this.power = options.power !== undefined ? options.power : 2;
    this.maxRadiusKm = options.maxRadiusKm !== undefined ? options.maxRadiusKm : 350;
    this.minNeighbors = options.minNeighbors !== undefined ? options.minNeighbors : 3;
  }

  /**
   * 对单点进行 IDW 插值
   * @param {number} lat 目标点纬度
   * @param {number} lon 目标点经度
   * @param {{ lat: number, lon: number, score: number }[]} points 样本点数组
   * @returns {number} 插值结果（0~100），如邻居不足返回 -1（noData）
   */
  interpolate(lat, lon, points) {
    let weightedSum = 0;
    let totalWeight = 0;
    let count = 0;

    for (const pt of points) {
      const dist = haversineKm(lat, lon, pt.lat, pt.lon);
      if (dist > this.maxRadiusKm) continue;

      // 如果恰好命中采样点，直接返回原值
      if (dist < 0.001) return pt.score;

      const w = 1 / Math.pow(dist, this.power);
      weightedSum += w * pt.score;
      totalWeight += w;
      count++;
    }

    if (count < this.minNeighbors) return -1; // noData
    return Math.round((weightedSum / totalWeight) * 10) / 10;
  }

  /**
   * 对整个栅格进行 IDW 插值
   * @param {{ lat: number, lon: number, score: number }[]} points 样本点
   * @param {Object} gridDef 栅格定义
   * @param {number} gridDef.west
   * @param {number} gridDef.east
   * @param {number} gridDef.south
   * @param {number} gridDef.north
   * @param {number} gridDef.resolution 格距（度）
   * @returns {{ width: number, height: number, values: number[] }} row-major 一维数组
   */
  interpolateGrid(points, gridDef) {
    const { west, east, south, north, resolution } = gridDef;

    const width = Math.round((east - west) / resolution);
    const height = Math.round((north - south) / resolution);

    const values = new Array(width * height).fill(-1);

    for (let row = 0; row < height; row++) {
      // 从北往南
      const lat = north - (row + 0.5) * resolution;
      for (let col = 0; col < width; col++) {
        const lon = west + (col + 0.5) * resolution;
        values[row * width + col] = this.interpolate(lat, lon, points);
      }
    }

    return { width, height, values };
  }
}

module.exports = { IdwInterpolator, haversineKm };
