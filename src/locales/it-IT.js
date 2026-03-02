/**
 * Traduzione Italiana
 */
export default {
  app: {
    title: 'Sunset Voyager',
    subtitle: 'Prevedere il momento migliore per le nuvole rosse'
  },
  // Schede & metodologia
  home: {
    tabs: {
      ariaLabel: 'Navigazione a schede',
      forecast: 'Previsioni',
      methodology: 'Metodologia di calcolo'
    },
    menu: {
      ariaLabel: 'Cambia vista',
      dropdownAriaLabel: 'Menu di navigazione'
    },
    methodology: {
      title: 'Come viene calcolato il punteggio',
      intro: "L'indice nuvole rosse combina quattro fattori chiave per stimare se vale la pena osservare il tramonto.",
      factors: {
        highMidCloudTitle: 'Nuvole medie/alte (tela)',
        highMidCloudDesc: 'Una copertura equilibrata di nuvole medie e alte favorisce ricche sfumature arancio-rosse; troppo poche o spesse penalizzano l\'effetto.',
        lowCloudTitle: 'Nuvole basse (penalità)',
        lowCloudDesc: 'Un eccesso di nuvole basse può bloccare la luce vicino all\'orizzonte, causa principale di un tramonto deludente.',
        humidityTitle: 'Umidità (intensità colore)',
        humidityDesc: "L'umidità moderata arricchisce i colori; troppa può creare foschia, troppo poca li rende sbiaditi.",
        visibilityTitle: 'Visibilità (nitidezza)',
        visibilityDesc: 'Una visibilità maggiore significa generalmente un cielo più limpido e transizioni di colore più nette.'
      },
      scoreGuideTitle: 'Guida al punteggio',
      scoreExcellent: 'Eccellente: >70 (uscire consigliato)',
      scoreGood: 'Buono: 40-70 (vale la pena)',
      scoreFair: 'Sufficiente: <40 (aspettative moderate)'
    }
  },
  buttons: {
    search: 'Cerca',
    refresh: 'Aggiorna',
    save: 'Salva',
    cancel: 'Annulla',
    confirm: 'Conferma',
    close: 'Chiudi',
    clear: 'Cancella',
    delete: 'Elimina',
    edit: 'Modifica',
    useCurrentLocation: 'Usa La Mia Posizione',
    changeLanguage: 'Cambia Lingua'
  },
  location: {
    label: 'Posizione',
    placeholder: 'Inserisci il nome della città...',
    current: 'Posizione Attuale',
    searching: 'Ricerca della posizione...',
    notFound: 'Posizione non trovata, prova con un altro nome',
    permissionDenied: 'Impossibile ottenere la posizione, inseriscila manualmente',
    loading: 'Ottenimento della posizione...'
  },
  weather: {
    title: 'Informazioni Meteo',
    current: 'Meteo Attuale',
    currentLocation: 'Posizione Attuale',
    noData: 'Nessun dato meteo disponibile',
    forecast: 'Previsioni',
    temperature: 'Temperatura',
    humidity: 'Umidità',
    windSpeed: 'Velocità del Vento',
    windDirection: 'Direzione del Vento',
    pressure: 'Pressione',
    visibility: 'Visibilità',
    clouds: 'Nuvole',
    cloudCover: 'Copertura Nuvolosa',
    precipitation: 'Precipitazioni',
    highClouds: 'Nuvole Alte',
    midClouds: 'Nuvole Medie',
    lowClouds: 'Nuvole Basse',
    feeling: 'Percepito',
    uvIndex: 'Indice UV',
    overcast: 'Coperto',
    cloudy: 'Nuvoloso',
    partlyCloudy: 'Parzialmente Nuvoloso',
    clear: 'Limpido',
    overview: 'Panoramica',
    hourly: 'Previsione Oraria',
    daysOverview: 'Panoramica {{days}} Giorni',
    precipChance: '{{prob}}% precip',
    dataInfo: 'ℹ️ La fonte dati fornisce {{hours}} ore di dati di previsione (~{{days}} giorni). Considera l\'uso di altre fonti dati meteo per più giorni.'
  },
  prediction: {
    title: 'Previsione del Tramonto',
    sunrise: 'Luminosità dell\'Alba',
    sunset: 'Luminosità del Tramonto',
    sunriseAndSunset: 'Previsione Luminosità Alba e Tramonto',
    score: 'Punteggio di Previsione',
    points: 'punti',
    quality: 'Livello di Qualità',
    bestTime: 'Momento Migliore per Osservare',
    analysis: 'Analisi',
    analysisTitle: '📊 Analisi',
    details: 'Dettagli',
    detailedWeatherData: 'Dati Meteo Dettagliati',
    noPredictionData: '⚠️ Nessun dato di previsione {{date}} disponibile',
    insufficientData: 'Dati meteo insufficienti per generare la previsione. Aggiorna più tardi.',
    viewFutureOrRefresh: 'Controlla le previsioni future o aggiorna i dati più tardi',
    predictionUnavailable: '⚠️ Dati meteo insufficienti',
    excellent: 'Eccellente',
    good: 'Buono',
    fair: 'Discreto',
    poor: 'Scarso',
    status: {
      noFireCloud: 'Nessuna Nuvola Rossa',
      lightGlow: 'Luce Leggera',
      goodGlow: 'Buona Luce',
      highProbability: 'Alta probabilità di bellissimo tramonto',
      moderateProbability: 'Possibile tramonto',
      lowProbability: 'Improbabile vedere il tramonto',
      skyClear: 'Cielo sereno, manca la "tela" per riflettere la luce',
      cloudPerfect: 'Nubi moderate, favorevoli per bellissimi tramonti',
      cloudTooThick: 'Nubi troppo spesse, la luce solare non può penetrare',
      cloudUnsuitable: 'Condizioni nuvolose inadatte alla formazione di nuvole rosse',
      waitForClouds: 'Si consiglia di attendere una copertura nuvolosa moderata',
      lightPathBlocked: 'Nubi a ovest che bloccano il percorso della luce',
      lightPathObstructed: 'Percorso della luce ostruito',
      poorViewing: 'Condizioni di osservazione scarse',
      conditionsFair: 'Condizioni discrete, possibili colori sparsi',
      canWatch: 'Può essere osservato',
      conditionsGood: 'Buone condizioni con un certo valore di osservazione',
      veryLikely: 'Alta probabilità di bellissimo tramonto',
      excellentConditions: 'Nubi moderate con percorso della luce chiaro',
      legendaryEruption: 'Eruzione leggendaria',
      perfectMidHighClouds: 'Nuve medio-alte perfette con percorso della luce chiaro',
      highlyRecommended: 'Fortemente raccomandato da guardare!'
    },
    goldenHour: '🌟 Ora Dorata',
    blueHour: '🌌 Ora Blu',
    sunAzimuth: '🧭 Azimut Solare',
    sunriseTime: 'Ora dell\'Alba',
    sunsetTime: 'Ora del Tramonto',
    bestViewingTime: 'Momento Migliore per Osservare',
    bestViewingWindowSunrise: '30 minuti prima e dopo l\'alba è il momento migliore per osservare l\'alba',
    bestViewingWindowSunset: '30 minuti prima e dopo il tramonto è il momento migliore per osservare il tramonto',
    canvas: {
      title: 'Punteggio Tela',
      score: 'Punteggio Tela',
      cloudLevel: 'Livello Nuvoloso',
      breakdown: 'Distribuzione Nuvole',
      canvasScore: '📊 Tela: {{score}}pt | {{level}}',
      cloudBreakdown: 'Alte {{high}}% Medie {{mid}}% Basse {{low}}%',
      lowCloudPenalty: '| Penalità nuvole basse: {{reason}}'
    },
    lightPath: {
      title: 'Punteggio Percorso Luminoso',
      score: 'Punteggio Percorso Luminoso',
      visibility: 'Visibilità',
      lightPathScore: '🌅 Percorso luminoso: {{score}}pt (150km:{{near}} 300km:{{far}})'
    },
    rendering: {
      title: 'Punteggio Resa',
      score: 'Punteggio Resa',
      humidity: 'Effetto Umidità',
      renderingFactor: '🎨 Fattore di resa: {{factor}} | {{visibility}} | {{aqi}} | {{color}}',
      specialMode: '| {{mode}}'
    },
    composite: {
      title: 'Punteggio Composito',
      finalScore: 'Punteggio Finale',
      confidence: 'Fiducia Previsione'
    },
    cloudLayers: {
      title: '☁️ Informazioni Strato Nuvoloso',
      highCloudLabel: '⛅ Nuvole Alte (>6km)',
      midCloudLabel: '☁️ Nuvole Medie (2-6km)',
      lowCloudLabel: '🌫️ Nuvole Basse (<2km)',
      high: 'Nuvole Alte (>6km)',
      mid: 'Nuvole Medie (2-6km)',
      low: 'Nuvole Basse (<2km)',
      favorable: 'Favorevole',
      unfavorable: 'Sfavorevole',
      cloudAnalysis: 'Analisi nuvole:',
      description: 'Alte {{high}}% Medie {{mid}}% Basse {{low}}%'
    },
    descriptions: {
      skyClear: 'Cielo limpido, manca la "tela" per riflettere la luce',
      cloudPerfect: 'Nuvole moderate, favorevoli per bellissimo tramonto',
      lowCloudHeavy: 'Troppe nuvole basse, potrebbero bloccare il tramonto',
      highHumidity: 'Umidità troppo alta, potrebbe influenzare la visibilità',
      lowHumidity: 'Umidità troppo bassa, le nuvole potrebbero essere troppo sottili',
      goodVisibility: 'Eccellente visibilità, buone condizioni di osservazione',
      poorVisibility: 'Scarsa visibilità, potrebbe influenzare l\'esperienza di osservazione'
    },
    fireCloud: {
      title: '🔥 Indice Nuvole Rosse: {{score}}/100{{level}}',
      excellent: ' (Eccellente)',
      good: ' (Buono)',
      fair: ' (Discreto)',
      poor: ' (Scarso)',
      analysisTitle: '🔥 Analisi Condizioni Formazione Nuvole Rosse:',
      idealCloud: '✅ Copertura nuvolosa ideale ({{value}}%), può riflettere completamente la luce solare',
      slightlyLowCloud: '⚠️ Copertura nuvolosa leggermente bassa ({{value}}%), l\'effetto nuvole rosse potrebbe essere pallido',
      tooMuchCloud: '⚠️ Troppa copertura nuvolosa ({{value}}%), potrebbe bloccare la luce solare',
      severelyLowCloud: '❌ Copertura nuvolosa gravemente bassa ({{value}}%), non può formare nuvole rosse',
      idealHumidity: '✅ Umidità ideale ({{value}}%), favorevole per la dispersione della luce',
      slightlyLowHumidity: '⚠️ Umidità leggermente bassa ({{value}}%), i colori potrebbero non essere abbastanza vivaci',
      slightlyHighHumidity: '⚠️ Umidità leggermente alta ({{value}}%), potrebbe influenzare la saturazione dei colori',
      severelyLowHumidity: '❌ Umidità gravemente bassa ({{value}}%), debole dispersione della luce',
      excellentVisibility: '✅ Eccellente visibilità ({{value}} km), vista chiara',
      goodVisibility: '✅ Buona visibilità ({{value}} km), buona esperienza di osservazione',
      fairVisibility: '⚠️ Visibilità discreta ({{value}} km), i colori potrebbero essere leggermente spenti',
      poorVisibility: '❌ Scarsa visibilità ({{value}} km), nebbia che influisce sulla vista',
      sparseLowCloud: '✅ Nuvole basse sparse ({{value}}%), non bloccheranno le nuvole rosse',
      littleLowCloud: '✅ Poche nuvole basse ({{value}}%), impatto minimo sull\'osservazione',
      someLowCloud: '⚠️ Alcune nuvole basse ({{value}}%), potrebbero bloccare parzialmente la vista',
      denseLowCloud: '❌ Nuvole basse dense ({{value}}%), influenzano seriamente l\'osservazione',
      excellentConditions: '🌟 Tutte le condizioni per magnifiche nuvole rosse sono soddisfatte!',
      highProbability: '✨ Alta probabilità di spettacolare scenario di nuvole rosse',
      moderateProbability: '💫 Possibili lievi effetti di nuvole rosse',
      lowProbability: '⛅ Bassa probabilità di nuvole rosse significative',
      noCloudNoFireCloud: '❌ Copertura nuvolosa gravemente insufficiente, non può formare nuvole rosse',
      tooMuchCloud: '❌ Troppa copertura nuvolosa, il blocco della luce solare impedisce le nuvole rosse'
    },
    overallEvaluation: {
      excellent: 'Le condizioni meteo del {{date}} sono eccellenti per osservare {{type}}!<br><br>',
      good: 'Le condizioni meteo del {{date}} sono piuttosto adatte per osservare {{type}}.<br><br>',
      fair: 'Le condizioni meteo del {{date}} non sono ideali.<br><br>',
      idealCloud: ' Copertura nuvolosa ideale ({{value}}%), favorevole per formare colori brillanti.<br>',
      lowCloud: ' Bassa copertura nuvolosa ({{value}}%), potrebbe mancare nuvole sufficienti per riflettere la luce.<br>',
      highCloud: ' Alta copertura nuvolosa ({{value}}%), potrebbe bloccare troppa luce solare.<br>',
      idealHumidity: ' Umidità ideale ({{value}}%), il vapore acqueo nell\'aria aiuta la dispersione della luce.<br>',
      lowHumidity: ' Bassa umidità ({{value}}%), l\'aria è relativamente secca.<br>',
      highHumidity: ' Alta umidità ({{value}}%), potrebbe influenzare la visibilità.<br>',
      excellentVisibility: ' Buona visibilità ({{value}} km), vista chiara.<br>',
      fairVisibility: ' Visibilità discreta ({{value}} km)<br>',
      poorVisibility: ' Scarsa visibilità ({{value}} km), possibile nebbia.<br>',
      sparseLowCloud: ' Poche nuvole di basso livello, non bloccheranno la vista.',
      someLowCloud: ' Alcune nuvole di basso livello, potrebbero influenzare leggermente l\'esperienza di osservazione.',
      denseLowCloud: ' Molte nuvole di basso livello ({{value}}%), potrebbero bloccare parzialmente la vista.'
    },
    passed: 'Passato',
    forecast: 'Previsione Futura'
  },
  time: {
    today: 'Oggi',
    tomorrow: 'Domani',
    yesterday: 'Ieri',
    dayAfterTomorrow: 'Dopodomani',
    daysLater: '{{days}} giorni dopo',
    week: 'Settimana',
    date: 'Data',
    time: 'Ora'
  },
  date: {
    today: 'Oggi',
    tomorrow: 'Domani',
    dayAfterTomorrow: 'Dopodomani',
    format: '{{month}}/{{day}}'
  },
  dates: {
    today: 'Oggi',
    tomorrow: 'Domani'
  },
  forecast: {
    title: 'Previsione Futura'
  },
  common: {
    loading: 'Caricamento...',
    dataSource: 'Fonte dati: Windy API',
    visitorCount: 'Visitatori: '
  },
  errors: {
    title: 'Errore',
    networkError: 'Errore di connessione di rete, controlla le impostazioni di rete',
    apiError: 'Chiamata API fallita, riprova più tardi',
    apiKeyMissing: 'Configura prima la chiave API Windy',
    apiKeyInvalid: 'Chiave API non valida, controlla la configurazione',
    timeout: 'Timeout della richiesta, riprova',
    unknownError: 'Errore sconosciuto, riprova',
    locationError: 'Risoluzione posizione fallita, prova con un nome diverso',
    mapInitFailed: 'Inizializzazione della mappa non riuscita'
  },
  settings: {
    title: 'Impostazioni',
    apiKey: 'Chiave API',
    apiKeyLabel: 'Configura Chiave API Windy',
    apiKeyPlaceholder: 'Inserisci chiave API',
    apiKeyHelp: 'Inserisci la tua chiave API Windy per utilizzare le funzioni di previsione meteo',
    language: 'Lingua',
    languageLabel: 'Lingua Interfaccia',
    notifications: 'Notifiche',
    notificationsTitle: 'Impostazioni Notifiche',
    notificationsLabel: 'Notifiche Tramonto',
    notificationsDescription: 'Configura avvisi per previsioni di alta qualità',
    notificationsHelp: 'Invia notifica quando la qualità della previsione supera la soglia',
    enableNotifications: 'Attiva avvisi notifica',
    thresholdLabel: 'Soglia punteggio (avvisa quando punteggio ≥ questo valore)',
    testNotification: 'Test Notifica',
    notificationThreshold: 'Soglia Notifica',
    favoriteLocations: 'Posizioni Preferite',
    searchHistory: 'Cronologia Ricerche',
    clearHistory: 'Cancella Cronologia',
    confirmClearHistory: 'Sei sicuro di voler cancellare tutta la cronologia delle ricerche?',
    // Pannello Impostazioni Unificato
    close: 'Chiudi',
    done: 'Fatto',
    // Fonte Dati & Rete
    dataSource: 'Fonte Dati & Rete',
    currentMode: 'Modalità Attuale',
    proxyUrl: 'URL Server Proxy',
    proxyUrlPlaceholder: 'http://localhost:3000',
    proxyUrlHint: 'Indirizzo URL del server proxy backend',
    // Notifiche e Avvisi
    notificationAndAlerts: 'Notifiche e Avvisi',
    enableSunsetNotification: 'Attiva notifiche tramonto',
    notificationHint: 'Invia notifica del browser quando la qualità della previsione raggiunge la soglia',
    notificationThresholdLabel: 'Soglia Notifica',
    notificationThresholdHint: 'Invia notifica quando il punteggio di previsione è superiore a questo valore',
    // Lingua e Visualizzazione
    languageAndDisplay: 'Lingua e Visualizzazione',
    interfaceLanguage: 'Lingua Interfaccia',
    // Personalizzazione
    personalization: 'Personalizzazione',
    themeMode: 'Modalità Tema',
    themeLight: 'Modalità Chiara',
    themeDark: 'Modalità Scura',
    themeAuto: 'Automatico',
    temperatureUnit: 'Unità Temperatura',
    tempCelsius: 'Celsius (℃)',
    tempFahrenheit: 'Fahrenheit (℉)',
    windSpeedUnit: 'Unità Velocità Vento',
    windKmh: 'km/h',
    windMs: 'm/s',
    // Location service (Req 24)
    geocodingService: 'Location Service',
    geocodingMode: 'Mode',
    geocodingModeBackend: 'Backend Proxy (Recommended)',
    geocodingModeDirect: 'Frontend Direct',
    geocodingProvider: 'Provider',
    geocodingBackendNominatim: 'Nominatim / OSM (Recommended, Free)',
    geocodingBackendGaode: 'Amap / Gaode (China Optimized, Free) 🇨🇳',
    geocodingBackendGoogle: 'Google Maps (Paid Key Required)',
    geocodingDirectNominatim: 'Nominatim / OSM (Direct, May Be Blocked in China)',
    geocodingDirectGoogle: 'Google Maps (Direct, Not Available in China)',
    geocodingApiKey: 'API Key',
    geocodingApiKeyPlaceholder: 'Enter API Key',
    geocodingApiKeyHint: 'Get free Amap key at: lbs.amap.com',
    geocodingApiKeyRequired: 'Please enter an API Key in Settings first',
    geocodingChinaTag: '🇨🇳 Available in China',
    // Windy API Key (Req 25)
    windyApiKeyMode: 'Windy API Source',
    windyApiKeyModeSystem: 'Use System API (Recommended)',
    windyApiKeyModeCustom: 'Use My API Key',
    windyApiKeyCustom: 'My Windy API Key',
    windyApiKeyCustomPlaceholder: 'Enter Windy Point Forecast API Key',
    windyApiKeyCustomHint: 'Get key at: windy.com/developer',
    windyApiKeyInvalid: 'Invalid API Key format (length must be > 8 characters)'
  },
  languageSelector: {
    title: 'Seleziona Lingua',
    confirmChange: 'Conferma Cambio Lingua',
    confirmChangeMessage: 'L\'interfaccia verrà aggiornata dopo il cambio lingua. I dati attuali non andranno persi. Continuare?',
    selectLanguage: 'Seleziona la lingua dell\'interfaccia'
  },
  notifications: {
    title: 'Avviso Tramonto',
    excellentForecast: 'Punteggio di previsione stasera: {{score}} punti, ottimo per osservare!',
    goodForecast: 'Punteggio di previsione stasera: {{score}} punti, vale la pena aspettare!',
    time: 'Ora: {{time}}',
    location: 'Posizione: {{location}}',
    enable: 'Attiva Notifiche',
    disable: 'Disattiva Notifiche',
    permissionDenied: 'Permesso notifica negato, consenti le notifiche nelle impostazioni del browser',
    permissionGranted: 'Permesso notifica concesso',
    threshold: 'Notifica quando punteggio è sopra {{threshold}}'
  },
  favorites: {
    title: 'Posizioni Preferite',
    add: 'Aggiungi ai Preferiti',
    remove: 'Rimuovi dai Preferiti',
    removeConfirm: 'Sei sicuro di voler rimuovere questa posizione preferita?',
    empty: 'Nessuna posizione preferita ancora',
    manage: 'Gestisci Preferiti'
  },
  history: {
    title: 'Cronologia Ricerche',
    empty: 'Nessuna cronologia ricerche ancora',
    clearAll: 'Cancella Tutto',
    clearConfirm: 'Sei sicuro di voler cancellare tutta la cronologia delle ricerche?'
  },
  charts: {
    temperature: 'Temperatura',
    precipitation: 'Precipitazioni',
    humidity: 'Umidità',
    wind: 'Vento',
    pressure: 'Pressione',
    clouds: 'Nuvole',
    hourly: 'Previsione 24 Ore',
    daily: 'Previsione 7 Giorni',
    overview: 'Panoramica',
    details: 'Dettagli',
    parameters: 'Parametri',
    trend: 'Trend',
    time: 'Ora',
    unit: 'Unità'
  },

  // 任务18：地图图层
  map: {
    title: 'Previsione sulla mappa',
    layers: {
      wind: 'Vento',
      temp: 'Temperatura',
      clouds: 'Nuvole',
      rain: 'Pioggia'
    },
    currentTime: 'Ora attuale：',
    timeNow: 'Ora',
    timeSunset: 'Tramonto',
    timeSunrise: 'Alba',
    timeHint: '💡 Suggerimento: Puoi anche trascinare la linea temporale sotto la mappa per regolare l\'ora',
    loading: 'Caricamento mappa...',
    error: 'Errore nel caricamento della mappa',
    mockNotSupported: 'La funzione mappa è disponibile solo in modalità API reale'
  },

  // 任务19：周边火烧云
  surrounding: {
    title: 'Analisi nuvole rosse circostanti',
    radius: 'Raggio di rilevamento',
    radiusUnit: 'km',
    directions: {
      N: 'Nord',
      NE: 'Nord-Est',
      E: 'Est',
      SE: 'Sud-Est',
      S: 'Sud',
      SW: 'Sud-Ovest',
      W: 'Ovest',
      NW: 'Nord-Ovest'
    },
    loading: 'Recupero dati meteorologici circostanti...',
    error: 'Errore nel recupero dei dati circostanti',
    noData: 'Nessun dato circostante disponibile',
    clickToView: 'Clicca su una direzione per vedere i dettagli',
    viewingDirection: 'Vedi direzione {{direction}}',
    distanceInfo: '{{distance}} km',
    recommendation: 'Consigli per l\'osservazione',
    bestDirections: 'Direzioni consigliate',
    scoreBreakdown: 'Punteggi per direzione',
    legend: {
      excellent: 'Eccellente（≥80 punti）',
      good: 'Buono（60-79 punti）',
      fair: 'Discreto（40-59 punti）',
      poor: 'Scarso（<40 punti）'
    },
    fallbackMessage: 'Il tuo browser non supporta Canvas, visualizzazione in tabella'
  },

  loading: {
    data: 'Caricamento dati...',
    weather: 'Ottenimento dati meteo...',
    prediction: 'Calcolo previsione...',
    pleaseWait: 'Attendere prego...'
  },
  other: {
    copyright: '© 2026 Previsore del Tramonto',
    poweredBy: 'Powered by Windy',
    version: 'Versione',
    about: 'Informazioni',
    privacy: 'Privacy Policy',
    terms: 'Termini di Servizio',
    contact: 'Contattaci',
    feedback: 'Feedback'
  }
};
