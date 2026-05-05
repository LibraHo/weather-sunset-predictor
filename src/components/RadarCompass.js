/**
 * RadarCompass v9
 *
 * 目标：从“离散云朵贴片”切换为“极坐标连续云场渲染”。
 * - 三层云（低/中/高）均按连续 alpha 场逐像素渲染
 * - 方向云量通过角度插值形成连续分布
 * - 引入方向性程序纹理（沿环向拉伸）
 */
class RadarCompass {
  constructor(options = {}) {
    this.size = options.size || 300;
  }

  render(container, data) {
    if (!container) return;
    const dirs = this._parse(data?.directions || []);
    if (!dirs.length) {
      container.innerHTML = '';
      return;
    }

    const cs = getComputedStyle(document.body);
    const v = k => cs.getPropertyValue(k).trim();
    const i18n = window.i18n;
    const lang = (document.documentElement.lang || i18n?.currentLanguage || '').toLowerCase();
    const isChinese = !lang || lang.startsWith('zh');
    const pick = (zh, en) => (isChinese ? zh : en);
    const t = (key, fallback, params = {}) => {
      if (!i18n?.t) return fallback;
      const translated = i18n.t(key, params);
      return translated === key ? fallback : translated;
    };
    const text = {
      N: t('surrounding.directions.N', pick('北', 'N')), NE: t('surrounding.directions.NE', pick('东北', 'NE')),
      E: t('surrounding.directions.E', pick('东', 'E')), SE: t('surrounding.directions.SE', pick('东南', 'SE')),
      S: t('surrounding.directions.S', pick('南', 'S')), SW: t('surrounding.directions.SW', pick('西南', 'SW')),
      W: t('surrounding.directions.W', pick('西', 'W')), NW: t('surrounding.directions.NW', pick('西北', 'NW')),
      low: t('prediction.cloudLayers.shortLow', pick('低云', 'Low')), mid: t('prediction.cloudLayers.shortMid', pick('中云', 'Mid')), high: t('prediction.cloudLayers.shortHigh', pick('高云', 'High')),
      sunrise: t('prediction.tabs.sunrise', pick('日出', 'Sunrise')), sunset: t('prediction.tabs.sunset', pick('日落', 'Sunset')),
      title: t('surrounding.radarTitle', pick('周边云况雷达', 'Surrounding Cloud Radar')),
      subtitle: t('surrounding.radarSubtitle', pick('20km · 连续云场', '20km · Continuous cloud field'))
    };
    const theme = {
      // 视觉 token（无 UI token 则回退默认）
      bg:             v('--radar-bg')            || v('--color-card-bg') || '#ffffff',
      border:         v('--radar-border')        || v('--color-border')  || 'rgba(0,0,0,0.10)',
      ring:           v('--radar-ring')          || 'rgba(100,130,180,0.25)',
      axisMain:       v('--radar-axis-main')     || 'rgba(100,130,180,0.30)',
      axisSub:        v('--radar-axis-sub')      || 'rgba(100,130,180,0.12)',
      labelFill:      v('--radar-label-fill')    || v('--color-text') || '#333333',
      labelBg:        v('--radar-label-bg')      || 'rgba(15,23,42,0.85)',
      title:          v('--radar-title')         || v('--color-text') || '#333333',
      subtitle:       v('--radar-subtitle')      || v('--color-text-light') || '#666666',
      legendText:     v('--radar-legend-text')   || v('--color-text-light') || '#666666',
      legendBg:       v('--radar-legend-bg')     || 'rgba(255,255,255,0.86)',
      center:         v('--radar-center')        || 'rgba(249,115,22,0.9)',
      centerStroke:   v('--radar-center-stroke') || 'rgba(0,0,0,0.20)',
      // 业务语义色：仅归档为 token，视觉值保持不变
      cloudLow:       v('--radar-cloud-low')     || 'rgba(138,156,186,0.95)',
      cloudMid:       v('--radar-cloud-mid')     || 'rgba(184,198,218,0.88)',
      cloudHigh:      v('--radar-cloud-high')    || 'rgba(218,226,238,0.72)',
      ringLow:        v('--radar-ring-low')      || 'rgba(100,150,220,0.08)',
      ringMid:        v('--radar-ring-mid')      || 'rgba(130,160,200,0.06)',
      ringHigh:       v('--radar-ring-high')     || 'rgba(160,170,200,0.05)',
    };

    const predictionType = data?.predictionType || null;
    const uid = Math.random().toString(36).slice(2, 9);
    container.innerHTML = this._build(dirs, data?.sunAzimuths || {}, theme, predictionType, uid, text);

    const canvas = container.querySelector(`#radar-cloud-field-${uid}`);
    if (canvas) {
      this._paintCloudField(canvas, dirs, theme);
    }
  }

  _parse(directions) {
    const ORDER = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const LABEL = { N: 'N', NE: 'NE', E: 'E', SE: 'SE', S: 'S', SW: 'SW', W: 'W', NW: 'NW' };
    const map = new Map();

    directions.forEach(item => {
      const d = (item.dir || '').toUpperCase();
      if (!ORDER.includes(d)) return;
      const cl = item.cloudLayers || {};
      map.set(d, {
        dir: d,
        label: LABEL[d],
        score: Math.round(Math.max(0, Math.min(100, +(item.score || 0)))),
        low: cl.low != null ? Math.max(0, Math.min(100, +cl.low)) : 0,
        mid: cl.mid != null ? Math.max(0, Math.min(100, +cl.mid)) : 0,
        high: cl.high != null ? Math.max(0, Math.min(100, +cl.high)) : 0,
      });
    });

    return ORDER.map(d => map.get(d) || {
      dir: d,
      label: LABEL[d],
      score: 0,
      low: 0,
      mid: 0,
      high: 0,
    });
  }

  _pt(cx, cy, r, az) {
    const rad = (az - 90) * Math.PI / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  }

  _dirAz(dir) {
    return { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 }[dir] ?? 0;
  }

  _smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / Math.max(1e-6, edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  _lerp(a, b, t) {
    return a + (b - a) * t;
  }

  _wrapIndex(i, n) {
    return ((i % n) + n) % n;
  }

  _interpCover(dirs, key, thetaRad) {
    // theta: 0~2π, 0 指向北，顺时针
    const twoPi = Math.PI * 2;
    const t = ((thetaRad % twoPi) + twoPi) % twoPi;
    const sector = (t / twoPi) * 8; // 8方向
    const i0 = Math.floor(sector);
    const i1 = this._wrapIndex(i0 + 1, 8);
    const f = sector - i0;

    const v0 = dirs[i0]?.[key] ?? 0;
    const v1 = dirs[i1]?.[key] ?? 0;

    // 平滑插值，消除扇区断层
    const sf = f * f * (3 - 2 * f);
    return this._lerp(v0, v1, sf);
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

    const nx0 = this._lerp(n00, n10, ux);
    const nx1 = this._lerp(n01, n11, ux);
    return this._lerp(nx0, nx1, uy);
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
    const s = (str || '').trim();
    const m = s.match(/rgba?\(([^)]+)\)/i);
    if (!m) return fallback;
    const p = m[1].split(',').map(v => parseFloat(v.trim()));
    if (p.length < 3) return fallback;
    return { r: p[0] || 0, g: p[1] || 0, b: p[2] || 0, a: (p[3] ?? 1) };
  }

  _paintCloudField(canvas, dirs, theme) {
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

    // 三层环带（强化云层可见度，减少脏颗粒）
    const layers = [
      {
        key: 'low',
        inner: R_LOW_INNER * 1.02,
        outer: R_LOW * 0.96,
        fade: (R_LOW - R_LOW_INNER) * 0.34,
        alphaMax: 0.90,
        gamma: 1.20,
        color: this._parseRgba(theme.cloudLow, { r: 138, g: 156, b: 186, a: 0.95 }),
        angStretch: 12.5,
        radStretch: 1.6,
        edgeCut: 0.18,
      },
      {
        key: 'mid',
        inner: R_LOW * 1.03,
        outer: R_MID * 0.98,
        fade: (R_MID - R_LOW) * 0.34,
        alphaMax: 0.82,
        gamma: 1.12,
        color: this._parseRgba(theme.cloudMid, { r: 184, g: 198, b: 218, a: 0.88 }),
        angStretch: 12.5,
        radStretch: 1.6,
        edgeCut: 0.20,
      },
      {
        key: 'high',
        inner: R_MID * 1.02,
        outer: R_HIGH * 0.97,
        fade: (R_HIGH - R_MID) * 0.38,
        alphaMax: 0.66,
        gamma: 1.05,
        color: this._parseRgba(theme.cloudHigh, { r: 218, g: 226, b: 238, a: 0.72 }),
        angStretch: 12.5,
        radStretch: 1.6,
        edgeCut: 0.24,
      },
    ];

    const img = ctx.createImageData(S, S);
    const px = img.data;

    for (let y = 0; y < S; y += 1) {
      for (let x = 0; x < S; x += 1) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const r = Math.sqrt(dx * dx + dy * dy);
        if (r > R_HIGH * 1.02) continue;

        // 北=0，顺时针
        let theta = Math.atan2(dy, dx) + Math.PI / 2;
        if (theta < 0) theta += Math.PI * 2;

        let outR = 0;
        let outG = 0;
        let outB = 0;
        let outA = 0;

        for (const layer of layers) {
          if (r < layer.inner - layer.fade || r > layer.outer + layer.fade) continue;

          // 环带软边
          const inW = this._smoothstep(layer.inner - layer.fade, layer.inner + layer.fade, r);
          const outW = 1 - this._smoothstep(layer.outer - layer.fade, layer.outer + layer.fade, r);
          const ringW = inW * outW;
          if (ringW <= 0.001) continue;

          // 角度连续插值得到云量
          const cover = this._interpCover(dirs, layer.key, theta);
          const base = Math.pow(Math.max(0, cover) / 100, layer.gamma);
          if (base <= 0.001) continue;

          // 方向性纹理：沿环向拉伸（u=角向，v=径向）
          const u = (theta / (Math.PI * 2)) * layer.angStretch * 8;
          const v = ((r - (layer.inner + layer.outer) / 2) / Math.max(1, (layer.outer - layer.inner))) * layer.radStretch;

          const nLarge = this._fbm(u * 0.65, v * 0.55, 3);       // 大块起伏
          const nSmall = this._fbm(u * 1.6 + 21, v * 1.0 - 7, 2); // 轻细节

          // 提高整体云量可见性，减少碎纹理“脏感”
          const tex = 0.78 + 0.24 * nLarge + 0.08 * (nSmall - 0.5);
          const shaped = this._smoothstep(layer.edgeCut, 0.98, base * tex);

          const a = Math.max(0, Math.min(1, shaped * ringW * layer.alphaMax * layer.color.a));
          if (a <= 0.001) continue;

          // source-over 逐层叠加
          const inv = 1 - outA;
          outR += layer.color.r * a * inv;
          outG += layer.color.g * a * inv;
          outB += layer.color.b * a * inv;
          outA += a * inv;
        }

        const idx = (y * S + x) * 4;
        if (outA > 0) {
          px[idx] = Math.round(outR);
          px[idx + 1] = Math.round(outG);
          px[idx + 2] = Math.round(outB);
          px[idx + 3] = Math.round(Math.max(0, Math.min(255, outA * 255)));
        }
      }
    }

    ctx.putImageData(img, 0, 0);

    // 全局轻模糊，进一步消除像素感
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = `blur(${Math.max(2.2, S * 0.007)}px)`;
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = 'none';
  }

  _build(dirs, sun, theme = {}, predictionType = null, uid = 'x', text = {}) {
    const S = this.size;
    const cx = S / 2;
    const cy = S / 2;
    const T = theme;

    const R_LOW_INNER = S * 0.11;
    const R_LOW = S * 0.20;
    const R_MID = S * 0.32;
    const R_HIGH = S * 0.42;

    const ringStroke = T.ring || 'rgba(100,130,180,0.25)';
    const rings = [
      [R_LOW, text.low || '低云'],
      [R_MID, text.mid || '中云'],
      [R_HIGH, text.high || '高云'],
    ].map(([r, lbl], i) => {
      const innerR = i === 0 ? R_LOW_INNER : [R_LOW, R_MID][i - 1];
      const [tx, ty] = this._pt(cx, cy, r - (r - innerR) / 2, 340);
      const bw = 44;
      const bh = 18;
      return `
        <circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}"
          fill="transparent" stroke="${ringStroke}" stroke-width="1"/>
        <rect x="${(tx - bw / 2).toFixed(1)}" y="${(ty - bh / 2 - 1).toFixed(1)}" width="${bw}" height="${bh}" rx="8"
          fill="${T.labelBg}"/>
        <text x="${tx.toFixed(1)}" y="${(ty + 4).toFixed(1)}" font-size="13" font-weight="800"
          fill="${T.labelFill}" text-anchor="middle">${lbl}</text>`;
    }).join('');

    const lowInnerRing = `<circle cx="${cx}" cy="${cy}" r="${R_LOW_INNER.toFixed(1)}"
      fill="transparent" stroke="${ringStroke}" stroke-width="1" opacity="0.95"/>`;

    const DIR_ORDER = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const axes = DIR_ORDER.map(d => {
      const [x2, y2] = this._pt(cx, cy, R_HIGH * 1.04, this._dirAz(d));
      const main = ['N', 'E', 'S', 'W'].includes(d);
      return `<line x1="${cx}" y1="${cy}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
        stroke="${main ? (T.axisMain || 'rgba(100,130,180,0.30)') : (T.axisSub || 'rgba(100,130,180,0.12)')}"
        stroke-width="${main ? '1' : '0.6'}"/>`;
    }).join('');

    const labelR = R_HIGH * 1.15;
    const labels = DIR_ORDER.map(d => {
      const lbl = text[d] || { N: '北', NE: '东北', E: '东', SE: '东南', S: '南', SW: '西南', W: '西', NW: '西北' }[d];
      const [x, y] = this._pt(cx, cy, labelR, this._dirAz(d));
      const bw = 36;
      const bh = 20;
      return `<g>
        <rect x="${(x - bw / 2).toFixed(1)}" y="${(y - bh / 2 - 2).toFixed(1)}" width="${bw}" height="${bh}" rx="6"
          fill="${T.labelBg}" opacity="0.92"/>
        <text x="${x.toFixed(1)}" y="${(y + 5).toFixed(1)}" text-anchor="middle"
          font-size="14" font-weight="800" fill="${T.labelFill || '#334155'}">${lbl}</text>
      </g>`;
    }).join('');

    const getSunRadius = az => {
      if (az == null) return R_HIGH * 0.92;
      const cardinals = [0, 90, 180, 270];
      const nearCardinal = cardinals.some(a => {
        let d = Math.abs(((az - a) % 360 + 540) % 360 - 180);
        return d < 14;
      });
      return nearCardinal ? (R_HIGH * 0.82) : (R_HIGH * 0.92);
    };

    let sunIcons = '';
    const isDawn = predictionType === 'sunrise';
    if (isDawn && sun.sunrise != null) {
      const iconR = getSunRadius(sun.sunrise);
      const [ix, iy] = this._pt(cx, cy, iconR, sun.sunrise);
      sunIcons = `
        <text x="${ix.toFixed(1)}" y="${(iy + 4).toFixed(1)}" text-anchor="middle" font-size="15">🌅</text>
        <text x="${ix.toFixed(1)}" y="${(iy + 17).toFixed(1)}" text-anchor="middle" font-size="9"
          fill="${T.subtitle || '#666666'}">${text.sunrise || '日出'}</text>`;
    } else if (!isDawn && sun.sunset != null) {
      const iconR = getSunRadius(sun.sunset);
      const [ix, iy] = this._pt(cx, cy, iconR, sun.sunset);
      sunIcons = `
        <text x="${ix.toFixed(1)}" y="${(iy + 4).toFixed(1)}" text-anchor="middle" font-size="15">🌇</text>
        <text x="${ix.toFixed(1)}" y="${(iy + 17).toFixed(1)}" text-anchor="middle" font-size="9"
          fill="${T.subtitle || '#666666'}">${text.sunset || '日落'}</text>`;
    } else if (sun.sunset != null) {
      const iconR = getSunRadius(sun.sunset);
      const [ix, iy] = this._pt(cx, cy, iconR, sun.sunset);
      sunIcons = `
        <text x="${ix.toFixed(1)}" y="${(iy + 4).toFixed(1)}" text-anchor="middle" font-size="15">🌇</text>
        <text x="${ix.toFixed(1)}" y="${(iy + 17).toFixed(1)}" text-anchor="middle" font-size="9"
          fill="${T.subtitle || '#666666'}">${text.sunset || '日落'}</text>`;
    }

    const center = `<circle cx="${cx}" cy="${cy}" r="4" fill="${T.center || 'rgba(249,115,22,0.9)'}" stroke="${T.centerStroke || 'rgba(0,0,0,0.20)'}" stroke-width="1.5"/>`;

    const zhFont = "'PingFang SC','Hiragino Sans GB','Microsoft YaHei','Noto Sans CJK SC','Source Han Sans SC','WenQuanYi Micro Hei',sans-serif";

    const LEGEND = [
      [T.cloudLow || 'rgba(138,156,186,0.95)', text.low || '低云'],
      [T.cloudMid || 'rgba(184,198,218,0.88)', text.mid || '中云'],
      [T.cloudHigh || 'rgba(218,226,238,0.72)', text.high || '高云'],
    ];
    const legendSvgWidth = S * 0.88;
    const legendContentWidth = 160;
    const legendOffsetX = Math.max(0, (legendSvgWidth - legendContentWidth) / 2);
    const legend = LEGEND.map(([c, l], i) => `
      <ellipse cx="${legendOffsetX + 13 + i * 58}" cy="6" rx="9" ry="5.5" fill="${c}"/>
      <text x="${legendOffsetX + 27 + i * 58}" y="10" font-size="11" font-weight="700" fill="${T.legendText || '#334155'}">${l}</text>`
    ).join('');

    return `
<div style="border:1px solid ${T.border || 'rgba(0,0,0,0.1)'};border-radius:12px;
  background:${T.bg || '#ffffff'};padding:10px 10px 8px;font-family:${zhFont};">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
    <div style="font-size:13px;font-weight:600;color:${T.title || '#333333'};">${text.title || '周边云况雷达'}</div>
    <div style="font-size:11px;color:${T.subtitle || '#666666'};">${text.subtitle || '20km · 连续云场'}</div>
  </div>
  <div style="position:relative;width:${S}px;height:${S}px;max-width:100%;margin:0 auto;">
    <canvas id="radar-cloud-field-${uid}" width="${S}" height="${S}"
      style="position:absolute;inset:0;width:${S}px;height:${S}px;display:block;"></canvas>
    <svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}"
      style="position:absolute;inset:0;display:block;font-family:${zhFont};" xmlns="http://www.w3.org/2000/svg">
      ${lowInnerRing}
      ${rings}
      ${axes}
      ${center}
      ${sunIcons}
      ${labels}
    </svg>
  </div>
  <svg width="${legendSvgWidth}" height="18" style="display:block;margin:4px auto 0;font-family:${zhFont};background:${T.legendBg};border-radius:8px;padding:0 4px;">
    ${legend}
  </svg>
</div>`;
  }
}

export default RadarCompass;
