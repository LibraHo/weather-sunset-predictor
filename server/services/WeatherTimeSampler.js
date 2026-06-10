const ONE_HOUR_MS = 60 * 60 * 1000;

const WEIGHTED_NUMERIC_FIELDS = [
  'cloudCover',
  'cloudBaseHeight',
  'humidity',
  'visibility',
  'lowClouds',
  'lowCloudCover',
  'midClouds',
  'highClouds',
  'precipitation',
  'temp',
  'windSpeed',
  'pressure',
  'shortwaveRadiation',
  'directRadiation',
  'diffuseRadiation',
  'waterVapourColumn',
  'aerosolOpticalDepth',
  'dust',
  'pm2_5',
  'pm10',
  'aqi'
];

function toEpochMs(value) {
  if (value == null || value === '') return null;

  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : null;
  }

  if (typeof value === 'string') {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  }

  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (num > 1e12) return num;
  return num * 1000;
}

function normalizeHourlyEntries(hourly = []) {
  return Array.isArray(hourly)
    ? hourly
        .map((item, idx) => ({
          item,
          idx,
          ts: toEpochMs(item?.timestamp ?? item?.time ?? null)
        }))
        .filter(entry => Number.isFinite(entry.ts))
    : [];
}

function selectHourlyAt(hourly = [], referenceTime = new Date()) {
  const entries = normalizeHourlyEntries(hourly);
  if (!entries.length) return { selected: null, selectedIdx: -1 };

  const refTs = toEpochMs(referenceTime) ?? Date.now();
  const closest = entries.reduce((best, current) => {
    const bestDiff = Math.abs(best.ts - refTs);
    const currentDiff = Math.abs(current.ts - refTs);
    return currentDiff < bestDiff ? current : best;
  }, entries[0]);

  return { selected: closest.item, selectedIdx: closest.idx, selectedTs: closest.ts };
}

function averageWeightedField(samples, field) {
  let total = 0;
  let weightTotal = 0;

  samples.forEach(({ item, weight }) => {
    const value = Number(item?.[field]);
    if (!Number.isFinite(value)) return;
    total += value * weight;
    weightTotal += weight;
  });

  if (weightTotal <= 0) return undefined;
  return total / weightTotal;
}

function buildAdjacentHourSamples(entries, refTs) {
  if (!Number.isFinite(refTs)) return [];

  const lowerTs = Math.floor(refTs / ONE_HOUR_MS) * ONE_HOUR_MS;
  const upperTs = Math.ceil(refTs / ONE_HOUR_MS) * ONE_HOUR_MS;
  const targetTsList = lowerTs === upperTs ? [lowerTs] : [lowerTs, upperTs];
  const targetEntries = targetTsList
    .map(targetTs => entries.find(entry => entry.ts === targetTs))
    .filter(Boolean);

  if (!targetEntries.length) return [];
  if (lowerTs === upperTs) {
    return targetEntries.map(entry => ({ ...entry, diffMs: 0, weight: 1 }));
  }

  return targetEntries.map((entry) => {
    const weight = entry.ts === lowerTs
      ? (upperTs - refTs) / ONE_HOUR_MS
      : (refTs - lowerTs) / ONE_HOUR_MS;
    return {
      ...entry,
      diffMs: Math.abs(entry.ts - refTs),
      weight: Math.max(0, Math.min(1, weight))
    };
  });
}

function buildTimeWeightedWeatherSample(hourly = [], referenceTime = new Date(), options = {}) {
  const entries = normalizeHourlyEntries(hourly);
  if (!entries.length) {
    return {
      selected: null,
      selectedIdx: -1,
      weighted: null,
      samples: []
    };
  }

  const refTs = toEpochMs(referenceTime) ?? Date.now();
  const closest = entries.reduce((best, current) => {
    const bestDiff = Math.abs(best.ts - refTs);
    const currentDiff = Math.abs(current.ts - refTs);
    return currentDiff < bestDiff ? current : best;
  }, entries[0]);

  const samples = buildAdjacentHourSamples(entries, refTs)
    .sort((a, b) => a.ts - b.ts);

  if (!samples.length) {
    return {
      selected: closest.item,
      selectedIdx: closest.idx,
      weighted: closest.item,
      samples: []
    };
  }

  const weighted = { ...closest.item };
  WEIGHTED_NUMERIC_FIELDS.forEach((field) => {
    const averaged = averageWeightedField(samples, field);
    if (averaged !== undefined) {
      weighted[field] = Number(averaged.toFixed(3));
    }
  });

  weighted.timestamp = closest.item?.timestamp ?? closest.ts;
  weighted.time = closest.item?.time ?? closest.ts;
  weighted.timeWeightedSamples = samples.map(sample => ({
    timestamp: sample.item?.timestamp ?? sample.ts,
    weight: Number(sample.weight.toFixed(3))
  }));

  return {
    selected: closest.item,
    selectedIdx: closest.idx,
    weighted,
    samples
  };
}

module.exports = {
  buildTimeWeightedWeatherSample,
  selectHourlyAt,
  toEpochMs
};
