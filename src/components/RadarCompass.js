/**
 * RadarCompass v5
 *
 * 布局：
 *   上北下南，顺时针（N=顶, E=右, S=底, W=左）
 *
 * 同心圆（从外到内）：
 *   外圈 = 高云（cirrus, 6km+）
 *   中圈 = 中云（alto, ~3km）
 *   内圈 = 低云（stratus, ~1km）
 *
 * 云量 → 弧线：
 *   0%        不画
 *   1–15%     2~3 个短虚点
 *   16–40%    短弧（约30°）
 *   41–70%    中弧（约60°）
 *   71–100%   宽弧（约80°），线宽加粗
 *
 * 方向标注：
 *   8方位文字 + 🌅日出 / 🌇日落 图标（实际方位角）
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

  // ─── 数据解析 ────────────────────────────────────────────
  _parse(directions) {
    const ORDER = ['N','NE','E','SE','S','SW','W','NW'];
    const LABEL = { N:'北', NE:'东北', E:'东', SE:'东南', S:'南', SW:'西南', W:'西', NW:'西北' };
    const map = new Map();
    directions.forEach(item => {
      const d = (item.dir || '').toUpperCase();
      if (!ORDER.includes(d)) return;
      const cl = item.cloudLayers || {};
      map.set(d, {
        dir: d,
        label: LABEL[d],
        score: Math.round(Math.max(0, Math.min(100, +(item.score || 0)))),
        low:  cl.low  != null ? Math.max(0, Math.min(100, +cl.low))  : null,
        mid:  cl.mid  != null ? Math.max(0, Math.min(100, +cl.mid))  : null,
        high: cl.high != null ? Math.max(0, Math.min(100, +cl.high)) : null,
        cloudBaseHeight: cl.cloudBaseHeight || null,
      });
    });
    return ORDER.map(d => map.get(d) || { dir: d, label: LABEL[d], score: 0, low: null, mid: null, high: null, cloudBaseHeight: null });
  }

  // ─── 坐标工具 ─────────────────────────────────────────────
  /** azimuth: 北=0, 顺时针(度) → SVG (x,y) */
  _pt(cx, cy, r, az) {
    const rad = (az - 90) * Math.PI / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  }

  _dirAz(dir) {
    return { N:0, NE:45, E:90, SE:135, S:180, SW:225, W:270, NW:315 }[dir] ?? 0;
  }

  // ─── 云弧生成 ─────────────────────────────────────────────
  /**
   * 在半径 r 的圆上，以方位角 az 为中心，画表示 cover% 云量的弧
   */
  _cloudArc(cx, cy, r, az, cover, color) {
    if (cover === null || cover < 1) return '';

    // 弧宽（度）：coverage → 弧的角度范围
    let spanDeg, strokeW, dasharray;
    if (cover < 16) {
      // 零星：3个小点
      return this._cloudDots(cx, cy, r, az, color);
    } else if (cover < 41) {
      spanDeg = 28; strokeW = 3.5; dasharray = '';
    } else if (cover < 71) {
      spanDeg = 52; strokeW = 5; dasharray = '';
    } else {
      spanDeg = 76; strokeW = 7; dasharray = '';
    }
    const opacity = 0.55 + (cover / 100) * 0.40;

    const a1 = az - spanDeg / 2;
    const a2 = az + spanDeg / 2;
    const [x1, y1] = this._pt(cx, cy, r, a1);
    const [x2, y2] = this._pt(cx, cy, r, a2);
    const large = spanDeg > 180 ? 1 : 0;

    return `<path d="M${x1.toFixed(1)},${y1.toFixed(1)} A${r.toFixed(1)},${r.toFixed(1)} 0 ${large},1 ${x2.toFixed(1)},${y2.toFixed(1)}"
      fill="none" stroke="${color}" stroke-width="${strokeW}" stroke-linecap="round"
      opacity="${opacity.toFixed(2)}" />`;
  }

  _cloudDots(cx, cy, r, az, color) {
    const offsets = [-12, 0, 12];
    return offsets.map(off => {
      const [x, y] = this._pt(cx, cy, r, az + off);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.2" fill="${color}" opacity="0.65"/>`;
    }).join('');
  }

  // ─── 主渲染 ───────────────────────────────────────────────
  _build(dirs, sun) {
    const S = this.size;
    const cx = S / 2, cy = S / 2;
    const uid = Math.random().toString(36).slice(2, 7);

    // 三圈半径
    const R_LOW  = S * 0.20;   // 内圈：低云
    const R_MID  = S * 0.30;   // 中圈：中云
    const R_HIGH = S * 0.40;   // 外圈：高云

    // ── 同心圆
    const rings = [
      [R_LOW,  '低云', 'rgba(100,170,255,0.30)'],
      [R_MID,  '中云', 'rgba(255,150,60,0.25)'],
      [R_HIGH, '高云', 'rgba(255,215,70,0.20)'],
    ].map(([r, lbl, col]) => {
      const [tx, ty] = this._pt(cx, cy, r, 352);
      return `
        <circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill="${col}"
          stroke="rgba(200,210,230,0.22)" stroke-width="1"/>
        <text x="${tx.toFixed(1)}" y="${(ty-2).toFixed(1)}" font-size="8.5"
          fill="rgba(190,205,225,0.65)" text-anchor="middle">${lbl}</text>`;
    }).join('');

    // ── 轴线（8方位）
    const DIR_ORDER = ['N','NE','E','SE','S','SW','W','NW'];
    const axes = DIR_ORDER.map(d => {
      const [x2,y2] = this._pt(cx, cy, R_HIGH * 1.05, this._dirAz(d));
      const main = ['N','E','S','W'].includes(d);
      return `<line x1="${cx}" y1="${cy}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
        stroke="rgba(180,195,215,${main?'0.28':'0.14'})" stroke-width="${main?'1':'0.6'}"/>`;
    }).join('');

    // ── 云弧（每方向各3层）
    const CLOUD_STYLES = [
      { key:'low',  r: R_LOW,  color:'rgba(100,180,255,1)' },
      { key:'mid',  r: R_MID,  color:'rgba(255,145,55,1)'  },
      { key:'high', r: R_HIGH, color:'rgba(255,215,60,1)'  },
    ];
    const clouds = dirs.map(d => {
      const az = this._dirAz(d.dir);
      return CLOUD_STYLES.map(l => this._cloudArc(cx, cy, l.r, az, d[l.key], l.color)).join('');
    }).join('');

    // ── 方位文字（外圈外侧）
    const labelR = R_HIGH * 1.22;
    const labels = DIR_ORDER.map(d => {
      const lbl = { N:'北', NE:'东北', E:'东', SE:'东南', S:'南', SW:'西南', W:'西', NW:'西北' }[d];
      const [x,y] = this._pt(cx, cy, labelR, this._dirAz(d));
      return `<text x="${x.toFixed(1)}" y="${(y+4).toFixed(1)}" text-anchor="middle"
        font-size="11" font-weight="500" fill="rgba(220,228,240,0.85)">${lbl}</text>`;
    }).join('');

    // ── 日出/日落图标（紧贴外圈）
    const iconR = R_HIGH * 1.06;
    const icons = [];
    if (sun.sunrise != null) {
      const [ix,iy] = this._pt(cx, cy, iconR, sun.sunrise);
      icons.push(`<text x="${ix.toFixed(1)}" y="${(iy+5).toFixed(1)}" text-anchor="middle" font-size="13">🌅</text>`);
    }
    if (sun.sunset != null) {
      const [ix,iy] = this._pt(cx, cy, iconR, sun.sunset);
      icons.push(`<text x="${ix.toFixed(1)}" y="${(iy+5).toFixed(1)}" text-anchor="middle" font-size="13">🌇</text>`);
    }

    // ── 中心点
    const center = `<circle cx="${cx}" cy="${cy}" r="4" fill="rgba(249,115,22,0.9)" stroke="#0f172a" stroke-width="1.5"/>`;

    // ── 图例
    const legend = [
      ['rgba(100,180,255,0.85)', '低云'],
      ['rgba(255,145,55,0.85)',  '中云'],
      ['rgba(255,215,60,0.85)',  '高云'],
    ].map(([c,l], i) => `
      <rect x="${6+i*52}" y="2" width="14" height="5" rx="2" fill="${c}"/>
      <text x="${24+i*52}" y="10" font-size="9.5" fill="rgba(200,212,228,0.85)">${l}</text>`
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
        <stop offset="0%" stop-color="rgba(30,58,120,0.20)"/>
        <stop offset="100%" stop-color="rgba(15,23,42,0)"/>
      </radialGradient>
    </defs>
    <circle cx="${cx}" cy="${cy}" r="${(R_HIGH*1.08).toFixed(1)}" fill="url(#bg${uid})"/>
    ${rings}
    ${axes}
    ${clouds}
    ${center}
    ${labels}
    ${icons.join('')}
  </svg>
  <svg width="${S*0.88}" height="16" style="display:block;margin:4px auto 0;">
    ${legend}
  </svg>
</div>`;
  }
}

export default RadarCompass;
