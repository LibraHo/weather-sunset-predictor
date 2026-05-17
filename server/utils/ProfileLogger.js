function nowMs() {
  if (typeof process.hrtime?.bigint === 'function') {
    return Number(process.hrtime.bigint()) / 1e6;
  }
  return Date.now();
}

function roundMs(value) {
  return Math.round(value * 10) / 10;
}

function startProfile() {
  return nowMs();
}

function profileDurationMs(startedAt) {
  return roundMs(nowMs() - startedAt);
}

function logProfile(scope, phase, startedAt, metadata = {}) {
  const payload = {
    scope,
    phase,
    durationMs: profileDurationMs(startedAt),
    ...metadata
  };

  console.info('[BackendProfile]', JSON.stringify(payload));
  return payload;
}

module.exports = {
  startProfile,
  profileDurationMs,
  logProfile
};
