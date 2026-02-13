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
    currentLocation: '目前位置',
    noData: '沒有可用的天氣資料',
    forecast: '預報',
    temperature: '溫度',
    humidity: '濕度',
    windSpeed: '風速',
    windDirection: '風向',
    pressure: '氣壓',
    visibility: '能見度',
    clouds: '雲量',
    cloudCover: '雲量',
    precipitation: '降水',
    highClouds: '高雲',
    midClouds: '中雲',
    lowClouds: '低雲',
    feeling: '體感',
    uvIndex: '紫外線指數',

    // 天氣描述
    overcast: '陰天',
    cloudy: '多雲',
    partlyCloudy: '少雲',
    clear: '晴天',

    // 天氣概覽
    overview: '概覽',
    hourly: '詳細預報',
    daysOverview: '{{days}}天概覽',
    precipChance: '{{prob}}%降水',
    dataInfo: 'ℹ️ 資料來源提供 {{hours}} 小時預測資料（約 {{days}} 天）。若需要更多天數，請考慮使用其他天氣資料來源。'
  },

  // 預測
  prediction: {
    title: '晚霞預測',
    sunrise: '朝霞',
    sunset: '晚霞',
    sunriseAndSunset: '朝晚霞預測',
    score: '預測評分',
    points: '分',
    quality: '品質等級',
    bestTime: '最佳觀賞時間',
    analysis: '分析',
    analysisTitle: '📊 分析原因',
    details: '詳情',
    detailedWeatherData: '詳細氣象資料',
    noPredictionData: '⚠️ 暫無{{date}}預測資料',
    insufficientData: '天氣資料不足，無法產生預測。請稍後重新整理資料。',
    viewFutureOrRefresh: '請查看未來預測或稍後重新整理資料',
    predictionUnavailable: '⚠️ 天氣資料不足',

    // 品質等級
    excellent: '優秀',
    good: '良好',
    fair: '一般',
    poor: '較差',

    // 狀態描述
    status: {
      noFireCloud: '無火燒雲',
      lightGlow: '輕微晚霞',
      goodGlow: '有晚霞',
      highProbability: '大概率出現漂亮晚霞',
      moderateProbability: '可能出現晚霞',
      lowProbability: '不太可能出現晚霞',
      skyClear: '萬里無雲，缺少"畫布"反射光線',
      cloudPerfect: '雲層適中，有利於形成漂亮晚霞',
      cloudTooThick: '雲層過厚，陽光無法穿透',
      cloudUnsuitable: '雲況不適宜形成火燒雲',
      waitForClouds: '建議等待雲量適中的天氣',
      lightPathBlocked: '西方有雲遮擋，光線難以到達',
      lightPathObstructed: '光路被阻擋',
      poorViewing: '觀賞效果不佳',
      conditionsFair: '條件一般，可能零星色彩',
      canWatch: '可以觀賞',
      conditionsGood: '條件尚可，有一定觀賞價值',
      veryLikely: '大概率出現漂亮晚霞',
      excellentConditions: '雲量適中，光路通暢',
      legendaryEruption: '傳說級爆發',
      perfectMidHighClouds: '完美的中高雲層，光路清晰',
      highlyRecommended: '強烈推薦觀賞！'
    },

    // 時間段
    goldenHour: '🌟 黃金時段',
    blueHour: '🌌 藍調時段',
    sunAzimuth: '🧭 太陽方位',
    sunriseTime: '日出時間',
    sunsetTime: '日落時間',
    bestViewingTime: '最佳觀賞時間',

    // 最佳觀看視窗描述
    bestViewingWindowSunrise: '日出前後30分鐘是觀看朝霞的最佳時間',
    bestViewingWindowSunset: '日落前後30分鐘是觀看晚霞的最佳時間',

    // 畫布評分
    canvas: {
      title: '畫布評分',
      score: '畫布得分',
      cloudLevel: '雲層等級',
      breakdown: '雲層分佈',
      canvasScore: '📊 畫布: {{score}}分 | {{level}}',
      cloudBreakdown: '高雲{{high}}% 中雲{{mid}}% 低雲{{low}}%',
      lowCloudPenalty: '| 低雲懲罰: {{reason}}'
    },

    // 光路評分
    lightPath: {
      title: '光路評分',
      score: '光路得分',
      visibility: '能見度',
      lightPathScore: '🌅 光路: {{score}}分 (150km:{{near}} 300km:{{far}})'
    },

    // 渲染評分
    rendering: {
      title: '渲染評分',
      score: '渲染得分',
      humidity: '濕度影響',
      renderingFactor: '🎨 渲染係數: {{factor}} | {{visibility}} | {{aqi}} | {{color}}',
      specialMode: '| {{mode}}'
    },

    // 綜合評分
    composite: {
      title: '綜合評分',
      finalScore: '最終得分',
      confidence: '預測可信度'
    },

    // 雲層分析
    cloudLayers: {
      title: '☁️ 雲層分層資訊',
      highCloudLabel: '⛅ 高雲 (>6km)',
      midCloudLabel: '☁️ 中雲 (2-6km)',
      lowCloudLabel: '🌫️ 低雲 (<2km)',
      high: '高雲（>6km）',
      mid: '中雲（2-6km）',
      low: '低雲（<2km）',
      favorable: '有利',
      unfavorable: '不利',
      cloudAnalysis: '雲層分析：',
      description: '高雲{{high}}% 中雲{{mid}}% 低雲{{low}}%'
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
    },

    // 火燒雲分析
    fireCloud: {
      title: '🔥 火燒雲指數：{{score}}/100{{level}}',
      excellent: '（極佳）',
      good: '（良好）',
      fair: '（一般）',
      poor: '（較差）',
      analysisTitle: '🔥 火燒雲形成條件分析：',
      idealCloud: '✅ 雲量理想（{{value}}%），能充分反射陽光',
      slightlyLowCloud: '⚠️ 雲量略少（{{value}}%），火燒雲效果可能偏淡',
      tooMuchCloud: '⚠️ 雲量過多（{{value}}%），可能遮擋陽光',
      severelyLowCloud: '❌ 雲量嚴重不足（{{value}}%），無法形成火燒雲',
      idealHumidity: '✅ 濕度適中（{{value}}%），利於光線散射',
      slightlyLowHumidity: '⚠️ 濕度略低（{{value}}%），色彩可能不夠鮮豔',
      slightlyHighHumidity: '⚠️ 濕度偏高（{{value}}%），可能影響色彩飽和度',
      severelyLowHumidity: '❌ 濕度不足（{{value}}%），光線散射弱',
      excellentVisibility: '✅ 能見度極佳（{{value}} km），視野通透',
      goodVisibility: '✅ 能見度良好（{{value}} km），觀賞體驗佳',
      fairVisibility: '⚠️ 能見度一般（{{value}} km），色彩可能略暗',
      poorVisibility: '❌ 能見度差（{{value}} km），有霧霾影響',
      sparseLowCloud: '✅ 低雲稀少（{{value}}%），不會遮擋火燒雲',
      littleLowCloud: '✅ 低雲較少（{{value}}%），對觀賞影響小',
      someLowCloud: '⚠️ 低雲較多（{{value}}%），可能部分遮擋',
      denseLowCloud: '❌ 低雲密集（{{value}}%），嚴重影響觀賞',
      excellentConditions: '🌟 具備出現絢爛火燒雲的所有條件！',
      highProbability: '✨ 有較大概率出現壯觀的火燒雲景象',
      moderateProbability: '💫 可能出現輕微的火燒雲效果',
      lowProbability: '⛅ 形成明顯火燒雲的可能性較低',
      noCloudNoFireCloud: '❌ 雲量嚴重不足，無法形成火燒雲',
      tooMuchCloud: '❌ 雲量過多，遮擋陽光難以形成火燒雲'
    },

    // 總體評價
    overallEvaluation: {
      excellent: '{{date}}的氣象條件非常適合觀賞{{type}}！<br><br>',
      good: '{{date}}的氣象條件較為適合觀賞{{type}}。<br><br>',
      fair: '{{date}}的氣象條件不太理想。<br><br>',
      idealCloud: ' 雲量適中（{{value}}%），有利於形成絢麗的色彩。<br>',
      lowCloud: ' 雲量偏少（{{value}}%），可能缺少足夠的雲層來反射光線。<br>',
      highCloud: ' 雲量較多（{{value}}%），可能遮擋過多陽光。<br>',
      idealHumidity: ' 濕度適宜（{{value}}%），空氣中的水汽有助於光線散射。<br>',
      lowHumidity: ' 濕度偏低（{{value}}%），空氣較乾燥。<br>',
      highHumidity: ' 濕度較高（{{value}}%），可能影響能見度。<br>',
      excellentVisibility: ' 能見度良好（{{value}} km），視野清晰。<br>',
      fairVisibility: ' 能見度一般（{{value}} km）<br>',
      poorVisibility: ' 能見度較差（{{value}} km），可能有霧霾。<br>',
      sparseLowCloud: ' 低層雲較少，不會遮擋視線。',
      someLowCloud: ' 有一些低層雲，可能略微影響觀賞效果。',
      denseLowCloud: ' 低層雲較多（{{value}}%），可能遮擋部分景觀。'
    },

    // 未來預測
    passed: '已過',
    forecast: '未來預測'
  },

  // 時間
  time: {
    today: '今天',
    tomorrow: '明天',
    yesterday: '昨天',
    dayAfterTomorrow: '後天',
    daysLater: '{{days}}天後',
    week: '週',
    date: '日期',
    time: '時間'
  },

  // 日期相關
  date: {
    today: '今日',
    tomorrow: '明日',
    dayAfterTomorrow: '後天',
    format: '{{month}}月{{day}}日'
  },

  // 日期按鈕
  dates: {
    today: '今天',
    tomorrow: '明天'
  },

  // 未來預測
  forecast: {
    title: '未來預測'
  },

  // 通用文本
  common: {
    loading: '載入中...',
    dataSource: '資料來源：Windy API'
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
    locationError: '位置解析失敗，請嘗試其他位置名稱',
    mapInitFailed: '地圖初始化失敗'
  },

  // 設定
  settings: {
    title: '設定',
    apiKey: 'API金鑰',
    apiKeyLabel: '配置Windy API金鑰',
    apiKeyPlaceholder: '輸入API金鑰',
    apiKeyHelp: '請輸入您的Windy API金鑰以使用天氣預測功能',
    language: '語言',
    languageLabel: '介面語言',
    notifications: '通知',
    notificationsTitle: '通知設定',
    notificationsLabel: '晚霞預測通知',
    notificationsDescription: '設定高品質預測提醒',
    notificationsHelp: '當預測品質高於設定值時發送通知',
    enableNotifications: '啟用通知提醒',
    thresholdLabel: '評分閾值（當評分≥此值時提醒）',
    testNotification: '測試通知',
    notificationThreshold: '通知閾值',
    favoriteLocations: '收藏位置',
    searchHistory: '搜尋歷史',
    clearHistory: '清除歷史',
    confirmClearHistory: '確定要清除所有搜尋歷史嗎？',
    // 統一設定面板
    close: '關閉',
    done: '完成',
    // 資料來源與網路
    dataSource: '資料來源與網路',
    currentMode: '目前模式',
    proxyUrl: '後端伺服器位址',
    proxyUrlPlaceholder: 'http://localhost:3000',
    proxyUrlHint: '後端代理伺服器的 URL 位址',
    // 通知與提醒
    notificationAndAlerts: '通知與提醒',
    enableSunsetNotification: '啟用晚霞預測通知',
    notificationHint: '當預測品質達到閾值時發送瀏覽器通知',
    notificationThresholdLabel: '通知閾值',
    notificationThresholdHint: '預測評分高於此值時發送通知',
    // 語言與顯示
    languageAndDisplay: '語言與顯示',
    interfaceLanguage: '介面語言',
    // 個人化
    personalization: '個人化',
    themeMode: '主題模式',
    themeLight: '明亮模式',
    themeDark: '暗色模式',
    themeAuto: '跟隨系統',
    temperatureUnit: '溫度單位',
    tempCelsius: '攝氏度 (℃)',
    tempFahrenheit: '華氏度 (℉)',
    windSpeedUnit: '風速單位',
    windKmh: '公里/小時 (km/h)',
    windMs: '米/秒 (m/s)'
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
    add: '加入收藏',
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
    parameters: '參數',
    trend: '變化趨勢',
    time: '時間',
    unit: '單位'
  },

  // 任务18：地图图层
  map: {
    title: '地圖預測',
    layers: {
      wind: '風',
      temp: '溫度',
      clouds: '雲',
      rain: '降水'
    },
    currentTime: '當前時間：',
    timeNow: '現在',
    timeSunset: '日落',
    timeSunrise: '日出',
    timeHint: '💡 提示：也可以使用地圖下方的預測時間軸拖動時間',
    loading: '地圖加載中...',
    error: '地圖加載失敗',
    mockNotSupported: '地圖功能僅在真實API模式下可用'
  },

  // 任务19：周邊火燒雲
  surrounding: {
    title: '周邊火燒雲分析',
    radius: '探測半徑',
    radiusUnit: '公里',
    directions: {
      N: '北',
      NE: '東北',
      E: '東',
      SE: '東南',
      S: '南',
      SW: '西南',
      W: '西',
      NW: '西北'
    },
    loading: '正在獲取周邊氣象數據...',
    error: '獲取周邊數據失敗',
    noData: '暫無周邊數據',
    clickToView: '點擊方位查看詳情',
    viewingDirection: '查看{{direction}}方向',
    distanceInfo: '{{distance}}公里',
    recommendation: '觀賞建議',
    bestDirections: '推薦觀賞方向',
    scoreBreakdown: '各方位評分',
    legend: {
      excellent: '優秀（≥80分）',
      good: '良好（60-79分）',
      fair: '一般（40-59分）',
      poor: '較差（<40分）'
    },
    fallbackMessage: '您的瀏覽器不支持Canvas，使用表格顯示'
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
