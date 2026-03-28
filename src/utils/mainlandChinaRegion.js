/**
 * mainlandChinaRegion - 中国大陆区域判断（前端可复用）
 *
 * 目标：
 * - 聚焦中国大陆连续陆地区域（暂不覆盖南海远海点位）
 * - 用于前端地图展示过滤，避免“全国矩形框”带来的海上噪点
 */

const MAINLAND_BOUNDS = {
  lonMin: 73,
  lonMax: 133.5,  // 收紧东边界，减少东北外溢
  latMin: 21,     // 上移南边界，避免西藏以南溢出
  latMax: 54
};

const EXCLUSION_ZONES = [
  // 台湾及周边（当前阶段不纳入大陆连续图层）
  { lonMin: 119, lonMax: 123, latMin: 21, latMax: 26 },
  // 香港/澳门（当前阶段按“非中国大陆”处理）
  { lonMin: 113.8, lonMax: 114.5, latMin: 22.08, latMax: 22.62 }, // 香港
  { lonMin: 113.45, lonMax: 113.65, latMin: 22.08, latMax: 22.25 }, // 澳门
  // 南海远海区域（先排除，后续可按专题图层单独处理）
  { lonMin: 106, lonMax: 123, latMin: 3, latMax: 20 }
];

export const MAINLAND_COUNTRY_CODE = 'CN';
export const NON_MAINLAND_CN_REGION_CODES = ['HK', 'MO', 'TW'];

function isInBox(lat, lon, box) {
  return lon >= box.lonMin && lon <= box.lonMax && lat >= box.latMin && lat <= box.latMax;
}

function normalizeRegionCode(code) {
  if (typeof code !== 'string') return '';
  const upper = code.toUpperCase().trim();

  if (upper === '810000' || upper === 'HK') return 'HK';
  if (upper === '820000' || upper === 'MO' || upper === 'MACAU' || upper === 'MACAO') return 'MO';
  if (upper === '710000' || upper === 'TW') return 'TW';

  return upper;
}

function isExcludedCnRegion(code) {
  return NON_MAINLAND_CN_REGION_CODES.includes(normalizeRegionCode(code));
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

/**
 * 根据“查询城市元数据 + 坐标”判断是否属于中国大陆。
 * 规则：
 * 1) 若有 countryCode，则必须是 CN
 * 2) 若 regionCode 明确属于 HK/MO/TW，则判定为非大陆
 * 3) 坐标需落在大陆渲染区域内（含排除区）
 */
export function isMainlandChinaLocation(location) {
  if (!location || typeof location !== 'object') return false;

  const countryCode = typeof location.countryCode === 'string'
    ? location.countryCode.toUpperCase().trim()
    : '';

  if (countryCode && countryCode !== MAINLAND_COUNTRY_CODE) {
    return false;
  }

  if (isExcludedCnRegion(location.regionCode)) {
    return false;
  }

  return isInMainlandChina(location.lat, location.lon);
}

export { MAINLAND_BOUNDS, EXCLUSION_ZONES };
