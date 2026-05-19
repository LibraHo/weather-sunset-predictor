/**
 * 简体中文翻译
 */
export default {
  // 应用
  app: {
    title: '霞客',
    apiKeyRequired: '请输入API密钥',
    apiKeyTooShort: 'API密钥格式不正确，长度过短',
    saving: '保存中...',
    apiKeySaved: 'API密钥保存成功',
    selectLocationFirst: '请先选择位置',
    refreshSuccess: '数据刷新成功',
    refreshFailed: '刷新失败: {{message}}',
    locationRequired: '请输入位置名称',
    geocodingNotReady: '地理编码服务未初始化',
    switchedToLocation: '已切换到：{{name}}',
    locatedAt: '已定位到：{{name}}',
    subtitle: '预测火烧云出现的最佳时机'
  },

  gallery: {
    pageTitle: '霞客分享地图',
    title: '晚霞照片分享',
    subtitle: '看看世界各地分享的晚霞照片',
    loading: '加载照片中...',
    loadFailed: '加载失败，请刷新重试',
    emptyTitle: '暂无照片',
    emptyBody: '上传第一张火烧云照片吧。',
    legendAria: '图例',
    photoLocationLegend: '照片位置',
    photoAltFallback: '晚霞照片',
    notProvided: '未填写',
    takenAt: '拍摄时间',
    locationName: '拍摄地点',
    uploadedAt: '上传时间',
    uploaderName: '上传者',
    photoCount: '{{count}} 张照片',
    clusterListAria: '聚合照片缩略图列表',
    clusterPhotoLabel: '第 {{index}} 张照片：{{location}}'
  },

  // Home tabs & methodology
  home: {
    tabs: {
      ariaLabel: '主页分页导航',
      forecast: '预测功能',
    methodology: '火烧云计算方法',
      map: '火烧云地图',
      shareMap: '分享地图',
      apiAccess: 'API接入'
    },
    menu: {
      ariaLabel: '页面切换',
      dropdownAriaLabel: '页面切换菜单'
    },
    apiAccess: {
      kicker: 'Sunset Voyager API',
      intro: '霞客 Agent API 提供地点解析、朝霞/晚霞评分和评分解释，适合个人、学习与研究场景。',
      openApiSpec: 'OpenAPI 规格',
      admin: '管理后台',
      quickStart: '快速开始',
      step1: '申请并获取 Token。',
      step2: '请求时在 Authorization: Bearer <token> 中传入。',
      step3: '调用 /api/agent/forecast、/api/agent/explain 或 /api/agent/geocode。',
      restrictions: '使用限制',
      restrictionText: '仅限个人/学习/研究用途，禁止商用。公开展示请脱敏并标明来源。',
      exampleCall: '示例调用',
      endpoints: '核心接口',
      forecastDesc: '返回评分、质量等级和最佳观赏窗口。',
      explainDesc: '返回评分构成、关键限制和自然语言解释。',
      geocodeDesc: '返回地点候选、坐标和置信度。'
    },
    methodology: {
      title: '火烧云计算方法',
      intro: '火烧云指数由四个关键因子综合计算，帮助你快速判断当天是否值得蹲守晚霞。',
      versionLabel: '算法版本：2026.05.19-additive-carrier-light-gate-v1',
      versionDesc: '本版将正向云层信号改为有界加分，并让太阳方向多点采样作为光路门控；不再用 directRatio 参与评分。',
      changelogTitle: "版本更新记录",
      changelogHint: "近三个月内的算法更新都会放在这里，可滚动回看原因、影响和验证方式",
      changelog: {
        latest: {
          date: '2026-05-19',
          title: '加法载体 + 光路门控 v1',
          summary: '正向云层信号改为有界加分，已有太阳方向多点采样作为光路门控；高云 100% 不再自动接近满分。',
          validation: '验证：36.36°N, 92.83°E 纯高云样本从满分降到 72；北京近端光路云墙样本降到 33.5；不新增 API 请求。'
        },
        aerosol: {
          date: '2026-05-12',
          title: '气溶胶弱载体 v1',
          summary: '云层很少时，适度薄雾/气溶胶必须被太阳方向光路激活，才会作为普通红日落的弱载体参与评分。',
          validation: '验证：北京弱红日落可进入 30 多分；干净晴空、重霾沙尘、低云遮挡和厚灰幕场景不被抬高。'
        },
        openingCarrier: {
          date: '2026-05-11',
          title: '开口型中高云载体 v1',
          summary: '低云少、中高云可染色且太阳方向有开口时，不再把它误判成完全遮光的厚云幕。',
          validation: '验证：颐和园开口型中高云样本回到可观赏区间；灰霾、沙尘和无开口厚云仍保持保守。'
        },
        lightPath: {
          date: '2026-05-10',
          title: '低云主导光路 v3',
          summary: '光路遮挡改为看低云是否挡住太阳方向，避免高云/中云很多但低云很少的晚霞画布被误伤。',
          validation: '验证：高云画布场景不再仅因总云量高而压低；低云主导、雨雪和低能见度仍保守。'
        },
        upperCloudCarrier: {
          date: '2026-05-10',
          title: '中高云载体保护 v2',
          summary: '高云和中云都充足、低云少且空气不灰时，按可染色画布处理，不再简单压成低分。',
          validation: '验证：北京中高云样本回到 50-60 分区间；空气灰、沙尘重或缺少中云支撑时仍保持低分。'
        }
      },
      factors: {
        highMidCloudTitle: '中高云（画布条件）',
        highMidCloudDesc: '中高云越理想，越容易形成丰富的橙红色层次；过少或过厚都会降低效果。',
        lowCloudTitle: '低云遮挡（扣分项）',
        lowCloudDesc: '低云过多会阻挡地平线附近光线，是火烧云观赏失败的主要风险之一。',
        humidityTitle: '湿度（渲染增强）',
        humidityDesc: '适中的湿度有利于色彩渲染；湿度过高可能导致雾霾感，过低则色彩偏淡。',
        visibilityTitle: '能见度（清晰度）',
        visibilityDesc: '更高能见度通常意味着更清晰的天空背景，晚霞边界和色彩过渡更明显。'
      },
      scoreGuideTitle: '评分解读',
      scoreExcellent: '顶级：85-100（少见爆发）',
      scoreGood: '高分：70-84（值得蹲守）',
      scoreFair: '可观赏：40-69（看实况）',
      scoreExcellentRange: '顶级 Rare',
      scoreExcellentDetail: '85-100 分',
      scoreExcellentDesc: '少见的爆发级条件，值得优先安排',
      scoreGoodRange: '高分 Strong',
      scoreGoodDetail: '70-84 分',
      scoreGoodDesc: '明显高于常态，适合专程蹲守',
      scoreFairRange: '可观赏 Watch',
      scoreFairDetail: '40-69 分',
      scoreFairDesc: '有机会出色彩，但需要看局地开口和实况',
      scorePoorRange: '低概率 Low',
      scorePoorDetail: '<40 分',
      scorePoorDesc: '火烧云条件偏弱；不建议专程追霞，普通日落效果需看实时天气和视野',
      scoreSourceTitle: '为什么地图颜色和地点详情分会不同',
      scoreSourceMap: '地图上的颜色是区域趋势，用来快速看“这一片哪里更可能出彩”。为了让整张图连续，它会按固定网格批量计算，再在格点之间做平滑。',
      scoreSourcePoint: '地点详情分是你选中的具体位置，会按这个坐标重新计算当地日出/日落时间、云层、空气质量和太阳方向光路。',
      scoreSourceWhy: '所以地图适合先找方向，地点详情适合最后决定要不要去。如果两者差很多，以地点详情为准。',
      sections: {
        cloudStructure: {
          title: '1. 云层结构',
          subtitle: 'Cloud Structure · 画布评分',
          desc: '火烧云需要合适的云层作为"画布"，高云和中云是核心载体，低云起遮挡作用。',
          highCloud: '高云（>6km）：火烧云的最佳载体，透光性好，能染出大片红橙色',
          midCloud: '中云（2–6km）：同样能产生火烧云，效果略逊于高云',
          lowCloudBonus: '低云（<2km）：主要起遮挡作用，不贡献正面分数',
          formula: '有效云量 = max(高云×1.15, 中云)×0.7 + min(高云, 中云)×0.2；低云30%以下不惩罚，80%时惩罚到0.5',
          highCloudBonus: '高云主导加分：当高云>50%且低云<30%时，画布分×1.2倍'
        },
        lightPath: {
          title: '2. 光路评估',
          subtitle: 'Light Path · 光路评分',
          desc: '光路通畅度决定阳光能否照到可染色的中高云。低云挡在太阳方向时会明显拉低光路；中高云多时通常先看作晚霞画布。',
          lowCloudEffect: '低云少时光路更容易打开；低云主导或太阳方向有低云墙时，光线更难照到云层',
          visibility: '能见度：影响光线传播清晰度',
          formula: '光路分 = 太阳角度与云底高度估算 + 低云遮挡 + 太阳方向走廊修正'
        },
        transparency: {
          title: '3. 大气透明度',
          subtitle: 'Transparency · 渲染评分',
          desc: '透明的大气让光线更纯粹地染色云层，湿度适中有助于散射增强色彩。',
          visibility: '能见度：15 × (1 − e^(−v/15))，满分15分',
          humidity: '湿度：最优55%，高斯曲线，满分10分',
          formula: '透明度分 = 能见度分 + 湿度分（最高25分）'
        },
        layerDiversity: {
          title: '4. 云层立体感',
          subtitle: 'Layer Diversity · 层次评分',
          desc: '高中低三层云同时存在时，光线折射角度多样，色彩层次更丰富。',
          threeLayer: '三层云均>10% → 15分',
          twoLayer: '任意两层>10% → 8分',
          oneLayer: '仅一层或无云 → 0分'
        },
        lowCloudPenalty: {
          title: '5. 低云惩罚系数',
          subtitle: 'Low Cloud Penalty · Multiplier',
          desc: '低云挡在视线前方，是火烧云的"视线杀手"，以乘性系数惩罚总分。',
          level1: '低云<20% → ×1.0（无惩罚）',
          level2: '低云20–40% → ×1.0 到 ×0.8（线性）',
          level3: '低云40–70% → ×0.8 到 ×0.5（线性）',
          level4: '低云>70% → ×0.2（严重遮挡）'
        },
        thickHighCloudPenalty: {
          title: '7. 载体与灰幕修正',
          subtitle: 'Carrier Quality · 画布与薄雾',
          desc: '算法把“能显色的载体”分成云层载体和气溶胶弱载体：中高云决定火烧云上限，适度薄雾只在光路通畅时提供普通红日落的中低分基础。',
          level1: '中高云载体明确：高云很充足，或中高云同时存在且太阳方向有透光开口，低云少、无降水且空气不灰',
          level2: '云很少时，适度气溶胶必须被太阳方向光路激活，才会作为弱载体参与评分',
          level3: '如果云幕很厚、重霾或沙尘明显，颜色会变暗变灰，仍按衰减和限制处理',
          formula: '载体分 = 云层画布基础 + 载体加分 - 灰幕/厚云扣分；最终分 = 载体分 × 光路门控 + 显色小幅修正'
        },
        precipPenalty: {
          title: '6. 降水惩罚系数',
          subtitle: 'Precipitation Penalty · Multiplier',
          desc: '降水直接削弱火烧云可见性，以乘性系数惩罚总分。',
          level1: '降水<0.1mm/h → ×1.0（无惩罚）',
          level2: '0.1–0.5mm/h → ×0.85',
          level3: '0.5–2mm/h → ×0.5',
          level4: '>2mm/h → ×0.15（大雨，基本无望）',
          formula: '最终得分 = 基础分 × 低云系数 × 降水系数'
        },
        finalFormula: {
          title: '7. 综合计算公式',
          subtitle: 'Final Score Formula',
          desc: '最终得分由画布载体分经过太阳方向光路门控后，再叠加小幅显色修正。',
          formula: '综合得分 = 载体分 × 光路门控 + 显色修正',
          highCloudCap: '高云主导且低云少时，避免把好画布误判为低分'
        }
      }
    }
  },

  // 按钮
  buttons: {
    search: '查询',
    refresh: '刷新',
    save: '保存',
    cancel: '取消',
    confirm: '确认',
    close: '关闭',
    clear: '清除',
    delete: '删除',
    edit: '编辑',
    useCurrentLocation: '使用当前位置',
    changeLanguage: '切换语言',
    switch: '切换'
  },

  // 位置
  location: {
    label: '位置',
    placeholder: '请输入城市名称...',
    current: '当前位置',
    searching: '正在搜索位置...',
    notFound: '未找到该位置，请尝试其他名称',
    permissionDenied: '无法获取位置权限，请手动输入位置',
    loading: '正在获取位置...'
  },

  // 天气
  weather: {
    title: '天气信息',
    current: '当前天气',
    currentLocation: '当前位置',
    noData: '没有可用的天气数据',
    forecast: '预报',
    temperature: '温度',
    humidity: '湿度',
    windSpeed: '风速',
    windDirection: '风向',
    pressure: '气压',
    visibility: '能见度',
    aerosol: '气溶胶',
    clouds: '云量',
    cloudCover: '云量',
    precipitation: '降水',
    highClouds: '高云',
    midClouds: '中云',
    lowClouds: '低云',
    feeling: '体感',
    uvIndex: '估算紫外线',

    // 天气描述
    overcast: '阴天',
    cloudy: '多云',
    partlyCloudy: '少云',
    clear: '晴天',

    // 天气概览
    overview: '概览',
    hourly: '详细预报',
    threeDayGlow: '3天朝晚霞',
    threeDayGlowLoading: '正在读取3天朝晚霞...',
    mapView: '地图预测',
    daysOverview: '{{days}}天概览',
    precipChance: '{{prob}}%降水',
    dataInfo: 'ℹ️ 数据源提供 {{hours}} 小时预测数据（约 {{days}} 天）。若需更多天数，请考虑使用其他天气数据源。'
  },

  // 预测
  prediction: {
    title: '晚霞预测',
    sunrise: '朝霞',
    sunset: '晚霞',
    sunriseAndSunset: '朝晚霞预测',
    score: '预测评分',
    points: '分',
    quality: '质量等级',
    bestTime: '最佳观赏时间',
    analysis: '分析',
    analysisTitle: '📊 分析原因',
    details: '详情',
    detailedWeatherData: '详细气象数据',
    noPredictionData: '⚠️ 暂无{{date}}预测数据',
    insufficientData: '天气数据不足，无法生成预测。请稍后刷新数据。',
    viewFutureOrRefresh: '请查看未来预测或稍后刷新数据',
    predictionUnavailable: '⚠️ 天气数据不足',

    // 质量等级
    excellent: '优秀',
    good: '良好',
    fair: '一般',
    poor: '较差',

    // 状态描述

    analysisConclusion: {
      excellent: '条件优秀，强烈推荐出行观赏',
      excellentSingleLayer: '条件优秀，色彩可期；云层单一，层次感略有不足',
      good: '条件不错，有较大概率出现壮观的火烧云',
      goodSingleLayer: '条件不错，火烧云概率较高；云层层次稍欠',
      fair: '条件中等，需看实际云层演变',
      clearSunset: '火烧云不明显，日落通透。',
      low: '关键条件不足，火烧云概率偏低'
    },
        scoreBreakdown: {
      title: '分数明细',
      viewDetails: '查看评分明细',
      finalDisplayed: '最终展示分',
      baseFormula: '基础分 = 载体 × 光路门控',
      baseHint: '太阳方向光路门控后的载体基础分',
      canvasHint: '高云/中云提供主要色彩载体，适度薄雾可提供弱载体，低云会遮挡',
      lightPathHint: '太阳光是否能照到云层',
      finalFormula: '最终分 = 基础分 + 显色修正',
      renderingHint: '湿度、能见度影响颜色表现',
      aerosolHint: '适度气溶胶增强橙红散射，过多则发灰',
      ledger: {
        pts: '分',
        whyThisScore: '为什么是这个分数',
        weightedFormula: '{{canvas}}×80% + {{light}}×20% = {{base}}',
        canvasPlusLightPath: '画布 + 光路',
        renderingFormula: '{{base}} × 显色系数 {{factor}} = {{rendered}}',
        weatherTransparency: '天气通透度',
        summary: {
          event: '{{score}} 分：{{detail}}',
          rendered: '{{base}} 分经显色条件修正为 {{rendered}} 分',
          default: '{{score}} 分：由云层、光路和显色条件综合计算'
        },
        weather: {
          clouds: '高/中/低云 {{high}}/{{mid}}/{{low}}%',
          visibility: '能见度 {{value}}km',
          humidity: '湿度 {{value}}%',
          rain: '降水 {{value}}mm/h'
        },
        labels: {
          cloudCarrier: '云层载体',
          lightPath: '光路',
          baseScore: '基础分',
          rendering: '显色修正',
          final: '最终分',
          hardCap: '天气限制',
          hazeCap: '灰幕影响',
          thickCloudCap: '厚云影响',
          cloudThicknessModifier: '云层厚度影响',
          geometryCap: '太阳角度',
          occlusion: '遮挡修正',
          carrierFloor: '载体保底',
          postRainCap: '雨后灰幕',
          displayCalibration: '展示分校准',
          aerosolCarrier: '气溶胶载体'
        },
        details: {
          cloudCarrier: '可被染色的云面或薄雾载体',
          cloudPenalty: '云画布 {{canvas}}，低云 ×{{low}}，阴天 ×{{overcast}}',
          aerosolCarrier: '云层很少时，薄雾在光路通畅时可承接一点暖色，光路激活 ×{{activation}}',
          lightPath: '阳光是否能打到云层',
          renderingFactors: '能见度 ×{{visibility}}，湿度 ×{{humidity}}，气溶胶 ×{{aerosol}}',
          afterAdjustments: '结合天气和能见度后',
          finalDisplayed: '最终展示结果',
          thickCloudCap: '厚云幕或灰幕会削弱真实可染色效果',
          cloudThicknessModifier: '云厚证据并不充分，当前按连续修正温和压分',
          geometryCap: '太阳与云层几何条件不足',
          occlusion: '远端遮挡压低最终分',
          carrierFloor: '高云载体清透，避免误伤低估',
          directionalSamples: '已参考太阳方向周边云况',
          lightPathLowCloudBlock: '低云遮住太阳方向，光线不容易照到中高云',
          lightPathRain: '降水会削弱日落直射光',
          postRainCap: '雨后水汽或灰幕偏重，霞光容易发灰',
          displayCalibration: '最终展示分按预测状态档位校准'
        },
        reasons: {
          precipitationCap45: '降水叠加低云，观赏条件明显变差',
          overcastCap35: '低云遮住太阳方向，光线不容易照到云层',
          overcastFogCap15: '低云叠加低能见度，天空容易发灰',
          rainyMidCloudOvercastCap35: '雨后水汽偏重，霞光不容易显色',
          extremeDustHazeCap28: '强沙尘或灰幕会压住霞光',
          severeHazeCap35: '重度灰霾让颜色不容易出来',
          moderateHazeCap45: '灰霾会削弱红橙色',
          denseCarrierCanvasOnly: '中高云层仍能承接晚霞光线',
          adjustmentApplied: '已按限制条件修正',
          displayCalibration: '最终展示分按预测状态档位校准',
          lightPathStatusCap60: '光路约 {{light}}，更像轻微霞光机会',
          canvasStatusCap40: '云层载体约 {{canvas}}，火烧云机会偏弱'
        }
      }},
formationAnalysis: {
      title: '火烧云形成条件分析',
      groups: { positive: '有利条件', neutral: '一般因素', warning: '注意因素' },
      factors: {
        carrier: {
          title: '云层载体',
          status: { good: '较好', fair: '一般', weak: '较弱' },
          desc: {
            good: '中高云能承接日落光线，是今天主要的显色画布。',
            fair: '有一些可被染色的云层，但面积或高度不够理想。',
            weak: '缺少合适的中高云，天空不容易形成大片火烧云。'
          }
        },
        lightPath: {
          title: '光路条件',
          status: { good: '较好', fair: '一般', weak: '较弱' },
          desc: {
            good: '太阳方向相对通透，光线有机会照到云底。',
            fair: '太阳方向有一定遮挡，晚霞可能只出现在局部。',
            weak: '低云或云墙挡住光路，光线不容易打到云层。'
          }
        },
        rendering: {
          title: '空气显色',
          status: { good: '较好', fair: '一般', weak: '较弱' },
          desc: {
            good: '空气里有适度颗粒和水汽，颜色更容易偏暖、偏红。',
            fair: '空气条件普通，颜色表现主要看云层和光路。',
            weak: '空气偏灰或颗粒过重，颜色容易变暗、变淡。'
          }
        },
        limits: {
          title: '限制因素',
          status: { good: '无明显', fair: '轻微', weak: '明显' },
          desc: {
            good: '没有明显压制条件。',
            fair: '有轻微不利因素，可能压低持续时间或颜色强度。',
            weak: '降水、厚云、低云遮挡或灰幕明显，会压低整体表现。'
          }
        }
      },
      high: {
        abundant: '高层云充沛（{{value}}%）', abundantDesc: '色彩载体丰富，火烧云基础扎实',
        sufficient: '高层云充足（{{value}}%）', sufficientDesc: '具备较好的霞光染色载体',
        moderate: '高层云适中（{{value}}%）', moderateDesc: '可形成火烧云，但色彩可能偏淡',
        few: '高层云偏少（{{value}}%）', fewDesc: '缺少主要色彩载体'
      },
      mid: {
        balanced: '中层云适中（{{value}}%）', balancedDesc: '利于色彩扩散和层次感',
        few: '中层云较少（{{value}}%）', fewHighCloudDesc: '但高层云充足，可独立形成火烧云', fewDesc: '层次感可能不足',
        thick: '中层云偏厚（{{value}}%）', thickDesc: '可能让画面偏灰，削弱霞光通透感'
      },
      low: {
        few: '低云稀少（{{value}}%）', fewDesc: '不会遮挡火烧云',
        some: '低云较多（{{value}}%）', someDesc: '可能部分遮挡低空色彩',
        thick: '低云偏厚（{{value}}%）', thickDesc: '遮挡风险较大'
      },
      visibility: {
        good: '能见度良好（{{value}}km）', goodDesc: '空气通透，观赏视野好',
        moderate: '能见度一般（{{value}}km）', moderateDesc: '色彩饱和度可能略受影响',
        low: '能见度偏低（{{value}}km）', lowDesc: '雾霾或水汽可能影响观赏'
      },
      humidity: {
        moderate: '湿度适中（{{value}}%）', moderateDesc: '利于光线散射',
        high: '湿度偏高（{{value}}%）', highDesc: '可能略影响通透感',
        low: '湿度偏低（{{value}}%）', lowDesc: '空气较干，色彩可能偏淡'
      },
      aerosol: {
        moderate: '气溶胶适中（AOD {{value}}）', moderateDesc: '有利于增强红橙色散射',
        high: '气溶胶偏高（AOD {{value}}）', highDesc: '可能灰霾发暗',
        low: '空气过于通透（AOD {{value}}）', lowDesc: '颜色可能偏淡',
        carrier: '薄雾红日载体', carrierDesc: '云层很少时，适度气溶胶在光路通畅时也能带来一点暖色日落'
      },
      lightPath: {
        opening: '太阳方向有透光开口', openingDesc: '太阳方向的低云较少，光线更容易打到云层',
        wall: '太阳方向有云墙遮挡', wallDesc: '太阳方位周边低/中云偏厚，远端光路会压低主评分',
        lowCloudBlock: '低云遮住光线', lowCloudBlockDesc: '低云挡在太阳方向，阳光不容易照到中高云'
      },
      postRain: {
        clear: '雨后空气清透', clearDesc: '近6小时有降水，但能见度和颗粒物条件较好，雨后加成保留',
        gray: '雨后灰幕风险', grayDesc: '降水后水汽或颗粒物偏重，霞光容易发灰'
      },
      carrier: {
        strong: '高云载体清晰', strongDesc: '高云充足、低云稀少且空气较通透，具备中高分基础',
        dense: '中高云载体明确', denseDesc: '高云和中云共同提供画布，色彩载体更稳定'
      },
      layer: { single: '云层单一', singleDesc: '高云质量好，仍可形成鲜明火烧云' }
    },
    status: {
      noFireCloud: '无火烧云',
      lightGlow: '轻微晚霞',
      goodGlow: '有晚霞',
      highProbability: '大概率出现漂亮晚霞',
      moderateProbability: '可能出现晚霞',
      lowProbability: '不太可能出现晚霞',
      skyClear: '万里无云，缺少"画布"反射光线',
      cloudPerfect: '云层适中，有利于形成漂亮晚霞',
      cloudTooThick: '云层过厚，阳光无法穿透',
      cloudUnsuitable: '云况不适宜形成火烧云',
      waitForClouds: '建议等待云量适中的天气',
      lightPathBlocked: '西方有云遮挡，光线难以到达',
      lightPathObstructed: '光路被阻挡',
      poorViewing: '观赏效果不佳',
      conditionsFair: '条件一般，可能零星色彩',
      canWatch: '可以观赏',
      conditionsGood: '条件尚可，有一定观赏价值',
      clearSunsetTransparent: '火烧云不明显，日落通透。',
      casualViewingOk: '可以出门看看',
      veryLikely: '大概率出现漂亮晚霞',
      excellentConditions: '云量适中，光路通畅',
      legendaryEruption: '传说级爆发',
      perfectMidHighClouds: '完美的中高云层，光路清晰',
      highlyRecommended: '强烈推荐观赏！'
    },

    // 时间段
    goldenHour: '🌟 黄金时段',
    blueHour: '🌌 蓝调时段',
    sunAzimuth: '🧭 太阳方位',
    sunriseTime: '日出时间',
    sunsetTime: '日落时间',
    bestViewingTime: '最佳观赏时间',
    sunriseDirectionLabel: '日出方向',
    sunsetDirectionLabel: '日落方向',

    // 最佳观看窗口描述
    bestViewingWindowSunrise: '日出前后30分钟是观看朝霞的最佳时间',
    bestViewingWindowSunset: '日落前后30分钟是观看晚霞的最佳时间',

    // 画布评分
    canvas: {
      title: '画布评分',
      score: '画布得分',
      aerosol: '气溶胶',
      cloudLevel: '云层等级',
      breakdown: '云层分布',
      canvasScore: '📊 画布: {{score}}分 | {{level}}',
      cloudBreakdown: '高云{{high}}% 中云{{mid}}% 低云{{low}}%',
      lowCloudPenalty: '| 低云惩罚: {{reason}}',
      // 云层等级
      space: '太空（无云）',
      fair: '尚可',
      perfect: '完美',
      crowded: '拥挤',
      overcast: '阴天',
      // 低云惩罚原因
      noLowCloudObstruction: '无低云遮挡',
      tooManyLowClouds: '低云过多（几乎阴天）',
      lowCloudAmount: '低云量 {{value}}%'
    },

    // 云厚评估（Phase 22）
    cloudThickness: {
      title: '云层厚度',
      thin: '云层薄透',
      moderate: '云层适中',
      thick: '云层偏厚',
      unknown: '未知',
      thinDesc: '云层薄透，光线穿透性好，有利于霞光',
      moderateDesc: '云层厚度适中',
      thickDesc: '云层偏厚，可能遮挡光线，霞光效果受限',
      unknownDesc: '云厚数据不可用'
    },

    thickHighCloud: {
      title: '厚高云惩罚',
      scoreHint: '厚高云幕，直射光弱，仅局部透光，分数会偏低',
      analysisTitle: '厚高云幕',
      analysisDesc: '高云虽多，但云层偏厚、直射光弱，通常只能在日落方向出现局部霞光'
    },

    highCloudCarrier: {
      title: '高云载体保底',
      scoreHint: '高云充足、低云少且空气较通透时，避免云厚信号误伤'
    },

    aerosolHaze: {
      title: '沙尘灰幕影响',
      scoreHint: 'AOD、沙尘或 PM10 过高时，高云多也不代表能烧起来'
    },

    // 光路评分
    lightPath: {
      title: '光路评分',
      score: '光路得分',
      visibility: '能见度',
      lightPathScore: '光路: {{score}}分'
    },

    // 渲染评分
    rendering: {
      title: '渲染评分',
      score: '渲染得分',
      aerosol: '气溶胶散射',
      humidity: '湿度影响',
      renderingFactor: '🎨 渲染系数: {{factor}} | {{visibility}} | {{aqi}} | {{color}}',
      specialMode: '| {{mode}}',
      // 能见度描述
      visibilityExcellent: '极佳（>20km）',
      visibilityGood: '良好（10-20km）',
      visibilityPoor: '较差（<10km）',
      // 湿度描述
      humidityFog: '可能有大雾',
      humidityDry: '空气干燥',
      humidityModerate: '湿度适中',
      // AQI描述
      aqiExcellent: '优',
      aqiGood: '良',
      aqiPoor: '差',
      // 色彩倾向
      colorGoldenOrange: '金黄、亮橙色',
      colorReddishPurplish: '偏红、紫红色',
      colorDarkRed: '暗红、血色（不美）',
      // 特殊模式
      postRainMode: '🌟 雨后初晴模式（超级加倍）',

      // 云厚评估（Phase 22）
      cloudThickness: {
        title: '云层厚度',
        thin: '云层薄透，光线容易穿透',
        moderate: '云层适中',
        thick: '云层偏厚，光线穿透受限',
        unknown: '云厚数据不可用'
      }
    },

    // 综合评分
    composite: {
      title: '综合评分',
      finalScore: '最终得分',
      confidence: '预测可信度'
    },

    // 云层分析
    cloudLayers: {
      title: '☁️ 云层分层信息',
      highCloudLabel: '⛅ 高云 (>6km)',
      midCloudLabel: '☁️ 中云 (2-6km)',
      lowCloudLabel: '🌫️ 低云 (<2km)',
      high: '高云（>6km）',
      mid: '中云（2-6km）',
      low: '低云（<2km）',
      shortHigh: '高云',
      shortMid: '中云',
      shortLow: '低云',
      favorable: '有利',
      unfavorable: '不利',
      cloudAnalysis: '云层分析：',
      description: '高云{{high}}% 中云{{mid}}% 低云{{low}}%'
    },

    // 描述
    descriptions: {
      skyClear: '万里无云，缺少"画布"反射光线',
      cloudPerfect: '云层适中，有利于形成漂亮晚霞',
      lowCloudHeavy: '低云过多，可能遮挡晚霞',
      highHumidity: '湿度过高，可能影响能见度',
      lowHumidity: '湿度过低，云层可能过薄',
      goodVisibility: '能见度极佳，观赏条件良好',
      poorVisibility: '能见度较差，可能影响观赏效果'
    },

    // 火烧云分析
    fireCloud: {
      title: '🔥 火烧云指数：{{score}}/100{{level}}',
      excellent: '（极佳）',
      good: '（良好）',
      fair: '（一般）',
      poor: '（较差）',
      analysisTitle: '🔥 火烧云形成条件分析：',
      idealCloud: '✅ 云量理想（{{value}}%），能充分反射阳光',
      slightlyLowCloud: '⚠️ 云量略少（{{value}}%），火烧云效果可能偏淡',
      tooMuchCloud: '⚠️ 云量过多（{{value}}%），可能遮挡阳光',
      severelyLowCloud: '❌ 云量严重不足（{{value}}%），无法形成火烧云',
      idealHumidity: '✅ 湿度适中（{{value}}%），利于光线散射',
      slightlyLowHumidity: '⚠️ 湿度略低（{{value}}%），色彩可能不够鲜艳',
      slightlyHighHumidity: '⚠️ 湿度偏高（{{value}}%），可能影响色彩饱和度',
      severelyLowHumidity: '❌ 湿度不足（{{value}}%），光线散射弱',
      excellentVisibility: '✅ 能见度极佳（{{value}} km），视野通透',
      goodVisibility: '✅ 能见度良好（{{value}} km），观赏体验佳',
      fairVisibility: '⚠️ 能见度一般（{{value}} km），色彩可能略暗',
      poorVisibility: '❌ 能见度差（{{value}} km），有雾霾影响',
      sparseLowCloud: '✅ 低云稀少（{{value}}%），不会遮挡火烧云',
      littleLowCloud: '✅ 低云较少（{{value}}%），对观赏影响小',
      someLowCloud: '⚠️ 低云较多（{{value}}%），可能部分遮挡',
      denseLowCloud: '❌ 低云密集（{{value}}%），严重影响观赏',
      excellentConditions: '🌟 具备出现绚烂火烧云的所有条件！',
      highProbability: '有较大概率出现壮观的火烧云景象',
      moderateProbability: '💫 可能出现轻微的火烧云效果',
      lowProbability: '⛅ 形成明显火烧云的可能性较低',
      noCloudNoFireCloud: '❌ 云量严重不足，无法形成火烧云',
      tooMuchCloud: '❌ 云量过多，遮挡阳光难以形成火烧云'
    },

    // 总体评价
    overallEvaluation: {
      excellent: '{{date}}的气象条件非常适合观赏{{type}}！<br><br>',
      good: '{{date}}的气象条件较为适合观赏{{type}}。<br><br>',
      fair: '{{date}}的气象条件不太理想。<br><br>',
      idealCloud: ' 云量适中（{{value}}%），有利于形成绚丽的色彩。<br>',
      lowCloud: ' 云量偏少（{{value}}%），可能缺少足够的云层来反射光线。<br>',
      highCloud: ' 云量较多（{{value}}%），可能遮挡过多阳光。<br>',
      idealHumidity: ' 湿度适宜（{{value}}%），空气中的水汽有助于光线散射。<br>',
      lowHumidity: ' 湿度偏低（{{value}}%），空气较干燥。<br>',
      highHumidity: ' 湿度较高（{{value}}%），可能影响能见度。<br>',
      excellentVisibility: ' 能见度良好（{{value}} km），视野清晰。<br>',
      fairVisibility: ' 能见度一般（{{value}} km）<br>',
      poorVisibility: ' 能见度较差（{{value}} km），可能有雾霾。<br>',
      sparseLowCloud: ' 低层云较少，不会遮挡视线。',
      someLowCloud: ' 有一些低层云，可能略微影响观赏效果。',
      denseLowCloud: ' 低层云较多（{{value}}%），可能遮挡部分景观。'
    },

    // 未来预测
    passed: '已过',
    forecast: '未来预测'
  },

  // 分享
  share: {
    title: '分享预测',
    panelTitle: '分享',
    saveImage: '保存图片',
    copyLink: '复制链接',
    nativeShare: '更多分享',
    copied: '链接已复制',
    cardPredictionFileSuffix: '预测'
  },

  shareCard: {
    brandName: '霞客',
    brandSubtitle: 'Sunset Voyager',
    shareTitle: '火烧云预测分享',
    unknownLocation: '未知地点',
    labels: { probability: '火烧云概率', excellent: '极佳', good: '良好', fair: '一般', poor: '较差' },
    gauge: { hintExcellent: '值得专门等一等', hintGood: '可以顺路观察', hintFair: '不必专门出门' },
    timeLabels: { sunrise: '日出', sunset: '日落' },
    bestWindow: '最佳观赏  {{start}} – {{end}}',
    cloud: { high: '高云', mid: '中云', low: '低云' },
    verdict: {
      noCarrier: '缺少色彩载体，火烧云概率极低',
      excellent: '条件优秀，色彩可期',
      excellentMultiLayer: '极佳条件，强烈推荐出行观赏！',
      good: '条件不错，火烧云概率较高',
      fair: '条件中等，需看实际云层演变',
      poor: '火烧云概率较低'
    },
    watermark: '霞客 · 记录每一次绚丽'
  },

  // 任务19：周边火烧云
  surrounding: {
    title: '周边火烧云分析',
    radarTitle: '周边云况雷达',
    radarSubtitle: '20km · 连续云场',
    radius: '探测半径',
    radiusUnit: '公里',
    directions: {
      N: '北',
      NE: '东北',
      E: '东',
      SE: '东南',
      S: '南',
      SW: '西南',
      W: '西',
      NW: '西北'
    },
    loading: '正在获取周边气象数据...',
    error: '获取周边数据失败',
    noData: '暂无周边数据',
    clickToView: '点击方位查看详情',
    viewingDirection: '查看{{direction}}方向',
    distanceInfo: '{{distance}}公里',
    recommendation: '观赏建议',
    bestDirections: '推荐观赏方向',
    scoreBreakdown: '各方位评分',
    legend: {
      excellent: '优秀（≥80分）',
      good: '良好（60-79分）',
      fair: '一般（40-59分）',
      poor: '较差（<40分）'
    },
    fallbackMessage: '您的浏览器不支持Canvas，使用表格显示'
  },

  // 任务20：火烧云覆盖层
  overlay: {
    title: '火烧云覆盖层',
    refresh: '刷新',
    type: '类型',
    legend: '图例:',
    legendLow: '低',
    legendMedium: '中',
    legendHigh: '高',
    hint: '提示：启用覆盖层后，地图上将显示火烧云预测的地理分布热力图',
    loading: '正在生成覆盖层...',
    active: '覆盖层已显示',
    error: '覆盖层生成失败',
    notAvailable: '覆盖层功能不可用（需要先获取周边数据）'
  },

  weatherMap: {
    surroundingFair: '当前周边区域火烧云观赏条件一般',
    scoreWithQuality: '{{score}}分 - {{quality}}',
    pointToast: '{{name}}方向｜评分: {{score}}分｜距离: {{distance}}公里',
    emptyChinaSpots: '今日暂无可见火烧云点位',
    updatedAt: '更新于 {{time}}',
    supportedRegions: '目前支持：中国大陆、港澳台、日本、韩国、朝鲜及中南半岛主要城市；热力栅格当前以中国区域为主。',
    interactionHint: '可拖拽地图 · 滚轮缩放',
    tabs: { sunrise: '朝霞', sunset: '晚霞' },
    quality: { excellent: '优秀', good: '良好' },
    period: { sunriseTomorrow: '明天的朝霞', sunsetToday: '今天的晚霞', testLayer: '测试图层（模拟数据）' }
  },

  // 时间
  time: {
    today: '今天',
    tomorrow: '明天',
    yesterday: '昨天',
    dayAfterTomorrow: '后天',
    daysLater: '{{days}}天后',
    week: '周',
    date: '日期',
    time: '时间'
  },

  // 日期相关
  date: {
    today: '今日',
    tomorrow: '明日',
    dayAfterTomorrow: '后天',
    format: '{{month}}月{{day}}日'
  },

  // 日期按钮
  dates: {
    today: '今天',
    tomorrow: '明天'
  },

  // 未来预测
  forecast: {
    title: '未来预测'
  },

  // 通用文本
  common: {
    loading: '加载中...',
    dataSource: '数据来源：Open-Meteo（GFS + ECMWF）',
    visitorCount: '访问人数：'
  },

  // 错误消息
  errors: {
    title: '错误',
    networkError: '网络连接错误，请检查网络设置',
    apiError: 'API调用失败，请稍后重试',
    apiKeyMissing: '请先配置Windy API密钥',
    apiKeyInvalid: 'API密钥无效，请检查配置',
    timeout: '请求超时，请重试',
    unknownError: '发生未知错误，请重试',
    locationError: '位置解析失败，请尝试其他位置名称',
    mapInitFailed: '地图初始化失败'
  },

  // 设置
  settings: {
    title: '设置',
    weatherProvider: '天气数据源',
    providerCurrent: '当前来源',
    providerQuality: '数据质量',
    providerUpdateTime: '最近更新',
    providerStatusExcellent: '极佳',
    providerStatusStandard: '良好',
    providerStatusDegraded: '降级',
    apiKey: 'API密钥',
    apiKeyLabel: '配置Windy API密钥',
    apiKeyPlaceholder: '输入API密钥',
    apiKeyHelp: '请输入您的Windy API密钥以使用天气预测功能',
    language: '语言',
    languageLabel: '界面语言',
    notifications: '通知',
    notificationsTitle: '通知设置',
    notificationsLabel: '晚霞预测通知',
    notificationsDescription: '设置高质量预测提醒',
    notificationsHelp: '当预测质量高于设定值时发送通知',
    enableNotifications: '启用通知提醒',
    thresholdLabel: '评分阈值（当评分≥此值时提醒）',
    testNotification: '测试通知',
    notificationThreshold: '通知阈值',
    favoriteLocations: '收藏位置',
    searchHistory: '搜索历史',
    clearHistory: '清除历史',
    confirmClearHistory: '确定要清除所有搜索历史吗？',
    // 统一设置面板
    close: '关闭',
    done: '完成',
    // 数据源与网络
    dataSource: '数据源与网络',
    currentMode: '当前模式',
    proxyUrl: '后端服务器地址',
    proxyUrlPlaceholder: 'http://localhost:3000',
    proxyUrlHint: '后端代理服务器的 URL 地址',
    weatherFetchMode: '天气计算模式',
    weatherFetchModeHint: '默认使用自适应模式：优先走后端，后端限流或超时时自动切到前端应急，避免页面一直加载',
    weatherFetchModeBackend: '后端模式',
    weatherFetchModeClientFallback: '自适应模式（默认）',
    weatherFetchModeClient: '前端模式',
    // 通知与提醒
    notificationAndAlerts: '通知与提醒',
    enableSunsetNotification: '启用晚霞预测通知',
    notificationHint: '当预测质量达到阈值时发送浏览器通知',
    notificationThresholdLabel: '通知阈值',
    notificationThresholdHint: '预测评分高于此值时发送通知',
    // 语言与显示
    languageAndDisplay: '语言与显示',
    interfaceLanguage: '界面语言',
    // 个性化
    personalization: '个性化',
    themeMode: '主题模式',
    themeLight: '明亮模式',
    themeDark: '暗色模式',
    themeAuto: '跟随系统',
    temperatureUnit: '温度单位',
    tempCelsius: '摄氏度 (℃)',
    tempFahrenheit: '华氏度 (℉)',
    windSpeedUnit: '风速单位',
    windKmh: '公里/小时 (km/h)',
    windMs: '米/秒 (m/s)',
    // 默认位置
    defaultLocation: '默认位置',
    noDefaultLocation: '未设置默认位置',
    setAsDefault: '设为默认',
    currentDefaultLocation: '当前默认位置',
    defaultLocationHint: '设置启动时自动加载的位置',
    // 位置解析服务（需求 24）
    geocodingService: '位置解析服务',
    geocodingMode: '调用模式',
    geocodingModeBackend: '后端代理（推荐）',
    geocodingModeDirect: '前端直连',
    geocodingProvider: '服务提供商',
    geocodingBackendAuto: '自动（国内优先高德，失败回退 Open-Meteo）',
    geocodingBackendNominatim: 'Nominatim（后端代理）',
        geocodingFrontendNominatim: 'Nominatim（前端直连）',
    geocodingBackendGaode: '高德地图（后端代理）',
    geocodingBackendOpenMeteo: 'Open-Meteo Geocoding（后端代理）',
    geocodingDirectNominatim: 'Nominatim / OSM（直连，中国可能受限）',
    geocodingDirectGoogle: 'Google Maps（直连，中国不可用）',
    geocodingApiKey: 'API Key',
    geocodingApiKeyPlaceholder: '输入 API Key',
    geocodingApiKeyHint: '高德地图免费申请：lbs.amap.com',
    geocodingApiKeyRequired: '请先在设置中填写 API Key',
    geocodingChinaTag: '🇨🇳 中国可用',
    // 地图底图
    mapTileProvider: '地图底图',
    mapTileSource: '底图来源',
    mapTileAuto: '自动（中国用高德 / 海外用 OSM）',
    mapTileGaode: '高德地图（中国）',
    mapTileOSM: 'OpenStreetMap（海外）',
    // Windy API Key（兼容旧 key）
    windyApiKey: 'Windy API Key',
    windyApiKeyPlaceholder: '输入你的 Windy API Key',
    windyApiKeyHint: '用于启用 Windy 数据源，留空使用系统默认',
    // Windy API Key（需求 25）
    windyApiKeyMode: 'Windy API 来源',
    windyApiKeyModeSystem: '使用系统 API（推荐）',
    windyApiKeyModeCustom: '使用我的 API Key',
    windyApiKeyCustom: '我的 Windy API Key',
    windyApiKeyCustomPlaceholder: '输入 Windy Point Forecast API Key',
    windyApiKeyCustomHint: '申请地址：windy.com/developer',
    windyApiKeyInvalid: 'API Key 格式无效（长度须 > 8 字符）'
  },

  // 语言选择
  languageSelector: {
    title: '选择语言',
    confirmChange: '确认切换语言',
    confirmChangeMessage: '切换语言后界面将刷新，当前数据不会丢失。是否继续？',
    selectLanguage: '请选择界面语言'
  },

  // 通知
  notifications: {
    title: '晚霞预测提醒',
    excellentForecast: '今晚的晚霞预测评分：{{score}}分，非常适合观赏！',
    goodForecast: '今晚的晚霞预测评分：{{score}}分，值得期待！',
    time: '时间：{{time}}',
    location: '位置：{{location}}',
    enable: '启用通知',
    disable: '禁用通知',
    permissionDenied: '通知权限被拒绝，请在浏览器设置中允许通知',
    permissionGranted: '通知权限已授予',
    threshold: '当评分高于 {{threshold}} 分时通知'
  },

  // 收藏位置
  favorites: {
    title: '收藏位置',
    add: '收藏当前位置',
    remove: '取消收藏',
    removeConfirm: '确定要移除这个收藏位置吗？',
    empty: '暂无收藏位置',
    manage: '管理收藏'
  },

  // 搜索历史
  history: {
    title: '搜索历史',
    empty: '暂无搜索历史',
    clearAll: '清除全部',
    clearConfirm: '确定要清除所有搜索历史吗？'
  },

  // 天气图表
  charts: {
    temperature: '温度',
    precipitation: '降水',
    humidity: '湿度',
    wind: '风速',
    pressure: '气压',
    clouds: '云量',
    hourly: '24小时预报',
    daily: '7天预报',
    overview: '概览',
    details: '详细',
    parameters: '参数',
    trend: '变化趋势',
    time: '时间',
    unit: '单位'
  },

  // 任务18：地图图层
  map: {
    title: '地图预测',
    layers: {
      wind: '风',
      temp: '温度',
      clouds: '云',
      rain: '降水'
    },
    // 任务18.3.3：时间控制
    currentTime: '当前时间：',
    timeNow: '现在',
    timeSunset: '日落',
    timeSunrise: '日出',
    timeHint: '提示：也可以使用地图下方的预测时间轴拖动时间',
    loading: '地图加载中...',
    error: '地图加载失败',
    mockNotSupported: '地图功能仅在真实API模式下可用'
  },

  // 加载状态
  loading: {
    data: '正在加载数据...',
    weather: '正在获取天气数据...',
    prediction: '正在计算预测...',
    pleaseWait: '请稍候...'
  },

  // 其他
  other: {
    copyright: '© 2026 天气晚霞预测器',
    poweredBy: 'Powered by Windy',
    version: '版本',
    about: '关于',
    privacy: '隐私政策',
    terms: '使用条款',
    contact: '联系我们',
    feedback: '反馈'
  }
};
