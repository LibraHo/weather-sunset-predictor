/**
 * CacheService 单元测试
 * 需求：22 (前后端分离 - Phase 2)
 */

describe('CacheService', () => {
  let CacheService;
  let cacheService;

  beforeAll(async () => {
    // 动态导入模块
    CacheService = await import('../../../server/services/CacheService.js');
  });

  beforeEach(() => {
    // 每个测试前创建新实例
    cacheService = new CacheService.default({ defaultTTL: 60, maxEntries: 100 });
  });

  afterEach(() => {
    // 每个测试后清理
    cacheService.destroy();
  });

  describe('基础操作', () => {
    test('set 和 get 应该正常工作', async () => {
      await cacheService.set('test-key', { data: 'test-value' });
      const result = await cacheService.get('test-key');
      expect(result).toEqual({ data: 'test-value' });
    });

    test('get 不存在的键应该返回 null', async () => {
      const result = await cacheService.get('non-existent-key');
      expect(result).toBeNull();
    });

    test('set 和 delete 应该正常工作', async () => {
      await cacheService.set('test-key', { data: 'test-value' });
      const deleted = await cacheService.delete('test-key');
      expect(deleted).toBe(true);

      const result = await cacheService.get('test-key');
      expect(result).toBeNull();
    });

    test('clear 应该清空所有缓存', async () => {
      await cacheService.set('key1', 'value1');
      await cacheService.set('key2', 'value2');
      await cacheService.set('key3', 'value3');

      await cacheService.clear();

      const stats = cacheService.getStats();
      expect(stats.totalEntries).toBe(0);
    });

    test('has 应该正确检查键是否存在', async () => {
      await cacheService.set('test-key', 'value');

      expect(await cacheService.has('test-key')).toBe(true);
      expect(await cacheService.has('non-existent-key')).toBe(false);
    });
  });

  describe('TTL 过期机制', () => {
    test('过期的缓存应该返回 null', async () => {
      // 设置一个1秒TTL的缓存
      await cacheService.set('test-key', 'value', 1);

      // 等待超过TTL
      await new Promise(resolve => setTimeout(resolve, 1100));

      const result = await cacheService.get('test-key');
      expect(result).toBeNull();
    });

    test('has 应该对过期键返回 false', async () => {
      await cacheService.set('test-key', 'value', 1);

      // 等待超过TTL
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(await cacheService.has('test-key')).toBe(false);
    });

    test('未过期的缓存应该正常返回', async () => {
      // 设置一个10秒TTL的缓存
      await cacheService.set('test-key', 'value', 10);

      // 等待2秒，未过期
      await new Promise(resolve => setTimeout(resolve, 2000));

      const result = await cacheService.get('test-key');
      expect(result).toBe('value');
    });

    test('自定义TTL应该覆盖默认TTL', async () => {
      const service = new CacheService.default({ defaultTTL: 1 });
      await service.set('key1', 'value1'); // 使用默认1秒TTL
      await service.set('key2', 'value2', 10); // 自定义10秒TTL

      await new Promise(resolve => setTimeout(resolve, 1100));

      const result1 = await service.get('key1');
      const result2 = await service.get('key2');

      expect(result1).toBeNull(); // key1应该已过期
      expect(result2).toBe('value2'); // key2应该仍然有效

      service.destroy();
    });
  });

  describe('缓存大小限制', () => {
    test('超过最大条目数应该删除最旧的条目', async () => {
      const service = new CacheService.default({ defaultTTL: 60, maxEntries: 3 });

      await service.set('key1', 'value1');
      await service.set('key2', 'value2');
      await service.set('key3', 'value3');
      await service.set('key4', 'value4'); // 应该删除 key1

      expect(await service.has('key1')).toBe(false);
      expect(await service.has('key4')).toBe(true);

      const stats = service.getStats();
      expect(stats.totalEntries).toBe(3);

      service.destroy();
    });
  });

  describe('统计信息', () => {
    test('getStats 应该返回正确的统计信息', async () => {
      await cacheService.set('key1', 'value1');
      await cacheService.set('key2', 'value2');

      const stats = cacheService.getStats();

      expect(stats.totalEntries).toBe(2);
      expect(stats.activeEntries).toBe(2);
      expect(stats.expiredEntries).toBe(0);
      expect(stats.maxEntries).toBe(100);
    });

    test('getStats 应该正确统计过期条目', async () => {
      await cacheService.set('key1', 'value1', 1); // 1秒TTL
      await cacheService.set('key2', 'value2', 60); // 60秒TTL

      await new Promise(resolve => setTimeout(resolve, 1100));

      const stats = cacheService.getStats();

      expect(stats.totalEntries).toBe(2);
      expect(stats.expiredEntries).toBe(1);
    });
  });

  describe('边界情况', () => {
    test('get 和 has 应该处理无效键', async () => {
      expect(await cacheService.get(null)).toBeNull();
      expect(await cacheService.get(undefined)).toBeNull();
      expect(await cacheService.get('')).toBeNull();
      expect(await cacheService.has(null)).toBe(false);
      expect(await cacheService.has('')).toBe(false);
    });

    test('set 应该处理无效键', async () => {
      expect(await cacheService.set(null, 'value')).toBe(false);
      expect(await cacheService.set('', 'value')).toBe(false);
    });

    test('set 应该处理复杂对象', async () => {
      const complexObject = {
        nested: {
          array: [1, 2, 3],
          object: { a: 1, b: 2 }
        },
        date: new Date(),
        regex: /test/g
      };

      await cacheService.set('complex-key', complexObject);
      const result = await cacheService.get('complex-key');

      expect(result).toEqual(complexObject);
    });

    test('delete 不存在的键应该返回 false', async () => {
      const deleted = await cacheService.delete('non-existent-key');
      expect(deleted).toBe(false);
    });
  });

  describe('自动清理', () => {
    test('定期清理应该自动删除过期缓存', async () => {
      const service = new CacheService.default({
        defaultTTL: 1,
        maxEntries: 1000
      });

      // 设置多个短TTL的缓存
      for (let i = 0; i < 10; i++) {
        await service.set(`key${i}`, `value${i}`, 1);
      }

      // 等待缓存过期
      await new Promise(resolve => setTimeout(resolve, 1500));

      // 手动触发清理（等待定时器）
      await new Promise(resolve => setTimeout(resolve, 100));

      const stats = service.getStats();
      // 所有缓存应该已被清理
      expect(stats.expiredEntries).toBeGreaterThan(0);

      service.destroy();
    });
  });

  describe('destroy', () => {
    test('destroy 应该清理缓存和停止定时器', async () => {
      await cacheService.set('key1', 'value1');
      await cacheService.set('key2', 'value2');

      cacheService.destroy();

      const stats = cacheService.getStats();
      expect(stats.totalEntries).toBe(0);
    });
  });
});
