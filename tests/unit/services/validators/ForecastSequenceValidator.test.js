import { ForecastSequenceValidator } from '../../../../server/services/validators/ForecastSequenceValidator.js';

describe('ForecastSequenceValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new ForecastSequenceValidator();
  });

  it('should pass excellent data', () => {
    const data = [];
    const baseTime = 1600000000000;
    for (let i = 0; i < 24; i++) {
      data.push({ timestamp: baseTime + i * 3600000, temp: i });
    }
    const result = validator.validateAndRepair(data);
    expect(result.validData.length).toBe(24);
    expect(result.quality).toBe('excellent');
    expect(result.issues.length).toBe(0);
  });

  it('should fix out of order data', () => {
    const data = [];
    const baseTime = 1600000000000;
    for (let i = 0; i < 24; i++) {
      data.push({ timestamp: baseTime + i * 3600000, temp: i });
    }
    // Swap
    const temp = data[5];
    data[5] = data[6];
    data[6] = temp;

    const result = validator.validateAndRepair(data);
    expect(result.validData.length).toBe(24);
    expect(result.quality).toBe('degraded');
    expect(result.issues).toContain('数据时序错乱，已重新排序');
    expect(result.validData[5].timestamp).toBeLessThan(result.validData[6].timestamp);
  });

  it('should remove duplicates', () => {
    const data = [];
    const baseTime = 1600000000000;
    for (let i = 0; i < 24; i++) {
      data.push({ timestamp: baseTime + i * 3600000, temp: i });
    }
    data.push({ timestamp: baseTime + 10 * 3600000, temp: 999 });

    const result = validator.validateAndRepair(data);
    expect(result.validData.length).toBe(24); // 24 unique timestamps
    expect(result.quality).toBe('degraded');
  });

  it('should throw error on gap > 6 hours', () => {
    const data = [];
    const baseTime = 1600000000000;
    for (let i = 0; i < 24; i++) {
      if (i > 5 && i < 15) continue; // create 9 hour gap
      data.push({ timestamp: baseTime + i * 3600000, temp: i });
    }
    expect(() => validator.validateAndRepair(data)).toThrow('数据存在严重的缺口');
  });
});
