const EVENT_PASSED_BUFFER_MS = 45 * 60 * 1000;
const DEFAULT_REFERENCE_COORDINATE = { lat: 39.9042, lon: 116.4074 };

export function getDefaultSunEventDay(now = new Date(), { period = 'sunset', coordinate = null, lat = null, lon = null } = {}) {
  const resolvedLat = toFiniteNumber(coordinate?.lat ?? lat ?? DEFAULT_REFERENCE_COORDINATE.lat);
  const resolvedLon = toFiniteNumber(coordinate?.lon ?? coordinate?.lng ?? lon ?? DEFAULT_REFERENCE_COORDINATE.lon);
  const eventTime = getSolarEventTime(now, resolvedLat, resolvedLon, period === 'sunrise' ? 'sunrise' : 'sunset');
  if (!eventTime) return 'today';
  return now.getTime() > eventTime.getTime() + EVENT_PASSED_BUFFER_MS ? 'tomorrow' : 'today';
}

export function getSolarEventTime(date = new Date(), lat, lon, period = 'sunset') {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

  const timezone = Math.round(lon / 15);
  const targetDate = getTargetLocalDateParts(date, timezone);
  const dayOfYear = getDayOfYear(targetDate.year, targetDate.month, targetDate.day);
  const fractionalYear = (2 * Math.PI / 365) * (dayOfYear - 1);
  const eqTime = 229.18 * (
    0.000075
    + 0.001868 * Math.cos(fractionalYear)
    - 0.032077 * Math.sin(fractionalYear)
    - 0.014615 * Math.cos(2 * fractionalYear)
    - 0.040849 * Math.sin(2 * fractionalYear)
  );
  const declination = 0.006918
    - 0.399912 * Math.cos(fractionalYear)
    + 0.070257 * Math.sin(fractionalYear)
    - 0.006758 * Math.cos(2 * fractionalYear)
    + 0.000907 * Math.sin(2 * fractionalYear)
    - 0.002697 * Math.cos(3 * fractionalYear)
    + 0.00148 * Math.sin(3 * fractionalYear);
  const latRad = lat * Math.PI / 180;
  const zenith = 90.833 * Math.PI / 180;
  const cosHourAngle = (Math.cos(zenith) - Math.sin(latRad) * Math.sin(declination))
    / (Math.cos(latRad) * Math.cos(declination));

  if (cosHourAngle > 1 || cosHourAngle < -1) return null;

  const hourAngle = Math.acos(cosHourAngle) * 180 / Math.PI;
  const localMeridian = timezone * 15;
  const lonOffset = lon - localMeridian;
  const solarNoon = 720 - 4 * lonOffset - eqTime;
  const eventMinutes = period === 'sunrise'
    ? solarNoon - 4 * hourAngle
    : solarNoon + 4 * hourAngle;
  let adjustedMinutes = eventMinutes;
  let dayOffset = 0;
  if (adjustedMinutes < 0) {
    adjustedMinutes += 24 * 60;
    dayOffset = -1;
  } else if (adjustedMinutes >= 24 * 60) {
    adjustedMinutes -= 24 * 60;
    dayOffset = 1;
  }

  const hours = Math.floor(adjustedMinutes / 60);
  const minutes = Math.round(adjustedMinutes % 60);
  return new Date(Date.UTC(targetDate.year, targetDate.month, targetDate.day + dayOffset, hours - timezone, minutes, 0, 0));
}

function getTargetLocalDateParts(date, timezone) {
  const target = new Date(date.getTime() + timezone * 60 * 60 * 1000);
  return {
    year: target.getUTCFullYear(),
    month: target.getUTCMonth(),
    day: target.getUTCDate()
  };
}

function getDayOfYear(year, month, day) {
  const start = Date.UTC(year, 0, 1);
  const current = Date.UTC(year, month, day);
  return Math.floor((current - start) / (24 * 60 * 60 * 1000)) + 1;
}

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export { DEFAULT_REFERENCE_COORDINATE, EVENT_PASSED_BUFFER_MS };
