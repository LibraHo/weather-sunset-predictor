/**
 * SunCalculator 单元测试
 *
 * 测试日出日落计算工具的各项功能
 *
 * 需求：22.2, 26.1.7
 */

// 使用动态 import 加载 CommonJS 模块
let SunCalculator;

beforeAll(async () => {
  SunCalculator = await import('../../../server/utils/SunCalculator.js');
});

describe('SunCalculator', () => {
  describe('getDayOfYear', () => {
    it('should return 1 for January 1st', () => {
      const date = new Date(2026, 0, 1); // January 1, 2026
      expect(SunCalculator.getDayOfYear(date)).toBe(1);
    });

    it('should return 365 for December 31st in non-leap year', () => {
      const date = new Date(2026, 11, 31); // December 31, 2026
      expect(SunCalculator.getDayOfYear(date)).toBe(365);
    });

    it('should return 366 for December 31st in leap year', () => {
      const date = new Date(2024, 11, 31); // December 31, 2024
      expect(SunCalculator.getDayOfYear(date)).toBe(366);
    });

    it('should return correct day for mid-year date', () => {
      const date = new Date(2026, 6, 1); // July 1, 2026
      expect(SunCalculator.getDayOfYear(date)).toBe(182);
    });
  });

  describe('getFractionalYear', () => {
    it('should return 0 for day 1', () => {
      expect(SunCalculator.getFractionalYear(1)).toBeCloseTo(0, 5);
    });

    it('should return approximately PI for mid-year', () => {
      // Day 183 is approximately mid-year
      const result = SunCalculator.getFractionalYear(183);
      expect(result).toBeCloseTo(Math.PI, 1);
    });
  });

  describe('getEquationOfTime', () => {
    it('should return a value in reasonable range', () => {
      // Equation of time varies between about -14 and +16 minutes
      const fractionalYear = SunCalculator.getFractionalYear(1);
      const eqTime = SunCalculator.getEquationOfTime(fractionalYear);
      expect(eqTime).toBeGreaterThan(-20);
      expect(eqTime).toBeLessThan(20);
    });
  });

  describe('getSolarDeclination', () => {
    it('should return approximately 0 at equinox (around day 80)', () => {
      // Spring equinox is around March 21
      const fractionalYear = SunCalculator.getFractionalYear(80);
      const declination = SunCalculator.getSolarDeclination(fractionalYear);
      expect(Math.abs(declination)).toBeLessThan(0.1); // Small value at equinox
    });

    it('should return positive value in summer (northern hemisphere)', () => {
      // Summer solstice is around June 21 (day 172)
      const fractionalYear = SunCalculator.getFractionalYear(172);
      const declination = SunCalculator.getSolarDeclination(fractionalYear);
      expect(declination).toBeGreaterThan(0);
    });
  });

  describe('getSunsetTime', () => {
    it('should throw error for invalid date', () => {
      expect(() => SunCalculator.getSunsetTime(null, 40, 116)).toThrow('无效的日期对象');
      expect(() => SunCalculator.getSunsetTime('not a date', 40, 116)).toThrow('无效的日期对象');
    });

    it('should throw error for invalid latitude', () => {
      const date = new Date(2026, 1, 3);
      expect(() => SunCalculator.getSunsetTime(date, 91, 116)).toThrow('纬度必须在-90到90之间');
      expect(() => SunCalculator.getSunsetTime(date, -91, 116)).toThrow('纬度必须在-90到90之间');
      expect(() => SunCalculator.getSunsetTime(date, 'invalid', 116)).toThrow('纬度必须在-90到90之间');
    });

    it('should throw error for invalid longitude', () => {
      const date = new Date(2026, 1, 3);
      expect(() => SunCalculator.getSunsetTime(date, 40, 181)).toThrow('经度必须在-180到180之间');
      expect(() => SunCalculator.getSunsetTime(date, 40, -181)).toThrow('经度必须在-180到180之间');
    });

    it('should return a Date object for valid inputs', () => {
      const date = new Date(2026, 1, 3); // February 3, 2026
      const sunset = SunCalculator.getSunsetTime(date, 39.9, 116.4); // Beijing
      expect(sunset).toBeInstanceOf(Date);
    });

    it('should return reasonable sunset time for Beijing', () => {
      const date = new Date(2026, 1, 3); // February 3, 2026
      const sunset = SunCalculator.getSunsetTime(date, 39.9, 116.4); // Beijing
      const hours = sunset.getHours();
      // In February, Beijing sunset is around 17:00-18:00
      expect(hours).toBeGreaterThanOrEqual(16);
      expect(hours).toBeLessThanOrEqual(19);
    });

    it('should handle polar regions (polar night)', () => {
      // North pole in December
      const date = new Date(2026, 11, 21); // December 21
      const sunset = SunCalculator.getSunsetTime(date, 89, 0);
      // Should return midnight (no sunset in polar night)
      expect(sunset.getHours()).toBe(0);
    });
  });

  describe('getSunriseTime', () => {
    it('should throw error for invalid inputs', () => {
      expect(() => SunCalculator.getSunriseTime(null, 40, 116)).toThrow('无效的日期对象');
    });

    it('should return a Date object for valid inputs', () => {
      const date = new Date(2026, 1, 3);
      const sunrise = SunCalculator.getSunriseTime(date, 39.9, 116.4);
      expect(sunrise).toBeInstanceOf(Date);
    });

    it('should return reasonable sunrise time for Beijing', () => {
      const date = new Date(2026, 1, 3); // February 3, 2026
      const sunrise = SunCalculator.getSunriseTime(date, 39.9, 116.4); // Beijing
      const hours = sunrise.getHours();
      // In February, Beijing sunrise is around 7:00-8:00
      expect(hours).toBeGreaterThanOrEqual(6);
      expect(hours).toBeLessThanOrEqual(9);
    });

    it('should return sunrise before sunset on same day', () => {
      const date = new Date(2026, 5, 21); // June 21
      const sunrise = SunCalculator.getSunriseTime(date, 39.9, 116.4);
      const sunset = SunCalculator.getSunsetTime(date, 39.9, 116.4);
      expect(sunrise.getTime()).toBeLessThan(sunset.getTime());
    });
  });

  describe('getGoldenHour', () => {
    it('should return golden hour after sunrise for sunrise type', () => {
      const sunriseTime = new Date(2026, 1, 3, 7, 0, 0);
      const goldenHour = SunCalculator.getGoldenHour(sunriseTime, 'sunrise');

      expect(goldenHour.start.getTime()).toBe(sunriseTime.getTime() + 30 * 60 * 1000);
      expect(goldenHour.end.getTime()).toBe(sunriseTime.getTime() + 60 * 60 * 1000);
    });

    it('should return golden hour before sunset for sunset type', () => {
      const sunsetTime = new Date(2026, 1, 3, 17, 30, 0);
      const goldenHour = SunCalculator.getGoldenHour(sunsetTime, 'sunset');

      expect(goldenHour.start.getTime()).toBe(sunsetTime.getTime() - 60 * 60 * 1000);
      expect(goldenHour.end.getTime()).toBe(sunsetTime.getTime() - 30 * 60 * 1000);
    });
  });

  describe('getBlueHour', () => {
    it('should return blue hour before sunrise for sunrise type', () => {
      const sunriseTime = new Date(2026, 1, 3, 7, 0, 0);
      const blueHour = SunCalculator.getBlueHour(sunriseTime, 'sunrise');

      expect(blueHour.start.getTime()).toBe(sunriseTime.getTime() - 30 * 60 * 1000);
      expect(blueHour.end.getTime()).toBe(sunriseTime.getTime() - 20 * 60 * 1000);
    });

    it('should return blue hour after sunset for sunset type', () => {
      const sunsetTime = new Date(2026, 1, 3, 17, 30, 0);
      const blueHour = SunCalculator.getBlueHour(sunsetTime, 'sunset');

      expect(blueHour.start.getTime()).toBe(sunsetTime.getTime() + 20 * 60 * 1000);
      expect(blueHour.end.getTime()).toBe(sunsetTime.getTime() + 30 * 60 * 1000);
    });
  });

  describe('getSunAzimuth', () => {
    it('should return azimuth in valid range (0-360)', () => {
      const date = new Date(2026, 1, 3);
      const time = new Date(2026, 1, 3, 17, 30, 0);
      const azimuth = SunCalculator.getSunAzimuth(date, time, 39.9, 116.4);

      expect(azimuth).toBeGreaterThanOrEqual(0);
      expect(azimuth).toBeLessThanOrEqual(360);
    });

    it('should return westward azimuth in afternoon', () => {
      const date = new Date(2026, 1, 3);
      const time = new Date(2026, 1, 3, 15, 0, 0); // 3 PM
      const azimuth = SunCalculator.getSunAzimuth(date, time, 39.9, 116.4);

      // In afternoon, sun is in the west (180-360)
      expect(azimuth).toBeGreaterThan(180);
    });

    it('should return eastward azimuth in morning', () => {
      const date = new Date(2026, 1, 3);
      const time = new Date(2026, 1, 3, 9, 0, 0); // 9 AM
      const azimuth = SunCalculator.getSunAzimuth(date, time, 39.9, 116.4);

      // In morning, sun is in the east (0-180)
      expect(azimuth).toBeLessThan(180);
    });
  });

  describe('analyzeCloudLayers', () => {
    it('should identify low cloud situation', () => {
      const result = SunCalculator.analyzeCloudLayers(5, 5, 5);
      expect(result.description).toContain('云量较少');
    });

    it('should identify too much low clouds', () => {
      const result = SunCalculator.analyzeCloudLayers(10, 20, 60);
      expect(result.description).toContain('低层云过多');
    });

    it('should identify good conditions for fire clouds', () => {
      const result = SunCalculator.analyzeCloudLayers(30, 50, 10);
      expect(result.description).toContain('有利于火烧云');
    });

    it('should return cloud layer values', () => {
      const result = SunCalculator.analyzeCloudLayers(20, 30, 40);
      expect(result.high).toBe(20);
      expect(result.mid).toBe(30);
      expect(result.low).toBe(40);
    });
  });
});
