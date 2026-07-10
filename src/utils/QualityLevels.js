const DEFAULT_LEVELS = Object.freeze([
  Object.freeze({ key: 'excellent', min: 85, labelKey: 'prediction.excellent' }),
  Object.freeze({ key: 'good', min: 70, labelKey: 'prediction.good' }),
  Object.freeze({ key: 'fair', min: 40, labelKey: 'prediction.fair' }),
  Object.freeze({ key: 'poor', min: 0, labelKey: 'prediction.poor' })
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
    console.warn('[QualityLevels] Falling back to built-in thresholds:', error.message);
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
