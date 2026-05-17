import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('miniprogram design language styles', () => {
  const appWxss = readText('miniprogram/app.wxss');

  test('defines Xiake reusable token and utility layers', () => {
    expect(appWxss).toContain('霞客小程序设计语言');
    expect(appWxss).toContain('Night sky: #070b16 / #0a0f1e / #0e1930');
    expect(appWxss).toContain('Sunset gold: #ffd166 / #f5c87a');
    expect(appWxss).toContain('Warm orange: #fb923c / #f97316');

    [
      '.xiake-bg-night-sky',
      '.xiake-bg-sunset-band',
      '.xiake-glass-card',
      '.xiake-title',
      '.xiake-muted',
      '.xiake-button-primary',
      '.xiake-button-ghost',
      '.xiake-input',
      '.xiake-state-error',
      '.xiake-state-success'
    ].forEach((className) => {
      expect(appWxss).toContain(className);
    });
  });

  test('keeps the app background as dark sky sunset gradient without decorative radial orbs', () => {
    expect(appWxss).toContain('linear-gradient(180deg, #070b16 0%, #0a0f1e 42%, #0e1930 72%, #07101f 100%)');
    expect(appWxss).not.toMatch(/radial-gradient/i);
  });

  test('keeps existing page classes mapped to the shared design language', () => {
    [
      '.xiake-card,',
      '.glass-card',
      '.primary-button,',
      '.ghost-button,',
      '.subtle-text,',
      '.location-input,',
      '.field-input,',
      '.field-textarea',
      '.error-card,',
      '.success-card'
    ].forEach((className) => {
      expect(appWxss).toContain(className);
    });
  });

  test('keeps page typography below the topbar logo and readable in score audit blocks', () => {
    const topbarWxss = readText('miniprogram/components/app-topbar/index.wxss');
    const resultWxss = readText('miniprogram/pages/result/index.wxss');
    const methodologyWxss = readText('miniprogram/pages/methodology/index.wxss');
    const mapWxss = readText('miniprogram/pages/map/index.wxss');

    expect(topbarWxss).toContain('.app-logo-text');
    expect(topbarWxss).toContain('font-size: 42rpx');
    expect(methodologyWxss).not.toMatch(/font-size:\s*(4[3-9]|[5-9]\d)rpx/);
    expect(mapWxss).not.toMatch(/font-size:\s*(4[3-9]|[5-9]\d)rpx/);
    expect(resultWxss).not.toMatch(/score-ledger-[^{]+{[^}]*font-size:\s*(2[0-3])rpx/s);
  });

  test('keeps primary page card spacing consistent', () => {
    [
      'miniprogram/pages/home/index.wxss',
      'miniprogram/pages/methodology/index.wxss',
      'miniprogram/pages/map/index.wxss',
      'miniprogram/pages/gallery/index.wxss',
      'miniprogram/pages/upload/index.wxss',
      'miniprogram/pages/result/index.wxss'
    ].forEach((file) => {
      const wxss = readText(file);

      expect(wxss).toMatch(/\.[\w-]+-page\s*\{[\s\S]*?gap:\s*24rpx;/);
    });

    const methodologyWxml = readText('miniprogram/pages/methodology/index.wxml');

    expect(methodologyWxml.trim().startsWith('<view class="container methodology-page')).toBe(true);
  });

  test('keeps page-level visual language within shared bounds', () => {
    const pageFiles = [
      'miniprogram/pages/home/index.wxss',
      'miniprogram/pages/methodology/index.wxss',
      'miniprogram/pages/map/index.wxss',
      'miniprogram/pages/gallery/index.wxss',
      'miniprogram/pages/upload/index.wxss',
      'miniprogram/pages/result/index.wxss'
    ];

    pageFiles.forEach((file) => {
      expect(readText(file)).not.toMatch(/radial-gradient/i);
    });

    const homeWxss = readText('miniprogram/pages/home/index.wxss');
    const galleryWxss = readText('miniprogram/pages/gallery/index.wxss');
    const uploadWxss = readText('miniprogram/pages/upload/index.wxss');

    expect(homeWxss).toMatch(/\.home-title\s*\{[\s\S]*?font-size:\s*42rpx;/);
    expect(galleryWxss).toMatch(/\.headline\s*\{[\s\S]*?font-size:\s*42rpx;/);
    expect(uploadWxss).toMatch(/\.headline\s*\{[\s\S]*?font-size:\s*42rpx;/);
  });
});
