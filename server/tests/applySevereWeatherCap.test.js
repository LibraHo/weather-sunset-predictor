/**
 * applySevereWeatherCap 回归测试
 * 
 * 验证修复：总云量>=85 不再一刀切封顶35分
 * 改为：低云遮挡主导时才重罚
 */

const { applySevereWeatherCap } = require('../services/EnhancedPredictionService.js');

// 测试用例
const testCases = [
  {
    name: 'Case A: 高云主导、低云低 - 不应被 cap35',
    weatherData: {
      cloudCover: 90,      // 总云量高
      lowClouds: 15,       // 但低云很少
      midClouds: 30,
      highClouds: 85,      // 高云主导（漂亮晚霞场景）
      precipitation: 0,
      weatherCode: 0
    },
    inputScore: 75,
    expectedCap: false,    // 不应被封顶
    expectedMinScore: 75   // 分数应保持不变
  },
  {
    name: 'Case B: 低云高+总云量高 - 应继续被 cap35',
    weatherData: {
      cloudCover: 90,      // 总云量高
      lowClouds: 75,       // 低云高（遮挡主导）
      midClouds: 20,
      highClouds: 10,
      precipitation: 0,
      weatherCode: 0
    },
    inputScore: 75,
    expectedCap: true,     // 应被封顶
    expectedMaxScore: 35   // 封顶到35
  },
  {
    name: 'Case C: 低云主导（>=60）且总云量>=85 - 应被 cap35',
    weatherData: {
      cloudCover: 85,
      lowClouds: 60,       // 刚好触发阈值
      midClouds: 20,
      highClouds: 15,
      precipitation: 0,
      weatherCode: 0
    },
    inputScore: 80,
    expectedCap: true,
    expectedMaxScore: 35
  },
  {
    name: 'Case D: 总云量高但低云<60 - 不应被 cap35',
    weatherData: {
      cloudCover: 88,
      lowClouds: 55,       // 低于60阈值
      midClouds: 70,       // 中云主导
      highClouds: 20,
      precipitation: 0,
      weatherCode: 0
    },
    inputScore: 70,
    expectedCap: false,
    expectedMinScore: 70
  },
  {
    name: 'Case E: 降水场景 - 应被 cap45（保留原逻辑）',
    weatherData: {
      cloudCover: 70,
      lowClouds: 40,
      midClouds: 30,
      highClouds: 20,
      precipitation: 1.0,  // 有降水
      weatherCode: 61
    },
    inputScore: 80,
    expectedCap: true,
    expectedMaxScore: 45   // 降水封顶45
  },
  {
    name: 'Case F: 雨雪码 - 应被 cap45（保留原逻辑）',
    weatherData: {
      cloudCover: 60,
      lowClouds: 30,
      midClouds: 20,
      highClouds: 10,
      precipitation: 0,
      weatherCode: 71        // 雪码
    },
    inputScore: 80,
    expectedCap: true,
    expectedMaxScore: 45
  },
  {
    name: 'Case G: 低云>中高云（多云层但低云主导）- 应被 cap35',
    weatherData: {
      cloudCover: 90,
      lowClouds: 50,       // 低云不是最高，但比中高云都高
      midClouds: 30,
      highClouds: 20,
      precipitation: 0,
      weatherCode: 0
    },
    inputScore: 75,
    expectedCap: true,
    expectedMaxScore: 35
  }
];

// 运行测试
console.log('=== applySevereWeatherCap 回归测试 ===\n');

let passed = 0;
let failed = 0;

testCases.forEach((tc, idx) => {
  const result = applySevereWeatherCap(tc.inputScore, tc.weatherData);
  let pass = false;
  
  if (tc.expectedCap) {
    pass = result.score <= tc.expectedMaxScore && result.reason !== null;
  } else {
    pass = result.score >= tc.expectedMinScore && result.reason === null;
  }
  
  const status = pass ? '✅ PASS' : '❌ FAIL';
  console.log(`${idx + 1}. ${status} - ${tc.name}`);
  console.log(`   Input Score: ${tc.inputScore}, Output Score: ${result.score}, Reason: ${result.reason}`);
  
  if (!pass) {
    console.log(`   Expected: ${tc.expectedCap ? `cap to ${tc.expectedMaxScore}` : `no cap (>=${tc.expectedMinScore})`}`);
    failed++;
  } else {
    passed++;
  }
  console.log();
});

console.log('=== 测试结果 ===');
console.log(`通过: ${passed}/${testCases.length}`);
console.log(`失败: ${failed}/${testCases.length}`);

if (failed > 0) {
  process.exit(1);
}
console.log('\n✅ 所有测试通过！');
