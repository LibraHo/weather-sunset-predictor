/**
 * RadarCompass v7
 *
 * 三个同心圆代表云层高度：
 *   内圈 = 低云 (~1km)
 *   中圈 = 中云 (~3km)
 *   外圈 = 高云 (~7km)
 *
 * 云朵：多圆叠加经典形状，沿圆环切线旋转
 * 背景色跟随主题（--color-card-bg）
 * 只显示日出或日落一个方向
 */
class RadarCompass {
  constructor(options = {}) {
    this.size = options.size || 300;
  }

  render(container, data) {
    if (!container) return;
    const dirs = this._parse(data?.directions || []);
    if (!dirs.length) { container.innerHTML = ''; return; }

    // 读取主题 CSS 变量
    const cs = getComputedStyle(document.documentElement);
    const v = k => cs.getPropertyValue(k).trim();
    const theme = {
      // 面板背景/边框跟随主题卡片
      bg:         v('--color-card-bg')     || '#ffffff',
      border:     v('--color-border')      || 'rgba(0,0,0,0.10)',
      ring:       v('--radar-ring')        || 'rgba(100,130,180,0.25)',
      axisMain:   v('--radar-axis-main')   || 'rgba(100,130,180,0.30)',
      axisSub:    v('--radar-axis-sub')    || 'rgba(100,130,180,0.12)',
      labelFill:  v('--color-text')        || '#333333',
      labelBg:    v('--color-bg')          || 'rgba(255,255,255,0.75)',
      title:      v('--color-text')        || '#333333',
      subtitle:   v('--color-text-light')  || '#666666',
      legendText: v('--color-text-light')  || '#666666',
      center:     v('--radar-center')      || 'rgba(249,115,22,0.9)',
      cloudLow:   v('--radar-cloud-low')   || 'rgba(80,110,155,0.85)',
      cloudMid:   v('--radar-cloud-mid')   || 'rgba(110,130,165,0.82)',
      cloudHigh:  v('--radar-cloud-high')  || 'rgba(145,155,175,0.80)',
      ringLow:    'rgba(100,150,220,0.08)',
      ringMid:    'rgba(130,160,200,0.06)',
      ringHigh:   'rgba(160,170,200,0.05)',
    };

    const predictionType = data?.predictionType || null;
    container.innerHTML = this._build(dirs, data?.sunAzimuths || {}, theme, predictionType);
  }

  _parse(directions) {
    const ORDER = ['N','NE','E','SE','S','SW','W','NW'];
    const LABEL = { N:'北',NE:'东北',E:'东',SE:'东南',S:'南',SW:'西南',W:'西',NW:'西北' };
    const map = new Map();
    directions.forEach(item => {
      const d = (item.dir || '').toUpperCase();
      if (!ORDER.includes(d)) return;
      const cl = item.cloudLayers || {};
      map.set(d, {
        dir: d, label: LABEL[d],
        score: Math.round(Math.max(0, Math.min(100, +(item.score || 0)))),
        low:  cl.low  != null ? Math.max(0, Math.min(100, +cl.low))  : null,
        mid:  cl.mid  != null ? Math.max(0, Math.min(100, +cl.mid))  : null,
        high: cl.high != null ? Math.max(0, Math.min(100, +cl.high)) : null,
      });
    });
    return ORDER.map(d => map.get(d) || {
      dir: d, label: LABEL[d], score: 0, low: null, mid: null, high: null
    });
  }

  /** 方位角(北=0顺时针) → SVG (x,y) */
  _pt(cx, cy, r, az) {
    const rad = (az - 90) * Math.PI / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  }

  _dirAz(dir) {
    return { N:0, NE:45, E:90, SE:135, S:180, SW:225, W:270, NW:315 }[dir] ?? 0;
  }

  /**
   * 经典云朵：3-4个圆叠加，顶部鼓起
   * rotateDeg = 旋转角（对齐圆环切线方向）
   */
  _cloud(x, y, w, h, color, opacity, rotateDeg = 0) {
    const rw = w / 2;
    const br = h * 0.42; // 基础圆半径

    const ellipses = [
      // 底部横向底座
      `<ellipse cx="0" cy="${(br*0.3).toFixed(1)}" rx="${(rw*0.82).toFixed(1)}" ry="${(br*0.48).toFixed(1)}" fill="${color}"/>`,
      // 左侧凸起
      `<ellipse cx="${(-rw*0.38).toFixed(1)}" cy="${(-br*0.05).toFixed(1)}" rx="${(br*0.58).toFixed(1)}" ry="${(br*0.58).toFixed(1)}" fill="${color}"/>`,
      // 中央最高凸起
      `<ellipse cx="0" cy="${(-br*0.32).toFixed(1)}" rx="${(br*0.70).toFixed(1)}" ry="${(br*0.70).toFixed(1)}" fill="${color}"/>`,
      // 右侧凸起
      `<ellipse cx="${(rw*0.38).toFixed(1)}" cy="${(-br*0.10).toFixed(1)}" rx="${(br*0.54).toFixed(1)}" ry="${(br*0.54).toFixed(1)}" fill="${color}"/>`,
    ].join('');

    return `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${rotateDeg.toFixed(1)})" opacity="${opacity.toFixed(2)}">
      ${ellipses}
    </g>`;
  }

  /**
   * 在方向 az、弧半径 r 处按云量画云朵
   * 云朵沿圆弧切线旋转（tangent = az + 90）
   */
  _drawClouds(cx, cy, r, az, cover, color, ringH) {
    if (cover === null || cover < 1) return '';

    const opacity = 0.55 + (cover / 100) * 0.40;
    const tangent = az + 90; // 切线方向

    const cloud = (scale, offsetAz = 0) => {
      const [px, py] = this._pt(cx, cy, r, az + offsetAz);
      const w = ringH * scale;
      const h = ringH * scale * 0.62;
      return this._cloud(px, py, w, h, color, opacity, tangent + offsetAz);
    };

    if (cover < 15) {
      return cloud(1.4);
    } else if (cover < 40) {
      return cloud(2.0);
    } else if (cover < 70) {
      return cloud(2.6) + cloud(1.5, -20) + cloud(1.5, 20);
    } else {
      return cloud(3.2) + cloud(2.0, -22) + cloud(2.0, 22);
    }
  }

  _build(dirs, sun, theme = {}, predictionType = null) {
    const S = this.size;
    const cx = S / 2, cy = S / 2;
    const uid = Math.random().toString(36).slice(2, 7);
    const T = theme;

    const R_LOW  = S * 0.20;
    const R_MID  = S * 0.32;
    const R_HIGH = S * 0.42;

    // ── 同心圆（带轻微填充区分层次）
    const rings = [
      [R_LOW,  T.ringLow  || 'rgba(100,150,220,0.08)', '低云', '~1km'],
      [R_MID,  T.ringMid  || 'rgba(130,160,200,0.06)', '中云', '~3km'],
      [R_HIGH, T.ringHigh || 'rgba(160,170,200,0.05)', '高云', '~7km'],
    ].map(([r, fill, lbl, sub], i) => {
      // 环形填充（内外圈之间）
      const innerR = i === 0 ? 0 : [R_LOW, R_MID][i - 1];
      // 标签放在北偏西一点（355°），避免被北方向文字遮挡
      const [tx, ty] = this._pt(cx, cy, r - (r - innerR) / 2, 340);
      return `
        <circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}"
          fill="transparent" stroke="${T.ring||'rgba(100,130,180,0.25)'}" stroke-width="1" stroke-dasharray="${i===0?'none':'none'}"/>
        <text x="${tx.toFixed(1)}" y="${(ty+3).toFixed(1)}" font-size="9.5" font-weight="600"
          fill="${T.ring||'rgba(100,130,180,0.55)'}" text-anchor="middle" opacity="0.85">${lbl}</text>`;
    }).join('');

    // ── 轴线
    const DIR_ORDER = ['N','NE','E','SE','S','SW','W','NW'];
    const axes = DIR_ORDER.map(d => {
      const [x2,y2] = this._pt(cx, cy, R_HIGH * 1.04, this._dirAz(d));
      const main = ['N','E','S','W'].includes(d);
      return `<line x1="${cx}" y1="${cy}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
        stroke="${main ? (T.axisMain||'rgba(100,130,180,0.30)') : (T.axisSub||'rgba(100,130,180,0.12)')}"
        stroke-width="${main?'1':'0.6'}"/>`;
    }).join('');

    // ── 云朵（三层，各自颜色）
    const LAYERS = [
      { key: 'low',  r: R_LOW * 0.55,              ringH: R_LOW * 1.0,           color: T.cloudLow  || 'rgba(80,110,155,0.85)'  },
      { key: 'mid',  r: (R_LOW + R_MID) / 2,       ringH: (R_MID - R_LOW) * 0.9, color: T.cloudMid  || 'rgba(110,130,165,0.82)' },
      { key: 'high', r: (R_MID + R_HIGH) / 2,      ringH: (R_HIGH - R_MID) * 0.9, color: T.cloudHigh || 'rgba(145,155,175,0.80)' },
    ];
    const clouds = dirs.map(d => {
      const az = this._dirAz(d.dir);
      return LAYERS.map(l => this._drawClouds(cx, cy, l.r, az, d[l.key], l.color, l.ringH)).join('');
    }).join('');

    // ── 方位文字（最顶层）
    const labelR = R_HIGH * 1.28;
    const MAIN_DIRS = ['N','NE','E','SE','S','SW','W','NW'];
    const labels = MAIN_DIRS.map(d => {
      const lbl = { N:'北',NE:'东北',E:'东',SE:'东南',S:'南',SW:'西南',W:'西',NW:'西北' }[d];
      const [x,y] = this._pt(cx, cy, labelR, this._dirAz(d));
      const bgColor = T.labelBg || 'rgba(255,255,255,0.75)';
      const textColor = T.labelFill || '#333333';
      return `<rect x="${(x-15).toFixed(1)}" y="${(y-10).toFixed(1)}" width="30" height="14" rx="3"
          fill="${bgColor}" opacity="0.85"/>
        <text x="${x.toFixed(1)}" y="${(y+3).toFixed(1)}" text-anchor="middle"
          font-size="11" font-weight="600" fill="${textColor}">${lbl}</text>`;
    }).join('');

    // ── 日出 / 日落：只显示一个，带文字标注
    const iconR = R_HIGH * 1.08;
    let sunIcons = '';
    const isDawn = predictionType === 'sunrise';

    if (isDawn && sun.sunrise != null) {
      const [ix, iy] = this._pt(cx, cy, iconR, sun.sunrise);
      sunIcons = `
        <text x="${ix.toFixed(1)}" y="${(iy+4).toFixed(1)}" text-anchor="middle" font-size="15">🌅</text>
        <text x="${ix.toFixed(1)}" y="${(iy+17).toFixed(1)}" text-anchor="middle" font-size="9"
          fill="${T.subtitle||'#666666'}">日出</text>`;
    } else if (!isDawn && sun.sunset != null) {
      const [ix, iy] = this._pt(cx, cy, iconR, sun.sunset);
      sunIcons = `
        <text x="${ix.toFixed(1)}" y="${(iy+4).toFixed(1)}" text-anchor="middle" font-size="15">🌇</text>
        <text x="${ix.toFixed(1)}" y="${(iy+17).toFixed(1)}" text-anchor="middle" font-size="9"
          fill="${T.subtitle||'#666666'}">日落</text>`;
    } else if (sun.sunset != null) {
      // fallback: 显示日落
      const [ix, iy] = this._pt(cx, cy, iconR, sun.sunset);
      sunIcons = `
        <text x="${ix.toFixed(1)}" y="${(iy+4).toFixed(1)}" text-anchor="middle" font-size="15">🌇</text>
        <text x="${ix.toFixed(1)}" y="${(iy+17).toFixed(1)}" text-anchor="middle" font-size="9"
          fill="${T.subtitle||'#666666'}">日落</text>`;
    }

    // ── 中心点
    const center = `<circle cx="${cx}" cy="${cy}" r="4" fill="${T.center||'rgba(249,115,22,0.9)'}" stroke="rgba(0,0,0,0.2)" stroke-width="1.5"/>`;

    // ── 图例
    const LEGEND = [
      [T.cloudLow  || 'rgba(80,110,155,0.85)',  '低云'],
      [T.cloudMid  || 'rgba(110,130,165,0.82)', '中云'],
      [T.cloudHigh || 'rgba(145,155,175,0.80)', '高云'],
    ];
    const legend = LEGEND.map(([c,l], i) => `
      <ellipse cx="${13+i*56}" cy="5" rx="9" ry="5.5" fill="${c}"/>
      <text x="${26+i*56}" y="9" font-size="10" fill="${T.legendText||'#666666'}">${l}</text>`
    ).join('');

    return `
<div style="border:1px solid ${T.border||'rgba(0,0,0,0.1)'};border-radius:12px;
  background:${T.bg||'#ffffff'};
  padding:10px 10px 8px;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
    <div style="font-size:13px;font-weight:600;color:${T.title||'#333333'};">周边云况雷达</div>
    <div style="font-size:11px;color:${T.subtitle||'#666666'};">50km · 三层云</div>
  </div>
  <svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}"
    style="max-width:100%;display:block;margin:0 auto;" xmlns="http://www.w3.org/2000/svg">
    ${rings}
    ${axes}
    ${clouds}
    ${center}
    ${sunIcons}
    ${labels}
  </svg>
  <svg width="${S*0.88}" height="18" style="display:block;margin:4px auto 0;">
    ${legend}
  </svg>
</div>`;
  }
}

export default RadarCompass;
