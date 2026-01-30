/**
 * Traducción en Español
 */
export default {
  // App
  app: {
    title: 'Predictor de Atardecer',
    subtitle: 'Predecir el mejor momento para nubes rojas'
  },

  // Buttons
  buttons: {
    search: 'Buscar',
    refresh: 'Actualizar',
    save: 'Guardar',
    cancel: 'Cancelar',
    confirm: 'Confirmar',
    close: 'Cerrar',
    clear: 'Limpiar',
    delete: 'Eliminar',
    edit: 'Editar',
    useCurrentLocation: 'Usar Mi Ubicación',
    changeLanguage: 'Cambiar Idioma'
  },

  // Location
  location: {
    label: 'Ubicación',
    placeholder: 'Ingrese el nombre de la ciudad...',
    current: 'Ubicación Actual',
    searching: 'Buscando ubicación...',
    notFound: 'Ubicación no encontrada, pruebe con otro nombre',
    permissionDenied: 'No se puede obtener el permiso de ubicación, ingrésela manualmente',
    loading: 'Obteniendo ubicación...'
  },

  // Weather
  weather: {
    title: 'Información del Clima',
    current: 'Clima Actual',
    currentLocation: 'Ubicación Actual',
    noData: 'No hay datos del clima disponibles',
    forecast: 'Pronóstico',
    temperature: 'Temperatura',
    humidity: 'Humedad',
    windSpeed: 'Velocidad del Viento',
    windDirection: 'Dirección del Viento',
    pressure: 'Presión',
    visibility: 'Visibilidad',
    clouds: 'Nubes',
    cloudCover: 'Cobertura de Nubes',
    precipitation: 'Precipitación',
    highClouds: 'Nubes Altas',
    midClouds: 'Nubes Medias',
    lowClouds: 'Nubes Bajas',
    feeling: 'Sensación Térmica',
    uvIndex: 'Índice UV',

    // Weather descriptions
    overcast: 'Cubierto',
    cloudy: 'Nublado',
    partlyCloudy: 'Parcialmente Nublado',
    clear: 'Despejado',

    // Weather overview
    overview: 'Resumen',
    hourly: 'Pronóstico por Hora',
    mapView: 'Pronóstico en Mapa',
    daysOverview: 'Resumen de {{days}} Días',
    precipChance: '{{prob}}% precip',
    dataInfo: 'ℹ️ La fuente de datos proporciona {{hours}} horas de datos de pronóstico (~{{days}} días). Considere usar otras fuentes de datos del clima para más días.'
  },

  // Prediction
  prediction: {
    title: 'Predicción del Resplandor del Atardecer',
    sunrise: 'Resplandor del Amanecer',
    sunset: 'Resplandor del Atardecer',
    sunriseAndSunset: 'Predicción del Resplandor del Amanecer y Atardecer',
    score: 'Puntuación de Predicción',
    points: 'pts',
    quality: 'Nivel de Calidad',
    bestTime: 'Mejor Momento para Ver',
    analysis: 'Análisis',
    analysisTitle: '📊 Análisis',
    details: 'Detalles',
    detailedWeatherData: 'Datos Climáticos Detallados',
    noPredictionData: '⚠️ No hay datos de predicción para {{date}}',
    insufficientData: 'Datos climáticos insuficientes para generar predicción. Actualice más tarde.',
    viewFutureOrRefresh: 'Verifique las predicciones futuras o actualice los datos más tarde',
    predictionUnavailable: '⚠️ Datos climáticos insuficientes',

    // Quality levels
    excellent: 'Excelente',
    good: 'Bueno',
    fair: 'Regular',
    poor: 'Pobre',

    // Status descriptions
    status: {
      noFireCloud: 'Sin Nubes Rojas',
      lightGlow: 'Resplandor Ligero',
      goodGlow: 'Buen Resplandor',
      highProbability: 'Alta probabilidad de hermoso resplandor del atardecer',
      moderateProbability: 'Posible resplandor del atardecer',
      lowProbability: 'Poca probabilidad de resplandor del atardecer',
      skyClear: 'Cielo despejado, falta de "lienzo" para reflejar la luz',
      cloudPerfect: 'Nubes moderadas, favorables para hermosos atardeceres',
      cloudTooThick: 'Nubes demasiado gruesas, la luz solar no puede penetrar',
      cloudUnsuitable: 'Condiciones de nubes inadecuadas para la formación de nubes rojas',
      waitForClouds: 'Se recomienda esperar una cobertura de nubes moderada',
      lightPathBlocked: 'Nubes al oeste bloqueando el camino de luz',
      lightPathObstructed: 'Camino de luz obstruido',
      poorViewing: 'Condiciones de observación deficientes',
      conditionsFair: 'Condiciones regulares, posiblemente colores dispersos',
      canWatch: 'Se puede observar',
      conditionsGood: 'Buenas condiciones con cierto valor de observación',
      veryLikely: 'Alta probabilidad de hermoso atardecer',
      excellentConditions: 'Nubes moderadas con camino de luz claro',
      legendaryEruption: 'Erupción legendaria',
      perfectMidHighClouds: 'Nubes medias-altas perfectas con camino de luz claro',
      highlyRecommended: '¡Muy recomendable para ver!'
    },

    // Time periods
    goldenHour: '🌟 Hora Dorada',
    blueHour: '🌌 Hora Azul',
    sunAzimuth: '🧭 Azimut Solar',
    sunriseTime: 'Hora del Amanecer',
    sunsetTime: 'Hora del Atardecer',
    bestViewingTime: 'Mejor Momento para Ver',

    // Best viewing window descriptions
    bestViewingWindowSunrise: '30 minutos antes y después del amanecer es el mejor momento para ver el resplandor del amanecer',
    bestViewingWindowSunset: '30 minutos antes y después del atardecer es el mejor momento para ver el resplandor del atardecer',

    // Canvas score
    canvas: {
      title: 'Puntuación del Lienzo',
      score: 'Puntuación del Lienzo',
      cloudLevel: 'Nivel de Nubes',
      breakdown: 'Distribución de Nubes',
      canvasScore: '📊 Lienzo: {{score}}pts | {{level}}',
      cloudBreakdown: 'Altas {{high}}% Medias {{mid}}% Bajas {{low}}%',
      lowCloudPenalty: '| Penalización de nubes bajas: {{reason}}'
    },

    // Light path score
    lightPath: {
      title: 'Puntuación del Trayecto de Luz',
      score: 'Puntuación del Trayecto de Luz',
      visibility: 'Visibilidad',
      lightPathScore: '🌅 Trayecto de luz: {{score}}pts (150km:{{near}} 300km:{{far}})'
    },

    // Rendering score
    rendering: {
      title: 'Puntuación de Renderizado',
      score: 'Puntuación de Renderizado',
      humidity: 'Efecto de Humedad',
      renderingFactor: '🎨 Factor de renderizado: {{factor}} | {{visibility}} | {{aqi}} | {{color}}',
      specialMode: '| {{mode}}'
    },

    // Composite score
    composite: {
      title: 'Puntuación Compuesta',
      finalScore: 'Puntuación Final',
      confidence: 'Confianza de la Predicción'
    },

    // Cloud layers
    cloudLayers: {
      title: '☁️ Información de Capas de Nubes',
      highCloudLabel: '⛅ Nubes Altas (>6km)',
      midCloudLabel: '☁️ Nubes Medias (2-6km)',
      lowCloudLabel: '🌫️ Nubes Bajas (<2km)',
      high: 'Nubes Altas (>6km)',
      mid: 'Nubes Medias (2-6km)',
      low: 'Nubes Bajas (<2km)',
      favorable: 'Favorable',
      unfavorable: 'Desfavorable',
      cloudAnalysis: 'Análisis de nubes:',
      description: 'Altas {{high}}% Medias {{mid}}% Bajas {{low}}%'
    },

    // Descriptions
    descriptions: {
      skyClear: 'Cielo despejado, falta "lienzo" para reflejar la luz',
      cloudPerfect: 'Nubes moderadas, favorables para hermoso resplandor del atardecer',
      lowCloudHeavy: 'Demasiadas nubes bajas, pueden bloquear el resplandor del atardecer',
      highHumidity: 'Humedad demasiado alta, puede afectar la visibilidad',
      lowHumidity: 'Humedad demasiado baja, las nubes pueden ser muy delgadas',
      goodVisibility: 'Excelente visibilidad, buenas condiciones de visualización',
      poorVisibility: 'Pobre visibilidad, puede afectar la experiencia de visualización'
    },

    // Fire cloud analysis
    fireCloud: {
      title: '🔥 Índice de Nubes Rojas: {{score}}/100{{level}}',
      excellent: ' (Excelente)',
      good: ' (Bueno)',
      fair: ' (Regular)',
      poor: ' (Pobre)',
      analysisTitle: '🔥 Análisis de Condiciones de Formación de Nubes Rojas:',
      idealCloud: '✅ Cobertura de nubes ideal ({{value}}%), puede reflejar completamente la luz solar',
      slightlyLowCloud: '⚠️ Cobertura de nubes ligeramente baja ({{value}}%), el efecto de nubes rojas puede ser pálido',
      tooMuchCloud: '⚠️ Demasiada cobertura de nubes ({{value}}%), puede bloquear la luz solar',
      severelyLowCloud: '❌ Cobertura de nubes severamente baja ({{value}}%), no puede formar nubes rojas',
      idealHumidity: '✅ Humedad ideal ({{value}}%), favorable para la dispersión de luz',
      slightlyLowHumidity: '⚠️ Humedad ligeramente baja ({{value}}%), los colores pueden no ser lo suficientemente vibrantes',
      slightlyHighHumidity: '⚠️ Humedad ligeramente alta ({{value}}%), puede afectar la saturación del color',
      severelyLowHumidity: '❌ Humedad severamente baja ({{value}}%), dispersión de luz débil',
      excellentVisibility: '✅ Excelente visibilidad ({{value}} km), vista clara',
      goodVisibility: '✅ Buena visibilidad ({{value}} km), buena experiencia de visualización',
      fairVisibility: '⚠️ Visibilidad regular ({{value}} km), los colores pueden estar un poco tenues',
      poorVisibility: '❌ Pobre visibilidad ({{value}} km), neblina afectando la vista',
      sparseLowCloud: '✅ Nubes bajas escasas ({{value}}%), no bloquearán las nubes rojas',
      littleLowCloud: '✅ Pocas nubes bajas ({{value}}%), impacto mínimo en la visualización',
      someLowCloud: '⚠️ Algunas nubes bajas ({{value}}%), pueden bloquear parcialmente la vista',
      denseLowCloud: '❌ Nubes bajas densas ({{value}}%), afectando seriamente la visualización',
      excellentConditions: '🌟 ¡Se cumplen todas las condiciones para magníficas nubes rojas!',
      highProbability: '✨ Alta probabilidad de paisajes espectaculares de nubes rojas',
      moderateProbability: '💫 Posibles efectos leves de nubes rojas',
      lowProbability: '⛅ Baja probabilidad de nubes rojas significativas',
      noCloudNoFireCloud: '❌ Cobertura de nubes severamente insuficiente, no puede formar nubes rojas',
      tooMuchCloud: '❌ Demasiada cobertura de nubes, el bloqueo de luz solar previene nubes rojas'
    },

    // Overall evaluation
    overallEvaluation: {
      excellent: '¡Las condiciones climáticas en {{date}} son excelentes para ver {{type}}!<br><br>',
      good: 'Las condiciones climáticas en {{date}} son bastante adecuadas para ver {{type}}.<br><br>',
      fair: 'Las condiciones climáticas en {{date}} no son ideales.<br><br>',
      idealCloud: ' Cobertura de nubes ideal ({{value}}%), favorable para formar colores brillantes.<br>',
      lowCloud: ' Cobertura de nubes baja ({{value}}%), puede carecer de suficientes nubes para reflejar la luz.<br>',
      highCloud: ' Cobertura de nubes alta ({{value}}%), puede bloquear demasiada luz solar.<br>',
      idealHumidity: ' Humedad ideal ({{value}}%), el vapor de agua en el aire ayuda a la dispersión de luz.<br>',
      lowHumidity: ' Humedad baja ({{value}}%), el aire es relativamente seco.<br>',
      highHumidity: ' Humedad alta ({{value}}%), puede afectar la visibilidad.<br>',
      excellentVisibility: ' Buena visibilidad ({{value}} km), vista clara.<br>',
      fairVisibility: ' Visibilidad regular ({{value}} km)<br>',
      poorVisibility: ' Pobre visibilidad ({{value}} km), posible neblina.<br>',
      sparseLowCloud: ' Pocas nubes de nivel bajo, no bloquearán la vista.',
      someLowCloud: ' Algunas nubes de nivel bajo, pueden afectar ligeramente la experiencia de visualización.',
      denseLowCloud: ' Muchas nubes de nivel bajo ({{value}}%), pueden bloquear parcialmente la vista.'
    },

    // Future predictions
    passed: 'Pasado',
    forecast: 'Pronóstico Futuro'
  },

  // Tarea 19: Visualización de nubes de fuego circundantes
  surrounding: {
    title: 'Análisis de Nubes de Fuego Circundantes',
    radius: 'Radio de Detección',
    radiusUnit: 'km',
    directions: {
      N: 'Norte',
      NE: 'Noreste',
      E: 'Este',
      SE: 'Sureste',
      S: 'Sur',
      SW: 'Suroeste',
      W: 'Oeste',
      NW: 'Noroeste'
    },
    loading: 'Cargando datos meteorológicos circundantes...',
    error: 'Error al cargar datos circundantes',
    noData: 'No hay datos circundantes disponibles',
    clickToView: 'Haga clic en dirección para ver detalles',
    viewingDirection: 'Viendo dirección {{direction}}',
    distanceInfo: '{{distance}}km',
    recommendation: 'Recomendación de Visualización',
    bestDirections: 'Mejores Direcciones para Ver',
    scoreBreakdown: 'Puntuaciones por Dirección',
    legend: {
      excellent: 'Excelente (≥80)',
      good: 'Bueno (60-79)',
      fair: 'Regular (40-59)',
      poor: 'Pobre (<40)'
    },
    fallbackMessage: 'Su navegador no soporta Canvas, usando vista de tabla'
  },

  // Time
  time: {
    today: 'Hoy',
    tomorrow: 'Mañana',
    yesterday: 'Ayer',
    dayAfterTomorrow: 'Pasado Mañana',
    daysLater: '{{days}} días después',
    week: 'Semana',
    date: 'Fecha',
    time: 'Hora'
  },

  // Date
  date: {
    today: 'Hoy',
    tomorrow: 'Mañana',
    dayAfterTomorrow: 'Pasado Mañana',
    format: '{{month}}/{{day}}'
  },

  // Date buttons
  dates: {
    today: 'Hoy',
    tomorrow: 'Mañana'
  },

  // Future forecast
  forecast: {
    title: 'Pronóstico Futuro'
  },

  // Common text
  common: {
    loading: 'Cargando...',
    dataSource: 'Fuente de datos: Windy API'
  },

  // Error messages
  errors: {
    title: 'Error',
    networkError: 'Error de conexión de red, verifique su configuración de red',
    apiError: 'Fallo en la llamada a la API, inténtelo de nuevo más tarde',
    apiKeyMissing: 'Configure primero la clave API de Windy',
    apiKeyInvalid: 'Clave API inválida, verifique la configuración',
    timeout: 'Tiempo de espera agotado, reintente',
    unknownError: 'Ocurrió un error desconocido, reintente',
    locationError: 'Falló la resolución de ubicación, pruebe con un nombre diferente',
    mapInitFailed: 'Fallo en la inicialización del mapa'
  },

  // Settings
  settings: {
    title: 'Configuración',
    apiKey: 'Clave API',
    apiKeyLabel: 'Configurar Clave API de Windy',
    apiKeyPlaceholder: 'Ingrese la clave API',
    apiKeyHelp: 'Ingrese su clave API de Windy para usar las funciones de predicción climática',
    language: 'Idioma',
    languageLabel: 'Idioma de la Interfaz',
    notifications: 'Notificaciones',
    notificationsTitle: 'Configuración de Notificaciones',
    notificationsLabel: 'Notificaciones de Resplandor del Atardecer',
    notificationsDescription: 'Configurar alertas de predicción de alta calidad',
    notificationsHelp: 'Enviar notificación cuando la calidad de predicción esté por encima del umbral',
    enableNotifications: 'Activar alertas de notificación',
    thresholdLabel: 'Umbral de puntuación (alertar cuando la puntuación ≥ este valor)',
    testNotification: 'Probar Notificación',
    notificationThreshold: 'Umbral de Notificación',
    favoriteLocations: 'Ubicaciones Favoritas',
    searchHistory: 'Historial de Búsqueda',
    clearHistory: 'Limpiar Historial',
    confirmClearHistory: '¿Está seguro de que desea limpiar todo el historial de búsqueda?',
    // Panel de Configuración Unificado
    close: 'Cerrar',
    done: 'Hecho',
    // Fuente de Datos y Red
    dataSource: 'Fuente de Datos y Red',
    apiMode: 'Modo de Acceso API',
    apiModeProxy: 'Proxy Backend',
    apiModeDirect: 'Modo Directo',
    apiModeProxyRecommended: 'Proxy Backend (Recomendado)',
    currentMode: 'Modo Actual',
    proxyUrl: 'URL del Servidor Proxy',
    proxyUrlPlaceholder: 'http://localhost:3000',
    proxyUrlHint: 'Dirección URL del servidor proxy backend',
    apiModeHint: '• Proxy Backend: Acceder a la API Windy a través del servidor, clave API almacenada de forma segura en el backend<br>• Modo Directo: Acceso frontend directo, requiere que configure la clave API',
    // Notificaciones y Alertas
    notificationAndAlerts: 'Notificaciones y Alertas',
    enableSunsetNotification: 'Activar notificaciones de atardecer',
    notificationHint: 'Enviar notificación del navegador cuando la calidad de predicción alcance el umbral',
    notificationThresholdLabel: 'Umbral de Notificación',
    notificationThresholdHint: 'Enviar notificación cuando la puntuación de predicción sea superior a este valor',
    // Idioma y Visualización
    languageAndDisplay: 'Idioma y Visualización',
    interfaceLanguage: 'Idioma de la Interfaz',
    // Personalización
    personalization: 'Personalización',
    themeMode: 'Modo de Tema',
    themeLight: 'Modo Claro',
    themeDark: 'Modo Oscuro',
    themeAuto: 'Automático',
    temperatureUnit: 'Unidad de Temperatura',
    tempCelsius: 'Celsius (℃)',
    tempFahrenheit: 'Fahrenheit (℉)',
    windSpeedUnit: 'Unidad de Velocidad del Viento',
    windKmh: 'km/h',
    windMs: 'm/s',
    // Ubicación predeterminada
    defaultLocation: 'Ubicación Predeterminada',
    noDefaultLocation: 'Sin ubicación predeterminada',
    setAsDefault: 'Establecer como Predeterminada',
    currentDefaultLocation: 'Ubicación Predeterminada Actual',
    defaultLocationHint: 'Establecer la ubicación para cargar automáticamente al inicio'
  },

  // Language selector
  languageSelector: {
    title: 'Seleccionar Idioma',
    confirmChange: 'Confirmar Cambio de Idioma',
    confirmChangeMessage: 'La interfaz se actualizará después de cambiar el idioma. Los datos actuales no se perderán. ¿Continuar?',
    selectLanguage: 'Seleccione el idioma de la interfaz'
  },

  // Notifications
  notifications: {
    title: 'Alerta de Resplandor del Atardecer',
    excellentForecast: 'Puntuación de predicción del resplandor del atardecer de esta noche: {{score}}, ¡excelente para observar!',
    goodForecast: 'Puntuación de predicción del resplandor del atardecer de esta noche: {{score}}, ¡vale la pena esperar!',
    time: 'Hora: {{time}}',
    location: 'Ubicación: {{location}}',
    enable: 'Activar Notificaciones',
    disable: 'Desactivar Notificaciones',
    permissionDenied: 'Permiso de notificación denegado, permita las notificaciones en la configuración del navegador',
    permissionGranted: 'Permiso de notificación otorgado',
    threshold: 'Notificar cuando la puntuación esté por encima de {{threshold}}'
  },

  // Favorite locations
  favorites: {
    title: 'Ubicaciones Favoritas',
    add: 'Agregar a Favoritos',
    remove: 'Eliminar de Favoritos',
    removeConfirm: '¿Está seguro de que desea eliminar esta ubicación favorita?',
    empty: 'Aún no hay ubicaciones favoritas',
    manage: 'Administrar Favoritos'
  },

  // Search history
  history: {
    title: 'Historial de Búsqueda',
    empty: 'Aún no hay historial de búsqueda',
    clearAll: 'Limpiar Todo',
    clearConfirm: '¿Está seguro de que desea limpiar todo el historial de búsqueda?'
  },

  // Weather charts
  charts: {
    temperature: 'Temperatura',
    precipitation: 'Precipitación',
    humidity: 'Humedad',
    wind: 'Viento',
    pressure: 'Presión',
    clouds: 'Nubes',
    hourly: 'Pronóstico de 24 Horas',
    daily: 'Pronóstico de 7 Días',
    overview: 'Resumen',
    details: 'Detalles',
    parameters: 'Parámetros',
    trend: 'Tendencia',
    time: 'Hora',
    unit: 'Unidad'
  },

  // Tarea 18: Capas del mapa
  map: {
    title: 'Pronóstico en Mapa',
    layers: {
      wind: 'Viento',
      temp: 'Temperatura',
      clouds: 'Nubes',
      rain: 'Lluvia'
    },
    // Tarea 18.3.3: Control de tiempo
    currentTime: 'Hora Actual:',
    timeNow: 'Ahora',
    timeSunset: 'Atardecer',
    timeSunrise: 'Amanecer',
    timeHint: '💡 Consejo: También puedes usar la línea de tiempo de pronóstico en la parte inferior del mapa',
    loading: 'Cargando mapa...',
    error: 'Error al cargar el mapa',
    mockNotSupported: 'La funcionalidad del mapa solo está disponible en modo API real'
  },

  // Loading states
  loading: {
    data: 'Cargando datos...',
    weather: 'Obteniendo datos del clima...',
    prediction: 'Calculando predicción...',
    pleaseWait: 'Espere por favor...'
  },

  // Other
  other: {
    copyright: '© 2026 Predictor de Atardecer',
    poweredBy: 'Desarrollado por Windy',
    version: 'Versión',
    about: 'Acerca de',
    privacy: 'Política de Privacidad',
    terms: 'Términos de Servicio',
    contact: 'Contáctenos',
    feedback: 'Comentarios'
  }
};
