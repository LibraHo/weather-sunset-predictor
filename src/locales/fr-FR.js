/**
 * Traduction Française
 */
export default {
  app: {
    title: 'Prédicteur de Coucher de Soleil',
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
    forecast: 'Prévisions',
    temperature: 'Température',
    humidity: 'Humidité',
    windSpeed: 'Vitesse du Vent',
    windDirection: 'Direction du Vent',
    pressure: 'Pression',
    visibility: 'Visibilité',
    clouds: 'Nuages',
    precipitation: 'Précipitations',
    highClouds: 'Nuages Élevés',
    midClouds: 'Nuages Moyens',
    lowClouds: 'Nuages Bas'
  },
  prediction: {
    title: 'Prédiction de Coucher de Soleil',
    sunrise: 'Lueur de l\'Aube',
    sunset: 'Lueur du Crépuscule',
    score: 'Score de Prédiction',
    quality: 'Niveau de Qualité',
    bestTime: 'Meilleur Moment d\'Observation',
    excellent: 'Excellent',
    good: 'Bon',
    fair: 'Moyen',
    poor: 'Médiocre',
    goldenHour: 'Heure Dorée',
    blueHour: 'Heure Bleue',
    sunriseTime: 'Heure du Lever',
    sunsetTime: 'Heure du Coucher'
  },
  errors: {
    title: 'Erreur',
    networkError: 'Erreur de connexion réseau',
    apiError: 'Échec de l\'appel API',
    apiKeyMissing: 'Configurez d\'abord la clé API Windy',
    apiKeyInvalid: 'Clé API invalide'
  },
  settings: {
    title: 'Paramètres',
    apiKey: 'Clé API',
    language: 'Langue',
    notifications: 'Notifications'
  },
  languageSelector: {
    title: 'Choisir la Langue',
    confirmChange: 'Confirmer le Changement de Langue',
    confirmChangeMessage: 'L\'interface sera actualisée après le changement de langue. Les données actuelles ne seront pas perdues. Continuer?'
  },
  notifications: {
    title: 'Alerte Coucher de Soleil',
    excellentForecast: 'Score de prédiction ce soir: {{score}} points, excellent pour observer!',
    enable: 'Activer les Notifications',
    disable: 'Désactiver les Notifications'
  },
  loading: {
    data: 'Chargement des données...',
    weather: 'Récupération des données météo...',
    prediction: 'Calcul de la prédiction...',
    pleaseWait: 'Veuillez patienter...'
  },
  other: {
    copyright: '© 2026 Prédicteur de Coucher de Soleil',
    poweredBy: 'Powered by Windy'
  }
};
