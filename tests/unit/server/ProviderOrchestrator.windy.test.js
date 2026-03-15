/**
 * Phase15 任务63.6：ProviderOrchestrator ENABLE_WINDY flag 行为验证
 *
 * 注意：由于模块缓存，每个 describe 使用独立的 env 变量后
 * 需要通过 isolateModules 重新加载。
 */
import { jest } from '@jest/globals';

describe('ProviderOrchestrator ENABLE_WINDY flag', () => {
  let savedEnv;

  beforeAll(() => {
    savedEnv = { ...process.env };
  });

  afterAll(() => {
    Object.assign(process.env, savedEnv);
  });

  describe('ENABLE_WINDY 未设置（默认 false）', () => {
    let ProviderOrchestrator;

    beforeAll(async () => {
      delete process.env.ENABLE_WINDY;
      delete process.env.ENABLE_WINDY_EMERGENCY_FALLBACK;
      jest.resetModules();
      const mod = await import('../../../server/services/ProviderOrchestrator.js');
      ProviderOrchestrator = mod.ProviderOrchestrator;
    });

    it('windyEnabled 应为 false', () => {
      const orc = new ProviderOrchestrator();
      expect(orc.windyEnabled).toBe(false);
    });

    it('providers map 不含 windy', () => {
      const orc = new ProviderOrchestrator();
      expect(orc.providers).not.toHaveProperty('windy');
      expect(orc.providers).toHaveProperty('openmeteo');
    });

    it('emergencyFallbackEnabled 应为 false', () => {
      const orc = new ProviderOrchestrator();
      expect(orc.emergencyFallbackEnabled).toBe(false);
    });
  });

  describe('ENABLE_WINDY=true', () => {
    let ProviderOrchestrator;

    beforeAll(async () => {
      process.env.ENABLE_WINDY = 'true';
      delete process.env.ENABLE_WINDY_EMERGENCY_FALLBACK;
      jest.resetModules();
      const mod = await import('../../../server/services/ProviderOrchestrator.js');
      ProviderOrchestrator = mod.ProviderOrchestrator;
    });

    afterAll(() => {
      delete process.env.ENABLE_WINDY;
    });

    it('windyEnabled 应为 true', () => {
      const orc = new ProviderOrchestrator();
      expect(orc.windyEnabled).toBe(true);
    });

    it('providers map 含 windy', () => {
      const orc = new ProviderOrchestrator();
      expect(orc.providers).toHaveProperty('windy');
    });

    it('ENABLE_WINDY_EMERGENCY_FALLBACK 未设置时，emergencyFallbackEnabled 默认 true', () => {
      const orc = new ProviderOrchestrator();
      expect(orc.emergencyFallbackEnabled).toBe(true);
    });

    it('ENABLE_WINDY_EMERGENCY_FALLBACK=false 时，emergencyFallbackEnabled 为 false', () => {
      process.env.ENABLE_WINDY_EMERGENCY_FALLBACK = 'false';
      const orc = new ProviderOrchestrator();
      expect(orc.emergencyFallbackEnabled).toBe(false);
      delete process.env.ENABLE_WINDY_EMERGENCY_FALLBACK;
    });
  });
});
