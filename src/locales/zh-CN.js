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

  account: {
    auth: {
      closeAria: '关闭账号窗口',
      loginTitle: '账号登录',
      registerTitle: '创建账号',
      forgotTitle: '重置密码',
      tabsAria: '账号操作',
      loginTab: '登录',
      registerTab: '注册',
      forgotTab: '找回密码',
      linksAria: '账号辅助操作',
      registerLink: '注册账号',
      forgotLink: '找回密码',
      backToLogin: '返回登录',
      emailLabel: '邮箱',
      passwordLabel: '密码',
      confirmPasswordLabel: '确认密码',
      passwordPlaceholder: '请输入密码',
      passwordMinPlaceholder: '至少 6 位',
      confirmPasswordPlaceholder: '再次输入密码',
      recoveryQuestionLabel: '找回问题',
      recoveryQuestionPlaceholder: '例如：我的第一座常看晚霞的城市？',
      recoveryAnswerLabel: '找回答案',
      recoveryAnswerPlaceholder: '请记住答案，之后不会明文显示',
      recoveryAnswerResetPlaceholder: '注册时设置的答案',
      recoveryHint: '输入邮箱后会显示找回问题；如果没有显示，也可以直接填写答案尝试重置。',
      newPasswordLabel: '新密码',
      loginAction: '登录',
      createAction: '创建账号',
      resetAction: '重置密码',
      or: '或',
      googleLogin: 'Google 登录',
      loginSuccess: '已登录。',
      registerSuccess: '账号已创建。',
      resetSuccess: '密码已重置，请用新密码登录。',
      requestFailed: '账号请求失败。',
      passwordMismatch: '两次输入的密码不一致。',
      done: '完成。',
      recoveryQuestionFallback: '如果账号存在，请输入找回答案和新密码。',
      recoveryQuestionUnavailable: '找回问题暂时不可用，你仍可尝试填写答案和新密码。'
    },
    menu: {
      buttonAria: '账号',
      dropdownAria: '账号菜单'
    },
    panel: {
      signedOut: '未登录',
      signedOutTitle: '登录后同步你的霞光足迹',
      signedOutSummary: '收藏地点会和后端用户系统保持同步。',
      signedIn: '已登录',
      emptyFavorites: '暂无账号收藏地点。',
      emptyLocalFavorites: '暂无本地收藏地点。',
      dataUnavailable: '账号数据暂时不可用。',
      signInForUploads: '登录后查看你的照片上传记录。',
      signInForApi: '登录后查看账号 API 申请。',
      emptyUploads: '暂无上传照片。',
      logout: '退出登录',
      favoritesTitle: '收藏地点',
      favoritesDesc: '常看的地点可以从这里快速回到预测页。',
      uploadsTitle: '上传记录',
      uploadsDesc: '照片上传、审核状态和公开展示记录会显示在这里。',
      apiTitle: 'API 申请',
      apiDesc: 'Token 申请、审核进度和调用额度会显示在这里。',
      emptyApiApplication: '暂无 API 申请。',
      statusPending: '待处理',
      noEmail: '未填写邮箱',
      apiApplicationFallback: 'API 申请',
      untitledPhoto: '未命名照片',
      userPrefix: '霞客用户',
      connectedSuffix: '已连接',
      accountConnected: '账号已连接',
      typeSunrise: '朝霞',
      typeSunset: '晚霞',
      typePlace: '地点',
      untitledLocation: '未命名地点',
      coordinatesPending: '坐标待补充'
    }
  },

  // Home tabs & methodology
  home: {
    tabs: {
      ariaLabel: '主页分页导航',
      forecast: '预测功能',
      "simulator": "火烧云模拟器",
    methodology: '火烧云计算方法',
      map: '火烧云地图',
      shareMap: '分享地图',
      firecloudMap: '火烧云地图',
      user: '我的',
      apiAccess: 'API接入',
      feedback: '反馈'
    },
    menu: {
      ariaLabel: '页面切换',
      dropdownAriaLabel: '页面切换菜单'
    },
    "simulator": {
      "title": "火烧云模拟器",
      "intro": "用公里距离和米级云高布置云块，拖动日出/日落时间，观察哪些云被照亮、哪些被前方云墙遮挡、哪些因厚云变暗。",
      "mode": {
        "sunrise": "日出",
        "sunset": "日落"
      },
      "solarAngle": "太阳高度角",
      "canvasAria": "火烧云云层横切面画布",
      "axisDistance": "距离 X：0-150 km",
      "axisHeight": "高度 Y：0-12000 m",
      "controlsAria": "剖面模拟控制台",
      "controls": {
        "mode": "模式",
        "time": "模拟时间",
        "axisScale": "坐标轴比例",
        "cloud": "选中云块"
      },
      "axis": {
        "linear": "线性坐标",
        "log": "对数坐标",
        "linearShort": "LINEAR 坐标",
        "logShort": "LOG 坐标"
      },
      "fields": {
        "distance": "距离 km",
        "baseHeight": "云底 m",
        "topHeight": "云顶 m",
        "coverage": "覆盖率 %",
        "width": "宽度 km",
        "opticalDepth": "光学厚度"
      },
      "actions": {
        "addCloud": "添加云块",
        "reset": "重置预设"
      },
      "selectCloudHint": "选择云块查看判定原因",
      "rules": {
        "aria": "模拟规则说明",
        "shadow": "遮挡：只挡阴影带覆盖到的后方云高",
        "scatter": "散射：光带上下有 twilight scatter 宽度",
        "thick": "厚云幕：高覆盖率 + 高光学厚度会吸光变灰",
        "alwaysDark": "全程黑：整段日出/日落采样都未进入暖色照亮"
      },
      "customCloudLabel": "自定义云块 {{index}}",
      "cloudNames": {
        "nearLowWall": "近处低云墙",
        "midAltocumulus": "中距高积云",
        "farCirrus": "远处卷云层",
        "distantThickVeil": "远处厚云幕"
      },
      "time": {
        "atSunrise": "日出时刻",
        "atSunset": "日落时刻",
        "before": "{{mode}}前 {{minutes}} 分钟",
        "after": "{{mode}}后 {{minutes}} 分钟"
      },
      "widthLabel": "宽 {{width}} km",
      "summary": "照亮 {{lit}} 块，遮挡 {{blocking}} 块，阴影 {{shadowed}} 块，变暗 {{dimmed}} 块，全程黑云 {{alwaysDark}} 块",
      "selectedReason": "{{label}}：{{reason}}",
      "status": {
        "lit": "被照亮",
        "dimmed": "变暗",
        "shadowed": "被遮挡",
        "blocking": "遮挡云墙",
        "unlit": "未照亮",
        "alwaysDark": "全程黑云",
        "alwaysDarkShort": "全程黑"
      },
      "reasons": {
        "alwaysDark": "整段窗口都没进入暖色光带",
        "shadowed": "被前方云的阴影带覆盖",
        "blocking": "低角度光穿过时形成遮挡云墙",
        "dimmed": "云幕太厚，吸收后只剩灰紫光",
        "lit": "云高与散射光带相交",
        "unlit": "云高暂未碰到光带"
      }
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
      endpoints: '接口参考',
      endpointsIntro: '以下示例均以 sunshine.bjhyc.online 为基础地址。所有 Agent 接口都需要 Bearer Token 鉴权。',
      forecastDesc: '返回评分、质量等级和最佳观赏窗口。',
      explainDesc: '返回评分构成、关键限制和自然语言解释。',
      geocodeDesc: '返回地点候选、坐标和置信度。',
      mapSummaryDesc: '返回指定区域内达到阈值的地图网格摘要和高分点。',
      showCurl: 'curl 示例',
      showResponse: '响应示例',
      colParam: '参数',
      colType: '类型',
      colRequired: '必填',
      colDesc: '说明',
      required: '是',
      optional: '否',
      fcParamLocation: '地点名称，与 lat+lon 二选一',
      fcParamLat: '纬度（-90 到 90）',
      fcParamLon: '经度（-180 到 180）',
      fcParamType: 'sunrise 或 sunset，默认 sunset',
      fcParamDate: 'today / tomorrow / YYYY-MM-DD，默认 today',
      fcParamDetail: 'simple（默认，仅基本评分）或 full（含天气因子和解释对象）',
      gcParamQ: '搜索关键词，如 "北京"、"San Francisco"',
      gcParamLimit: '返回条数（1-20），默认 5',
      msParamBbox: 'west,south,east,north，不传则汇总全部缓存范围',
      msParamThreshold: '只统计分数 ≥ 该值的点，默认 40',
      msParamLimit: '返回 top 高分点数量（1-50），默认 10',
      applyTitle: '申请 API Token',
      emailLabel: '邮箱',
      emailPlaceholder: 'name@example.com',
      countryRegionLabel: '国家地区',
      countryRegionPlaceholder: '中国大陆 / Hong Kong / US',
      nicknameLabel: '昵称',
      nicknamePlaceholder: '怎么称呼你',
      purposeLabel: '用途',
      purposePlaceholder: '说明使用场景、调用方式和是否公开展示',
      submitApplication: '提交申请',
      submitting: '提交中...',
      submitRequired: '请完整填写邮箱、国家地区、昵称和用途。',
      submitSuccess: '申请已提交，后台审核后会发放 Token。',
      submitFailed: '提交失败，请稍后再试。'
    },
    methodology: {
      title: '火烧云计算方法',
      intro: '当前火烧云指数先判断“有没有可显色载体”，再把太阳方向光路并入受光亮度，最后用空气显色条件修正。高云多、光路通，也可能因为亮度弱而降分。',
      versionLabel: '算法版本：2026.06.13-layer-weighted-brightness-v1',
      versionDesc: '本版使用“Σ(分层载体 × 分层受光亮度) × 空气显色”。受光亮度基于低/中/高三层云、太阳几何、太阳方向通路、直射/散射和云厚证据估算，并采用对数饱和响应：从无光到弱光更敏感，接近满亮后边际变小。',
      changelogTitle: "版本更新记录",
      changelogHint: "近三个月内的算法更新都会放在这里，可滚动回看原因、影响和验证方式",
      changelog: {
        latest: {
          date: '2026-06-13',
          title: '分层求和亮度公式 v1',
          summary: '最终分改为 Σ(分层载体 × 分层受光亮度) × 空气显色；受光亮度采用对数饱和响应，光路继续作为内部因子。',
          validation: '验证：核心评分、网页评分细则、小程序算法页和结果页都显示分层求和口径。'
        },
        grayVeilDirectional: {
          date: '2026-06-06',
          title: '灰幕空气显色 + 方向中云带 v2',
          summary: '满铺中高云叠加 PM/AOD 偏高时，不再默认当暖色散射加分，而是按灰幕压力连续降低空气显色；太阳方向中云带改为连续载体，光路越开、方向中云越强，越接近 50-60 档。',
          validation: '验证：2026-06-03 北京暖散射保持 70 档；2026-06-04 北京方向中云带约 53.5；2026-06-05 北京满铺灰幕压到约 44；真实校准样本库全量回放通过。'
        },
        scoringV2: {
          date: '2026-06-03',
          title: '日落评分 v2',
          summary: '最终分改为云载体、日落光路、空气显色三部分合成；光路开且能见度可接受时，轻/中度 AOD、PM、dust 作为橙红散射正向因素，而不是一律当灰幕。',
          validation: '验证：2026-06-02 北京无雨灰幕仍约 30；2026-06-03 北京无雨、橙红光很美，单点回放约 71，进入 70 档；火烧云地图仍走区域简化分支。'
        },
        cloudThickness: {
          date: '2026-05-27',
          title: '云厚比例折损 v2',
          summary: '云厚扣分改为画布修正前分 × 30% × 云厚压力，去掉固定 -28/24 上限；湿灰幕场景同步按小烧/可看但不强校准。',
          validation: '验证：2026-05-27 北京样本云厚压力 0.78，画布 76.7 时扣分约 -18；最终保留在小烧/可顺带看区间。'
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
          desc: '后端先把中高云当成“可被染色的画布”，低云主要作为遮挡项。总云量只做兜底，真正进入画布的是分层云量。',
          highCloud: '高云：权重 0.75，是最重要的红橙色载体；高云>50%且低云<30%时，只额外加 0–6 分，不再乘 1.2',
          midCloud: '中云：权重 0.45，也是可染色载体；高云与中云同时存在时会提高画布稳定性',
          lowCloudBonus: '低云：权重只有 0.10，主要进入低云惩罚和光路遮挡；低云少不加分，只是不扣分',
          formula: '中高云画布量 = 高云×0.75 + 中云×0.45\n画布基础分：≤10→10，10–30→40–70，30–70→70–100，70–100→70–50，>100→43\n画布分 = 区间分 × 低云惩罚 × 阴天惩罚 + 高云 bonus + 云种修正 + 云厚修正',
          highCloudBonus: '高云 bonus：高云>50 且低云<30 时，按 (高云-50)/50×6 加 0–6 分。云种/云厚是加减分：高层云 +4、高积云 +6、薄云 +5；偏厚/厚云按当前画布比例连续扣分，公式为 画布修正前分×30%×云厚压力。若中云/总云量很高、高云载体弱、direct/shortwave 极低且灰空气明显，会加入低太阳透射证据。低云类云种还会压低光路门控'
        },
        lightPath: {
          title: '2. 光路评估',
          subtitle: 'Light Path · 光路评分',
          desc: '光路分回答一个问题：日出/日落方向的阳光能不能照到可显色云层。已有太阳方向多点采样会参与判断，不新增 API 请求。',
          lowCloudEffect: '采样距离为 10 / 25 / 50 / 75 / 100km，按 0.25 / 0.30 / 0.25 / 0.14 / 0.06 加权；每个点走同一套太阳高度、云底高度和低/中/高云遮挡估算',
          visibility: '太阳方向走廊按整体低/中云阻挡判断；25/50km 权重最高，10km 作为近距样本参与加权，但不单独加分或扣死',
          formula: '遮挡概率 = 1 - Π(1 - 加权block)\n光路分 = 100×(1-遮挡概率)×低云权重修正×太阳方向走廊修正'
        },
        transparency: {
          title: '3. 大气透明度',
          subtitle: 'Transparency · 渲染评分',
          desc: '能见度、湿度、降水后状态和空气颗粒只影响“显色质量”。有光路且云幕不灰时，适度颗粒可增强橙红散射；中高云满铺且 PM/AOD 偏高时，会转为灰幕显色抑制。',
          visibility: '渲染因子会综合 visibilityFactor、humidityFactor、rainBonus、aqiFactor、aerosolFactor',
          humidity: '渲染修正不是乘爆分数：factor≥1 时转成最多约 +9 分；factor<1 时最多约 -25 分',
          formula: '空气显色 = 灰幕压力优先 ? 0.70–0.95 : 光路开 ? 暖色散射系数 1.02–1.12 : 原渲染系数'
        },
        layerDiversity: {
          title: '4. 光路门控',
          subtitle: 'Light Gate · 载体能发挥多少',
          desc: '光路分不会再按 20% 权重简单相加，而是变成门控系数，直接决定载体分能保留多少。',
          threeLayer: '光路≥85：门控 1.00–1.08；特别通畅时才小幅放大',
          twoLayer: '光路70–85：门控 0.88–1.00；光路50–70：门控 0.65–0.88',
          oneLayer: '光路<50：门控 0.25–0.65；太阳方向阻挡走廊会进一步压到约 0.42'
        },
        lowCloudPenalty: {
          title: '5. 低云惩罚系数',
          subtitle: 'Low Cloud Penalty · Multiplier',
          desc: '低云是少数仍然用乘法处理的项，因为它不是“好条件”，而是会遮住画布和光路的坏条件。',
          level1: '低云<20% → ×1.0（不扣分）',
          level2: '低云20–80% → 从 ×1.0 线性降到 ×0.1',
          level3: '低云≥55% → 触发阴天/低云主导额外抑制，overcastPenalty 最低约 ×0.2',
          level4: '总云量≥92 且低云≥20% → 轻惩罚到约 ×0.75；天气文案明确阴天且低云≥35% → 再 ×0.5'
        },
        thickHighCloudPenalty: {
          title: '7. 受光亮度',
          subtitle: 'Layer Brightness · 云层是否真的亮',
          desc: '载体和光路之外，系统会估算中高云实际受光强度。现在是基于低/中/高三层云的亮度模型，不是 4km/9km/13km 每个高度层单独计算。',
          level1: '亮度 = 云层画布 × 太阳几何 × 光路开放度 × 空气透过率 × 云厚因子 × 直射/散射因子',
          level2: 'AOD、水汽、PM10、低能见度、漫射光占优、厚高云和高云水汽灰幕是压暗证据；亮度弱时按 0-1 乘性系数压分',
          level3: '高云很多但亮度弱时，不再因为“载体多 + 光路通”直接给高分；北京 2026-06-12 晚霞就是这类校准样本',
          formula: 'layerBrightness = 三层云载体 × 光路 × 受光/云厚/光束证据\n亮度弱时会限制最终展示分'
        },
        precipPenalty: {
          title: '6. 降水惩罚系数',
          subtitle: 'Precipitation Penalty · Multiplier',
          desc: '降水现在主要作为光路封顶、气溶胶载体禁用和显色修正的一部分，而不是再把最终分简单连乘。',
          level1: '降水≤0.2mm/h：不禁用云层载体；雨后清透可能给渲染加成',
          level2: '降水>0.2mm/h：气溶胶弱载体不可见，不参与兜底',
          level3: '降水>1mm/h 或天气码为雨雪，且低云>40%：光路分封顶 50',
          level4: '降水叠加低云/灰幕时，最终状态通常会被压到低概率或轻微霞光',
          formula: '降水影响 = 光路封顶 + 弱载体禁用 + 渲染因子修正，而不是最终分连乘'
        },
        finalFormula: {
          title: '8. 最终分数',
          subtitle: 'Final Score · Σ(分层载体 × 分层受光亮度) × 空气显色',
          desc: '最终分不为单个城市或日期加特殊抬分，而是让云、光路、亮度和空气共同解释分数。光路打开时，适度颗粒可让橙红更明显；但如果云层实际亮度弱，同样会被保守压分。',
          formula: '最终分 = clamp(Σ(分层载体 × 分层受光亮度) × 空气显色, 0, 100)，再经过硬否决/厚云/灰幕校准',
          highCloudCap: '高云充足但光路被挡时，会先体现在受光亮度变弱。',
          carrier: '载体分 = max(云层画布分, 气溶胶弱载体分)',
          lightGate: '光路不再单独参与最终乘法，而是作为受光亮度里的太阳方向通路因子',
          rendering: '受光亮度会先判断云是否真的亮；空气显色 = 0.70–1.12，光路开且云幕不灰时轻/中度 AOD、PM、dust 可加暖色，满铺灰幕则连续压低',
          statusCaps: '显示分还会按状态校准：无火烧云低于 40，轻微霞光低于 60；几何不可行、厚云、灰幕和雨低云会进一步封顶'
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

  feedback: {
    kicker: 'Prediction Feedback',
    title: '反馈预测结果',
    subtitle: '提交漏报、误报或虚报，系统会保存预测快照、天气原始数据、评分、地点和图片，方便后台复盘。',
    button: '反馈', closeAria: '关闭反馈窗口', typeLabel: '反馈类型',
    missed: '漏报：实际很好但评分偏低', wrong: '误报：实际不好但评分偏高', overstated: '虚报：有颜色但不值得冲',
    missedShort: '漏报', wrongShort: '误报', overstatedShort: '虚报',
    missedHint: '实际很好，但预测分数偏低。', wrongHint: '实际不好，但预测分数偏高。', overstatedHint: '有颜色但效果弱，不值得按高分推荐。',
    commentLabel: '评论', commentPlaceholder: '描述现场看到的云量、颜色、遮挡和时间', nicknameLabel: '昵称', emailLabel: '邮箱', photoLabel: '图片（最多 2 张）',
    submit: '提交反馈', cancel: '取消', loginRequired: '请先登录后再反馈。', loginAction: '登录',
    dateLabel: '日期', locationLabel: '地点名称', locationPlaceholder: '北京景山', latLabel: '纬度', lonLabel: '经度', periodLabel: '类型', sunrise: '朝霞', sunset: '晚霞',
    manualHelp: '提交后会尝试抓取对应日期地点的预测快照；超出可抓取范围会提示不可反馈。', openWindowHint: '反馈只在日出/日落前 1 小时到事件后 45 分钟内开放。', windowClosed: '反馈暂未开放。反馈只在日出/日落前 1 小时到事件后 45 分钟内开放。',
    fetchSnapshot: '正在抓取预测数据...', rangeExpired: '已经超出可反馈的日期范围。', submitting: '正在提交反馈...', submitFailed: '反馈提交失败', success: '反馈已提交，感谢你帮我们校准预测。', tooManyPhotos: '最多上传 2 张图片。'
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
    threeDayGlowReferenceNote: '超过一天后的概率可能不准，仅供参考。',
    mapView: '地图预测',
    daysOverview: '{{days}}天概览',
    precipChance: '{{prob}}%降水',
    unavailable: {
      title: '天气预测暂时不可用',
      body: '请稍后再来。',
      inline: '天气数据暂时不可用，火烧云地图仍可正常使用。',
    },
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
      baseFormula: '基础分 = Σ(分层载体 × 分层受光亮度)',
      baseHint: '太阳方向光路已并入受光亮度后的载体基础分',
      canvasHint: '高云/中云提供主要色彩载体，适度薄雾可提供弱载体；低云遮挡、厚高云和灰幕会限制可用亮度',
      lightPathHint: '太阳光是否能照到云层',
      finalFormula: '最终分 = Σ(分层载体 × 分层受光亮度) × 空气显色',
      renderingHint: '受光亮度、湿度、能见度和颗粒物共同影响色彩表现',
      aerosolHint: '适度气溶胶增强橙红散射，过多则发灰',
      ledger: {
        pts: '分',
        whyThisScore: '为什么是这个分数',
        weightedFormula: '{{canvas}}×80% + {{light}}×20% = {{base}}',
        gatedFormula: 'Σ(分层载体 × 分层受光亮度) = {{base}}',
        layerSumFormula: 'Σ(分层载体 × 分层受光亮度) = {{base}}',
        canvasPlusLightPath: 'Σ(分层载体 × 分层受光亮度)',
        renderingFormula: '{{base}} 经显色修正 = {{rendered}}',
        renderingMultiplierFormula: '{{base}} × 空气显色系数 {{factor}} = {{rendered}}',
        renderingAdjustmentFormula: '{{base}} {{sign}} 显色修正 {{adjustment}} = {{rendered}}',
        weatherTransparency: '天气通透度',
        summary: {
          event: '{{score}} 分：主要调整是 {{detail}}',
          rendered: '{{base}} 分经显色条件修正为 {{rendered}} 分',
          default: '{{score}} 分：由分层载体、分层受光亮度和空气显色计算'
        },
        weather: {
          clouds: '高/中/低云 {{high}}/{{mid}}/{{low}}%',
          visibility: '能见度 {{value}}km',
          humidity: '湿度 {{value}}%',
          rain: '降水 {{value}}mm/h'
        },
        labels: {
          cloudCarrier: '云层载体',
          lightPath: '光路证据',
          layerBrightness: '分层受光亮度',
          baseScore: '基础分',
          rendering: '空气显色',
          final: '最终分',
          hardCap: '天气限制',
          hazeCap: '灰幕影响',
          thickCloudCap: '厚云影响',
          cloudThicknessModifier: '云层厚度影响',
          geometryCap: '太阳角度',
          occlusion: '遮挡修正',
          carrierFloor: '载体保护',
          postRainCap: '湿灰幕',
          displayCalibration: '展示分校准',
          aerosolCarrier: '气溶胶载体',
          scoringV2: '开口暖色散射',
          grayVeilAirRendering: '灰幕显色抑制',
          evidence: '计算依据'
        },
        details: {
          cloudCarrier: '可被染色的云面或薄雾载体',
          cloudPenalty: '云画布 {{canvas}}，低云 ×{{low}}，阴天 ×{{overcast}}',
          upperCloudCanvas: '中高云画布 {{upper}} = 高云 {{high}}×0.75 + 中云 {{mid}}×0.45；区间分 {{range}}',
          highCloudBonus: '高云主导 bonus {{bonus}}',
          cloudTypeAdjustment: '云种 {{reason}} {{bonus}}',
          cloudThicknessAdjustment: '云厚 {{thickness}}，画布 {{base}} × 30% × 压力 {{pressure}}，最大折损 {{max}}；散射 {{diffuse}}%，水汽 {{water}}，载体缓冲 {{relief}}，低太阳透射 {{solar}}',
          lowSolarTransmissionYes: '命中',
          lowSolarTransmissionNo: '未命中',
          aerosolCarrier: '云层很少时，薄雾在光路通畅时可承接一点暖色，光路激活 ×{{activation}}',
          scoringV2: '云载体 {{carrier}}；光路证据已并入分层受光亮度；空气显色 {{air}}',
          grayVeilAirRendering: '满铺中高云叠加偏脏空气：云载体 {{carrier}}；光路证据作为亮度证据；灰幕显色 {{air}}',
          lightPath: '作为受光亮度解释的太阳方向证据',
          layerBrightnessShort: '太阳方向、遮挡和亮度响应共同解释各层载体是否被照亮',
          layerBrightness: '亮度 {{brightness}}，门控 {{gate}}；分层载体 {{canvas}}，低云遮挡 {{low}} / 透过 {{lowBlock}}，太阳几何 {{solar}}，光路因子 {{path}}，空气 {{air}}，云厚 {{thickness}}，直射/散射 {{beam}}',
          renderingFactors: '能见度 ×{{visibility}}，湿度 ×{{humidity}}，气溶胶 ×{{aerosol}}',
          afterAdjustments: '结合天气和能见度后',
          finalDisplayed: '最终展示结果',
          thickCloudCap: '厚云幕或灰幕会削弱真实可染色效果',
          cloudThicknessModifier: '云厚证据并不充分，当前按连续修正温和压分',
          geometryCap: '太阳与云层几何条件不足',
          occlusion: '远端遮挡压低最终分',
          carrierFloor: '高云载体清透，避免被云厚信号误伤低估',
          directionalSamples: '已参考太阳方向周边云况',
          lightPathScoreEvidence: '光路证据 {{light}} 已并入受光亮度',
          lightPathLowCloudBlock: '低云遮住太阳方向，光线不容易照到中高云',
          lightPathRain: '降水会削弱日落直射光',
          postRainCap: '水汽、颗粒物或直达光偏弱，霞光容易发灰',
          displayCalibration: '最终展示分按预测状态档位校准',
          positiveAdjustment: '有利条件修正',
          limitingAdjustment: '限制条件修正'
        },
        reasons: {
          precipitationCap45: '降水叠加低云，观赏条件明显变差',
          overcastCap35: '低云遮住太阳方向，光线不容易照到云层',
          overcastLowVisibilityCap35: '总云量很高叠加低能见度，先保守压低评分',
          overcastFogCap15: '总云量很高叠加低能见度，天空容易发灰',
          rainyMidCloudOvercastCap35: '雨后水汽偏重，霞光不容易显色',
          noVisibleSunsetPathCap5: '日落光线很难照到云层',
          noVisibleSunsetPathCap15: '雨后灰幕偏重，日落光线大概率被挡住',
          extremeDustHazeCap28: '强沙尘或灰幕会压住霞光',
          severeHazeCap35: '重度灰霾让颜色不容易出来',
          moderateHazeCap45: '灰霾会削弱红橙色',
          hazeWarmScatteringPathOpen: '日落光路打开，适度颗粒增强橙红散射',
          fullUpperCloudGrayVeilAirRendering: '满铺中高云叠加偏脏空气，显色转为灰幕抑制',
          denseCarrierCanvasOnly: '中高云层仍能承接晚霞光线',
          adjustmentApplied: '已按限制条件修正',
          displayCalibration: '最终展示分按预测状态档位校准',
          lightPathStatusCap60: '光路约 {{light}}，更像轻微霞光机会',
          canvasStatusCap40: '云层载体约 {{canvas}}，火烧云机会偏弱'
        }
      }},
formationAnalysis: {
      title: '火烧云文字分析',
      groups: { positive: '有利条件', neutral: '一般因素', warning: '注意因素' },
      factors: {
        carrier: {
          title: '云层载体',
          status: { good: '较好', fair: '一般', weak: '较弱' },
          desc: {
            good: '中高云提供可染色云面，具备承接霞光的基础。',
            fair: '有可染色云面，但面积、高度或稳定性不够理想。',
            weak: '可染色云面不足，难形成成片火烧云。'
          }
        },
        lightPath: {
          title: '光路条件',
          status: { good: '较好', fair: '一般', weak: '较弱' },
          desc: {
            good: '太阳方向相对通透，光线有机会照到云底。',
            fair: '太阳方向有一定遮挡，晚霞可能只出现在局部。',
            weak: '低云或阻挡走廊挡住光路，光线不容易打到云层。'
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
        wall: '太阳方向有阻挡走廊', wallDesc: '太阳方位周边低/中云整体偏厚，光路门控会压低主评分',
        lowCloudBlock: '低云遮住光线', lowCloudBlockDesc: '低云挡在太阳方向，阳光不容易照到中高云'
      },
      postRain: {
        clear: '雨后空气清透', clearDesc: '近6小时有降水，但能见度和颗粒物条件较好，雨后加成保留',
        gray: '湿灰幕风险', grayDesc: '水汽、颗粒物或直达光偏弱时，霞光容易发灰'
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
      title: '高云载体保护',
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
    radarSubtitle: '25km · 连续云场',
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
    layerLoading: '正在读取火烧云图层...',
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

  admin: {
    globalSwitches: {
      title: '????',
      siteClosed: {
        label: '关闭站点',
        status: '已关闭'
      },
      weatherPredictionClosed: {
        label: '关闭天气预测',
        status: '已关闭'
      }
    }
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
