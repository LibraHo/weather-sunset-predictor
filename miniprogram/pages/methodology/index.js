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
    heroCopy: '霞客综合天空画布、太阳方向光路、空气显色和坏天气限制；雨后高云/卷云会结合开口与灰幕信号单独判断。',
    scoreBands: [
      { tone: 'rare', name: '顶级 Rare', range: '85-100 分', desc: '少见的爆发级条件，值得优先安排。' },
      { tone: 'strong', name: '高分 Strong', range: '70-84 分', desc: '明显高于常态，适合专程蹲守。' },
      { tone: 'watch', name: '可观赏 Watch', range: '40-69 分', desc: '有机会出色彩，需要看局地开口和实况。' },
      { tone: 'low', name: '低概率 Low', range: '<40 分', desc: '火烧云条件偏弱；不建议专程追霞，普通日落效果需看实时天气和视野。' }
    ],
    formationFactors: [
      { title: '云层载体', subtitle: '中高云决定上限', desc: '高云和中云像天空画布，最容易被低角度阳光染出红橙色；低云更多是遮挡因素。低云少且太阳方向有开口时，高云/卷云不会只因水汽高就按厚灰幕处理。' },
      { title: '光路条件', subtitle: '太阳方向要有开口', desc: '日出或日落方向如果被低云、降水或厚云墙挡住，光线很难照到可染色云层。' },
      { title: '空气显色', subtitle: '通透但不过灰', desc: '能见度、湿度和适度空气颗粒会影响颜色纯度；重霾、沙尘或雨雪会明显压低观赏性。' },
      { title: '限制因素', subtitle: '坏天气会封顶', desc: '大雨、厚低云、灰幕和强遮挡会让分数保持保守，避免把普通天气误报成爆发。' }
    ],
    changelog: [
      { date: '2026-05-18', title: '雨后高云开口保护 v1', summary: '低云少、高云可染色、太阳方向有开口且空气不过灰时，云厚修正从厚灰幕改为温和影响。' },
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
        : '霞客综合天空画布、太阳方向光路、空气显色和坏天气限制；雨后高云/卷云会结合开口与灰幕信号单独判断。'
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
