/**
 * ShareCardGenerator - 分享卡片图片生成器
 *
 * 纯 Canvas API 绘制，750×1080（社交分享竖图，减少底部空白）
 * 内容：品牌 → 分数仪表盘 → 地点日期 → 时间窗口 → 云层概况 → 一句话结语 → 水印
 */

class ShareCardGenerator {
  constructor() {
    this.W = 750;
    this.H = 1080;
    this.font = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
    this.i18n = null;

    // 分享卡输出主题（允许独立配色），但仅用于卡片输出画布本身，不干预站内主题。
    // 与主站亮/暗视觉对齐：亮卡保持暖白字重高对比，暗卡保持高对比暖色强调。
    this.shareThemes = {
      sunrise: {
        backgroundStops: ['#111827', '#2A1748', '#5B2C64'],
        surfaceFill: 'rgba(17,24,39,0.68)',
        surfaceBorder: 'rgba(255,255,255,0.16)',
        scoreGradient: ['#FFB35C', '#F59E0B', '#93C5FD'],
        scoreAccent: '#FFB35C',
        scoreAccentSecondary: '#FF7A5A',
        // Backward-compatible aliases used by existing tests/callers.
        accent: '#FFB35C',
        accent2: '#FF7A5A',
      },
      sunset: {
        backgroundStops: ['#0B1020', '#191336', '#321736'],
        surfaceFill: 'rgba(15,23,42,0.72)',
        surfaceBorder: 'rgba(255,255,255,0.14)',
        scoreGradient: ['#FF9F45', '#F59E0B', '#93C5FD'],
        scoreAccent: '#FF9F45',
        scoreAccentSecondary: '#F97316',
        // Backward-compatible aliases used by existing tests/callers.
        accent: '#FF9F45',
        accent2: '#F97316',
      },
    };

    // Preserve the historical public property while the implementation uses semantic names.
    this.themes = this.shareThemes;
  }

  setI18n(i18n) {
    this.i18n = i18n || null;
  }

  t(key, fallback = '') {
    if (this.i18n && typeof this.i18n.t === 'function') {
      const translated = this.i18n.t(key);
      if (translated !== key) return translated;
    }
    return fallback;
  }

  /**
   * @param {Object} prediction - 预测对象
   * @param {string} locationName - 地点
   * @param {string} period - 'sunrise' | 'sunset'
   * @returns {Promise<Blob>} PNG
   */
  async generateShareCard(prediction, locationName, period, i18n) {
    this.setI18n(i18n || this.i18n);
    const canvas = document.createElement('canvas');
    canvas.width = this.W;
    canvas.height = this.H;
    const ctx = canvas.getContext('2d');
    const theme = this.shareThemes[period] || this.shareThemes.sunset;
    const isSunrise = period === 'sunrise';

    // 1. 背景
    this._bg(ctx, theme);

    // 2. 头部品牌
    const y = this._header(ctx, isSunrise);

    // 3. 核心结论区（替代旧大圆环，降低装饰噪音）
    const yAfterGauge = this._gauge(ctx, prediction.score, prediction.quality, theme, y);

    // 4. 地点 + 日期 + 时段
    const yAfterInfo = this._info(ctx, locationName, prediction, period, yAfterGauge);

    // 5. 时间窗口
    const yAfterTime = this._timeWindow(ctx, prediction, period, yAfterInfo, theme);

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
    g.addColorStop(0, theme.backgroundStops[0]);
    g.addColorStop(0.54, theme.backgroundStops[1]);
    g.addColorStop(1, theme.backgroundStops[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.H);

    // 远处霞光：只做点睛，不再整张糊成橙红
    const horizon = ctx.createRadialGradient(this.W * 0.72, this.H * 0.18, 0, this.W * 0.72, this.H * 0.18, 420);
    horizon.addColorStop(0, 'rgba(255,158,76,0.28)');
    horizon.addColorStop(0.45, 'rgba(244,114,72,0.13)');
    horizon.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = horizon;
    ctx.fillRect(0, 0, this.W, this.H);

    const coolGlow = ctx.createRadialGradient(30, this.H * 0.72, 0, 30, this.H * 0.72, 520);
    coolGlow.addColorStop(0, 'rgba(59,130,246,0.16)');
    coolGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = coolGlow;
    ctx.fillRect(0, 0, this.W, this.H);

    // 细微颗粒，避免纯渐变塑料感
    ctx.fillStyle = 'rgba(255,255,255,0.018)';
    for (let i = 0; i < 180; i++) {
      const x = (i * 97) % this.W;
      const y = (i * 193) % this.H;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  _glassCard(ctx, x, y, w, h, theme, radius = 26) {
    ctx.save();
    ctx.fillStyle = theme.surfaceFill;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fill();
    ctx.strokeStyle = theme.surfaceBorder;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  /* ── 头部品牌 ── */
  _header(ctx, isSunrise) {
    const y0 = 62;
    const x0 = 70;

    this._drawBrandLogo(ctx, x0 + 28, y0 + 28, isSunrise);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold 30px ${this.font}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(this.t('shareCard.brandName', '霞客'), x0 + 76, y0 + 26);

    ctx.fillStyle = 'rgba(255,255,255,0.58)';
    ctx.font = `18px ${this.font}`;
    ctx.fillText(this.t('shareCard.brandSubtitle', 'Sunset Voyager'), x0 + 76, y0 + 54);

    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.62)';
    ctx.font = `18px ${this.font}`;
    ctx.fillText(this.t('shareCard.shareTitle', '火烧云预测分享'), this.W - 70, y0 + 42);

    return y0 + 104;
  }

  _drawBrandLogo(ctx, x, y, isSunrise) {
    ctx.save();

    const outerR = 30;
    const outer = ctx.createRadialGradient(x, y, 4, x, y, outerR);
    if (isSunrise) {
      outer.addColorStop(0, 'rgba(255,255,255,0.95)');
      outer.addColorStop(0.55, 'rgba(255,192,138,0.95)');
      outer.addColorStop(1, 'rgba(255,120,80,0.92)');
    } else {
      outer.addColorStop(0, 'rgba(255,255,255,0.95)');
      outer.addColorStop(0.55, 'rgba(255,176,96,0.95)');
      outer.addColorStop(1, 'rgba(255,88,38,0.92)');
    }
    ctx.beginPath();
    ctx.arc(x, y, outerR, 0, Math.PI * 2);
    ctx.fillStyle = outer;
    ctx.fill();

    // 内圈
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fill();

    // 品牌字母 XK
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold 18px ${this.font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('XK', x, y + 0.5);

    // 微光边
    ctx.beginPath();
    ctx.arc(x, y, outerR + 1, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }

  /* ── 核心结论 ── */
  _gauge(ctx, score, quality, theme, startY) {
    const cardW = 620;
    const cardH = 245;
    const cardX = (this.W - cardW) / 2;
    const cardY = startY;
    const scoreNum = Math.max(0, Math.min(100, Math.round(score || 0)));

    let color = theme.scoreGradient[2];
    if (scoreNum >= 70) color = theme.scoreGradient[0];
    else if (scoreNum >= 40) color = theme.scoreGradient[1];

    const qualityLabels = {
      excellent: this.t('shareCard.labels.excellent', '极佳'),
      good: this.t('shareCard.labels.good', '良好'),
      fair: this.t('shareCard.labels.fair', '一般'),
      poor: this.t('shareCard.labels.poor', '较差')
    };
    const label = qualityLabels[quality] || (scoreNum >= 70 ? '极佳' : scoreNum >= 40 ? '良好' : '一般');

    this._glassCard(ctx, cardX, cardY, cardW, cardH, theme, 30);

    ctx.fillStyle = 'rgba(255,255,255,0.62)';
    ctx.font = `22px ${this.font}`;
    ctx.textAlign = 'left';
    ctx.fillText(this.t('shareCard.labels.probability', '火烧云概率'), cardX + 42, cardY + 55);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold 86px ${this.font}`;
    ctx.fillText(String(scoreNum), cardX + 40, cardY + 138);

    ctx.font = `bold 30px ${this.font}`;
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.fillText(this.t('prediction.points', '分'), cardX + 150, cardY + 130);

    ctx.fillStyle = color;
    ctx.font = `bold 34px ${this.font}`;
    ctx.textAlign = 'right';
    ctx.fillText(label, cardX + cardW - 42, cardY + 84);

    ctx.fillStyle = 'rgba(255,255,255,0.54)';
    ctx.font = `20px ${this.font}`;
    const hint = scoreNum >= 70
      ? this.t('shareCard.gauge.hintExcellent', '值得专门等一等')
      : scoreNum >= 40
        ? this.t('shareCard.gauge.hintGood', '可以顺路观察')
        : this.t('shareCard.gauge.hintFair', '不必专门出门');
    ctx.fillText(hint, cardX + cardW - 42, cardY + 118);

    const barX = cardX + 42;
    const barY = cardY + 174;
    const barW = cardW - 84;
    const barH = 12;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 8);
    ctx.fill();
    const pg = ctx.createLinearGradient(barX, barY, barX + barW, barY);
    pg.addColorStop(0, '#FBBF24');
    pg.addColorStop(0.55, theme.scoreAccent);
    pg.addColorStop(1, theme.scoreAccentSecondary || theme.scoreAccent);
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.roundRect(barX, barY, Math.max(8, barW * scoreNum / 100), barH, 8);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.44)';
    ctx.font = `16px ${this.font}`;
    ctx.textAlign = 'left';
    ctx.fillText('0', barX, barY + 38);
    ctx.textAlign = 'center';
    ctx.fillText('50', barX + barW / 2, barY + 38);
    ctx.textAlign = 'right';
    ctx.fillText('100', barX + barW, barY + 38);

    return cardY + cardH + 26;
  }

  /* ── 地点 + 日期 + 时段 ── */
  _info(ctx, locationName, prediction, period, startY) {
    const cx = this.W / 2;
    const typeLabel = period === 'sunrise'
      ? this.t('prediction.sunrise', '朝霞')
      : this.t('prediction.sunset', '晚霞');
    const safeLocation = (locationName || this.t('shareCard.unknownLocation', '未知地点')).trim();
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
  _timeWindow(ctx, prediction, period, startY, theme = this.shareThemes.sunset) {
    const cx = this.W / 2;
    const cardW = 620;
    const cardH = 110;
    const cardX = (this.W - cardW) / 2;
    const cardY = startY + 20;

    this._glassCard(ctx, cardX, cardY, cardW, cardH, { ...theme, surfaceFill: 'rgba(15,23,42,0.52)' }, 22);

    // 日出/日落时间
    const sunTime = period === 'sunrise'
      ? (prediction.sunriseTime || prediction.sunsetTime)
      : prediction.sunsetTime;
    const sunTimeStr = sunTime ? this._fmtTime(sunTime) : '--:--';
    const sunLabel = period === 'sunrise'
      ? this.t('shareCard.timeLabels.sunrise', '日出')
      : this.t('shareCard.timeLabels.sunset', '日落');

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold 36px ${this.font}`;
    ctx.textAlign = 'center';
    ctx.fillText(`${sunLabel}  ${sunTimeStr}`, cx, cardY + 42);

    // 最佳观赏窗口
    const window = prediction.getOptimalViewingWindow ? prediction.getOptimalViewingWindow() : null;
    if (window) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = `22px ${this.font}`;
      ctx.fillText(
        this.t('shareCard.bestWindow', '最佳观赏 {{start}} – {{end}}')
          .replace('{{start}}', this._fmtTime(window.start))
          .replace('{{end}}', this._fmtTime(window.end)),
        cx,
        cardY + 78
      );
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

    this._glassCard(ctx, cardX, cardY, cardW, cardH, theme, 22);

    const cl = prediction.cloudLayers || {};
    const high = Math.round(cl.high ?? 0);
    const mid = Math.round(cl.mid ?? 0);
    const low = Math.round(cl.low ?? 0);

    // 三栏
    const cols = [
      { label: this.t('shareCard.cloud.high', '高云'), value: high, color: '#FDE68A' },
      { label: this.t('shareCard.cloud.mid', '中云'), value: mid, color: '#FDBA74' },
      { label: this.t('shareCard.cloud.low', '低云'), value: low, color: low >= 50 ? '#FB7185' : '#93C5FD' },
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
      text = this.t('shareCard.verdict.noCarrier', '😶 缺少色彩载体，火烧云概率极低');
    } else if (score >= 80) {
      text = layerCount >= 2
        ? this.t('shareCard.verdict.excellentMultiLayer', '✨ 极佳条件，强烈推荐出行观赏！')
        : this.t('shareCard.verdict.excellent', '✨ 条件优秀，色彩可期');
    } else if (score >= 60) {
      text = this.t('shareCard.verdict.good', '✨ 条件不错，火烧云概率较高');
    } else if (score >= 40) {
      text = this.t('shareCard.verdict.fair', '💡 条件中等，需看实际云层演变');
    } else {
      text = this.t('shareCard.verdict.poor', '😶 火烧云概率较低');
    }

    const cardW = 620;
    const cardH = 60;
    const cardX = (this.W - cardW) / 2;
    const cardY = startY;

    this._glassCard(ctx, cardX, cardY, cardW, cardH, { ...theme, surfaceFill: 'rgba(255,255,255,0.10)' }, 22);

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
    ctx.fillText(this.t('shareCard.watermark', '霞客 · 记录每一次绚丽'), cx, y + 24);
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

export function generateShareCard(prediction, locationName, period, i18n) {
  return shareCardGenerator.generateShareCard(prediction, locationName, period, i18n);
}

export default ShareCardGenerator;
