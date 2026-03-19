/**
 * mainlandChinaRegion - 中国大陆区域判断（前端可复用）
 *
 * 目标：
 * - 聚焦中国大陆连续陆地区域（暂不覆盖南海远海点位）
 * - 用于前端地图展示过滤，避免“全国矩形框”带来的海上噪点
 */

const MAINLAND_BOUNDS = {
  lonMin: 73,
  lonMax: 135,
  latMin: 20,
  latMax: 54
};

const EXCLUSION_ZONES = [
  // 台湾及周边（当前阶段不纳入大陆连续图层）
  { lonMin: 119, lonMax: 123, latMin: 21, latMax: 26 },
  // 南海远海区域（先排除，后续可按专题图层单独处理）
  { lonMin: 106, lonMax: 123, latMin: 3, latMax: 20 }
];

function isInBox(lat, lon, box) {
  return lon >= box.lonMin && lon <= box.lonMax && lat >= box.latMin && lat <= box.latMax;
}

/**
 * 判断是否位于“中国大陆渲染区域”
 * @param {number} lat
 * @param {number} lon
 * @returns {boolean}
 */
export function isInMainlandChina(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (!isInBox(lat, lon, MAINLAND_BOUNDS)) return false;

  return !EXCLUSION_ZONES.some(zone => isInBox(lat, lon, zone));
}

export { MAINLAND_BOUNDS, EXCLUSION_ZONES };
