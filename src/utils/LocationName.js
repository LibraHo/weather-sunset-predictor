const MUNICIPALITIES = [
  ['北京市', '北京'],
  ['上海市', '上海'],
  ['天津市', '天津'],
  ['重庆市', '重庆']
];

export function compactLocationName(rawName) {
  const input = String(rawName || '').trim();
  if (!input) return '';

  for (const [prefix, city] of MUNICIPALITIES) {
    if (!input.startsWith(prefix)) continue;
    const district = input.slice(prefix.length).match(/^[,，·\s]*([^区县,，]{1,8}[区县])/u)?.[1];
    return district ? `${city} · ${district}` : city;
  }

  const parts = input
    .split(/[,，]/u)
    .map(part => part.trim())
    .filter(Boolean);
  if (parts.length <= 1) return input.length > 28 ? `${input.slice(0, 28)}…` : input;

  const compact = [];
  for (const part of parts) {
    if (compact.some(existing => existing === part)) continue;
    compact.push(part);
    if (compact.length === 2) break;
  }
  return compact.join(' · ');
}
