/**
 * Traduction Française
 */
export default {
  app: {
    title: '霞客 Sunset Voyager',
    subtitle: 'Prédire le meilleur moment pour les nuages rouges'
  },
  buttons: {
    search: 'Rechercher',
    refresh: 'Actualiser',
    save: 'Enregistrer',
    cancel: 'Annuler',
    confirm: 'Confirmer',
    close: 'Fermer',
    clear: 'Effacer',
    delete: 'Supprimer',
    edit: 'Modifier',
    useCurrentLocation: 'Utiliser ma position',
    changeLanguage: 'Changer de langue'
  },
  location: {
    label: 'Emplacement',
    placeholder: 'Entrez le nom de la ville...',
    current: 'Position actuelle',
    searching: 'Recherche de l\'emplacement...',
    notFound: 'Emplacement non trouvé, essayez un autre nom',
    permissionDenied: 'Impossible d\'obtenir la position, saisissez manuellement',
    loading: 'Obtention de la position...'
  },
  weather: {
    title: 'Informations Météo',
    current: 'Météo Actuelle',
    currentLocation: 'Position Actuelle',
    noData: 'Aucune donnée météo disponible',
    forecast: 'Prévisions',
    temperature: 'Température',
    humidity: 'Humidité',
    windSpeed: 'Vitesse du Vent',
    windDirection: 'Direction du Vent',
    pressure: 'Pression',
    visibility: 'Visibilité',
    clouds: 'Nuages',
    cloudCover: 'Couverture Nuageuse',
    precipitation: 'Précipitations',
    highClouds: 'Nuages Élevés',
    midClouds: 'Nuages Moyens',
    lowClouds: 'Nuages Bas',
    feeling: 'Ressenti',
    uvIndex: 'Indice UV',

    // Weather descriptions
    overcast: 'Ciel Couvert',
    cloudy: 'Nuageux',
    partlyCloudy: 'Partiellement Nuageux',
    clear: 'Dégagé',

    // Weather overview
    overview: 'Aperçu',
    hourly: 'Prévisions Horaires',
    daysOverview: 'Aperçu sur {{days}} jours',
    precipChance: '{{prob}}% précip',
    dataInfo: 'ℹ️ La source de données fournit {{hours}} heures de prévisions (~{{days}} jours). Envisagez d\'utiliser d\'autres sources pour plus de jours.'
  },
  prediction: {
    title: 'Prédiction de Coucher de Soleil',
    sunrise: 'Lueur de l\'Aube',
    sunset: 'Lueur du Crépuscule',
    sunriseAndSunset: 'Prédiction de Lever et Coucher de Soleil',
    score: 'Score de Prédiction',
    points: 'pts',
    quality: 'Niveau de Qualité',
    bestTime: 'Meilleur Moment d\'Observation',
    analysis: 'Analyse',
    analysisTitle: '📊 Analyse',
    details: 'Détails',
    detailedWeatherData: 'Données Météo Détaillées',
    noPredictionData: '⚠️ Aucune donnée de prédiction pour {{date}} disponible',
    insufficientData: 'Données météo insuffisantes pour générer une prédiction. Veuillez actualiser plus tard.',
    viewFutureOrRefresh: 'Veuillez vérifier les prévisions futures ou actualiser les données plus tard',
    predictionUnavailable: '⚠️ Données météo insuffisantes',

    // Quality levels
    excellent: 'Excellent',
    good: 'Bon',
    fair: 'Moyen',
    poor: 'Médiocre',

    // Status descriptions
    status: {
      noFireCloud: 'Pas de Nuages Rouges',
      lightGlow: 'Légère Lueur',
      goodGlow: 'Bonne Lueur',
      highProbability: 'Forte probabilité de magnifique coucher de soleil',
      moderateProbability: 'Possibles nuances de coucher de soleil',
      lowProbability: 'Peu probable d\'avoir des nuances de coucher de soleil',
      skyClear: 'Ciel dégagé, manque de "toile" pour refléter la lumière',
      cloudPerfect: 'Nuages modérés, favorables aux beaux couchers de soleil',
      cloudTooThick: 'Nuages trop épais, la lumière du soleil ne peut pas traverser',
      cloudUnsuitable: 'Conditions nuageuses inadaptées à la formation de nuages rouges',
      waitForClouds: 'Recommandé d\'attendre une couverture nuageuse modérée',
      lightPathBlocked: 'Nuages à l\'ouest bloquant le trajet lumineux',
      lightPathObstructed: 'Trajet lumineux obstrué',
      poorViewing: 'Conditions d\'observation médiocres',
      conditionsFair: 'Conditions moyennes, couleurs possibles éparses',
      canWatch: 'Peut être observé',
      conditionsGood: 'Conditions bonnes avec une certaine valeur d\'observation',
      veryLikely: 'Forte probabilité de magnifique coucher de soleil',
      excellentConditions: 'Nuages modérés avec trajet lumineux clair',
      legendaryEruption: 'Éruption légendaire',
      perfectMidHighClouds: 'Nuages mi-hauts parfaits avec trajet lumineux clair',
      highlyRecommended: 'Fortement recommandé à regarder!'
    },

    // Time periods
    goldenHour: '🌟 Heure Dorée',
    blueHour: '🌌 Heure Bleue',
    sunAzimuth: '🧭 Azimut Solaire',
    sunriseTime: 'Heure du Lever',
    sunsetTime: 'Heure du Coucher',
    bestViewingTime: 'Meilleur Moment d\'Observation',

    // Best viewing window descriptions
    bestViewingWindowSunrise: '30 minutes avant et après le lever du soleil est le meilleur moment pour observer la lueur de l\'aube',
    bestViewingWindowSunset: '30 minutes avant et après le coucher du soleil est le meilleur moment pour observer la lueur du crépuscule',

    // Canvas score
    canvas: {
      title: 'Score de Toile',
      score: 'Score de Toile',
      cloudLevel: 'Niveau de Nuages',
      breakdown: 'Répartition des Nuages',
      canvasScore: '📊 Toile: {{score}}pts | {{level}}',
      cloudBreakdown: 'Élevés {{high}}% Moyens {{mid}}% Bas {{low}}%',
      lowCloudPenalty: '| Pénalité nuages bas: {{reason}}'
    },

    // Light path score
    lightPath: {
      title: 'Score du Chemin Lumineux',
      score: 'Score du Chemin Lumineux',
      visibility: 'Visibilité',
      lightPathScore: '🌅 chemin lumineux: {{score}}pts (150km:{{near}} 300km:{{far}})'
    },

    // Rendering score
    rendering: {
      title: 'Score de Rendu',
      score: 'Score de Rendu',
      humidity: 'Effet d\'Humidité',
      renderingFactor: '🎨 Facteur de rendu: {{factor}} | {{visibility}} | {{aqi}} | {{color}}',
      specialMode: '| {{mode}}'
    },

    // Composite score
    composite: {
      title: 'Score Composite',
      finalScore: 'Score Final',
      confidence: 'Confiance de la Prédiction'
    },

    // Cloud layers
    cloudLayers: {
      title: '☁️ Informations sur les Couches de Nuages',
      highCloudLabel: '⛅ Nuages Élevés (>6km)',
      midCloudLabel: '☁️ Nuages Moyens (2-6km)',
      lowCloudLabel: '🌫️ Nuages Bas (<2km)',
      high: 'Nuages Élevés (>6km)',
      mid: 'Nuages Moyens (2-6km)',
      low: 'Nuages Bas (<2km)',
      favorable: 'Favorable',
      unfavorable: 'Défavorable',
      cloudAnalysis: 'Analyse des nuages:',
      description: 'Élevés {{high}}% Moyens {{mid}}% Bas {{low}}%'
    },

    // Descriptions
    descriptions: {
      skyClear: 'Ciel dégagé, manque de "toile" pour réfléchir la lumière',
      cloudPerfect: 'Nuages modérés, favorables pour un magnifique coucher de soleil',
      lowCloudHeavy: 'Trop de nuages bas, peuvent bloquer le coucher de soleil',
      highHumidity: 'Humidité trop élevée, peut affecter la visibilité',
      lowHumidity: 'Humidité trop faible, les nuages peuvent être trop fins',
      goodVisibility: 'Visibilité excellente, bonnes conditions d\'observation',
      poorVisibility: 'Visibilité médiocre, peut affecter l\'expérience d\'observation'
    },

    // Fire cloud analysis
    fireCloud: {
      title: '🔥 Indice de Nuages Rouges: {{score}}/100{{level}}',
      excellent: ' (Excellent)',
      good: ' (Bon)',
      fair: ' (Moyen)',
      poor: ' (Médiocre)',
      analysisTitle: '🔥 Analyse des Conditions de Formation des Nuages Rouges:',
      idealCloud: '✅ Couverture nuageuse idéale ({{value}}%), peut pleinement réfléchir la lumière du soleil',
      slightlyLowCloud: '⚠️ Couverture nuageuse légèrement faible ({{value}}%), l\'effet des nuages rouges peut être pâle',
      tooMuchCloud: '⚠️ Trop de couverture nuageuse ({{value}}%), peut bloquer la lumière du soleil',
      severelyLowCloud: '❌ Couverture nuageuse sévèrement faible ({{value}}%), ne peut pas former de nuages rouges',
      idealHumidity: '✅ Humidité idéale ({{value}}%), favorable pour la diffusion de la lumière',
      slightlyLowHumidity: '⚠️ Humidité légèrement faible ({{value}}%), les couleurs peuvent ne pas être assez vives',
      slightlyHighHumidity: '⚠️ Humidité légèrement élevée ({{value}}%), peut affecter la saturation des couleurs',
      severelyLowHumidity: '❌ Humidité sévèrement faible ({{value}}%), diffusion lumineuse faible',
      excellentVisibility: '✅ Visibilité excellente ({{value}} km), vue dégagée',
      goodVisibility: '✅ Bonne visibilité ({{value}} km), bonne expérience d\'observation',
      fairVisibility: '⚠️ Visibilité moyenne ({{value}} km), les couleurs peuvent être légèrement ternes',
      poorVisibility: '❌ Visibilité médiocre ({{value}} km), brume affectant la vue',
      sparseLowCloud: '✅ Nuages bas épars ({{value}}%), ne bloqueront pas les nuages rouges',
      littleLowCloud: '✅ Peu de nuages bas ({{value}}%), impact minimal sur l\'observation',
      someLowCloud: '⚠️ Certains nuages bas ({{value}}%), peuvent bloquer partiellement la vue',
      denseLowCloud: '❌ Nuages bas denses ({{value}}%), affectant sérieusement l\'observation',
      excellentConditions: '🌟 Toutes les conditions pour des nuages rouges magnifiques sont réunies!',
      highProbability: '✨ Forte probabilité de paysages de nuages rouges spectaculaires',
      moderateProbability: '💫 Possibles effets légers de nuages rouges',
      lowProbability: '⛅ Faible probabilité de nuages rouges significatifs',
      noCloudNoFireCloud: '❌ Couverture nuageuse sévèrement insuffisante, ne peut pas former de nuages rouges',
      tooMuchCloud: '❌ Trop de couverture nuageuse, bloquant la lumière du soleil empêchant les nuages rouges'
    },

    // Overall evaluation
    overallEvaluation: {
      excellent: 'Les conditions météo le {{date}} sont excellentes pour observer {{type}}!<br><br>',
      good: 'Les conditions météo le {{date}} sont assez adaptées pour observer {{type}}.<br><br>',
      fair: 'Les conditions météo le {{date}} ne sont pas idéales.<br><br>',
      idealCloud: ' Couverture nuageuse idéale ({{value}}%), favorable pour former des couleurs brillantes.<br>',
      lowCloud: ' Faible couverture nuageuse ({{value}}%), peut manquer de nuages suffisants pour réfléchir la lumière.<br>',
      highCloud: ' Forte couverture nuageuse ({{value}}%), peut bloquer trop de lumière du soleil.<br>',
      idealHumidity: ' Humidité idéale ({{value}}%), la vapeur d\'eau dans l\'air aide à la diffusion de la lumière.<br>',
      lowHumidity: ' Faible humidité ({{value}}%), l\'air est relativement sec.<br>',
      highHumidity: ' Forte humidité ({{value}}%), peut affecter la visibilité.<br>',
      excellentVisibility: ' Bonne visibilité ({{value}} km), vue dégagée.<br>',
      fairVisibility: ' Visibilité moyenne ({{value}} km)<br>',
      poorVisibility: ' Visibilité médiocre ({{value}} km), brume possible.<br>',
      sparseLowCloud: ' Peu de nuages de bas niveau, ne bloqueront pas la vue.',
      someLowCloud: ' Certains nuages de bas niveau, peuvent affecter légèrement l\'expérience d\'observation.',
      denseLowCloud: ' Beaucoup de nuages de bas niveau ({{value}}%), peuvent bloquer partiellement la vue.'
    },

    // Future predictions
    passed: 'Passé',
    forecast: 'Prévisions Futures'
  },
  errors: {
    title: 'Erreur',
    networkError: 'Erreur de connexion réseau, veuillez vérifier vos paramètres réseau',
    apiError: 'Échec de l\'appel API, veuillez réessayer plus tard',
    apiKeyMissing: 'Veuillez configurer la clé API Windy d\'abord',
    apiKeyInvalid: 'Clé API invalide, veuillez vérifier la configuration',
    timeout: 'Délai d\'attente de la requête, veuillez réessayer',
    unknownError: 'Erreur inconnue, veuillez réessayer',
    locationError: 'Échec de la résolution de l\'emplacement, essayez un autre nom',
    mapInitFailed: 'Échec de l\'initialisation de la carte'
  },
  settings: {
    title: 'Paramètres',
    apiKey: 'Clé API',
    apiKeyLabel: 'Configurer la Clé API Windy',
    apiKeyPlaceholder: 'Entrez la clé API',
    apiKeyHelp: 'Veuillez entrer votre clé API Windy pour utiliser les fonctionnalités de prédiction météo',
    language: 'Langue',
    languageLabel: 'Langue de l\'Interface',
    notifications: 'Notifications',
    notificationsTitle: 'Paramètres de Notification',
    notificationsLabel: 'Notifications de Coucher de Soleil',
    notificationsDescription: 'Configurer les alertes de prévisions de haute qualité',
    notificationsHelp: 'Envoyer une notification lorsque la qualité de prédiction dépasse le seuil',
    enableNotifications: 'Activer les alertes de notification',
    thresholdLabel: 'Seuil de score (alerte quand le score ≥ cette valeur)',
    testNotification: 'Tester la Notification',
    notificationThreshold: 'Seuil de Notification',
    favoriteLocations: 'Emplacements Favoris',
    searchHistory: 'Historique de Recherche',
    clearHistory: 'Effacer l\'Historique',
    confirmClearHistory: 'Êtes-vous sûr de vouloir effacer tout l\'historique de recherche?',
    // Panneau de Paramètres Unifié
    close: 'Fermer',
    done: 'Terminé',
    // Source de Données & Réseau
    dataSource: 'Source de Données & Réseau',
    currentMode: 'Mode Actuel',
    proxyUrl: 'URL du Serveur Proxy',
    proxyUrlPlaceholder: 'http://localhost:3000',
    proxyUrlHint: 'Adresse URL du serveur proxy backend',
    // Notifications & Alertes
    notificationAndAlerts: 'Notifications & Alertes',
    enableSunsetNotification: 'Activer les notifications de coucher de soleil',
    notificationHint: 'Envoyer une notification du navigateur lorsque la qualité de prévision atteint le seuil',
    notificationThresholdLabel: 'Seuil de Notification',
    notificationThresholdHint: 'Envoyer une notification lorsque le score de prévision est supérieur à cette valeur',
    // Langue & Affichage
    languageAndDisplay: 'Langue & Affichage',
    interfaceLanguage: 'Langue de l\'Interface',
    // Personnalisation
    personalization: 'Personnalisation',
    themeMode: 'Mode Thème',
    themeLight: 'Mode Clair',
    themeDark: 'Mode Sombre',
    themeAuto: 'Automatique',
    temperatureUnit: 'Unité de Température',
    tempCelsius: 'Celsius (℃)',
    tempFahrenheit: 'Fahrenheit (℉)',
    windSpeedUnit: 'Unité de Vitesse du Vent',
    windKmh: 'km/h',
    windMs: 'm/s'
  },
  languageSelector: {
    title: 'Choisir la Langue',
    confirmChange: 'Confirmer le Changement de Langue',
    confirmChangeMessage: 'L\'interface sera actualisée après le changement de langue. Les données actuelles ne seront pas perdues. Continuer?',
    selectLanguage: 'Veuillez sélectionner la langue de l\'interface'
  },

  // Date buttons
  dates: {
    today: 'Aujourd\'hui',
    tomorrow: 'Demain'
  },

  // Future forecast
  forecast: {
    title: 'Prévisions Futures'
  },

  // Common text
  common: {
    loading: 'Chargement...',
    dataSource: 'Source de données: API Windy'
  },
  notifications: {
    title: 'Alerte Coucher de Soleil',
    excellentForecast: 'Score de prédiction ce soir: {{score}}, excellent pour observer!',
    goodForecast: 'Score de prédiction ce soir: {{score}}, vaut le coup d\'œil!',
    time: 'Heure: {{time}}',
    location: 'Emplacement: {{location}}',
    enable: 'Activer les Notifications',
    disable: 'Désactiver les Notifications',
    permissionDenied: 'Permission de notification refusée, veuillez autoriser les notifications dans les paramètres du navigateur',
    permissionGranted: 'Permission de notification accordée',
    threshold: 'Notifier quand le score est supérieur à {{threshold}}'
  },

  // Favorite locations
  favorites: {
    title: 'Emplacements Favoris',
    add: 'Ajouter aux Favoris',
    remove: 'Retirer des Favoris',
    removeConfirm: 'Êtes-vous sûr de vouloir retirer cet emplacement favori?',
    empty: 'Aucun emplacement favori pour le moment',
    manage: 'Gérer les Favoris'
  },
  loading: {
    data: 'Chargement des données...',
    weather: 'Récupération des données météo...',
    prediction: 'Calcul de la prédiction...',
    pleaseWait: 'Veuillez patienter...'
  },

  // Time
  time: {
    today: 'Aujourd\'hui',
    tomorrow: 'Demain',
    yesterday: 'Hier',
    dayAfterTomorrow: 'Après-Demain',
    daysLater: '{{days}} jours plus tard',
    week: 'Semaine',
    date: 'Date',
    time: 'Heure'
  },

  // Date
  date: {
    today: 'Aujourd\'hui',
    tomorrow: 'Demain',
    dayAfterTomorrow: 'Après-Demain',
    format: '{{month}}/{{day}}'
  },

  // Search history
  history: {
    title: 'Historique de Recherche',
    empty: 'Aucun historique de recherche pour le moment',
    clearAll: 'Tout Effacer',
    clearConfirm: 'Êtes-vous sûr de vouloir effacer tout l\'historique de recherche?'
  },

  // Weather charts
  charts: {
    temperature: 'Température',
    precipitation: 'Précipitations',
    humidity: 'Humidité',
    wind: 'Vent',
    pressure: 'Pression',
    clouds: 'Nuages',
    hourly: 'Prévisions sur 24 Heures',
    daily: 'Prévisions sur 7 Jours',
    overview: 'Aperçu',
    details: 'Détails',
    parameters: 'Paramètres',
    trend: 'Tendance',
    time: 'Heure',
    unit: 'Unité'
  },

  // 任务18：地图图层
  map: {
    title: 'Prévisions sur la carte',
    layers: {
      wind: 'Vent',
      temp: 'Température',
      clouds: 'Nuages',
      rain: 'Pluie'
    },
    currentTime: 'Heure actuelle：',
    timeNow: 'Maintenant',
    timeSunset: 'Coucher du soleil',
    timeSunrise: 'Lever du soleil',
    timeHint: '💡 Astuce : Vous pouvez également faire glisser la ligne temporelle sous la carte pour ajuster l\'heure',
    loading: 'Chargement de la carte...',
    error: 'Échec du chargement de la carte',
    mockNotSupported: 'La fonction de carte n\'est disponible qu\'en mode API réel'
  },

  // 任务19：周边火烧云
  surrounding: {
    title: 'Analyse des nuages rouges environnants',
    radius: 'Rayon de détection',
    radiusUnit: 'km',
    directions: {
      N: 'Nord',
      NE: 'Nord-Est',
      E: 'Est',
      SE: 'Sud-Est',
      S: 'Sud',
      SW: 'Sud-Ouest',
      W: 'Ouest',
      NW: 'Nord-Ouest'
    },
    loading: 'Récupération des données météo environnantes...',
    error: 'Échec de la récupération des données environnantes',
    noData: 'Aucune donnée environnante disponible',
    clickToView: 'Cliquez sur une direction pour voir les détails',
    viewingDirection: 'Voir la direction {{direction}}',
    distanceInfo: '{{distance}} km',
    recommendation: 'Conseils d\'observation',
    bestDirections: 'Directions recommandées',
    scoreBreakdown: 'Scores par direction',
    legend: {
      excellent: 'Excellent（≥80 points）',
      good: 'Bon（60-79 points）',
      fair: 'Moyen（40-59 points）',
      poor: 'Médiocre（<40 points）'
    },
    fallbackMessage: 'Votre navigateur ne prend pas en charge Canvas, affichage en tableau'
  },

  // Other
  other: {
    copyright: '© 2026 Prédicteur de Coucher de Soleil',
    poweredBy: 'Propulsé par Windy',
    version: 'Version',
    about: 'À Propos',
    privacy: 'Politique de Confidentialité',
    terms: 'Conditions d\'Utilisation',
    contact: 'Nous Contacter',
    feedback: 'Commentaires'
  }
};
