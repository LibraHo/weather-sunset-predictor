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
    container.innerHTML = this._build(dirs, data?.sunAzimuths || {});
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
  _cloud(x, y, w, h, color, opacity, angleDeg = 0) {
    const uid = Math.random().toString(36).slice(2, 7);
    const rx = w / 2, ry = h / 2;

    // 主云体：扁椭圆 + 顶部鼓出
    const bumps = [
      { cx: 0,       cy: 0,         rx: rx,        ry: ry * 0.65 },   // 主体
      { cx: -rx*0.35, cy: -ry*0.35, rx: rx * 0.45, ry: ry * 0.55 },   // 左凸
      { cx:  rx*0.1,  cy: -ry*0.55, rx: rx * 0.52, ry: ry * 0.60 },   // 中凸（最高）
      { cx:  rx*0.55, cy: -ry*0.25, rx: rx * 0.40, ry: ry * 0.48 },   // 右凸
    ];

    const ellipses = bumps.map(b =>
      `<ellipse cx="${b.cx.toFixed(1)}" cy="${b.cy.toFixed(1)}" rx="${b.rx.toFixed(1)}" ry="${b.ry.toFixed(1)}" fill="url(#cg${uid})"/>`
    ).join('');

    // 底部阴影感（加深底边）
    const shadow = `<ellipse cx="0" cy="${(ry*0.4).toFixed(1)}" rx="${(rx*0.85).toFixed(1)}" ry="${(ry*0.28).toFixed(1)}" fill="${color}" opacity="0.3"/>`;

    return `<defs>
      <radialGradient id="cg${uid}" cx="40%" cy="35%" r="65%">
        <stop offset="0%" stop-color="white" stop-opacity="0.95"/>
        <stop offset="45%" stop-color="${color}" stop-opacity="0.88"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0.60"/>
      </radialGradient>
    </defs>
    <g transform="translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${angleDeg.toFixed(1)})" opacity="${opacity.toFixed(2)}">
      ${shadow}
      ${ellipses}
    </g>`;
  }

  /**
   * 在方向 az、圆环中心半径 r 处，按 cover% 画云朵
   * ringH = 圆环高度（用于云朵尺寸参考）
   */
  _drawClouds(cx, cy, r, az, cover, color, ringH) {
    if (cover === null || cover < 1) return '';

    const opacity = 0.55 + (cover / 100) * 0.40;
    const rotate = az; // 云朵沿方向轴旋转

    if (cover < 15) {
      // 零星：1小云
      const [px, py] = this._pt(cx, cy, r, az);
      return this._cloud(px, py, ringH * 0.8, ringH * 0.55, color, opacity, rotate);
    } else if (cover < 40) {
      // 少量：1中云
      const [px, py] = this._pt(cx, cy, r, az);
      return this._cloud(px, py, ringH * 1.2, ringH * 0.8, color, opacity, rotate);
    } else if (cover < 70) {
      // 较多：1大 + 两侧各1小
      const [px, py]   = this._pt(cx, cy, r, az);
      const [px2, py2] = this._pt(cx, cy, r, az - 18);
      const [px3, py3] = this._pt(cx, cy, r, az + 18);
      return this._cloud(px,  py,  ringH * 1.6, ringH * 1.0, color, opacity, rotate) +
             this._cloud(px2, py2, ringH * 0.9, ringH * 0.6, color, opacity * 0.8, rotate) +
             this._cloud(px3, py3, ringH * 0.9, ringH * 0.6, color, opacity * 0.8, rotate);
    } else {
      // 连片：3大云并排
      const [px, py]   = this._pt(cx, cy, r, az);
      const [px2, py2] = this._pt(cx, cy, r, az - 20);
      const [px3, py3] = this._pt(cx, cy, r, az + 20);
      return this._cloud(px,  py,  ringH * 1.9, ringH * 1.1, color, opacity, rotate) +
             this._cloud(px2, py2, ringH * 1.5, ringH * 0.9, color, opacity * 0.85, rotate) +
             this._cloud(px3, py3, ringH * 1.5, ringH * 0.9, color, opacity * 0.85, rotate);
    }
  }

  _build(dirs, sun) {
    const S = this.size;
    const cx = S / 2, cy = S / 2;
    const uid = Math.random().toString(36).slice(2, 7);

    // 三圈：低/中/高云，等间距
    const R_LOW  = S * 0.20;
    const R_MID  = S * 0.32;
    const R_HIGH = S * 0.42;

    // ── 同心圆 + 标签
    const rings = [
      [R_LOW,  '低云\n~1km',  'rgba(80,160,255,0.08)'],
      [R_MID,  '中云\n~3km',  'rgba(255,140,50,0.06)'],
      [R_HIGH, '高云\n~7km',  'rgba(255,210,60,0.05)'],
    ].map(([r, lbl, fill]) => {
      const [tx, ty] = this._pt(cx, cy, r, 355);
      const lines = lbl.split('\n');
      return `
        <circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}"
          fill="${fill}" stroke="rgba(180,200,230,0.25)" stroke-width="1"/>
        <text x="${tx.toFixed(1)}" y="${(ty-3).toFixed(1)}" font-size="8"
          fill="rgba(180,200,230,0.65)" text-anchor="middle">${lines[0]}</text>
        <text x="${tx.toFixed(1)}" y="${(ty+6).toFixed(1)}" font-size="7.5"
          fill="rgba(150,170,200,0.55)" text-anchor="middle">${lines[1]}</text>`;
    }).join('');

    // ── 轴线
    const DIR_ORDER = ['N','NE','E','SE','S','SW','W','NW'];
    const axes = DIR_ORDER.map(d => {
      const [x2,y2] = this._pt(cx, cy, R_HIGH * 1.04, this._dirAz(d));
      const main = ['N','E','S','W'].includes(d);
      return `<line x1="${cx}" y1="${cy}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
        stroke="rgba(180,195,220,${main?'0.28':'0.13'})" stroke-width="${main?'1':'0.6'}"/>`;
    }).join('');

    // ── 云朵（每层圆环的中心半径 + 圆环高度）
    const LAYERS = [
      { key: 'low',  r: (R_LOW  * 0.5),               ringH: R_LOW  * 0.9, color: 'rgba(140,200,255,0.95)' },
      { key: 'mid',  r: (R_LOW  + R_MID)  / 2,        ringH: (R_MID  - R_LOW)  * 0.9, color: 'rgba(255,160,65,0.95)'  },
      { key: 'high', r: (R_MID  + R_HIGH) / 2,        ringH: (R_HIGH - R_MID)  * 0.9, color: 'rgba(255,225,80,0.95)'  },
    ];
    const clouds = dirs.map(d => {
      const az = this._dirAz(d.dir);
      return LAYERS.map(l => this._drawClouds(cx, cy, l.r, az, d[l.key], l.color, l.ringH)).join('');
    }).join('');

    // ── 方位文字（labelR 要大于 R_HIGH，渲染在最后确保不被遮挡）
    const labelR = R_HIGH * 1.28;
    const labels = DIR_ORDER.map(d => {
      const lbl = { N:'北',NE:'东北',E:'东',SE:'东南',S:'南',SW:'西南',W:'西',NW:'西北' }[d];
      const [x,y] = this._pt(cx, cy, labelR, this._dirAz(d));
      // 加半透明背景块，防止云朵颜色渗透
      return `<rect x="${(x-14).toFixed(1)}" y="${(y-11).toFixed(1)}" width="28" height="14" rx="3"
          fill="rgba(10,18,35,0.55)"/>
        <text x="${x.toFixed(1)}" y="${(y+3).toFixed(1)}" text-anchor="middle"
          font-size="11" font-weight="600" fill="rgba(225,232,245,0.95)">${lbl}</text>`;
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

    // ── 中心
    const center = `<circle cx="${cx}" cy="${cy}" r="4" fill="rgba(249,115,22,0.9)" stroke="#0f172a" stroke-width="1.5"/>`;

    // ── 图例
    const legend = [
      ['rgba(120,190,255,0.85)', '低云'],
      ['rgba(255,155,60,0.85)',  '中云'],
      ['rgba(255,220,70,0.85)',  '高云'],
    ].map(([c,l], i) => `
      <rect x="${6+i*52}" y="2" width="14" height="6" rx="2" fill="${c}"/>
      <text x="${24+i*52}" y="11" font-size="9.5" fill="rgba(200,212,228,0.85)">${l}</text>`
    ).join('');

    return `
<div style="border:1px solid rgba(148,163,184,0.18);border-radius:12px;
  background:linear-gradient(180deg,rgba(15,23,42,0.78),rgba(15,23,42,0.52));
  padding:10px 10px 8px;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
    <div style="font-size:13px;font-weight:600;color:rgba(241,245,249,0.95);">周边云况雷达</div>
    <div style="font-size:11px;color:rgba(148,163,184,0.78);">50km · 三层云</div>
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
