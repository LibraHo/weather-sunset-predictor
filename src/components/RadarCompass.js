/**
 * RadarCompass
 *
 * Two renderers intentionally live in this component:
 * - Field-of-view altitude radar for new visibleSectorSamples data.
 * - Legacy circular radar for fallback/comparison when sector samples are absent.
 *
 * Both paths use alpha-field cloud rendering; the FOV view anchors irregular
 * cloud patches to real sector samples instead of smearing them into bands.
 */
class RadarCompass {
  constructor(options = {}) {
    this.size = options.size || 300;
    this.fovWidth = options.fovWidth || 640;
    this.fovHeight = options.fovHeight || 400;
  }

  render(container, data = {}) {
    if (!container) return;

    const dirs = this._parse(data?.directions || []);
    const hasVisibleSectorSamples = Array.isArray(data?.visibleSectorSamples)
      && data.visibleSectorSamples.some(sample => sample && !sample.error);

    if (!dirs.length && !hasVisibleSectorSamples) {
      container.innerHTML = '';
      return;
    }

    const context = this._buildRenderContext(data);
    const uid = Math.random().toString(36).slice(2, 9);

    const enableFovAltitudeRadar = data?.enableFovAltitudeRadar !== false;
    if (enableFovAltitudeRadar && hasVisibleSectorSamples) {
      const field = this._buildFovField(data, dirs);
      container.innerHTML = this._buildFovAltitude(field, context.theme, uid, context.text);
      const canvas = container.querySelector(`#radar-cloud-field-${uid}`);
      if (canvas) this._paintFovAltitudeCloudField(canvas, field, context.theme);
      return;
    }

    container.innerHTML = this._buildLegacyCircle(dirs, data?.sunAzimuths || {}, context.theme, data?.predictionType || null, uid, context.text);
    const canvas = container.querySelector(`#radar-cloud-field-${uid}`);
    if (canvas) this._paintLegacyCloudField(canvas, dirs, context.theme);
  }

  _buildRenderContext(data = {}) {
    const cs = getComputedStyle(document.body);
    const v = key => cs.getPropertyValue(key).trim();
    const i18n = window.i18n;
    const lang = (document.documentElement.lang || i18n?.currentLanguage || '').toLowerCase();
    const isChinese = !lang || lang.startsWith('zh');
    const pick = (zh, en) => (isChinese ? zh : en);
    const t = (key, fallback, params = {}) => {
      if (!i18n?.t) return fallback;
      const translated = i18n.t(key, params);
      return translated === key ? fallback : translated;
    };

    return {
      text: {
        N: t('surrounding.directions.N', pick('北', 'N')),
        NE: t('surrounding.directions.NE', pick('东北', 'NE')),
        E: t('surrounding.directions.E', pick('东', 'E')),
        SE: t('surrounding.directions.SE', pick('东南', 'SE')),
        S: t('surrounding.directions.S', pick('南', 'S')),
        SW: t('surrounding.directions.SW', pick('西南', 'SW')),
        W: t('surrounding.directions.W', pick('西', 'W')),
        NW: t('surrounding.directions.NW', pick('西北', 'NW')),
        low: t('prediction.cloudLayers.shortLow', pick('低云', 'Low')),
        mid: t('prediction.cloudLayers.shortMid', pick('中云', 'Mid')),
        high: t('prediction.cloudLayers.shortHigh', pick('高云', 'High')),
        sunrise: t('prediction.tabs.sunrise', pick('日出', 'Sunrise')),
        sunset: t('prediction.tabs.sunset', pick('日落', 'Sunset')),
        title: t('surrounding.radarTitle', pick('视场云况雷达', 'Field-of-View Cloud Radar')),
        subtitle: t('surrounding.radarSubtitle', pick('方位角 x 天空高度角', 'Azimuth x sky altitude')),
        legacyTitle: t('surrounding.radarLegacyTitle', pick('周边云况雷达', 'Surrounding Cloud Radar')),
        legacySubtitle: t('surrounding.radarLegacySubtitle', pick('25km · 连续云场', '25km · Continuous cloud field')),
        left: pick('左侧视场', 'Left sector'),
        right: pick('右侧视场', 'Right sector'),
        center: pick('主光路', 'Main path'),
        altitude: pick('天空高度', 'Sky altitude'),
        lowDesc: pick('低云', 'Low cloud'),
        midDesc: pick('中云', 'Mid cloud'),
        highDesc: pick('高云', 'High cloud')
      },
      theme: {
        bg: v('--radar-bg') || v('--color-card-bg') || '#ffffff',
        border: v('--radar-border') || v('--color-border') || 'rgba(0,0,0,0.10)',
        ring: v('--radar-ring') || 'rgba(132,101,67,0.22)',
        axisMain: v('--radar-axis-main') || 'rgba(132,101,67,0.30)',
        axisSub: v('--radar-axis-sub') || 'rgba(132,101,67,0.14)',
        labelFill: v('--radar-label-fill') || v('--color-text') || '#263241',
        labelBg: v('--radar-label-bg') || 'rgba(15,23,42,0.85)',
        title: v('--radar-title') || v('--color-text') || '#263241',
        subtitle: v('--radar-subtitle') || v('--color-text-light') || '#667085',
        legendText: v('--radar-legend-text') || v('--color-text-light') || '#667085',
        legendBg: v('--radar-legend-bg') || 'rgba(255,255,255,0.86)',
        fovBg: v('--radar-fov-bg') || 'linear-gradient(180deg,rgba(250,244,234,0.98),rgba(244,236,223,0.95) 55%,rgba(236,226,212,0.96))',
        fovPane: v('--radar-fov-pane') || 'rgba(116,88,58,0.045)',
        bearingBg: v('--radar-bearing-bg') || 'linear-gradient(180deg,rgba(255,250,242,0.88),rgba(248,239,225,0.76))',
        bearingBorder: v('--radar-bearing-border') || 'rgba(170,111,45,0.16)',
        bearingText: v('--radar-bearing-text') || 'rgba(61,48,40,0.92)',
        bearingTick: v('--radar-bearing-tick') || 'rgba(100,76,48,0.28)',
        center: v('--radar-center') || 'rgba(249,115,22,0.95)',
        centerStroke: v('--radar-center-stroke') || 'rgba(0,0,0,0.20)',
        cloudLow: v('--radar-cloud-low') || 'rgba(86,79,70,0.76)',
        cloudMid: v('--radar-cloud-mid') || 'rgba(116,106,93,0.66)',
        cloudHigh: v('--radar-cloud-high') || 'rgba(154,142,124,0.56)'
      }
    };
  }

  _parse(directions) {
    const ORDER = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const LABEL = { N: 'N', NE: 'NE', E: 'E', SE: 'SE', S: 'S', SW: 'SW', W: 'W', NW: 'NW' };
    const map = new Map();

    directions.forEach(item => {
      const d = (item.dir || item.direction || '').toUpperCase();
      if (!ORDER.includes(d)) return;
      const cl = item.cloudLayers || {};
      map.set(d, {
        dir: d,
        label: LABEL[d],
        score: Math.round(this._clamp(Number(item.score || 0), 0, 100)),
        low: this._clamp(Number(cl.low ?? item.lowCloud ?? 0), 0, 100),
        mid: this._clamp(Number(cl.mid ?? item.midCloud ?? 0), 0, 100),
        high: this._clamp(Number(cl.high ?? item.highCloud ?? 0), 0, 100)
      });
    });

    return ORDER.map(d => map.get(d) || {
      dir: d,
      label: LABEL[d],
      score: 0,
      low: 0,
      mid: 0,
      high: 0
    });
  }

  _buildFovField(data, dirs) {
    const visibleSector = data?.visibleSector || {};
    const offsets = Array.isArray(visibleSector.offsetsDeg) && visibleSector.offsetsDeg.length
      ? visibleSector.offsetsDeg.map(Number).filter(Number.isFinite)
      : [-35, -20, 0, 20, 35];
    const distances = Array.isArray(visibleSector.distancesKm) && visibleSector.distancesKm.length
      ? visibleSector.distancesKm.map(Number).filter(Number.isFinite)
      : [10, 25, 50, 75, 100];
    const mainBearing = this._finite(
      visibleSector.mainBearing,
      data?.azimuth,
      data?.sunAzimuths?.[data?.predictionType || 'sunset'],
      data?.sunAzimuths?.sunset,
      data?.sunAzimuths?.sunrise,
      0
    );
    const bearingByOffset = new Map((visibleSector.bearings || []).map(item => [Number(item.offsetDeg), Number(item.bearing)]));
    const maxAbsOffset = Math.max(1, ...offsets.map(offset => Math.abs(offset)));

    let samples = [];
    if (Array.isArray(data?.visibleSectorSamples) && data.visibleSectorSamples.length) {
      samples = data.visibleSectorSamples
        .filter(sample => sample && !sample.error)
        .map(sample => {
          const offsetDeg = this._bearingOffsetDeg(sample, mainBearing);
          return {
            offsetDeg,
            distanceKm: Number(sample.distanceKm ?? 0),
            bearing: Number(sample.bearing ?? sample.sectorBearing ?? bearingByOffset.get(Number(offsetDeg)) ?? this._normalizeBearing(mainBearing + offsetDeg)),
            low: this._clamp(Number(sample.lowCloud ?? sample.lowClouds ?? 0), 0, 100),
            mid: this._clamp(Number(sample.midCloud ?? sample.midClouds ?? 0), 0, 100),
            high: this._clamp(Number(sample.highCloud ?? sample.highClouds ?? 0), 0, 100),
            cloudBaseHeight: this._finiteOrNull(sample.cloudBaseHeight, sample.cloudBaseHeightM)
          };
        })
        .filter(sample => Number.isFinite(sample.offsetDeg) && Number.isFinite(sample.distanceKm));
    }

    const leftOffset = Math.min(...offsets);
    const rightOffset = Math.max(...offsets);
    return {
      offsets,
      distances,
      samples,
      predictionType: data?.predictionType || 'sunset',
      mainBearing: this._normalizeBearing(mainBearing),
      leftBearing: this._normalizeBearing(bearingByOffset.get(leftOffset) ?? mainBearing + leftOffset),
      rightBearing: this._normalizeBearing(bearingByOffset.get(rightOffset) ?? mainBearing + rightOffset),
      maxAbsOffset: Math.max(maxAbsOffset, ...samples.map(sample => Math.abs(sample.offsetDeg || 0))),
      maxDistance: Math.max(...distances, 100),
      maxAltitude: 30
    };
  }

  _buildFovAltitude(field, theme, uid, text) {
    const W = this.fovWidth;
    const H = this.fovHeight;
    const geo = this._fovGeometry(W, H);
    const T = theme;
    const zhFont = "'PingFang SC','Hiragino Sans GB','Microsoft YaHei','Noto Sans CJK SC','Source Han Sans SC','WenQuanYi Micro Hei',sans-serif";
    const label = value => `${Math.round(this._normalizeBearing(value))}&deg;`;
    const centerX = this._offsetToX(0, field, geo);
    const altitudeTicks = [0, 5, 10, 15, 20, 25, 30];
    const altitudeGrid = altitudeTicks.map(altitude => {
      const y = this._altitudeToY(altitude, geo);
      return `
        <line x1="${geo.leftX.toFixed(1)}" y1="${y.toFixed(1)}" x2="${geo.rightX.toFixed(1)}" y2="${y.toFixed(1)}"
          stroke="${T.ring}" stroke-width="1" stroke-dasharray="5 5"/>
        <text x="${(geo.rightX + 8).toFixed(1)}" y="${(y + 4).toFixed(1)}" font-size="11" font-weight="700" fill="${T.labelFill}">${altitude}&deg;</text>`;
    }).join('');
    const boundaries = [-field.maxAbsOffset, field.maxAbsOffset].map(offset => {
      const x = this._offsetToX(offset, field, geo);
      return `<line x1="${x.toFixed(1)}" y1="${geo.bottomY}" x2="${x.toFixed(1)}" y2="${geo.topY}" stroke="${T.axisSub}" stroke-width="1" stroke-dasharray="4 4"/>`;
    }).join('');

    return `
<div class="radar-fov-card" style="border:1px solid ${T.border};border-radius:12px;background:${T.bg};padding:12px 12px 10px;font-family:${zhFont};">
  <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px;">
    <div>
      <div style="font-size:14px;font-weight:800;color:${T.title};line-height:1.25;">${text.title}</div>
      <div style="font-size:11px;color:${T.subtitle};margin-top:2px;">${text.subtitle}</div>
    </div>
    ${this._buildFovBearingInset(field, T, text, label, zhFont)}
  </div>
  <div style="position:relative;width:min(${W}px,100%);aspect-ratio:${W} / ${H};height:auto;max-width:100%;margin:0 auto;overflow:hidden;border-radius:10px;background:${T.fovBg};">
    <canvas id="radar-cloud-field-${uid}" width="${W}" height="${H}" style="position:absolute;inset:0;width:100%;height:100%;display:block;"></canvas>
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="position:absolute;inset:0;width:100%;height:100%;display:block;font-family:${zhFont};" xmlns="http://www.w3.org/2000/svg">
      <rect x="${geo.leftX}" y="${geo.topY}" width="${(geo.rightX - geo.leftX).toFixed(1)}" height="${(geo.bottomY - geo.topY).toFixed(1)}" rx="8" fill="${T.fovPane}" stroke="none"/>
      ${altitudeGrid}
      ${boundaries}
      <line x1="${centerX.toFixed(1)}" y1="${geo.bottomY}" x2="${centerX.toFixed(1)}" y2="${geo.topY}" stroke="${T.center}" stroke-width="2.5"/>
      <text x="${centerX + 9}" y="${geo.topY - 8}" font-size="12" font-weight="900" fill="${T.center}">${label(field.mainBearing)}</text>
      <text x="${geo.leftX}" y="${geo.topY - 16}" font-size="11" font-weight="800" fill="${T.labelFill}">${text.left} ${label(field.leftBearing)}</text>
      <text x="${geo.rightX}" y="${geo.topY - 16}" text-anchor="end" font-size="11" font-weight="800" fill="${T.labelFill}">${text.right} ${label(field.rightBearing)}</text>
      <text x="${geo.leftX}" y="${geo.bottomY + 18}" font-size="10" font-weight="700" fill="${T.subtitle}">${text.altitude}</text>
    </svg>
  </div>
  <div style="display:flex;justify-content:center;gap:14px;flex-wrap:wrap;margin-top:9px;padding:7px 8px;border-radius:999px;background:${T.legendBg};font-size:11px;font-weight:700;color:${T.subtitle};">
    <span>${this._legacyLegendGlyph(T.cloudHigh)} ${text.highDesc}</span>
    <span>${this._legacyLegendGlyph(T.cloudMid)} ${text.midDesc}</span>
    <span>${this._legacyLegendGlyph(T.cloudLow)} ${text.lowDesc}</span>
  </div>
</div>`;
  }

  _buildFovBearingInset(field, theme, text, label, fontFamily) {
    const S = 34;
    const cx = S / 2;
    const cy = S / 2;
    const r = 10.5;
    const bearing = this._normalizeBearing(field.mainBearing);
    const rad = bearing * Math.PI / 180;
    const tipX = cx + Math.sin(rad) * r;
    const tipY = cy - Math.cos(rad) * r;
    const eventLabel = field.predictionType === 'sunrise'
      ? (text.sunrise || 'Sunrise')
      : (text.sunset || 'Sunset');
    const T = theme || {};

    return `
      <div class="radar-fov-bearing-inset" style="flex:0 0 auto;display:flex;align-items:center;gap:7px;padding:5px 10px 5px 6px;border:1px solid ${T.bearingBorder};border-radius:999px;background:${T.bearingBg};box-shadow:0 7px 18px rgba(92,58,20,0.08), inset 0 1px 0 rgba(255,255,255,0.32);font-family:${fontFamily};">
        <svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" style="display:block;flex:0 0 ${S}px;" xmlns="http://www.w3.org/2000/svg">
          <rect x="2.5" y="2.5" width="${S - 5}" height="${S - 5}" rx="11" fill="rgba(255,248,237,0.34)" stroke="${T.bearingBorder}" stroke-width="1"/>
          <path d="M${cx} 7.5v3.2M${cx} ${S - 7.5}v-3.2M7.5 ${cy}h3.2M${S - 7.5} ${cy}h-3.2" stroke="${T.bearingTick}" stroke-width="1.1" stroke-linecap="round"/>
          <line x1="${cx}" y1="${cy}" x2="${tipX.toFixed(1)}" y2="${tipY.toFixed(1)}" stroke="${T.center || 'rgba(234,88,12,0.92)'}" stroke-width="2.1" stroke-linecap="round"/>
          <circle cx="${cx}" cy="${cy}" r="2.1" fill="rgba(61,48,40,0.88)"/>
          <circle cx="${tipX.toFixed(1)}" cy="${tipY.toFixed(1)}" r="3.2" fill="${T.center || 'rgba(234,88,12,0.92)'}" stroke="rgba(255,250,244,0.95)" stroke-width="1.2"/>
        </svg>
        <div style="font-size:11px;line-height:1.1;font-weight:900;color:${T.bearingText};white-space:nowrap;">${eventLabel} ${label(bearing)}</div>
      </div>`;
  }

  _paintFovAltitudeCloudField(canvas, field, theme) {
    const W = this.fovWidth;
    const H = this.fovHeight;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const geo = this._fovGeometry(W, H);
    const layers = [
      { key: 'high', heightKm: 9.0, altitudeSpread: 3.1, offsetSpread: 6.8, alphaMax: 0.70, gamma: 0.78, edgeCut: 0.10, color: this._parseRgba(theme.cloudHigh, { r: 154, g: 142, b: 124, a: 0.56 }) },
      { key: 'mid', heightKm: 4.2, altitudeSpread: 1.9, offsetSpread: 5.7, alphaMax: 0.66, gamma: 0.92, edgeCut: 0.13, color: this._parseRgba(theme.cloudMid, { r: 116, g: 106, b: 93, a: 0.66 }) },
      { key: 'low', heightKm: 1.2, altitudeSpread: 1.2, offsetSpread: 5.1, alphaMax: 0.74, gamma: 0.94, edgeCut: 0.14, color: this._parseRgba(theme.cloudLow, { r: 86, g: 79, b: 70, a: 0.76 }) }
    ];
    const projectedByLayer = layers.map(layer => ({
      layer,
      items: this._buildFovLayerItems(field, layer)
    }));

    const img = ctx.createImageData(W, H);
    const px = img.data;

    for (let y = Math.floor(geo.topY); y <= Math.ceil(geo.bottomY); y += 1) {
      const altitude = this._yToAltitude(y + 0.5, geo);
      for (let x = Math.floor(geo.leftX); x <= Math.ceil(geo.rightX); x += 1) {
        const offset = this._xToOffset(x + 0.5, field, geo);
        let outR = 0;
        let outG = 0;
        let outB = 0;
        let outA = 0;

        for (const group of projectedByLayer) {
          const layer = group.layer;
          let strength = 0;
          let weightedDistance = 0;
          let weight = 0;

          for (const item of group.items) {
            const contribution = this._fovPatchContribution(offset, altitude, item, layer);
            if (contribution <= 0.001) continue;

            strength = Math.max(strength, contribution);
            weightedDistance += item.distanceKm * contribution;
            weight += contribution;
          }

          const curtain = this._fovLayerCurtainContribution(offset, altitude, group.items, layer);
          if (curtain.strength > 0.001) {
            strength = 1 - (1 - strength) * (1 - curtain.strength);
            weightedDistance += curtain.distanceKm * curtain.strength;
            weight += curtain.strength;
          }

          if (strength <= 0.001) continue;
          const avgDistance = weight > 0 ? weightedDistance / weight : 50;
          const u = (offset + field.maxAbsOffset) * 0.26;
          const vv = altitude * 0.58 + avgDistance * 0.02;
          const nLarge = this._fbm(u * 0.72, vv * 0.62, 3);
          const nSmall = this._fbm(u * 1.9 + 21, vv * 1.15 - 7, 2);
          const tex = 0.90 + 0.10 * nLarge + 0.025 * (nSmall - 0.5);
          const shaped = this._smoothstep(layer.edgeCut, 0.98, strength * tex);
          const visibleTrace = 0.010 * this._smoothstep(0.08, 0.28, strength);
          const detail = 0.98 + 0.035 * this._smoothstep(0.32, 0.86, nSmall);
          const a = this._clamp((shaped * 0.98 + visibleTrace) * detail * layer.alphaMax * layer.color.a, 0, 1);
          if (a <= 0.001) continue;

          const inv = 1 - outA;
          outR += layer.color.r * a * inv;
          outG += layer.color.g * a * inv;
          outB += layer.color.b * a * inv;
          outA += a * inv;
        }

        if (outA <= 0) continue;
        const idx = (y * W + x) * 4;
        px[idx] = Math.round(outR);
        px[idx + 1] = Math.round(outG);
        px[idx + 2] = Math.round(outB);
        px[idx + 3] = Math.round(outA * 255);
      }
    }

    ctx.putImageData(img, 0, 0);
  }

  _buildLegacyCircle(dirs, sun, theme = {}, predictionType = null, uid = 'x', text = {}) {
    const S = this.size;
    const cx = S / 2;
    const cy = S / 2;
    const T = theme;
    const R_LOW_INNER = S * 0.11;
    const R_LOW = S * 0.20;
    const R_MID = S * 0.32;
    const R_HIGH = S * 0.42;
    const ringStroke = T.ring || 'rgba(132,101,67,0.22)';
    const rings = [
      [R_LOW, text.low || '低云'],
      [R_MID, text.mid || '中云'],
      [R_HIGH, text.high || '高云']
    ].map(([r, lbl], i) => {
      const innerR = i === 0 ? R_LOW_INNER : [R_LOW, R_MID][i - 1];
      const [tx, ty] = this._pt(cx, cy, r - (r - innerR) / 2, 340);
      return `
        <circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill="transparent" stroke="${ringStroke}" stroke-width="1"/>
        <text x="${tx.toFixed(1)}" y="${(ty + 4).toFixed(1)}" font-size="12" font-weight="700" fill="${T.labelFill}" text-anchor="middle">${lbl}</text>`;
    }).join('');
    const lowInnerRing = `<circle cx="${cx}" cy="${cy}" r="${R_LOW_INNER.toFixed(1)}" fill="transparent" stroke="${ringStroke}" stroke-width="1" opacity="0.95"/>`;
    const DIR_ORDER = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const axes = DIR_ORDER.map(d => {
      const [x2, y2] = this._pt(cx, cy, R_HIGH * 1.04, this._dirAz(d));
      const main = ['N', 'E', 'S', 'W'].includes(d);
      return `<line x1="${cx}" y1="${cy}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
        stroke="${main ? (T.axisMain || 'rgba(132,101,67,0.30)') : (T.axisSub || 'rgba(132,101,67,0.14)')}"
        stroke-width="${main ? '1' : '0.6'}"/>`;
    }).join('');
    const labelR = R_HIGH * 1.08;
    const labels = DIR_ORDER.map(d => {
      const lbl = text[d] || d;
      const [x, y] = this._pt(cx, cy, labelR, this._dirAz(d));
      return `<text x="${x.toFixed(1)}" y="${(y + 5).toFixed(1)}" text-anchor="middle" font-size="13" font-weight="700" fill="${T.labelFill || '#334155'}">${lbl}</text>`;
    }).join('');
    const sunEventIconSvg = (x, y, type) => {
      const arrow = type === 'sunrise'
        ? '<path d="M17 13V4m0 0-3 3m3-3 3 3"/>'
        : '<path d="M17 4v9m0 0-3-3m3 3 3-3"/>';
      return `<g class="radar-sun-event-icon" transform="translate(${(x - 11).toFixed(1)} ${(y - 8).toFixed(1)})" fill="none" stroke="${T.center || '#f97316'}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 14h14"/><path d="M4.5 14a4 4 0 0 1 8 0"/>${arrow}</g>`;
    };
    const getSunRadius = az => {
      if (az == null) return R_HIGH * 0.92;
      const nearCardinal = [0, 90, 180, 270].some(a => Math.abs(((az - a) % 360 + 540) % 360 - 180) < 14);
      return nearCardinal ? R_HIGH * 0.82 : R_HIGH * 0.92;
    };
    let sunIcons = '';
    const isDawn = predictionType === 'sunrise';
    const sunAz = isDawn ? sun.sunrise : sun.sunset;
    if (sunAz != null) {
      const iconR = getSunRadius(sunAz);
      const [ix, iy] = this._pt(cx, cy, iconR, sunAz);
      const labelText = isDawn ? (text.sunrise || '日出') : (text.sunset || '日落');
      sunIcons = `${sunEventIconSvg(ix, iy, isDawn ? 'sunrise' : 'sunset')}
        <text x="${ix.toFixed(1)}" y="${(iy + 17).toFixed(1)}" text-anchor="middle" font-size="9" fill="${T.subtitle || '#666666'}">${labelText}</text>`;
    }
    const center = `<circle cx="${cx}" cy="${cy}" r="4" fill="${T.center || 'rgba(249,115,22,0.9)'}" stroke="${T.centerStroke || 'rgba(0,0,0,0.20)'}" stroke-width="1.5"/>`;
    const zhFont = "'PingFang SC','Hiragino Sans GB','Microsoft YaHei','Noto Sans CJK SC','Source Han Sans SC','WenQuanYi Micro Hei',sans-serif";
    const legendSvgWidth = S * 0.88;
    const legendContentWidth = 160;
    const legendOffsetX = Math.max(0, (legendSvgWidth - legendContentWidth) / 2);
    const LEGEND = [
      [T.cloudLow || 'rgba(86,79,70,0.76)', text.low || '低云'],
      [T.cloudMid || 'rgba(116,106,93,0.66)', text.mid || '中云'],
      [T.cloudHigh || 'rgba(154,142,124,0.56)', text.high || '高云']
    ];
    const legend = LEGEND.map(([c, l], i) => `
      <ellipse cx="${legendOffsetX + 13 + i * 58}" cy="6" rx="9" ry="5.5" fill="${c}"/>
      <text x="${legendOffsetX + 27 + i * 58}" y="10" font-size="11" font-weight="700" fill="${T.legendText || '#334155'}">${l}</text>`).join('');

    return `
<div style="border:1px solid ${T.border || 'rgba(0,0,0,0.1)'};border-radius:12px;background:${T.bg || '#ffffff'};padding:10px 10px 8px;font-family:${zhFont};">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
    <div style="font-size:13px;font-weight:600;color:${T.title || '#333333'};">${text.legacyTitle || '周边云况雷达'}</div>
    <div style="font-size:11px;color:${T.subtitle || '#666666'};">${text.legacySubtitle || '25km · 连续云场'}</div>
  </div>
  <div style="position:relative;width:min(${S}px,100%);aspect-ratio:1 / 1;height:auto;max-width:100%;margin:0 auto;">
    <canvas id="radar-cloud-field-${uid}" width="${S}" height="${S}" style="position:absolute;inset:0;width:100%;height:100%;display:block;"></canvas>
    <svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" style="position:absolute;inset:0;width:100%;height:100%;display:block;font-family:${zhFont};" xmlns="http://www.w3.org/2000/svg">
      ${lowInnerRing}${rings}${axes}${center}${sunIcons}${labels}
    </svg>
  </div>
  <svg width="${legendSvgWidth}" height="18" style="display:block;margin:8px auto 0;font-family:${zhFont};background:${T.legendBg};border-radius:8px;padding:0 4px;">${legend}</svg>
</div>`;
  }

  _paintLegacyCloudField(canvas, dirs, theme) {
    const S = this.size;
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const cx = S / 2;
    const cy = S / 2;
    const R_LOW_INNER = S * 0.11;
    const R_LOW = S * 0.20;
    const R_MID = S * 0.32;
    const R_HIGH = S * 0.42;
    const layers = [
      { key: 'low', inner: R_LOW_INNER * 1.02, outer: R_LOW * 0.96, fade: (R_LOW - R_LOW_INNER) * 0.34, alphaMax: 0.90, gamma: 1.20, color: this._parseRgba(theme.cloudLow, { r: 86, g: 79, b: 70, a: 0.76 }), angStretch: 12.5, radStretch: 1.6, edgeCut: 0.18 },
      { key: 'mid', inner: R_LOW * 1.03, outer: R_MID * 0.98, fade: (R_MID - R_LOW) * 0.34, alphaMax: 0.82, gamma: 1.12, color: this._parseRgba(theme.cloudMid, { r: 116, g: 106, b: 93, a: 0.66 }), angStretch: 12.5, radStretch: 1.6, edgeCut: 0.20 },
      { key: 'high', inner: R_MID * 1.02, outer: R_HIGH * 0.97, fade: (R_HIGH - R_MID) * 0.38, alphaMax: 0.66, gamma: 1.05, color: this._parseRgba(theme.cloudHigh, { r: 154, g: 142, b: 124, a: 0.56 }), angStretch: 12.5, radStretch: 1.6, edgeCut: 0.24 }
    ];
    const img = ctx.createImageData(S, S);
    const px = img.data;
    for (let y = 0; y < S; y += 1) {
      for (let x = 0; x < S; x += 1) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const r = Math.sqrt(dx * dx + dy * dy);
        if (r > R_HIGH * 1.02) continue;
        let theta = Math.atan2(dy, dx) + Math.PI / 2;
        if (theta < 0) theta += Math.PI * 2;
        const color = this._composeLegacyPixel(dirs, layers, r, theta);
        if (!color) continue;
        const idx = (y * S + x) * 4;
        px[idx] = color.r;
        px[idx + 1] = color.g;
        px[idx + 2] = color.b;
        px[idx + 3] = color.a;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = `blur(${Math.max(2.2, S * 0.007)}px)`;
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = 'none';
  }

  _composeLegacyPixel(dirs, layers, r, theta) {
    let outR = 0;
    let outG = 0;
    let outB = 0;
    let outA = 0;
    for (const layer of layers) {
      if (r < layer.inner - layer.fade || r > layer.outer + layer.fade) continue;
      const ringW = this._smoothstep(layer.inner - layer.fade, layer.inner + layer.fade, r)
        * (1 - this._smoothstep(layer.outer - layer.fade, layer.outer + layer.fade, r));
      if (ringW <= 0.001) continue;
      const cover = this._interpCover(dirs, layer.key, theta);
      const base = Math.pow(Math.max(0, cover) / 100, layer.gamma);
      if (base <= 0.001) continue;
      const u = (theta / (Math.PI * 2)) * layer.angStretch * 8;
      const vv = ((r - (layer.inner + layer.outer) / 2) / Math.max(1, (layer.outer - layer.inner))) * layer.radStretch;
      const nLarge = this._fbm(u * 0.65, vv * 0.55, 3);
      const nSmall = this._fbm(u * 1.6 + 21, vv * 1.0 - 7, 2);
      const tex = 0.78 + 0.24 * nLarge + 0.08 * (nSmall - 0.5);
      const shaped = this._smoothstep(layer.edgeCut, 0.98, base * tex);
      const a = this._clamp(shaped * ringW * layer.alphaMax * layer.color.a, 0, 1);
      if (a <= 0.001) continue;
      const inv = 1 - outA;
      outR += layer.color.r * a * inv;
      outG += layer.color.g * a * inv;
      outB += layer.color.b * a * inv;
      outA += a * inv;
    }
    if (outA <= 0) return null;
    return { r: Math.round(outR), g: Math.round(outG), b: Math.round(outB), a: Math.round(outA * 255) };
  }

  _pt(cx, cy, r, az) {
    const rad = (az - 90) * Math.PI / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  }

  _dirAz(dir) {
    return { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 }[dir] ?? 0;
  }

  _fovGeometry(W, H) {
    return { leftX: W * 0.11, rightX: W * 0.89, topY: H * 0.18, bottomY: H * 0.86, maxAltitude: 30 };
  }

  _offsetToX(offsetDeg, field, geo) {
    return this._lerp(geo.leftX, geo.rightX, (offsetDeg + field.maxAbsOffset) / (field.maxAbsOffset * 2));
  }

  _xToOffset(x, field, geo) {
    const t = (x - geo.leftX) / Math.max(1, geo.rightX - geo.leftX);
    return this._lerp(-field.maxAbsOffset, field.maxAbsOffset, t);
  }

  _altitudeToY(altitudeDeg, geo) {
    return this._lerp(geo.bottomY, geo.topY, this._clamp(altitudeDeg / geo.maxAltitude, 0, 1));
  }

  _yToAltitude(y, geo) {
    return this._lerp(geo.maxAltitude, 0, this._clamp((y - geo.topY) / Math.max(1, geo.bottomY - geo.topY), 0, 1));
  }

  _sampleAltitudeDeg(sample, layerKey, fallbackHeightKm) {
    const explicit = Number(sample[`${layerKey}AltitudeDeg`] ?? sample.altitudeDeg);
    if (Number.isFinite(explicit)) return this._clamp(explicit, 0, 30);
    const baseM = Number(sample.cloudBaseHeight ?? sample.cloudBaseHeightM);
    const canUseCloudBase = layerKey === 'low' && Number.isFinite(baseM) && baseM > 0;
    const heightKm = canUseCloudBase
      ? this._clamp(baseM / 1000, 0.3, 12)
      : fallbackHeightKm;
    const distanceKm = Math.max(1, Number(sample.distanceKm || 1));
    return this._clamp(Math.atan(heightKm / distanceKm) * 180 / Math.PI, 0, 30);
  }

  _buildFovLayerItems(field, layer) {
    const rawItems = field.samples.map(sample => ({
      offsetDeg: sample.offsetDeg,
      altitudeDeg: this._sampleAltitudeDeg(sample, layer.key, layer.heightKm),
      cover: this._clamp(Number(sample[layer.key] || 0), 0, 100),
      distanceKm: sample.distanceKm
    })).filter(item => item.cover > 0);

    const offsetCellDeg = this._medianPositiveGap(field.samples.map(sample => Number(sample.offsetDeg))) || layer.offsetSpread * 2;
    return rawItems.flatMap(item => {
      const sameBearing = rawItems.filter(candidate => Math.abs(candidate.offsetDeg - item.offsetDeg) < 0.001);
      const altitudeCellDeg = this._nearestProjectedGap(item.altitudeDeg, sameBearing.map(candidate => candidate.altitudeDeg))
        || this._nearestProjectedGap(item.altitudeDeg, rawItems.map(candidate => candidate.altitudeDeg))
        || layer.altitudeSpread * 2;
      const anchored = this._withFovVisualAnchor({
        ...item,
        offsetCellDeg,
        altitudeCellDeg
      }, layer, field);
      return this._buildFovCloudlets(anchored, layer, field);
    });
  }

  _withFovVisualAnchor(item, layer, field) {
    const offsetStep = item.offsetCellDeg || this._medianPositiveGap(field.samples.map(sample => Number(sample.offsetDeg))) || 12;
    const altitudeStep = item.altitudeCellDeg || layer.altitudeSpread * 2;
    const seed = this._hash2(item.offsetDeg * 13.37 + layer.heightKm * 5.11, item.distanceKm * 0.41);
    const side = this._hash2(seed * 17.1, item.cover * 0.37) - 0.5;
    const vertical = this._hash2(seed * 29.7, item.offsetDeg * 0.23 + 4.9) - 0.5;
    const coverT = this._smoothstep(0.10, 0.92, this._clamp(item.cover / 100, 0, 1));
    const layerXFactor = layer.key === 'high' ? 0.32 : (layer.key === 'mid' ? 0.27 : 0.22);
    const layerYFactor = layer.key === 'high' ? 0.88 : (layer.key === 'mid' ? 0.72 : 0.58);
    const visualOffsetDeg = item.offsetDeg + side * offsetStep * layerXFactor * (0.75 + coverT * 0.35);
    const visualAltitudeDeg = item.altitudeDeg + vertical * Math.min(5.2, altitudeStep * 0.58) * layerYFactor * (0.85 + coverT * 0.25);

    return {
      ...item,
      visualOffsetDeg: this._clamp(visualOffsetDeg, -field.maxAbsOffset, field.maxAbsOffset),
      visualAltitudeDeg: this._clamp(visualAltitudeDeg, 0, field.maxAltitude || 30)
    };
  }

  _buildFovCloudlets(item, layer, field) {
    const coverT = this._smoothstep(0.10, 0.92, this._clamp(item.cover / 100, 0, 1));
    const count = item.cover >= 72
      ? (layer.key === 'low' ? 3 : 2)
      : (item.cover >= 42 ? 2 : 1);
    const maxAltitude = field.maxAltitude || 30;
    const distanceT = this._clamp(Number(item.distanceKm || 0) / Math.max(1, field.maxDistance || 100), 0, 1);
    const cloudlets = [];

    for (let i = 0; i < count; i += 1) {
      const seed = this._hash2(item.offsetDeg * 23.41 + layer.heightKm * 7.13 + i * 5.7, item.distanceKm * 0.67 + item.cover * 0.11);
      const side = i === 0 ? 0 : this._hash2(seed * 31.3, i * 2.1) - 0.5;
      const vertical = i === 0 ? 0 : this._hash2(seed * 37.9, i * 3.4 + item.offsetDeg * 0.13) - 0.5;
      const offsetRoom = Math.max(2.2, (item.offsetCellDeg || 15) * (0.34 + coverT * 0.14));
      const altitudeRoom = Math.max(0.9, (item.altitudeCellDeg || layer.altitudeSpread * 2) * (0.30 + coverT * 0.12));
      const sizeNoise = this._lerp(0.78, 1.24, this._hash2(seed * 11.7, i + 9.3));
      const nearSize = this._lerp(1.16, 0.82, distanceT);
      const childScale = count === 1 ? 1 : (i === 0 ? 0.88 : this._lerp(0.48, 0.74, this._hash2(seed * 13.1, i + 2.2)));
      const layerWidthScale = layer.key === 'high' ? 0.74 : (layer.key === 'mid' ? 0.88 : 1.0);

      cloudlets.push({
        ...item,
        visualOffsetDeg: this._clamp(item.visualOffsetDeg + side * offsetRoom, -field.maxAbsOffset, field.maxAbsOffset),
        visualAltitudeDeg: this._clamp(item.visualAltitudeDeg + vertical * altitudeRoom, 0, maxAltitude),
        xScale: this._clamp(sizeNoise * nearSize * (0.78 + coverT * 0.20) * childScale * layerWidthScale, 0.38, 1.34),
        yScale: this._clamp(this._lerp(0.76, 1.20, this._hash2(seed * 17.2, i + 4.6)) * nearSize * childScale, 0.42, 1.45),
        strengthScale: this._clamp((i === 0 ? 1 : this._lerp(0.44, 0.76, this._hash2(seed * 19.4, i + 6.8))) * (0.82 + coverT * 0.24), 0.35, 1.10),
        seed
      });
    }

    return cloudlets;
  }

  _fovCoverStrength(cover, gamma = 0.92) {
    return Math.pow(this._clamp(Number(cover) / 100, 0, 1), gamma);
  }

  _fovCoverSpreadScale(cover) {
    const c = this._clamp(Number(cover) / 100, 0, 1);
    return this._lerp(0.55, 0.98, this._smoothstep(0.10, 0.92, c));
  }

  _fovPatchContribution(offsetDeg, altitudeDeg, item, layer) {
    const spreadScale = this._fovCoverSpreadScale(item.cover);
    const adaptiveOffsetSpread = item.offsetCellDeg
      ? this._clamp(item.offsetCellDeg * 0.30, layer.offsetSpread * 0.66, layer.offsetSpread * 1.22)
      : layer.offsetSpread;
    const adaptiveAltitudeSpread = item.altitudeCellDeg
      ? this._clamp(item.altitudeCellDeg * 0.46, layer.altitudeSpread * 0.85, layer.altitudeSpread * 2.45)
      : layer.altitudeSpread;
    const xSpread = Math.max(0.8, adaptiveOffsetSpread * spreadScale * (item.xScale || 1));
    const ySpread = Math.max(0.5, adaptiveAltitudeSpread * spreadScale * (item.yScale || 1));
    const localX = (offsetDeg - (item.visualOffsetDeg ?? item.offsetDeg)) / xSpread;
    const localY = (altitudeDeg - (item.visualAltitudeDeg ?? item.altitudeDeg)) / ySpread;
    const radial = localX * localX + localY * localY;
    if (radial > 5.2) return 0;

    const seed = item.seed ?? this._hash2((item.visualOffsetDeg ?? item.offsetDeg) * 17.17 + layer.heightKm * 3.11, item.distanceKm * 0.73);
    const veil = this._fovCloudShape(localX, localY, layer, seed);

    if (veil <= 0.022) return 0;
    const lowFreq = this._fbm(localX * 1.35 + seed * 9.0, localY * 1.85 - seed * 5.5, 3);
    const edge = 1 - this._smoothstep(1.55, 3.65, radial);
    if (edge <= 0.001) return 0;
    const feather = this._smoothstep(0.045, 0.82, veil * edge * (0.88 + 0.18 * (lowFreq - 0.5)));
    return this._fovCoverStrength(item.cover, layer.gamma) * feather * (item.strengthScale || 1);
  }

  _fovLayerCurtainContribution(offsetDeg, altitudeDeg, items = [], layer) {
    let strength = 0;
    let weightedDistance = 0;
    let weight = 0;

    for (const item of items) {
      const coverT = this._smoothstep(0.48, 0.92, this._clamp(Number(item.cover) / 100, 0, 1));
      if (coverT <= 0.001) continue;

      const seed = item.seed ?? this._hash2(item.offsetDeg * 17.17 + layer.heightKm * 3.11, item.distanceKm * 0.73);
      const cellX = item.offsetCellDeg || layer.offsetSpread * 2.4;
      const cellY = item.altitudeCellDeg || layer.altitudeSpread * 2.2;
      const xSpread = this._clamp(cellX * (layer.key === 'high' ? 0.58 : layer.key === 'mid' ? 0.66 : 0.74), layer.offsetSpread * 1.06, layer.offsetSpread * 2.55);
      const ySpread = this._clamp(cellY * (layer.key === 'high' ? 0.42 : layer.key === 'mid' ? 0.54 : 0.68), layer.altitudeSpread * 0.82, layer.altitudeSpread * 3.4);
      const dx = (offsetDeg - (item.visualOffsetDeg ?? item.offsetDeg)) / Math.max(0.8, xSpread);
      const dy = (altitudeDeg - (item.visualAltitudeDeg ?? item.altitudeDeg)) / Math.max(0.45, ySpread);
      const envelope = Math.exp(-(dx * dx * (layer.key === 'high' ? 0.54 : 0.42) + dy * dy * (layer.key === 'low' ? 0.72 : 0.84)));
      if (envelope <= 0.018) continue;

      const waviness = this._fbm(offsetDeg * 0.18 + seed * 8.3, altitudeDeg * 0.34 - seed * 5.1, 3);
      const breakup = this._fbm(offsetDeg * 0.48 - seed * 11.7, altitudeDeg * 0.92 + seed * 4.8, 2);
      const layerTexture = layer.key === 'high'
        ? this._smoothstep(0.10, 0.82, waviness) * (0.56 + 0.44 * breakup)
        : layer.key === 'mid'
          ? this._smoothstep(0.18, 0.88, waviness * 0.78 + breakup * 0.22)
          : this._smoothstep(0.12, 0.76, waviness * 0.62 + breakup * 0.38);

      let horizonBoost = 1;
      let silhouette = 1;
      if (layer.key === 'low') {
        const crestNoise = this._fbm(offsetDeg * 0.28 + seed * 6.1, seed * 9.4, 3);
        const pocketNoise = this._fbm(offsetDeg * 0.72 - seed * 4.4, altitudeDeg * 0.58 + seed * 3.3, 2);
        const cloudTop = 4.8 + crestNoise * 3.8 + pocketNoise * 1.3;
        const topFade = 1 - this._smoothstep(cloudTop, cloudTop + 2.2, altitudeDeg);
        const lowerBody = 1 - this._smoothstep(9.2, 13.8, altitudeDeg);
        const brokenEdge = 0.62 + 0.38 * this._smoothstep(0.22, 0.82, pocketNoise);
        silhouette = Math.max(0.10, Math.max(topFade, lowerBody * 0.28) * brokenEdge);
        const nearHorizon = 1 - this._smoothstep(4.8, 10.8, altitudeDeg);
        horizonBoost = 0.66 + 0.42 * nearHorizon;
      }

      const curtainWeight = layer.key === 'low' ? 0.58 : (layer.key === 'mid' ? 0.78 : 0.66);
      const contribution = this._fovCoverStrength(item.cover, layer.gamma) * coverT * envelope * (0.52 + 0.48 * layerTexture) * horizonBoost * silhouette * curtainWeight;
      if (contribution <= 0.001) continue;

      strength = 1 - (1 - strength) * (1 - contribution);
      weightedDistance += Number(item.distanceKm || 50) * contribution;
      weight += contribution;
    }

    return {
      strength: this._clamp(strength, 0, 1),
      distanceKm: weight > 0 ? weightedDistance / weight : 50
    };
  }

  _fovCloudShape(localX, localY, layer, seed) {
    const angle = (this._hash2(seed * 7.3, 2.1) - 0.5) * 0.34;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x = localX * cos - localY * sin;
    const y = localX * sin + localY * cos;
    const e = (cx, cy, sx, sy, weight = 1) => {
      const dx = (x - cx) / Math.max(0.08, sx);
      const dy = (y - cy) / Math.max(0.08, sy);
      return Math.exp(-(dx * dx + dy * dy)) * weight;
    };
    const shelf = (cx, cy, sx, sy, weight = 1) => {
      const dx = Math.abs((x - cx) / Math.max(0.08, sx));
      const dy = Math.abs((y - cy) / Math.max(0.08, sy));
      return Math.exp(-(Math.pow(dx, 2.7) + Math.pow(dy, 2.2))) * weight;
    };

    if (layer.key === 'high') {
      const sheetA = e(-0.38, -0.08, 1.34, 0.16, 0.58);
      const sheetB = e(0.26, 0.03, 1.12, 0.18, 0.74);
      const softTail = e(0.72, 0.13, 0.62, 0.13, 0.32);
      const brokenFront = e(-0.86, 0.10, 0.42, 0.12, 0.22);
      const streak = shelf(0.05, -0.20, 1.05, 0.055, 0.20);
      return Math.max(sheetA, sheetB, softTail, brokenFront, streak);
    }

    if (layer.key === 'mid') {
      const slab = shelf(0.00, 0.16, 1.06, 0.26, 0.72);
      const leftLift = e(-0.56, -0.10, 0.46, 0.30, 0.54);
      const centerLift = e(-0.04, -0.18, 0.50, 0.34, 0.66);
      const rightLift = e(0.54, -0.06, 0.42, 0.26, 0.48);
      const under = shelf(0.16, 0.42, 0.76, 0.12, 0.26);
      return Math.max(slab, leftLift, centerLift, rightLift, under);
    }

    const horizonDeck = shelf(0.02, 0.20, 1.16, 0.22, 0.82);
    const lowBase = shelf(0.10, 0.44, 0.98, 0.14, 0.48);
    const crestLeft = e(-0.66, -0.02, 0.40, 0.20, 0.30);
    const crestMid = e(-0.18, -0.10, 0.46, 0.22, 0.36);
    const crestRight = e(0.42, -0.03, 0.42, 0.20, 0.32);
    const farShelf = shelf(0.78, 0.10, 0.34, 0.10, 0.18);
    return Math.max(horizonDeck, lowBase, crestLeft, crestMid, crestRight, farShelf);
  }

  _legacyLegendGlyph(color) {
    return `<span style="display:inline-block;width:22px;height:10px;border-radius:50%;background:${color};vertical-align:-1px;"></span>`;
  }

  _smoothstep(edge0, edge1, x) {
    const t = this._clamp((x - edge0) / Math.max(1e-6, edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  _lerp(a, b, t) {
    return a + (b - a) * t;
  }

  _wrapIndex(i, n) {
    return ((i % n) + n) % n;
  }

  _medianPositiveGap(values = []) {
    const sorted = [...new Set(values.filter(Number.isFinite).sort((a, b) => a - b))];
    const gaps = [];
    for (let i = 1; i < sorted.length; i += 1) {
      const gap = sorted[i] - sorted[i - 1];
      if (gap > 0) gaps.push(gap);
    }
    if (!gaps.length) return 0;
    gaps.sort((a, b) => a - b);
    return gaps[Math.floor(gaps.length / 2)];
  }

  _nearestProjectedGap(value, values = []) {
    const gaps = values
      .map(candidate => Math.abs(Number(candidate) - Number(value)))
      .filter(gap => Number.isFinite(gap) && gap > 0.001)
      .sort((a, b) => a - b);
    return gaps[0] || 0;
  }

  _interpCover(dirs, key, thetaRad) {
    const twoPi = Math.PI * 2;
    const t = ((thetaRad % twoPi) + twoPi) % twoPi;
    const sector = (t / twoPi) * 8;
    const i0 = Math.floor(sector);
    const i1 = this._wrapIndex(i0 + 1, 8);
    const f = sector - i0;
    const sf = f * f * (3 - 2 * f);
    return this._lerp(dirs[i0]?.[key] ?? 0, dirs[i1]?.[key] ?? 0, sf);
  }

  _interpByBearing(dirs, key, bearing) {
    const t = this._normalizeBearing(bearing) / 45;
    const i0 = Math.floor(t) % 8;
    const i1 = (i0 + 1) % 8;
    const f = t - Math.floor(t);
    const sf = f * f * (3 - 2 * f);
    return this._lerp(dirs[i0]?.[key] ?? 0, dirs[i1]?.[key] ?? 0, sf);
  }

  _distanceLayerWeight(distanceKm, layer) {
    const d = this._clamp(distanceKm / 100, 0, 1);
    if (layer === 'low') return this._lerp(1, 0.58, d);
    if (layer === 'mid') return this._lerp(0.88, 1, d);
    return this._lerp(0.72, 1.08, d);
  }

  _hash2(x, y) {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return s - Math.floor(s);
  }

  _valueNoise(x, y) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = x0 + 1;
    const y1 = y0 + 1;
    const sx = x - x0;
    const sy = y - y0;
    const ux = sx * sx * (3 - 2 * sx);
    const uy = sy * sy * (3 - 2 * sy);
    const n00 = this._hash2(x0, y0);
    const n10 = this._hash2(x1, y0);
    const n01 = this._hash2(x0, y1);
    const n11 = this._hash2(x1, y1);
    return this._lerp(this._lerp(n00, n10, ux), this._lerp(n01, n11, ux), uy);
  }

  _fbm(x, y, octaves = 3) {
    let val = 0;
    let amp = 0.5;
    let freq = 1;
    let norm = 0;
    for (let i = 0; i < octaves; i += 1) {
      val += amp * this._valueNoise(x * freq, y * freq);
      norm += amp;
      amp *= 0.5;
      freq *= 2.0;
    }
    return norm > 0 ? val / norm : 0;
  }

  _parseRgba(str, fallback) {
    const m = String(str || '').match(/rgba?\(([^)]+)\)/i);
    if (!m) return fallback;
    const p = m[1].split(',').map(value => parseFloat(value.trim()));
    if (p.length < 3) return fallback;
    return { r: p[0] || 0, g: p[1] || 0, b: p[2] || 0, a: p[3] ?? 1 };
  }

  _finite(...values) {
    for (const value of values) {
      const number = Number(value);
      if (Number.isFinite(number)) return number;
    }
    return 0;
  }

  _finiteOrNull(...values) {
    for (const value of values) {
      const number = Number(value);
      if (Number.isFinite(number)) return number;
    }
    return null;
  }

  _normalizeBearing(value) {
    return ((Number(value) % 360) + 360) % 360;
  }

  _bearingOffsetDeg(sample = {}, mainBearing = 0) {
    const explicit = Number(sample.offsetDeg);
    if (Number.isFinite(explicit)) return explicit;
    const bearing = Number(sample.bearing ?? sample.sectorBearing);
    if (!Number.isFinite(bearing)) return 0;
    const delta = this._normalizeBearing(bearing) - this._normalizeBearing(mainBearing);
    return ((delta + 540) % 360) - 180;
  }

  _clamp(value, min, max) {
    if (!Number.isFinite(value)) return min;
    return Math.max(min, Math.min(max, value));
  }
}

export default RadarCompass;
