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
    heroCopy: '霞客先算云能不能当载体，再把日落方向光路并入受光亮度，最后判断空气显色。光路打开且暖霾可散射时会保留中烧，但雨天硬阻断不抬分。',
    scoreBands: [
      { tone: 'rare', name: '顶级 Rare', range: '85-100 分', desc: '少见的爆发级条件，值得优先安排。' },
      { tone: 'strong', name: '高分 Strong', range: '70-84 分', desc: '明显高于常态，适合专程蹲守。' },
      { tone: 'watch', name: '可观赏 Watch', range: '40-69 分', desc: '有机会出色彩，需要看局地开口和实况。' },
      { tone: 'low', name: '低概率 Low', range: '<40 分', desc: '火烧云条件偏弱；不建议专程追霞，普通日落效果需看实时天气和视野。' }
    ],
    formationFactors: [
      { title: '云层载体', subtitle: '高云×0.75，中云×0.45，低云×0.10', desc: '画布基础分按中高云分段计算：10 以下很低，30-70 最理想，70 以上缓降；高云优势、云种、薄云都是有限加分，不再连乘放大。' },
      { title: '云厚修正', subtitle: '画布修正前分 × 30% × 云厚压力', desc: '云厚不再使用固定扣分上限；厚云证据、净证据、散射占比、水汽指数和低太阳透射证据会合成 0-1 压力，只按当前画布能力比例折损。' },
      { title: '太阳透射', subtitle: 'direct + shortwave 组合证据', desc: '直射和短波辐射极低不会单独扣死；只有总云量/中云很高、高云载体弱且灰空气明显时，才说明光被云幕和空气压住。' },
      { title: '光路条件', subtitle: '10/25/50/75/100km 多点采样', desc: '太阳方向采样会结合太阳高度、云底高度和低/中/高云遮挡估算 block；所有距离走同一套逻辑，再按距离加权，25/50km 权重最高。' },
      { title: '受光亮度', subtitle: '三层云亮度模型', desc: '系统会估算中高云是否真的被照亮；太阳方向光路作为其中一个亮度因子。亮度采用对数饱和响应：有一点光时增长更明显，接近满亮后边际变小。' },
      { title: '光路条件', subtitle: '并入受光亮度', desc: '光路不再作为最终分的独立乘子；太阳方向开口、阻挡走廊和低云遮挡统一进入受光亮度。' },
      { title: '空气显色', subtitle: '先判灰幕，再判暖散射', desc: '能见度、湿度、雨后状态和空气颗粒只改变显色质量：光路开且云幕不灰时，轻/中度 AOD、PM、dust 可增强橙红；中高云满铺且 PM/AOD 偏高时，会转为灰幕显色抑制。光路打开、暖霾可散射且没有雨天硬阻断时，会保留中烧观察价值。' },
      { title: '方向中云带', subtitle: '太阳方向可染色云带', desc: '本地点头顶云不多，但日落方向有中云带且光路通畅时，会按连续载体参与评分；方向中云越强、光路越开，越接近 50-60 档。' },
      { title: '限制因素', subtitle: '坏天气会封顶', desc: '厚云、湿灰幕、沙尘、低云主导和降水低云会压低载体或封顶；无火烧云状态低于 40，轻微霞光低于 60。' }
    ],
    calculationSteps: [
      { title: '1. 云层画布分', formula: 'upper = high×0.75 + mid×0.45', desc: 'upper 在 30-70 最佳；低云从 20-80% 将画布乘数从 1.0 降到 0.1。高云>50 且低云<30 时只加 0-6 分。' },
      { title: '2. 空气显色', formula: 'air = grayVeil ? suppression : openPath ? warmScattering : baseRendering', desc: '先看满铺中高云、总云量、PM2.5/PM10/AOD、dust 和能见度的灰幕压力；不灰且光路开时，适度颗粒才进入暖色散射。' },
      { title: '3. 云厚比例折损', formula: 'thicknessPenalty = canvasBeforeThickness × 0.30 × thicknessPressure', desc: 'thicknessPressure 由厚云证据、net、散射占比、水汽指数和低太阳透射证据合成；高云载体只给小缓冲，不会把高散射和高水汽风险洗掉。' },
      { title: '4. 载体分', formula: 'carrier = max(cloudCanvas, aerosol, directionalMidCloud)', desc: '云层画布、气溶胶弱载体和太阳方向中云带统一进入载体判断；方向中云带可到 50-60 档，但不会当成顶级爆发。' },
      { title: '5. 受光亮度', formula: 'layerBrightness = log1p(f(云载体、低云遮挡、太阳高度、光路、云厚、光束))', desc: '目前基于低/中/高三层云计算亮度，不是每个高度层单独射线追踪；从无光到弱光更敏感，强光区间逐渐饱和。' },
      { title: '6. 空气显色', formula: 'air = grayVeil ? suppression : warmScattering/baseRendering', desc: '能见度、湿度、AOD、PM 和雨后状态只改变显色质量，不再混进受光亮度。' },
      { title: '7. 最终显示分', formula: 'score = clamp(Σ(carrierLayer × brightnessLayer) × airRendering, 0, 100)', desc: '最终还会按硬否决校准：无火烧云 <40，轻微霞光 <60；几何不可行、厚云、满铺灰幕、湿灰幕、雨低云会进一步压制。光路打开的暖霾高云样本只保留到中烧区间，不抬成高分。' }
    ],
    changelog: [
      { date: '2026-06-13', title: '分层亮度 + 暖霾中烧校准', summary: '最终分使用 Σ(分层载体 × 分层受光亮度) × 空气显色；光路打开、太阳方向高云强且暖霾可散射时，保留中烧观察价值；雨天 hard block 不会被保底抬分。' },
      { date: '2026-06-06', title: '灰幕空气显色 + 方向中云带 v2', summary: '满铺中高云叠加 PM/AOD 偏高时按灰幕压力连续降低显色；太阳方向中云带改为连续载体，强光路下可进入 50-60 档。' },
      { date: '2026-06-03', title: '日落评分 v2', summary: '最终分改为云载体、日落光路、空气显色三部分合成；光路开且能见度可接受时，轻/中度 AOD、PM、dust 作为橙红散射正向因素。' },
      { date: '2026-06-02', title: '低太阳透射证据 v1', summary: '云厚评估恢复 direct/shortwave 太阳透射证据；只在高总云量、高中云、弱高云载体和灰空气同时出现时压分。' },
      { date: '2026-05-27', title: '云厚比例折损 v2', summary: '云厚扣分改为画布修正前分 × 30% × 云厚压力，去掉固定 -28/24 上限；湿灰幕场景同步按小烧/可看但不强校准。' },
      { date: '2026-05-19', title: '加法载体 + 光路门控 v1', summary: '正向云层载体改为有上限的加分；太阳方向多点光路采样作为门控，阻挡走廊可压低高云载体保护；不再用直射比直接参与评分。' },
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
        : '霞客先算云能不能当载体，再把日落方向光路并入受光亮度，最后判断空气显色。光路打开且暖霾可散射时会保留中烧，但雨天硬阻断不抬分。'
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
