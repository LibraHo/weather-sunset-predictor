import { jest } from '@jest/globals';

/**
 * ProviderOrchestrator 单元测试
 * 覆盖任务 43.2（dataQuality 标签）、43.3（质量门禁 fallback）、45.1（orchestrator 降级逻辑）
 *
 * 直接 require 类并注入 mock provider，避免模块 stub 路径问题
 */

let ProviderOrchestrator;

beforeAll(async () => {
  const m = await import('../../../server/services/ProviderOrchestrator.js');
  ProviderOrchestrator = m.ProviderOrchestrator;
});

// 生成最小合法数据（>= 12 条, 3h 间隔）
function makeData(count = 24, startTs = 1700000000000) {
  const step = 3 * 3600 * 1000; // 3h
  return Array.from({ length: count }, (_, i) => ({
    timestamp: startTs + i * step,
    temp: 20,
    humidity: 60,
    cloudCover: 30,
    windSpeed: 5,
    pressure: 1013,
    lowClouds: 10,
    midClouds: 20,
    highClouds: 10,
    precipitation: 0
  }));
}

function makeOrch(overrides = {}) {
  const orch = new ProviderOrchestrator();
  orch.providers = {
    openmeteo: { fetchWeatherData: jest.fn(async () => ({ hours: 24, data: makeData(), providerMeta: { name: 'openmeteo' } })) },
    windy: { fetchWeatherData: jest.fn(async () => ({ hours: 24, data: makeData(), providerMeta: { name: 'windy' } })) }
  };
  orch.primaryProvider = 'openmeteo';
  orch.fallbackProvider = 'windy';
  orch.emergencyFallbackEnabled = false;
  orch.qualityGateFallbackEnabled = true;
  Object.assign(orch, overrides);
  return orch;
}

// ─────────────────────────────────────────────────────────────
// 43.2：dataQuality 标签
// ─────────────────────────────────────────────────────────────
describe('43.2 providerMeta.dataQuality 标签', () => {
  test('正常数据返回 excellent', async () => {
    const orch = makeOrch();
    const result = await orch.fetchWeatherData(39.9, 116.4, 24);
    expect(result.providerMeta.dataQuality).toBe('excellent');
    expect(result.providerMeta.dataQualityIssues).toEqual([]);
  });

  test('乱序数据修复后 dataQuality = degraded', async () => {
    const shuffled = makeData();
    [shuffled[0], shuffled[2]] = [shuffled[2], shuffled[0]]; // 打乱两条
    const orch = makeOrch();
    orch.providers.openmeteo.fetchWeatherData = jest.fn(async () => ({
      hours: shuffled.length, data: shuffled, providerMeta: { name: 'openmeteo' }
    }));
    const result = await orch.fetchWeatherData(39.9, 116.4, 24);
    expect(result.providerMeta.dataQuality).toBe('degraded');
    expect(result.providerMeta.dataQualityIssues.length).toBeGreaterThan(0);
  });

  test('degradedReason 包含质量问题描述', async () => {
    const dup = makeData();
    dup.push({ ...dup[0] }); // 重复时间戳
    const orch = makeOrch();
    orch.providers.openmeteo.fetchWeatherData = jest.fn(async () => ({
      hours: dup.length, data: dup, providerMeta: { name: 'openmeteo' }
    }));
    const result = await orch.fetchWeatherData(39.9, 116.4, 24);
    expect(result.providerMeta.degradedReason.length).toBeGreaterThan(0);
  });

  test('data 正常时 degradedReason 只含 feature flag 信息（cape/convPrecip）', async () => {
    const orch = makeOrch();
    const result = await orch.fetchWeatherData(39.9, 116.4, 24);
    // 默认关闭 cape/convPrecip，所以 degradedReason 有 2 条 feature flag 说明
    expect(result.providerMeta.degradedReason).toHaveLength(2);
    expect(result.providerMeta.degradedReason[0]).toContain('cape');
  });
});

// ─────────────────────────────────────────────────────────────
// 43.3：质量门禁自动 fallback
// ─────────────────────────────────────────────────────────────
describe('43.3 质量门禁异常自动 fallback', () => {
  function makeGapData() {
    const start = 1700000000000;
    const step = 3 * 3600 * 1000; // 与 makeData 保持一致
    // 前 6 条覆盖到 start + 15h，后 6 条从 start + 30h 开始 => 中间 15h 缺口（>6h）
    return [
      ...makeData(6, start),
      ...makeData(6, start + 10 * step)
    ];
  }

  test('primary 数据 12h 缺口 → qualityGate fallback → 返回 windy 数据', async () => {
    const orch = makeOrch({ qualityGateFallbackEnabled: true });
    orch.providers.openmeteo.fetchWeatherData = jest.fn(async () => ({
      hours: 12, data: makeGapData(), providerMeta: { name: 'openmeteo' }
    }));

    const result = await orch.fetchWeatherData(39.9, 116.4, 24);
    expect(result.providerMeta.name).toBe('windy');
    expect(result.providerMeta.usedFallback).toBe(true);
    expect(result.providerMeta.fallbackReason).toBe('quality_gate_failure');
  });

  test('qualityGateFallbackEnabled=false → 严重缺口时直接抛出', async () => {
    const orch = makeOrch({ qualityGateFallbackEnabled: false });
    orch.providers.openmeteo.fetchWeatherData = jest.fn(async () => ({
      hours: 12, data: makeGapData(), providerMeta: { name: 'openmeteo' }
    }));

    await expect(orch.fetchWeatherData(39.9, 116.4, 24)).rejects.toThrow();
  });

  test('primary 数据条数 < 12 → qualityGate fallback', async () => {
    const orch = makeOrch({ qualityGateFallbackEnabled: true });
    orch.providers.openmeteo.fetchWeatherData = jest.fn(async () => ({
      hours: 3, data: makeData(3), providerMeta: { name: 'openmeteo' }
    }));

    const result = await orch.fetchWeatherData(39.9, 116.4, 24);
    expect(result.providerMeta.name).toBe('windy');
  });

  test('fallback 数据 degradedReason 包含 primary 失败原因', async () => {
    const orch = makeOrch({ qualityGateFallbackEnabled: true });
    orch.providers.openmeteo.fetchWeatherData = jest.fn(async () => ({
      hours: 12, data: makeGapData(), providerMeta: { name: 'openmeteo' }
    }));

    const result = await orch.fetchWeatherData(39.9, 116.4, 24);
    const reasons = result.providerMeta.degradedReason;
    expect(reasons.some(r => r.includes('Primary Provider'))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// 45.1：orchestrator 降级逻辑
// ─────────────────────────────────────────────────────────────
describe('45.1 orchestrator 降级逻辑', () => {
  test('primary 网络故障 + emergency fallback disabled → 抛出', async () => {
    const orch = makeOrch({ emergencyFallbackEnabled: false });
    orch.providers.openmeteo.fetchWeatherData = jest.fn(async () => { throw new Error('ECONNREFUSED'); });

    await expect(orch.fetchWeatherData(39.9, 116.4, 24)).rejects.toThrow('ECONNREFUSED');
  });

  test('primary 网络故障 + emergency fallback enabled → 使用 fallback', async () => {
    const orch = makeOrch({ emergencyFallbackEnabled: true });
    orch.providers.openmeteo.fetchWeatherData = jest.fn(async () => { throw new Error('ECONNREFUSED'); });

    const result = await orch.fetchWeatherData(39.9, 116.4, 24);
    expect(result.providerMeta.name).toBe('windy');
    expect(result.providerMeta.usedFallback).toBe(true);
    expect(result.providerMeta.fallbackReason).toBe('primary_provider_error');
  });

  test('primary 和 fallback 都失败 → 抛出合并错误', async () => {
    const orch = makeOrch({ emergencyFallbackEnabled: true });
    orch.providers.openmeteo.fetchWeatherData = jest.fn(async () => { throw new Error('primary fail'); });
    orch.providers.windy.fetchWeatherData = jest.fn(async () => { throw new Error('fallback fail'); });

    await expect(orch.fetchWeatherData(39.9, 116.4, 24))
      .rejects.toThrow(/primary fail/);
  });

  test('正常情况 providerValidated=true (openmeteo)', async () => {
    const orch = makeOrch();
    const result = await orch.fetchWeatherData(39.9, 116.4, 24);
    expect(result.providerMeta.providerValidated).toBe(true);
  });

  test('providerValidated=false 时 degradedReason 包含提示', async () => {
    const orch = makeOrch();
    orch.providers.openmeteo.fetchWeatherData = jest.fn(async () => ({
      hours: 24, data: makeData(), providerMeta: { name: 'windy' } // 冒充 windy
    }));

    const result = await orch.fetchWeatherData(39.9, 116.4, 24);
    expect(result.providerMeta.providerValidated).toBe(false);
    expect(result.providerMeta.degradedReason.some(r => r.includes('not openmeteo'))).toBe(true);
  });

  test('feature flag 关闭时 unsupportedFields 包含 cape/convPrecip', async () => {
    const orch = makeOrch();
    orch.featureFlags.capeScoreEnabled = false;
    orch.featureFlags.convectivePrecipScoreEnabled = false;

    const result = await orch.fetchWeatherData(39.9, 116.4, 24);
    expect(result.providerMeta.unsupportedFields).toContain('cape');
    expect(result.providerMeta.unsupportedFields).toContain('convPrecip');
  });
});
