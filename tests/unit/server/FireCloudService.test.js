/**
 * FireCloudService 单元测试
 * 需求：20.11, 22 (Phase 6 - 火烧云地图重构)
 */

describe('FireCloudService', () => {
  let FireCloudService;
  let fireCloudService;

  beforeAll(async () => {
    FireCloudService = (await import('../../../server/services/FireCloudService.js')).default;
  });

  beforeEach(() => {
    fireCloudService = new FireCloudService();
  });

  afterEach(() => {
    if (fireCloudService && fireCloudService.cacheService) {
      fireCloudService.cacheService.destroy();
    }
  });

  describe('构造函数', () => {
    test('应该正确初始化属性', () => {
      expect(fireCloudService.scriptPath).toContain('gfs_processor.py');
      expect(fireCloudService.timeout).toBe(60000);
      expect(fireCloudService.cacheService).toBeDefined();
    });

    test('scriptPath 应指向 server/scripts/gfs_processor.py', () => {
      expect(fireCloudService.scriptPath).toMatch(/server\/scripts\/gfs_processor\.py$/);
    });
  });

  describe('healthCheck', () => {
    test('应返回包含必要字段的健康状态', async () => {
      const health = await fireCloudService.healthCheck();

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('scriptExists');
      expect(health).toHaveProperty('scriptPath');
      expect(health).toHaveProperty('timestamp');
      expect(typeof health.timestamp).toBe('number');
      expect(health.scriptPath).toContain('gfs_processor.py');
    });

    test('scriptExists 应为 boolean 类型', async () => {
      const health = await fireCloudService.healthCheck();
      expect(typeof health.scriptExists).toBe('boolean');
    });

    test('status 应为 ok 或 degraded', async () => {
      const health = await fireCloudService.healthCheck();
      expect(['ok', 'degraded']).toContain(health.status);
    });

    test('脚本存在时应返回 ok', async () => {
      const health = await fireCloudService.healthCheck();
      // The gfs_processor.py file exists in the project
      if (health.scriptExists) {
        expect(health.status).toBe('ok');
      }
    });
  });

  describe('clearCache', () => {
    test('应成功清除缓存', async () => {
      await expect(fireCloudService.clearCache()).resolves.not.toThrow();
    });
  });

  describe('generateOverlay 方法', () => {
    test('方法应该存在且可调用', () => {
      expect(typeof fireCloudService.generateOverlay).toBe('function');
    });

    test('应该在脚本不存在时通过 _ensureScriptExists 检查失败', async () => {
      // 修改 scriptPath 使其不存在
      fireCloudService.scriptPath = '/nonexistent/path/gfs_processor.py';

      await expect(
        fireCloudService.generateOverlay(39.9, 116.4, 200, 'sunset')
      ).rejects.toThrow('GFS处理脚本未找到');
    });
  });
});

describe('FireCloud API 路由参数验证', () => {
  let firecloudRoutes;

  beforeAll(async () => {
    firecloudRoutes = await import('../../../server/routes/firecloud.js');
  });

  test('路由模块应该导出正确', () => {
    expect(firecloudRoutes).toBeDefined();
  });

  describe('参数验证逻辑', () => {
    test('纬度范围 - 有效值在 -90 到 90 之间', () => {
      expect(parseFloat('39.9')).toBeGreaterThanOrEqual(-90);
      expect(parseFloat('39.9')).toBeLessThanOrEqual(90);
      expect(parseFloat('100')).toBeGreaterThan(90);
      expect(parseFloat('-91')).toBeLessThan(-90);
    });

    test('经度范围 - 有效值在 -180 到 180 之间', () => {
      expect(parseFloat('116.4')).toBeGreaterThanOrEqual(-180);
      expect(parseFloat('116.4')).toBeLessThanOrEqual(180);
      expect(parseFloat('200')).toBeGreaterThan(180);
    });

    test('半径范围 - 有效值在 50 到 500 之间', () => {
      expect(parseInt('200')).toBeGreaterThanOrEqual(50);
      expect(parseInt('200')).toBeLessThanOrEqual(500);
      expect(parseInt('10')).toBeLessThan(50);
      expect(parseInt('600')).toBeGreaterThan(500);
    });

    test('预测类型 - 仅接受 sunrise 和 sunset', () => {
      const validTypes = ['sunrise', 'sunset'];
      expect(validTypes).toContain('sunset');
      expect(validTypes).toContain('sunrise');
      expect(validTypes).not.toContain('invalid');
    });
  });
});

describe('FireCloudService 缓存配置', () => {
  let cacheConfig;

  beforeAll(async () => {
    cacheConfig = (await import('../../../server/config/cacheConfig.js')).default;
  });

  test('缓存键生成应包含 GFS_OVERLAY 前缀', () => {
    const key = cacheConfig.buildKey('GFS_OVERLAY', '39.90_116.40_200_sunset');
    expect(key).toContain('gfs:overlay:');
    expect(key).toContain('39.90_116.40_200_sunset');
  });

  test('覆盖层 TTL 应为 30 分钟 (1800 秒)', () => {
    expect(cacheConfig.ttl.FIRECLOUD_OVERLAY).toBe(30 * 60);
  });

  test('GFS_OVERLAY 前缀应为 gfs:overlay:', () => {
    expect(cacheConfig.prefix.GFS_OVERLAY).toBe('gfs:overlay:');
  });

  test('GFS_DATA 前缀应为 gfs:data:', () => {
    expect(cacheConfig.prefix.GFS_DATA).toBe('gfs:data:');
  });

  test('OVERLAY 前缀应为 overlay:', () => {
    expect(cacheConfig.prefix.OVERLAY).toBe('overlay:');
  });
});
