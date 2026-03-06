#!/usr/bin/env node
/**
 * 北京天气场景冒烟测试
 * 用法：node tests/quality/beijingWeatherSmokeTest.js [baseUrl]
 */

const baseUrl = process.argv[2] || 'http://127.0.0.1:3000';
const url = `${baseUrl}/api/weather/forecast?lat=39.9042&lon=116.4074&hours=72`;

async function run() {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const obj = await res.json();

  const arr = obj?.data || [];
  const meta = obj?.providerMeta || {};

  const required = ['timestamp', 'temp', 'humidity', 'cloudCover', 'windSpeed', 'pressure', 'visibility', 'precipitation'];
  let missing = 0;
  for (const x of arr) {
    for (const k of required) {
      if (!(k in x) || x[k] == null) missing++;
    }
  }

  const bins = { 晴: 0, 多云: 0, 阴: 0, 降水: 0 };
  for (const x of arr) {
    const p = x.precipitation || 0;
    const c = x.cloudCover || 0;
    if (p >= 0.1) bins['降水']++;
    else if (c < 20) bins['晴']++;
    else if (c < 70) bins['多云']++;
    else bins['阴']++;
  }

  console.log('== Beijing Weather Smoke Test ==');
  console.log('providerMeta:', meta);
  console.log('hours:', arr.length);
  console.log('missingRequiredValues:', missing);
  console.log('weatherBins:', bins);
  console.log('sample0:', arr[0]);

  if (!obj.success) throw new Error('success=false');
  if (arr.length < 24) throw new Error('hourly data too short');
  if (missing > 0) throw new Error(`missing required fields: ${missing}`);

  console.log('RESULT: PASS');
}

run().catch((e) => {
  console.error('RESULT: FAIL', e.message);
  process.exit(1);
});
