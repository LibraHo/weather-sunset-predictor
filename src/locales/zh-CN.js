/**
 * 简体中文翻译
 */
export default {
  // 应用
  app: {
    title: '霞客',
    subtitle: '预测火烧云出现的最佳时机'
  },

  // Home tabs & methodology
  home: {
    tabs: {
      ariaLabel: '主页分页导航',
      forecast: '预测功能',
      methodology: '火烧云计算方法'
    },
    menu: {
      ariaLabel: '页面切换',
      dropdownAriaLabel: '页面切换菜单'
    },
    methodology: {
      title: '火烧云计算方法',
      intro: '火烧云指数由四个关键因子综合计算，帮助你快速判断当天是否值得蹲守晚霞。',
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
      scoreExcellent: '优秀：>70（推荐出门）',
      scoreGood: '良好：40-70（可观赏）',
      scoreFair: '一般：<40（谨慎期待）'
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
    clouds: '云量',
    cloudCover: '云量',
    precipitation: '降水',
    highClouds: '高云',
    midClouds: '中云',
    lowClouds: '低云',
    feeling: '体感',
    uvIndex: '紫外线指数',

    // 天气描述
    overcast: '阴天',
    cloudy: '多云',
    partlyCloudy: '少云',
    clear: '晴天',

    // 天气概览
    overview: '概览',
    hourly: '详细预报',
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

    // 光路评分
    lightPath: {
      title: '光路评分',
      score: '光路得分',
      visibility: '能见度',
      lightPathScore: '🌅 光路: {{score}}分 (150km:{{near}} 300km:{{far}})'
    },

    // 渲染评分
    rendering: {
      title: '渲染评分',
      score: '渲染得分',
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
      postRainMode: '🌟 雨后初晴模式（超级加倍）'
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
      highProbability: '✨ 有较大概率出现壮观的火烧云景象',
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

  // 任务19：周边火烧云
  surrounding: {
    title: '周边火烧云分析',
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
    hint: '💡 提示：启用覆盖层后，地图上将显示火烧云预测的地理分布热力图',
    loading: '正在生成覆盖层...',
    active: '覆盖层已显示',
    error: '覆盖层生成失败',
    notAvailable: '覆盖层功能不可用（需要先获取周边数据）'
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
    dataSource: '数据来源：Windy API',
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
    timeHint: '💡 提示：也可以使用地图下方的预测时间轴拖动时间',
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
