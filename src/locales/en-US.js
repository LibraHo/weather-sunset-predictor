/**
 * English Translation (US)
 */
export default {
  // App
  app: {
    title: 'Weather Sunset Predictor',
    subtitle: 'Predict the best time for fire clouds'
  },

  // Buttons
  buttons: {
    search: 'Search',
    refresh: 'Refresh',
    save: 'Save',
    cancel: 'Cancel',
    confirm: 'Confirm',
    close: 'Close',
    clear: 'Clear',
    delete: 'Delete',
    edit: 'Edit',
    useCurrentLocation: 'Use Current Location',
    changeLanguage: 'Change Language'
  },

  // Location
  location: {
    label: 'Location',
    placeholder: 'Enter city name...',
    current: 'Current Location',
    searching: 'Searching location...',
    notFound: 'Location not found, please try another name',
    permissionDenied: 'Unable to get location permission, please enter location manually',
    loading: 'Getting location...'
  },

  // Weather
  weather: {
    title: 'Weather Information',
    current: 'Current Weather',
    currentLocation: 'Current Location',
    noData: 'No weather data available',
    forecast: 'Forecast',
    temperature: 'Temperature',
    humidity: 'Humidity',
    windSpeed: 'Wind Speed',
    windDirection: 'Wind Direction',
    pressure: 'Pressure',
    visibility: 'Visibility',
    clouds: 'Clouds',
    cloudCover: 'Cloud Cover',
    precipitation: 'Precipitation',
    highClouds: 'High Clouds',
    midClouds: 'Mid Clouds',
    lowClouds: 'Low Clouds',
    feeling: 'Feels Like',
    uvIndex: 'UV Index',

    // Weather descriptions
    overcast: 'Overcast',
    cloudy: 'Cloudy',
    partlyCloudy: 'Partly Cloudy',
    clear: 'Clear',

    // Weather overview
    overview: 'Overview',
    hourly: 'Hourly Forecast',
    mapView: 'Map Forecast',
    daysOverview: '{{days}}-Day Overview',
    precipChance: '{{prob}}% precip',
    dataInfo: 'ℹ️ Data source provides {{hours}} hours forecast data (~{{days}} days). Consider using other weather data sources for more days.'
  },

  // Prediction
  prediction: {
    title: 'Sunset Glow Prediction',
    sunrise: 'Sunrise Glow',
    sunset: 'Sunset Glow',
    sunriseAndSunset: 'Sunrise & Sunset Glow Prediction',
    score: 'Prediction Score',
    points: 'pts',
    quality: 'Quality Level',
    bestTime: 'Best Viewing Time',
    analysis: 'Analysis',
    analysisTitle: '📊 Analysis',
    details: 'Details',
    detailedWeatherData: 'Detailed Weather Data',
    noPredictionData: '⚠️ No {{date}} prediction data available',
    insufficientData: 'Insufficient weather data to generate prediction. Please refresh later.',
    viewFutureOrRefresh: 'Please check future predictions or refresh data later',
    predictionUnavailable: '⚠️ Insufficient weather data',

    // Quality levels
    excellent: 'Excellent',
    good: 'Good',
    fair: 'Fair',
    poor: 'Poor',

    // Status descriptions
    status: {
      noFireCloud: 'No Fire Cloud',
      lightGlow: 'Light Glow',
      goodGlow: 'Good Glow',
      highProbability: 'High probability of beautiful sunset glow',
      moderateProbability: 'Possible sunset glow',
      lowProbability: 'Unlikely to have sunset glow',
      skyClear: 'Clear sky, lacking "canvas" to reflect light',
      cloudPerfect: 'Moderate clouds, favorable for beautiful sunset',
      cloudTooThick: 'Clouds too thick, sunlight cannot penetrate',
      cloudUnsuitable: 'Cloud conditions unsuitable for fire cloud formation',
      waitForClouds: 'Recommend waiting for moderate cloud cover',
      lightPathBlocked: 'Clouds to the west blocking light path',
      lightPathObstructed: 'Light path obstructed',
      poorViewing: 'Poor viewing conditions',
      conditionsFair: 'Fair conditions, possibly scattered colors',
      canWatch: 'Can watch',
      conditionsGood: 'Good conditions with some viewing value',
      veryLikely: 'High probability of beautiful sunset',
      excellentConditions: 'Moderate clouds with clear light path',
      legendaryEruption: 'Legendary eruption',
      perfectMidHighClouds: 'Perfect mid-high clouds with clear light path',
      highlyRecommended: 'Highly recommended to watch!'
    },

    // Time periods
    goldenHour: '🌟 Golden Hour',
    blueHour: '🌌 Blue Hour',
    sunAzimuth: '🧭 Sun Azimuth',
    sunriseTime: 'Sunrise Time',
    sunsetTime: 'Sunset Time',
    bestViewingTime: 'Best Viewing Time',

    // Best viewing window descriptions
    bestViewingWindowSunrise: '30 minutes before and after sunrise is the best time to view sunrise glow',
    bestViewingWindowSunset: '30 minutes before and after sunset is the best time to view sunset glow',

    // Canvas score
    canvas: {
      title: 'Canvas Score',
      score: 'Canvas Score',
      cloudLevel: 'Cloud Level',
      breakdown: 'Cloud Distribution',
      canvasScore: '📊 Canvas: {{score}}pts | {{level}}',
      cloudBreakdown: 'High {{high}}% Mid {{mid}}% Low {{low}}%',
      lowCloudPenalty: '| Low cloud penalty: {{reason}}',
      // Cloud levels
      space: 'Space (No Clouds)',
      fair: 'Fair',
      perfect: 'Perfect',
      crowded: 'Crowded',
      overcast: 'Overcast',
      // Low cloud penalty reasons
      noLowCloudObstruction: 'No low cloud obstruction',
      tooManyLowClouds: 'Too many low clouds (almost overcast)',
      lowCloudAmount: 'Low clouds {{value}}%'
    },

    // Light path score
    lightPath: {
      title: 'Light Path Score',
      score: 'Light Path Score',
      visibility: 'Visibility',
      lightPathScore: '🌅 Light path: {{score}}pts (150km:{{near}} 300km:{{far}})'
    },

    // Rendering score
    rendering: {
      title: 'Rendering Score',
      score: 'Rendering Score',
      humidity: 'Humidity Effect',
      renderingFactor: '🎨 Rendering factor: {{factor}} | {{visibility}} | {{aqi}} | {{color}}',
      specialMode: '| {{mode}}',
      // Visibility descriptions
      visibilityExcellent: 'Excellent (>20km)',
      visibilityGood: 'Good (10-20km)',
      visibilityPoor: 'Poor (<10km)',
      // Humidity descriptions
      humidityFog: 'Possible fog',
      humidityDry: 'Dry air',
      humidityModerate: 'Moderate humidity',
      // AQI descriptions
      aqiExcellent: 'Excellent',
      aqiGood: 'Good',
      aqiPoor: 'Poor',
      // Color tendencies
      colorGoldenOrange: 'Golden, bright orange',
      colorReddishPurplish: 'Reddish, purplish-red',
      colorDarkRed: 'Dark red, blood red (not beautiful)',
      // Special mode
      postRainMode: '🌟 Post-rain clear mode (super bonus)'
    },

    // Composite score
    composite: {
      title: 'Composite Score',
      finalScore: 'Final Score',
      confidence: 'Prediction Confidence'
    },

    // Cloud layers
    cloudLayers: {
      title: '☁️ Cloud Layer Information',
      highCloudLabel: '⛅ High Clouds (>6km)',
      midCloudLabel: '☁️ Mid Clouds (2-6km)',
      lowCloudLabel: '🌫️ Low Clouds (<2km)',
      high: 'High Clouds (>6km)',
      mid: 'Mid Clouds (2-6km)',
      low: 'Low Clouds (<2km)',
      favorable: 'Favorable',
      unfavorable: 'Unfavorable',
      cloudAnalysis: 'Cloud analysis:',
      description: 'High {{high}}% Mid {{mid}}% Low {{low}}%'
    },

    // Descriptions
    descriptions: {
      skyClear: 'Clear sky, lacking "canvas" to reflect light',
      cloudPerfect: 'Moderate clouds, favorable for beautiful sunset glow',
      lowCloudHeavy: 'Too many low clouds, may block sunset glow',
      highHumidity: 'Humidity too high, may affect visibility',
      lowHumidity: 'Humidity too low, clouds may be too thin',
      goodVisibility: 'Excellent visibility, good viewing conditions',
      poorVisibility: 'Poor visibility, may affect viewing experience'
    },

    // Fire cloud analysis
    fireCloud: {
      title: '🔥 Fire Cloud Index: {{score}}/100{{level}}',
      excellent: ' (Excellent)',
      good: ' (Good)',
      fair: ' (Fair)',
      poor: ' (Poor)',
      analysisTitle: '🔥 Fire Cloud Formation Conditions Analysis:',
      idealCloud: '✅ Ideal cloud cover ({{value}}%), can fully reflect sunlight',
      slightlyLowCloud: '⚠️ Slightly low cloud cover ({{value}}%), fire cloud effect may be pale',
      tooMuchCloud: '⚠️ Too much cloud cover ({{value}}%), may block sunlight',
      severelyLowCloud: '❌ Severely low cloud cover ({{value}}%), cannot form fire clouds',
      idealHumidity: '✅ Ideal humidity ({{value}}%), favorable for light scattering',
      slightlyLowHumidity: '⚠️ Slightly low humidity ({{value}}%), colors may not be vibrant enough',
      slightlyHighHumidity: '⚠️ Slightly high humidity ({{value}}%), may affect color saturation',
      severelyLowHumidity: '❌ Severely low humidity ({{value}}%), weak light scattering',
      excellentVisibility: '✅ Excellent visibility ({{value}} km), clear view',
      goodVisibility: '✅ Good visibility ({{value}} km), good viewing experience',
      fairVisibility: '⚠️ Fair visibility ({{value}} km), colors may be slightly dim',
      poorVisibility: '❌ Poor visibility ({{value}} km), haze affecting view',
      sparseLowCloud: '✅ Sparse low clouds ({{value}}%), will not block fire clouds',
      littleLowCloud: '✅ Few low clouds ({{value}}%), minimal impact on viewing',
      someLowCloud: '⚠️ Some low clouds ({{value}}%), may partially block view',
      denseLowCloud: '❌ Dense low clouds ({{value}}%), seriously affecting viewing',
      excellentConditions: '🌟 All conditions for magnificent fire clouds are met!',
      highProbability: '✨ High probability of spectacular fire cloud scenery',
      moderateProbability: '💫 Possible mild fire cloud effects',
      lowProbability: '⛅ Low probability of significant fire clouds',
      noCloudNoFireCloud: '❌ Severely insufficient cloud cover, cannot form fire clouds',
      tooMuchCloud: '❌ Too much cloud cover, blocking sunlight prevents fire clouds'
    },

    // Overall evaluation
    overallEvaluation: {
      excellent: 'The weather conditions on {{date}} are excellent for viewing {{type}}!<br><br>',
      good: 'The weather conditions on {{date}} are fairly suitable for viewing {{type}}.<br><br>',
      fair: 'The weather conditions on {{date}} are not ideal.<br><br>',
      idealCloud: ' Ideal cloud cover ({{value}}%), favorable for forming brilliant colors.<br>',
      lowCloud: ' Low cloud cover ({{value}}%), may lack sufficient clouds to reflect light.<br>',
      highCloud: ' High cloud cover ({{value}}%), may block too much sunlight.<br>',
      idealHumidity: ' Ideal humidity ({{value}}%), water vapor in the air helps light scattering.<br>',
      lowHumidity: ' Low humidity ({{value}}%), air is relatively dry.<br>',
      highHumidity: ' High humidity ({{value}}%), may affect visibility.<br>',
      excellentVisibility: ' Good visibility ({{value}} km), clear view.<br>',
      fairVisibility: ' Fair visibility ({{value}} km)<br>',
      poorVisibility: ' Poor visibility ({{value}} km), possible haze.<br>',
      sparseLowCloud: ' Few low-level clouds, will not block the view.',
      someLowCloud: ' Some low-level clouds, may slightly affect viewing experience.',
      denseLowCloud: ' Many low-level clouds ({{value}}%), may partially block the view.'
    },

    // Future predictions
    passed: 'Passed',
    forecast: 'Future Forecast'
  },

  // Task 19: Surrounding fire cloud visualization
  surrounding: {
    title: 'Surrounding Fire Cloud Analysis',
    radius: 'Detection Radius',
    radiusUnit: 'km',
    directions: {
      N: 'North',
      NE: 'Northeast',
      E: 'East',
      SE: 'Southeast',
      S: 'South',
      SW: 'Southwest',
      W: 'West',
      NW: 'Northwest'
    },
    loading: 'Loading surrounding weather data...',
    error: 'Failed to load surrounding data',
    noData: 'No surrounding data available',
    clickToView: 'Click direction to view details',
    viewingDirection: 'Viewing {{direction}} direction',
    distanceInfo: '{{distance}}km',
    recommendation: 'Viewing Recommendation',
    bestDirections: 'Best Viewing Directions',
    scoreBreakdown: 'Direction Scores',
    legend: {
      excellent: 'Excellent (≥80)',
      good: 'Good (60-79)',
      fair: 'Fair (40-59)',
      poor: 'Poor (<40)'
    },
    fallbackMessage: 'Your browser does not support Canvas, using table view'
  },

  // Time
  time: {
    today: 'Today',
    tomorrow: 'Tomorrow',
    yesterday: 'Yesterday',
    dayAfterTomorrow: 'Day After Tomorrow',
    daysLater: '{{days}} days later',
    week: 'Week',
    date: 'Date',
    time: 'Time'
  },

  // Date
  date: {
    today: 'Today',
    tomorrow: 'Tomorrow',
    dayAfterTomorrow: 'Day After Tomorrow',
    format: '{{month}}/{{day}}'
  },

  // Date buttons
  dates: {
    today: 'Today',
    tomorrow: 'Tomorrow'
  },

  // Future forecast
  forecast: {
    title: 'Future Forecast'
  },

  // Common text
  common: {
    loading: 'Loading...',
    dataSource: 'Data source: Windy API'
  },

  // Error messages
  errors: {
    title: 'Error',
    networkError: 'Network connection error, please check your network settings',
    apiError: 'API call failed, please try again later',
    apiKeyMissing: 'Please configure Windy API key first',
    apiKeyInvalid: 'Invalid API key, please check configuration',
    timeout: 'Request timeout, please retry',
    unknownError: 'Unknown error occurred, please retry',
    locationError: 'Location resolution failed, please try a different name'
  },

  // Settings
  settings: {
    title: 'Settings',
    apiKey: 'API Key',
    apiKeyLabel: 'Configure Windy API Key',
    apiKeyPlaceholder: 'Enter API key',
    apiKeyHelp: 'Please enter your Windy API key to use weather prediction features',
    language: 'Language',
    languageLabel: 'Interface Language',
    notifications: 'Notifications',
    notificationsTitle: 'Notification Settings',
    notificationsLabel: 'Sunset Glow Notifications',
    notificationsDescription: 'Set up high-quality prediction alerts',
    notificationsHelp: 'Send notification when prediction quality is above threshold',
    enableNotifications: 'Enable notification alerts',
    thresholdLabel: 'Score threshold (alert when score ≥ this value)',
    testNotification: 'Test Notification',
    notificationThreshold: 'Notification Threshold',
    favoriteLocations: 'Favorite Locations',
    searchHistory: 'Search History',
    clearHistory: 'Clear History',
    confirmClearHistory: 'Are you sure you want to clear all search history?',
    // Unified Settings Panel
    close: 'Close',
    done: 'Done',
    // Data Source & Network
    dataSource: 'Data Source & Network',
    apiMode: 'API Access Mode',
    apiModeProxy: 'Backend Proxy',
    apiModeDirect: 'Direct Mode',
    apiModeProxyRecommended: 'Backend Proxy (Recommended)',
    currentMode: 'Current Mode',
    proxyUrl: 'Backend Server URL',
    proxyUrlPlaceholder: 'http://localhost:3000',
    proxyUrlHint: 'Backend proxy server URL address',
    apiModeHint: '• Backend Proxy: Access Windy API through server, API key securely stored on backend<br>• Direct Mode: Frontend direct access, requires you to configure API key',
    // Notifications & Alerts
    notificationAndAlerts: 'Notifications & Alerts',
    enableSunsetNotification: 'Enable sunset glow notifications',
    notificationHint: 'Send browser notification when prediction quality reaches threshold',
    notificationThresholdLabel: 'Notification Threshold',
    notificationThresholdHint: 'Send notification when prediction score is above this value',
    // Language & Display
    languageAndDisplay: 'Language & Display',
    interfaceLanguage: 'Interface Language',
    // Personalization
    personalization: 'Personalization',
    themeMode: 'Theme Mode',
    themeLight: 'Light Mode',
    themeDark: 'Dark Mode',
    themeAuto: 'Follow System',
    temperatureUnit: 'Temperature Unit',
    tempCelsius: 'Celsius (℃)',
    tempFahrenheit: 'Fahrenheit (℉)',
    windSpeedUnit: 'Wind Speed Unit',
    windKmh: 'km/h',
    windMs: 'm/s',
    // Default location
    defaultLocation: 'Default Location',
    noDefaultLocation: 'No default location set',
    setAsDefault: 'Set as Default',
    currentDefaultLocation: 'Current Default Location',
    defaultLocationHint: 'Set the location to load automatically on startup'
  },

  // Language selector
  languageSelector: {
    title: 'Select Language',
    confirmChange: 'Confirm Language Change',
    confirmChangeMessage: 'The interface will refresh after changing language. Current data will not be lost. Continue?',
    selectLanguage: 'Please select interface language'
  },

  // Notifications
  notifications: {
    title: 'Sunset Glow Alert',
    excellentForecast: 'Tonight\'s sunset glow prediction score: {{score}}, excellent for viewing!',
    goodForecast: 'Tonight\'s sunset glow prediction score: {{score}}, worth looking forward to!',
    time: 'Time: {{time}}',
    location: 'Location: {{location}}',
    enable: 'Enable Notifications',
    disable: 'Disable Notifications',
    permissionDenied: 'Notification permission denied, please allow notifications in browser settings',
    permissionGranted: 'Notification permission granted',
    threshold: 'Notify when score is above {{threshold}}'
  },

  // Favorite locations
  favorites: {
    title: 'Favorite Locations',
    add: 'Add to Favorites',
    remove: 'Remove from Favorites',
    removeConfirm: 'Are you sure you want to remove this favorite location?',
    empty: 'No favorite locations yet',
    manage: 'Manage Favorites'
  },

  // Search history
  history: {
    title: 'Search History',
    empty: 'No search history yet',
    clearAll: 'Clear All',
    clearConfirm: 'Are you sure you want to clear all search history?'
  },

  // Weather charts
  charts: {
    temperature: 'Temperature',
    precipitation: 'Precipitation',
    humidity: 'Humidity',
    wind: 'Wind',
    pressure: 'Pressure',
    clouds: 'Clouds',
    hourly: '24-Hour Forecast',
    daily: '7-Day Forecast',
    overview: 'Overview',
    details: 'Details',
    parameters: 'Parameters',
    trend: 'Trend',
    time: 'Time',
    unit: 'Unit'
  },

  // Task 18: Map layers
  map: {
    title: 'Map Forecast',
    layers: {
      wind: 'Wind',
      temp: 'Temperature',
      clouds: 'Clouds',
      rain: 'Rain'
    },
    // Task 18.3.3: Time control
    currentTime: 'Current Time:',
    timeNow: 'Now',
    timeSunset: 'Sunset',
    timeSunrise: 'Sunrise',
    timeHint: '💡 Tip: You can also use the forecast timeline at the bottom of the map',
    loading: 'Loading map...',
    error: 'Failed to load map',
    mockNotSupported: 'Map functionality is only available in real API mode'
  },

  // Loading states
  loading: {
    data: 'Loading data...',
    weather: 'Getting weather data...',
    prediction: 'Calculating prediction...',
    pleaseWait: 'Please wait...'
  },

  // Other
  other: {
    copyright: '© 2026 Weather Sunset Predictor',
    poweredBy: 'Powered by Windy',
    version: 'Version',
    about: 'About',
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
    contact: 'Contact Us',
    feedback: 'Feedback'
  }
};
