/**
 * ConfigService 单元测试
 *
 * 覆盖配置文件加载、API 密钥读取、Mock API 配置等所有方法
 * 需求：1（API密钥管理）、15（后端代理）、23.8（utils/services 函数覆盖率）
 */

import { jest } from '@jest/globals';
import ConfigService from '@services/ConfigService.js';

describe('ConfigService - 初始状态', () => {
  test('初始 config 为 null', () => {
    const service = new ConfigService();
    expect(service.config).toBeNull();
  });

  test('configFilePath 默认为 "config.json"', () => {
    const service = new ConfigService();
    expect(service.configFilePath).toBe('config.json');
  });
});

describe('ConfigService.loadConfig', () => {
  let service;

  beforeEach(() => {
    service = new ConfigService();
  });

  test('加载成功时返回配置对象并存入 this.config', async () => {
    const mockConfig = { apiKey: 'test-key-123', useMockAPI: false };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockConfig)
    });

    const result = await service.loadConfig();

    expect(result).toEqual(mockConfig);
    expect(service.config).toEqual(mockConfig);
  });

  test('HTTP 响应不 ok（如 404）时返回 null，config 保持 null', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404
    });

    const result = await service.loadConfig();

    expect(result).toBeNull();
    expect(service.config).toBeNull();
  });

  test('fetch 抛出网络错误时返回 null', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const result = await service.loadConfig();

    expect(result).toBeNull();
    expect(service.config).toBeNull();
  });

  test('JSON 解析失败时返回 null', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockRejectedValue(new SyntaxError('Invalid JSON'))
    });

    const result = await service.loadConfig();

    expect(result).toBeNull();
  });
});

describe('ConfigService.getAPIKey', () => {
  let service;

  beforeEach(() => {
    service = new ConfigService();
  });

  test('config 为 null 时返回 null', () => {
    expect(service.getAPIKey()).toBeNull();
  });

  test('config 存在但无 apiKey 字段时返回 null', () => {
    service.config = { useMockAPI: false };
    expect(service.getAPIKey()).toBeNull();
  });

  test('config 包含 apiKey 时返回该值', () => {
    service.config = { apiKey: 'my-secret-key' };
    expect(service.getAPIKey()).toBe('my-secret-key');
  });

  test('apiKey 为空字符串时返回 null（falsy 值）', () => {
    service.config = { apiKey: '' };
    expect(service.getAPIKey()).toBeNull();
  });
});

describe('ConfigService.hasConfigFile', () => {
  let service;

  beforeEach(() => {
    service = new ConfigService();
  });

  test('config 为 null 时返回 false', () => {
    expect(service.hasConfigFile()).toBe(false);
  });

  test('config 已加载时返回 true', () => {
    service.config = { apiKey: 'key' };
    expect(service.hasConfigFile()).toBe(true);
  });

  test('config 为空对象时也返回 true（对象本身不是 null）', () => {
    service.config = {};
    expect(service.hasConfigFile()).toBe(true);
  });
});

describe('ConfigService.getConfig', () => {
  let service;

  beforeEach(() => {
    service = new ConfigService();
  });

  test('未加载时返回 null', () => {
    expect(service.getConfig()).toBeNull();
  });

  test('加载后返回配置对象', () => {
    const mockConfig = { apiKey: 'abc', useMockAPI: true };
    service.config = mockConfig;
    expect(service.getConfig()).toEqual(mockConfig);
  });

  test('返回的是对象引用（非拷贝）', () => {
    const mockConfig = { apiKey: 'abc' };
    service.config = mockConfig;
    expect(service.getConfig()).toBe(mockConfig);
  });
});

describe('ConfigService.getUseMockAPI', () => {
  let service;

  beforeEach(() => {
    service = new ConfigService();
    // 清理 localStorage
    localStorage.clear();
  });

  test('config 为 null 时返回 null', () => {
    expect(service.getUseMockAPI()).toBeNull();
  });

  test('config 包含 useMockAPI=true 时返回 true', () => {
    service.config = { useMockAPI: true };
    expect(service.getUseMockAPI()).toBe(true);
  });

  test('config 包含 useMockAPI=false 时返回 false', () => {
    service.config = { useMockAPI: false };
    expect(service.getUseMockAPI()).toBe(false);
  });

  test('config 不含 useMockAPI 字段时返回 null', () => {
    service.config = { apiKey: 'key' };
    expect(service.getUseMockAPI()).toBeNull();
  });
});

describe('ConfigService - 完整加载流程', () => {
  test('loadConfig 后 getAPIKey 正确返回密钥', async () => {
    const service = new ConfigService();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ apiKey: 'full-flow-key', useMockAPI: false })
    });

    await service.loadConfig();

    expect(service.hasConfigFile()).toBe(true);
    expect(service.getAPIKey()).toBe('full-flow-key');
    expect(service.getUseMockAPI()).toBe(false);
  });

  test('加载失败后所有 getter 均返回 null/false', async () => {
    const service = new ConfigService();
    global.fetch = jest.fn().mockResolvedValue({ ok: false });

    await service.loadConfig();

    expect(service.hasConfigFile()).toBe(false);
    expect(service.getAPIKey()).toBeNull();
    expect(service.getConfig()).toBeNull();
    expect(service.getUseMockAPI()).toBeNull();
  });
});
