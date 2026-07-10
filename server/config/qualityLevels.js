const path = require('path');

const config = require(path.join(__dirname, '../../public/data/quality-levels.json'));

const levels = Object.freeze(
  [...config.levels]
    .map(level => Object.freeze({ ...level }))
    .sort((a, b) => b.min - a.min)
);

function normalizeScore(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function getQualityLevel(score) {
  const value = normalizeScore(score);
  return levels.find(level => value >= level.min)?.key || 'poor';
}

function getQualityConfig(qualityOrScore) {
  const key = typeof qualityOrScore === 'number'
    ? getQualityLevel(qualityOrScore)
    : String(qualityOrScore || 'poor');
  return levels.find(level => level.key === key)
    || levels.find(level => level.key === 'poor');
}

module.exports = {
  version: config.version,
  levels,
  getQualityLevel,
  getQualityConfig
};
