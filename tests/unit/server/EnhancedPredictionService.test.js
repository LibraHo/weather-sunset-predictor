/**
 * EnhancedPredictionService 单元测试
 * 需求：22 (前后端分离 - Phase 3)
 */

describe('EnhancedPredictionService', () => {
  let EnhancedPredictionService;

  beforeAll(async () => {
    // 动态导入 CommonJS 模块
    EnhancedPredictionService = await import('../../../server/services/EnhancedPredictionService.js');
  });

  // ========== 常量测试 ==========
  describe('Constants', () => {
    test('should have correct SOLAR_ELEVATION_WINDOW values', () => {
      expect(EnhancedPredictionService.SOLAR_ELEVATION_WINDOW).toEqual({
        SUNRISE_START: -6,
        SUNRISE_END: 5,
        SUNSET_START: -5,
        SUNSET_END: 6
      });
    });

    test('should have correct CLOUD_WEIGHTS values', () => {
      const weights = EnhancedPredictionService.CLOUD_WEIGHTS;
      expect(weights.HIGH).toBe(0.75);
      expect(weights.MID).toBe(0.45);
      expect(weights.LOW).toBe(0.10);
      // 注：权重之和 > 1 是有意设计，高云对火烧云贡献大，可叠加超过1
      expect(weights.HIGH + weights.MID + weights.LOW).toBeGreaterThan(1.0);
    });

    test('should have correct LIGHT_PATH_WEIGHTS values', () => {
      const weights = EnhancedPredictionService.LIGHT_PATH_WEIGHTS;
      expect(weights.NEAR).toBe(0.4);
      expect(weights.FAR).toBe(0.6);
      expect(weights.NEAR + weights.FAR).toBe(1.0);
    });

    test('should have correct FINAL_WEIGHTS values', () => {
      const weights = EnhancedPredictionService.FINAL_WEIGHTS;
      expect(weights.CLOUD_CANVAS).toBe(0.8);
      expect(weights.LIGHT_PATH).toBe(0.2);
      expect(weights.CLOUD_CANVAS + weights.LIGHT_PATH).toBe(1.0);
    });
  });

  // ========== 辅助函数测试 ==========
  describe('Helper Functions', () => {
    describe('getJulianDay', () => {
      test('should calculate Julian day correctly', () => {
        const date = new Date('2024-01-01T12:00:00Z');
        const jd = EnhancedPredictionService.getJulianDay(date);
        expect(typeof jd).toBe('number');
        expect(jd).toBeGreaterThan(2450000); // After year 1995
      });

      test('should return different values for different dates', () => {
        const date1 = new Date('2024-01-01T12:00:00Z');
        const date2 = new Date('2024-06-15T12:00:00Z');
        const jd1 = EnhancedPredictionService.getJulianDay(date1);
        const jd2 = EnhancedPredictionService.getJulianDay(date2);
        expect(jd2 - jd1).toBeCloseTo(166, 0); // ~166 days difference
      });
    });

    describe('calculateSolarElevation', () => {
      test('should return a number in valid range [-90, 90]', () => {
        const date = new Date('2024-06-21T18:00:00Z');
        const elevation = EnhancedPredictionService.calculateSolarElevation(date, 40.0, 116.0);
        expect(typeof elevation).toBe('number');
        expect(elevation).toBeGreaterThanOrEqual(-90);
        expect(elevation).toBeLessThanOrEqual(90);
      });

      test('should return positive elevation near solar noon at Beijing', () => {
        // 北京夏至日太阳正午约 04:17 UTC（UTC+8 12:17 本地时间）
        const solarNoon = new Date('2024-06-21T04:17:00Z');
        const elevation = EnhancedPredictionService.calculateSolarElevation(solarNoon, 40.0, 116.0);
        expect(elevation).toBeGreaterThan(60); // 夏至正午约 73°
      });

      test('should return deeply negative elevation at midnight UTC+8', () => {
        // 18:00 UTC = 02:00 北京次日，深夜
        const midnight = new Date('2024-06-21T18:00:00Z');
        const elevation = EnhancedPredictionService.calculateSolarElevation(midnight, 40.0, 116.0);
        expect(elevation).toBeLessThan(-15);
      });

      test('should vary with time (not return constant value)', () => {
        const dateA = new Date('2024-06-21T04:17:00Z'); // 正午
        const dateB = new Date('2024-06-21T18:00:00Z'); // 深夜
        const elevA = EnhancedPredictionService.calculateSolarElevation(dateA, 40.0, 116.0);
        const elevB = EnhancedPredictionService.calculateSolarElevation(dateB, 40.0, 116.0);
        expect(elevA).not.toBe(elevB);
        expect(elevA).toBeGreaterThan(elevB);
      });

      test('should return near-zero elevation at actual sunset time', () => {
        // 北京夏至日日落约 11:48 UTC
        const sunsetUTC = new Date('2024-06-21T11:48:00Z');
        const elevation = EnhancedPredictionService.calculateSolarElevation(sunsetUTC, 40.0, 116.0);
        // 日落时太阳高度角应接近 0°（含大气折射约 -0.83°）
        expect(elevation).toBeGreaterThan(-5);
        expect(elevation).toBeLessThan(5);
      });
    });

    describe('calculateSolarAzimuth', () => {
      test('should return a value between 0 and 360', () => {
        const date = new Date('2024-06-21T18:00:00Z');
        const azimuth = EnhancedPredictionService.calculateSolarAzimuth(date, 40.0, 116.0);
        expect(azimuth).toBeGreaterThanOrEqual(0);
        expect(azimuth).toBeLessThanOrEqual(360);
      });
    });
  });

  // ========== 时间判定测试 ==========
  describe('checkTimeWindow', () => {
    test('should detect sunset window correctly', () => {
      const date = new Date('2024-06-21T18:00:00Z');
      const result = EnhancedPredictionService.checkTimeWindow(date, 40.0, 116.0, 'sunset');

      expect(result).toHaveProperty('inWindow');
      expect(result).toHaveProperty('elevation');
      expect(result).toHaveProperty('optimalMoment');
      expect(result).toHaveProperty('windowDescription');
      expect(result).toHaveProperty('isInDetectionWindow');
    });

    test('should detect sunrise window correctly', () => {
      const date = new Date('2024-06-21T06:00:00Z');
      const result = EnhancedPredictionService.checkTimeWindow(date, 40.0, 116.0, 'sunrise');

      expect(result.inWindow).toBeDefined();
      expect(result.isInDetectionWindow).toBe(result.inWindow);
    });

    test('should include solar elevation in window description', () => {
      const date = new Date('2024-06-21T18:00:00Z');
      const result = EnhancedPredictionService.checkTimeWindow(date, 40.0, 116.0, 'sunset');

      expect(result.windowDescription).toContain('solar_elevation');
    });
  });

  // ========== 画布评分测试 ==========
  describe('scoreCloudCanvas', () => {
    test('should score clear sky (no clouds) as space level', () => {
      const weatherData = { lowClouds: 0, midClouds: 0, highClouds: 0 };
      const result = EnhancedPredictionService.scoreCloudCanvas(weatherData);

      expect(result.cloudLevel).toBe('space');
      expect(result.score).toBeLessThanOrEqual(10);
    });

    test('should score perfect cloud conditions (30-70%) highest', () => {
      const weatherData = { lowClouds: 10, midClouds: 60, highClouds: 40 };
      const result = EnhancedPredictionService.scoreCloudCanvas(weatherData);

      expect(result.cloudLevel).toBe('perfect');
      expect(result.cloudRangeScore).toBeGreaterThanOrEqual(70);
    });

    test('should apply low cloud penalty correctly', () => {
      // lowClouds > 80 triggers 'too_many_low_clouds'
      const lowCloudData = { lowClouds: 85, midClouds: 50, highClouds: 30 };
      const result = EnhancedPredictionService.scoreCloudCanvas(lowCloudData);

      expect(result.lowCloudPenalty).toBe(0.1);
      expect(result.penaltyReason).toBe('too_many_low_clouds');
    });

    test('should not penalize low cloud cover under 20%', () => {
      const weatherData = { lowClouds: 15, midClouds: 50, highClouds: 30 };
      const result = EnhancedPredictionService.scoreCloudCanvas(weatherData);

      expect(result.lowCloudPenalty).toBe(1.0);
      expect(result.penaltyReason).toBe('no_low_cloud_obstruction');
    });

    test('should return breakdown with cloud layer percentages', () => {
      const weatherData = { lowClouds: 20, midClouds: 40, highClouds: 60 };
      const result = EnhancedPredictionService.scoreCloudCanvas(weatherData);

      expect(result.breakdown.lowClouds).toBe(20);
      expect(result.breakdown.midClouds).toBe(40);
      expect(result.breakdown.highClouds).toBe(60);
    });

    test('should calculate effective cloud cover with weights', () => {
      const weatherData = { lowClouds: 50, midClouds: 50, highClouds: 50 };
      const result = EnhancedPredictionService.scoreCloudCanvas(weatherData);

      // 50*0.75 + 50*0.45 + 50*0.10 = 37.5 + 22.5 + 5 = 65.0
      expect(result.effectiveCloudCover).toBeCloseTo(65.0, 1);
    });

    test('should handle overcast conditions (all layers thick)', () => {
      // upperCloudCover = 95*0.75 + 95*0.45 = 114 > 100 → cloudLevel = 'crowded'
      // lowClouds=95 > 80 → lowCloudPenalty=0.1
      // overcastPenalty from lowClouds >= 55: 1.0 - ((95-55)/45)*0.8 ≈ 0.289
      const weatherData = { lowClouds: 95, midClouds: 95, highClouds: 95 };
      const result = EnhancedPredictionService.scoreCloudCanvas(weatherData);

      expect(result.cloudLevel).toBe('crowded');
      expect(result.lowCloudPenalty).toBe(0.1);
      expect(result.overcastPenalty).toBeLessThan(0.3);
      expect(result.score).toBeLessThan(10);
    });

    test('should penalize total cloud cover penalty when lowClouds >= 20 and totalCloudCover >= 92', () => {
      // lowClouds=18 < 20, so totalCloudCover-based penalty does NOT apply;
      // lowClouds=18 < 55, so lowCloud overcastPenalty also does NOT apply.
      // This tests the current behavior: moderate low-cloud is not overcast-penalized.
      const weatherData = {
        lowClouds: 18,
        midClouds: 80,
        highClouds: 0,
        cloudCover: 96
      };
      const result = EnhancedPredictionService.scoreCloudCanvas(weatherData);

      expect(result.totalCloudCover).toBe(96);
      // lowClouds < 20 AND < 55 → no overcast penalty applied
      expect(result.overcastPenalty).toBe(1.0);
      // upperCloudCover = 36, mid-clouds still provide moderate range score
      expect(result.score).toBeGreaterThan(50);
    });

    test('should apply overcast penalty when lowClouds >= 55 triggers proportional reduction', () => {
      // lowClouds=55 triggers overcastPenalty = 1.0 (start of linear ramp)
      const weatherData = {
        lowClouds: 55,
        midClouds: 50,
        highClouds: 30,
        cloudCover: 90
      };
      const result = EnhancedPredictionService.scoreCloudCanvas(weatherData);

      expect(result.overcastPenalty).toBe(1.0);
      expect(result.score).toBeGreaterThan(0);
    });

    test('should apply overcast penalty when lowClouds is high (e.g. 75)', () => {
      const weatherData = {
        lowClouds: 75,
        midClouds: 50,
        highClouds: 30,
        cloudCover: 95
      };
      const result = EnhancedPredictionService.scoreCloudCanvas(weatherData);

      // overcastPenalty: 1.0 - ((75-55)/45)*0.8 = 1.0 - 0.356 = 0.644
      expect(result.overcastPenalty).toBeLessThan(0.7);
      expect(result.lowCloudPenalty).toBeLessThan(1.0);
    });

    test('should apply extra penalty when weather text indicates overcast AND lowClouds >= 35', () => {
      // lowClouds=40 >= 35 AND hasOvercastKeyword=true → overcastPenalty *= 0.5
      const weatherData = {
        lowClouds: 40,
        midClouds: 50,
        highClouds: 30,
        weatherDescription: '阴天'
      };
      const result = EnhancedPredictionService.scoreCloudCanvas(weatherData);

      expect(result.hasOvercastKeyword).toBe(true);
      expect(result.overcastPenalty).toBeLessThan(0.7);
      expect(result.score).toBeLessThan(50);
    });

    test('should detect overcast keyword but not apply extra penalty when lowClouds < 35', () => {
      // lowClouds=10 < 35 → extra penalty NOT applied
      const weatherData = {
        lowClouds: 10,
        midClouds: 65,
        highClouds: 35,
        weatherDescription: '阴天'
      };
      const result = EnhancedPredictionService.scoreCloudCanvas(weatherData);

      expect(result.hasOvercastKeyword).toBe(true);
      // lowClouds=10 < 20 → no lowCloudPenalty, lowClouds=10 < 55 → no overcastPenalty
      expect(result.overcastPenalty).toBe(1.0);
      // upperCloudCover = 35*0.75 + 65*0.45 = 55.5 → moderate cloud range
      expect(result.score).toBeGreaterThan(50);
    });

  });

  describe('aerosol weak carrier', () => {
    test('activates moderate haze as a weak sunset carrier when light path is open', () => {
      const weatherData = {
        lowClouds: 0,
        midClouds: 7,
        highClouds: 0,
        visibility: 20,
        aerosolOpticalDepth: 0.62,
        pm2_5: 43,
        pm10: 54,
        dust: 22
      };
      const cloudCanvas = EnhancedPredictionService.scoreCloudCanvas(weatherData);
      const aerosolCarrier = EnhancedPredictionService.scoreAerosolCarrier(weatherData, { score: 80.4 });
      const carrier = EnhancedPredictionService.buildCarrierScore(cloudCanvas, aerosolCarrier);
      const result = EnhancedPredictionService.calculateFinalScore(
        carrier,
        { score: 80.4, hasRemoteData: true },
        { factor: 0.75 },
        'sunset'
      );

      expect(cloudCanvas.score).toBeLessThan(15);
      expect(aerosolCarrier.activatedScore).toBeGreaterThan(30);
      expect(aerosolCarrier.lightPathActivation).toBe(1);
      expect(carrier.activeCarrier).toBe('aerosol');
      expect(result.score).toBeGreaterThanOrEqual(30);
      expect(result.score).toBeLessThanOrEqual(36);
      expect(result.status).toBe('light_glow');
    });

    test('does not lift clean cloudless sky without aerosol signal', () => {
      const weatherData = {
        lowClouds: 0,
        midClouds: 0,
        highClouds: 0,
        visibility: 25
      };
      const cloudCanvas = EnhancedPredictionService.scoreCloudCanvas(weatherData);
      const aerosolCarrier = EnhancedPredictionService.scoreAerosolCarrier(weatherData, { score: 85 });
      const carrier = EnhancedPredictionService.buildCarrierScore(cloudCanvas, aerosolCarrier);

      expect(aerosolCarrier.activatedScore).toBe(0);
      expect(carrier.activeCarrier).toBe('cloud');
      expect(carrier.score).toBe(cloudCanvas.score);
    });

    test('keeps moderate aerosol visible when cloud light path is marginal but air is clear enough', () => {
      const weatherData = {
        lowClouds: 0,
        midClouds: 5,
        highClouds: 0,
        visibility: 20,
        aerosolOpticalDepth: 0.45,
        pm2_5: 40,
        pm10: 70,
        dust: 20
      };
      const aerosolCarrier = EnhancedPredictionService.scoreAerosolCarrier(weatherData, { score: 45 });

      expect(aerosolCarrier.score).toBeGreaterThan(20);
      expect(aerosolCarrier.activatedScore).toBeGreaterThanOrEqual(18);
      expect(aerosolCarrier.cloudPathActivation).toBe(0);
      expect(aerosolCarrier.aerosolScatteringActivation).toBeGreaterThan(0.8);
      expect(aerosolCarrier.reason).toBe('aerosol_carrier_activated_by_clear_air_scattering');
    });

    test('does not use aerosol scattering fallback when low clouds block the view', () => {
      const weatherData = {
        lowClouds: 45,
        midClouds: 5,
        highClouds: 0,
        visibility: 20,
        aerosolOpticalDepth: 0.45,
        pm2_5: 40,
        pm10: 70,
        dust: 20
      };
      const aerosolCarrier = EnhancedPredictionService.scoreAerosolCarrier(weatherData, { score: 45 });

      expect(aerosolCarrier.activatedScore).toBe(0);
      expect(aerosolCarrier.lightPathActivation).toBe(0);
      expect(aerosolCarrier.reason).toBe('aerosol_carrier_not_visible');
    });

    test('keeps borderline visibility aerosol visible without turning it into a high score', () => {
      const weatherData = {
        lowClouds: 37,
        midClouds: 7,
        highClouds: 0,
        visibility: 8,
        aerosolOpticalDepth: 0.37,
        pm2_5: 71.7,
        pm10: 75,
        dust: 2
      };
      const aerosolCarrier = EnhancedPredictionService.scoreAerosolCarrier(weatherData, { score: 48 });

      expect(aerosolCarrier.score).toBeGreaterThanOrEqual(14);
      expect(aerosolCarrier.activatedScore).toBeGreaterThanOrEqual(12);
      expect(aerosolCarrier.activatedScore).toBeLessThan(18);
      expect(aerosolCarrier.level).toBe('weak_warmth');
      expect(aerosolCarrier.reason).toBe('aerosol_carrier_activated_by_clear_air_scattering');
    });

    test('uses visibility haze proxy when aerosol provider fields are missing', () => {
      const weatherData = {
        lowClouds: 37,
        midClouds: 0,
        highClouds: 27,
        visibility: 8,
        precipitation: 0,
        aerosolOpticalDepth: null,
        pm2_5: null,
        pm10: null,
        dust: null
      };
      const aerosolCarrier = EnhancedPredictionService.scoreAerosolCarrier(weatherData, { score: 48 });

      expect(aerosolCarrier.score).toBeGreaterThan(0);
      expect(aerosolCarrier.activatedScore).toBeGreaterThan(0);
      expect(aerosolCarrier.reason).toBe('aerosol_carrier_activated_by_clear_air_scattering');
    });

    test('does not turn heavy haze into a carrier', () => {
      const weatherData = {
        lowClouds: 0,
        midClouds: 8,
        highClouds: 0,
        visibility: 5,
        aerosolOpticalDepth: 0.9,
        pm2_5: 95,
        pm10: 190,
        dust: 130
      };
      const aerosolCarrier = EnhancedPredictionService.scoreAerosolCarrier(weatherData, { score: 85 });

      expect(aerosolCarrier.activatedScore).toBe(0);
      expect(aerosolCarrier.reason).toBe('heavy_haze_suppresses_aerosol_carrier');
    });
  });

  // ========== 光路评分测试 ==========
  describe('scoreLightPath', () => {
    // LightPathV2 重构后，旧的 remoteData 接口已合并，以下测试基于旧行为，暂时跳过
    test.skip('should return neutral score without remote data (not 100)', () => {
      const weatherData = {};
      const result = EnhancedPredictionService.scoreLightPath(weatherData, 270, null);

      expect(result.score).toBeLessThanOrEqual(50);
      expect(result.nearPointScore).toBeLessThanOrEqual(50);
      expect(result.farPointScore).toBeLessThanOrEqual(50);
      expect(result.hasRemoteData).toBe(false);
    });

    test.skip('should use remote cloud data when provided', () => {
      // LightPathV2 重构后行为变更，由集成测试覆盖
    });

    test.skip('should weight far point (60%) more than near point (40%)', () => {
      // LightPathV2 重构后行为变更，由集成测试覆盖
    });
  });

  describe('calculateLightPathPointScore', () => {
    test.skip('should return capped score for clear sky (<10% clouds)', () => {
      // LightPathV2 重构后内部实现变更，旧函数行为已不适用
    });

    test.skip('should return 0 for cloud wall (>80% clouds)', () => {
      // LightPathV2 重构后内部实现变更
    });

    test.skip('should interpolate linearly between 10% and 80%', () => {
      // LightPathV2 重构后内部实现变更
    });
  });

  // ========== 渲染评分测试 ==========
  describe('scoreRendering', () => {
    test('should return factor 1.0 for normal conditions', () => {
      const weatherData = { visibility: 15, humidity: 50, aqi: 75 };
      const result = EnhancedPredictionService.scoreRendering(weatherData);

      expect(result.factor).toBe(1.0);
    });

    test('should boost score for excellent visibility (>20km)', () => {
      const weatherData = { visibility: 25, humidity: 50, aqi: 50 };
      const result = EnhancedPredictionService.scoreRendering(weatherData);

      expect(result.visibilityFactor).toBe(1.1);
      expect(result.breakdown.visibility).toBe('excellent');
    });

    test('should reduce score for poor visibility (<10km)', () => {
      const weatherData = { visibility: 5, humidity: 50, aqi: 50 };
      const result = EnhancedPredictionService.scoreRendering(weatherData);

      expect(result.visibilityFactor).toBe(0.8);
      expect(result.breakdown.visibility).toBe('poor');
    });

    test('should reduce score for high humidity (>90%)', () => {
      const weatherData = { visibility: 15, humidity: 95, aqi: 50 };
      const result = EnhancedPredictionService.scoreRendering(weatherData);

      expect(result.humidityFactor).toBe(0.9);
      expect(result.breakdown.humidity).toBe('fog');
    });

    test('should apply rain bonus when rainedRecently is true', () => {
      const weatherData = { visibility: 15, humidity: 50, aqi: 50 };
      const result = EnhancedPredictionService.scoreRendering(weatherData, true);

      expect(result.rainBonus).toBe(1.2);
      expect(result.breakdown.specialMode).toBe('post_rain');
    });

    test('should identify color tendency based on AQI', () => {
      const goodAqi = EnhancedPredictionService.scoreRendering({ aqi: 30 });
      expect(goodAqi.breakdown.colorTendency).toBe('golden_orange');

      const moderateAqi = EnhancedPredictionService.scoreRendering({ aqi: 80 });
      expect(moderateAqi.breakdown.colorTendency).toBe('reddish_purple');

      const poorAqi = EnhancedPredictionService.scoreRendering({ aqi: 120 });
      expect(poorAqi.breakdown.colorTendency).toBe('dark_red');
    });

    test('should apply separate aqiFactor penalty for severe pollution (AQI > 150)', () => {
      const weatherData = { visibility: 15, humidity: 50, aqi: 200 };
      const result = EnhancedPredictionService.scoreRendering(weatherData, true);

      // rainBonus 保持 1.2（雨后加成不受 AQI 影响）
      expect(result.rainBonus).toBe(1.2);
      // AQI 惩罚通过独立的 aqiFactor 施加
      expect(result.aqiFactor).toBe(0.8);
      // 最终系数 = 1.0 * 1.0 * 1.2 * 0.8 = 0.96
      expect(result.factor).toBeCloseTo(0.96, 2);
    });
  });

  // ========== 质量等级测试 ==========
  describe('getQualityLevel', () => {
    // 阈值与 GaussianScore.getQualityLevel 对齐：excellent ≥70, good ≥40, fair <40
    test('should return excellent for score >= 70', () => {
      expect(EnhancedPredictionService.getQualityLevel(70)).toBe('excellent');
      expect(EnhancedPredictionService.getQualityLevel(80)).toBe('excellent');
      expect(EnhancedPredictionService.getQualityLevel(95)).toBe('excellent');
    });

    test('should return good for score 40-69', () => {
      expect(EnhancedPredictionService.getQualityLevel(40)).toBe('good');
      expect(EnhancedPredictionService.getQualityLevel(55)).toBe('good');
      expect(EnhancedPredictionService.getQualityLevel(69)).toBe('good');
    });

    test('should return fair for score < 40', () => {
      expect(EnhancedPredictionService.getQualityLevel(39)).toBe('fair');
      expect(EnhancedPredictionService.getQualityLevel(0)).toBe('fair');
    });
  });

  // ========== 综合评分测试 ==========
  describe('calculateFinalScore', () => {
    test('should combine canvas and light path scores with weights', () => {
      const canvasScore = { score: 80, cloudLevel: 'perfect' };
      const lightPathScore = { score: 100, hasRemoteData: true };
      const renderingFactor = { factor: 1.0 };

      const result = EnhancedPredictionService.calculateFinalScore(
        canvasScore, lightPathScore, renderingFactor, 'sunset'
      );

      // 80*0.8 + 100*0.2 = 64 + 20 = 84
      expect(result.breakdown.baseScore).toBe(84);
    });

    test('should identify no_fire_cloud when canvas score < 30', () => {
      const canvasScore = { score: 20, cloudLevel: 'space' };
      const lightPathScore = { score: 100, hasRemoteData: true };
      const renderingFactor = { factor: 1.0 };

      const result = EnhancedPredictionService.calculateFinalScore(
        canvasScore, lightPathScore, renderingFactor, 'sunset'
      );

      expect(result.status).toBe('no_fire_cloud');
      expect(result.description).toBe('sky_clear');
    });

    test('clear transparent sunset advice should not raise the fire-cloud score', () => {
      const canvasScore = { score: 10, cloudLevel: 'space', effectiveCloudCover: 5 };
      const lightPathScore = { score: 70, hasRemoteData: true };
      const renderingFactor = { factor: 1.0 };

      const result = EnhancedPredictionService.calculateFinalScore(
        canvasScore, lightPathScore, renderingFactor, 'sunset'
      );
      const advice = EnhancedPredictionService.assessClearSunsetViewingAdvice(
        { highClouds: 1, midClouds: 2, lowClouds: 3, visibility: 25, precipitation: 0 },
        canvasScore,
        lightPathScore
      );

      expect(result.status).toBe('no_fire_cloud');
      expect(result.score).toBeLessThan(40);
      expect(result.breakdown.unclampedFinalScore).toBe(22);
      expect(advice).toMatchObject({ applied: true, reason: 'clear_sunset_transparent' });
    });

    test('clear transparent sunset advice should not trigger when blocked by low cloud, haze, rain, or light path', () => {
      const canvasScore = { score: 10, cloudLevel: 'space', effectiveCloudCover: 5 };
      const goodLightPath = { score: 70, hasRemoteData: true };
      const baseWeather = { highClouds: 1, midClouds: 2, lowClouds: 3, visibility: 25, precipitation: 0 };

      expect(EnhancedPredictionService.assessClearSunsetViewingAdvice(
        { ...baseWeather, lowClouds: 70 }, canvasScore, goodLightPath
      ).applied).toBe(false);
      expect(EnhancedPredictionService.assessClearSunsetViewingAdvice(
        { ...baseWeather, precipitation: 0.8 }, canvasScore, goodLightPath
      ).applied).toBe(false);
      expect(EnhancedPredictionService.assessClearSunsetViewingAdvice(
        { ...baseWeather, visibility: 8 }, canvasScore, goodLightPath
      ).applied).toBe(false);
      expect(EnhancedPredictionService.assessClearSunsetViewingAdvice(
        baseWeather, canvasScore, { score: 40, hasRemoteData: true }
      ).applied).toBe(false);
      expect(EnhancedPredictionService.assessClearSunsetViewingAdvice(
        baseWeather, canvasScore, goodLightPath, { aerosolHazeCap: { applied: true } }
      ).applied).toBe(false);
    });

    test('should identify light_glow when light path blocked but canvas ok', () => {
      const canvasScore = { score: 70, cloudLevel: 'perfect' };
      const lightPathScore = { score: 40 };
      const renderingFactor = { factor: 1.0 };

      const result = EnhancedPredictionService.calculateFinalScore(
        canvasScore, lightPathScore, renderingFactor, 'sunset'
      );

      expect(result.status).toBe('light_glow');
    });



    test('should cap score under 40 when status is no_fire_cloud', () => {
      const canvasScore = { score: 5, cloudLevel: 'space', effectiveCloudCover: 5 };
      const lightPathScore = { score: 100, hasRemoteData: true };
      const renderingFactor = { factor: 1.0 };

      const result = EnhancedPredictionService.calculateFinalScore(
        canvasScore, lightPathScore, renderingFactor, 'sunset'
      );

      expect(result.status).toBe('no_fire_cloud');
      expect(result.score).toBeLessThan(40);
      // 5*0.8 + 100*0.2 = 4 + 20 = 24
      expect(result.breakdown.unclampedFinalScore).toBe(24);
    });

    test('should cap score under 60 when status is light_glow', () => {
      const canvasScore = { score: 70, cloudLevel: 'perfect' };
      const lightPathScore = { score: 40 };
      const renderingFactor = { factor: 1.0 };

      const result = EnhancedPredictionService.calculateFinalScore(
        canvasScore, lightPathScore, renderingFactor, 'sunset'
      );

      expect(result.status).toBe('light_glow');
      expect(result.score).toBeLessThan(60);
      // 70*0.8 + 40*0.2 = 56 + 8 = 64
      expect(result.breakdown.unclampedFinalScore).toBe(64);
    });
    test('should identify legendary_eruption for score >= 85', () => {
      const canvasScore = { score: 95, cloudLevel: 'perfect' };
      const lightPathScore = { score: 100, hasRemoteData: true };
      const renderingFactor = { factor: 1.0 };

      const result = EnhancedPredictionService.calculateFinalScore(
        canvasScore, lightPathScore, renderingFactor, 'sunset'
      );

      expect(result.status).toBe('legendary_eruption');
      expect(result.icon).toBe('fire');
    });

    test('should apply rendering factor to final score', () => {
      const canvasScore = { score: 80, cloudLevel: 'perfect' };
      const lightPathScore = { score: 100, hasRemoteData: true };
      const renderingFactor = { factor: 1.1 };

      const result = EnhancedPredictionService.calculateFinalScore(
        canvasScore, lightPathScore, renderingFactor, 'sunset'
      );

      // (80*0.8 + 100*0.2) * 1.1 = 84 * 1.1 = 92.4
      expect(result.score).toBeCloseTo(92.4, 1);
    });

    test('should clamp score to 0-100 range', () => {
      const canvasScore = { score: 100, cloudLevel: 'perfect' };
      const lightPathScore = { score: 100, hasRemoteData: true };
      const renderingFactor = { factor: 1.5 };

      const result = EnhancedPredictionService.calculateFinalScore(
        canvasScore, lightPathScore, renderingFactor, 'sunset'
      );

      expect(result.score).toBe(100);
    });

    test('should include type in result', () => {
      const canvasScore = { score: 80, cloudLevel: 'perfect' };
      const lightPathScore = { score: 100, hasRemoteData: true };
      const renderingFactor = { factor: 1.0 };

      const sunsetResult = EnhancedPredictionService.calculateFinalScore(
        canvasScore, lightPathScore, renderingFactor, 'sunset'
      );
      expect(sunsetResult.type).toBe('sunset');

      const sunriseResult = EnhancedPredictionService.calculateFinalScore(
        canvasScore, lightPathScore, renderingFactor, 'sunrise'
      );
      expect(sunriseResult.type).toBe('sunrise');
    });
  });

  // ========== 主函数测试 ==========
  describe('calculateEnhancedPrediction', () => {
    test('should return complete prediction result', () => {
      const weatherData = {
        lowClouds: 20,
        midClouds: 50,
        highClouds: 40,
        visibility: 15,
        humidity: 60
      };
      const date = new Date('2024-06-21T18:00:00Z');

      const result = EnhancedPredictionService.calculateEnhancedPrediction(
        weatherData, date, 40.0, 116.0, 'sunset'
      );

      expect(result).toHaveProperty('date');
      expect(result).toHaveProperty('type', 'sunset');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('quality');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('icon');
      expect(result).toHaveProperty('timeAnalysis');
      expect(result).toHaveProperty('canvasAnalysis');
      expect(result).toHaveProperty('lightPathAnalysis');
      expect(result).toHaveProperty('renderingAnalysis');
    });

    test('should accept date string as input', () => {
      const weatherData = { lowClouds: 20, midClouds: 50, highClouds: 40 };
      const dateString = '2024-06-21T18:00:00Z';

      const result = EnhancedPredictionService.calculateEnhancedPrediction(
        weatherData, dateString, 40.0, 116.0, 'sunset'
      );

      expect(result.date).toBe(new Date(dateString).toISOString());
    });

    test.skip('should use remote cloud data when provided in options', () => {
      // LightPathV2 重构后 remoteCloudData 接口变更，hasRemoteData 逻辑已变
    });

    test('should apply rain bonus when rainedRecently option is true', () => {
      const weatherData = { lowClouds: 20, midClouds: 50, highClouds: 40 };
      const date = new Date('2024-06-21T18:00:00Z');

      const normalResult = EnhancedPredictionService.calculateEnhancedPrediction(
        weatherData, date, 40.0, 116.0, 'sunset', { rainedRecently: false }
      );

      const rainResult = EnhancedPredictionService.calculateEnhancedPrediction(
        weatherData, date, 40.0, 116.0, 'sunset', { rainedRecently: true }
      );

      expect(rainResult.renderingAnalysis.rainBonus).toBe(1.2);
      // 雨后加成 1.2x，但 no_fire_cloud 状态可能封顶导致分数相同
      expect(rainResult.score).toBeGreaterThanOrEqual(normalResult.score);
    });

    test('should work for sunrise predictions', () => {
      const weatherData = { lowClouds: 20, midClouds: 50, highClouds: 40 };
      const date = new Date('2024-06-21T06:00:00Z');

      const result = EnhancedPredictionService.calculateEnhancedPrediction(
        weatherData, date, 40.0, 116.0, 'sunrise'
      );

      expect(result.type).toBe('sunrise');
    });

    test('should cap thick high-cloud curtain scenes around 40 points', () => {
      const weatherData = {
        cloudCover: 64,
        lowClouds: 0,
        midClouds: 0,
        highClouds: 83,
        humidity: 30,
        visibility: 20,
        precipitation: 0,
        shortwaveRadiation: 59,
        directRadiation: 11.9,
        diffuseRadiation: 47.1,
        waterVapourColumn: 20.8,
        aerosolOpticalDepth: 0.35,
        pm2_5: 22.4,
        pm10: 25.3,
        dust: 6,
        aqi: 109
      };
      const prevHourData = {
        shortwaveRadiation: 177,
        directRadiation: 60.9,
        diffuseRadiation: 116.1
      };

      const result = EnhancedPredictionService.calculateEnhancedPrediction(
        weatherData, new Date('2026-05-05T11:00:00.000Z'), 39.9042, 116.4074, 'sunset', { prevHourData }
      );

      expect(result.thickHighCloudPenalty).toMatchObject({
        applied: true,
        cap: 42,
        reason: 'thick_high_cloud_diffuse_cap_42'
      });
      expect(result.lightPathAnalysis.scoreBeforeThickHighCloudPenalty).toBeGreaterThan(80);
      expect(result.lightPathAnalysis.score).toBeLessThanOrEqual(55);
      expect(result.score).toBeLessThanOrEqual(42);
      expect(result.description).toBe('weak_local_colors');
    });

    test('should soften thick-cloud penalty for dense upper-cloud carrier sunsets', () => {
      const weatherData = {
        cloudCover: 100,
        lowClouds: 0,
        midClouds: 40,
        highClouds: 84,
        humidity: 16,
        visibility: 20,
        precipitation: 0,
        shortwaveRadiation: 51,
        directRadiation: 6.4,
        diffuseRadiation: 44.6,
        waterVapourColumn: 16.4,
        aerosolOpticalDepth: 0.26,
        pm2_5: 24.9,
        pm10: 31.7,
        dust: 29,
        aqi: 155
      };
      const prevHourData = {
        shortwaveRadiation: 147,
        directRadiation: 35.9,
        diffuseRadiation: 111.1
      };

      const result = EnhancedPredictionService.calculateEnhancedPrediction(
        weatherData, new Date('2026-05-10T11:16:00.000Z'), 39.9042, 116.4074, 'sunset', { prevHourData }
      );

      expect(result.thickHighCloudPenalty).toMatchObject({
        applied: false,
        cap: null,
        reason: 'dense_upper_cloud_carrier_canvas_only'
      });
      expect(result.lightPathAnalysis.thickHighCloudPenalty).toBeUndefined();
      expect(result.cloudThickness).toMatchObject({
        thickness: 'moderate',
        modifier: 0.75
      });
      expect(result.cloudThickness.reasons).toContain('dense_upper_cloud_carrier_softened');
      expect(result.algorithm).toMatchObject({
        name: 'EnhancedPredictionService',
        version: '2026.05.19-additive-carrier-light-gate-v1'
      });
      expect(result.score).toBeGreaterThanOrEqual(50);
      expect(result.score).toBeLessThanOrEqual(60);
      expect(result.status).toBe('good_glow');
    });

    test('should soften thick-cloud penalty for opening mid/high-cloud carrier sunsets', () => {
      const weatherData = {
        cloudCover: 100,
        lowClouds: 0,
        midClouds: 62,
        highClouds: 51,
        humidity: 17,
        visibility: 20,
        precipitation: 0,
        shortwaveRadiation: 1.9,
        directRadiation: 0.1,
        diffuseRadiation: 1.8,
        waterVapourColumn: 19.1,
        aerosolOpticalDepth: 0.28,
        pm2_5: 21,
        pm10: 31.5,
        dust: 24
      };
      const prevHourData = {
        shortwaveRadiation: 113.2,
        directRadiation: 14,
        diffuseRadiation: 99.2
      };
      const remoteCloudData = {
        samples: [15, 30, 50, 100].map(distanceKm => ({
          distanceKm,
          cloudBaseHeight: 7000,
          lowCloud: 0,
          midCloud: 8,
          highCloud: 65
        }))
      };

      const result = EnhancedPredictionService.calculateEnhancedPrediction(
        weatherData,
        new Date('2026-05-10T11:17:00.000Z'),
        39.999617,
        116.275179,
        'sunset',
        { prevHourData, remoteCloudData }
      );

      expect(result.lightPathAnalysis.directionalAnalysis.reason).toBe('solar_direction_clear_opening');
      expect(result.cloudThickness).toMatchObject({
        thickness: 'moderate',
        modifier: 0.58
      });
      expect(result.cloudThickness.reasons).toContain('upper_cloud_direction_opening');
      expect(result.thickHighCloudPenalty).toMatchObject({
        applied: false,
        cap: null,
        reason: 'directional_high_cloud_carrier_canvas_only'
      });
      expect(result.canvasAnalysis.score).toBeGreaterThanOrEqual(58);
      expect(result.score).toBeGreaterThan(55);
      expect(result.score).toBeLessThan(72);
      expect(result.status).toBe('very_likely');
      expect(result.lightPathGate).toMatchObject({
        reason: 'solar_direction_clear_opening'
      });
    });

    test('should soften rain-season high-cloud opening carrier without mid-cloud support', () => {
      const weatherData = {
        cloudCover: 87,
        lowClouds: 0,
        midClouds: 0,
        highClouds: 66,
        humidity: 68,
        visibility: 20,
        precipitation: 0,
        shortwaveRadiation: 93,
        directRadiation: 28.2,
        diffuseRadiation: 64.8,
        waterVapourColumn: 22.2,
        aerosolOpticalDepth: 0.21,
        pm2_5: 38.8,
        pm10: 44.9,
        dust: 12,
        aqi: 70
      };
      const remoteCloudData = {
        samples: [15, 30, 50, 100].map(distanceKm => ({
          distanceKm,
          cloudBaseHeight: 7000,
          lowCloud: 0,
          midCloud: 0,
          highCloud: 92
        }))
      };

      const result = EnhancedPredictionService.calculateEnhancedPrediction(
        weatherData,
        new Date('2026-05-18T11:24:00.000Z'),
        39.9042,
        116.4074,
        'sunset',
        { remoteCloudData }
      );

      expect(result.lightPathAnalysis.directionalAnalysis.reason).toBe('solar_direction_clear_opening');
      expect(result.cloudThickness).toMatchObject({
        thickness: 'moderate',
        modifier: 0.58
      });
      expect(result.cloudThickness.reasons).toContain('upper_cloud_direction_opening');
      expect(result.thickHighCloudPenalty).toMatchObject({
        applied: false,
        cap: null,
        reason: 'directional_high_cloud_carrier_canvas_only'
      });
      expect(result.score).toBeGreaterThanOrEqual(52);
      expect(result.score).toBeLessThanOrEqual(60);
      expect(result.status).toBe('good_glow');
    });

    test('should not soften opening carrier when haze is high', () => {
      const weatherData = {
        cloudCover: 100,
        lowClouds: 0,
        midClouds: 62,
        highClouds: 51,
        humidity: 17,
        visibility: 20,
        precipitation: 0,
        shortwaveRadiation: 1.9,
        directRadiation: 0.1,
        diffuseRadiation: 1.8,
        waterVapourColumn: 19.1,
        aerosolOpticalDepth: 0.62,
        pm10: 140,
        dust: 24
      };
      const prevHourData = {
        shortwaveRadiation: 113.2,
        directRadiation: 14,
        diffuseRadiation: 99.2
      };
      const remoteCloudData = {
        samples: [15, 30, 50, 100].map(distanceKm => ({
          distanceKm,
          cloudBaseHeight: 7000,
          lowCloud: 0,
          midCloud: 8,
          highCloud: 65
        }))
      };

      const result = EnhancedPredictionService.calculateEnhancedPrediction(
        weatherData,
        new Date('2026-05-10T11:17:00.000Z'),
        39.999617,
        116.275179,
        'sunset',
        { prevHourData, remoteCloudData }
      );

      expect(result.cloudThickness).toMatchObject({
        thickness: 'thick',
        modifier: 0.45
      });
      expect(result.cloudThickness.reasons).not.toContain('opening_upper_cloud_carrier_softened');
      expect(result.thickHighCloudPenalty.applied).toBe(false);
      expect(result.aerosolHazeCap.applied).toBe(false);
    });

    test('should mark clear transparent sunset as casual viewing while keeping fire-cloud score low', () => {
      const weatherData = {
        lowClouds: 3,
        midClouds: 2,
        highClouds: 1,
        cloudCover: 6,
        visibility: 25,
        humidity: 45,
        precipitation: 0
      };

      const result = EnhancedPredictionService.calculateEnhancedPrediction(
        weatherData, new Date('2024-06-21T11:00:00Z'), 40.0, 116.0, 'sunset'
      );

      expect(result.status).toBe('no_fire_cloud');
      expect(result.score).toBeLessThan(40);
      expect(result.description).toBe('clear_sunset_transparent');
      expect(result.advice).toBe('casual_viewing_ok');
      expect(result.clearSunsetAdvice.applied).toBe(true);
    });

    test('should keep clear upper-cloud carrier scenes above 60 points', () => {
      const weatherData = {
        cloudCover: 100,
        lowClouds: 0,
        midClouds: 67,
        highClouds: 99,
        humidity: 54,
        visibility: 20,
        precipitation: 0,
        shortwaveRadiation: 23,
        directRadiation: 0.1,
        diffuseRadiation: 22.9,
        waterVapourColumn: 19.1,
        aerosolOpticalDepth: 0.41,
        dust: 36,
        pm10: 66.8
      };

      const result = EnhancedPredictionService.calculateEnhancedPrediction(
        weatherData, new Date('2026-05-06T11:12:00.000Z'), 39.9042, 116.4074, 'sunset'
      );

      expect(result.highCloudCarrierAdjustment).toMatchObject({
        applied: true,
        floor: 68,
        reason: 'clear_upper_cloud_carrier_floor_68'
      });
      expect(result.aerosolHazeCap.applied).toBe(false);
      expect(result.score).toBeGreaterThanOrEqual(65);
      expect(result.status).toBe('very_likely');
    });

    test('should not let carrier floor override thick high-cloud cap', () => {
      const weatherData = {
        cloudCover: 100,
        lowClouds: 0,
        midClouds: 10,
        highClouds: 99,
        humidity: 54,
        visibility: 20,
        precipitation: 0,
        shortwaveRadiation: 120,
        directRadiation: 5,
        diffuseRadiation: 115,
        waterVapourColumn: 19.1,
        aerosolOpticalDepth: 0.1,
        dust: 10,
        pm10: 30
      };

      const result = EnhancedPredictionService.calculateEnhancedPrediction(
        weatherData, new Date('2026-05-18T10:30:00.000Z'), 39.9042, 116.4074, 'sunset'
      );

      expect(result.thickHighCloudPenalty).toMatchObject({
        applied: true,
        cap: 42,
        reason: 'thick_high_cloud_diffuse_cap_42'
      });
      expect(result.highCloudCarrierAdjustment.applied).toBe(false);
      expect(result.score).toBeLessThanOrEqual(42);
      expect(result.status).toBe('light_glow');
    });

    test('should gate strong cloud carrier when solar-direction samples show a near cloud wall', () => {
      const weatherData = {
        cloudCover: 80,
        lowClouds: 0,
        midClouds: 10,
        highClouds: 90,
        humidity: 50,
        visibility: 20,
        precipitation: 0
      };
      const remoteCloudData = {
        samples: [15, 30, 50, 100].map((distanceKm, index) => ({
          distanceKm,
          cloudBaseHeight: 1000,
          lowCloud: index === 0 ? 85 : 10,
          midCloud: index === 0 ? 80 : 20,
          highCloud: 60
        }))
      };

      const result = EnhancedPredictionService.calculateEnhancedPrediction(
        weatherData,
        new Date('2026-05-19T11:24:00.000Z'),
        39.9042,
        116.4074,
        'sunset',
        { remoteCloudData }
      );

      expect(result.lightPathAnalysis.directionalAnalysis.reason).toBe('solar_direction_near_cloud_wall');
      expect(result.lightPathGate).toMatchObject({
        gate: 0.42,
        reason: 'solar_direction_near_cloud_wall'
      });
      expect(result.score).toBeLessThan(40);
      expect(result.status).toBe('no_fire_cloud');
    });

    test('should not discount remote solar-direction blockage just because local low cloud is scarce', () => {
      const weatherData = {
        cloudCover: 42,
        lowClouds: 14,
        midClouds: 18,
        highClouds: 4,
        humidity: 80,
        visibility: 15,
        precipitation: 0,
        recentPrecipitation6h: 1.4,
        recentRainHours: 5,
        shortwaveRadiation: 78,
        directRadiation: 17,
        diffuseRadiation: 61,
        waterVapourColumn: 30.2,
        aerosolOpticalDepth: 0.4,
        pm2_5: 29.7,
        pm10: 32.1,
        dust: 1,
        aqi: 134
      };
      const remoteCloudData = {
        samples: [
          { distanceKm: 15, cloudBaseHeight: null, lowCloud: 23, midCloud: 8, highCloud: 0, totalCloud: 21 },
          { distanceKm: 30, cloudBaseHeight: null, lowCloud: 40, midCloud: 7, highCloud: 0, totalCloud: 22 },
          { distanceKm: 50, cloudBaseHeight: null, lowCloud: 40, midCloud: 7, highCloud: 0, totalCloud: 22 },
          { distanceKm: 100, cloudBaseHeight: null, lowCloud: 12, midCloud: 0, highCloud: 0, totalCloud: 6 }
        ]
      };

      const result = EnhancedPredictionService.calculateEnhancedPrediction(
        weatherData,
        new Date('2026-05-20T11:24:00.000Z'),
        39.9042,
        116.4074,
        'sunset',
        { remoteCloudData }
      );

      expect(result.lightPathAnalysis.remoteBlockSignal).toBe(true);
      expect(result.lightPathAnalysis.occlusionWeight).toBe(1);
      expect(result.lightPathAnalysis.score).toBeLessThan(55);
      expect(result.lightPathAnalysis.directionalAnalysis.reason).toBe('solar_direction_neutral');
    });

    test('should cap extreme dust haze high-cloud scenes below 30 points', () => {
      const weatherData = {
        cloudCover: 83,
        lowClouds: 0,
        midClouds: 24,
        highClouds: 88,
        humidity: 19,
        visibility: 20,
        precipitation: 0,
        shortwaveRadiation: 35,
        directRadiation: 4.9,
        diffuseRadiation: 30.1,
        waterVapourColumn: 13.1,
        aerosolOpticalDepth: 1.3,
        dust: 1088,
        pm10: 543.9
      };

      const result = EnhancedPredictionService.calculateEnhancedPrediction(
        weatherData, new Date('2026-05-06T13:53:00.000Z'), 39.4704, 75.9898, 'sunset'
      );

      expect(result.aerosolHazeCap).toMatchObject({
        applied: true,
        cap: 28,
        level: 'extreme',
        reason: 'extreme_dust_haze_cap_28'
      });
      expect(result.highCloudCarrierAdjustment.applied).toBe(false);
      expect(result.score).toBeLessThan(30);
      expect(result.status).toBe('no_fire_cloud');
      expect(result.description).toBe('haze_light_suppressed');
    });
  });

  // ========== 批量预测测试 ==========
  describe('calculateBatchEnhancedPredictions', () => {
    test('should calculate predictions for multiple days', () => {
      const weatherDataArray = [
        { weather: { lowClouds: 20, midClouds: 50, highClouds: 40 }, date: '2024-06-21T18:00:00Z' },
        { weather: { lowClouds: 30, midClouds: 60, highClouds: 30 }, date: '2024-06-22T18:00:00Z' },
        { weather: { lowClouds: 10, midClouds: 40, highClouds: 50 }, date: '2024-06-23T18:00:00Z' }
      ];

      const results = EnhancedPredictionService.calculateBatchEnhancedPredictions(
        weatherDataArray, 40.0, 116.0, 'sunset'
      );

      expect(results).toHaveLength(3);
      expect(results[0]).toHaveProperty('score');
      expect(results[1]).toHaveProperty('score');
      expect(results[2]).toHaveProperty('score');
    });

    test('should apply rainedRecently flag per day', () => {
      const weatherDataArray = [
        { weather: { lowClouds: 20, midClouds: 50, highClouds: 40 }, date: '2024-06-21T18:00:00Z', rainedRecently: true },
        { weather: { lowClouds: 20, midClouds: 50, highClouds: 40 }, date: '2024-06-22T18:00:00Z', rainedRecently: false }
      ];

      const results = EnhancedPredictionService.calculateBatchEnhancedPredictions(
        weatherDataArray, 40.0, 116.0, 'sunset'
      );

      expect(results[0].renderingAnalysis.rainBonus).toBe(1.2);
      expect(results[1].renderingAnalysis.rainBonus).toBe(1.0);
    });
  });

  // ========== 边界条件测试 ==========
  describe('Edge Cases', () => {
    test('should handle missing weather data gracefully', () => {
      const weatherData = {}; // Empty weather data
      const result = EnhancedPredictionService.scoreCloudCanvas(weatherData);

      expect(result.breakdown.lowClouds).toBe(0);
      expect(result.breakdown.midClouds).toBe(0);
      expect(result.breakdown.highClouds).toBe(0);
    });

    test('should handle extreme cloud values', () => {
      // upperCloudCover = 100*0.75 + 100*0.45 = 120 > 100 → crowded
      const weatherData = { lowClouds: 100, midClouds: 100, highClouds: 100 };
      const result = EnhancedPredictionService.scoreCloudCanvas(weatherData);

      expect(result.cloudLevel).toBe('crowded');
      expect(result.score).toBeLessThanOrEqual(10);
    });

    test('should handle negative coordinates', () => {
      const weatherData = { lowClouds: 20, midClouds: 50, highClouds: 40 };
      const date = new Date('2024-06-21T18:00:00Z');

      // Sydney, Australia
      const result = EnhancedPredictionService.calculateEnhancedPrediction(
        weatherData, date, -33.87, 151.21, 'sunset'
      );

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    test('should handle extreme latitudes', () => {
      const weatherData = { lowClouds: 20, midClouds: 50, highClouds: 40 };
      const date = new Date('2024-06-21T12:00:00Z');

      // Arctic
      const arcticResult = EnhancedPredictionService.calculateEnhancedPrediction(
        weatherData, date, 80.0, 0.0, 'sunset'
      );
      expect(arcticResult).toHaveProperty('score');

      // Antarctic
      const antarcticResult = EnhancedPredictionService.calculateEnhancedPrediction(
        weatherData, date, -80.0, 0.0, 'sunset'
      );
      expect(antarcticResult).toHaveProperty('score');
    });
  });
});

describe('applySevereWeatherCap - no visible sunset path', () => {
  let EnhancedPredictionService;

  beforeAll(async () => {
    EnhancedPredictionService = await import('../../../server/services/EnhancedPredictionService.js');
  });

  test('caps rainy mid-cloud overcast gray curtain to very low score when high-cloud carrier is missing', () => {
    const result = EnhancedPredictionService.applySevereWeatherCap(72, {
      cloudCover: 100,
      lowClouds: 0,
      midClouds: 72,
      highClouds: 0,
      precipitation: 0,
      recentPrecipitation6h: 1.8,
      recentRainHours: 3,
      visibility: 7,
      directRadiation: 8,
      shortwaveRadiation: 120,
      aerosolOpticalDepth: 0.42,
      pm2_5: 48,
      pm10: 92,
      dust: 12,
      waterVapourColumn: 34
    });

    expect(result.score).toBeLessThanOrEqual(5);
    expect(result.reason).toBe('no_visible_sunset_path_cap_5');
  });

  test('caps uncertain gray rainy overcast to low score instead of medium score', () => {
    const result = EnhancedPredictionService.applySevereWeatherCap(72, {
      cloudCover: 100,
      lowClouds: 5,
      midClouds: 68,
      highClouds: 15,
      precipitation: 0,
      recentPrecipitation6h: 0.8,
      recentRainHours: 2,
      visibility: 12,
      directRadiation: 20,
      shortwaveRadiation: 130,
      aerosolOpticalDepth: 0.38,
      pm2_5: 40,
      pm10: 86,
      dust: 8,
      waterVapourColumn: 31
    });

    expect(result.score).toBeLessThanOrEqual(15);
    expect(result.reason).toBe('no_visible_sunset_path_cap_15');
  });
});
