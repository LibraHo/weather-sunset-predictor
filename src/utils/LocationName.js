const MUNICIPALITIES = [
  ['北京市', '北京'],
  ['上海市', '上海'],
  ['天津市', '天津'],
  ['重庆市', '重庆']
];

export function compactLocationName(rawName, address = {}) {
  const input = String(rawName || '').trim();
  if (!input) return '';

  const locality = address.city || address.town || address.municipality || address.village || address.county || address.locality || '';
  const region = address.district || address.state || address.province || address.region || '';
  const country = address.country || '';

  for (const [prefix, city] of MUNICIPALITIES) {
    if (!String(locality || region || input).includes(prefix)) continue;
    const district = address.district || input.slice(input.indexOf(prefix) + prefix.length).match(/^[,，·\s]*([^区县,，]{1,8}[区县])/u)?.[1];
    return district ? `${city} · ${district}` : city;
  }

  const structured = [locality, region, country]
    .map(part => String(part || '').trim())
    .filter((part, index, parts) => part && parts.findIndex(item => item.toLocaleLowerCase() === part.toLocaleLowerCase()) === index);
  if (structured.length) return structured.slice(0, 2).join(' · ');

  const parts = input
    .split(/[,，]/u)
    .map(part => part.trim())
    .filter(Boolean);
  if (parts.length <= 1) return input.length > 48 ? `${input.slice(0, 48)}…` : input;

  const compact = [];
  for (const part of parts) {
    if (compact.some(existing => existing === part)) continue;
    compact.push(part);
    if (compact.length === 2) break;
  }
  return compact.join(' · ');
}
