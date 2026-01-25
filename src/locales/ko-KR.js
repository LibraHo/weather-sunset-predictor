/**
 * 한국어 번역
 */
export default {
  app: {
    title: '날씨 노을 예측기',
    subtitle: '화염구름出现的 최적의 시간 예측'
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
    forecast: '예보',
    temperature: '기온',
    humidity: '습도',
    windSpeed: '풍속',
    windDirection: '풍향',
    pressure: '기압',
    visibility: '가시거리',
    clouds: '구름',
    precipitation: '강수',
    highClouds: '고층운',
    midClouds: '중층운',
    lowClouds: '저층운'
  },
  prediction: {
    title: '노을 예측',
    sunrise: '아침 노을',
    sunset: '저녁 노을',
    score: '예측 점수',
    quality: '품질 등급',
    bestTime: '최적 관람 시간',
    excellent: '우수',
    good: '좋음',
    fair: '보통',
    poor: '나쁨',
    goldenHour: '골든 아워',
    blueHour: '블루 아워',
    sunriseTime: '일출 시간',
    sunsetTime: '일몰 시간'
  },
  errors: {
    title: '오류',
    networkError: '네트워크 연결 오류',
    apiError: 'API 호출 실패',
    apiKeyMissing: 'Windy API 키를 설정하세요',
    apiKeyInvalid: 'API 키가 유효하지 않습니다'
  },
  settings: {
    title: '설정',
    apiKey: 'API 키',
    language: '언어',
    notifications: '알림'
  },
  languageSelector: {
    title: '언어 선택',
    confirmChange: '언어 변경 확인',
    confirmChangeMessage: '언어를 변경하면 인터페이스가 새로고침됩니다. 현재 데이터는 손실되지 않습니다. 계속하시겠습니까?'
  },
  notifications: {
    title: '노을 예측 알림',
    excellentForecast: '오늘 저녁 노을 예측 점수: {{score}}점, 관람하기에 최적입니다!',
    enable: '알림 활성화',
    disable: '알림 비활성화'
  },
  loading: {
    data: '데이터 로딩 중...',
    weather: '날씨 데이터 가져오는 중...',
    prediction: '예측 계산 중...',
    pleaseWait: '잠시 기다려주세요...'
  },
  other: {
    copyright: '© 2026 날씨 노을 예측기',
    poweredBy: 'Powered by Windy'
  }
};
