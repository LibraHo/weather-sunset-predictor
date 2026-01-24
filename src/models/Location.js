/**
 * Location类 - 表示地理位置
 * 
 * 包含纬度、经度和位置名称，并提供坐标验证功能
 * 
 * 需求：2.2 - 位置选择功能
 */
class Location {
  /**
   * 创建Location实例
   * @param {number} lat - 纬度 (-90 到 90)
   * @param {number} lon - 经度 (-180 到 180)
   * @param {string} name - 位置名称
   */
  constructor(lat, lon, name) {
    this.lat = lat;
    this.lon = lon;
    this.name = name;
  }

  /**
   * 验证坐标是否在有效范围内
   * @returns {boolean} 如果坐标有效返回true，否则返回false
   */
  isValid() {
    return (
      this.lat >= -90 &&
      this.lat <= 90 &&
      this.lon >= -180 &&
      this.lon <= 180
    );
  }
}

// 导出供其他模块使用
export default Location;
