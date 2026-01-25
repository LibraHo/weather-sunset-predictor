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
    forecast: 'Forecast',
    temperature: 'Temperature',
    humidity: 'Humidity',
    windSpeed: 'Wind Speed',
    windDirection: 'Wind Direction',
    pressure: 'Pressure',
    visibility: 'Visibility',
    clouds: 'Clouds',
    precipitation: 'Precipitation',
    highClouds: 'High Clouds',
    midClouds: 'Mid Clouds',
    lowClouds: 'Low Clouds',
    feeling: 'Feels Like',
    uvIndex: 'UV Index'
  },

  // Prediction
  prediction: {
    title: 'Sunset Glow Prediction',
    sunrise: 'Sunrise Glow',
    sunset: 'Sunset Glow',
    score: 'Prediction Score',
    quality: 'Quality Level',
    bestTime: 'Best Viewing Time',
    analysis: 'Analysis',
    details: 'Details',

    // Quality levels
    excellent: 'Excellent',
    good: 'Good',
    fair: 'Fair',
    poor: 'Poor',

    // Status descriptions
    status: {
      noFireCloud: 'No Fire Cloud',
      highProbability: 'High probability of beautiful sunset glow',
      moderateProbability: 'Possible sunset glow',
      lowProbability: 'Unlikely to have sunset glow'
    },

    // Time periods
    goldenHour: 'Golden Hour',
    blueHour: 'Blue Hour',
    sunriseTime: 'Sunrise Time',
    sunsetTime: 'Sunset Time',

    // Canvas score
    canvas: {
      title: 'Canvas Score',
      score: 'Canvas Score',
      cloudLevel: 'Cloud Level',
      breakdown: 'Cloud Distribution'
    },

    // Light path score
    lightPath: {
      title: 'Light Path Score',
      score: 'Light Path Score',
      visibility: 'Visibility'
    },

    // Rendering score
    rendering: {
      title: 'Rendering Score',
      score: 'Rendering Score',
      humidity: 'Humidity Effect'
    },

    // Composite score
    composite: {
      title: 'Composite Score',
      finalScore: 'Final Score',
      confidence: 'Prediction Confidence'
    },

    // Cloud layers
    cloudLayers: {
      title: 'Cloud Layer Analysis',
      high: 'High Clouds (>6km)',
      mid: 'Mid Clouds (2-6km)',
      low: 'Low Clouds (<2km)',
      favorable: 'Favorable',
      unfavorable: 'Unfavorable'
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
    }
  },

  // Time
  time: {
    today: 'Today',
    tomorrow: 'Tomorrow',
    yesterday: 'Yesterday',
    week: 'Week',
    date: 'Date',
    time: 'Time'
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
    apiKeyLabel: 'Windy API Key',
    apiKeyPlaceholder: 'Enter your Windy API key',
    apiKeyHelp: 'Get API key from https://www.windy.com',
    language: 'Language',
    languageLabel: 'Interface Language',
    notifications: 'Notifications',
    notificationsLabel: 'Sunset Glow Notifications',
    notificationsHelp: 'Send notification when prediction quality is above threshold',
    notificationThreshold: 'Notification Threshold',
    favoriteLocations: 'Favorite Locations',
    searchHistory: 'Search History',
    clearHistory: 'Clear History',
    confirmClearHistory: 'Are you sure you want to clear all search history?'
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
    parameters: 'Parameters'
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
