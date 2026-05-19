import { applyPageSettings, readAppSettings } from '../../utils/app-settings.js';

const openapiSpecUrl = 'https://sunset.bjhyc.online/api/agent/openapi.json';
const apiApplyUrl = 'https://sunset.bjhyc.online/api-apply.html';

Page({
  data: {
    themeMode: 'system',
    resolvedThemeMode: 'light',
    apiOnly: false,
    currentNav: 'methodology',
    heroEyebrow: '霞客方法',
    heroTitle: '火烧云计算方法',
    heroCopy: '霞客先算可显色载体，再用太阳方向光路门控，最后只叠加小幅显色修正。高云 100% 不会自动满分，近处云墙会明显压低结果。',
    scoreBands: [
      { tone: 'rare', name: '顶级 Rare', range: '85-100 分', desc: '少见的爆发级条件，值得优先安排。' },
      { tone: 'strong', name: '高分 Strong', range: '70-84 分', desc: '明显高于常态，适合专程蹲守。' },
      { tone: 'watch', name: '可观赏 Watch', range: '40-69 分', desc: '有机会出色彩，需要看局地开口和实况。' },
      { tone: 'low', name: '低概率 Low', range: '<40 分', desc: '火烧云条件偏弱；不建议专程追霞，普通日落效果需看实时天气和视野。' }
    ],
    formationFactors: [
      { title: '云层载体', subtitle: '高云×0.75，中云×0.45，低云×0.10', desc: '画布基础分按中高云分段计算：10 以下很低，30-70 最理想，70 以上缓降；高云优势、云种、薄云都是有限加分，不再连乘放大。' },
      { title: '光路条件', subtitle: '15/30/50/100km 多点采样', desc: '太阳方向采样会结合太阳高度、云底高度和低/中/高云遮挡估算 block；近处云墙会把光路封顶到约 48，远处云墙约 56。' },
      { title: '光路门控', subtitle: '载体分能发挥多少', desc: '光路分不再按 20% 相加，而是转成 0.25-1.12 的门控；开口约 0.90-0.96，云墙可压到 0.42/0.55。' },
      { title: '空气显色', subtitle: '只做小幅修正', desc: '能见度、湿度、雨后状态和空气颗粒只改变显色质量：正向最多约 +9 分，负向最多约 -25 分。' },
      { title: '限制因素', subtitle: '坏天气会封顶', desc: '厚云、灰幕、沙尘、低云主导和降水低云会压低载体或封顶；无火烧云状态低于 40，轻微霞光低于 60。' }
    ],
    calculationSteps: [
      { title: '1. 云层画布分', formula: 'upper = high×0.75 + mid×0.45', desc: 'upper 在 30-70 最佳；低云从 20-80% 将画布乘数从 1.0 降到 0.1。高云>50 且低云<30 时只加 0-6 分。' },
      { title: '2. 气溶胶弱载体', formula: 'aerosol = raw × clamp((lightPath-45)/35, 0, 1)', desc: '只有云很少、AOD/PM 适中、低云<40、降水≤0.2 且光路打开时才兜底，主要对应普通红日落，不抬成爆发。' },
      { title: '3. 载体分', formula: 'carrier = max(cloudCanvas, aerosol)', desc: '云层画布和气溶胶弱载体二选一取高值；厚云、灰幕、重霾、沙尘会扣分或封顶。' },
      { title: '4. 光路门控', formula: 'gate = f(lightPathScore, sun-direction corridor)', desc: '光路≥85 时 1.00-1.08；70-85 时 0.88-1.00；50-70 时 0.65-0.88；低于 50 时 0.25-0.65。' },
      { title: '5. 最终显示分', formula: 'score = clamp(carrier × gate + renderingAdjustment, 0, 100)', desc: '最终还会按状态校准：无火烧云 <40，轻微霞光 <60；几何不可行、厚云、灰幕、雨低云会进一步封顶。' }
    ],
    changelog: [
      { date: '2026-05-19', title: '加法载体 + 光路门控 v1', summary: '正向云层载体改为有上限的加分；太阳方向多点光路采样作为门控，近处云墙可压低高云保底；不再用直射比直接参与评分。' },
      { date: '2026-05-18', title: '云厚证据评分 v1', summary: '云厚由漫射占比、水汽、低云、天气码和太阳方向开口共同判断，避免把日落前自然失光误当成厚云。' },
      { date: '2026-05-13', title: '四因子分析 v1', summary: '分析固定为云层载体、光路条件、空气显色、限制因素四项，减少零散条目。' },
      { date: '2026-05-12', title: '气溶胶弱载体 v1', summary: '云很少时，适度薄雾必须被太阳方向光路激活，才会作为普通红日落的弱载体参与评分。' },
      { date: '2026-05-11', title: '开口型中高云载体 v1', summary: '低云少、中高云可染色且太阳方向有开口时，不再把它误判成完全遮光的厚云幕。' },
      { date: '2026-05-10', title: '低云主导光路 v3', summary: '光路遮挡改为看低云是否挡住太阳方向，避免中高云画布被总云量误伤。' },
      { date: '2026-05-10', title: '中高云载体保护 v2', summary: '高云和中云充足、低云少且空气不灰时，按可染色画布处理。' }
    ]
  },

  onLoad(options = {}) {
    this.applySectionMode(options);
    this.applySavedSettings();
  },

  onShow() {
    this.applySavedSettings();
  },

  applySavedSettings() {
    applyPageSettings(this);
  },

  onAppSettingsChange(event) {
    this.setData(event.detail || readAppSettings());
  },

  applySectionMode(options = {}) {
    const apiOnly = options.section === 'api';
    this.setData({
      apiOnly,
      currentNav: apiOnly ? 'api' : 'methodology',
      heroEyebrow: apiOnly ? 'API Access' : '霞客方法',
      heroTitle: apiOnly ? 'API接入' : '火烧云计算方法',
      heroCopy: apiOnly
        ? '面向 Agent、自动化脚本和研究项目的受控接口。先申请 Token，再用 Bearer 鉴权调用 /api/agent 下的接口。'
        : '霞客先算可显色载体，再用太阳方向光路门控，最后只叠加小幅显色修正。高云 100% 不会自动满分，近处云墙会明显压低结果。'
    });
  },

  copyOpenApiSpec() {
    copyLink(openapiSpecUrl, '链接已复制');
  },

  copyApiApplyLink() {
    copyLink(apiApplyUrl, '申请入口已复制');
  }
});

function copyLink(url, title) {
  wx.copyClipboardData({
    data: url,
    success: () => wx.showToast({ title, icon: 'none' }),
    fail: () => wx.showToast({ title: '复制失败，请稍后重试', icon: 'none' })
  });
}

export { apiApplyUrl, openapiSpecUrl };
