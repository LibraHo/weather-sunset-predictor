/**
 * WindyAPIService增强单元测试 - API错误处理和边缘情况测试
 *
 * 测试场景：
 * - HTTP 401 Unauthorized（API Key错误）
 * - HTTP 429 Too Many Requests（限流）
 * - HTTP 500 Server Error（服务器故障）
 * - 网络超时（>10秒）
 * - 代理模式和直连模式
 * - 数据解析错误
 *
 * 需求：API服务错误处理健壮性
 */

import WindyAPIService from '@services/WindyAPIService.js';

// Mock fetch
global.fetch = jest.fn();

// Mock console methods
const consoleSpy = {
  log: jest.spyOn(console, 'log').mockImplementation(),
  error: jest.spyOn(console, 'error').mockImplementation()
};

describe('WindyAPIService - HTTP错误处理测试', () => {
  let service;

  beforeEach(() => {
    service = new WindyAPIService('test-api-key');
    fetch.mockClear();
    consoleSpy.log.mockClear();
    consoleSpy.error.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('HTTP 401错误测试', () => {
    test('直连模式：应该处理401 Unauthorized（API Key无效）', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Invalid API key' })
      });

      await expect(service.fetchWeatherData(39.9042, 116.4074, 24))
        .rejects
        .toThrow('API密钥无效，请检查您的密钥');
    });

    test('代理模式：应该处理401 Unauthorized', async () => {
      const proxyService = new WindyAPIService('test-api-key', { useProxy: true });
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'API密钥错误' } })
      });

      await expect(proxyService.fetchWeatherData(39.9042, 116.4074, 24))
        .rejects
        .toThrow('Windy API 密钥错误: API密钥错误');
    });
  });

  describe('HTTP 403错误测试', () => {
    test('直连模式：应该处理403 Forbidden', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ message: 'Access denied' })
      });

      await expect(service.fetchWeatherData(39.9042, 116.4074, 24))
        .rejects
        .toThrow('API访问被拒绝，请检查您的权限');
    });

    test('代理模式：应该处理403 Forbidden', async () => {
      const proxyService = new WindyAPIService('test-api-key', { useProxy: true });
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: '权限不足' } })
      });

      await expect(proxyService.fetchWeatherData(39.9042, 116.4074, 24))
        .rejects
        .toThrow('Windy API 密钥错误: 权限不足');
    });
  });

  describe('HTTP 429错误测试（限流）', () => {
    test('直连模式：应该处理429 Too Many Requests', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ message: 'Rate limit exceeded' })
      });

      await expect(service.fetchWeatherData(39.9042, 116.4074, 24))
        .rejects
        .toThrow('API请求次数超限，请稍后再试');
    });

    test('代理模式：应该处理429 Too Many Requests', async () => {
      const proxyService = new WindyAPIService('test-api-key', { useProxy: true });
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ message: 'Too many requests' })
      });

      await expect(proxyService.fetchWeatherData(39.9042, 116.4074, 24))
        .rejects
        .toThrow('请求过于频繁，请稍后再试');
    });
  });

  describe('HTTP 500错误测试', () => {
    test('直连模式：应该处理500 Internal Server Error', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Internal server error' })
      });

      await expect(service.fetchWeatherData(39.9042, 116.4074, 24))
        .rejects
        .toThrow('Windy服务暂时不可用，请稍后再试');
    });

    test('直连模式：应该处理502 Bad Gateway', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => ({ message: 'Bad gateway' })
      });

      await expect(service.fetchWeatherData(39.9042, 116.4074, 24))
        .rejects
        .toThrow('Windy服务暂时不可用，请稍后再试');
    });

    test('直连模式：应该处理503 Service Unavailable', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ message: 'Service unavailable' })
      });

      await expect(service.fetchWeatherData(39.9042, 116.4074, 24))
        .rejects
        .toThrow('Windy服务暂时不可用，请稍后再试');
    });

    test('代理模式：应该处理500 Internal Server Error', async () => {
      const proxyService = new WindyAPIService('test-api-key', { useProxy: true });
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: '后端错误' } })
      });

      await expect(proxyService.fetchWeatherData(39.9042, 116.4074, 24))
        .rejects
        .toThrow('后端服务器暂时不可用，请稍后再试');
    });
  });

  describe('HTTP 400错误测试', () => {
    test('代理模式：应该处理400 Bad Request', async () => {
      const proxyService = new WindyAPIService('test-api-key', { useProxy: true });
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'Invalid parameters' } })
      });

      await expect(proxyService.fetchWeatherData(39.9042, 116.4074, 24))
        .rejects
        .toThrow('请求参数错误: Invalid parameters');
    });
  });

  describe('网络错误测试', () => {
    test('应该处理网络连接失败', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(service.fetchWeatherData(39.9042, 116.4074, 24))
        .rejects
        .toThrow('网络连接失败，请检查网络设置');
    });

    test('应该处理超时错误', async () => {
      // 模拟超时
      fetch.mockRejectedValueOnce(new Error('Request timeout'));

      await expect(service.fetchWeatherData(39.9042, 116.4074, 24))
        .rejects
        .toThrow('网络连接失败，请检查网络设置');
    });

    test('代理模式：应该处理后端连接失败', async () => {
      const proxyService = new WindyAPIService('test-api-key', { useProxy: true });
      fetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      await expect(proxyService.fetchWeatherData(39.9042, 116.4074, 24))
        .rejects
        .toThrow('无法连接到后端服务器，请检查服务器是否运行');
    });
  });
});

describe('WindyAPIService - 数据解析错误测试', () => {
  let service;

  beforeEach(() => {
    service = new WindyAPIService('test-api-key');
    fetch.mockClear();
  });

  test('应该处理缺少必需字段的响应', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        // 缺少 ts 字段
        'temp-surface': [280, 281]
      })
    });

    await expect(service.fetchWeatherData(39.9042, 116.4074, 24))
      .rejects
      .toThrow('API返回数据格式错误');
  });

  test('应该处理空数据响应', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => null
    });

    await expect(service.fetchWeatherData(39.9042, 116.4074, 24))
      .rejects
      .toThrow();
  });

  test('应该处理无效的JSON响应', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => {
        throw new Error('Invalid JSON');
      }
    });

    await expect(service.fetchWeatherData(39.9042, 116.4074, 24))
      .rejects
      .toThrow();
  });

  test('代理模式：应该处理非数组数据响应', async () => {
    const proxyService = new WindyAPIService('test-api-key', { useProxy: true });
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: 'not an array'  // 应该是数组
      })
    });

    await expect(proxyService.fetchWeatherData(39.9042, 116.4074, 24))
      .rejects
      .toThrow('后端返回数据格式错误');
  });
});

describe('WindyAPIService - 边缘参数测试', () => {
  let service;

  beforeEach(() => {
    service = new WindyAPIService('test-api-key');
    fetch.mockClear();
  });

  describe('坐标验证测试', () => {
    test('应该拒绝纬度>90', async () => {
      await expect(service.fetchWeatherData(91, 116.4074, 24))
        .rejects
        .toThrow('无效的坐标');
    });

    test('应该拒绝纬度<-90', async () => {
      await expect(service.fetchWeatherData(-91, 116.4074, 24))
        .rejects
        .toThrow('无效的坐标');
    });

    test('应该拒绝经度>180', async () => {
      await expect(service.fetchWeatherData(39.9042, 181, 24))
        .rejects
        .toThrow('无效的坐标');
    });

    test('应该拒绝经度<-180', async () => {
      await expect(service.fetchWeatherData(39.9042, -181, 24))
        .rejects
        .toThrow('无效的坐标');
    });

    test('应该接受边界坐标（90, 180）', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAPIResponse()
      });

      await expect(service.fetchWeatherData(90, 180, 24))
        .resolves
        .toBeInstanceOf(Array);
    });

    test('应该接受边界坐标（-90, -180）', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAPIResponse()
      });

      await expect(service.fetchWeatherData(-90, -180, 24))
        .resolves
        .toBeInstanceOf(Array);
    });
  });

  describe('小时数验证测试', () => {
    test('应该拒绝小时数<1', async () => {
      await expect(service.fetchWeatherData(39.9042, 116.4074, 0))
        .rejects
        .toThrow('预测小时数必须在1到168之间');
    });

    test('应该拒绝小时数>168', async () => {
      await expect(service.fetchWeatherData(39.9042, 116.4074, 169))
        .rejects
        .toThrow('预测小时数必须在1到168之间');
    });

    test('应该接受最小小时数（1）', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAPIResponse(1)
      });

      await expect(service.fetchWeatherData(39.9042, 116.4074, 1))
        .resolves
        .toBeInstanceOf(Array);
    });

    test('应该接受最大小时数（168）', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAPIResponse(168)
      });

      await expect(service.fetchWeatherData(39.9042, 116.4074, 168))
        .resolves
        .toBeInstanceOf(Array);
    });
  });
});

describe('WindyAPIService - API Key验证测试', () => {
  test('直连模式：没有API密钥时应该抛出错误', async () => {
    const noKeyService = new WindyAPIService(null);

    await expect(noKeyService.fetchWeatherData(39.9042, 116.4074, 24))
      .rejects
      .toThrow('API密钥未设置');
  });

  test('validateAPIKey应该返回true对于有效密钥', async () => {
    const service = new WindyAPIService('valid-key');
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockAPIResponse()
    });

    const isValid = await service.validateAPIKey();
    expect(isValid).toBe(true);
  });

  test('validateAPIKey应该返回false对于无效密钥', async () => {
    const service = new WindyAPIService('invalid-key');
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Invalid API key' })
    });

    const isValid = await service.validateAPIKey();
    expect(isValid).toBe(false);
  });

  test('validateAPIKey应该抛出网络错误', async () => {
    const service = new WindyAPIService('test-key');
    fetch.mockRejectedValueOnce(new Error('Network error'));

    await expect(service.validateAPIKey())
      .rejects
      .toThrow('网络连接失败');
  });
});

describe('WindyAPIService - 代理模式测试', () => {
  test('应该使用代理URL当启用代理模式', async () => {
    const proxyService = new WindyAPIService('test-key', {
      useProxy: true,
      proxyURL: 'http://localhost:3001'
    });

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockWeatherDataArray(24) })
    });

    await proxyService.fetchWeatherData(39.9042, 116.4074, 24);

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/weather/forecast?lat=39.9042&lon=116.4074&hours=24',
      expect.objectContaining({
        method: 'GET'
      })
    );
  });

  test('代理模式：应该解析后端返回的数据', async () => {
    const proxyService = new WindyAPIService('test-key', { useProxy: true });

    const mockData = mockWeatherDataArray(3);
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockData })
    });

    const result = await proxyService.fetchWeatherData(39.9042, 116.4074, 24);

    expect(result).toHaveLength(3);
    expect(result[0]).toHaveProperty('timestamp');
    expect(result[0]).toHaveProperty('temp');
    expect(result[0]).toHaveProperty('humidity');
  });
});

describe('WindyAPIService - 数据解析测试', () => {
  let service;

  beforeEach(() => {
    service = new WindyAPIService('test-api-key');
    fetch.mockClear();
  });

  test('应该正确转换开尔文温度为摄氏度', async () => {
    const response = mockAPIResponse(1);
    response['temp-surface'] = [280.15]; // 7°C

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => response
    });

    const result = await service.fetchWeatherData(39.9042, 116.4074, 1);

    expect(result[0].temp).toBeCloseTo(7.0, 1);
  });

  test('应该正确转换秒时间戳为毫秒', async () => {
    const response = mockAPIResponse(1);
    response.ts = [1640000000]; // 秒时间戳

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => response
    });

    const result = await service.fetchWeatherData(39.9042, 116.4074, 1);

    expect(result[0].timestamp).toBe(1640000000000); // 毫秒
  });

  test('应该正确转换kPa气压为hPa', async () => {
    const response = mockAPIResponse(1);
    response['pressure-surface'] = [101]; // 101 kPa

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => response
    });

    const result = await service.fetchWeatherData(39.9042, 116.4074, 1);

    expect(result[0].pressure).toBe(1010); // 1010 hPa
  });

  test('应该正确转换Pa气压为hPa', async () => {
    const response = mockAPIResponse(1);
    response['pressure-surface'] = [101300]; // 101300 Pa

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => response
    });

    const result = await service.fetchWeatherData(39.9042, 116.4074, 1);

    expect(result[0].pressure).toBe(1013); // 1013 hPa
  });

  test('应该计算总云量为分层云量的平均值', async () => {
    const response = mockAPIResponse(1);
    response['lclouds-surface'] = [30];
    response['mclouds-surface'] = [50];
    response['hclouds-surface'] = [70];

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => response
    });

    const result = await service.fetchWeatherData(39.9042, 116.4074, 1);

    expect(result[0].cloudCover).toBeCloseTo(50, 1); // (30+50+70)/3 = 50
  });

  test('应该从u和v分量计算风速', async () => {
    const response = mockAPIResponse(1);
    response['wind_u-surface'] = [3];
    response['wind_v-surface'] = [4];

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => response
    });

    const result = await service.fetchWeatherData(39.9042, 116.4074, 1);

    // sqrt(3^2 + 4^2) * 3.6 = 5 * 3.6 = 18 km/h
    expect(result[0].windSpeed).toBeCloseTo(18, 0);
  });
});

// Mock辅助函数

function mockAPIResponse(hours = 24) {
  const timestamps = Array.from({ length: hours }, (_, i) =>
    (Date.now() / 1000) + i * 3600
  );

  return {
    ts: timestamps,
    'temp-surface': Array(hours).fill(280),
    'rh-surface': Array(hours).fill(65),
    'wind_u-surface': Array(hours).fill(2),
    'wind_v-surface': Array(hours).fill(1),
    'pressure-surface': Array(hours).fill(1013),
    'lclouds-surface': Array(hours).fill(30),
    'mclouds-surface': Array(hours).fill(40),
    'hclouds-surface': Array(hours).fill(20),
    'convPrecip-surface': Array(hours).fill(0)
  };
}

function mockWeatherDataArray(count = 24) {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: Date.now() + i * 3600000,
    temp: 20,
    humidity: 65,
    cloudCover: 50,
    windSpeed: 10,
    pressure: 1013,
    visibility: 10,
    lowClouds: 30,
    precipitation: 0,
    windDirection: 180,
    highClouds: 20,
    midClouds: 40
  }));
}
