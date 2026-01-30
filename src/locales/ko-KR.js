/**
 * 한국어 번역
 */
export default {
  app: {
    title: '날씨 노을 예측기',
    subtitle: '화염구름이 나타나는 최적의 시간 예측'
  },
  buttons: {
    search: '검색',
    refresh: '새로고침',
    save: '저장',
    cancel: '취소',
    confirm: '확인',
    close: '닫기',
    clear: '지우기',
    delete: '삭제',
    edit: '편집',
    useCurrentLocation: '현재 위치 사용',
    changeLanguage: '언어 변경'
  },
  location: {
    label: '위치',
    placeholder: '도시 이름을 입력하세요...',
    current: '현재 위치',
    searching: '위치 검색 중...',
    notFound: '위치를 찾을 수 없습니다. 다른 이름을 시도해주세요',
    permissionDenied: '위치 권한을 가져올 수 없습니다. 수동으로 입력해주세요',
    loading: '위치를 가져오는 중...'
  },
  weather: {
    title: '날씨 정보',
    current: '현재 날씨',
    currentLocation: '현재 위치',
    noData: '날씨 데이터를 사용할 수 없습니다',
    forecast: '예보',
    temperature: '기온',
    humidity: '습도',
    windSpeed: '풍속',
    windDirection: '풍향',
    pressure: '기압',
    visibility: '가시거리',
    clouds: '구름',
    cloudCover: '전운량',
    precipitation: '강수',
    highClouds: '고층운',
    midClouds: '중층운',
    lowClouds: '저층운',
    feeling: '체감',
    uvIndex: '자외선 지수',

    // Weather description
    overcast: '흐림',
    cloudy: '흐림',
    partlyCloudy: '약간 흐림',
    clear: '맑음',

    // Weather overview
    overview: '개요',
    hourly: '시간별 예보',
    daysOverview: '{{days}}일 개요',
    precipChance: '{{prob}}% 강수',
    dataInfo: 'ℹ️ 데이터 출처는 {{hours}}시간 예측 데이터를 제공합니다 (약 {{days}}일). 더 많은 일수가 필요한 경우 다른 날씨 데이터 소스를 고려하세요.'
  },
  prediction: {
    title: '노을 예측',
    sunrise: '아침 노을',
    sunset: '저녁 노을',
    sunriseAndSunset: '일출 및 일몰 노을 예측',
    score: '예측 점수',
    points: '점',
    quality: '품질 등급',
    bestTime: '최적 관람 시간',
    excellent: '우수',
    good: '좋음',
    fair: '보통',
    poor: '나쁨',
    goldenHour: '🌟 골든 아워',
    blueHour: '🌌 블루 아워',
    sunAzimuth: '🧭 태양 방위',
    sunriseTime: '일출 시간',
    sunsetTime: '일몰 시간',
    bestViewingTime: '최적 관람 시간',
    analysis: '분석',
    analysisTitle: '📊 분석 이유',
    details: '세부 정보',
    detailedWeatherData: '상세 날씨 데이터',
    noPredictionData: '⚠️ {{date}} 예측 데이터 없음',
    insufficientData: '날씨 데이터가 부족하여 예측을 생성할 수 없습니다. 잠시 후 데이터를 새로고침하세요.',
    viewFutureOrRefresh: '미래 예측을 보거나 잠시 후 데이터를 새로고침하세요',
    predictionUnavailable: '⚠️ 날씨 데이터 부족',

    // Quality levels
    excellent: '우수',
    good: '좋음',
    fair: '보통',
    poor: '나쁨',

    // Status descriptions
    status: {
      noFireCloud: '불구름 없음',
      lightGlow: '가벼운 노을',
      goodGlow: '좋은 노을',
      highProbability: '아름다운 노을이 나타날 확률 높음',
      moderateProbability: '노을이 나타날 수 있음',
      lowProbability: '노을이 나타날 확률 낮음',
      skyClear: '맑은 하늘, 빛을 반사할 "캔버스" 부족',
      cloudPerfect: '적당한 구름, 아름다운 노을에 유리',
      cloudTooThick: '구름이 너무 두꺼움, 햇빛 투과 불가',
      cloudUnsuitable: '불구름 형성에 부적합한 구름 상태',
      waitForClouds: '적당한 구름 양을 기다리는 것 권장',
      lightPathBlocked: '서쪽 구름이 빛 경로 차단',
      lightPathObstructed: '빛 경로 차단됨',
      poorViewing: '관람 조건 나쁨',
      conditionsFair: '조건 보통, 약간의 색채 가능',
      canWatch: '관람 가능',
      conditionsGood: '조건 양호, 약간의 관람 가치',
      veryLikely: '아름다운 노을 나타날 확률 높음',
      excellentConditions: '적당한 구름과 맑은 빛 경로',
      legendaryEruption: '전설적 분화',
      perfectMidHighClouds: '완벽한 중고층 구름, 맑은 빛 경로',
      highlyRecommended: '관람 강력 추천!'
    },

    // Time periods
    bestViewingWindowSunrise: '일출 전후 30분이 아침 노을 관람의 최적 시간입니다',
    bestViewingWindowSunset: '일몰 전후 30분이 저녁 노을 관람의 최적 시간입니다',

    // Canvas score
    canvas: {
      title: '캔버스 점수',
      score: '캔버스 점수',
      cloudLevel: '구름 레벨',
      breakdown: '구름 분포',
      canvasScore: '📊 캔버스: {{score}}점 | {{level}}',
      cloudBreakdown: '고층 {{high}}% 중층 {{mid}}% 저층 {{low}}%',
      lowCloudPenalty: '| 저층구름 페널티: {{reason}}',
      // Cloud levels
      space: '우주 (구름 없음)',
      fair: '보통',
      perfect: '완벽',
      crowded: '혼잡',
      overcast: '흐림',
      // Low cloud penalty reasons
      noLowCloudObstruction: '저층구름 장애 없음',
      tooManyLowClouds: '저층구름 너무 많음 (거의 흐림)',
      lowCloudAmount: '저층구름 {{value}}%'
    },

    // Light path score
    lightPath: {
      title: '빛 경로 점수',
      score: '빛 경로 점수',
      visibility: '가시거리',
      lightPathScore: '🌅 빛 경로: {{score}}점 (150km:{{near}} 300km:{{far}})'
    },

    // Rendering score
    rendering: {
      title: '렌더링 점수',
      score: '렌더링 점수',
      humidity: '습도 영향',
      renderingFactor: '🎨 렌더링 계수: {{factor}} | {{visibility}} | {{aqi}} | {{color}}',
      specialMode: '| {{mode}}',
      // Visibility descriptions
      visibilityExcellent: '우수 (>20km)',
      visibilityGood: '양호 (10-20km)',
      visibilityPoor: '나쁨 (<10km)',
      // Humidity descriptions
      humidityFog: '안개 가능',
      humidityDry: '건조한 공기',
      humidityModerate: '적절한 습도',
      // AQI descriptions
      aqiExcellent: '우수',
      aqiGood: '양호',
      aqiPoor: '나쁨',
      // Color tendencies
      colorGoldenOrange: '금색, 밝은 주황색',
      colorReddishPurplish: '붉은빛 자주빛',
      colorDarkRed: '진한 빨간색, 피 빨간색 (아름답지 않음)',
      // Special mode
      postRainMode: '🌟 비 후 청명 모드 (슈퍼 보너스)'
    },

    // Composite score
    composite: {
      title: '종합 점수',
      finalScore: '최종 점수',
      confidence: '예측 신뢰도'
    },

    // Cloud layers
    cloudLayers: {
      title: '☁️ 구름 층 정보',
      highCloudLabel: '⛅ 고층운 (>6km)',
      midCloudLabel: '☁️ 중층운 (2-6km)',
      lowCloudLabel: '🌫️ 저층운 (<2km)',
      high: '고층운 (>6km)',
      mid: '중층운 (2-6km)',
      low: '저층운 (<2km)',
      favorable: '유리',
      unfavorable: '불리',
      cloudAnalysis: '구름 분석:',
      description: '고층 {{high}}% 중층 {{mid}}% 저층 {{low}}%'
    },

    // Descriptions
    descriptions: {
      skyClear: '맑은 하늘, 빛을 반사할 "캔버스" 부족',
      cloudPerfect: '적당한 구름, 아름다운 저녁 노을에 유리',
      lowCloudHeavy: '저층구름 너무 많음, 저녁 노을 차단할 수 있음',
      highHumidity: '습도가 너무 높음, 가시거리 영향 가능',
      lowHumidity: '습도가 너무 낮음, 구름이 너무 얇을 수 있음',
      goodVisibility: '우수한 가시거리, 좋은 관람 조건',
      poorVisibility: '나쁜 가시거리, 관람 경험 영향 가능'
    },

    // Fire cloud analysis
    fireCloud: {
      title: '🔥 화염구름 지수: {{score}}/100{{level}}',
      excellent: ' (우수)',
      good: ' (좋음)',
      fair: ' (보통)',
      poor: ' (나쁨)',
      analysisTitle: '🔥 화염구름 형성 조건 분석:',
      idealCloud: '✅ 이상적인 구름 양 ({{value}}%), 햇빛을 완전히 반사할 수 있음',
      slightlyLowCloud: '⚠️ 구름 양이 약간 낮음 ({{value}}%), 화염구름 효과가 흐릿할 수 있음',
      tooMuchCloud: '⚠️ 구름 양이 너무 많음 ({{value}}%), 햇빛 차단할 수 있음',
      severelyLowCloud: '❌ 구름 양이 심각하게 낮음 ({{value}}%), 화염구름 형성 불가',
      idealHumidity: '✅ 이상적인 습도 ({{value}}%), 빛 산란에 유리',
      slightlyLowHumidity: '⚠️ 습도가 약간 낮음 ({{value}}%), 색채가 충분히 선명하지 않을 수 있음',
      slightlyHighHumidity: '⚠️ 습도가 약간 높음 ({{value}}%), 색채 채도 영향 가능',
      severelyLowHumidity: '❌ 습도가 심각하게 낮음 ({{value}}%), 빛 산란 약함',
      excellentVisibility: '✅ 우수한 가시거리 ({{value}} km), 맑은 전망',
      goodVisibility: '✅ 양호한 가시거리 ({{value}} km), 좋은 관람 경험',
      fairVisibility: '⚠️ 보통의 가시거리 ({{value}} km), 색채가 약간 어두울 수 있음',
      poorVisibility: '❌ 나쁜 가시거리 ({{value}} km), 안개가 전망에 영향',
      sparseLowCloud: '✅ 드문 저층구름 ({{value}}%), 화염구름 차단하지 않음',
      littleLowCloud: '✅ 적은 저층구름 ({{value}}%), 관람에 미미한 영향',
      someLowCloud: '⚠️ 약간의 저층구름 ({{value}}%), 전망 부분 차단 가능',
      denseLowCloud: '❌ 조밀한 저층구름 ({{value}}%), 관람에 심각한 영향',
      excellentConditions: '🌟 화려한 화염구름의 모든 조건이 충족됨!',
      highProbability: '✨ 화려한 화염구름 경관의 높은 확률',
      moderateProbability: '💫 가능한 약한 화염구름 효과',
      lowProbability: '⛅ 눈에 띄는 화염구름의 낮은 확률',
      noCloudNoFireCloud: '❌ 구름이 심각하게 부족하여 화염구름 형성 불가',
      tooMuchCloud: '❌ 구름이 너무 많아 햇빛 차단으로 화염구름 방지'
    },

    // Overall evaluation
    overallEvaluation: {
      excellent: '{{date}}의 날씨 조건은 {{type}} 관람에 우수합니다!<br><br>',
      good: '{{date}}의 날씨 조건은 {{type}} 관람에 비교적 적합합니다.<br><br>',
      fair: '{{date}}의 날씨 조건은 이상적이지 않습니다.<br><br>',
      idealCloud: ' 이상적인 구름 양 ({{value}}%), 화려한 색채 형성에 유리.<br>',
      lowCloud: ' 낮은 구름 양 ({{value}}%), 빛을 반사할 충분한 구름 부족.<br>',
      highCloud: ' 높은 구름 양 ({{value}}%), 너무 많은 햇빛 차단.<br>',
      idealHumidity: ' 이상적인 습도 ({{value}}%), 공기 중 수증기가 빛 산란 도움.<br>',
      lowHumidity: ' 낮은 습도 ({{value}}%), 공기가 비교적 건조함.<br>',
      highHumidity: ' 높은 습도 ({{value}}%), 가시거리 영향 가능.<br>',
      excellentVisibility: ' 우수한 가시거리 ({{value}} km), 맑은 전망.<br>',
      fairVisibility: ' 보통의 가시거리 ({{value}} km)<br>',
      poorVisibility: ' 나쁜 가시거리 ({{value}} km), 가능한 안개.<br>',
      sparseLowCloud: ' 적은 저층구름, 전망 차단하지 않음.',
      someLowCloud: ' 약간의 저층구름, 관람 경험에 약간 영향.',
      denseLowCloud: ' 많은 저층구름 ({{value}}%), 전망 부분 차단.'
    },

    // Future predictions
    passed: '지남',
    forecast: '미래 예측'
  },

  // Time
  time: {
    today: '오늘',
    tomorrow: '내일',
    yesterday: '어제',
    dayAfterTomorrow: '모레',
    daysLater: '{{days}}일 후',
    week: '주',
    date: '날짜',
    time: '시간'
  },

  // Date
  date: {
    today: '오늘',
    tomorrow: '내일',
    dayAfterTomorrow: '모레',
    format: '{{month}}월 {{day}}일'
  },

  // Date buttons
  dates: {
    today: '오늘',
    tomorrow: '내일'
  },

  // Future forecast
  forecast: {
    title: '미래 예측'
  },

  // Common text
  common: {
    loading: '로드 중...',
    dataSource: '데이터 출처: Windy API'
  },

  // Error messages
  errors: {
    title: '오류',
    networkError: '네트워크 연결 오류, 네트워크 설정을 확인하세요',
    apiError: 'API 호출 실패, 나중에 다시 시도하세요',
    apiKeyMissing: '먼저 Windy API 키를 구성하세요',
    apiKeyInvalid: '유효하지 않은 API 키, 구성을 확인하세요',
    timeout: '요청 시간 초과, 다시 시도하세요',
    unknownError: '알 수 없는 오류 발생, 다시 시도하세요',
    locationError: '위치 확인 실패, 다른 이름을 시도하세요',
    mapInitFailed: '지도 초기화 실패'
  },

  // Settings
  settings: {
    title: '설정',
    apiKey: 'API 키',
    apiKeyLabel: 'Windy API 키 구성',
    apiKeyPlaceholder: 'API 키 입력',
    apiKeyHelp: '날씨 예측 기능을 사용하려면 Windy API 키를 입력하세요',
    language: '언어',
    languageLabel: '인터페이스 언어',
    notifications: '알림',
    notificationsTitle: '알림 설정',
    notificationsLabel: '노을 예측 알림',
    notificationsDescription: '고품질 예측 알림 설정',
    notificationsHelp: '예측 품질이 임계값 이상일 때 알림 보내기',
    enableNotifications: '알림 활성화',
    thresholdLabel: '점수 임계값 (점수 ≥ 이 값일 때 알림)',
    testNotification: '테스트 알림',
    notificationThreshold: '알림 임계값',
    favoriteLocations: '즐겨찾기 위치',
    searchHistory: '검색 기록',
    clearHistory: '기록 삭제',
    confirmClearHistory: '모든 검색 기록을 삭제하시겠습니까?',
    // 통합 설정 패널
    close: '닫기',
    done: '완료',
    // 데이터 소스 및 네트워크
    dataSource: '데이터 소스 및 네트워크',
    apiMode: 'API 액세스 모드',
    apiModeProxy: '백엔드 프록시',
    apiModeDirect: '직접 모드',
    apiModeProxyRecommended: '백엔드 프록시 (권장)',
    currentMode: '현재 모드',
    proxyUrl: '백엔드 서버 URL',
    proxyUrlPlaceholder: 'http://localhost:3000',
    proxyUrlHint: '백엔드 프록시 서버 URL 주소',
    apiModeHint: '• 백엔드 프록시: 서버를 통해 Windy API에 액세스, API 키는 백엔드에 안전하게 저장<br>• 직접 모드: 프론트엔드에서 직접 액세스, API 키 구성 필요',
    // 알림
    notificationAndAlerts: '알림',
    enableSunsetNotification: '노을 예측 알림 활성화',
    notificationHint: '예측 품질이 임계값에 도달하면 브라우저 알림 전송',
    notificationThresholdLabel: '알림 임계값',
    notificationThresholdHint: '예측 점수가 이 값보다 높으면 알림 전송',
    // 언어 및 표시
    languageAndDisplay: '언어 및 표시',
    interfaceLanguage: '인터페이스 언어',
    // 개인 설정
    personalization: '개인 설정',
    themeMode: '테마 모드',
    themeLight: '라이트 모드',
    themeDark: '다크 모드',
    themeAuto: '시스템 따라가기',
    temperatureUnit: '온도 단위',
    tempCelsius: '섭씨 (℃)',
    tempFahrenheit: '화씨 (℉)',
    windSpeedUnit: '풍속 단위',
    windKmh: 'km/h',
    windMs: 'm/s'
  },

  // Language selector
  languageSelector: {
    title: '언어 선택',
    confirmChange: '언어 변경 확인',
    confirmChangeMessage: '언어를 변경하면 인터페이스가 새로고침됩니다. 현재 데이터는 손실되지 않습니다. 계속하시겠습니까?',
    selectLanguage: '인터페이스 언어를 선택하세요'
  },

  // Notifications
  notifications: {
    title: '노을 예측 알림',
    excellentForecast: '오늘 저녁 노을 예측 점수: {{score}}점, 관람하기에 최적입니다!',
    goodForecast: '오늘 저녁 노을 예측 점수: {{score}}점, 기대할 만합니다!',
    time: '시간: {{time}}',
    location: '위치: {{location}}',
    enable: '알림 활성화',
    disable: '알림 비활성화',
    permissionDenied: '알림 권한 거부됨, 브라우저 설정에서 알림을 허용하세요',
    permissionGranted: '알림 권한 부여됨',
    threshold: '점수가 {{threshold}} 이상일 때 알림'
  },

  // Favorite locations
  favorites: {
    title: '⭐ 즐겨찾기 위치',
    add: '현재 위치 즐겨찾기',
    remove: '즐겨찾기 제거',
    removeConfirm: '이 즐겨찾기 위치를 제거하시겠습니까?',
    empty: '즐겨찾기 위치 없음',
    manage: '즐겨찾기 관리'
  },

  // Search history
  history: {
    title: '검색 기록',
    empty: '검색 기록 없음',
    clearAll: '모두 지우기',
    clearConfirm: '모든 검색 기록을 삭제하시겠습니까?'
  },

  // Weather charts
  charts: {
    temperature: '기온',
    precipitation: '강수',
    humidity: '습도',
    wind: '풍속',
    pressure: '기압',
    clouds: '구름',
    hourly: '24시간 예보',
    daily: '7일 예보',
    overview: '개요',
    details: '상세',
    parameters: '매개변수',
    trend: '변화 추세',
    time: '시간',
    unit: '단위'
  },

  // 任务18：地图图层
  map: {
    title: '지도 예측',
    layers: {
      wind: '바람',
      temp: '온도',
      clouds: '구름',
      rain: '강수'
    },
    currentTime: '현재 시간：',
    timeNow: '현재',
    timeSunset: '일몰',
    timeSunrise: '일출',
    timeHint: '💡 팁: 지도 아래의 예측 시간축을 드래그하여 시간을 조정할 수도 있습니다',
    loading: '지도 로딩 중...',
    error: '지도 로딩 실패',
    mockNotSupported: '지도 기능은 실제 API 모드에서만 사용 가능합니다'
  },

  // 任务19：周边火烧云
  surrounding: {
    title: '주변 노을 분석',
    radius: '탐지 반경',
    radiusUnit: '킬로미터',
    directions: {
      N: '북',
      NE: '북동',
      E: '동',
      SE: '남동',
      S: '남',
      SW: '남서',
      W: '서',
      NW: '북서'
    },
    loading: '주변 기상 데이터를 가져오는 중...',
    error: '주변 데이터 가져오기 실패',
    noData: '주변 데이터 없음',
    clickToView: '방향을 클릭하여 세부 정보 보기',
    viewingDirection: '{{direction}} 방향 보기',
    distanceInfo: '{{distance}}km',
    recommendation: '관람 제안',
    bestDirections: '추천 관람 방향',
    scoreBreakdown: '각 방향 점수',
    legend: {
      excellent: '우수（≥80점）',
      good: '양호（60-79점）',
      fair: '보통（40-59점）',
      poor: '부족（<40점）'
    },
    fallbackMessage: '브라우저가 Canvas를 지원하지 않아 표로 표시'
  },

  // Loading states
  loading: {
    data: '데이터 로딩 중...',
    weather: '날씨 데이터 가져오는 중...',
    prediction: '예측 계산 중...',
    pleaseWait: '잠시 기다려주세요...'
  },

  // Other
  other: {
    copyright: '© 2026 날씨 노을 예측기',
    poweredBy: 'Powered by Windy',
    version: '버전',
    about: '정보',
    privacy: '개인정보 보호정책',
    terms: '서비스 약관',
    contact: '문의하기',
    feedback: '피드백'
  }
};
