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
    forecast: '予報',
    temperature: '気温',
    humidity: '湿度',
    windSpeed: '風速',
    windDirection: '風向',
    pressure: '気圧',
    visibility: '視程',
    clouds: '雲量',
    precipitation: '降水量',
    highClouds: '上層雲',
    midClouds: '中層雲',
    lowClouds: '下層雲'
  },
  prediction: {
    title: '夕焼け予測',
    sunrise: '朝焼け',
    sunset: '夕焼け',
    score: '予測スコア',
    quality: '品質レベル',
    bestTime: '最適鑑賞時間',
    excellent: '優秀',
    good: '良好',
    fair: '普通',
    poor: 'やや悪い',
    goldenHour: 'ゴールデンアワー',
    blueHour: 'ブルーアワー',
    sunriseTime: '日の出時間',
    sunsetTime: '日の入り時間'
  },
  errors: {
    title: 'エラー',
    networkError: 'ネットワーク接続エラー',
    apiError: 'API呼び出し失敗',
    apiKeyMissing: 'Windy APIキーを設定してください',
    apiKeyInvalid: 'APIキーが無効です'
  },
  settings: {
    title: '設定',
    apiKey: 'APIキー',
    language: '言語',
    notifications: '通知'
  },
  languageSelector: {
    title: '言語を選択',
    confirmChange: '言語の変更を確認',
    confirmChangeMessage: '言語を変更するとインターフェースが更新されます。現在のデータは失われません。続行しますか？'
  },
  notifications: {
    title: '夕焼け予測通知',
    excellentForecast: '今夜の夕焼け予測スコア：{{score}}点、絶好の鑑賞日和です！',
    enable: '通知を有効にする',
    disable: '通知を無効にする'
  },
  loading: {
    data: 'データを読み込み中...',
    weather: '天気データを取得中...',
    prediction: '予測を計算中...',
    pleaseWait: 'お待ちください...'
  },
  other: {
    copyright: '© 2026 天気夕焼け予測',
    poweredBy: 'Powered by Windy'
  }
};
