import { applyPageSettings, readAppSettings } from '../../utils/app-settings.js';

const MAX_DISTANCE_KM = 150;
const MAX_HEIGHT_M = 12000;
const CANVAS_WIDTH = 680;
const CANVAS_HEIGHT = 520;
const PLOT = { left: 46, right: 32, top: 28, bottom: 48 };

const DEFAULT_SIMULATOR_CLOUDS = [
  { id: 'cloud-01', name: '远端卷云', distanceKm: 118, baseHeightM: 7600, topHeightM: 9300, coverage: 62, widthKm: 24, opticalDepth: 0.38 },
  { id: 'cloud-02', name: '中层云带', distanceKm: 76, baseHeightM: 3100, topHeightM: 5200, coverage: 70, widthKm: 30, opticalDepth: 0.72 },
  { id: 'cloud-03', name: '近处低云', distanceKm: 28, baseHeightM: 700, topHeightM: 1900, coverage: 82, widthKm: 18, opticalDepth: 1.1 },
  { id: 'cloud-04', name: '薄云开口', distanceKm: 48, baseHeightM: 5400, topHeightM: 6900, coverage: 38, widthKm: 14, opticalDepth: 0.45 }
];

Page({
  data: {
    themeMode: 'system',
    resolvedThemeMode: 'light',
    mode: 'sunset',
    viewMode: 'crossSection',
    timeOffset: 0,
    timeOffsetText: '事件时刻',
    solarAngleText: '+0.2°',
    viewTitle: '太阳方向横切面',
    summaryText: '',
    selectedCloudId: 'cloud-01',
    selectedCloud: DEFAULT_SIMULATOR_CLOUDS[0],
    clouds: DEFAULT_SIMULATOR_CLOUDS,
    cloudRows: []
  },

  onLoad() {
    this.applySavedSettings();
    this.updateSimulation();
  },

  onShow() {
    this.applySavedSettings();
  },

  onReady() {
    this.renderSimulator();
  },

  applySavedSettings() {
    applyPageSettings(this);
  },

  onAppSettingsChange(event) {
    this.setData(event.detail || readAppSettings());
  },

  selectMode(event) {
    const mode = event.currentTarget.dataset.mode;
    if (mode !== 'sunrise' && mode !== 'sunset') return;
    this.setData({ mode });
    this.updateSimulation();
  },

  selectViewMode(event) {
    const viewMode = event.currentTarget.dataset.view;
    if (viewMode !== 'crossSection' && viewMode !== 'facingSun') return;
    this.setData({ viewMode });
    this.updateSimulation();
  },

  updateTimeOffset(event) {
    const value = toNumber(event.detail.value, 0);
    this.setData({ timeOffset: clamp(value, -30, 30) });
    this.updateSimulation();
  },

  selectCloud(event) {
    const id = event.currentTarget.dataset.id;
    const cloud = findCloud(this.data.clouds, id);
    if (!cloud) return;
    this.setData({ selectedCloudId: id, selectedCloud: cloud });
  },

  updateCloudField(event) {
    const field = event.currentTarget.dataset.field;
    const value = toNumber(event.detail.value, 0);
    const clouds = this.data.clouds.map((cloud) => {
      if (cloud.id !== this.data.selectedCloudId) return cloud;
      const next = Object.assign({}, cloud);
      next[field] = normalizeCloudField(field, value, cloud);
      if (field === 'baseHeightM' && next.topHeightM <= next.baseHeightM) next.topHeightM = next.baseHeightM + 300;
      if (field === 'topHeightM' && next.baseHeightM >= next.topHeightM) next.baseHeightM = Math.max(0, next.topHeightM - 300);
      return next;
    });
    this.setData({ clouds, selectedCloud: findCloud(clouds, this.data.selectedCloudId) || clouds[0] });
    this.updateSimulation();
  },

  addCloud() {
    const index = this.data.clouds.length + 1;
    const id = `cloud-${String(index).padStart(2, '0')}`;
    const cloud = {
      id,
      name: `自定义云 ${index}`,
      distanceKm: clamp(24 + index * 14, 8, 135),
      baseHeightM: 1800 + index * 420,
      topHeightM: 3200 + index * 520,
      coverage: 55,
      widthKm: 18,
      opticalDepth: 0.65
    };
    const clouds = this.data.clouds.concat(cloud);
    this.setData({ clouds, selectedCloudId: id, selectedCloud: cloud });
    this.updateSimulation();
  },

  updateSimulation() {
    const solarElevationDeg = solarElevationFromTimeOffset(this.data.mode, this.data.timeOffset);
    const profile = simulateFirecloudProfile(this.data.clouds, {
      mode: this.data.mode,
      solarElevationDeg,
      includeLifecycle: true
    });
    const selectedCloud = findCloud(this.data.clouds, this.data.selectedCloudId) || this.data.clouds[0];
    const timeOffsetText = formatTimeOffset(this.data.timeOffset);
    const solarAngleText = `${solarElevationDeg >= 0 ? '+' : ''}${solarElevationDeg.toFixed(1)}°`;
    const viewTitle = this.data.viewMode === 'facingSun' ? '正对日出/日落方向' : '太阳方向横切面';
    const summaryText = `${profile.litCount} 块照亮 · ${profile.shadowedCount} 块遮挡/未照亮 · ${profile.alwaysDarkCount} 块全程黑`;

    this.setData({
      cloudRows: profile.cloudRows,
      selectedCloud,
      timeOffsetText,
      solarAngleText,
      viewTitle,
      summaryText
    });
    this.renderSimulator(profile, solarElevationDeg);
  },

  renderSimulator(profile, solarElevationDeg) {
    if (typeof wx === 'undefined' || !wx.createCanvasContext) return;
    const resolvedProfile = profile || simulateFirecloudProfile(this.data.clouds, {
      mode: this.data.mode,
      solarElevationDeg: solarElevationDeg || solarElevationFromTimeOffset(this.data.mode, this.data.timeOffset),
      includeLifecycle: true
    });
    const elevation = solarElevationDeg || solarElevationFromTimeOffset(this.data.mode, this.data.timeOffset);
    const ctx = wx.createCanvasContext('firecloudSimulatorCanvas', this);
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawBackground(ctx);
    if (this.data.viewMode === 'facingSun') {
      drawFacingSunView(ctx, resolvedProfile.cloudRows, elevation);
    } else {
      drawCrossSectionView(ctx, resolvedProfile.cloudRows, elevation);
    }
    ctx.draw();
  }
});

function simulateFirecloudProfile(clouds, options) {
  const solarElevationDeg = toNumber(options.solarElevationDeg, 0);
  const sorted = clouds.slice().sort((a, b) => b.distanceKm - a.distanceKm);
  const blockers = [];
  const rows = sorted.map((cloud) => {
    const row = computeCloudState(cloud, solarElevationDeg, blockers);
    if (row.blocksLight) blockers.push(row);
    return row;
  });
  if (options.includeLifecycle) {
    const samples = lifecycleElevations(options.mode);
    for (const row of rows) {
      const sampleStates = samples.map((angle) => computeCloudState(row.source, angle, blockersWithout(row.source.id, clouds, angle)));
      row.alwaysDark = sampleStates.every((state) => state.status === 'shadowed' || state.status === 'unlit' || state.illumination < 0.18);
    }
  }
  const cloudRows = rows
    .sort((a, b) => a.source.distanceKm - b.source.distanceKm)
    .map(toCloudRow);
  return {
    cloudRows,
    litCount: cloudRows.filter((row) => row.status === 'lit').length,
    shadowedCount: cloudRows.filter((row) => row.status === 'shadowed' || row.status === 'unlit').length,
    alwaysDarkCount: cloudRows.filter((row) => row.alwaysDark).length
  };
}

function computeCloudState(cloud, solarElevationDeg, blockers) {
  const rayHeight = Math.tan((solarElevationDeg * Math.PI) / 180) * cloud.distanceKm * 1000;
  const centerHeight = (cloud.baseHeightM + cloud.topHeightM) / 2;
  const thickness = Math.max(150, cloud.topHeightM - cloud.baseHeightM);
  const intersects = rayHeight >= cloud.baseHeightM - 260 && rayHeight <= cloud.topHeightM + 520;
  const blockedBy = blockers.find((blocker) => isBehindBlocker(cloud, blocker.source, rayHeight));
  const heightGap = Math.abs(centerHeight - rayHeight);
  const proximity = clamp(1 - heightGap / Math.max(900, thickness * 1.4), 0, 1);
  const thinness = clamp(1.35 - cloud.opticalDepth, 0.18, 1);
  let illumination = intersects ? proximity * thinness : 0;
  let status = 'unlit';
  let reason = '光线高度没有碰到这块云。';

  if (blockedBy) {
    status = 'shadowed';
    illumination *= 0.22;
    reason = `被 ${blockedBy.source.name} 的云墙挡光。`;
  } else if (intersects && cloud.opticalDepth > 0.95) {
    status = 'dimmed';
    illumination = Math.max(0.18, illumination * 0.62);
    reason = '几何可达，但云体偏厚，颜色转灰紫。';
  } else if (intersects && illumination >= 0.2) {
    status = 'lit';
    reason = solarElevationDeg < 0 ? '太阳低于地平线，仍有红粉散射擦亮云底。' : '低角度光线穿过云体，形成暖色照亮。';
  }

  const blocksLight = cloud.coverage >= 62 && cloud.opticalDepth >= 0.7 && intersects;
  return {
    source: cloud,
    status,
    statusText: statusLabel(status),
    reason,
    illumination: clamp(illumination, 0, 1),
    rayHeight,
    blocksLight,
    color: statusColor(status, illumination)
  };
}

function blockersWithout(id, clouds, angle) {
  const blockers = [];
  const sorted = clouds.slice().sort((a, b) => b.distanceKm - a.distanceKm);
  for (const cloud of sorted) {
    if (cloud.id === id) continue;
    const row = computeCloudState(cloud, angle, blockers);
    if (row.blocksLight) blockers.push(row);
  }
  return blockers;
}

function isBehindBlocker(cloud, blocker, rayHeight) {
  if (blocker.distanceKm <= cloud.distanceKm) return false;
  const gapKm = blocker.distanceKm - cloud.distanceKm;
  const shadowReachKm = 10 + blocker.widthKm * 1.6 + blocker.coverage * 0.12;
  const verticalBand = Math.max(900, (blocker.topHeightM - blocker.baseHeightM) * 0.92);
  const blockerCenter = (blocker.topHeightM + blocker.baseHeightM) / 2;
  return gapKm <= shadowReachKm && Math.abs(rayHeight - blockerCenter) <= verticalBand;
}

function toCloudRow(row) {
  const cloud = row.source;
  return {
    id: cloud.id,
    name: cloud.name,
    distanceKm: cloud.distanceKm,
    baseHeightM: cloud.baseHeightM,
    topHeightM: cloud.topHeightM,
    coverage: cloud.coverage,
    widthKm: cloud.widthKm,
    opticalDepth: cloud.opticalDepth,
    status: row.status,
    statusText: row.statusText,
    reason: row.reason,
    illumination: row.illumination,
    rayHeight: row.rayHeight,
    color: row.color,
    alwaysDark: !!row.alwaysDark,
    distanceText: `${cloud.distanceKm}km`,
    heightText: `${cloud.baseHeightM}-${cloud.topHeightM}m`
  };
}

function drawBackground(ctx) {
  ctx.setFillStyle('#08111f');
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.setStrokeStyle('rgba(148, 163, 184, 0.18)');
  ctx.setLineWidth(1);
  for (let i = 0; i <= 4; i += 1) {
    const y = PLOT.top + ((CANVAS_HEIGHT - PLOT.top - PLOT.bottom) * i) / 4;
    ctx.beginPath();
    ctx.moveTo(PLOT.left, y);
    ctx.lineTo(CANVAS_WIDTH - PLOT.right, y);
    ctx.stroke();
  }
  for (let i = 0; i <= 5; i += 1) {
    const x = PLOT.left + ((CANVAS_WIDTH - PLOT.left - PLOT.right) * i) / 5;
    ctx.beginPath();
    ctx.moveTo(x, PLOT.top);
    ctx.lineTo(x, CANVAS_HEIGHT - PLOT.bottom);
    ctx.stroke();
  }
}

function drawCrossSectionView(ctx, cloudRows, solarElevationDeg) {
  drawSunRay(ctx, solarElevationDeg);
  for (const row of cloudRows) {
    const x = mapDistance(row.distanceKm);
    const yTop = mapHeight(row.topHeightM);
    const yBottom = mapHeight(row.baseHeightM);
    const width = Math.max(32, (row.widthKm / MAX_DISTANCE_KM) * (CANVAS_WIDTH - PLOT.left - PLOT.right));
    drawCloudBlob(ctx, x, (yTop + yBottom) / 2, width, Math.max(28, yBottom - yTop), row);
  }
  drawAxisLabels(ctx, 'distance km', 'height m');
}

function drawFacingSunView(ctx, cloudRows, solarElevationDeg) {
  drawFacingSunDisc(ctx, solarElevationDeg);
  for (const row of cloudRows) {
    const depth = row.distanceKm / MAX_DISTANCE_KM;
    const x = CANVAS_WIDTH / 2 + Math.sin(row.distanceKm * 0.21) * (210 * (1 - depth * 0.4));
    const y = 98 + (1 - row.topHeightM / MAX_HEIGHT_M) * 300 + depth * 52;
    const width = Math.max(42, row.widthKm * (2.4 - depth));
    const height = Math.max(26, ((row.topHeightM - row.baseHeightM) / 1000) * (28 - depth * 8));
    drawCloudBlob(ctx, x, y, width, height, row);
  }
  ctx.setFillStyle('rgba(226, 232, 240, 0.58)');
  ctx.setFontSize(20);
  ctx.fillText('远近由大小与垂直位置表示', 44, CANVAS_HEIGHT - 26);
}

function drawSunRay(ctx, solarElevationDeg) {
  const y0 = CANVAS_HEIGHT - PLOT.bottom;
  const y1 = y0 - Math.tan((solarElevationDeg * Math.PI) / 180) * MAX_DISTANCE_KM * 1000 * ((CANVAS_HEIGHT - PLOT.top - PLOT.bottom) / MAX_HEIGHT_M);
  ctx.setStrokeStyle('rgba(251, 146, 60, 0.9)');
  ctx.setLineWidth(3);
  ctx.beginPath();
  ctx.moveTo(PLOT.left, y0);
  ctx.lineTo(CANVAS_WIDTH - PLOT.right, clamp(y1, PLOT.top, CANVAS_HEIGHT - PLOT.bottom + 26));
  ctx.stroke();
  ctx.setFillStyle('#fb923c');
  ctx.beginPath();
  ctx.arc(PLOT.left, y0, 8, 0, Math.PI * 2);
  ctx.fill();
}

function drawFacingSunDisc(ctx, solarElevationDeg) {
  const y = 350 - solarElevationDeg * 18;
  ctx.setFillStyle('rgba(251, 146, 60, 0.32)');
  ctx.beginPath();
  ctx.arc(CANVAS_WIDTH / 2, clamp(y, 120, 390), 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.setFillStyle('rgba(251, 191, 36, 0.46)');
  ctx.beginPath();
  ctx.arc(CANVAS_WIDTH / 2, clamp(y, 120, 390), 32, 0, Math.PI * 2);
  ctx.fill();
}

function drawCloudBlob(ctx, cx, cy, width, height, row) {
  const color = row.alwaysDark ? '#111827' : row.color;
  const lobes = [-0.36, -0.16, 0.08, 0.28, 0.42];
  if (ctx.setGlobalAlpha) ctx.setGlobalAlpha(row.alwaysDark ? 0.76 : 0.9);
  for (let i = 0; i < lobes.length; i += 1) {
    ctx.setFillStyle(color);
    ctx.beginPath();
    ctx.arc(cx + lobes[i] * width, cy + Math.sin(i) * height * 0.12, Math.max(14, height * (0.52 + (i % 2) * 0.14)), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.setStrokeStyle(row.alwaysDark ? 'rgba(148, 163, 184, 0.38)' : 'rgba(255, 255, 255, 0.25)');
  ctx.setLineWidth(2);
  ctx.beginPath();
  ctx.ellipse(cx, cy, width * 0.48, height * 0.48, 0, 0, Math.PI * 2);
  ctx.stroke();
  if (ctx.setGlobalAlpha) ctx.setGlobalAlpha(1);
}

function drawAxisLabels(ctx, xLabel, yLabel) {
  ctx.setFillStyle('rgba(226, 232, 240, 0.66)');
  ctx.setFontSize(20);
  ctx.fillText(xLabel, CANVAS_WIDTH - 154, CANVAS_HEIGHT - 18);
  ctx.fillText(yLabel, 18, 28);
}

function mapDistance(distanceKm) {
  return PLOT.left + (clamp(distanceKm, 0, MAX_DISTANCE_KM) / MAX_DISTANCE_KM) * (CANVAS_WIDTH - PLOT.left - PLOT.right);
}

function mapHeight(heightM) {
  return CANVAS_HEIGHT - PLOT.bottom - (clamp(heightM, 0, MAX_HEIGHT_M) / MAX_HEIGHT_M) * (CANVAS_HEIGHT - PLOT.top - PLOT.bottom);
}

function solarElevationFromTimeOffset(mode, offset) {
  const t = clamp(offset, -30, 30) / 30;
  if (mode === 'sunrise') return -2.2 + (t + 1) * 2.7;
  return 3.2 - (t + 1) * 2.7;
}

function lifecycleElevations(mode) {
  return mode === 'sunrise' ? [-2.2, -1.0, 0.2, 1.8, 3.2] : [3.2, 1.8, 0.2, -1.0, -2.2];
}

function statusLabel(status) {
  const labels = { lit: '照亮', dimmed: '变暗', shadowed: '遮挡', unlit: '未照亮' };
  return labels[status] || status;
}

function statusColor(status, illumination) {
  if (status === 'lit') return illumination > 0.62 ? '#fb923c' : '#f472b6';
  if (status === 'dimmed') return '#8b7ab8';
  if (status === 'shadowed') return '#475569';
  return '#334155';
}

function formatTimeOffset(offset) {
  if (offset === 0) return '事件时刻';
  return offset < 0 ? `提前 ${Math.abs(offset)} 分钟` : `推后 ${offset} 分钟`;
}

function normalizeCloudField(field, value, cloud) {
  const ranges = {
    distanceKm: [0, MAX_DISTANCE_KM],
    baseHeightM: [0, MAX_HEIGHT_M - 200],
    topHeightM: [200, MAX_HEIGHT_M],
    coverage: [0, 100],
    widthKm: [2, 70],
    opticalDepth: [0.1, 2.2]
  };
  const range = ranges[field];
  if (!range) return cloud[field];
  return clamp(value, range[0], range[1]);
}

function findCloud(clouds, id) {
  return clouds.find((cloud) => cloud.id === id);
}

function toNumber(value, fallback) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export { DEFAULT_SIMULATOR_CLOUDS, simulateFirecloudProfile };
