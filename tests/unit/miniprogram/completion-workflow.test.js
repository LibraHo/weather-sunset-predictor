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

  test('keeps task status synchronized with implemented gallery clustering and miniprogram planning', () => {
    const tasks = read('.kiro/specs/weather-sunset-predictor/tasks.md');

    expect(tasks).toContain('- [x] 51.6 地图聚合展示');
    expect(tasks).toContain('- [x] 51.9 测试与验证');
    expect(tasks).toContain('PR #663');
    expect(tasks).toContain('- [x] 52.12 MVP 信息架构');
    expect(tasks).toContain('- [x] 52.13 共享 API 契约文档');
    expect(tasks).toContain('- [x] 52.23 真机验收矩阵');
    expect(tasks).toContain('真实执行待外部条件');
    expect(tasks).toContain('PR #690/#691 已合并，体验版 `1.0.2` 已通过 `miniprogram-ci upload` 上传');
    expect(tasks).toContain('PR #691 已把首页/结果页入口和原生火烧云地图往 Web 体验对齐');
    expect(tasks).toContain('仍需真机连续操作验收');
  });

  test('platform checklist explicitly warns that unchecked items require real platform work', () => {
    const checklist = read('docs/miniprogram-platform-checklist.md');

    expect(checklist).toContain('不代表真机或体验版已经通过');
    expect(checklist).toContain('仓库内文档或单测通过不等于平台验收完成');
    expect(checklist).toContain('docs/miniprogram-completion-workflow.md');
  });
});
