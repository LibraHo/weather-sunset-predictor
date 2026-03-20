/**
 * Phase 14 任务60.1：预测链路 provider 门禁测试
 */

import { jest } from '@jest/globals';
import ProviderOrchestrator from '../../../server/services/ProviderOrchestrator.js';

describe('Phase 14 Provider 门禁', () => {
  let orchestrator;

  beforeEach(() => {
    // 创建新的实例以确保测试隔离
    const { ProviderOrchestrator: OrchestratorClass } = ProviderOrchestrator;
    orchestrator = new OrchestratorClass();
  });

  describe('openmeteoOnlyMode 配置', () => {
    it('默认启用 Open-Meteo 专属模式', () => {
      // 默认情况下，DISABLE_OPENMETEO_GATE 未设置，应为 true
      expect(orchestrator.openmeteoOnlyMode).toBe(true);
    });

    it('DISABLE_OPENMETEO_GATE=true 时禁用门禁', () => {
      const originalValue = process.env.DISABLE_OPENMETEO_GATE;
      process.env.DISABLE_OPENMETEO_GATE = 'true';

      const { ProviderOrchestrator: OrchestratorClass } = ProviderOrchestrator;
      const testOrchestrator = new OrchestratorClass();
      expect(testOrchestrator.openmeteoOnlyMode).toBe(false);

      process.env.DISABLE_OPENMETEO_GATE = originalValue;
    });
  });

  describe('_fetchWithQualityGate provider 门禁', () => {
    it('openmeteoOnlyMode=true 且 provider=windy 时应抛出门禁错误', async () => {
      orchestrator.openmeteoOnlyMode = true;
      orchestrator.windyEnabled = true;

      // Mock provider
      orchestrator.providers.windy = {
        fetchWeatherData: jest.fn().mockResolvedValue({ data: [] })
      };

      try {
        await orchestrator._fetchWithQualityGate('windy', 39.9, 116.4, 24);
        fail('应该抛出错误');
      } catch (error) {
        expect(error.code).toBe('PROVIDER_GATE_VIOLATION');
        expect(error.providerKey).toBe('windy');
        expect(error.message).toContain('预测链路 provider 门禁');
      }
    });

    it('openmeteoOnlyMode=true 且 provider=caiyun 时应抛出门禁错误', async () => {
      orchestrator.openmeteoOnlyMode = true;

      // Mock provider
      orchestrator.providers.caiyun = {
        fetchWeatherData: jest.fn().mockResolvedValue({ data: [] })
      };

      try {
        await orchestrator._fetchWithQualityGate('caiyun', 39.9, 116.4, 24);
        fail('应该抛出错误');
      } catch (error) {
        expect(error.code).toBe('PROVIDER_GATE_VIOLATION');
        expect(error.providerKey).toBe('caiyun');
        expect(error.message).toContain('预测链路 provider 门禁');
      }
    });

    it('openmeteoOnlyMode=true 且 provider=openmeteo 时应正常请求', async () => {
      orchestrator.openmeteoOnlyMode = true;

      // Mock provider
      const mockData = { data: [{ temp: 20 }] };
      orchestrator.providers.openmeteo = {
        fetchWeatherData: jest.fn().mockResolvedValue(mockData)
      };

      // Mock validator
      orchestrator._validateAndAnnotate = jest.fn().mockReturnValue({
        data: mockData.data,
        hours: mockData.data.length,
        providerMeta: { name: 'openmeteo' }
      });

      const result = await orchestrator._fetchWithQualityGate('openmeteo', 39.9, 116.4, 24);
      expect(result).toBeDefined();
      expect(result.data).toEqual(mockData.data);
    });

    it('openmeteoOnlyMode=false 时允许使用任意 provider', async () => {
      orchestrator.openmeteoOnlyMode = false;
      orchestrator.windyEnabled = true;

      // Mock provider
      const mockData = { data: [{ temp: 20 }] };
      orchestrator.providers.windy = {
        fetchWeatherData: jest.fn().mockResolvedValue(mockData)
      };

      // Mock validator
      orchestrator._validateAndAnnotate = jest.fn().mockReturnValue({
        data: mockData.data,
        hours: mockData.data.length,
        providerMeta: { name: 'windy' }
      });

      const result = await orchestrator._fetchWithQualityGate('windy', 39.9, 116.4, 24);
      expect(result).toBeDefined();
      expect(result.data).toEqual(mockData.data);
    });

    it('门禁错误应包含正确的错误码和 providerKey', async () => {
      orchestrator.openmeteoOnlyMode = true;
      orchestrator.windyEnabled = true;

      // Mock provider
      orchestrator.providers.windy = {
        fetchWeatherData: jest.fn().mockResolvedValue({ data: [] })
      };

      try {
        await orchestrator._fetchWithQualityGate('windy', 39.9, 116.4, 24);
        fail('应该抛出错误');
      } catch (error) {
        expect(error.code).toBe('PROVIDER_GATE_VIOLATION');
        expect(error.providerKey).toBe('windy');
        expect(error.message).toContain('预测链路 provider 门禁');
        expect(error.message).toContain('DISABLE_OPENMETEO_GATE=true');
      }
    });
  });

  describe('fetchWeatherData 集成测试', () => {
    it('openmeteoOnlyMode=true 时 primary=windy 应失败', async () => {
      orchestrator.openmeteoOnlyMode = true;
      orchestrator.primaryProvider = 'windy';
      orchestrator.fallbackProvider = 'openmeteo';
      orchestrator.windyEnabled = true;

      // Mock providers
      orchestrator.providers.openmeteo = {
        fetchWeatherData: jest.fn().mockResolvedValue({ data: [] })
      };
      orchestrator.providers.windy = {
        fetchWeatherData: jest.fn().mockResolvedValue({ data: [] })
      };
      orchestrator._validateAndAnnotate = jest.fn().mockImplementation((data) => ({
        data: data.data,
        hours: data.data?.length || 0,
        providerMeta: { name: 'openmeteo' }
      }));

      try {
        await orchestrator.fetchWeatherData(39.9, 116.4, 24);
        fail('应该抛出错误');
      } catch (error) {
        expect(error.code).toBe('PROVIDER_GATE_VIOLATION');
        expect(error.providerKey).toBe('windy');
        expect(error.message).toContain('预测链路 provider 门禁');
      }
    });
  });
});
