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
    heroCopy: '霞客用中高云画布做加法载体评分，再用太阳方向光路做门控，最后叠加能见度、湿度和空气颗粒的显色修正。',
    scoreBands: [
      { tone: 'rare', name: '顶级 Rare', range: '85-100 分', desc: '少见的爆发级条件，值得优先安排。' },
      { tone: 'strong', name: '高分 Strong', range: '70-84 分', desc: '明显高于常态，适合专程蹲守。' },
      { tone: 'watch', name: '可观赏 Watch', range: '40-69 分', desc: '有机会出色彩，需要看局地开口和实况。' },
      { tone: 'low', name: '低概率 Low', range: '<40 分', desc: '火烧云条件偏弱；不建议专程追霞，普通日落效果需看实时天气和视野。' }
    ],
    formationFactors: [
      { title: '云层载体', subtitle: '中高云做加法，不连乘放大', desc: '高云和中云像天空画布，会按可染色程度增加载体分；薄云、云种和高云优势都是有上限的加分，不再被多个正向系数连续相乘。' },
      { title: '光路条件', subtitle: '太阳方向是门控', desc: '日出或日落方向如果被低云、降水或近处厚云墙挡住，已有的太阳方向采样会压低光路门控，甚至取消高云保底。' },
      { title: '空气显色', subtitle: '只做小幅修正', desc: '能见度、湿度、薄雾和空气颗粒影响颜色纯度；它们会在光路门控后的基础上小幅加减，不再替代云层载体。' },
      { title: '限制因素', subtitle: '坏天气会封顶', desc: '大雨、厚低云、灰幕和强遮挡会让分数保持保守，避免把普通天气误报成爆发。' }
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
        : '霞客用中高云画布做加法载体评分，再用太阳方向光路做门控，最后叠加能见度、湿度和空气颗粒的显色修正。'
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
