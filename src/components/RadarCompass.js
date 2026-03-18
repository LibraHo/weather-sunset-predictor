/**
 * RadarCompass - 周边火烧云雷达罗盘
 * 纯 SVG，无外部依赖。同心圆（10/50/100km）+ 8方向扇区 + 最佳方向箭头。
 * 需求：19 v2
 */
class RadarCompass {
  constructor(options = {}) {
    this.size  = options.size  || 300;
    this.rings = options.rings || ['10km', '50km', '100km'];
  }

  render(container, data) {
    if (!container || !data?.directions?.length) return;
    container.innerHTML = this._build(data);
  }

  // ── 内部 ──────────────────────────────────
  _color(score) {
    if (score >= 80) return { fill: 'rgba(180,30,10,0.72)',  stroke: '#b41e0a' };
    if (score >= 60) return { fill: 'rgba(230,110,20,0.65)', stroke: '#e66e14' };
    if (score >= 40) return { fill: 'rgba(230,190,40,0.50)', stroke: '#e6be28' };
    return                  { fill: 'rgba(160,160,160,0.15)', stroke: '#888' };
  }

  _angle(dir) {
    return { N:270, NE:315, E:0, SE:45, S:90, SW:135, W:180, NW:225 }[dir] ?? 0;
  }

  _polar(cx, cy, r, deg) {
    const a = (deg - 90) * Math.PI / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }

  _sector(cx, cy, r, a0, a1) {
    const [x1,y1] = this._polar(cx, cy, r, a0);
    const [x2,y2] = this._polar(cx, cy, r, a1);
    return `M${cx},${cy} L${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2} Z`;
  }

  _build(data) {
    const S = this.size, cx = S/2, cy = S/2, maxR = S * 0.42;
    const dirs = data.directions;
    const best = dirs.reduce((a,b) => b.score > a.score ? b : a, dirs[0]);

    // 同心圆
    const ringsSVG = this.rings.map((lbl, i) => {
      const r = maxR * ((i+1) / this.rings.length);
      const [lx,ly] = this._polar(cx, cy, r, 0);
      return `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}"
        fill="none" stroke="var(--color-border,#555)" stroke-width="0.7"
        stroke-dasharray="3,3" opacity="0.45"/>
        <text x="${(lx+3).toFixed(1)}" y="${(ly+4).toFixed(1)}"
          font-size="9" fill="var(--color-text-light,#aaa)" opacity="0.75">${lbl}</text>`;
    }).join('');

    // 主轴线
    const axisSVG = ['N','E','S','W'].map(d => {
      const [x1,y1] = this._polar(cx,cy,5,this._angle(d));
      const [x2,y2] = this._polar(cx,cy,maxR,this._angle(d));
      return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}"
        x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
        stroke="var(--color-border,#444)" stroke-width="0.5" opacity="0.4"/>`;
    }).join('');

    // 扇区
    const sectorSVG = dirs.map(d => {
      const a = this._angle(d.dir);
      const r = maxR * Math.max(0.12, d.score/100);
      const {fill,stroke} = this._color(d.score);
      return `<path d="${this._sector(cx,cy,r,a-22.5,a+22.5)}"
        fill="${fill}" stroke="${stroke}" stroke-width="0.8"/>`;
    }).join('');

    // 方向标签
    const labelsSVG = dirs.map(d => {
      const [x,y] = this._polar(cx, cy, maxR*1.13, this._angle(d.dir));
      const isBest = d.dir === best.dir;
      return `<text x="${x.toFixed(1)}" y="${(y+4).toFixed(1)}"
        text-anchor="middle"
        font-size="${isBest?11:9}" font-weight="${isBest?'bold':'normal'}"
        fill="${isBest?'#e05c10':'var(--color-text,#ccc)'}">${d.label??d.dir}</text>`;
    }).join('');

    // 箭头
    const ba = this._angle(best.dir);
    const [ax,ay]   = this._polar(cx, cy, maxR*0.55, ba);
    const [ax2,ay2] = this._polar(cx, cy, maxR*0.18, ba);
    const arrowSVG = `
      <defs>
        <marker id="rc-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 Z" fill="#e05c10"/>
        </marker>
      </defs>
      <line x1="${ax2.toFixed(1)}" y1="${ay2.toFixed(1)}"
            x2="${ax.toFixed(1)}"  y2="${ay.toFixed(1)}"
            stroke="#e05c10" stroke-width="2.5" stroke-linecap="round"
            marker-end="url(#rc-arrow)"/>`;

    const centerSVG = `<circle cx="${cx}" cy="${cy}" r="4" fill="#e05c10"/>`;

    // 摘要
    const distText = best.dist ? `约${best.dist}km处` : '';
    const summary  = `建议朝 <strong style="color:#e05c10">${best.label??best.dir}</strong> 方向${distText}观赏（评分 ${Math.round(best.score)}）`;

    return `
      <div style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:4px 0;">
        <svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}"
          style="max-width:100%;overflow:visible" xmlns="http://www.w3.org/2000/svg">
          ${arrowSVG}
          ${ringsSVG}
          ${axisSVG}
          ${sectorSVG}
          ${centerSVG}
          ${labelsSVG}
        </svg>
        <p style="font-size:13px;color:var(--color-text,#ccc);margin:0;text-align:center;line-height:1.5;">
          ${summary}
        </p>
      </div>`;
  }
}

export default RadarCompass;
