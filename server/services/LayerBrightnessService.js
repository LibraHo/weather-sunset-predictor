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

function scoreBrightnessResponse(value, fullBrightnessReference, curve = 6) {
  const number = finiteNumber(value, 0);
  const reference = finiteNumber(fullBrightnessReference, 1);
  if (number <= 0 || reference <= 0) return 0;
  if (number >= reference) return 1;

  const normalized = clamp(number / reference, 0, 1);
  if (curve <= 0) return normalized;
  return clamp(Math.log1p(curve * normalized) / Math.log1p(curve), 0, 1);
}

function scoreSaturatedRatio(value, fullReference, floor, curve = 6) {
  const number = finiteNumber(value);
  const reference = finiteNumber(fullReference, 1);
  if (number === null) return 1;
  if (number <= 0 || reference <= 0) return floor;
  const normalized = clamp(number / reference, 0, 1);
  const response = curve <= 0
    ? normalized
    : Math.log1p(curve * normalized) / Math.log1p(curve);
  return clamp(floor + (1 - floor) * response, floor, 1);
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
  const pm25 = finiteNumber(weatherData.pm2_5 ?? weatherData.pm25);
  const pm10 = finiteNumber(weatherData.pm10);
  const dust = finiteNumber(weatherData.dust);
  const waterVapour = finiteNumber(weatherData.waterVapourColumn);

  const visibilityFactor = scoreSaturatedRatio(visibility, 18, 0.72);
  const humidityFactor = humidity === null ? 1 : clamp(1 - normalizeRange(humidity, 70, 96) * 0.28, 0.72, 1);
  const aerosolFactor = aod === null ? 1 : clamp(1 - normalizeRange(aod, 0.25, 0.65) * 0.36, 0.58, 1.04);
  const pm10Factor = pm10 === null ? 1 : clamp(1 - normalizeRange(pm10, 70, 180) * 0.22, 0.78, 1);
  const waterFactor = waterVapour === null ? 1 : clamp(1 - normalizeRange(waterVapour, 28, 44) * 0.32, 0.68, 1);
  const particulateCap = ((pm25 !== null && pm25 >= 75) || (pm10 !== null && pm10 >= 100) || (dust !== null && dust >= 100))
    ? 0.68
    : 1.08;
  const transmission = visibilityFactor * humidityFactor * aerosolFactor * pm10Factor * waterFactor;

  // Keep air transmission as an independent cap/diagnostic. The main rendering
  // factor already contains visibility, humidity, AQI, and aerosol effects.
  return {
    factor: clamp(Math.min(transmission, particulateCap), 0.18, 1.08),
    visibilityFactor,
    humidityFactor,
    aerosolFactor,
    pm10Factor,
    particulateCap,
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

function buildLayerWeightedCarrierScore({
  low,
  midSignal,
  highSignal,
  directionalUpper,
  remoteLayerCarriers = null,
  carrierScore,
  lowBlockFactor,
  solarFactor,
  pathFactor,
  thicknessFactor,
  beamFactor,
  brightnessResponseCurve = 6
}) {
  const carrier = clamp(finiteNumber(carrierScore?.score, 0), 0, 100);
  if (carrier <= 0) {
    return {
      score: 0,
      formula: 'sum_layer_carrier_brightness',
      contributions: []
    };
  }

  const activeCarrier = carrierScore?.activeCarrier || 'cloud';
  const aerosolScore = finiteNumber(carrierScore?.aerosolCarrierScore?.activatedScore, 0);
  const directionalScore = directionalUpper === null ? 0 : clamp(finiteNumber(directionalUpper, 0) * 0.72, 0, 100);
  const cloudMidCarrier = clamp(midSignal * 0.75, 0, 100);
  const cloudHighCarrier = clamp(highSignal * 0.9, 0, 100);
  let rawLayers;
  if (activeCarrier === 'directional_curtain' && directionalScore > 0) {
    rawLayers = [
      { key: 'directional', carrier: directionalScore, brightnessBias: 1.02 },
      { key: 'mid', carrier: cloudMidCarrier * 0.35, brightnessBias: 1 },
      { key: 'high', carrier: cloudHighCarrier * 0.35, brightnessBias: 0.96 }
    ];
  } else if (activeCarrier === 'aerosol' && aerosolScore > 0) {
    rawLayers = [
      { key: 'aerosol', carrier: aerosolScore, brightnessBias: 0.92 },
      { key: 'mid', carrier: cloudMidCarrier * 0.25, brightnessBias: 1 },
      { key: 'high', carrier: cloudHighCarrier * 0.25, brightnessBias: 0.96 }
    ];
  } else {
    rawLayers = [
      { key: 'mid', carrier: cloudMidCarrier, brightnessBias: 1.04 },
      { key: 'high', carrier: cloudHighCarrier, brightnessBias: 0.96 },
      { key: 'directional', carrier: directionalScore * 0.35, brightnessBias: 1.02 }
    ];
  }

  const usefulLayers = rawLayers.filter(layer => layer.carrier > 0);
  const rawTotal = usefulLayers.reduce((sum, layer) => sum + layer.carrier, 0);
  if (rawTotal <= 0) {
    return {
      score: 0,
      formula: 'sum_layer_carrier_brightness',
      contributions: []
    };
  }

  const commonBrightness = lowBlockFactor * solarFactor * pathFactor * thicknessFactor * beamFactor;
  const contributions = usefulLayers.map((layer) => {
    const normalizedCarrier = carrier * layer.carrier / rawTotal;
    const brightness = clamp(commonBrightness * layer.brightnessBias, 0, 1.05);
    const multiplier = scoreBrightnessResponse(brightness, 0.66, brightnessResponseCurve);
    const score = normalizedCarrier * multiplier;
    return {
      key: layer.key,
      carrier: round(normalizedCarrier, 1),
      brightness: round(multiplier, 2),
      score: round(score, 1)
    };
  });

  if (remoteLayerCarriers?.applied && activeCarrier !== 'directional_curtain' && (highSignal < 70 || activeCarrier === 'remote_layer')) {
    const remoteLowBlock = clamp(finiteNumber(remoteLayerCarriers.remoteLowBlock, 0), 0, 100);
    const remotePathFactor = clamp(pathFactor, 0, 1.05);
    const remoteHighLowBlockFactor = clamp(1 - Math.max(0, remoteLowBlock - 35) / 65 * 0.22, 0.78, 1.02);
    const remoteMidLowBlockFactor = clamp(1 - Math.max(0, remoteLowBlock - 22) / 58 * 0.42, 0.55, 1.02);
    const remoteCommon = solarFactor * remotePathFactor * thicknessFactor * beamFactor;
    const remoteLayers = [
      {
        key: 'remoteHigh',
        carrier: clamp(finiteNumber(remoteLayerCarriers.remoteHighCarrier, 0), 0, 32),
        brightness: clamp(remoteCommon * remoteHighLowBlockFactor * 1.08, 0, 1.05)
      },
      {
        key: 'remoteMid',
        carrier: clamp(finiteNumber(remoteLayerCarriers.remoteMidCarrier, 0), 0, 24),
        brightness: clamp(remoteCommon * remoteMidLowBlockFactor * 0.98, 0, 1.05)
      }
    ].filter(layer => layer.carrier > 0);

    remoteLayers.forEach((layer) => {
      const multiplier = scoreBrightnessResponse(layer.brightness, 0.66, brightnessResponseCurve);
      const score = layer.carrier * multiplier;
      contributions.push({
        key: layer.key,
        carrier: round(layer.carrier, 1),
        brightness: round(multiplier, 2),
        score: round(score, 1)
      });
    });
  }

  const totalScore = contributions.reduce((sum, layer) => sum + layer.score, 0);
  const scoreScale = totalScore > 100 ? 100 / totalScore : 1;
  const scaledContributions = scoreScale < 1
    ? contributions.map(layer => ({ ...layer, score: round(layer.score * scoreScale, 1) }))
    : contributions;

  return {
    score: round(clamp(scaledContributions.reduce((sum, layer) => sum + layer.score, 0), 0, 100), 1),
    formula: 'sum_layer_carrier_brightness',
    contributions: scaledContributions
  };
}

function scoreLayerBrightness(params = {}) {
  const {
    weatherData = {},
    timeAnalysis = {},
    lightPathScore = {},
    lightPathGate = null,
    renderingFactor = {},
    cloudThickness = {},
    type = 'sunset',
    directionalCurtainCarrier = null,
    remoteLayerCarriers = null,
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
  const pathScoreFactor = clamp(finiteNumber(lightPathScore.score, 0) / 100, 0, 1.05);
  const pathGateFactor = finiteNumber(lightPathGate?.gate);
  const pathFactor = pathGateFactor === null
    ? pathScoreFactor
    : clamp(Math.min(pathScoreFactor, pathGateFactor), 0, 1.05);
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
    100 * cloudCanvas * lowBlockFactor * solarFactor * pathFactor * thicknessFactor * beam.factor,
    0,
    100
  );
  const brightnessThreshold = dimEvidence.length >= 3 && effectiveBrightness < 30 ? 50 : 42;
  const brightnessResponseCurve = lightPathGate?.reason === 'solar_direction_blocked_corridor' ? 0 : 6;
  const weightedCarrierScore = buildLayerWeightedCarrierScore({
    low,
    midSignal,
    highSignal,
    directionalUpper,
    remoteLayerCarriers,
    carrierScore,
    lowBlockFactor,
    solarFactor,
    pathFactor,
    thicknessFactor,
    beamFactor: beam.factor,
    brightnessResponseCurve,
  });
  const brightnessMultiplier = effectiveBrightness <= 0
    ? 0
    : (effectiveBrightness >= brightnessThreshold
      ? 1
      : scoreBrightnessResponse(effectiveBrightness, brightnessThreshold, brightnessResponseCurve));
  const brightnessGate = brightnessMultiplier;
  const reason = buildBrightnessReason(effectiveBrightness, dimEvidence);

  return {
    applied: true,
    effectiveBrightness: round(effectiveBrightness, 1),
    weightedCarrierScore: weightedCarrierScore.score,
    formula: weightedCarrierScore.formula,
    layerContributions: weightedCarrierScore.contributions,
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
      directionalUpper: directionalUpper === null ? null : round(directionalUpper, 1),
      remoteHigh: remoteLayerCarriers?.metrics?.high ?? null,
      remoteMid: remoteLayerCarriers?.metrics?.mid ?? null,
      remoteLowBlock: remoteLayerCarriers?.remoteLowBlock != null ? round(remoteLayerCarriers.remoteLowBlock, 1) : null
    },
    factors: {
      lowBlockFactor: round(lowBlockFactor, 2),
      solarFactor: round(solarFactor, 2),
      pathFactor: round(pathFactor, 2),
      airTransmission: round(air.factor, 2),
      brightnessThreshold,
      brightnessResponse: brightnessResponseCurve > 0 ? 'log1p_k6' : 'linear_blocked_corridor',
      visibilityFactor: round(air.visibilityFactor, 2),
      humidityFactor: round(air.humidityFactor, 2),
      aerosolFactor: round(air.aerosolFactor, 2),
      pm10Factor: round(air.pm10Factor, 2),
      particulateCap: round(air.particulateCap, 2),
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
