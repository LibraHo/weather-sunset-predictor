import {
  DEFAULT_MAX_DISTANCE_KM,
  DEFAULT_MAX_HEIGHT_M,
  DEFAULT_PROFILE_CLOUDS,
  getLightBand,
  simulateFireCloudProfile,
} from '../services/FireCloudProfileSimulator.js';
import i18n from '../i18n.js';

function cloneClouds() {
  return DEFAULT_PROFILE_CLOUDS.map(cloud => ({ ...cloud }));
}

function solarElevationFromTimeOffset(offsetMinutes, mode = 'sunset') {
  const offset = Number(offsetMinutes) || 0;
  const direction = mode === 'sunrise' ? 1 : -1;
  return Math.max(-5.5, Math.min(7.5, 0.6 + offset * 0.12 * direction));
}

function px(value, max, size, inset) {
  return inset + (value / max) * (size - inset * 2);
}

function py(value, max, size, inset) {
  return size - inset - (value / max) * (size - inset * 2);
}

function scaledRatio(value, max, scale, offset) {
  const number = Math.max(0, Number(value) || 0);
  if (scale !== 'log') return number / max;
  return Math.log10(number + offset) / Math.log10(max + offset);
}

function scaledPx(value, max, size, inset, scale, offset = 1) {
  return inset + scaledRatio(value, max, scale, offset) * (size - inset * 2);
}

function scaledPy(value, max, size, inset, scale, offset = 100) {
  return size - inset - scaledRatio(value, max, scale, offset) * (size - inset * 2);
}

function bounded(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hashCloudId(id) {
  return Array.from(String(id)).reduce((hash, char) => hash + char.charCodeAt(0), 0);
}

function noise(seed, index) {
  const x = Math.sin(seed * 12.9898 + index * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function hexToRgb(hex) {
  const value = String(hex || '').replace('#', '');
  if (value.length !== 6) return { r: 255, g: 183, b: 77 };
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function translate(key, fallback, params = {}) {
  const translated = i18n?.t?.(key, params);
  return translated && translated !== key ? translated : fallback;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function projectFacingSunCloud(cloud, { width, height, inset }) {
  const usableWidth = width - inset * 2;
  const usableHeight = height - inset * 2;
  const distanceKm = bounded(Number(cloud.distanceKm) || 0, 0, DEFAULT_MAX_DISTANCE_KM);
  const perspective = bounded(1 - distanceKm / (DEFAULT_MAX_DISTANCE_KM * 1.18), 0.24, 1);
  const seed = hashCloudId(cloud.id || cloud.label || distanceKm);
  const lateralJitter = (noise(seed, 2) - 0.5) * usableWidth * 0.26 * perspective;
  const widthPx = bounded((Number(cloud.widthKm) || 18) * 5.6 * perspective, 28, usableWidth * 0.72);
  const topY = scaledPy(cloud.topHeightM, DEFAULT_MAX_HEIGHT_M, height, inset, 'linear', 100);
  const baseY = scaledPy(cloud.baseHeightM, DEFAULT_MAX_HEIGHT_M, height, inset, 'linear', 100);
  const heightPx = bounded((baseY - topY) * (0.62 + perspective * 0.48), 18, usableHeight * 0.74);
  const centerY = bounded((topY + baseY) / 2 + (1 - perspective) * 32, inset + heightPx / 2, height - inset - heightPx / 2);
  const x = bounded(width / 2 + lateralJitter - widthPx / 2, inset, width - inset - widthPx);

  return {
    x,
    y: centerY - heightPx / 2,
    centerX: x + widthPx / 2,
    centerY,
    width: widthPx,
    height: heightPx,
    perspective,
  };
}

class FireCloudProfileSimulatorView {
  constructor(documentRef = document) {
    this.document = documentRef;
    this.panel = documentRef.getElementById('tab-panel-simulator');
    this.canvas = documentRef.getElementById('firecloud-profile-canvas');
    this.ctx = this.canvas?.getContext?.('2d') || null;
    this.clouds = cloneClouds();
    this.selectedCloudId = this.clouds[0]?.id || null;
    this.mode = 'sunset';
    this.timeOffset = 0;
    this.axisScale = 'linear';
    this.viewMode = 'crossSection';
    this.bound = false;
  }

  initialize() {
    if (!this.panel || !this.canvas || !this.ctx || this.bound) return;
    this.bound = true;
    this.cacheElements();
    this.bindEvents();
    this.syncCloudSelect();
    this.syncSelectedInputs();
    this.render();
  }

  cacheElements() {
    const byId = id => this.document.getElementById(id);
    this.modeInput = byId('profile-mode');
    this.timeInput = byId('profile-solar-time');
    this.timeValue = byId('profile-solar-time-value');
    this.axisScaleInput = byId('profile-axis-scale');
    this.viewModeInput = byId('profile-view-mode');
    this.cloudSelect = byId('profile-cloud-select');
    this.distanceInput = byId('profile-selected-distance');
    this.baseInput = byId('profile-selected-base-height');
    this.topInput = byId('profile-selected-top-height');
    this.coverageInput = byId('profile-selected-coverage');
    this.widthInput = byId('profile-selected-width');
    this.opticalDepthInput = byId('profile-selected-optical-depth');
    this.addButton = byId('profile-add-cloud');
    this.resetButton = byId('profile-reset-clouds');
    this.summaryEl = byId('profile-summary');
    this.selectedReasonEl = byId('profile-selected-reason');
    this.cloudListEl = this.panel.querySelector('[data-profile-cloud-list]');
    this.modeLabel = byId('profile-mode-label');
    this.solarAngle = byId('profile-solar-angle');
    this.axisDistanceNote = byId('profile-axis-distance-note');
    this.axisHeightNote = byId('profile-axis-height-note');
  }

  bindEvents() {
    this.modeInput?.addEventListener('change', () => {
      this.mode = this.modeInput.value === 'sunrise' ? 'sunrise' : 'sunset';
      this.render();
    });
    this.timeInput?.addEventListener('input', () => {
      this.timeOffset = Number(this.timeInput.value) || 0;
      this.render();
    });
    this.axisScaleInput?.addEventListener('change', () => {
      this.axisScale = this.axisScaleInput.value === 'log' ? 'log' : 'linear';
      this.render();
    });
    this.viewModeInput?.addEventListener('change', () => {
      this.viewMode = this.viewModeInput.value === 'facingSun' ? 'facingSun' : 'crossSection';
      this.render();
    });
    this.cloudSelect?.addEventListener('change', () => {
      this.selectedCloudId = this.cloudSelect.value;
      this.syncSelectedInputs();
      this.render();
    });

    [
      this.distanceInput,
      this.baseInput,
      this.topInput,
      this.coverageInput,
      this.widthInput,
      this.opticalDepthInput,
    ].forEach(input => input?.addEventListener('input', () => this.updateSelectedCloud()));

    this.addButton?.addEventListener('click', () => this.addCloud());
    this.resetButton?.addEventListener('click', () => this.resetClouds());
  }

  get selectedCloud() {
    return this.clouds.find(cloud => cloud.id === this.selectedCloudId) || this.clouds[0];
  }

  syncCloudSelect() {
    if (!this.cloudSelect) return;
    this.cloudSelect.innerHTML = this.clouds.map(cloud =>
      `<option value="${cloud.id}">${this.cloudLabel(cloud)}</option>`
    ).join('');
    this.cloudSelect.value = this.selectedCloudId;
  }

  syncSelectedInputs() {
    const cloud = this.selectedCloud;
    if (!cloud) return;
    this.distanceInput.value = cloud.distanceKm;
    this.baseInput.value = cloud.baseHeightM;
    this.topInput.value = cloud.topHeightM;
    this.coverageInput.value = cloud.coverage;
    if (this.widthInput) this.widthInput.value = cloud.widthKm;
    this.opticalDepthInput.value = cloud.opticalDepth;
  }

  updateSelectedCloud() {
    const cloud = this.selectedCloud;
    if (!cloud) return;

    cloud.distanceKm = clampNumber(this.distanceInput.value, 0, DEFAULT_MAX_DISTANCE_KM, 0);
    cloud.baseHeightM = clampNumber(this.baseInput.value, 0, DEFAULT_MAX_HEIGHT_M - 50, 0);
    cloud.topHeightM = clampNumber(this.topInput.value, cloud.baseHeightM + 50, DEFAULT_MAX_HEIGHT_M, cloud.baseHeightM + 50);
    cloud.coverage = clampNumber(this.coverageInput.value, 0, 100, 0);
    cloud.widthKm = clampNumber(this.widthInput?.value, 2, 80, 18);
    cloud.opticalDepth = clampNumber(this.opticalDepthInput.value, 0.05, 1.6, 0.05);
    this.syncSelectedInputs();
    this.render();
  }

  addCloud() {
    const nextIndex = this.clouds.length + 1;
    const cloud = {
      id: `custom-cloud-${Date.now()}`,
      label: translate('home.simulator.customCloudLabel', `Custom cloud ${nextIndex}`, { index: nextIndex }),
      distanceKm: 30 + nextIndex * 8,
      baseHeightM: 1800 + nextIndex * 450,
      topHeightM: 3100 + nextIndex * 450,
      coverage: 52,
      widthKm: 16,
      opticalDepth: 0.5,
    };
    this.clouds.push(cloud);
    this.selectedCloudId = cloud.id;
    this.syncCloudSelect();
    this.syncSelectedInputs();
    this.render();
  }

  resetClouds() {
    this.clouds = cloneClouds();
    this.selectedCloudId = this.clouds[0]?.id || null;
    this.syncCloudSelect();
    this.syncSelectedInputs();
    this.render();
  }

  render() {
    const solarElevationDeg = solarElevationFromTimeOffset(this.timeOffset, this.mode);
    const result = simulateFireCloudProfile({
      mode: this.mode,
      solarElevationDeg,
      clouds: this.clouds,
      includeLifecycle: true,
    });
    this.lastResult = result;
    this.renderReadouts(result);
    this.drawProfile(result);
    this.renderCloudList(result);
  }

  renderReadouts(result) {
    const modeText = this.modeText(this.mode);
    if (this.modeLabel) this.modeLabel.textContent = modeText;
    if (this.solarAngle) this.solarAngle.textContent = `${result.sun.solarElevationDeg}°`;
    if (this.timeValue) {
      const offset = this.timeOffset;
      this.timeValue.textContent = offset === 0
        ? translate(
          `home.simulator.time.at${this.mode === 'sunrise' ? 'Sunrise' : 'Sunset'}`,
          `${modeText} time`
        )
        : translate(
          offset > 0 ? 'home.simulator.time.after' : 'home.simulator.time.before',
          `${Math.abs(offset)} min ${offset > 0 ? 'after' : 'before'} ${modeText}`,
          { mode: modeText, minutes: Math.abs(offset) }
        );
    }
    if (this.summaryEl) {
      this.summaryEl.textContent = translate(
        'home.simulator.summary',
        `Lit ${result.summary.litCount}, blockers ${result.summary.blockingCount}, shadowed ${result.summary.blockedCount}, dimmed ${result.summary.dimmedCount}, always dark ${result.summary.alwaysDarkCount}`,
        {
          lit: result.summary.litCount,
          blocking: result.summary.blockingCount,
          shadowed: result.summary.blockedCount,
          dimmed: result.summary.dimmedCount,
          alwaysDark: result.summary.alwaysDarkCount,
        }
      );
    }
    if (this.axisDistanceNote) {
      this.axisDistanceNote.textContent = this.viewMode === 'facingSun'
        ? translate('home.simulator.view.facingDistanceNote', 'Depth: 25-150 km distance rings')
        : translate('home.simulator.axisDistance', 'Distance X: 0-150 km');
    }
    if (this.axisHeightNote) {
      this.axisHeightNote.textContent = this.viewMode === 'facingSun'
        ? translate('home.simulator.view.facingHeightNote', 'Height: cloud base/top projected in meters')
        : translate('home.simulator.axisHeight', 'Height Y: 0-12000 m');
    }
    if (this.selectedReasonEl) {
      const selected = result.clouds.find(cloud => cloud.id === this.selectedCloudId);
      this.selectedReasonEl.textContent = selected
        ? translate(
          'home.simulator.selectedReason',
          `${this.cloudLabel(selected)}: ${this.reasonText(selected)}`,
          { label: this.cloudLabel(selected), reason: this.reasonText(selected) }
        )
        : translate('home.simulator.selectCloudHint', 'Select a cloud to inspect the decision reason');
    }
  }

  drawProfile(result) {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const inset = 44;

    ctx.clearRect(0, 0, width, height);
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#18294f');
    sky.addColorStop(0.46, '#6f6f9f');
    sky.addColorStop(1, '#f2a35f');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    if (this.viewMode === 'facingSun') {
      this.drawFacingSunView(result, inset, width, height);
      return;
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.24)';
    ctx.lineWidth = 1;
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.78)';

    const distanceTicks = this.axisScale === 'log'
      ? [0, 1, 3, 10, 30, 75, 150]
      : [0, 30, 60, 90, 120, 150];
    const heightTicks = this.axisScale === 'log'
      ? [0, 100, 300, 1000, 3000, 6000, 12000]
      : [0, 3000, 6000, 9000, 12000];

    distanceTicks.forEach((km) => {
      const x = scaledPx(km, DEFAULT_MAX_DISTANCE_KM, width, inset, this.axisScale, 1);
      ctx.beginPath();
      ctx.moveTo(x, inset);
      ctx.lineTo(x, height - inset);
      ctx.stroke();
      ctx.fillText(`${km}km`, x - 14, height - 16);
    });

    heightTicks.forEach((meters) => {
      const y = scaledPy(meters, DEFAULT_MAX_HEIGHT_M, height, inset, this.axisScale, 100);
      ctx.beginPath();
      ctx.moveTo(inset, y);
      ctx.lineTo(width - inset, y);
      ctx.stroke();
      ctx.fillText(`${meters}m`, 8, y + 4);
    });

    ctx.fillStyle = 'rgba(255,255,255,0.86)';
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillText(
      this.axisScale === 'log'
        ? translate('home.simulator.axis.logShort', 'LOG axis')
        : translate('home.simulator.axis.linearShort', 'LINEAR axis'),
      width - inset - 88,
      inset - 14
    );

    this.drawSunAndLight(result, inset, width, height);
    result.clouds.forEach(cloud => this.drawCloud(cloud, inset, width, height));
  }

  drawFacingSunView(result, inset, width, height) {
    const ctx = this.ctx;
    const horizonY = height - inset - 54;
    const centerX = width / 2;

    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillText(
      translate('home.simulator.view.facingSunShort', 'FACING SUN'),
      width - inset - 112,
      inset - 14
    );

    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(inset, horizonY);
    ctx.lineTo(width - inset, horizonY);
    ctx.stroke();

    [25, 50, 100, 150].forEach((distanceKm) => {
      const ratio = distanceKm / DEFAULT_MAX_DISTANCE_KM;
      const ringWidth = (width - inset * 2) * (1 - ratio * 0.64);
      const ringY = horizonY - 18 - ratio * 72;
      ctx.strokeStyle = 'rgba(255,255,255,0.13)';
      ctx.beginPath();
      ctx.ellipse(centerX, ringY, ringWidth / 2, 18 + ratio * 12, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.58)';
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText(`${distanceKm}km`, centerX + ringWidth / 2 - 30, ringY - 4);
    });

    const sunY = horizonY + Math.min(30, Math.max(-26, -result.sun.solarElevationDeg * 8));
    const sunGradient = ctx.createRadialGradient(centerX, sunY, 8, centerX, sunY, 76);
    sunGradient.addColorStop(0, '#fff8c7');
    sunGradient.addColorStop(0.36, '#ffb347');
    sunGradient.addColorStop(1, 'rgba(255,112,67,0)');
    ctx.fillStyle = sunGradient;
    ctx.beginPath();
    ctx.arc(centerX, sunY, 76, 0, Math.PI * 2);
    ctx.fill();

    const sortedClouds = [...result.clouds].sort((a, b) => b.distanceKm - a.distanceKm);
    sortedClouds.forEach(cloud => this.drawFacingSunCloud(cloud, inset, width, height));
  }

  drawFacingSunCloud(cloud, inset, width, height) {
    const ctx = this.ctx;
    const projection = projectFacingSunCloud(cloud, { width, height, inset });
    const selected = cloud.id === this.selectedCloudId;
    const drawColor = cloud.alwaysDark ? '#111827' : cloud.color;
    const alpha = cloud.status === 'shadowed' || cloud.status === 'unlit'
      ? 0.68
      : 0.86 + projection.perspective * 0.1;

    ctx.globalAlpha = alpha;
    this.drawRadarCloudField({
      x: projection.centerX,
      y: projection.centerY,
      width: projection.width,
      height: projection.height,
      color: drawColor,
      seed: hashCloudId(`${cloud.id}-facing`),
      selected,
      alwaysDark: cloud.alwaysDark,
      illumination: cloud.illumination || 0,
      coverage: cloud.coverage,
      status: cloud.status,
    });
    ctx.globalAlpha = 1;

    ctx.fillStyle = selected ? '#ffffff' : 'rgba(255,255,255,0.82)';
    ctx.font = selected ? '700 12px system-ui, sans-serif' : '12px system-ui, sans-serif';
    ctx.fillText(`${cloud.distanceKm}km`, projection.x + 4, projection.y - 8);
    ctx.fillText(this.statusText(cloud.status), projection.x + 4, projection.y + projection.height + 16);
  }

  drawSunAndLight(result, inset, width, height) {
    const ctx = this.ctx;
    const isSunrise = result.sun.mode === 'sunrise';
    const solarX = isSunrise ? inset - 14 : width - inset + 14;
    const solarY = scaledPy(Math.max(0, result.sun.solarElevationDeg + 2) * 650, DEFAULT_MAX_HEIGHT_M, height, inset, this.axisScale, 100);
    const sunGradient = ctx.createRadialGradient(solarX, solarY, 6, solarX, solarY, 38);
    sunGradient.addColorStop(0, '#fff7c2');
    sunGradient.addColorStop(0.45, '#ffb547');
    sunGradient.addColorStop(1, 'rgba(255,111,67,0)');
    ctx.fillStyle = sunGradient;
    ctx.beginPath();
    ctx.arc(solarX, solarY, 38, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 215, 124, 0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    for (let km = 0; km <= DEFAULT_MAX_DISTANCE_KM; km += 3) {
      const band = getLightBand(km, result.sun.solarElevationDeg, result.sun.mode);
      const x = scaledPx(km, DEFAULT_MAX_DISTANCE_KM, width, inset, this.axisScale, 1);
      const y = scaledPy(Math.max(0, Math.min(DEFAULT_MAX_HEIGHT_M, band.center)), DEFAULT_MAX_HEIGHT_M, height, inset, this.axisScale, 100);
      if (km === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawCloud(cloud, inset, width, height) {
    const ctx = this.ctx;
    const selected = cloud.id === this.selectedCloudId;
    const x = scaledPx(cloud.distanceKm, DEFAULT_MAX_DISTANCE_KM, width, inset, this.axisScale, 1);
    const yTop = scaledPy(cloud.topHeightM, DEFAULT_MAX_HEIGHT_M, height, inset, this.axisScale, 100);
    const yBase = scaledPy(cloud.baseHeightM, DEFAULT_MAX_HEIGHT_M, height, inset, this.axisScale, 100);
    const leftDistance = Math.max(0, cloud.distanceKm - (cloud.widthKm || 18) / 2);
    const rightDistance = Math.min(DEFAULT_MAX_DISTANCE_KM, cloud.distanceKm + (cloud.widthKm || 18) / 2);
    const cloudWidth = Math.max(
      28,
      scaledPx(rightDistance, DEFAULT_MAX_DISTANCE_KM, width, inset, this.axisScale, 1) -
      scaledPx(leftDistance, DEFAULT_MAX_DISTANCE_KM, width, inset, this.axisScale, 1)
    );
    const cloudHeight = Math.max(18, yBase - yTop);
    const alpha = cloud.status === 'shadowed' || cloud.status === 'unlit' ? 0.7 : 0.9;
    const drawColor = cloud.alwaysDark ? '#111827' : cloud.color;

    ctx.globalAlpha = alpha;
    this.drawRadarCloudField({
      x,
      y: yTop + cloudHeight / 2,
      width: cloudWidth,
      height: cloudHeight,
      color: drawColor,
      seed: hashCloudId(cloud.id),
      selected,
      alwaysDark: cloud.alwaysDark,
      illumination: cloud.illumination || 0,
      coverage: cloud.coverage,
      status: cloud.status,
    });
    ctx.globalAlpha = 1;

    ctx.fillStyle = selected ? '#ffffff' : 'rgba(255,255,255,0.88)';
    ctx.font = selected ? '700 12px system-ui, sans-serif' : '12px system-ui, sans-serif';
    ctx.fillText(`${cloud.distanceKm}km`, x - 22, yTop - 8);
    ctx.fillText(`${cloud.baseHeightM}-${cloud.topHeightM}m`, x - 42, yBase + 16);
    if (cloud.alwaysDark) {
      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 11px system-ui, sans-serif';
      ctx.fillText(translate('home.simulator.status.alwaysDarkShort', 'Dark'), x - 22, yTop + 14);
    }
  }

  drawRadarCloudField({ x, y, width, height, color, seed, selected, alwaysDark, illumination, coverage, status }) {
    const ctx = this.ctx;
    const density = Math.max(0.28, Math.min(1, coverage / 100));
    const warmAlpha = alwaysDark || status === 'shadowed' || status === 'unlit'
      ? 0
      : Math.max(0.08, Math.min(0.38, illumination * 0.36));
    ctx.save();

    this.fillSoftEllipse(
      x,
      y,
      width * 0.74,
      height * 0.64,
      alwaysDark ? 'rgba(15,23,42,0.62)' : 'rgba(236,239,232,0.34)',
      'rgba(236,239,232,0)'
    );

    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowBlur = 12;
    ctx.shadowColor = alwaysDark ? 'rgba(15,23,42,0.36)' : 'rgba(51,65,85,0.22)';

    for (let index = 0; index < 34; index += 1) {
      const n1 = noise(seed, index);
      const n2 = noise(seed + 3, index);
      const n3 = noise(seed + 7, index);
      const px = x + (n1 - 0.5) * width * 0.92;
      const py = y + (n2 - 0.5) * height * 0.82;
      const radiusX = width * (0.13 + n3 * 0.18);
      const radiusY = Math.max(8, height * (0.16 + noise(seed + 11, index) * 0.24));
      const gray = alwaysDark ? 28 + Math.floor(n2 * 42) : 118 + Math.floor(n2 * 94);
      const alpha = alwaysDark
        ? 0.18 + density * 0.16 * n3
        : 0.08 + density * 0.18 * n3;
      ctx.fillStyle = `rgba(${gray}, ${gray + 4}, ${gray + 8}, ${alpha})`;
      ctx.beginPath();
      ctx.ellipse(px, py, radiusX, radiusY, (n1 - 0.5) * 0.9, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    if (warmAlpha > 0) {
      this.fillSoftEllipse(
        x + width * 0.08,
        y + height * 0.08,
        width * 0.48,
        height * 0.36,
        rgba(color, warmAlpha),
        rgba(color, 0)
      );
    }

    ctx.strokeStyle = alwaysDark ? 'rgba(15,23,42,0.34)' : 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    for (let ring = 0.45; ring <= 0.96; ring += 0.17) {
      ctx.beginPath();
      ctx.ellipse(x, y, width * ring * 0.46, height * ring * 0.38, -0.06, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.globalAlpha *= 0.74;
    ctx.strokeStyle = alwaysDark ? 'rgba(15,23,42,0.24)' : 'rgba(248,250,252,0.18)';
    for (let line = -4; line <= 4; line += 1) {
      ctx.beginPath();
      ctx.moveTo(x - width * 0.48, y + line * height * 0.11);
      ctx.lineTo(x + width * 0.48, y + line * height * 0.11 - height * 0.12);
      ctx.stroke();
    }

    if (selected) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.86)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.ellipse(x, y, width * 0.5, height * 0.42, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  fillSoftEllipse(x, y, radiusX, radiusY, centerColor, edgeColor) {
    const ctx = this.ctx;
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    gradient.addColorStop(0, centerColor);
    gradient.addColorStop(0.72, centerColor);
    gradient.addColorStop(1, edgeColor);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(radiusX, radiusY);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  roundRect(ctx, x, y, width, height, radius) {
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, width, height, radius);
      return;
    }
    const r = Math.min(radius, width / 2, height / 2);
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
  }

  renderCloudList(result) {
    if (!this.cloudListEl) return;
    this.cloudListEl.innerHTML = result.clouds.map(cloud => `
      <button class="profile-cloud-row ${cloud.id === this.selectedCloudId ? 'active' : ''} ${cloud.alwaysDark ? 'always-dark' : ''}" type="button" data-cloud-id="${cloud.id}">
        <span class="profile-cloud-swatch" style="background:${cloud.alwaysDark ? '#111827' : cloud.color}"></span>
        <strong>${this.cloudLabel(cloud)}</strong>
        <small>${cloud.distanceKm}km · ${translate('home.simulator.widthLabel', '{{width}} km wide', { width: cloud.widthKm })} · ${cloud.baseHeightM}-${cloud.topHeightM}m · ${cloud.alwaysDark ? translate('home.simulator.status.alwaysDark', 'Always dark cloud') : this.statusText(cloud.status)} · ${this.reasonText(cloud)}</small>
      </button>
    `).join('');
    this.cloudListEl.querySelectorAll('[data-cloud-id]').forEach(button => {
      button.addEventListener('click', () => {
        this.selectedCloudId = button.dataset.cloudId;
        this.syncCloudSelect();
        this.syncSelectedInputs();
        this.render();
      });
    });
  }

  statusText(status) {
    return {
      lit: translate('home.simulator.status.lit', 'Lit'),
      dimmed: translate('home.simulator.status.dimmed', 'Dimmed'),
      shadowed: translate('home.simulator.status.shadowed', 'Shadowed'),
      blocking: translate('home.simulator.status.blocking', 'Blocking wall'),
      unlit: translate('home.simulator.status.unlit', 'Unlit'),
    }[status] || status;
  }

  cloudLabel(cloud) {
    if (!cloud) return '';
    return cloud.labelKey
      ? translate(cloud.labelKey, cloud.label || cloud.id)
      : cloud.label;
  }

  modeText(mode) {
    return mode === 'sunrise'
      ? translate('home.simulator.mode.sunrise', 'Sunrise')
      : translate('home.simulator.mode.sunset', 'Sunset');
  }

  reasonText(cloud) {
    if (cloud.alwaysDark) return translate('home.simulator.reasons.alwaysDark', 'The full sampled window misses the warm light band');
    if (cloud.status === 'shadowed') return translate('home.simulator.reasons.shadowed', 'Covered by the shadow band from an upstream cloud');
    if (cloud.status === 'blocking') return translate('home.simulator.reasons.blocking', 'Low-angle light forms a blocking cloud wall');
    if (cloud.status === 'dimmed') return translate('home.simulator.reasons.dimmed', 'The cloud veil is thick enough to absorb warm light');
    if (cloud.status === 'lit') return translate('home.simulator.reasons.lit', 'Cloud height intersects the scattered light band');
    if (cloud.status === 'unlit') return translate('home.simulator.reasons.unlit', 'Cloud height has not reached the light band yet');
    return cloud.reason || '';
  }
}

export default FireCloudProfileSimulatorView;
export { projectFacingSunCloud, solarElevationFromTimeOffset };
