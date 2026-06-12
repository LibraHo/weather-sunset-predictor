/**
 * LayerBrightnessService
 *
 * Estimates whether the available mid/high cloud canvas is actually bright
 * enough to produce visible sunrise/sunset color. This is a conservative
 * suppressor for cases where carrier clouds exist and the light path is open,
 * but the scene is likely a thick/dim gray veil.
 */

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function finiteNumber(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function normalizeRange(value, min, max, invert = false) {
  const number = finiteNumber(value);
  if (number === null) return 1;
  const normalized = clamp((number - min) / (max - min), 0, 1);
  return invert ? 1 - normalized : normalized;
}

function upperCloudSignal(cloudPercent) {
  const cloud = clamp(finiteNumber(cloudPercent, 0), 0, 100);
  if (cloud <= 0) return 0;
  const lowCloudPresence = 1 - Math.exp(-cloud / 8);
  const saturationFade = Math.pow(clamp(1 - cloud / 70, 0, 1), 2);
  const lowAmountLift = 12 * lowCloudPresence * saturationFade;
  return clamp(cloud + lowAmountLift, 0, 100);
}

function scoreSolarLayerFactor(solarElevation, type = 'sunset') {
  const elevation = finiteNumber(solarElevation, 0);
  const absElevation = Math.abs(elevation);

  // Golden-hour cloud illumination usually peaks close to the horizon. Keep
  // this broad because model event times and local terrain can shift timing.
  if (elevation >= -2 && elevation <= 3) return 0.96;
  if (elevation >= -5 && elevation < -2) return 0.72;
  if (elevation > 3 && elevation <= 6) return 0.68;
  if (absElevation <= 8) return 0.52;
  return type === 'sunrise' || type === 'sunset' ? 0.35 : 0.2;
}

function scoreAirTransmission(weatherData = {}, renderingFactor = {}) {
  const visibility = finiteNumber(weatherData.visibility);
  const humidity = finiteNumber(weatherData.humidity);
  const aod = finiteNumber(weatherData.aerosolOpticalDepth ?? weatherData.aod);
  const pm10 = finiteNumber(weatherData.pm10);
  const waterVapour = finiteNumber(weatherData.waterVapourColumn);
  const rendering = finiteNumber(renderingFactor.factor, 1);

  const visibilityFactor = visibility === null ? 1 : clamp(visibility / 18, 0.45, 1);
  const humidityFactor = humidity === null ? 1 : clamp(1 - normalizeRange(humidity, 70, 96) * 0.28, 0.72, 1);
  const aerosolFactor = aod === null ? 1 : clamp(1 - normalizeRange(aod, 0.25, 0.65) * 0.36, 0.58, 1.04);
  const pm10Factor = pm10 === null ? 1 : clamp(1 - normalizeRange(pm10, 70, 180) * 0.22, 0.78, 1);
  const waterFactor = waterVapour === null ? 1 : clamp(1 - normalizeRange(waterVapour, 28, 44) * 0.32, 0.68, 1);

  // Rendering already contains several air-quality signals. Use it as one
  // factor, but keep explicit metrics visible so dim-but-open cases can be
  // diagnosed and calibrated.
  return {
    factor: clamp(rendering * visibilityFactor * humidityFactor * aerosolFactor * pm10Factor * waterFactor, 0.18, 1.08),
    visibilityFactor,
    humidityFactor,
    aerosolFactor,
    pm10Factor,
    waterFactor
  };
}

function scoreThicknessFactor(weatherData = {}, cloudThickness = {}, lightPathScore = {}) {
  const high = finiteNumber(weatherData.highClouds, 0);
  const cloudCover = finiteNumber(weatherData.cloudCover, high);
  const waterVapour = finiteNumber(weatherData.waterVapourColumn);
  const modifier = finiteNumber(cloudThickness.modifier, 1);
  const thickHighCap = finiteNumber(lightPathScore.thickHighCloudPenalty?.cap);

  let factor = clamp(modifier, 0.55, 1.12);
  if (high >= 70 && cloudCover >= 70) factor *= 0.86;
  if (waterVapour !== null && waterVapour >= 34) factor *= 0.88;
  if (thickHighCap !== null) factor *= clamp(thickHighCap / 80, 0.5, 0.85);

  return clamp(factor, 0.35, 1.12);
}

function scoreBeamFactor(weatherData = {}) {
  const direct = finiteNumber(weatherData.directRadiation);
  const diffuse = finiteNumber(weatherData.diffuseRadiation);
  const shortwave = finiteNumber(weatherData.shortwaveRadiation);
  if (direct === null || diffuse === null || direct + diffuse <= 0) {
    return { factor: 1, directRatio: null, reason: 'beam_data_unavailable' };
  }

  const directRatio = direct / (direct + diffuse);
  // At sunrise/sunset surface direct radiation is naturally weak, so this is a
  // soft factor only. It mainly flags diffuse-dominant gray veil situations.
  const factor = clamp(0.72 + directRatio * 0.42 + normalizeRange(shortwave, 20, 80) * 0.10, 0.86, 1.08);
  return {
    factor,
    directRatio,
    reason: directRatio < 0.18 ? 'diffuse_dominant_light' : 'direct_light_available'
  };
}

function buildBrightnessReason(effectiveBrightness, dimEvidence = []) {
  if (effectiveBrightness < 6) return 'layer_brightness_unlit';
  if (effectiveBrightness < 18) return 'layer_brightness_very_weak';
  if (effectiveBrightness < 30) return 'layer_brightness_weak';
  if (effectiveBrightness < 42) return dimEvidence.length >= 2
    ? 'layer_brightness_moderate_dim_evidence'
    : 'layer_brightness_moderate';
  return dimEvidence.length >= 2
    ? 'layer_brightness_sufficient_with_dim_evidence'
    : 'layer_brightness_sufficient';
}

function scoreLayerBrightness(params = {}) {
  const {
    weatherData = {},
    timeAnalysis = {},
    lightPathScore = {},
    renderingFactor = {},
    cloudThickness = {},
    type = 'sunset',
    directionalCurtainCarrier = null,
    carrierScore = null
  } = params;

  const low = clamp(finiteNumber(weatherData.lowClouds ?? weatherData.lowCloudCover, 0), 0, 100);
  const mid = clamp(finiteNumber(weatherData.midClouds, 0), 0, 100);
  const high = clamp(finiteNumber(weatherData.highClouds, 0), 0, 100);
  const midSignal = upperCloudSignal(mid);
  const highSignal = upperCloudSignal(high);
  const directionalUpper = finiteNumber(directionalCurtainCarrier?.metrics?.upperSignal);

  const localCanvas = Math.max(midSignal, highSignal * 0.85);
  const directionalCanvas = directionalUpper === null ? 0 : directionalUpper * 0.72;
  const carrierCanvas = finiteNumber(carrierScore?.score) === null ? 0 : finiteNumber(carrierScore.score, 0);
  const cloudCanvas = clamp(Math.max(localCanvas, directionalCanvas, carrierCanvas), 0, 100) / 100;
  const lowBlockFactor = clamp(1 - Math.max(0, low - 25) / 75 * 0.55, 0.45, 1);

  const solarFactor = scoreSolarLayerFactor(timeAnalysis.elevation, type);
  const pathFactor = clamp(finiteNumber(lightPathScore.score, 0) / 100, 0, 1.05);
  const air = scoreAirTransmission(weatherData, renderingFactor);
  const thicknessFactor = scoreThicknessFactor(weatherData, cloudThickness, lightPathScore);
  const beam = scoreBeamFactor(weatherData);
  const visibility = finiteNumber(weatherData.visibility);
  const humidity = finiteNumber(weatherData.humidity);
  const aod = finiteNumber(weatherData.aerosolOpticalDepth ?? weatherData.aod);
  const pm10 = finiteNumber(weatherData.pm10);
  const waterVapour = finiteNumber(weatherData.waterVapourColumn);
  const rendering = finiteNumber(renderingFactor.factor, 1);
  const cloudCover = finiteNumber(weatherData.cloudCover, high);
  const dimEvidence = [];

  if (visibility !== null && visibility < 10) dimEvidence.push('low_visibility');
  if (humidity !== null && humidity >= 88) dimEvidence.push('humid_air');
  if (aod !== null && aod >= 0.35) dimEvidence.push('high_aod');
  if (pm10 !== null && pm10 >= 100) dimEvidence.push('high_pm10');
  if (waterVapour !== null && waterVapour >= 32) dimEvidence.push('high_water_vapour');
  const hasGrayVeilContext = (visibility !== null && visibility < 10)
    || (humidity !== null && humidity >= 88)
    || (waterVapour !== null && waterVapour >= 32)
    || rendering < 0.86;
  if (beam.directRatio !== null && beam.directRatio < 0.18 && hasGrayVeilContext) {
    dimEvidence.push('diffuse_dominant_light');
  }
  if (thicknessFactor < 0.82 && (hasGrayVeilContext || lightPathScore.thickHighCloudPenalty?.applied)) {
    dimEvidence.push('thick_upper_cloud');
  }
  if (rendering < 0.86) dimEvidence.push('rendering_suppressed');
  if (high >= 75 && cloudCover >= 70 && waterVapour !== null && waterVapour >= 30) {
    dimEvidence.push('crowded_high_cloud_water_veil');
  }

  const effectiveBrightness = clamp(
    100 * cloudCanvas * lowBlockFactor * solarFactor * pathFactor * air.factor * thicknessFactor * beam.factor,
    0,
    100
  );
  const brightnessMultiplier = effectiveBrightness <= 0
    ? 0
    : (effectiveBrightness >= 42
      ? 1
      : clamp(effectiveBrightness / 42, 0, 1));
  const brightnessGate = brightnessMultiplier;
  const reason = buildBrightnessReason(effectiveBrightness, dimEvidence);

  return {
    applied: true,
    effectiveBrightness: round(effectiveBrightness, 1),
    brightnessMultiplier: round(brightnessMultiplier, 2),
    brightnessGate: round(brightnessGate, 2),
    cap: null,
    reason,
    layers: {
      low: round(low, 1),
      mid: round(mid, 1),
      high: round(high, 1),
      midSignal: round(midSignal, 1),
      highSignal: round(highSignal, 1),
      cloudCanvas: round(cloudCanvas * 100, 1),
      directionalUpper: directionalUpper === null ? null : round(directionalUpper, 1)
    },
    factors: {
      lowBlockFactor: round(lowBlockFactor, 2),
      solarFactor: round(solarFactor, 2),
      pathFactor: round(pathFactor, 2),
      airTransmission: round(air.factor, 2),
      visibilityFactor: round(air.visibilityFactor, 2),
      humidityFactor: round(air.humidityFactor, 2),
      aerosolFactor: round(air.aerosolFactor, 2),
      pm10Factor: round(air.pm10Factor, 2),
      waterVapourFactor: round(air.waterFactor, 2),
      thicknessFactor: round(thicknessFactor, 2),
      beamFactor: round(beam.factor, 2),
      directRatio: beam.directRatio === null ? null : round(beam.directRatio, 2)
    },
    beamReason: beam.reason,
    dimEvidence
  };
}

function applyLayerBrightnessMultiplier(score, layerBrightness) {
  const numericScore = finiteNumber(score, 0);
  const multiplier = clamp(finiteNumber(layerBrightness?.brightnessMultiplier ?? layerBrightness?.brightnessGate, 1), 0, 1.05);
  const adjustedScore = round(clamp(numericScore * multiplier, 0, 100), 1);

  if (adjustedScore >= numericScore) {
    return {
      score: numericScore,
      applied: false,
      reason: layerBrightness?.reason || null,
      multiplier: round(multiplier, 2),
      originalScore: round(numericScore, 1)
    };
  }

  return {
    score: adjustedScore,
    applied: true,
    reason: layerBrightness?.reason || null,
    multiplier: round(multiplier, 2),
    effectiveBrightness: layerBrightness?.effectiveBrightness ?? null,
    originalScore: round(numericScore, 1)
  };
}

module.exports = {
  scoreLayerBrightness,
  applyLayerBrightnessMultiplier
};
