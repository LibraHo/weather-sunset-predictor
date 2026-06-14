const DEFAULT_MAX_DISTANCE_KM = 150;
const DEFAULT_MAX_HEIGHT_M = 12000;

const DEFAULT_PROFILE_CLOUDS = [
  {
    id: 'near-low-wall',
    label: '近处低云墙',
    distanceKm: 14,
    baseHeightM: 260,
    topHeightM: 1100,
    coverage: 78,
    opticalDepth: 0.92,
  },
  {
    id: 'mid-altocumulus',
    label: '中距高积云',
    distanceKm: 34,
    baseHeightM: 2400,
    topHeightM: 4200,
    coverage: 54,
    opticalDepth: 0.48,
  },
  {
    id: 'far-cirrus',
    label: '远处卷云层',
    distanceKm: 72,
    baseHeightM: 6900,
    topHeightM: 9100,
    coverage: 46,
    opticalDepth: 0.26,
  },
  {
    id: 'distant-thick-veil',
    label: '远处厚云幕',
    distanceKm: 112,
    baseHeightM: 5200,
    topHeightM: 7800,
    coverage: 82,
    opticalDepth: 1.05,
  },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function normalizeCloud(rawCloud, index) {
  const distanceKm = clamp(finiteNumber(rawCloud.distanceKm, 20), 0, DEFAULT_MAX_DISTANCE_KM);
  const baseHeightM = clamp(finiteNumber(rawCloud.baseHeightM, 1000), 0, DEFAULT_MAX_HEIGHT_M);
  const topHeightM = clamp(
    finiteNumber(rawCloud.topHeightM, baseHeightM + 1000),
    baseHeightM + 50,
    DEFAULT_MAX_HEIGHT_M
  );

  return {
    id: rawCloud.id || `cloud-${index + 1}`,
    label: rawCloud.label || `Cloud ${index + 1}`,
    distanceKm,
    baseHeightM,
    topHeightM,
    coverage: clamp(finiteNumber(rawCloud.coverage, 50), 0, 100),
    opticalDepth: clamp(finiteNumber(rawCloud.opticalDepth, 0.5), 0.05, 1.6),
  };
}

function solarHeightAtDistance(distanceKm, solarElevationDeg) {
  const elevation = finiteNumber(solarElevationDeg, 0);
  const geometricHeight = Math.tan(elevation * Math.PI / 180) * distanceKm * 1000;
  const twilightLift = Math.max(0, -elevation) * 4500;
  return geometricHeight + twilightLift;
}

function getLightBand(distanceKm, solarElevationDeg) {
  const center = solarHeightAtDistance(distanceKm, solarElevationDeg);
  const elevation = finiteNumber(solarElevationDeg, 0);
  const upperScatter = 3600 + Math.max(0, 4 - Math.abs(elevation)) * 1000;
  const lowerScatter = 700 + Math.max(0, -elevation) * 450;
  return {
    center,
    bottom: center - lowerScatter,
    top: center + upperScatter,
  };
}

function intersectsCloud(lightBand, cloud) {
  return lightBand.top >= cloud.baseHeightM && lightBand.bottom <= cloud.topHeightM;
}

function colorForIllumination(solarElevationDeg, illumination, dimmed = false) {
  if (dimmed || illumination < 0.22) {
    return { colorName: 'violet gray', color: '#6f6687' };
  }
  if (solarElevationDeg < -0.8) {
    return { colorName: 'crimson pink', color: '#ff6f9a' };
  }
  if (solarElevationDeg < 1.2) {
    return { colorName: 'orange red', color: '#ff7043' };
  }
  if (solarElevationDeg < 4.5) {
    return { colorName: 'gold', color: '#ffc857' };
  }
  return { colorName: 'pale gold', color: '#ffe08a' };
}

function computeIllumination(cloud, lightBand, solarElevationDeg) {
  const cloudMid = (cloud.baseHeightM + cloud.topHeightM) / 2;
  const distanceFromBeam = Math.abs(cloudMid - lightBand.center);
  const geometryFactor = clamp(1 - distanceFromBeam / 12000, 0.12, 1);
  const densityFactor = clamp(1 - cloud.opticalDepth * 0.32, 0.32, 0.98);
  const coverageFactor = clamp(0.65 + cloud.coverage / 200, 0.65, 1);
  const twilightFactor = solarElevationDeg < -3 ? 0.45 : solarElevationDeg < -1.8 ? 0.72 : 1;
  return clamp(geometryFactor * densityFactor * coverageFactor * twilightFactor, 0, 1);
}

function isBlockingCloud(cloud, isIntersecting, illumination) {
  return isIntersecting && cloud.coverage >= 68 && cloud.opticalDepth >= 0.72 && illumination >= 0.18;
}

function summarize(clouds) {
  return clouds.reduce((summary, cloud) => {
    if (cloud.status === 'lit') summary.litCount += 1;
    if (cloud.status === 'shadowed') summary.blockedCount += 1;
    if (cloud.status === 'dimmed') summary.dimmedCount += 1;
    if (cloud.status === 'blocking') summary.blockingCount += 1;
    if (cloud.alwaysDark) summary.alwaysDarkCount += 1;
    return summary;
  }, {
    litCount: 0,
    blockedCount: 0,
    dimmedCount: 0,
    blockingCount: 0,
    alwaysDarkCount: 0,
  });
}

function analyzePersistentDarkClouds(options = {}) {
  const stats = new Map();
  const sampleClouds = options.clouds && options.clouds.length ? options.clouds : DEFAULT_PROFILE_CLOUDS;

  for (let solarElevationDeg = -5.5; solarElevationDeg <= 7.5; solarElevationDeg += 0.5) {
    const sample = simulateFireCloudProfile({
      ...options,
      solarElevationDeg,
      includeLifecycle: false,
      clouds: sampleClouds,
    });

    sample.clouds.forEach((cloud) => {
      const existing = stats.get(cloud.id) || {
        maxIllumination: 0,
        alwaysDark: true,
        statuses: new Set(),
      };
      const isDark = cloud.status === 'shadowed' ||
        cloud.status === 'unlit' ||
        (cloud.status === 'dimmed' && (cloud.illumination || 0) <= 0.28);
      existing.alwaysDark = existing.alwaysDark && isDark;
      existing.maxIllumination = Math.max(existing.maxIllumination, cloud.illumination || 0);
      existing.statuses.add(cloud.status);
      stats.set(cloud.id, existing);
    });
  }

  return Array.from(stats.entries()).reduce((lifecycle, [id, stat]) => {
    lifecycle[id] = {
      alwaysDark: stat.alwaysDark && stat.maxIllumination <= 0.28,
      maxIllumination: round(stat.maxIllumination),
      statuses: Array.from(stat.statuses).sort(),
    };
    return lifecycle;
  }, {});
}

function simulateFireCloudProfile(options = {}) {
  const mode = options.mode === 'sunrise' ? 'sunrise' : 'sunset';
  const solarElevationDeg = clamp(finiteNumber(options.solarElevationDeg, 0.6), -6, 8);
  const clouds = (options.clouds && options.clouds.length ? options.clouds : DEFAULT_PROFILE_CLOUDS)
    .map(normalizeCloud)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const blockers = [];
  const simulatedClouds = clouds.map((cloud) => {
    const lightBand = getLightBand(cloud.distanceKm, solarElevationDeg);
    const isIntersecting = intersectsCloud(lightBand, cloud);
    const blockingCloud = blockers.find(blocker => blocker.distanceKm < cloud.distanceKm);

    if (blockingCloud) {
      return {
        ...cloud,
        lightHeightM: round(lightBand.center, 0),
        illumination: 0,
        status: 'shadowed',
        colorName: 'blue gray',
        color: '#5f7188',
        blockedBy: blockingCloud.id,
        reason: `${blockingCloud.label} blocks the low-angle light path before this cloud.`,
      };
    }

    if (!isIntersecting) {
      return {
        ...cloud,
        lightHeightM: round(lightBand.center, 0),
        illumination: 0,
        status: 'unlit',
        colorName: 'blue gray',
        color: '#64748b',
        blockedBy: null,
        reason: 'The solar light band does not intersect this meter-level cloud height.',
      };
    }

    const illumination = computeIllumination(cloud, lightBand, solarElevationDeg);
    if (cloud.opticalDepth >= 1.05 || (cloud.baseHeightM >= 2500 && cloud.coverage >= 86 && cloud.opticalDepth >= 0.9)) {
      return {
        ...cloud,
        lightHeightM: round(lightBand.center, 0),
        illumination: round(illumination * 0.48),
        status: 'dimmed',
        ...colorForIllumination(solarElevationDeg, illumination, true),
        blockedBy: null,
        reason: 'High optical depth absorbs the warm light and pushes the cloud toward gray.',
      };
    }

    if (isBlockingCloud(cloud, isIntersecting, illumination)) {
      blockers.push(cloud);
      return {
        ...cloud,
        lightHeightM: round(lightBand.center, 0),
        illumination: round(illumination),
        status: 'blocking',
        ...colorForIllumination(solarElevationDeg, illumination),
        blockedBy: null,
        reason: 'High coverage and optical depth turn this cloud into a light-path blocker.',
      };
    }

    return {
      ...cloud,
      lightHeightM: round(lightBand.center, 0),
      illumination: round(illumination),
      status: illumination > 0.28 ? 'lit' : 'dimmed',
      ...colorForIllumination(solarElevationDeg, illumination),
      blockedBy: null,
      reason: 'The low-angle solar light band intersects this cloud at its meter-level height.',
    };
  });

  const lifecycle = options.includeLifecycle
    ? analyzePersistentDarkClouds({ mode, clouds })
    : null;
  const cloudsWithLifecycle = lifecycle
    ? simulatedClouds.map(cloud => ({
      ...cloud,
      alwaysDark: Boolean(lifecycle[cloud.id]?.alwaysDark),
      lifecycle: lifecycle[cloud.id] || {
        alwaysDark: false,
        maxIllumination: cloud.illumination || 0,
        statuses: [cloud.status],
      },
    }))
    : simulatedClouds;

  return {
    sun: {
      mode,
      solarElevationDeg: round(solarElevationDeg, 1),
    },
    bounds: {
      maxDistanceKm: DEFAULT_MAX_DISTANCE_KM,
      maxHeightM: DEFAULT_MAX_HEIGHT_M,
    },
    clouds: cloudsWithLifecycle,
    summary: summarize(cloudsWithLifecycle),
  };
}

export {
  DEFAULT_MAX_DISTANCE_KM,
  DEFAULT_MAX_HEIGHT_M,
  DEFAULT_PROFILE_CLOUDS,
  analyzePersistentDarkClouds,
  getLightBand,
  simulateFireCloudProfile,
};
