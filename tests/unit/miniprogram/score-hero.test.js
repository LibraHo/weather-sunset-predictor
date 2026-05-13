import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.resolve(process.cwd(), 'miniprogram/components/score-hero/index.js'), 'utf8');
const homeWxml = fs.readFileSync(path.resolve(process.cwd(), 'miniprogram/pages/home/index.wxml'), 'utf8');
const homeJs = fs.readFileSync(path.resolve(process.cwd(), 'miniprogram/pages/home/index.js'), 'utf8');

describe('miniprogram score hero scoring copy', () => {
  test('uses website score bands for firecloud grades', () => {
    expect(source).toContain('if (score >= 85) return \'excellent\';');
    expect(source).toContain('if (score >= 70) return \'good\';');
    expect(source).toContain('if (score >= 40) return \'fair\';');
    expect(source).not.toContain('if (score >= 80) return \'excellent\';');
    expect(source).not.toContain('if (score >= 65) return \'good\';');
    expect(source).not.toContain('if (score >= 45) return \'fair\';');
  });

  test('keeps low score copy focused on firecloud conditions instead of going out', () => {
    expect(source).toContain("low: '偏弱'");
    expect(homeWxml).toContain('先看火烧云条件，再安排观赏。');
    expect(homeWxml).not.toContain('要不要出门');
    expect(homeJs).toContain('建议结合实时天气、视野和临近时段云况判断。');
    expect(homeJs).not.toContain('再决定是否出门');
  });
});
