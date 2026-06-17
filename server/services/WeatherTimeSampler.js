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

  const num = Number(value);
  if (Number.isFinite(num)) {
    if (num > 1e12) return num;
    return num * 1000;
  }

  if (typeof value === 'string') {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
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
    const rawValue = item?.[field];
    if (rawValue == null || rawValue === '') return;
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return;
    total += value * weight;
    weightTotal += weight;
  });

  if (weightTotal <= 0) return undefined;
  return total / weightTotal;
}

function selectBoundingSamples(entries, refTs) {
  const sorted = [...entries].sort((a, b) => a.ts - b.ts);
  const exact = sorted.find(entry => entry.ts === refTs);
  if (exact) {
    return [{ ...exact, diffMs: 0, weight: 1 }];
  }

  const before = [...sorted].reverse().find(entry => entry.ts < refTs);
  const after = sorted.find(entry => entry.ts > refTs);

  if (!before || !after) {
    const closest = sorted.reduce((best, current) => {
      const bestDiff = Math.abs(best.ts - refTs);
      const currentDiff = Math.abs(current.ts - refTs);
      return currentDiff < bestDiff ? current : best;
    }, sorted[0]);
    return [{ ...closest, diffMs: Math.abs(closest.ts - refTs), weight: 1 }];
  }

  const span = after.ts - before.ts;
  if (span <= 0) {
    return [{ ...before, diffMs: Math.abs(before.ts - refTs), weight: 1 }];
  }

  const afterWeight = (refTs - before.ts) / span;
  const beforeWeight = 1 - afterWeight;

  return [
    { ...before, diffMs: refTs - before.ts, weight: beforeWeight },
    { ...after, diffMs: after.ts - refTs, weight: afterWeight }
  ];
}

function buildTimeWeightedWeatherSample(hourly = [], referenceTime = new Date()) {
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

  const samples = selectBoundingSamples(entries, refTs);

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
