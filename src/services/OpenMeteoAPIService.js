import WindyAPIService from './WindyAPIService.js';

/**
 * OpenMeteoAPIService
 * 前端统一天气服务入口（任务54.1）
 *
 * 说明：当前前端依然调用 /api/weather/forecast，
 * 实际数据源由后端 ProviderOrchestrator 决定（默认 openmeteo）。
 */
class OpenMeteoAPIService extends WindyAPIService {}

export default OpenMeteoAPIService;
