# Real Sunset Case Library

真实反馈样本库用于把现场反馈变成可回放的算法回归测试。每次算法更新都要跑这些样本，避免修好新 case 又打坏旧 case。

## 文件位置

- 样本：`tests/fixtures/real-sunset-cases/*.json`
- 回放测试：`tests/unit/server/real-sunset-case-library.test.js`

## 每个样本必须记录

- 地点：名称、经纬度、时区
- 事件：朝霞/晚霞、本地日期、实际用于算法计算的 UTC 时间
- 核心天气：总云量、低/中/高云、天气码、降水、能见度
- 太阳透射：`directRadiation`、`shortwaveRadiation`、`diffuseRadiation`
- 灰空气：AOD、PM2.5、PM10、AQI、水汽
- 光路：日落方向远端采样、近/远端遮挡、光路分
- 周边：周边格点分层云量和预测分
- 反馈：主观分数区间、实际是否烧、是否下雨、现场描述
- 回归期望：允许分数区间、必须命中的原因、禁止回到的高分区间

## 使用方式

新增反馈时追加一个 JSON 样本，不需要改测试框架。算法调整后运行：

```bash
npm test -- tests/unit/server/real-sunset-case-library.test.js --runInBand --silent
```

如果算法有意改变某个历史样本的语义，先更新样本里的 `feedback` 和 `expectations`，并在 PR 里解释为什么。
