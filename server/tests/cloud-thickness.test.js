/**
 * 云厚评估模块测试（Phase 22）
 */
const { assessCloudThickness } = require('../services/EnhancedPredictionService');

const tests = [
  {
    name: '厚云幕：直射比低 + 水汽高 + 阴天码',
    input: {
      shortwaveRadiation: 100,
      directRadiation: 10,
      diffuseRadiation: 80,
      waterVapourColumn: 8.0,
      cloudCover: 100,
      weatherCode: 3
    },
    expectThickness: 'thick',
    expectModifierBelow: 0.6
  },
  {
    name: '薄卷云：直射比高 + 水汽低',
    input: {
      shortwaveRadiation: 500,
      directRadiation: 380,
      diffuseRadiation: 100,
      waterVapourColumn: 2.0,
      cloudCover: 80,
      weatherCode: 2
    },
    expectThickness: 'thin',
    expectModifierAbove: 1.0
  },
  {
    name: '无数据：降级',
    input: {
      cloudCover: 60
    },
    expectThickness: 'unknown',
    expectModifier: 1.0
  },
  {
    name: '适中：直射比中等 + 水汽中等',
    input: {
      shortwaveRadiation: 300,
      directRadiation: 150,
      diffuseRadiation: 120,
      waterVapourColumn: 4.0,
      cloudCover: 60,
      weatherCode: 2
    },
    expectThickness: 'thin',
    expectModifierAbove: 1.0
    // waterIndex = 4.0 * 60/100 = 2.4 < 2.5 → low signal → score leans thin
  }
];

let passed = 0;
let failed = 0;

tests.forEach((t, i) => {
  const result = assessCloudThickness(t.input);
  let ok = true;
  let reason = '';

  if (t.expectThickness && result.thickness !== t.expectThickness) {
    ok = false;
    reason = `thickness: expected=${t.expectThickness}, got=${result.thickness}`;
  }
  if (t.expectModifier && result.modifier !== t.expectModifier) {
    ok = false;
    reason = `modifier: expected=${t.expectModifier}, got=${result.modifier}`;
  }
  if (t.expectModifierBelow && result.modifier >= t.expectModifierBelow) {
    ok = false;
    reason = `modifier should be < ${t.expectModifierBelow}, got=${result.modifier}`;
  }
  if (t.expectModifierAbove && result.modifier < t.expectModifierAbove) {
    ok = false;
    reason = `modifier should be >= ${t.expectModifierAbove}, got=${result.modifier}`;
  }

  if (ok) {
    console.log(`${i + 1}. ✅ PASS - ${t.name}`);
    passed++;
  } else {
    console.log(`${i + 1}. ❌ FAIL - ${t.name}`);
    console.log(`   ${reason}`);
    console.log(`   Result: thickness=${result.thickness}, modifier=${result.modifier}, score=${result.score}, reasons=${result.reasons}`);
    failed++;
  }
});

console.log(`\n=== 测试结果 ===`);
console.log(`通过: ${passed}/${passed + failed}`);
console.log(`失败: ${failed}/${passed + failed}`);

process.exit(failed > 0 ? 1 : 0);
