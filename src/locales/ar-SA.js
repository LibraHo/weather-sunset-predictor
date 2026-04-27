/**
 * الترجمة العربية
 */
export default {
  app: {
    title: 'Sunset Voyager',
    subtitle: 'التنبؤ بأفضل وقت للسحب الحمراء'
  },
  // تبويبات الصفحة الرئيسية & شرح الخوارزمية
  home: {
    tabs: {
      ariaLabel: 'تنقل تبويبات الصفحة الرئيسية',
      forecast: 'التنبؤ',
      methodology: 'طريقة حساب النقاط',
      map: 'خريطة السحب الحمراء',
            shareMap: 'خريطة المشاركة',
apiAccess: 'الوصول إلى API'
    },
    menu: {
      ariaLabel: 'تبديل العرض',
      dropdownAriaLabel: 'قائمة التنقل'
    },
    methodology: {
      title: 'كيف يتم حساب النقاط',
      intro: 'يجمع مؤشر السحب الحمراء أربعة عوامل رئيسية لتقدير ما إذا كانت مشاهدة الغروب تستحق العناء.',
      factors: {
        highMidCloudTitle: 'السحب المتوسطة/العالية (اللوحة)',
        highMidCloudDesc: 'تغطية متوازنة من السحب المتوسطة والعالية توفر طبقات برتقالية-حمراء أفضل؛ قليلة جدًا أو سميكة جدًا تضر بالتأثير.',
        lowCloudTitle: 'السحب المنخفضة (عقوبة)',
        lowCloudDesc: 'زيادة السحب المنخفضة يمكن أن تحجب الضوء بالقرب من الأفق، وهو السبب الرئيسي لإخفاق مشاهدة الشفق.',
        humidityTitle: 'الرطوبة (تعزيز الألوان)',
        humidityDesc: 'الرطوبة المعتدلة تثري الألوان؛ الرطوبة المرتفعة قد تسبب ضبابًا، والمنخفضة جدًا تجعل الألوان باهتة.',
        visibilityTitle: 'الرؤية (الوضوح)',
        visibilityDesc: 'الرؤية الأعلى تعني عادةً سماءً أكثر صفاءً وانتقالات ألوان أوضح عند الغروب.'
      },
      scoreGuideTitle: 'دليل النقاط',
      scoreExcellent: 'ممتاز: >70 (يُنصح بالخروج)',
      scoreGood: 'جيد: 40-70 (يستحق المشاهدة)',
      scoreFair: 'مقبول: <40 (توقعات معتدلة)',
      scoreExcellentRange: 'ممتاز',
      scoreExcellentDesc: 'يُنصح بشدة بالخروج',
      scoreGoodRange: 'جيد',
      scoreGoodDesc: 'يمكن المشاهدة، ظروف جيدة',
      scoreFairRange: 'مقبول',
      scoreFairDesc: 'توقعات معتدلة',
      scorePoorRange: 'ضعيف',
      scorePoorDesc: 'غير موصى به',
      sections: {
        cloudStructure: {
          title: '1. بنية طبقات السحب',
          subtitle: 'بنية السحب · 60 نقطة',
          desc: 'تحتاج السحب الحمراء إلى طبقات سحب مناسبة كـ"لوحة رسم". السحب العالية والمتوسطة هي الحاملات الرئيسية.',
          highCloud: 'السحب العالية (>6كم): مثالي 50%، منحنى غاوسي، أقصى 25 نقطة',
          midCloud: 'السحب المتوسطة (2–6كم): مثالي 35%، منحنى غاوسي، أقصى 25 نقطة',
          lowCloudBonus: 'مكافأة السحب المنخفضة: كلما قلّت كان أفضل، <20% = 10 نقاط، تراجع خطي',
          formula: 'نقاط البنية = عالية + متوسطة + مكافأة منخفضة (أقصى 60 نقطة)'
        },
        transparency: {
          title: '2. شفافية الغلاف الجوي',
          subtitle: 'الشفافية · 25 نقطة',
          desc: 'الغلاف الجوي الصافي يتيح للضوء تلوين السحب بشكل أكثر حيوية. الرطوبة المعتدلة تعزز التشتت.',
          visibility: 'الرؤية: 15 × (1 − e^(−v/15))، أقصى 15 نقطة',
          humidity: 'الرطوبة: مثالي 55%، منحنى غاوسي، أقصى 10 نقاط',
          formula: 'نقاط الشفافية = الرؤية + الرطوبة (أقصى 25 نقطة)'
        },
        layerDiversity: {
          title: '3. تنوع الطبقات',
          subtitle: 'تنوع الطبقات · 15 نقطة',
          desc: 'عند تعايش السحب العالية والمتوسطة والمنخفضة، تخلق زوايا الانكسار المتنوعة طبقات ألوان أكثر ثراءً.',
          threeLayer: 'جميع الطبقات الثلاث >10% ← 15 نقطة',
          twoLayer: 'أي طبقتين >10% ← 8 نقاط',
          oneLayer: 'طبقة واحدة فقط أو بلا سحب ← 0 نقطة'
        },
        lowCloudPenalty: {
          title: '4. معامل عقوبة السحب المنخفضة',
          subtitle: 'عقوبة السحب المنخفضة · مضاعف',
          desc: 'السحب المنخفضة تحجب الرؤية وهي "قاتل الرؤية" للسحب الحمراء. تُطبق كعقوبة ضربية.',
          level1: 'سحب منخفضة <20% ← ×1.0 (بلا عقوبة)',
          level2: 'سحب منخفضة 20–40% ← ×1.0 إلى ×0.8 (خطي)',
          level3: 'سحب منخفضة 40–70% ← ×0.8 إلى ×0.5 (خطي)',
          level4: 'سحب منخفضة >70% ← ×0.2 (حجب شديد)'
        },
        precipPenalty: {
          title: '5. معامل عقوبة الهطول',
          subtitle: 'عقوبة الهطول · مضاعف',
          desc: 'الهطول يقلل مباشرة من رؤية السحب الحمراء. يُطبق كعقوبة ضربية.',
          level1: 'هطول <0.1مم/س ← ×1.0 (بلا عقوبة)',
          level2: '0.1–0.5مم/س ← ×0.85',
          level3: '0.5–2مم/س ← ×0.5',
          level4: '>2مم/س ← ×0.15 (مطر غزير، شبه مستحيل)',
          formula: 'النقاط النهائية = النقاط الأساسية × معامل السحب المنخفضة × معامل الهطول'
        }
      }
    }
  },
  buttons: {
    search: 'بحث',
    refresh: 'تحديث',
    save: 'حفظ',
    cancel: 'إلغاء',
    confirm: 'تأكيد',
    close: 'إغلاق',
    clear: 'مسح',
    delete: 'حذف',
    edit: 'تعديل',
    useCurrentLocation: 'استخدام موقعي الحالي',
    changeLanguage: 'تغيير اللغة'
  },
  location: {
    label: 'الموقع',
    placeholder: 'أدخل اسم المدينة...',
    current: 'الموقع الحالي',
    searching: 'جاري البحث عن الموقع...',
    notFound: 'الموقع غير موجود، جرب اسمًا آخر',
    permissionDenied: 'تعذر الحصول على إذن الموقع، أدخل يدويًا',
    loading: 'جاري الحصول على الموقع...'
  },
  weather: {
    title: 'معلومات الطقس',
    current: 'الطقس الحالي',
    currentLocation: 'الموقع الحالي',
    noData: 'لا توجد بيانات طقس متاحة',
    forecast: 'التوقعات',
    temperature: 'درجة الحرارة',
    humidity: 'الرطوبة',
    windSpeed: 'سرعة الرياح',
    windDirection: 'اتجاه الرياح',
    pressure: 'الضغط',
    visibility: 'الرؤية',
    aerosol: 'الهباء الجوي',
    clouds: 'السحب',
    cloudCover: 'غطاء السحب',
    precipitation: 'الهطول',
    highClouds: 'سحب عالية',
    midClouds: 'سحب متوسطة',
    lowClouds: 'سحب منخفضة',
    feeling: 'شعور',
    uvIndex: 'مؤشر UV تقديري',
    overcast: 'غائم جزئيا',
    cloudy: 'غائم',
    partlyCloudy: 'غائم جزئيا',
    clear: 'صافي',
    overview: 'نظرة عامة',
    hourly: 'التوقعات الساعية',
    daysOverview: 'نظرة عامة لـ {{days}} أيام',
    precipChance: '{{prob}}% هطول',
    dataInfo: 'ℹ️ مصدر البيانات يوفر بيانات التنبؤ لـ {{hours}} ساعة (~{{days}} أيام). فكر في استخدام مصادر بيانات طقس أخرى لمزيد من الأيام.'
  },
  prediction: {
    title: 'تنبؤ توهج الغروب',
    sunrise: 'توهج الشروق',
    sunset: 'توهج الغروب',
    sunriseAndSunset: 'تنبؤ توهج الشروق والغروب',
    score: 'درجة التنبؤ',
    points: 'نقطة',
    quality: 'مستوى الجودة',
    bestTime: 'أفضل وقت للمشاهدة',
    analysis: 'التحليل',
    analysisTitle: '📊 التحليل',
    details: 'التفاصيل',
    detailedWeatherData: 'بيانات الطقس التفصيلية',
    noPredictionData: '⚠️ لا توجد بيانات تنبؤ لـ {{date}}',
    insufficientData: 'بيانات طقس غير كافية لإنشاء تنبؤ. يرجى التحديث لاحقا.',
    viewFutureOrRefresh: 'يرجى التحقق من التنبؤات المستقبلية أو تحديث البيانات لاحقا',
    predictionUnavailable: '⚠️ بيانات طقس غير كافية',
    excellent: 'ممتاز',
    good: 'جيد',
    fair: 'متوسط',
    poor: 'ضعيف',
    status: {
      noFireCloud: 'لا توجد سحب حمراء',
      lightGlow: 'توهج خفيف',
      goodGlow: 'توهج جيد',
      highProbability: 'احتمالية عالية لتوهج غروب جميل',
      moderateProbability: 'توهج غروب محتمل',
      lowProbability: 'من غير المحتمل وجود توهج غروب',
      skyClear: 'سماء صافية، نقص في "القماش" لعكس الضوء',
      cloudPerfect: 'سحب معتدلة، مواتية لغروب جميل',
      cloudTooThick: 'سحب كثيفة جدًا، لا يمكن لأشعة الشمس أن تمر',
      cloudUnsuitable: 'ظروف سحابة غير مناسبة لتكوين السحب الحمراء',
      waitForClouds: 'يُنصح بانتظار غطاء سحبي معتدل',
      lightPathBlocked: 'سحب في الغرب تحجب مسار الضوء',
      lightPathObstructed: 'مسار الضوء مسدود',
      poorViewing: 'ظروف مشاهدة سيئة',
      conditionsFair: 'ظروف معتدلة، ألوان متفرقة ممكنة',
      canWatch: 'يمكن مشاهدته',
      conditionsGood: 'ظروف جيدة مع قيمة مشاهدة معينة',
      veryLikely: 'احتمالية عالية لغروب جميل',
      excellentConditions: 'سحب معتدلة مع مسار ضوء واضح',
      legendaryEruption: 'ثوران أسطوري',
      perfectMidHighClouds: 'سحب متوسطة وعالية مثالية مع مسار ضوء واضح',
      highlyRecommended: 'يوصى بشدة بالمشاهدة!'
    },
    goldenHour: '🌟 الساعة الذهبية',
    blueHour: '🌌 الساعة الزرقاء',
    sunAzimuth: '🧭 اتجاه الشمس',
    sunriseTime: 'وقت شروق الشمس',
    sunsetTime: 'وقت غروب الشمس',
    bestViewingTime: 'أفضل وقت للمشاهدة',
    bestViewingWindowSunrise: '30 دقيقة قبل وبعد شروق الشمس هو أفضل وقت لرؤية توهج الشروق',
    bestViewingWindowSunset: '30 دقيقة قبل وبعد غروب الشمس هو أفضل وقت لرؤية توهج الغروب',
    canvas: {
      title: 'درجة اللوحة',
      score: 'درجة اللوحة',
      aerosol: 'الهباء الجوي',
      cloudLevel: 'مستوى السحب',
      breakdown: 'توزيع السحب',
      canvasScore: '📊 اللوحة: {{score}} نقطة | {{level}}',
      cloudBreakdown: 'عالي {{high}}% متوسط {{mid}}% منخفض {{low}}%',
      lowCloudPenalty: '| عقوبة السحب المنخفضة: {{reason}}'
    },
    lightPath: {
      title: 'درجة مسار الضوء',
      score: 'درجة مسار الضوء',
      visibility: 'الرؤية',
      lightPathScore: '🌅 مسار الضوء: {{score}} نقطة (150 كم:{{near}} 300 كم:{{far}})'
    },
    rendering: {
      title: 'درجة العرض',
      score: 'درجة العرض',
      humidity: 'تأثير الرطوبة',
      renderingFactor: '🎨 عامل العرض: {{factor}} | {{visibility}} | {{aqi}} | {{color}}',
      specialMode: '| {{mode}}'
    },
    composite: {
      title: 'الدرجة المركبة',
      finalScore: 'الدرجة النهائية',
      confidence: 'ثقة التنبؤ'
    },
    cloudLayers: {
      title: '☁️ معلومات طبقة السحب',
      highCloudLabel: '⛅ سحب عالية (>6 كم)',
      midCloudLabel: '☁️ سحب متوسطة (2-6 كم)',
      lowCloudLabel: '🌫️ سحب منخفضة (<2 كم)',
      high: 'سحب عالية (>6 كم)',
      mid: 'سحب متوسطة (2-6 كم)',
      low: 'سحب منخفضة (<2 كم)',
      favorable: 'مواتي',
      unfavorable: 'غير مواتي',
      cloudAnalysis: 'تحليل السحب:',
      description: 'عالي {{high}}% متوسط {{mid}}% منخفض {{low}}%'
    },
    descriptions: {
      skyClear: 'سماء صافية، تفتقر إلى "اللوحة" لعكس الضوء',
      cloudPerfect: 'سحب معتدلة، مواتية لتوهج غروب جميل',
      lowCloudHeavy: 'سحب منخفضة كثيرة جدًا، قد تحجب توهج الغروب',
      highHumidity: 'رطوبة عالية جدًا، قد تؤثر على الرؤية',
      lowHumidity: 'رطوبة منخفضة جدًا، قد تكون السحب رقيقة جدًا',
      goodVisibility: 'رؤية ممتازة، ظروف مشاهدة جيدة',
      poorVisibility: 'رؤية ضعيفة، قد تؤثر على تجربة المشاهدة'
    },
    fireCloud: {
      title: '🔥 مؤشر السحب الحمراء: {{score}}/100{{level}}',
      excellent: ' (ممتاز)',
      good: ' (جيد)',
      fair: ' (متوسط)',
      poor: ' (ضعيف)',
      analysisTitle: '🔥 تحليل ظروف تشكل السحب الحمراء:',
      idealCloud: '✅ غطاء سحب مثالي ({{value}}%)، يمكن أن يعكس ضوء الشمس بالكامل',
      slightlyLowCloud: '⚠️ غطاء سحب منخفض قليلا ({{value}}%)، قد يكون تأثير السحب الحمراء باهتًا',
      tooMuchCloud: '⚠️ غطاء سحب كثير جدًا ({{value}}%)، قد يحجب ضوء الشمس',
      severelyLowCloud: '❌ غطاء سحب منخفض بشكل خطير ({{value}}%)، لا يمكن تشكيل سحب حمراء',
      idealHumidity: '✅ رطوبة مثالية ({{value}}%)، مواتية لتشتت الضوء',
      slightlyLowHumidity: '⚠️ رطوبة منخفضة قليلا ({{value}}%)، قد لا تكون الألوان زاهية بما فيه الكفاية',
      slightlyHighHumidity: '⚠️ رطوبة عالية قليلا ({{value}}%)، قد تؤثر على تشبع الألوان',
      severelyLowHumidity: '❌ رطوبة منخفضة بشكل خطير ({{value}}%)، تشتت ضوء ضعيف',
      excellentVisibility: '✅ رؤية ممتازة ({{value}} كم)، رؤية واضحة',
      goodVisibility: '✅ رؤية جيدة ({{value}} كم)، تجربة مشاهدة جيدة',
      fairVisibility: '⚠️ رؤية متوسطة ({{value}} كم)، قد تكون الألوان باهتة قليلا',
      poorVisibility: '❌ رؤية ضعيفة ({{value}} كم)، الضباب يؤثر على الرؤية',
      sparseLowCloud: '✅ سحب منخفضة متناثرة ({{value}}%)، لن تحجب السحب الحمراء',
      littleLowCloud: '✅ سحب منخفضة قليلة ({{value}}%)، تأثير ضئيل على المشاهدة',
      someLowCloud: '⚠️ بعض السحب المنخفضة ({{value}}%)، قد تحجب الرؤية جزئيا',
      denseLowCloud: '❌ سحب منخفضة كثيفة ({{value}}%)، تؤثر بشكل خطير على المشاهدة',
      excellentConditions: '🌟 جميع الظروف لسحب حمراء رائعة متوفرة!',
      highProbability: '✨ احتمالية عالية لمنظر سحب حمراء رائع',
      moderateProbability: '💫 تأثيرات سحب حمراء خفيفة محتملة',
      lowProbability: '⛅ احتمالية منخفضة لسحب حمراء كبيرة',
      noCloudNoFireCloud: '❌ غطاء سحب غير كاف بشكل خطير، لا يمكن تشكيل سحب حمراء',
      tooMuchCloud: '❌ غطاء سحب كثير جدًا، حجب ضوء الشمس يمنع السحب الحمراء'
    },
    overallEvaluation: {
      excellent: 'ظروف الطقس في {{date}} ممتازة لمشاهدة {{type}}!<br><br>',
      good: 'ظروف الطقس في {{date}} مناسبة نسبيا لمشاهدة {{type}}.<br><br>',
      fair: 'ظروف الطقس في {{date}} ليست مثالية.<br><br>',
      idealCloud: ' غطاء سحب مثالي ({{value}}%)، مواتي لتشكيل ألوان ساطعة.<br>',
      lowCloud: ' غطاء سحب منخفض ({{value}}%)، قد يفتقر إلى سحب كافية لعكس الضوء.<br>',
      highCloud: ' غطاء سحب عالي ({{value}}%)، قد يحجب الكثير من ضوء الشمس.<br>',
      idealHumidity: ' رطوبة مثالية ({{value}}%)، بخار الماء في الهواء يساعد على تشتت الضوء.<br>',
      lowHumidity: ' رطوبة منخفضة ({{value}}%)، الهواء جاف نسبيا.<br>',
      highHumidity: ' رطوبة عالية ({{value}}%)، قد تؤثر على الرؤية.<br>',
      excellentVisibility: ' رؤية جيدة ({{value}} كم)، رؤية واضحة.<br>',
      fairVisibility: ' رؤية متوسطة ({{value}} كم)<br>',
      poorVisibility: ' رؤية ضعيفة ({{value}} كم)، ضباب محتمل.<br>',
      sparseLowCloud: ' سحب منخفضة قليلة، لن تحجب الرؤية.',
      someLowCloud: ' بعض السحب المنخفضة، قد تؤثر قليلا على تجربة المشاهدة.',
      denseLowCloud: ' سحب منخفضة كثيرة ({{value}}%)، قد تحجب الرؤية جزئيا.'
    },
    passed: 'منقضي',
    forecast: 'التنبؤ المستقبلي'
  },
  time: {
    today: 'اليوم',
    tomorrow: 'غدا',
    yesterday: 'أمس',
    dayAfterTomorrow: 'بعد غد',
    daysLater: '{{days}} أيام لاحقة',
    week: 'أسبوع',
    date: 'تاريخ',
    time: 'وقت'
  },
  date: {
    today: 'اليوم',
    tomorrow: 'غدا',
    dayAfterTomorrow: 'بعد غد',
    format: '{{month}}/{{day}}'
  },
  dates: {
    today: 'اليوم',
    tomorrow: 'غدا'
  },
  forecast: {
    title: 'التنبؤ المستقبلي'
  },
  common: {
    loading: 'جاري التحميل...',
    dataSource: 'مصدر البيانات: Windy API',
    visitorCount: 'عدد الزوار: '
  },
  errors: {
    title: 'خطأ',
    networkError: 'خطأ في اتصال الشبكة، يرجى التحقق من إعدادات الشبكة',
    apiError: 'فشل استدعاء API، يرجى المحاولة مرة أخرى لاحقا',
    apiKeyMissing: 'قم بتكوين مفتاح Windy API أولاً',
    apiKeyInvalid: 'مفتاح API غير صالح، يرجى التحقق من التكوين',
    timeout: 'انتهت مهلة الطلب، يرجى إعادة المحاولة',
    unknownError: 'حدث خطأ غير معروف، يرجى إعادة المحاولة',
    locationError: 'فشل تحديد الموقع، جرب اسمًا آخر',
    mapInitFailed: 'فشل تهيئة الخريطة'
  },
  settings: {
    title: 'الإعدادات',
    apiKey: 'مفتاح API',
    apiKeyLabel: 'تكوين مفتاح Windy API',
    apiKeyPlaceholder: 'أدخل مفتاح API',
    apiKeyHelp: 'يرجى إدخال مفتاح Windy API الخاص بك لاستخدام ميزات تنبؤ الطقس',
    language: 'اللغة',
    languageLabel: 'لغة الواجهة',
    notifications: 'الإشعارات',
    notificationsTitle: 'إعدادات الإشعارات',
    notificationsLabel: 'إشعارات توهج الغروب',
    notificationsDescription: 'إعداد تنبيهات التنبؤ عالية الجودة',
    notificationsHelp: 'إرسال إشعار عندما تكون جودة التنبؤ فوق الحد',
    enableNotifications: 'تفعيل تنبيهات الإشعارات',
    thresholdLabel: 'حد النقطة (تنبيه عندما تكون النقطة ≥ هذه القيمة)',
    testNotification: 'اختبار الإشعار',
    notificationThreshold: 'حد الإشعار',
    favoriteLocations: 'المواقع المفضلة',
    searchHistory: 'سجل البحث',
    clearHistory: 'مسح السجل',
    confirmClearHistory: 'هل أنت متأكد من أنك تريد مسح سجل البحث بالكامل؟',
    // لوحة الإعدادات الموحدة
    close: 'إغلاق',
    done: 'تم',
    // مصدر البيانات والشبكة
    dataSource: 'مصدر البيانات والشبكة',
    currentMode: 'الوضع الحالي',
    proxyUrl: 'رابط خادم الوكيل',
    proxyUrlPlaceholder: 'http://localhost:3000',
    proxyUrlHint: 'عنوان رابط خادم الوكيل الخلفي',
    // الإشعارات والتنبيهات
    notificationAndAlerts: 'الإشعارات والتنبيهات',
    enableSunsetNotification: 'تفعيل إشعارات الغروب',
    notificationHint: 'إرسال إشعار المتصفح عند وصول جودة التنبؤ إلى الحد',
    notificationThresholdLabel: 'حد الإشعار',
    notificationThresholdHint: 'إرسال إشعار عندما تكون درجة التنبؤ أعلى من هذه القيمة',
    // اللغة والعرض
    languageAndDisplay: 'اللغة والعرض',
    interfaceLanguage: 'لغة الواجهة',
    // التخصيص
    personalization: 'التخصيص',
    themeMode: 'وضع المظهر',
    themeLight: 'الوضع الفاتح',
    themeDark: 'الوضع الداكن',
    themeAuto: 'تلقائي',
    temperatureUnit: 'وحدة درجة الحرارة',
    tempCelsius: 'مئوية (℃)',
    tempFahrenheit: 'فهرنهايت (℉)',
    windSpeedUnit: 'وحدة سرعة الرياح',
    windKmh: 'كم/ساعة',
    windMs: 'م/ثانية',
    // Location service (Req 24)
    geocodingService: 'Location Service',
    geocodingMode: 'Mode',
    geocodingModeBackend: 'Backend Proxy (Recommended)',
    geocodingModeDirect: 'Frontend Direct',
    geocodingProvider: 'Provider',
    geocodingBackendNominatim: 'Nominatim (Backend)',
        geocodingFrontendNominatim: 'Nominatim (Frontend)',
    geocodingBackendGaode: 'Gaode Maps (Backend)',
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
    title: 'اختيار اللغة',
    confirmChange: 'تأكيد تغيير اللغة',
    confirmChangeMessage: 'سيتم تحديث الواجهة بعد تغيير اللغة. لن يتم فقدان البيانات الحالية. متابعة؟',
    selectLanguage: 'يرجى اختيار لغة الواجهة'
  },
  notifications: {
    title: 'تنبيه توهج الغروب',
    excellentForecast: 'درجة توقع توهج غروب الليلة: {{score}}، ممتاز للمشاهدة!',
    goodForecast: 'درجة توقع توهج غروب الليلة: {{score}}، تستحق الانتظار!',
    time: 'الوقت: {{time}}',
    location: 'الموقع: {{location}}',
    enable: 'تفعيل الإشعارات',
    disable: 'تعطيل الإشعارات',
    permissionDenied: 'تم رفض إذن الإشعار، يرجى السماح بالإشعارات في إعدادات المتصفح',
    permissionGranted: 'تم منح إذن الإشعار',
    threshold: 'إشعار عندما تكون النقطة أعلى من {{threshold}}'
  },
  favorites: {
    title: 'المواقع المفضلة',
    add: 'إضافة إلى المفضلة',
    remove: 'إزالة من المفضلة',
    removeConfirm: 'هل أنت متأكد من أنك تريد إزالة هذا الموقع المفضل؟',
    empty: 'لا توجد مواقع مفضلة بعد',
    manage: 'إدارة المفضلة'
  },
  history: {
    title: 'سجل البحث',
    empty: 'لا يوجد سجل بحث بعد',
    clearAll: 'مسح الكل',
    clearConfirm: 'هل أنت متأكد من أنك تريد مسح سجل البحث بالكامل؟'
  },
  charts: {
    temperature: 'درجة الحرارة',
    precipitation: 'الهطول',
    humidity: 'الرطوبة',
    wind: 'الرياح',
    pressure: 'الضغط',
    clouds: 'السحب',
    hourly: 'التنبؤ لـ 24 ساعة',
    daily: 'التنبؤ لـ 7 أيام',
    overview: 'نظرة عامة',
    details: 'التفاصيل',
    parameters: 'المعلمات',
    trend: 'الاتجاه',
    time: 'الوقت',
    unit: 'الوحدة'
  },

  // 任务18：地图图层
  map: {
    title: 'تنبؤات الخريطة',
    layers: {
      wind: 'رياح',
      temp: 'درجة الحرارة',
      clouds: 'السحب',
      rain: 'مطر'
    },
    currentTime: 'الوقت الحالي：',
    timeNow: 'الآن',
    timeSunset: 'الغروب',
    timeSunrise: 'الشروق',
    timeHint: '💡 تلميح: يمكنك أيضًا سحب الخط الزمني أسفل الخريطة لضبط الوقت',
    loading: 'جاري تحميل الخريطة...',
    error: 'فشل تحميل الخريطة',
    mockNotSupported: 'وظيفة الخريطة متاحة فقط في وضع API الحقيقي'
  },

  // 任务19：周边火烧云
  surrounding: {
    title: 'تحليل السحب الحمراء المحيطة',
    radius: 'نطاق الكشف',
    radiusUnit: 'كم',
    directions: {
      N: 'شمال',
      NE: 'شمال شرق',
      E: 'شرق',
      SE: 'جنوب شرق',
      S: 'جنوب',
      SW: 'جنوب غرب',
      W: 'غرب',
      NW: 'شمال غرب'
    },
    loading: 'جاري جلب بيانات الطقس المحيطة...',
    error: 'فشل في جلب البيانات المحيطة',
    noData: 'لا توجد بيانات محيطة',
    clickToView: 'انقر على الاتجاه لرؤية التفاصيل',
    viewingDirection: 'عرض الاتجاه {{direction}}',
    distanceInfo: '{{distance}} كم',
    recommendation: 'توصيات المشاهدة',
    bestDirections: 'الاتجاهات الموصى بها',
    scoreBreakdown: 'النتائج حسب الاتجاه',
    legend: {
      excellent: 'ممتاز（≥80 نقطة）',
      good: 'جيد（60-79 نقطة）',
      fair: 'متوسط（40-59 نقطة）',
      poor: 'ضعيف（<40 نقطة）'
    },
    fallbackMessage: 'متصفحك لا يدعم Canvas، عرض الجدول'
  },

  // Share
  share: {
    title: 'Share Prediction',
    panelTitle: 'Share',
    saveImage: 'Save Image',
    copyLink: 'Copy Link',
    nativeShare: 'More Share',
    copied: 'Link Copied'
  },

  loading: {
    data: 'جاري تحميل البيانات...',
    weather: 'جاري الحصول على بيانات الطقس...',
    prediction: 'جاري حساب التنبؤ...',
    pleaseWait: 'يرجى الانتظار...'
  },
  other: {
    copyright: '© 2026 تنبؤ الغروب',
    poweredBy: 'بدعم من Windy',
    version: 'الإصدار',
    about: 'حول',
    privacy: 'سياسة الخصوصية',
    terms: 'شروط الخدمة',
    contact: 'اتصل بنا',
    feedback: 'ملاحظات'
  }
};
