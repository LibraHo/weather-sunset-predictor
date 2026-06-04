import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('miniprogram completion workflow docs', () => {
  test('separates repository completion from external platform validation', () => {
    const doc = read('docs/miniprogram-completion-workflow.md');

    expect(doc).toContain('仓库内可完成');
    expect(doc).toContain('必须依赖微信后台/真机/体验版');
    expect(doc).toContain('PR #670');
    expect(doc).toContain('PR #690');
    expect(doc).toContain('PR #691');
    expect(doc).toContain('体验版 `1.0.2`');
    expect(doc).toContain('docs/miniprogram-platform-checklist.md');
    expect(doc).toContain('真实小程序 AppID');
    expect(doc).toContain('体验版上传和二维码');
  });

  test('keeps Kiro task docs focused on current work instead of historical completion logs', () => {
    const tasks = read('.kiro/specs/weather-sunset-predictor/tasks.md');

    expect(tasks).toContain('## 当前 P0');
    expect(tasks).toContain('### T1 修复地图 raw score 泄漏');
    expect(tasks).toContain('### T6 小程序版本号流程固化');
    expect(tasks).toContain('本文件只维护当前待办、进行中事项和固定约束');
    expect(tasks).toContain('完成任务从本文移除，不追加长篇完成记录');
    expect(tasks).not.toContain('- [x] 51.6 地图聚合展示');
    expect(tasks).not.toContain('PR #690/#691 已合并，体验版 `1.0.2`');
  });

  test('platform checklist explicitly warns that unchecked items require real platform work', () => {
    const checklist = read('docs/miniprogram-platform-checklist.md');

    expect(checklist).toContain('不代表真机或体验版已经通过');
    expect(checklist).toContain('仓库内文档或单测通过不等于平台验收完成');
    expect(checklist).toContain('docs/miniprogram-completion-workflow.md');
  });
});
