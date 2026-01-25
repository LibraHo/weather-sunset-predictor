/**
 * 简体中文翻译
 */
export default {
  // 应用
  app: {
    title: '天气晚霞预测器',
    subtitle: '预测火烧云出现的最佳时机'
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
    changeLanguage: '切换语言'
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
    forecast: '预报',
    temperature: '温度',
    humidity: '湿度',
    windSpeed: '风速',
    windDirection: '风向',
    pressure: '气压',
    visibility: '能见度',
    clouds: '云量',
    precipitation: '降水',
    highClouds: '高云',
    midClouds: '中云',
    lowClouds: '低云',
    feeling: '体感',
    uvIndex: '紫外线指数'
  },

  // 预测
  prediction: {
    title: '晚霞预测',
    sunrise: '朝霞',
    sunset: '晚霞',
    score: '预测评分',
    quality: '质量等级',
    bestTime: '最佳观赏时间',
    analysis: '分析',
    details: '详情',

    // 质量等级
    excellent: '优秀',
    good: '良好',
    fair: '一般',
    poor: '较差',

    // 状态描述
    status: {
      noFireCloud: '无火烧云',
      highProbability: '大概率出现漂亮晚霞',
      moderateProbability: '可能出现晚霞',
      lowProbability: '不太可能出现晚霞'
    },

    // 时间段
    goldenHour: '黄金时段',
    blueHour: '蓝调时段',
    sunriseTime: '日出时间',
    sunsetTime: '日落时间',

    // 画布评分
    canvas: {
      title: '画布评分',
      score: '画布得分',
      cloudLevel: '云层等级',
      breakdown: '云层分布'
    },

    // 光路评分
    lightPath: {
      title: '光路评分',
      score: '光路得分',
      visibility: '能见度'
    },

    // 渲染评分
    rendering: {
      title: '渲染评分',
      score: '渲染得分',
      humidity: '湿度影响'
    },

    // 综合评分
    composite: {
      title: '综合评分',
      finalScore: '最终得分',
      confidence: '预测可信度'
    },

    // 云层分析
    cloudLayers: {
      title: '云层分析',
      high: '高云（>6km）',
      mid: '中云（2-6km）',
      low: '低云（<2km）',
      favorable: '有利',
      unfavorable: '不利'
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
    }
  },

  // 时间
  time: {
    today: '今天',
    tomorrow: '明天',
    yesterday: '昨天',
    week: '周',
    date: '日期',
    time: '时间'
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
    locationError: '位置解析失败，请尝试其他位置名称'
  },

  // 设置
  settings: {
    title: '设置',
    apiKey: 'API密钥',
    apiKeyLabel: 'Windy API密钥',
    apiKeyPlaceholder: '请输入您的Windy API密钥',
    apiKeyHelp: '在 https://www.windy.com 注册获取API密钥',
    language: '语言',
    languageLabel: '界面语言',
    notifications: '通知',
    notificationsLabel: '晚霞预测通知',
    notificationsHelp: '当预测质量高于设定值时发送通知',
    notificationThreshold: '通知阈值',
    favoriteLocations: '收藏位置',
    searchHistory: '搜索历史',
    clearHistory: '清除历史',
    confirmClearHistory: '确定要清除所有搜索历史吗？'
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
    add: '添加到收藏',
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
    parameters: '参数'
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
