/**
 * RadarCompass v6
 *
 * 三个同心圆代表云层高度：
 *   内圈 = 低云 (stratus ~1km)
 *   中圈 = 中云 (alto ~3km)
 *   外圈 = 高云 (cirrus ~7km)
 *
 * 每个方向在对应圆的位置画云朵 SVG 形状
 * 云量 → 云朵大小 + 数量：
 *   0%       不画
 *   1-15%    1个小云
 *   16-40%   1个中云
 *   41-70%   1大1小
 *   71-100%  2大云重叠（连片）
 */
class RadarCompass {
  constructor(options = {}) {
    this.size = options.size || 300;
  }

  render(container, data) {
    if (!container) return;
    const dirs = this._parse(data?.directions || []);
    if (!dirs.length) { container.innerHTML = ''; return; }
    // 读取当前主题 CSS 变量
    const cs = getComputedStyle(document.documentElement);
    const v = k => cs.getPropertyValue(k).trim();
    const theme = {
      bg:         v('--radar-bg')          || 'linear-gradient(180deg,rgba(15,23,42,0.82),rgba(15,23,42,0.60))',
      border:     v('--radar-border')      || 'rgba(148,163,184,0.18)',
      ring:       v('--radar-ring')        || 'rgba(180,200,230,0.22)',
      axisMain:   v('--radar-axis-main')   || 'rgba(180,200,230,0.28)',
      axisSub:    v('--radar-axis-sub')    || 'rgba(180,200,230,0.12)',
      labelFill:  v('--radar-label-fill')  || 'rgba(220,230,245,0.92)',
      labelBg:    v('--radar-label-bg')    || 'rgba(10,18,35,0.60)',
      title:      v('--radar-title')       || 'rgba(241,245,249,0.95)',
      subtitle:   v('--radar-subtitle')    || 'rgba(148,163,184,0.80)',
      legendText: v('--radar-legend-text') || 'rgba(200,212,228,0.85)',
      center:     v('--radar-center')      || 'rgba(249,115,22,0.90)',
      cloudLow:   v('--radar-cloud-low')   || 'rgba(120,190,255,0.92)',
      cloudMid:   v('--radar-cloud-mid')   || 'rgba(255,155,60,0.92)',
      cloudHigh:  v('--radar-cloud-high')  || 'rgba(255,220,70,0.92)',
    };
    container.innerHTML = this._build(dirs, data?.sunAzimuths || {}, theme);
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
        cloudBaseHeight: cl.cloudBaseHeight || null,
      });
    });
    return ORDER.map(d => map.get(d) || {
      dir: d, label: LABEL[d], score: 0,
      low: null, mid: null, high: null, cloudBaseHeight: null
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
   * 在 (x,y) 处画一个云朵形状，width/height 控制大小，angle 控制旋转（对齐方向轴）
   */
  /**
   * Windy风格云层渲染：扁平有机形状 + 径向渐变
   * 用多层椭圆叠加模拟云层厚度感
   */
  /**
   * 弧形 pill：沿圆弧方向弯曲的云块
   * r = 所在圆环半径（用于计算弧度），cx/cy = 圆心
   */
  _cloud(x, y, w, h, color, opacity, angleDeg = 0, arcR = 0) {
    const rw = w / 2;
    const rh = Math.min(h * 0.38, rw * 0.28); // 扁平高度
    const cr = rh; // pill corner radius

    if (arcR > 8) {
      // 弧形 pill：用两条弧线 + 圆端帽
      const halfAngle = (rw / arcR) * (180 / Math.PI); // 弧占角度（度）
      const innerR = arcR - rh, outerR = arcR + rh;
      const toRad = a => (a - 90) * Math.PI / 180;

      const startAng = angleDeg - halfAngle;
      const endAng   = angleDeg + halfAngle;

      // 四个角点（相对圆心 cx,cy）
      const p = (R, a) => [
        Math.cos(toRad(a)) * R,
        Math.sin(toRad(a)) * R
      ];
      const [ox1, oy1] = p(outerR, startAng);
      const [ox2, oy2] = p(outerR, endAng);
      const [ix1, iy1] = p(innerR, startAng);
      const [ix2, iy2] = p(innerR, endAng);

      const laf = halfAngle * 2 > 180 ? 1 : 0;
      // 中点（画端帽圆心）
      const [mox, moy] = p(arcR, startAng);
      const [mex, mey] = p(arcR, endAng);

      const d = [
        `M ${ox1.toFixed(1)},${oy1.toFixed(1)}`,
        `A ${outerR.toFixed(1)},${outerR.toFixed(1)} 0 ${laf},1 ${ox2.toFixed(1)},${oy2.toFixed(1)}`,
        `A ${cr.toFixed(1)},${cr.toFixed(1)} 0 0,1 ${ix2.toFixed(1)},${iy2.toFixed(1)}`,
        `A ${innerR.toFixed(1)},${innerR.toFixed(1)} 0 ${laf},0 ${ix1.toFixed(1)},${iy1.toFixed(1)}`,
        `A ${cr.toFixed(1)},${cr.toFixed(1)} 0 0,1 ${ox1.toFixed(1)},${oy1.toFixed(1)}`,
        'Z'
      ].join(' ');

      // 渲染相对圆心 (cx,cy)，但调用方传入的 x,y 是圆弧点 → 改用全局坐标
      // 注意：调用方传 cx,cy 而不是弧上的点
      // x,y 是 SVG 圆心坐标，path 坐标系是相对于圆心的偏移 → 加 translate
      return `<path d="${d}" fill="${color}" opacity="${opacity.toFixed(2)}" transform="translate(${x.toFixed(1)},${y.toFixed(1)})"/>`;
    }

    // fallback：普通 pill
    return `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${angleDeg.toFixed(1)})" opacity="${opacity.toFixed(2)}">
      <rect x="${(-rw).toFixed(1)}" y="${(-rh).toFixed(1)}" width="${(rw*2).toFixed(1)}" height="${(rh*2).toFixed(1)}" rx="${cr.toFixed(1)}" fill="${color}"/>
    </g>`;
  }

  /**
   * 在方向 az、圆环中心半径 r 处，按 cover% 画云朵
   * ringH = 圆环高度（用于云朵尺寸参考）
   */
  _drawClouds(cx, cy, r, az, cover, color, ringH) {
    if (cover === null || cover < 1) return '';

    const opacity = 0.55 + (cover / 100) * 0.40;

    // 弧形 pill：传圆心 + 弧半径 + 方向角，让 _cloud 自己计算弧路径
    const arc = (w, offsetAz = 0) =>
      this._cloud(cx, cy, w, ringH, color, opacity, az + offsetAz, r);

    if (cover < 15) {
      return arc(ringH * 2.0);
    } else if (cover < 40) {
      return arc(ringH * 3.2);
    } else if (cover < 70) {
      return arc(ringH * 4.5) +
             arc(ringH * 2.2, -22) +
             arc(ringH * 2.2,  22);
    } else {
      return arc(ringH * 5.5) +
             arc(ringH * 3.5, -24) +
             arc(ringH * 3.5,  24);
    }
  }

  _build(dirs, sun, theme = {}) {
    const S = this.size;
    const cx = S / 2, cy = S / 2;
    const uid = Math.random().toString(36).slice(2, 7);

    const T = theme; // 主题颜色快捷引用

    // 三圈：低/中/高云
    const R_LOW  = S * 0.20;
    const R_MID  = S * 0.32;
    const R_HIGH = S * 0.42;

    // ── 同心圆 + 标签（用主题颜色）
    const RING_DEF = [
      [R_LOW,  '低云', '~1km'],
      [R_MID,  '中云', '~3km'],
      [R_HIGH, '高云', '~7km'],
    ];
    const rings = RING_DEF.map(([r, lbl, sub]) => {
      const [tx, ty] = this._pt(cx, cy, r, 355);
      return `
        <circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}"
          fill="transparent" stroke="${T.ring || 'rgba(180,200,230,0.22)'}" stroke-width="1"/>
        <text x="${tx.toFixed(1)}" y="${(ty-2).toFixed(1)}" font-size="8"
          fill="${T.ring || 'rgba(180,200,230,0.55)'}" text-anchor="middle">${lbl}</text>
        <text x="${tx.toFixed(1)}" y="${(ty+7).toFixed(1)}" font-size="7"
          fill="${T.ring || 'rgba(180,200,230,0.40)'}" text-anchor="middle">${sub}</text>`;
    }).join('');

    // ── 轴线
    const DIR_ORDER = ['N','NE','E','SE','S','SW','W','NW'];
    const axes = DIR_ORDER.map(d => {
      const [x2,y2] = this._pt(cx, cy, R_HIGH * 1.04, this._dirAz(d));
      const main = ['N','E','S','W'].includes(d);
      return `<line x1="${cx}" y1="${cy}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
        stroke="${main ? (T.axisMain||'rgba(180,200,230,0.28)') : (T.axisSub||'rgba(180,200,230,0.12)')}"
        stroke-width="${main?'1':'0.6'}"/>`;
    }).join('');

    // ── 云朵（用主题云色）
    const LAYERS = [
      { key: 'low',  r: R_LOW * 0.5,              ringH: R_LOW * 0.9,          color: T.cloudLow  || 'rgba(120,190,255,0.92)' },
      { key: 'mid',  r: (R_LOW + R_MID) / 2,      ringH: (R_MID - R_LOW) * 0.9, color: T.cloudMid  || 'rgba(255,155,60,0.92)'  },
      { key: 'high', r: (R_MID + R_HIGH) / 2,     ringH: (R_HIGH - R_MID) * 0.9, color: T.cloudHigh || 'rgba(255,220,70,0.92)'  },
    ];
    const clouds = dirs.map(d => {
      const az = this._dirAz(d.dir);
      return LAYERS.map(l => this._drawClouds(cx, cy, l.r, az, d[l.key], l.color, l.ringH)).join('');
    }).join('');

    // ── 方位文字（最顶层，用主题色）
    const labelR = R_HIGH * 1.28;
    const labels = DIR_ORDER.map(d => {
      const lbl = { N:'北',NE:'东北',E:'东',SE:'东南',S:'南',SW:'西南',W:'西',NW:'西北' }[d];
      const [x,y] = this._pt(cx, cy, labelR, this._dirAz(d));
      return `<rect x="${(x-14).toFixed(1)}" y="${(y-11).toFixed(1)}" width="28" height="14" rx="3"
          fill="${T.labelBg || 'rgba(10,18,35,0.55)'}"/>
        <text x="${x.toFixed(1)}" y="${(y+3).toFixed(1)}" text-anchor="middle"
          font-size="11" font-weight="600" fill="${T.labelFill || 'rgba(225,232,245,0.95)'}">${lbl}</text>`;
    }).join('');

    // ── 日出/日落图标
    const iconR = R_HIGH * 1.05;
    const icons = [];
    if (sun.sunrise != null) {
      const [ix,iy] = this._pt(cx, cy, iconR, sun.sunrise);
      icons.push(`<text x="${ix.toFixed(1)}" y="${(iy+5).toFixed(1)}" text-anchor="middle" font-size="14">🌅</text>`);
    }
    if (sun.sunset != null) {
      const [ix,iy] = this._pt(cx, cy, iconR, sun.sunset);
      icons.push(`<text x="${ix.toFixed(1)}" y="${(iy+5).toFixed(1)}" text-anchor="middle" font-size="14">🌇</text>`);
    }

    // ── 中心点
    const center = `<circle cx="${cx}" cy="${cy}" r="4" fill="${T.center||'rgba(249,115,22,0.9)'}" stroke="rgba(0,0,0,0.3)" stroke-width="1.5"/>`;

    // ── 图例
    const LEGEND = [
      [T.cloudLow  || 'rgba(140,160,185,0.90)', '低云'],
      [T.cloudMid  || 'rgba(190,200,215,0.88)', '中云'],
      [T.cloudHigh || 'rgba(230,225,210,0.92)', '高云'],
    ];
    const legend = LEGEND.map(([c,l], i) => `
      <rect x="${6+i*52}" y="2" width="14" height="6" rx="2" fill="${c}"/>
      <text x="${24+i*52}" y="11" font-size="9.5" fill="${T.legendText||'rgba(200,212,228,0.85)'}">${l}</text>`
    ).join('');

    return `
<div style="border:1px solid ${T.border||'rgba(148,163,184,0.18)'};border-radius:12px;
  background:${T.bg||'linear-gradient(180deg,rgba(15,23,42,0.78),rgba(15,23,42,0.52))'};
  padding:10px 10px 8px;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
    <div style="font-size:13px;font-weight:600;color:${T.title||'rgba(241,245,249,0.95)'};">周边云况雷达</div>
    <div style="font-size:11px;color:${T.subtitle||'rgba(148,163,184,0.78)'};">50km · 三层云</div>
  </div>
  <svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}"
    style="max-width:100%;display:block;margin:0 auto;" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="bg${uid}" cx="50%" cy="50%" r="60%">
        <stop offset="0%" stop-color="rgba(30,58,120,0.22)"/>
        <stop offset="100%" stop-color="rgba(15,23,42,0)"/>
      </radialGradient>
    </defs>
    <circle cx="${cx}" cy="${cy}" r="${(R_HIGH*1.07).toFixed(1)}" fill="url(#bg${uid})"/>
    ${rings}
    ${axes}
    ${clouds}
    ${center}
    ${icons.join('')}
    ${labels}
  </svg>
  <svg width="${S*0.88}" height="18" style="display:block;margin:4px auto 0;">
    ${legend}
  </svg>
</div>`;
  }
}

export default RadarCompass;
