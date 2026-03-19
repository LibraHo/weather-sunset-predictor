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
   * 画环形扇区：填满 innerR~outerR 之间的圆环，按 cover% 控制角度宽度
   * cover=100% → 38°（8方向各45°，留7°间隙）
   */
  _ringArc(cx, cy, innerR, outerR, az, cover, color) {
    if (cover === null || cover < 1) return '';

    // 云量 → 半角（度）
    const maxHalf = 19; // 最大半角，100%=38°
    const halfDeg = Math.max(3, maxHalf * (cover / 100));
    const opacity = 0.45 + (cover / 100) * 0.45;

    const a1 = az - halfDeg;
    const a2 = az + halfDeg;
    const [ox1, oy1] = this._pt(cx, cy, outerR, a1);
    const [ox2, oy2] = this._pt(cx, cy, outerR, a2);
    const [ix1, iy1] = this._pt(cx, cy, innerR, a1);
    const [ix2, iy2] = this._pt(cx, cy, innerR, a2);
    const large = halfDeg * 2 > 180 ? 1 : 0;

    const d = [
      `M ${ox1.toFixed(1)},${oy1.toFixed(1)}`,
      `A ${outerR.toFixed(1)},${outerR.toFixed(1)} 0 ${large},1 ${ox2.toFixed(1)},${oy2.toFixed(1)}`,
      `L ${ix2.toFixed(1)},${iy2.toFixed(1)}`,
      `A ${innerR.toFixed(1)},${innerR.toFixed(1)} 0 ${large},0 ${ix1.toFixed(1)},${iy1.toFixed(1)}`,
      'Z'
    ].join(' ');

    return `<path d="${d}" fill="${color}" opacity="${opacity.toFixed(2)}" />`;
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

    // ── 云层环形扇区（填满圆环宽度）
    // 中心留空 gap，三层各自填满内外圈之间
    const R_CENTER = S * 0.06; // 中心空白
    const LAYERS = [
      { key: 'low',  inner: R_CENTER, outer: R_LOW,  color: 'rgba(120,190,255,0.95)' },
      { key: 'mid',  inner: R_LOW,    outer: R_MID,  color: 'rgba(255,155,60,0.95)'  },
      { key: 'high', inner: R_MID,    outer: R_HIGH, color: 'rgba(255,220,70,0.95)'  },
    ];
    const clouds = dirs.map(d => {
      const az = this._dirAz(d.dir);
      return LAYERS.map(l => this._ringArc(cx, cy, l.inner, l.outer, az, d[l.key], l.color)).join('');
    }).join('');

    // ── 方位文字
    const labelR = R_HIGH * 1.20;
    const labels = DIR_ORDER.map(d => {
      const lbl = { N:'北',NE:'东北',E:'东',SE:'东南',S:'南',SW:'西南',W:'西',NW:'西北' }[d];
      const [x,y] = this._pt(cx, cy, labelR, this._dirAz(d));
      return `<text x="${x.toFixed(1)}" y="${(y+4).toFixed(1)}" text-anchor="middle"
        font-size="11" font-weight="500" fill="rgba(215,225,240,0.88)">${lbl}</text>`;
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
    ${labels}
    ${icons.join('')}
  </svg>
  <svg width="${S*0.88}" height="18" style="display:block;margin:4px auto 0;">
    ${legend}
  </svg>
</div>`;
  }
}

export default RadarCompass;
