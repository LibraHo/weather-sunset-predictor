/**
 * 日本語翻訳
 */
export default {
  app: {
    title: '天気夕焼け予測',
    subtitle: '焼き雲の最佳タイミングを予測'
  },
  buttons: {
    search: '検索',
    refresh: '更新',
    save: '保存',
    cancel: 'キャンセル',
    confirm: '確認',
    close: '閉じる',
    clear: 'クリア',
    delete: '削除',
    edit: '編集',
    useCurrentLocation: '現在地を使用',
    changeLanguage: '言語を変更'
  },
  location: {
    label: '場所',
    placeholder: '都市名を入力...',
    current: '現在地',
    searching: '場所を検索中...',
    notFound: '場所が見つかりません。別の名前を試してください',
    permissionDenied: '位置情報の権限を取得できません。手動で入力してください',
    loading: '位置情報を取得中...'
  },
  weather: {
    title: '天気情報',
    current: '現在の天気',
    currentLocation: '現在地',
    noData: '利用可能な天気データがありません',
    forecast: '予報',
    temperature: '気温',
    humidity: '湿度',
    windSpeed: '風速',
    windDirection: '風向',
    pressure: '気圧',
    visibility: '視程',
    clouds: '雲量',
    cloudCover: '雲量',
    precipitation: '降水量',
    highClouds: '上層雲',
    midClouds: '中層雲',
    lowClouds: '下層雲',
    feeling: '体感温度',
    uvIndex: 'UVインデックス',

    // 天気の説明
    overcast: '曇り',
    cloudy: '曇天',
    partlyCloudy: '一部曇り',
    clear: '晴れ',

    // 天気概要
    overview: '概要',
    hourly: '時間別予報',
    daysOverview: '{{days}}日間の概要',
    precipChance: '{{prob}}%の降水確率',
    dataInfo: 'ℹ️ データソースは{{hours}}時間分の予報データを提供しています（約{{days}}日分）。それ以上の日数については、他の天気データソースの利用をご検討ください。'
  },
  prediction: {
    title: '夕焼け予測',
    sunrise: '朝焼け',
    sunset: '夕焼け',
    sunriseAndSunset: '朝焼け・夕焼け予測',
    score: '予測スコア',
    points: '点',
    quality: '品質レベル',
    bestTime: '最適鑑賞時間',
    analysis: '分析',
    analysisTitle: '📊 分析',
    details: '詳細',
    detailedWeatherData: '詳細な天気データ',
    noPredictionData: '⚠️ {{date}}の予測データがありません',
    insufficientData: '予測を生成するための天気データが不足しています。後でもう一度更新してください。',
    viewFutureOrRefresh: '将来の予測を確認するか、後でもう一度データを更新してください',
    predictionUnavailable: '⚠️ 天気データが不足しています',

    // 品質レベル
    excellent: '優秀',
    good: '良好',
    fair: '普通',
    poor: 'やや悪い',

    // ステータスの説明
    status: {
      noFireCloud: '焼き雲なし',
      lightGlow: '薄い夕焼け',
      goodGlow: '良い夕焼け',
      highProbability: '美しい夕焼けの可能性が高い',
      moderateProbability: '夕焼けの可能性あり',
      lowProbability: '夕焼けの可能性は低い',
      skyClear: '快晴、光を反射する「キャンバス」不足',
      cloudPerfect: '適度な雲、美しい夕焼けに好条件',
      cloudTooThick: '雲が厚すぎ、日光が通過できない',
      cloudUnsuitable: '焼き雲形成に不適切な雲の状態',
      waitForClouds: '適度な雲量を待つことを推奨',
      lightPathBlocked: '西側の雲が光路を遮断',
      lightPathObstructed: '光路が遮断されている',
      poorViewing: '観賞条件が悪い',
      conditionsFair: '条件普通、散発的な色の可能性',
      canWatch: '観賞可能',
      conditionsGood: '条件良好、ある程度の鑑賞価値',
      veryLikely: '美しい夕焼けの可能性が高い',
      excellentConditions: '適度な雲と明確な光路',
      legendaryEruption: '伝説的な噴火',
      perfectMidHighClouds: '完璧な中高層雲、明確な光路',
      highlyRecommended: '観賞を強くお勧めします！'
    },

    // 時間帯
    goldenHour: '🌟 ゴールデンアワー',
    blueHour: '🌌 ブルーアワー',
    sunAzimuth: '🧭 太陽方位角',
    sunriseTime: '日の出時間',
    sunsetTime: '日の入り時間',
    bestViewingTime: '最適鑑賞時間',

    // 最適鑑賞時間の説明
    bestViewingWindowSunrise: '日の出の前後30分が朝焼け鑑賞の最適時間です',
    bestViewingWindowSunset: '日の入りの前後30分が夕焼け鑑賞の最適時間です',

    // キャンバススコア
    canvas: {
      title: 'キャンバススコア',
      score: 'キャンバススコア',
      cloudLevel: '雲レベル',
      breakdown: '雲分布',
      canvasScore: '📊 キャンバス：{{score}}点 | {{level}}',
      cloudBreakdown: '上層{{high}}% 中層{{mid}}% 下層{{low}}%',
      lowCloudPenalty: '| 下層雲ペナルティ：{{reason}}'
    },

    // 光路スコア
    lightPath: {
      title: '光路スコア',
      score: '光路スコア',
      visibility: '視程',
      lightPathScore: '🌅 光路：{{score}}点 (150km:{{near}} 300km:{{far}})'
    },

    // レンダリングスコア
    rendering: {
      title: 'レンダリングスコア',
      score: 'レンダリングスコア',
      humidity: '湿度の影響',
      renderingFactor: '🎨 レンダリング係数：{{factor}} | {{visibility}} | {{aqi}} | {{color}}',
      specialMode: '| {{mode}}'
    },

    // 総合スコア
    composite: {
      title: '総合スコア',
      finalScore: '最終スコア',
      confidence: '予測信頼度'
    },

    // 雲層
    cloudLayers: {
      title: '☁️ 雲層情報',
      highCloudLabel: '⛅ 上層雲（6km以上）',
      midCloudLabel: '☁️ 中層雲（2-6km）',
      lowCloudLabel: '🌫️ 下層雲（2km未満）',
      high: '上層雲（6km以上）',
      mid: '中層雲（2-6km）',
      low: '下層雲（2km未満）',
      favorable: '有利',
      unfavorable: '不利',
      cloudAnalysis: '雲解析：',
      description: '上層{{high}}% 中層{{mid}}% 下層{{low}}%'
    },

    // 説明
    descriptions: {
      skyClear: '空が澄んでおり、光を反射する「キャンバス」が不足しています',
      cloudPerfect: '適度な雲があり、美しい夕焼けに有利です',
      lowCloudHeavy: '下層雲が多すぎるため、夕焼けを遮る可能性があります',
      highHumidity: '湿度が高すぎるため、視程に影響する可能性があります',
      lowHumidity: '湿度が低すぎるため、雲が薄すぎる可能性があります',
      goodVisibility: '視程が良好で、鑑賞条件が良いです',
      poorVisibility: '視程が悪く、鑑賞体験に影響する可能性があります'
    },

    // 焼き雲解析
    fireCloud: {
      title: '🔥 焼き雲インデックス：{{score}}/100{{level}}',
      excellent: '（優秀）',
      good: '（良好）',
      fair: '（普通）',
      poor: '（やや悪い）',
      analysisTitle: '🔥 焼き雲形成条件分析：',
      idealCloud: '✅ 理想的な雲量（{{value}}%）、日光を十分に反射できます',
      slightlyLowCloud: '⚠️ 雲量がやや少ない（{{value}}%）、焼き雲の効果が薄い可能性があります',
      tooMuchCloud: '⚠️ 雲量が多すぎる（{{value}}%）、日光を遮る可能性があります',
      severelyLowCloud: '❌ 雲量が著しく不足（{{value}}%）、焼き雲を形成できません',
      idealHumidity: '✅ 理想的な湿度（{{value}}%）、光の散乱に有利です',
      slightlyLowHumidity: '⚠️ 湿度がやや低い（{{value}}%）、色が鮮やかでない可能性があります',
      slightlyHighHumidity: '⚠️ 湿度がやや高い（{{value}}%）、彩度に影響する可能性があります',
      severelyLowHumidity: '❌ 湿度が著しく低い（{{value}}%）、光の散乱が弱いです',
      excellentVisibility: '✅ 視程が良好（{{value}} km）、視界がはっきりしています',
      goodVisibility: '✅ 視程が良好（{{value}} km）、良好な鑑賞体験です',
      fairVisibility: '⚠️ 視程が普通（{{value}} km）、色がやや暗い可能性があります',
      poorVisibility: '❌ 視程が悪い（{{value}} km）、霞が視界に影響しています',
      sparseLowCloud: '✅ 下層雲がまばら（{{value}}%）、焼き雲を遮りません',
      littleLowCloud: '✅ 下層雲が少ない（{{value}}%）、鑑賞への影響は最小限です',
      someLowCloud: '⚠️ 下層雲が若干ある（{{value}}%）、視界の一部を遮る可能性があります',
      denseLowCloud: '❌ 下層雲が濃密（{{value}}%）、鑑賞に深刻な影響があります',
      excellentConditions: '🌟 素晴らしい焼き雲のすべての条件が整っています！',
      highProbability: '✨ 壮大な焼き雲の見られる可能性が高い',
      moderateProbability: '💫 穏やかな焼き雲効果の可能性あり',
      lowProbability: '⛅ 顕著な焼き雲の可能性は低い',
      noCloudNoFireCloud: '❌ 雲量が著しく不足しており、焼き雲を形成できません',
      tooMuchCloud: '❌ 雲量が多すぎるため、日光を遮って焼き雲が見えません'
    },

    // 総合評価
    overallEvaluation: {
      excellent: '{{date}}の天気条件は{{type}}を鑑賞するのに最適です！<br><br>',
      good: '{{date}}の天気条件は{{type}}を鑑賞するのにかなり適しています。<br><br>',
      fair: '{{date}}の天気条件は理想的ではありません。<br><br>',
      idealCloud: ' 理想的な雲量（{{value}}%）、鮮やかな色の形成に有利です。<br>',
      lowCloud: ' 雲量が少ない（{{value}}%）、光を反射する十分な雲がない可能性があります。<br>',
      highCloud: ' 雲量が多い（{{value}}%）、日光を遮りすぎる可能性があります。<br>',
      idealHumidity: ' 理想的な湿度（{{value}}%）、空気中の水蒸気が光の散散を助けます。<br>',
      lowHumidity: ' 湿度が低い（{{value}}%）、空気が比較的乾燥しています。<br>',
      highHumidity: ' 湿度が高い（{{value}}%）、視程に影響する可能性があります。<br>',
      excellentVisibility: ' 視程が良好（{{value}} km）、視界がはっきりしています。<br>',
      fairVisibility: ' 視程が普通（{{value}} km）<br>',
      poorVisibility: ' 視程が悪い（{{value}} km）、霞の可能性があります。<br>',
      sparseLowCloud: ' 下層雲が少なく、視界を遮りません。',
      someLowCloud: ' 下層雲が若干あり、鑑賞体験にわずかに影響する可能性があります。',
      denseLowCloud: ' 下層雲が多い（{{value}}%）、視界の一部を遮る可能性があります。'
    },

    // 将来の予測
    passed: '経過',
    forecast: '将来の予報'
  },
  // 時間
  time: {
    today: '今日',
    tomorrow: '明日',
    yesterday: '昨日',
    dayAfterTomorrow: '明後日',
    daysLater: '{{days}}日後',
    week: '週',
    date: '日付',
    time: '時間'
  },

  // 日付
  date: {
    today: '今日',
    tomorrow: '明日',
    dayAfterTomorrow: '明後日',
    format: '{{month}}/{{day}}'
  },

  // 日付ボタン
  dates: {
    today: '今日',
    tomorrow: '明日'
  },

  // 将来の予報
  forecast: {
    title: '将来の予報'
  },

  // 共通テキスト
  common: {
    loading: '読み込み中...',
    dataSource: 'データソース：Windy API'
  },

  // エラーメッセージ
  errors: {
    title: 'エラー',
    networkError: 'ネットワーク接続エラー、ネットワーク設定を確認してください',
    apiError: 'API呼び出しに失敗しました。後でもう一度お試しください',
    apiKeyMissing: 'まずWindy APIキーを設定してください',
    apiKeyInvalid: '無効なAPIキーです。設定を確認してください',
    timeout: 'リクエストがタイムアウトしました。再試行してください',
    unknownError: '不明なエラーが発生しました。再試行してください',
    locationError: '位置情報の解決に失敗しました。別の名前でお試しください',
    mapInitFailed: '地図の初期化に失敗しました'
  },
  // 設定
  settings: {
    title: '設定',
    apiKey: 'APIキー',
    apiKeyLabel: 'Windy APIキーの設定',
    apiKeyPlaceholder: 'APIキーを入力',
    apiKeyHelp: '天気予測機能を使用するにはWindy APIキーを入力してください',
    language: '言語',
    languageLabel: 'インターフェース言語',
    notifications: '通知',
    notificationsTitle: '通知設定',
    notificationsLabel: '夕焼け予測通知',
    notificationsDescription: '高品質予測アラートを設定',
    notificationsHelp: '予測品質が閾値以上の場合に通知を送信',
    enableNotifications: '通知アラートを有効にする',
    thresholdLabel: 'スコア閾値（スコアがこの値以上の場合に通知）',
    testNotification: 'テスト通知',
    notificationThreshold: '通知閾値',
    favoriteLocations: 'お気に入りの場所',
    searchHistory: '検索履歴',
    clearHistory: '履歴をクリア',
    confirmClearHistory: 'すべての検索履歴をクリアしてもよろしいですか？',
    // 統一設定パネル
    close: '閉じる',
    done: '完了',
    // データソースとネットワーク
    dataSource: 'データソースとネットワーク',
    apiMode: 'API アクセスモード',
    apiModeProxy: 'バックエンドプロキシ',
    apiModeDirect: '直接モード',
    apiModeProxyRecommended: 'バックエンドプロキシ（推奨）',
    currentMode: '現在のモード',
    proxyUrl: 'バックエンドサーバーのURL',
    proxyUrlPlaceholder: 'http://localhost:3000',
    proxyUrlHint: 'バックエンドプロキシサーバーのURLアドレス',
    apiModeHint: '• バックエンドプロキシ：サーバー経由でWindy APIにアクセス、APIキーはバックエンドで安全に保存<br>• 直接モード：フロントエンドから直接アクセス、APIキーの設定が必要',
    // 通知とアラート
    notificationAndAlerts: '通知とアラート',
    enableSunsetNotification: '夕焼け予測通知を有効にする',
    notificationHint: '予測品質が閾値に達したときにブラウザ通知を送信',
    notificationThresholdLabel: '通知閾値',
    notificationThresholdHint: '予測スコアがこの値を超えたときに通知を送信',
    // 言語と表示
    languageAndDisplay: '言語と表示',
    interfaceLanguage: 'インターフェース言語',
    // パーソナライゼーション
    personalization: 'パーソナライゼーション',
    themeMode: 'テーマモード',
    themeLight: 'ライトモード',
    themeDark: 'ダークモード',
    themeAuto: 'システムに従う',
    temperatureUnit: '温度単位',
    tempCelsius: '摂氏 (℃)',
    tempFahrenheit: '華氏 (℉)',
    windSpeedUnit: '風速単位',
    windKmh: 'km/h',
    windMs: 'm/s'
  },
  // 言語セレクター
  languageSelector: {
    title: '言語を選択',
    confirmChange: '言語の変更を確認',
    confirmChangeMessage: '言語を変更するとインターフェースが更新されます。現在のデータは失われません。続行しますか？',
    selectLanguage: 'インターフェース言語を選択してください'
  },

  // 通知
  notifications: {
    title: '夕焼けアラート',
    excellentForecast: '今夜の夕焼け予測スコア：{{score}}点、絶好の鑑賞日和です！',
    goodForecast: '今夜の夕焼け予測スコア：{{score}}点、期待できます！',
    time: '時間：{{time}}',
    location: '場所：{{location}}',
    enable: '通知を有効にする',
    disable: '通知を無効にする',
    permissionDenied: '通知権限が拒否されました。ブラウザ設定で通知を許可してください',
    permissionGranted: '通知権限が付与されました',
    threshold: 'スコアが{{threshold}}以上の場合に通知'
  },

  // お気に入りの場所
  favorites: {
    title: 'お気に入りの場所',
    add: 'お気に入りに追加',
    remove: 'お気に入りから削除',
    removeConfirm: 'このお気に入りの場所を削除してもよろしいですか？',
    empty: 'まだお気に入りの場所がありません',
    manage: 'お気に入りを管理'
  },
  // 検索履歴
  history: {
    title: '検索履歴',
    empty: 'まだ検索履歴がありません',
    clearAll: 'すべてクリア',
    clearConfirm: 'すべての検索履歴をクリアしてもよろしいですか？'
  },

  // 天気チャート
  charts: {
    temperature: '気温',
    precipitation: '降水量',
    humidity: '湿度',
    wind: '風',
    pressure: '気圧',
    clouds: '雲',
    hourly: '24時間予報',
    daily: '7日間予報',
    overview: '概要',
    details: '詳細',
    parameters: 'パラメータ',
    trend: 'トレンド',
    time: '時間',
    unit: '単位'
  },

  // 任务18：地图图层
  map: {
    title: '地図予測',
    layers: {
      wind: '風',
      temp: '気温',
      clouds: '雲',
      rain: '雨'
    },
    currentTime: '現在時刻：',
    timeNow: '現在',
    timeSunset: '日没',
    timeSunrise: '日出',
    timeHint: '💡 ヒント: 地図下の予測タイムラインをドラッグして時間を調整することもできます',
    loading: '地図読み込み中...',
    error: '地図の読み込みに失敗しました',
    mockNotSupported: '地図機能は実際のAPIモードでのみ使用可能です'
  },

  // 任务19：周边火烧云
  surrounding: {
    title: '周辺焼き雲分析',
    radius: '探知半径',
    radiusUnit: 'キロメートル',
    directions: {
      N: '北',
      NE: '北東',
      E: '東',
      SE: '南東',
      S: '南',
      SW: '南西',
      W: '西',
      NW: '北西'
    },
    loading: '周辺気象データを取得中...',
    error: '周辺データの取得に失敗しました',
    noData: '周辺データはありません',
    clickToView: '方位をクリックして詳細を表示',
    viewingDirection: '{{direction}}方向を表示',
    distanceInfo: '{{distance}}km',
    recommendation: '観覧アドバイス',
    bestDirections: 'おすすめ観覧方向',
    scoreBreakdown: '各方位のスコア',
    legend: {
      excellent: '優秀（≥80点）',
      good: '良好（60-79点）',
      fair: '普通（40-59点）',
      poor: '不佳（<40点）'
    },
    fallbackMessage: 'ブラウザがCanvasをサポートしていないため、テーブルで表示'
  },

  // ローディング状態
  loading: {
    data: 'データを読み込み中...',
    weather: '天気データを取得中...',
    prediction: '予測を計算中...',
    pleaseWait: 'お待ちください...'
  },

  // その他
  other: {
    copyright: '© 2026 天気夕焼け予測',
    poweredBy: 'Powered by Windy',
    version: 'バージョン',
    about: '概要',
    privacy: 'プライバシーポリシー',
    terms: '利用規約',
    contact: 'お問い合わせ',
    feedback: 'フィードバック'
  }
};
