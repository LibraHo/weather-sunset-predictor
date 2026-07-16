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
    heroCopy: '霞客先分别计算中云、高云的载体与受光，再做区域内分层协同和区域间重叠协同，最后结合空气显色与限制因素得到分数。',
    scoreBands: [
      { tone: 'rare', name: '顶级 Rare', range: '85-100 分', desc: '少见的爆发级条件，值得优先安排。' },
      { tone: 'strong', name: '高分 Strong', range: '70-84 分', desc: '明显高于常态，适合专程蹲守。' },
      { tone: 'watch', name: '可观赏 Watch', range: '40-69 分', desc: '有机会出色彩，需要看局地开口和实况。' },
      { tone: 'low', name: '低概率 Low', range: '<40 分', desc: '火烧云条件偏弱；不建议专程追霞，普通日落效果需看实时天气和视野。' }
    ],
    formationFactors: [
      { title: '分层云载体', subtitle: '中云 / 高云分别计算', desc: '每个空间区域分别计算中云载体×中云受光、高云载体×高云受光；同一区域两层都强时连续协同，不简单求和。' },
      { title: '本地云层', subtitle: '高云×0.75 + 中云×0.45', desc: '本地云层只展开中高云画布、区间分、云种修正和云厚修正，避免把内部诊断项塞进用户凭据。' },
      { title: '受光亮度', subtitle: '基础分的一部分', desc: '太阳方向、低云遮挡、云厚和亮度响应会合成受光亮度；它进入基础分，不再重复显示成最终分后修正。' },
      { title: '空气显色', subtitle: '颜色质量', desc: '能见度、湿度、雨后状态和 AOD/PM/dust 只解释颜色强弱；气溶胶弱载体被采用时才作为主载体，否则不重复加分。' },
      { title: '限制因素', subtitle: '命中才显示', desc: '低云、降水、厚云、满铺灰幕和几何不可行会封顶或校准展示分；结果页只显示命中的主限制。' }
    ],
    calculationSteps: [
      { title: '1. 分层受光', formula: 'mid = midCarrier × midLight; high = highCarrier × highLight', desc: '中云和高云按各自载体、太阳几何、光路和下层遮挡分别估算。' },
      { title: '2. 本地云层展开', formula: 'localCloud = rangeScore + cloudTypeAdjustment + thicknessAdjustment', desc: '例如：中高云画布 37.1 → 区间分 75.9；云种 +4.0；云厚 -2.0。' },
      { title: '3. 两级协同', formula: 'base = layerSynergy(mid, high) → overlapSynergy(regions)', desc: '区域内保留中高云共同显色；区域间按方位与采样重叠率去重。单片强云接近 max，多片独立强云才平滑进入高分。' },
      { title: '4. 空气显色', formula: 'rendered = base × airRendering', desc: '空气显色解释颜色质量；光路打开、高云载体充足但空气湿灰时进入中等显色档，限制上限但不按纯灰幕压穿。' },
      { title: '5. 最终显示分', formula: 'score = clamp(rendered, 0, 100) + status caps', desc: '无火烧云 <40，轻微霞光 <60；几何不可行、厚云、满铺灰幕、雨低云会进一步压制。' }
    ],
    changelog: [
      { date: '2026-07-16', title: '分层与空间重叠协同 v1', summary: '中云、高云分别计算载体×受光；同一区域连续协同，不同区域按采样重叠和方位独立度协同。降水或近雨湿幕明确时关闭协同。' },
      { date: '2026-07-08', title: '开光路空气显色中间档', summary: '光路打开、高云载体充足、低云未封死，但水汽与气溶胶预报提示显色不稳定时，进入中等显色档；水汽不再单独触发雨后灰幕，硬阻断拆成 hard/soft。' },
      { date: '2026-06-18', title: '远端分层载体 v1', summary: '日落方向云拆成远端高云、远端中云和远端低云遮挡，再进入 Σ(分层载体 × 分层受光亮度)。' },
      { date: '2026-06-13', title: '分层求和亮度公式 v1', summary: '最终分改为 Σ(分层载体 × 分层受光亮度) × 空气显色；受光亮度采用对数饱和响应，光路继续作为内部因子。' },
      { date: '2026-06-06', title: '灰幕空气显色 + 方向中云带 v2', summary: '满铺中高云叠加 PM/AOD 偏高时按灰幕压力连续降低显色；太阳方向中云带改为连续载体，强光路下可进入 50-60 档。' },
      { date: '2026-06-03', title: '日落评分 v2', summary: '最终分改为云载体、日落光路、空气显色三部分合成；光路开且能见度可接受时，轻/中度 AOD、PM、dust 作为橙红散射正向因素。' },
      { date: '2026-05-27', title: '云厚比例折损 v2', summary: '云厚作为本地云层修正参与基础分，不再在用户可见凭据里展开内部压力证据。' },
      { date: '2026-05-19', title: '载体候选 + 光路门控 v1', summary: '正向云层载体改为有上限的候选；太阳方向多点光路采样并入受光亮度。' },
      { date: '2026-05-13', title: '四因子分析 v1', summary: '分析固定为云层载体、光路条件、空气显色、限制因素四项，减少零散条目。' },
      { date: '2026-05-12', title: '气溶胶弱载体 v1', summary: '适度气溶胶只作为弱载体候选；若未被采用，不再显示成最终分后加分。' },
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
        : '霞客先分别计算中云、高云的载体与受光，再做区域内分层协同和区域间重叠协同，最后结合空气显色与限制因素得到分数。'
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
