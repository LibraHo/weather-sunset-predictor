/**
 * RadarCompass - 周边火烧云雷达罗盘 v4
 *
 * 极坐标设计：
 * - 径向轴 = 高度（m）：500 / 1500 / 3000 / 6000
 * - 方向轴 = 8方位（北在上，顺时针）
 * - 云层画在对应高度的圆弧上（弧宽/透明度 = 云量）
 * - 方向标注：日出🌅 / 日落🌇 + 8方位文字
 */
class RadarCompass {
  constructor(options = {}) {
    this.size = options.size || 300;
    this.dirOrder = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    this.dirLabel = {
      N: '北', NE: '东北', E: '东', SE: '东南',
      S: '南', SW: '西南', W: '西', NW: '西北'
    };
    // 高度刻度（m）
    this.heightRings = [500, 1500, 3000, 6000];
    this.maxHeightM = 6000;
  }

  render(container, data) {
    if (!container) return;
    const dirs = this._normalizeDirections(data?.directions || []);
    if (!dirs.length) { container.innerHTML = ''; return; }
    const sunAzimuths = data?.sunAzimuths || {};
    container.innerHTML = this._build(dirs, sunAzimuths);
  }

  _normalizeDirections(directions) {
    const map = new Map();
    directions.forEach(item => {
      const dir = (item.dir || '').toUpperCase();
      if (!this.dirOrder.includes(dir)) return;
      const clouds = item.cloudLayers || {};
      map.set(dir, {
        dir,
        label: item.label || this.dirLabel[dir] || dir,
        score: Math.max(0, Math.min(100, Number(item.score || 0))),
        low: typeof clouds.low === 'number' ? clouds.low : null,
        mid: typeof clouds.mid === 'number' ? clouds.mid : null,
        high: typeof clouds.high === 'number' ? clouds.high : null,
        cloudBaseHeight: typeof clouds.cloudBaseHeight === 'number' && clouds.cloudBaseHeight > 0
          ? clouds.cloudBaseHeight : null
      });
    });
    return this.dirOrder.map(dir => map.get(dir) || {
      dir, label: this.dirLabel[dir], score: 0,
      low: null, mid: null, high: null, cloudBaseHeight: null
    });
  }

  /**
   * 方位 → 极坐标角度
   * 北=0°（上），顺时针：东=90°，南=180°，西=270°
   */
  _dirAzimuth(dir) {
    return { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 }[dir] ?? 0;
  }

  /**
   * 方位角（北=0，顺时针）→ SVG坐标
   * SVG: x右=0°，y下，所以 azimuth(北)=0 → 上方 (-90° in math)
   */
  _toXY(cx, cy, r, azimuth) {
    const rad = (azimuth - 90) * Math.PI / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  }

  /** 高度(m) → 极轴半径 */
  _heightToR(heightM, maxR) {
    return maxR * Math.min(1, Math.max(0, heightM / this.maxHeightM));
  }

  /**
   * 在极坐标圆弧上画云
   * 每个方向对应一段弧（各占 1/8 圆周），云量控制弧的粗细和透明度
   */
  _cloudArc(cx, cy, r, azimuth, halfSpan, coverage, stroke, strokeWidth) {
    if (coverage < 5 || r < 4) return '';
    const opacity = 0.35 + (coverage / 100) * 0.55; // 5%→0.38, 100%→0.90
    const sw = strokeWidth * (0.4 + (coverage / 100) * 0.6);

    const a1 = azimuth - halfSpan;
    const a2 = azimuth + halfSpan;
    const [x1, y1] = this._toXY(cx, cy, r, a1);
    const [x2, y2] = this._toXY(cx, cy, r, a2);
    // 弧长>180°用large-arc=1，否则=0
    const large = (halfSpan * 2) > 180 ? 1 : 0;
    return `<path d="M${x1.toFixed(1)},${y1.toFixed(1)} A${r.toFixed(1)},${r.toFixed(1)} 0 ${large},1 ${x2.toFixed(1)},${y2.toFixed(1)}"
      fill="none" stroke="${stroke}" stroke-width="${sw.toFixed(1)}" stroke-linecap="round" opacity="${opacity.toFixed(2)}" />`;
  }

  _build(dirs, sunAzimuths) {
    const S = this.size;
    const cx = S / 2;
    const cy = S / 2;
    const maxR = S * 0.38;
    const uid = Math.random().toString(36).slice(2, 7);
    const halfSpan = 18; // 每方向扇区半角（°），8方向各45°，留一点间隙

    // ---- 同心圆（高度刻度） ----
    const ringsSvg = this.heightRings.map((hM, i) => {
      const r = this._heightToR(hM, maxR);
      const label = hM >= 1000 ? `${hM / 1000}km` : `${hM}m`;
      const [tx, ty] = this._toXY(cx, cy, r, 350); // 标签放在北偏东一点
      return `
        <circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill="none"
          stroke="rgba(148,162,184,${i === 0 ? '0.30' : '0.18'})"
          stroke-width="0.8" stroke-dasharray="${i > 0 ? '2,4' : 'none'}" />
        <text x="${tx.toFixed(1)}" y="${(ty - 2).toFixed(1)}"
          font-size="8.5" fill="rgba(148,162,184,0.60)" text-anchor="middle">${label}</text>
      `;
    }).join('');

    // ---- 方位轴线 ----
    const axesSvg = this.dirOrder.map(dir => {
      const [x2, y2] = this._toXY(cx, cy, maxR, this._dirAzimuth(dir));
      const isMain = ['N', 'E', 'S', 'W'].includes(dir);
      return `<line x1="${cx}" y1="${cy}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
        stroke="rgba(148,162,184,${isMain ? '0.28' : '0.14'})"
        stroke-width="${isMain ? '1' : '0.7'}" />`;
    }).join('');

    // ---- 各方向云层弧线 ----
    // 云层定义：低云 / 中云 / 高云，画在对应高度圆上
    const LAYERS = [
      {
        key: 'low',
        // 低云高度：优先用 cloudBaseHeight，否则用 800m
        getH: d => d.cloudBaseHeight ? Math.min(d.cloudBaseHeight, 2000) : 800,
        stroke: 'rgba(100,180,255,0.95)',
        sw: 6
      },
      {
        key: 'mid',
        getH: () => 3000,
        stroke: 'rgba(255,140,60,0.95)',
        sw: 5
      },
      {
        key: 'high',
        getH: () => 5500,
        stroke: 'rgba(255,215,80,0.95)',
        sw: 4
      }
    ];

    const cloudsSvg = dirs.map(d => {
      const az = this._dirAzimuth(d.dir);
      return LAYERS.map(layer => {
        const cover = d[layer.key];
        if (cover === null || cover < 5) return '';
        const heightM = layer.getH(d);
        const r = this._heightToR(heightM, maxR);
        return this._cloudArc(cx, cy, r, az, halfSpan, cover, layer.stroke, layer.sw);
      }).join('');
    }).join('');

    // ---- 方位文字标签 ----
    const labelR = maxR * 1.16;
    const labelsSvg = this.dirOrder.map(dir => {
      const az = this._dirAzimuth(dir);
      const [x, y] = this._toXY(cx, cy, labelR, az);
      return `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle"
        font-size="11" font-weight="500" fill="rgba(210,220,235,0.85)">${this.dirLabel[dir]}</text>`;
    }).join('');

    // ---- 日出/日落方向图标（在最外圈外侧） ----
    const iconR = maxR * 1.04;
    const iconsSvg = [];
    if (sunAzimuths.sunrise != null) {
      const [ix, iy] = this._toXY(cx, cy, iconR, sunAzimuths.sunrise);
      iconsSvg.push(`<text x="${ix.toFixed(1)}" y="${(iy + 5).toFixed(1)}" text-anchor="middle" font-size="13">🌅</text>`);
    }
    if (sunAzimuths.sunset != null) {
      const [ix, iy] = this._toXY(cx, cy, iconR, sunAzimuths.sunset);
      iconsSvg.push(`<text x="${ix.toFixed(1)}" y="${(iy + 5).toFixed(1)}" text-anchor="middle" font-size="13">🌇</text>`);
    }

    // ---- 中心点 ----
    const center = `<circle cx="${cx}" cy="${cy}" r="3.5" fill="rgba(249,115,22,0.9)" stroke="#0f172a" stroke-width="1.5"/>`;

    // ---- 图例 ----
    const legend = [
      { color: 'rgba(100,180,255,0.85)', label: '低云' },
      { color: 'rgba(255,140,60,0.85)',  label: '中云' },
      { color: 'rgba(255,215,80,0.85)',  label: '高云' }
    ].map((l, i) => `
      <rect x="${8 + i * 52}" y="2" width="14" height="5" rx="2" fill="${l.color}" />
      <text x="${26 + i * 52}" y="10" font-size="9.5" fill="rgba(200,210,225,0.85)">${l.label}</text>
    `).join('');

    return `
      <div style="border:1px solid rgba(148,163,184,0.18);border-radius:12px;
        background:linear-gradient(180deg,rgba(15,23,42,0.75),rgba(15,23,42,0.50));
        padding:10px 10px 8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <div style="font-size:13px;font-weight:600;color:rgba(241,245,249,0.95);">周边云况雷达</div>
          <div style="font-size:11px;color:rgba(148,163,184,0.80);">50km · 高度(m)</div>
        </div>
        <svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}"
          style="max-width:100%;display:block;margin:0 auto;" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="rcbg${uid}" cx="50%" cy="50%" r="55%">
              <stop offset="0%" stop-color="rgba(30,58,120,0.18)"/>
              <stop offset="100%" stop-color="rgba(15,23,42,0)"/>
            </radialGradient>
          </defs>
          <circle cx="${cx}" cy="${cy}" r="${(maxR + 4).toFixed(1)}" fill="url(#rcbg${uid})"/>
          ${ringsSvg}
          ${axesSvg}
          ${cloudsSvg}
          ${center}
          ${labelsSvg}
          ${iconsSvg.join('')}
        </svg>
        <svg width="${S * 0.88}" height="16" style="display:block;margin:4px auto 0;">
          ${legend}
        </svg>
      </div>`;
  }
}

export default RadarCompass;
