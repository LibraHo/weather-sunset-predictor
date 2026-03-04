/**
 * windyService.fetchWeatherData — userApiKey 优先级测试
 * 需求：25
 */

describe('effectiveApiKey 选择逻辑', () => {
  function getEffectiveKey(systemKey, userApiKey) {
    return (userApiKey && userApiKey.trim()) ? userApiKey.trim() : systemKey;
  }

  test('userApiKey 有值时应使用用户 Key', () => {
    expect(getEffectiveKey('system-key', 'user-key')).toBe('user-key');
  });

  test('userApiKey 为 null 时应使用系统 Key', () => {
    expect(getEffectiveKey('system-key', null)).toBe('system-key');
  });

  test('userApiKey 为 undefined 时应使用系统 Key', () => {
    expect(getEffectiveKey('system-key', undefined)).toBe('system-key');
  });

  test('userApiKey 为空字符串时应使用系统 Key', () => {
    expect(getEffectiveKey('system-key', '')).toBe('system-key');
  });

  test('userApiKey 为纯空格时应使用系统 Key', () => {
    expect(getEffectiveKey('system-key', '   ')).toBe('system-key');
  });

  test('userApiKey 前后有空格时应自动 trim', () => {
    expect(getEffectiveKey('system-key', '  user-padded-key  ')).toBe('user-padded-key');
  });

  test('系统 Key 为 undefined 且用户 Key 有效时应使用用户 Key', () => {
    expect(getEffectiveKey(undefined, 'user-key')).toBe('user-key');
  });
});

// ========== windyService 参数验证 ==========

describe('windyService 参数验证', () => {
  let windyService;

  beforeAll(async () => {
    const module = await import('../../../server/services/windyService.js');
    windyService = module.default;
  });

  beforeEach(() => {
    process.env.WINDY_API_KEY = 'system-api-key-for-tests';
  });

  afterAll(() => {
    delete process.env.WINDY_API_KEY;
  });

  test('windyService 单例应被正确导出', () => {
    expect(windyService).toBeDefined();
    expect(typeof windyService.fetchWeatherData).toBe('function');
  });

  test('非数字 lat 应抛出参数错误', async () => {
    await expect(windyService.fetchWeatherData('abc', 116.4, 24)).rejects.toThrow('无效的坐标参数');
  });

  test('非数字 lon 应抛出参数错误', async () => {
    await expect(windyService.fetchWeatherData(39.9, 'xyz', 24)).rejects.toThrow('无效的坐标参数');
  });

  test('纬度 > 90 应抛出范围错误', async () => {
    await expect(windyService.fetchWeatherData(91, 116.4, 24)).rejects.toThrow('纬度');
  });

  test('纬度 < -90 应抛出范围错误', async () => {
    await expect(windyService.fetchWeatherData(-91, 116.4, 24)).rejects.toThrow('纬度');
  });

  test('经度 > 180 应抛出范围错误', async () => {
    await expect(windyService.fetchWeatherData(39.9, 181, 24)).rejects.toThrow('经度');
  });

  test('经度 < -180 应抛出范围错误', async () => {
    await expect(windyService.fetchWeatherData(39.9, -181, 24)).rejects.toThrow('经度');
  });

  test('hours > 168 应抛出范围错误', async () => {
    await expect(windyService.fetchWeatherData(39.9, 116.4, 200)).rejects.toThrow('小时数');
  });

  test('hours < 1 应抛出范围错误', async () => {
    await expect(windyService.fetchWeatherData(39.9, 116.4, 0)).rejects.toThrow('小时数');
  });

  test('合法参数但网络不可用时应抛出错误', async () => {
    await expect(windyService.fetchWeatherData(39.9, 116.4, 24, 'test-user-key'))
      .rejects.toThrow();
  });
});

// ========== WindyService 类 — 构造函数测试 ==========

describe('WindyService 类 — 构造函数', () => {
  let WindyServiceClass;

  beforeAll(async () => {
    const module = await import('../../../server/services/windyService.js');
    const instance = module.default;
    WindyServiceClass = instance.constructor;
  });

  test('应读取 WINDY_API_KEY 环境变量', () => {
    process.env.WINDY_API_KEY = 'env-test-key';
    const instance = new WindyServiceClass();
    expect(instance.apiKey).toBe('env-test-key');
    delete process.env.WINDY_API_KEY;
  });

  test('WINDY_API_KEY 未设置时 apiKey 应为 undefined', () => {
    const saved = process.env.WINDY_API_KEY;
    delete process.env.WINDY_API_KEY;
    const instance = new WindyServiceClass();
    expect(instance.apiKey).toBeUndefined();
    if (saved) process.env.WINDY_API_KEY = saved;
  });
});
