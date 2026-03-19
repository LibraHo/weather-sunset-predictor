/**
 * RadarCompass - 周边火烧云雷达罗盘 v3
 *
 * 设计规范：
 * - 极轴：高度（m），由 cloudBaseHeight 气压反推
 * - 半径：50km（默认）
 * - 分层：高/中/低云独立扇区，有数据才画
 * - 方向标记：日出🌅 / 日落🌇 / 正南⬇ 图标
 * - 无橙色最佳方向箭头
 */
class RadarCompass {
  constructor(options = {}) {
    this.size = options.size || 300;
    this.dirOrder = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    this.dirLabel = {
      N: '北', NE: '东北', E: '东', SE: '东南',
      S: '南', SW: '西南', W: '西', NW: '西北'
    };
    // 极轴高度刻度（m）
    this.heightRings = [500, 1500, 3000, 6000]; // 低云/中云/高云/更高
    this.maxHeightM = 6000; // 极轴最大高度
  }

  /**
   * 渲染雷达罗盘
   * @param {HTMLElement} container
   * @param {Object} data
   * @param {Array} data.directions - 方向数据
   * @param {Object} data.sunAzimuths - { sunrise, sunset, south }
   */
  render(container, data) {
    if (!container) return;

    const dirs = this._normalizeDirections(data?.directions || []);
    if (!dirs.length) {
      container.innerHTML = '';
      return;
    }

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
        dist: Number(item.dist || 50),
        low: typeof clouds.low === 'number' ? clouds.low : null,
        mid: typeof clouds.mid === 'number' ? clouds.mid : null,
        high: typeof clouds.high === 'number' ? clouds.high : null,
        cloudBaseHeight: typeof clouds.cloudBaseHeight === 'number' ? clouds.cloudBaseHeight : null
      });
    });

    return this.dirOrder.map(dir => map.get(dir) || {
      dir,
      label: this.dirLabel[dir],
      score: 0,
      dist: 50,
      low: null,
      mid: null,
      high: null,
      cloudBaseHeight: null
    });
  }

  // 方位角 → SVG 角度（北=上=270°）
  _dirAngle(dir) {
    const map = { N: 270, NE: 315, E: 0, SE: 45, S: 90, SW: 135, W: 180, NW: 225 };
    return map[dir] ?? 0;
  }

  // 方位角（度，北=0顺时针）→ SVG 坐标
  _azimuthToXY(cx, cy, r, azimuth) {
    const rad = (azimuth - 90) * Math.PI / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  }

  // 极坐标转 XY（deg 是 SVG 角度，东=0）
  _polar(cx, cy, r, deg) {
    const a = (deg - 90) * Math.PI / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }

  // 高度(m) → 极轴半径
  _heightToR(heightM, maxR) {
    const h = Math.max(0, Math.min(heightM, this.maxHeightM));
    return maxR * (h / this.maxHeightM);
  }

  // 8方向扇区路径（两侧各 20°）
  _sectorPath(cx, cy, r1, r2, centerAngle) {
    const half = 18; // 扇区半角（度）
    const a1 = centerAngle - half;
    const a2 = centerAngle + half;
    const [ox1, oy1] = this._polar(cx, cy, r1, a1);
    const [ox2, oy2] = this._polar(cx, cy, r1, a2);
    const [ix1, iy1] = this._polar(cx, cy, r2, a1);
    const [ix2, iy2] = this._polar(cx, cy, r2, a2);
    return `M ${ox1.toFixed(1)},${oy1.toFixed(1)} A ${r1.toFixed(1)},${r1.toFixed(1)} 0 0,1 ${ox2.toFixed(1)},${oy2.toFixed(1)} L ${ix2.toFixed(1)},${iy2.toFixed(1)} A ${r2.toFixed(1)},${r2.toFixed(1)} 0 0,0 ${ix1.toFixed(1)},${iy1.toFixed(1)} Z`;
  }

  _build(dirs, sunAzimuths) {
    const S = this.size;
    const cx = S / 2;
    const cy = S / 2;
    const maxR = S * 0.36;
    const uid = Math.random().toString(36).slice(2, 7);

    // ---- 同心圆（高度刻度） ----
    const ringsSvg = this.heightRings.map((hM, i) => {
      const r = this._heightToR(hM, maxR);
      const label = hM >= 1000 ? `${hM / 1000}km` : `${hM}m`;
      const [tx, ty] = this._polar(cx, cy, r, 355);
      return `
        <circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill="none"
          stroke="rgba(148,162,184,0.25)" stroke-width="${i === 0 ? 1.2 : 0.8}"
          stroke-dasharray="${i > 0 ? '3,4' : 'none'}" />
        <text x="${tx.toFixed(1)}" y="${(ty - 3).toFixed(1)}" font-size="9"
          fill="rgba(148,162,184,0.65)" text-anchor="middle">${label}</text>
      `;
    }).join('');

    // ---- 方位轴线 ----
    const axesSvg = this.dirOrder.map(dir => {
      const [x2, y2] = this._polar(cx, cy, maxR, this._dirAngle(dir));
      const isMain = ['N', 'E', 'S', 'W'].includes(dir);
      return `<line x1="${cx}" y1="${cy}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
        stroke="rgba(148,162,184,${isMain ? '0.30' : '0.15'})" stroke-width="${isMain ? '1' : '0.7'}" />`;
    }).join('');

    // ---- 云层扇区 ----
    // 低云：< 2000m → 用500m作为典型高度，颜色偏蓝灰
    // 中云：2000~6000m → 用3000m，颜色偏橙
    // 高云：> 6000m → 用接近6000m，颜色偏金
    const CLOUD_LAYERS = [
      { key: 'high', label: '高云', heightM: 5500, fill: 'rgba(255,210,100,0.55)', stroke: 'rgba(255,190,60,0.9)' },
      { key: 'mid',  label: '中云', heightM: 3000, fill: 'rgba(255,140,60,0.50)', stroke: 'rgba(255,120,40,0.9)' },
      { key: 'low',  label: '低云', heightM: 700,  fill: 'rgba(100,160,220,0.40)', stroke: 'rgba(80,140,200,0.8)' },
    ];

    const cloudsSvg = dirs.map(d => {
      const centerAngle = this._dirAngle(d.dir);
      return CLOUD_LAYERS.map(layer => {
        const cover = d[layer.key];
        if (cover === null || cover < 5) return ''; // 无云就不画
        // 用云底高度动态调整半径（只对低云有效）
        let heightM = layer.heightM;
        if (layer.key === 'low' && d.cloudBaseHeight !== null && d.cloudBaseHeight > 0) {
          heightM = Math.min(d.cloudBaseHeight, 2000); // 低云上限2000m
        }
        const outerR = this._heightToR(heightM, maxR);
        const innerR = Math.max(4, outerR * (1 - cover / 100 * 0.7)); // 厚度随云量变化
        const path = this._sectorPath(cx, cy, outerR, innerR, centerAngle);
        return `<path d="${path}" fill="${layer.fill}" stroke="${layer.stroke}" stroke-width="1" opacity="0.9" />`;
      }).join('');
    }).join('');

    // ---- 方向标签 ----
    const labelsSvg = this.dirOrder.map(dir => {
      const [x, y] = this._polar(cx, cy, maxR * 1.14, this._dirAngle(dir));
      return `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle"
        font-size="11" font-weight="500" fill="rgba(226,232,240,0.80)">${this.dirLabel[dir]}</text>`;
    }).join('');

    // ---- 日出/日落/正南方向图标 ----
    const iconsSvg = [];
    const iconR = maxR * 1.04; // 图标在刻度圆外侧贴边

    if (sunAzimuths.sunrise != null) {
      const [ix, iy] = this._azimuthToXY(cx, cy, iconR, sunAzimuths.sunrise);
      iconsSvg.push(`<text x="${ix.toFixed(1)}" y="${(iy + 5).toFixed(1)}" text-anchor="middle" font-size="14" title="日出方向">🌅</text>`);
    }
    if (sunAzimuths.sunset != null) {
      const [ix, iy] = this._azimuthToXY(cx, cy, iconR, sunAzimuths.sunset);
      iconsSvg.push(`<text x="${ix.toFixed(1)}" y="${(iy + 5).toFixed(1)}" text-anchor="middle" font-size="14" title="日落方向">🌇</text>`);
    }
    // 正南标记（仅当没有日出/日落已占据正南位置时）
    const [sx, sy] = this._azimuthToXY(cx, cy, iconR, 180);
    iconsSvg.push(`<text x="${sx.toFixed(1)}" y="${(sy + 5).toFixed(1)}" text-anchor="middle" font-size="10" fill="rgba(148,163,184,0.7)">南</text>`);

    // ---- 图例 ----
    const legendSvg = CLOUD_LAYERS.map((l, i) => `
      <rect x="${8 + i * 52}" y="0" width="12" height="8" rx="2"
        fill="${l.fill}" stroke="${l.stroke}" stroke-width="1" />
      <text x="${24 + i * 52}" y="8" font-size="9" fill="rgba(200,210,225,0.85)">${l.label}</text>
    `).join('');

    // ---- 中心点 ----
    const centerDot = `<circle cx="${cx}" cy="${cy}" r="4" fill="rgba(249,115,22,0.9)" stroke="#0f172a" stroke-width="1.5" />`;

    return `
      <div style="
        border:1px solid rgba(148,163,184,0.20);
        border-radius:12px;
        background:linear-gradient(180deg,rgba(15,23,42,0.75),rgba(15,23,42,0.50));
        padding:10px 10px 8px;
      ">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <div style="font-size:13px;font-weight:600;color:rgba(241,245,249,0.95);">周边云况雷达</div>
          <div style="font-size:11px;color:rgba(148,163,184,0.85);">50km · 高度(m)</div>
        </div>

        <svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}"
          style="max-width:100%;display:block;margin:0 auto;" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="rc-bg-${uid}" cx="50%" cy="50%" r="55%">
              <stop offset="0%" stop-color="rgba(56,189,248,0.10)" />
              <stop offset="100%" stop-color="rgba(15,23,42,0)" />
            </radialGradient>
          </defs>
          <circle cx="${cx}" cy="${cy}" r="${(maxR + 6).toFixed(1)}" fill="url(#rc-bg-${uid})" />
          ${ringsSvg}
          ${axesSvg}
          ${cloudsSvg}
          ${centerDot}
          ${labelsSvg}
          ${iconsSvg.join('')}
        </svg>

        <svg width="${S * 0.9}" height="18" style="display:block;margin:4px auto 0;">
          ${legendSvg}
        </svg>
      </div>
    `;
  }
}

export default RadarCompass;
