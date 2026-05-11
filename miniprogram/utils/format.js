export function formatScore(score) {
  if (score === null || score === undefined || score === '') return '--';
  const num = Number(score);
  if (!Number.isFinite(num)) return '--';
  return `${Math.round(num)}分`;
}

export function formatQuality(quality) {
  const map = {
    excellent: '极佳',
    good: '良好',
    fair: '一般',
    poor: '较差',
    bad: '较差'
  };
  return map[quality] || quality || '--';
}

export function formatDate(value, locale = 'zh-CN') {
  if (!value) return '--';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}

export function formatPercent(value) {
  if (value === null || value === undefined || value === '') return '--';
  const num = Number(value);
  if (!Number.isFinite(num)) return '--';
  const percent = num >= 0 && num <= 1 ? num * 100 : num;
  return `${Math.round(percent)}%`;
}

export function formatDistance(value) {
  if (value === null || value === undefined || value === '') return '--';
  const num = Number(value);
  if (!Number.isFinite(num)) return '--';
  if (num < 1) return `${Math.round(num * 1000)}m`;
  return `${num.toFixed(num < 10 ? 1 : 0)}km`;
}

export function formatVisibility(value) {
  if (value === null || value === undefined || value === '') return '--';
  const num = Number(value);
  if (!Number.isFinite(num)) return '--';
  return `${num.toFixed(num < 10 ? 1 : 0)}km`;
}

export default {
  formatScore,
  formatQuality,
  formatDate,
  formatPercent,
  formatDistance,
  formatVisibility
};
