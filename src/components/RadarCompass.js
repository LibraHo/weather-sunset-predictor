/**
 * RadarCompass - 周边火烧云雷达罗盘（UI v2）
 * 目标：更干净、更专业、更易读
 */
class RadarCompass {
  constructor(options = {}) {
    this.size = options.size || 320;
    this.rings = options.rings || [25, 50, 75, 100];
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

    container.innerHTML = this._build(dirs);
  }

  _normalizeDirections(directions) {
    const map = new Map();
    directions.forEach(item => {
      const dir = (item.dir || '').toUpperCase();
      if (!this.dirOrder.includes(dir)) return;
      map.set(dir, {
        dir,
        label: item.label || this.dirLabel[dir] || dir,
        score: Math.max(0, Math.min(100, Number(item.score || 0))),
        dist: Number(item.dist || 100)
      });
    });

    return this.dirOrder
      .map(dir => map.get(dir) || {
        dir,
        label: this.dirLabel[dir],
        score: 0,
        dist: 100
      });
  }

  _angle(dir) {
    // 保持与地图方位一致：北在上
    return { N: 270, NE: 315, E: 0, SE: 45, S: 90, SW: 135, W: 180, NW: 225 }[dir] ?? 0;
  }

  _polar(cx, cy, r, deg) {
    const a = (deg - 90) * Math.PI / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }

  _scoreColor(score) {
    if (score >= 80) return '#ff5a2f';
    if (score >= 60) return '#ff8b3d';
    if (score >= 40) return '#f2b85c';
    return '#5f6675';
  }

  _build(dirs) {
    const S = this.size;
    const cx = S / 2;
    const cy = S / 2;
    const maxR = S * 0.36;
    const best = dirs.reduce((a, b) => (b.score > a.score ? b : a), dirs[0]);

    const bgGradId = `radar-bg-${Math.random().toString(36).slice(2, 9)}`;
    const lineGradId = `radar-line-${Math.random().toString(36).slice(2, 9)}`;

    // 同心圆 + 百分比刻度
    const ringsSvg = this.rings.map(p => {
      const r = maxR * (p / 100);
      const [tx, ty] = this._polar(cx, cy, r, 350);
      return `
        <circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill="none" stroke="rgba(148,162,184,0.30)" stroke-width="1" />
        <text x="${tx.toFixed(1)}" y="${(ty - 2).toFixed(1)}" font-size="10" fill="rgba(148,162,184,0.75)">${p}</text>
      `;
    }).join('');

    // 方位轴线
    const axesSvg = this.dirOrder.map(dir => {
      const [x2, y2] = this._polar(cx, cy, maxR, this._angle(dir));
      const isMain = ['N', 'E', 'S', 'W'].includes(dir);
      return `<line x1="${cx}" y1="${cy}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
        stroke="rgba(148,162,184,${isMain ? '0.35' : '0.18'})" stroke-width="${isMain ? '1' : '0.8'}" />`;
    }).join('');

    // 雷达轮廓线（8向多边形）
    const polygonPoints = dirs.map(d => {
      const r = maxR * (d.score / 100);
      const [x, y] = this._polar(cx, cy, r, this._angle(d.dir));
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    // 节点
    const pointsSvg = dirs.map(d => {
      const r = maxR * (d.score / 100);
      const [x, y] = this._polar(cx, cy, r, this._angle(d.dir));
      const color = this._scoreColor(d.score);
      const isBest = d.dir === best.dir;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${isBest ? 4.3 : 3.2}" fill="${color}" stroke="#0b1220" stroke-width="1.2" />`;
    }).join('');

    // 最佳方向箭头
    const bestA = this._angle(best.dir);
    const [p1x, p1y] = this._polar(cx, cy, maxR * 0.18, bestA);
    const [p2x, p2y] = this._polar(cx, cy, maxR * 0.95, bestA);

    const labelsSvg = this.dirOrder.map(dir => {
      const [x, y] = this._polar(cx, cy, maxR * 1.12, this._angle(dir));
      const active = dir === best.dir;
      return `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle"
        font-size="${active ? '12' : '11'}" font-weight="${active ? '700' : '500'}"
        fill="${active ? '#ff9f5a' : 'rgba(226,232,240,0.82)'}">${this.dirLabel[dir]}</text>`;
    }).join('');

    const confidence = best.score >= 80 ? '高' : best.score >= 60 ? '中' : '低';

    return `
      <div style="
        border:1px solid rgba(148,163,184,0.22);
        border-radius:14px;
        background:linear-gradient(180deg, rgba(15,23,42,0.72), rgba(15,23,42,0.46));
        padding:12px 12px 10px;
      ">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div style="font-size:13px;font-weight:600;color:rgba(241,245,249,0.95);">周边火烧云雷达</div>
          <div style="font-size:11px;color:rgba(148,163,184,0.95);">8方向 · 100km</div>
        </div>

        <svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" style="max-width:100%;display:block;margin:0 auto;" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="${bgGradId}" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stop-color="rgba(56,189,248,0.14)" />
              <stop offset="55%" stop-color="rgba(59,130,246,0.06)" />
              <stop offset="100%" stop-color="rgba(15,23,42,0)" />
            </radialGradient>
            <linearGradient id="${lineGradId}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="rgba(255,159,90,0.95)" />
              <stop offset="100%" stop-color="rgba(255,90,47,0.95)" />
            </linearGradient>
            <marker id="radar-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
              <path d="M0,1 L0,9 L9,5 Z" fill="url(#${lineGradId})" />
            </marker>
          </defs>

          <circle cx="${cx}" cy="${cy}" r="${(maxR + 8).toFixed(1)}" fill="url(#${bgGradId})" />
          ${ringsSvg}
          ${axesSvg}

          <polygon points="${polygonPoints}" fill="rgba(255,141,71,0.24)" stroke="rgba(255,156,86,0.95)" stroke-width="1.8" />
          ${pointsSvg}

          <line x1="${p1x.toFixed(1)}" y1="${p1y.toFixed(1)}" x2="${p2x.toFixed(1)}" y2="${p2y.toFixed(1)}"
            stroke="url(#${lineGradId})" stroke-width="2.8" stroke-linecap="round" marker-end="url(#radar-arrow)" />

          <circle cx="${cx}" cy="${cy}" r="5.2" fill="#f97316" stroke="#0f172a" stroke-width="2" />
          ${labelsSvg}
        </svg>

        <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(148,163,184,0.18);display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <div style="font-size:12px;color:rgba(226,232,240,0.9);line-height:1.5;">
            建议方向：<strong style="color:#ff9f5a;">${best.label}</strong>
            · 评分 <strong style="color:#ffe8d6;">${Math.round(best.score)}</strong>
          </div>
          <div style="font-size:11px;color:rgba(148,163,184,0.95);">可信度 ${confidence}</div>
        </div>
      </div>
    `;
  }
}

export default RadarCompass;
