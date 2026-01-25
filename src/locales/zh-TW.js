/**
 * 繁體中文翻譯
 */
export default {
  // 應用
  app: {
    title: '天氣晚霞預測器',
    subtitle: '預測火燒雲出現的最佳時機'
  },

  // 按鈕
  buttons: {
    search: '查詢',
    refresh: '重新整理',
    save: '儲存',
    cancel: '取消',
    confirm: '確認',
    close: '關閉',
    clear: '清除',
    delete: '刪除',
    edit: '編輯',
    useCurrentLocation: '使用目前位置',
    changeLanguage: '切換語言'
  },

  // 位置
  location: {
    label: '位置',
    placeholder: '請輸入城市名稱...',
    current: '目前位置',
    searching: '正在搜尋位置...',
    notFound: '找不到該位置，請嘗試其他名稱',
    permissionDenied: '無法取得位置權限，請手動輸入位置',
    loading: '正在取得位置...'
  },

  // 天氣
  weather: {
    title: '天氣資訊',
    current: '目前天氣',
    forecast: '預報',
    temperature: '溫度',
    humidity: '濕度',
    windSpeed: '風速',
    windDirection: '風向',
    pressure: '氣壓',
    visibility: '能見度',
    clouds: '雲量',
    precipitation: '降水',
    highClouds: '高雲',
    midClouds: '中雲',
    lowClouds: '低雲',
    feeling: '體感',
    uvIndex: '紫外線指數'
  },

  // 預測
  prediction: {
    title: '晚霞預測',
    sunrise: '朝霞',
    sunset: '晚霞',
    score: '預測評分',
    quality: '品質等級',
    bestTime: '最佳觀賞時間',
    analysis: '分析',
    details: '詳情',

    // 品質等級
    excellent: '優秀',
    good: '良好',
    fair: '一般',
    poor: '較差',

    // 狀態描述
    status: {
      noFireCloud: '無火燒雲',
      highProbability: '大概率出現漂亮晚霞',
      moderateProbability: '可能出現晚霞',
      lowProbability: '不太可能出現晚霞'
    },

    // 時間段
    goldenHour: '黃金時段',
    blueHour: '藍調時段',
    sunriseTime: '日出時間',
    sunsetTime: '日落時間',

    // 畫布評分
    canvas: {
      title: '畫布評分',
      score: '畫布得分',
      cloudLevel: '雲層等級',
      breakdown: '雲層分佈'
    },

    // 光路評分
    lightPath: {
      title: '光路評分',
      score: '光路得分',
      visibility: '能見度'
    },

    // 渲染評分
    rendering: {
      title: '渲染評分',
      score: '渲染得分',
      humidity: '濕度影響'
    },

    // 綜合評分
    composite: {
      title: '綜合評分',
      finalScore: '最終得分',
      confidence: '預測可信度'
    },

    // 雲層分析
    cloudLayers: {
      title: '雲層分析',
      high: '高雲（>6km）',
      mid: '中雲（2-6km）',
      low: '低雲（<2km）',
      favorable: '有利',
      unfavorable: '不利'
    },

    // 描述
    descriptions: {
      skyClear: '萬里無雲，缺少"畫布"反射光線',
      cloudPerfect: '雲層適中，有利於形成漂亮晚霞',
      lowCloudHeavy: '低雲過多，可能遮擋晚霞',
      highHumidity: '濕度過高，可能影響能見度',
      lowHumidity: '濕度過低，雲層可能過薄',
      goodVisibility: '能見度極佳，觀賞條件良好',
      poorVisibility: '能見度較差，可能影響觀賞效果'
    }
  },

  // 時間
  time: {
    today: '今天',
    tomorrow: '明天',
    yesterday: '昨天',
    week: '週',
    date: '日期',
    time: '時間'
  },

  // 錯誤訊息
  errors: {
    title: '錯誤',
    networkError: '網路連線錯誤，請檢查網路設定',
    apiError: 'API呼叫失敗，請稍後重試',
    apiKeyMissing: '請先配置Windy API金鑰',
    apiKeyInvalid: 'API金鑰無效，請檢查配置',
    timeout: '請求逾時，請重試',
    unknownError: '發生未知錯誤，請重試',
    locationError: '位置解析失敗，請嘗試其他位置名稱'
  },

  // 設定
  settings: {
    title: '設定',
    apiKey: 'API金鑰',
    apiKeyLabel: 'Windy API金鑰',
    apiKeyPlaceholder: '請輸入您的Windy API金鑰',
    apiKeyHelp: '在 https://www.windy.com 註冊取得API金鑰',
    language: '語言',
    languageLabel: '介面語言',
    notifications: '通知',
    notificationsLabel: '晚霞預測通知',
    notificationsHelp: '當預測品質高於設定值時發送通知',
    notificationThreshold: '通知閾值',
    favoriteLocations: '收藏位置',
    searchHistory: '搜尋歷史',
    clearHistory: '清除歷史',
    confirmClearHistory: '確定要清除所有搜尋歷史嗎？'
  },

  // 語言選擇
  languageSelector: {
    title: '選擇語言',
    confirmChange: '確認切換語言',
    confirmChangeMessage: '切換語言後介面將重新整理，目前資料不會遺失。是否繼續？',
    selectLanguage: '請選擇介面語言'
  },

  // 通知
  notifications: {
    title: '晚霞預測提醒',
    excellentForecast: '今晚的晚霞預測評分：{{score}}分，非常適合觀賞！',
    goodForecast: '今晚的晚霞預測評分：{{score}}分，值得期待！',
    time: '時間：{{time}}',
    location: '位置：{{location}}',
    enable: '啟用通知',
    disable: '停用通知',
    permissionDenied: '通知權限被拒絕，請在瀏覽器設定中允許通知',
    permissionGranted: '通知權限已授予',
    threshold: '當評分高於 {{threshold}} 分時通知'
  },

  // 收藏位置
  favorites: {
    title: '收藏位置',
    add: '加入到收藏',
    remove: '取消收藏',
    removeConfirm: '確定要移除這個收藏位置嗎？',
    empty: '暫無收藏位置',
    manage: '管理收藏'
  },

  // 搜尋歷史
  history: {
    title: '搜尋歷史',
    empty: '暫無搜尋歷史',
    clearAll: '清除全部',
    clearConfirm: '確定要清除所有搜尋歷史嗎？'
  },

  // 天氣圖表
  charts: {
    temperature: '溫度',
    precipitation: '降水',
    humidity: '濕度',
    wind: '風速',
    pressure: '氣壓',
    clouds: '雲量',
    hourly: '24小時預報',
    daily: '7天預報',
    overview: '概覽',
    details: '詳細',
    parameters: '參數'
  },

  // 載入狀態
  loading: {
    data: '正在載入資料...',
    weather: '正在取得天氣資料...',
    prediction: '正在計算預測...',
    pleaseWait: '請稍候...'
  },

  // 其他
  other: {
    copyright: '© 2026 天氣晚霞預測器',
    poweredBy: 'Powered by Windy',
    version: '版本',
    about: '關於',
    privacy: '隱私權政策',
    terms: '使用條款',
    contact: '聯絡我們',
    feedback: '回饋'
  }
};
