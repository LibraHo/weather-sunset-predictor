const DEFAULT_LEVELS = Object.freeze([
  Object.freeze({ key: 'excellent', min: 85, labelZh: '顶级', labelEn: 'Rare', color: '#dc5a28' }),
  Object.freeze({ key: 'good', min: 70, labelZh: '高分', labelEn: 'Strong', color: '#d97706' }),
  Object.freeze({ key: 'fair', min: 40, labelZh: '可观赏', labelEn: 'Watch', color: '#b7793b' }),
  Object.freeze({ key: 'poor', min: 0, labelZh: '低概率', labelEn: 'Low', color: '#7a6554' })
]);

let levels = DEFAULT_LEVELS;

function normalizeLevels(value) {
  if (!Array.isArray(value) || value.length < 4) return null;
  const normalized = value
    .filter(level => level && typeof level.key === 'string' && Number.isFinite(Number(level.min)))
    .map(level => Object.freeze({ ...level, min: Number(level.min) }))
    .sort((a, b) => b.min - a.min);
  return normalized.some(level => level.key === 'poor') ? Object.freeze(normalized) : null;
}

export async function loadQualityLevelConfig(fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') return levels;
  try {
    const response = await fetchImpl('/data/quality-levels.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const config = await response.json();
    levels = normalizeLevels(config?.levels) || DEFAULT_LEVELS;
  } catch (error) {
    console.warn('[QualityLevels] 使用内置等级配置:', error.message);
    levels = DEFAULT_LEVELS;
  }
  return levels;
}

export function getQualityLevel(score) {
  const raw = Number(score);
  const value = Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : 0;
  return levels.find(level => value >= level.min)?.key || 'poor';
}

export function getQualityConfig(qualityOrScore) {
  const key = typeof qualityOrScore === 'number'
    ? getQualityLevel(qualityOrScore)
    : String(qualityOrScore || 'poor');
  return levels.find(level => level.key === key)
    || levels.find(level => level.key === 'poor');
}

export function getQualityLevels() {
  return levels;
}
