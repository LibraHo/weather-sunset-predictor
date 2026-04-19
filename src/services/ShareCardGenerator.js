/**
 * ShareCardGenerator - 分享卡片图片生成器
 *
 * 纯 Canvas API 绘制，750×1334（9:16 竖屏）
 * 内容：品牌 → 分数仪表盘 → 地点日期 → 时间窗口 → 云层概况 → 一句话结语 → 水印
 */

class ShareCardGenerator {
  constructor() {
    this.W = 750;
    this.H = 1334;
    this.font = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",sans-serif';

    this.themes = {
      sunrise: {
        bg: ['#FF8C42', '#FF6B8A', '#FFA751'],
        accent: '#FF6B8A',
        gaugeColors: ['#FF6B8A', '#FFB347', '#87CEEB'],
      },
      sunset: {
        bg: ['#C62828', '#E65100', '#FF6F00'],
        accent: '#FF6F00',
        gaugeColors: ['#FF6F00', '#FFAB40', '#87CEEB'],
      },
    };
  }

  /**
   * @param {Object} prediction - 预测对象
   * @param {string} locationName - 地点
   * @param {string} period - 'sunrise' | 'sunset'
   * @returns {Promise<Blob>} PNG
   */
  async generateShareCard(prediction, locationName, period) {
    const canvas = document.createElement('canvas');
    canvas.width = this.W;
    canvas.height = this.H;
    const ctx = canvas.getContext('2d');
    const theme = this.themes[period] || this.themes.sunset;
    const isSunrise = period === 'sunrise';

    // 1. 背景
    this._bg(ctx, theme);

    // 2. 头部品牌
    const y = this._header(ctx, isSunrise);

    // 3. 仪表盘
    const yAfterGauge = this._gauge(ctx, prediction.score, prediction.quality, theme, y);

    // 4. 地点 + 日期 + 时段
    const yAfterInfo = this._info(ctx, locationName, prediction, period, yAfterGauge);

    // 5. 时间窗口
    const yAfterTime = this._timeWindow(ctx, prediction, period, yAfterInfo);

    // 6. 云层概况
    const yAfterCloud = this._cloudSummary(ctx, prediction, theme, yAfterTime);

    // 7. 一句话结语
    const yAfterVerdict = this._verdict(ctx, prediction, theme, yAfterCloud);

    // 8. 底部水印
    this._footer(ctx);

    return this._toBlob(canvas);
  }

  /* ── 背景 ── */
  _bg(ctx, theme) {
    const g = ctx.createLinearGradient(0, 0, 0, this.H);
    g.addColorStop(0, theme.bg[0]);
    g.addColorStop(0.5, theme.bg[1]);
    g.addColorStop(1, theme.bg[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.H);

    // 装饰光晕
    [[0, 0, 300, 'rgba(255,255,255,0.15)'], [this.W, this.H, 250, 'rgba(255,200,150,0.12)']].forEach(([x, y, r, c]) => {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
      glow.addColorStop(0, c);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, this.W, this.H);
    });
  }

  /* ── 头部品牌 ── */
  _header(ctx, isSunrise) {
    const cx = this.W / 2;
    const y0 = 70;

    // 太阳 emoji
    ctx.font = `48px ${this.font}`;
    ctx.textAlign = 'center';
    ctx.fillText(isSunrise ? '🌄' : '🌅', cx, y0 + 36);

    // 品牌名
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold 32px ${this.font}`;
    ctx.fillText('霞客 · Sunset Voyager', cx, y0 + 90);

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = `20px ${this.font}`;
    ctx.fillText('捕捉天空最美的瞬间', cx, y0 + 122);

    return y0 + 155;
  }

  /* ── 仪表盘 ── */
  _gauge(ctx, score, quality, theme, startY) {
    const cx = this.W / 2;
    const cy = startY + 120;
    const R = 110;
    const lw = 18;

    const scoreNum = Math.round(score || 0);
    let color = theme.gaugeColors[2]; // fair
    if (scoreNum >= 70) color = theme.gaugeColors[0];
    else if (scoreNum >= 40) color = theme.gaugeColors[1];

    // 背景环
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = lw;
    ctx.stroke();

    // 进度环
    const start = -Math.PI / 2;
    const end = start + Math.PI * 2 * Math.min(scoreNum, 100) / 100;
    ctx.beginPath();
    ctx.arc(cx, cy, R, start, end);
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.stroke();

    // 分数
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold 64px ${this.font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(scoreNum.toString(), cx, cy - 8);

    // "分"
    ctx.font = `22px ${this.font}`;
    ctx.textBaseline = 'middle';
    ctx.fillText('分', cx + 46, cy + 8);

    // 等级
    const qualityLabels = { excellent: '极佳', good: '良好', fair: '一般', poor: '较差' };
    const label = qualityLabels[quality] || '—';
    ctx.font = `bold 28px ${this.font}`;
    ctx.fillStyle = color;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(label, cx, cy + 55);

    return cy + 110;
  }

  /* ── 地点 + 日期 + 时段 ── */
  _info(ctx, locationName, prediction, period, startY) {
    const cx = this.W / 2;
    const typeLabel = period === 'sunrise' ? '朝霞' : '晚霞';
    const safeLocation = (locationName || '未知地点').trim();
    const locationText = safeLocation.length > 18 ? `${safeLocation.slice(0, 18)}…` : safeLocation;

    // 地点
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold 36px ${this.font}`;
    ctx.textAlign = 'center';
    ctx.fillText(locationText, cx, startY + 44);

    // 日期 · 时段
    const dateStr = this._fmtDate(prediction.date);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `24px ${this.font}`;
    ctx.fillText(`${dateStr} · ${typeLabel}`, cx, startY + 88);

    return startY + 124;
  }

  /* ── 时间窗口 ── */
  _timeWindow(ctx, prediction, period, startY) {
    const cx = this.W / 2;
    const cardW = 620;
    const cardH = 110;
    const cardX = (this.W - cardW) / 2;
    const cardY = startY + 20;

    // 半透明卡片
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 16);
    ctx.fill();
    ctx.restore();

    // 日出/日落时间
    const sunTime = period === 'sunrise'
      ? (prediction.sunriseTime || prediction.sunsetTime)
      : prediction.sunsetTime;
    const sunTimeStr = sunTime ? this._fmtTime(sunTime) : '--:--';
    const sunLabel = period === 'sunrise' ? '日出' : '日落';

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold 36px ${this.font}`;
    ctx.textAlign = 'center';
    ctx.fillText(`${sunLabel}  ${sunTimeStr}`, cx, cardY + 42);

    // 最佳观赏窗口
    const window = prediction.getOptimalViewingWindow ? prediction.getOptimalViewingWindow() : null;
    if (window) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = `22px ${this.font}`;
      ctx.fillText(`最佳观赏  ${this._fmtTime(window.start)} – ${this._fmtTime(window.end)}`, cx, cardY + 78);
    }

    return cardY + cardH + 20;
  }

  /* ── 云层概况 ── */
  _cloudSummary(ctx, prediction, theme, startY) {
    const cx = this.W / 2;
    const cardW = 620;
    const cardH = 90;
    const cardX = (this.W - cardW) / 2;
    const cardY = startY;

    // 半透明卡片
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 16);
    ctx.fill();
    ctx.restore();

    const cl = prediction.cloudLayers || {};
    const high = Math.round(cl.high ?? 0);
    const mid = Math.round(cl.mid ?? 0);
    const low = Math.round(cl.low ?? 0);

    // 三栏
    const cols = [
      { label: '高云', value: high, color: '#90CAF9' },
      { label: '中云', value: mid, color: '#64B5F6' },
      { label: '低云', value: low, color: '#42A5F5' },
    ];
    const colW = cardW / 3;

    cols.forEach((c, i) => {
      const colCx = cardX + colW * i + colW / 2;

      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = `20px ${this.font}`;
      ctx.textAlign = 'center';
      ctx.fillText(c.label, colCx, cardY + 28);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold 28px ${this.font}`;
      ctx.fillText(`${c.value}%`, colCx, cardY + 60);

      // 小进度条
      const barW = 60;
      const barH = 6;
      const barX = colCx - barW / 2;
      const barY = cardY + 70;
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, 3);
      ctx.fill();
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.roundRect(barX, barY, Math.max(barW * Math.min(c.value, 100) / 100, 0), barH, 3);
      ctx.fill();
    });

    return cardY + cardH + 20;
  }

  /* ── 一句话结语 ── */
  _verdict(ctx, prediction, theme, startY) {
    const cx = this.W / 2;
    const score = Math.round(prediction.score || 0);
    const quality = prediction.quality;
    const cl = prediction.cloudLayers || {};
    const high = cl.high ?? 0;
    const mid = cl.mid ?? 0;
    const layerCount = (high > 10 ? 1 : 0) + (mid > 10 ? 1 : 0) + ((cl.low ?? 0) > 10 ? 1 : 0);
    const hasCarrier = high >= 15 || mid >= 15;

    let text;
    if (!hasCarrier && score < 40) {
      text = '😶 缺少色彩载体，火烧云概率极低';
    } else if (score >= 80) {
      text = layerCount >= 2
        ? '✨ 极佳条件，强烈推荐出行观赏！'
        : '✨ 条件优秀，色彩可期';
    } else if (score >= 60) {
      text = '✨ 条件不错，火烧云概率较高';
    } else if (score >= 40) {
      text = '💡 条件中等，需看实际云层演变';
    } else {
      text = '😶 火烧云概率较低';
    }

    const cardW = 620;
    const cardH = 60;
    const cardX = (this.W - cardW) / 2;
    const cardY = startY;

    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 16);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold 24px ${this.font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, cardY + cardH / 2);
    ctx.textBaseline = 'alphabetic';

    return cardY + cardH + 30;
  }

  /* ── 底部水印 ── */
  _footer(ctx) {
    const cx = this.W / 2;
    const y = this.H - 55;

    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(100, y - 25);
    ctx.lineTo(this.W - 100, y - 25);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = `20px ${this.font}`;
    ctx.textAlign = 'center';
    ctx.fillText('sunset.bjhyc.online', cx, y);

    ctx.font = `16px ${this.font}`;
    ctx.fillText('🌅 霞客 · 记录每一次绚丽', cx, y + 24);
  }

  /* ── 工具方法 ── */
  _fmtDate(d) {
    if (!d) return '';
    const dt = d instanceof Date ? d : new Date(d);
    const wd = ['周日','周一','周二','周三','周四','周五','周六'][dt.getDay()];
    return `${dt.getFullYear()}年${dt.getMonth()+1}月${dt.getDate()}日 ${wd}`;
  }

  _fmtTime(d) {
    if (!d) return '--:--';
    const dt = d instanceof Date ? d : new Date(d);
    return `${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
  }

  _toBlob(canvas) {
    return new Promise((resolve, reject) => {
      if (canvas.toBlob) {
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png');
      } else {
        try {
          const url = canvas.toDataURL('image/png');
          const raw = atob(url.split(',')[1]);
          const buf = new Uint8Array(raw.length);
          for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
          resolve(new Blob([buf], { type: 'image/png' }));
        } catch (e) { reject(e); }
      }
    });
  }
}

const shareCardGenerator = new ShareCardGenerator();

export function generateShareCard(prediction, locationName, period) {
  return shareCardGenerator.generateShareCard(prediction, locationName, period);
}

export default ShareCardGenerator;
