/**
 * 测试程序：验证任务 45 和 46 的实现质量
 *
 * 用法：node tasks4546Test.js
 *
 * 测试内容：
 * 1. 任务 45.1: Provider adapter 映射、序列校验、orchestrator 降级逻辑
 * 2. 任务 45.2: 集成测试（主备切换）
 * 3. 任务 45.3: 双读对比脚本可用性
 * 4. 任务 46: 迁移建议文档完整性
 */

import http from 'http';

const BACKEND_URL = 'http://localhost:3000';

// ========== 测试结果记录 ==========
const results = [];

function recordTest(name, passed, message) {
  results.push({ name, passed, message });
  const status = passed ? '✅' : '❌';
  console.log(`${status} ${name}: ${message}`);
}

// ========== 任务 45 测试 ==========

async function testTask451() {
  console.log('\n========== 任务 45.1: Provider adapter 映射、序列校验、orchestrator 降级逻辑 ==========');
  
  // 测试 1: BaseWeatherProvider 基类存在
  try {
    const BaseWeatherProvider = await import('../../server/services/providers/BaseWeatherProvider.js').then(m => m.default || m.BaseWeatherProvider);
    recordTest('45.1.1', BaseWeatherProvider !== undefined, 'BaseWeatherProvider 基类已定义');
    
    // 测试基类方法
    const instance = new BaseWeatherProvider('test');
    recordTest('45.1.2', typeof instance.estimateVisibility === 'function', 'estimateVisibility 方法存在');
  } catch (e) {
    recordTest('45.1.1', false, `BaseWeatherProvider 基类不存在: ${e.message}`);
    recordTest('45.1.2', false, '无法测试 estimateVisibility');
  }
  
  // 测试 2: OpenMeteoProvider 实现
  try {
    const OpenMeteoProvider = await import('../../server/services/providers/OpenMeteoProvider.js').then(m => m.default || m.OpenMeteoProvider);
    recordTest('45.1.3', OpenMeteoProvider !== undefined, 'OpenMeteoProvider 已实现');
    recordTest('45.1.4', OpenMeteoProvider?.name === 'openmeteo', 'Provider 名称正确');
    recordTest('45.1.5', typeof OpenMeteoProvider?.fetchWeatherData === 'function', 'fetchWeatherData 方法存在');
  } catch (e) {
    recordTest('45.1.3', false, `OpenMeteoProvider 不存在: ${e.message}`);
  }
  
  // 测试 3: ForecastSequenceValidator 实现
  try {
    const validator = await import('../../server/services/validators/ForecastSequenceValidator.js').then(m => m.default || m.ForecastSequenceValidator);
    recordTest('45.1.6', validator !== undefined, 'ForecastSequenceValidator 已实现');
    
    // 测试正常数据
    const data = [];
    const baseTime = Date.now();
    for (let i = 0; i < 24; i++) {
      data.push({ timestamp: baseTime + i * 3600000, temp: i });
    }
    
    const result = validator?.validateAndRepair?.(data);
    recordTest('45.1.7', result?.validData?.length === 24, '验证器正确处理正常数据');
    recordTest('45.1.8', result?.quality === 'excellent', '正常数据质量标记为 excellent');
    recordTest('45.1.9', result?.issues?.length === 0, '正常数据无问题');
  } catch (e) {
    recordTest('45.1.6', false, `ForecastSequenceValidator 不存在: ${e.message}`);
  }
  
  // 测试 4: ProviderOrchestrator 降级逻辑
  try {
    const orchestrator = await import('../../server/services/ProviderOrchestrator.js').then(m => m.default);
    recordTest('45.1.10', orchestrator !== undefined, 'ProviderOrchestrator 已实现');
    recordTest('45.1.11', orchestrator?.primaryProvider === 'openmeteo', 'Primary Provider 默认为 Open-Meteo');
    recordTest('45.1.12', orchestrator?.fallbackProvider === 'windy', 'Fallback Provider 默认为 Windy');
    recordTest('45.1.13', typeof orchestrator?.fetchWeatherData === 'function', 'fetchWeatherData 方法存在');
  } catch (e) {
    recordTest('45.1.10', false, `ProviderOrchestrator 不存在: ${e.message}`);
  }
}

async function testTask452() {
  console.log('\n========== 任务 45.2: 集成测试（主备切换） ==========');
  
  // 测试 1: 主数据源（Open-Meteo）正常响应
  try {
    const response = await fetchJSON(`${BACKEND_URL}/api/weather/forecast?lat=39.9&lon=116.4&hours=24`);
    recordTest('45.2.1', response.success === true, '主数据源响应成功');
    recordTest('45.2.2', response.data?.length > 0, '返回数据不为空');
    recordTest('45.2.3', response.providerMeta?.name === 'openmeteo', '数据源标识正确');
    recordTest('45.2.4', response.providerMeta?.dataQuality !== undefined, '数据质量标记存在');
  } catch (e) {
    recordTest('45.2.1', false, `主数据源请求失败: ${e.message}`);
  }
  
  // 测试 2: 降级场景（暂时无法模拟，需要临时破坏 Primary）
  console.log('⚠️  45.2.5 降级场景需要手动测试：临时禁用 Open-Meteo API，验证自动切换到 Windy');
}

async function testTask453() {
  console.log('\n========== 任务 45.3: 双读对比脚本 ==========');
  
  // 测试 1: 脚本文件存在
  try {
    const fs = await import('fs');
    const path = '../../tests/quality/dualReadComparison.js';
    const scriptExists = fs.existsSync?.(new URL(path, import.meta.url).pathname);
    recordTest('45.3.1', scriptExists, '双读对比脚本文件存在');
  } catch (e) {
    recordTest('45.3.1', false, `无法检查脚本文件: ${e.message}`);
  }
  
  // 测试 2: 脚本可执行
  try {
    const { execSync } = await import('child_process');
    execSync('node tests/quality/dualReadComparison.js --help || node tests/quality/dualReadComparison.js 39.9 116.4 2>&1 | head -n 5', { cwd: '../..' });
    recordTest('45.3.2', true, '双读对比脚本可执行');
  } catch (e) {
    recordTest('45.3.2', false, `脚本执行失败: ${e.message}`);
  }
}

// ========== 任务 46 测试 ==========

async function testTask46() {
  console.log('\n========== 任务 46: 迁移建议文档 ==========');
  
  // 测试 1: 迁移建议文档存在
  try {
    const fs = await import('fs');
    const path = '../../docs/migration-advice.md';
    const docExists = fs.existsSync?.(new URL(path, import.meta.url).pathname);
    recordTest('46.1', docExists, '迁移建议文档存在');
  } catch (e) {
    recordTest('46.1', false, `无法检查文档文件: ${e.message}`);
  }
  
  // 测试 2: 文档内容完整性
  try {
    const fs = await import('fs');
    const content = fs.readFileSync?.(new URL('../../docs/migration-advice.md', import.meta.url).pathname, 'utf8');
    
    const requiredSections = [
      '迁移策略建议',
      'Open-Meteo 为主 + 彩云为备',
      '功能支持差异分析',
      '降级策略',
      '兼容性说明',
      '下一步行动'
    ];
    
    let allSectionsPresent = true;
    requiredSections.forEach(section => {
      if (!content.includes(section)) {
        allSectionsPresent = false;
        console.log(`  ⚠️  缺少章节: ${section}`);
      }
    });
    
    recordTest('46.2', allSectionsPresent, '文档包含所有必需章节');
    recordTest('46.3', content.includes('Open-Meteo') && content.includes('彩云') && content.includes('Windy'), '文档提及所有数据源');
    recordTest('46.4', content.includes('降级路径') && content.includes('降级触发条件'), '包含降级策略说明');
  } catch (e) {
    recordTest('46.2', false, `无法读取文档内容: ${e.message}`);
  }
  
  // 测试 3: 任务总结文档存在
  try {
    const fs = await import('fs');
    const path = '../../docs/task46-summary.md';
    const docExists = fs.existsSync?.(new URL(path, import.meta.url).pathname);
    recordTest('46.5', docExists, '任务 46 完成总结文档存在');
  } catch (e) {
    recordTest('46.5', false, `无法检查总结文档: ${e.message}`);
  }
}

// ========== 工具函数 ==========

function fetchJSON(url, headers = {}) {
  return new Promise((resolve, reject) => {
    http.get(url, { headers }, (res) => {
      let rawData = '';
      
      res.on('data', (chunk) => {
        rawData += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(rawData);
          if (jsonData.success) {
            resolve(jsonData);
          } else {
            reject(new Error(jsonData.error?.message || '请求失败'));
          }
        } catch (e) {
          reject(new Error(`JSON 解析失败: ${e.message}`));
        }
      });
    }).on('error', (e) => {
      reject(new Error(`HTTP 请求失败: ${e.message}`));
    });
  });
}

// ========== 主函数 ==========

async function main() {
  console.log('========================================');
  console.log('任务 45 & 46 验证测试程序');
  console.log('========================================');
  
  await testTask451();
  await testTask452();
  await testTask453();
  await testTask46();
  
  // ========== 汇总 ==========
  console.log('\n========================================');
  console.log('测试结果汇总');
  console.log('========================================');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`总计: ${results.length} 项测试`);
  console.log(`通过: ${passed} 项`);
  console.log(`失败: ${failed} 项`);
  
  if (failed > 0) {
    console.log('\n❌ 失败的测试:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.message}`);
    });
  } else {
    console.log('\n✅ 所有测试通过！');
  }
  
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('测试程序运行失败:', error);
  process.exit(1);
});
