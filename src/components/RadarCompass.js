/**
 * RadarCompass - 三层云极坐标图（低/中/高云）
 * 角轴：8方位；极轴：云层高度（低->中->高）
 * 支持标记日出/日落方向线，辅助判断遮挡
 */
class RadarCompass {
  constructor(options = {}) {
    this.size = options.size || 320;
    this.dirOrder = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    this.dirLabel = {
      N: '北', NE: '东北', E: '东', SE: '东南',
      S: '南', SW: '西南', W: '西', NW: '西北'
    };
  }

  render(container, data) {
    if (!container) return;
    const dirs = this._normalizeDirections(data?.directions || []);
    if (!dirs.length) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = this._build({
      directions: dirs,
      type: data?.type || 'sunset',
      sunAzimuth: Number.isFinite(data?.sunAzimuth) ? data.sunAzimuth : null
    });
  }

  _normalizeDirections(directions) {
    const map = new Map();

    directions.forEach(item => {
      const dir = (item.dir || '').toUpperCase();
      if (!this.dirOrder.includes(dir)) return;

      const low = Number(item.lowClouds ?? item.low ?? item.score ?? 0);
      const mid = Number(item.midClouds ?? item.mid ?? item.score ?? 0);
      const high = Number(item.highClouds ?? item.high ?? item.score ?? 0);

      map.set(dir, {
        dir,
        label: item.label || this.dirLabel[dir] || dir,
        low: Math.max(0, Math.min(100, low)),
        mid: Math.max(0, Math.min(100, mid)),
        high: Math.max(0, Math.min(100, high))
      });
    });

    return this.dirOrder.map(dir => map.get(dir) || {
      dir,
      label: this.dirLabel[dir],
      low: 0,
      mid: 0,
      high: 0
    });
  }

  _bearing(dir) {
    return { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 }[dir] ?? 0;
  }

  _polarCompass(cx, cy, r, bearingDeg) {
    const rad = (bearingDeg - 90) * Math.PI / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  }

  _ringSectorPath(cx, cy, rIn, rOut, bStart, bEnd) {
    const [x1, y1] = this._polarCompass(cx, cy, rOut, bStart);
    const [x2, y2] = this._polarCompass(cx, cy, rOut, bEnd);
    const [x3, y3] = this._polarCompass(cx, cy, rIn, bEnd);
    const [x4, y4] = this._polarCompass(cx, cy, rIn, bStart);

    const largeArc = Math.abs(bEnd - bStart) > 180 ? 1 : 0;

    return [
      `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
      `A ${rOut.toFixed(2)} ${rOut.toFixed(2)} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
      `L ${x3.toFixed(2)} ${y3.toFixed(2)}`,
      `A ${rIn.toFixed(2)} ${rIn.toFixed(2)} 0 ${largeArc} 0 ${x4.toFixed(2)} ${y4.toFixed(2)}`,
      'Z'
    ].join(' ');
  }

  _layerColor(layer, value) {
    const alpha = (0.10 + (value / 100) * 0.75).toFixed(2);
    if (layer === 'low') return `rgba(56,189,248,${alpha})`;   // 低云 蓝
    if (layer === 'mid') return `rgba(251,191,36,${alpha})`;   // 中云 黄
    return `rgba(248,113,113,${alpha})`;                       // 高云 红
  }

  _cloudBlockLevel(directions, sunAzimuth) {
    if (!Number.isFinite(sunAzimuth)) return { level: '未知', text: '太阳方向未知' };

    // 找最接近太阳方位的扇区
    const closest = directions.reduce((best, d) => {
      const db = this._bearing(d.dir);
      const diff = Math.min(Math.abs(db - sunAzimuth), 360 - Math.abs(db - sunAzimuth));
      return diff < best.diff ? { ...d, diff } : best;
    }, { diff: 999, low: 0, mid: 0, high: 0, dir: 'N' });

    // 简单遮挡指数（低云权重最高）
    const idx = closest.low * 0.6 + closest.mid * 0.3 + closest.high * 0.1;

    if (idx >= 70) return { level: '严重遮挡', text: `太阳方向(${closest.label})云层很厚` };
    if (idx >= 45) return { level: '部分遮挡', text: `太阳方向(${closest.label})存在一定遮挡` };
    return { level: '基本通畅', text: `太阳方向(${closest.label})遮挡较少` };
  }

  _build({ directions, type, sunAzimuth }) {
    const S = this.size;
    const cx = S / 2;
    const cy = S / 2;

    const r0 = 22;
    const rLow = S * 0.18;
    const rMid = S * 0.26;
    const rHigh = S * 0.34;

    // 背景圈 + 标签
    const rings = `
      <circle cx="${cx}" cy="${cy}" r="${r0}" fill="none" stroke="rgba(148,163,184,0.25)"/>
      <circle cx="${cx}" cy="${cy}" r="${rLow}" fill="none" stroke="rgba(56,189,248,0.45)"/>
      <circle cx="${cx}" cy="${cy}" r="${rMid}" fill="none" stroke="rgba(251,191,36,0.45)"/>
      <circle cx="${cx}" cy="${cy}" r="${rHigh}" fill="none" stroke="rgba(248,113,113,0.45)"/>
      <text x="${(cx + rLow + 6).toFixed(1)}" y="${(cy - 4).toFixed(1)}" font-size="10" fill="rgba(56,189,248,0.9)">低云</text>
      <text x="${(cx + rMid + 6).toFixed(1)}" y="${(cy - 4).toFixed(1)}" font-size="10" fill="rgba(251,191,36,0.95)">中云</text>
      <text x="${(cx + rHigh + 6).toFixed(1)}" y="${(cy - 4).toFixed(1)}" font-size="10" fill="rgba(248,113,113,0.95)">高云</text>
    `;

    // 方位轴线与标签
    const axes = this.dirOrder.map(dir => {
      const b = this._bearing(dir);
      const [x2, y2] = this._polarCompass(cx, cy, rHigh, b);
      const [lx, ly] = this._polarCompass(cx, cy, rHigh + 16, b);
      return `
        <line x1="${cx}" y1="${cy}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="rgba(148,163,184,0.22)" stroke-width="0.9"/>
        <text x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" text-anchor="middle" font-size="11" fill="rgba(226,232,240,0.86)">${this.dirLabel[dir]}</text>
      `;
    }).join('');

    // 三层扇区
    const sectors = directions.map(d => {
      const c = this._bearing(d.dir);
      const b0 = c - 22.5;
      const b1 = c + 22.5;

      return `
        <path d="${this._ringSectorPath(cx, cy, r0, rLow, b0, b1)}" fill="${this._layerColor('low', d.low)}" stroke="rgba(15,23,42,0.25)" stroke-width="0.4"/>
        <path d="${this._ringSectorPath(cx, cy, rLow, rMid, b0, b1)}" fill="${this._layerColor('mid', d.mid)}" stroke="rgba(15,23,42,0.25)" stroke-width="0.4"/>
        <path d="${this._ringSectorPath(cx, cy, rMid, rHigh, b0, b1)}" fill="${this._layerColor('high', d.high)}" stroke="rgba(15,23,42,0.25)" stroke-width="0.4"/>
      `;
    }).join('');

    // 日出/日落方向线
    let sunLine = '';
    if (Number.isFinite(sunAzimuth)) {
      const [sx, sy] = this._polarCompass(cx, cy, rHigh + 10, sunAzimuth);
      const label = type === 'sunrise' ? '日出方向' : '日落方向';
      const icon = type === 'sunrise' ? '☀︎↑' : '☀︎↓';
      sunLine = `
        <line x1="${cx}" y1="${cy}" x2="${sx.toFixed(1)}" y2="${sy.toFixed(1)}" stroke="rgba(255,255,255,0.95)" stroke-width="2.2"/>
        <circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="3.6" fill="#fff"/>
        <text x="${(sx + 6).toFixed(1)}" y="${(sy - 6).toFixed(1)}" font-size="10" fill="rgba(255,255,255,0.95)">${icon} ${label}</text>
      `;
    }

    const block = this._cloudBlockLevel(directions, sunAzimuth);

    return `
      <div style="border:1px solid rgba(148,163,184,0.22);border-radius:14px;background:linear-gradient(180deg, rgba(15,23,42,0.72), rgba(15,23,42,0.46));padding:12px 12px 10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div style="font-size:13px;font-weight:600;color:rgba(241,245,249,0.95);">周边云层极轴图</div>
          <div style="font-size:11px;color:rgba(148,163,184,0.95);">低/中/高云 · 8方向</div>
        </div>

        <svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" style="max-width:100%;display:block;margin:0 auto;" xmlns="http://www.w3.org/2000/svg">
          ${rings}
          ${axes}
          ${sectors}
          ${sunLine}
          <circle cx="${cx}" cy="${cy}" r="4.8" fill="rgba(226,232,240,0.95)"/>
        </svg>

        <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(148,163,184,0.18);font-size:12px;color:rgba(226,232,240,0.92);line-height:1.5;">
          <strong>遮挡判断：</strong><span style="color:${block.level === '严重遮挡' ? '#f87171' : block.level === '部分遮挡' ? '#fbbf24' : '#4ade80'};">${block.level}</span>
          <span style="color:rgba(148,163,184,0.92)">（${block.text}）</span>
        </div>
      </div>
    `;
  }
}

export default RadarCompass;
