import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { jest } from '@jest/globals';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('mini-program user page source', () => {
  afterEach(() => {
    delete globalThis.Page;
    delete globalThis.wx;
  });

  test('app and topbar expose the user center route', () => {
    const appJson = JSON.parse(read('miniprogram/app.json'));
    const topbarWxml = read('miniprogram/components/app-topbar/index.wxml');
    const topbarJs = read('miniprogram/components/app-topbar/index.js');

    expect(appJson.pages).toContain('pages/user/index');
    expect(topbarWxml).toContain('data-target="user"');
    expect(topbarWxml).toContain('我的');
    expect(topbarJs).toContain("user: '/pages/user/index'");
  });

  test('user page renders auth state, actions, favorites and recent locations', () => {
    const wxml = read('miniprogram/pages/user/index.wxml');
    const wxss = read('miniprogram/pages/user/index.wxss');

    expect(wxml).toContain('user-page');
    expect(wxml).toContain('<app-topbar current="user"');
    expect(wxml).toContain('user-hero-card');
    expect(wxml).toContain('wx:if="{{isSignedIn}}"');
    expect(wxml).toContain('bindtap="login"');
    expect(wxml).toContain('bindtap="logout"');
    expect(wxml).toContain('收藏地点');
    expect(wxml).toContain('最近地点');
    expect(wxml).toContain('wx:for="{{favorites}}"');
    expect(wxml).toContain('wx:for="{{recentLocations}}"');
    expect(wxml).toContain('bindtap="openLocation"');
    expect(wxml).toContain('/assets/icons/users.svg');
    expect(wxml).not.toMatch(/[👤⭐📍]/u);
    expect(wxml).not.toContain('›');

    expect(wxss).toContain('.user-page');
    expect(wxss).toContain('.user-hero-card');
    expect(wxss).toContain('.user-action-primary');
    expect(wxss).toContain('.user-row-chevron');
    expect(wxss).toContain('.user-page.theme-dark');
    expect(wxss).toContain('rgba(18, 28, 52');
    expect(wxss).toContain('#f5c87a');
  });

  test('user page uses existing auth and user services', () => {
    const js = read('miniprogram/pages/user/index.js');

    expect(js).toContain("import { clearSession, getCurrentUser, getSessionToken, loginWithWechat } from '../../services/auth.js'");
    expect(js).toContain("import { listFavorites, listRecentLocations } from '../../services/user.js'");
    expect(js).toContain('currentUser: null');
    expect(js).toContain('isSignedIn: false');
    expect(js).toContain('async login()');
    expect(js).toContain('logout()');
    expect(js).toContain('async refreshUserData()');
    expect(js).toContain('await loginWithWechat');
    expect(js).toContain('await listFavorites');
    expect(js).toContain('await listRecentLocations');
    expect(js).toContain("wx.navigateTo({ url: `/pages/home/index?location=${encodeURIComponent(location.name || location.locationName || '')}` })");
  });

  test('user page does not auto-login while loading the signed-out screen', () => {
    const js = read('miniprogram/pages/user/index.js');

    expect(js).toContain('const token = getSessionToken()');
    expect(js).toContain('if (!token) {');
    expect(js).toContain('favorites: []');
    expect(js).toContain('recentLocations: []');
  });

  test('home page can receive a location opened from the user center', () => {
    const homeJs = read('miniprogram/pages/home/index.js');

    expect(homeJs).toContain('applyInitialLocation(options)');
    expect(homeJs).toContain('const rawLocation = options.location || options.name');
    expect(homeJs).toContain("locationText: rawLocation ? decodeURIComponent(rawLocation) : '分享地点'");
  });

  test('user page module exports stable display helpers', async () => {
    globalThis.Page = jest.fn();
    globalThis.wx = {
      getStorageSync: jest.fn(() => null),
      setStorageSync: jest.fn(),
      removeStorageSync: jest.fn()
    };

    const module = await import('../../../miniprogram/pages/user/index.js');

    expect(module.buildSessionState({
      userId: 'user-abcdef',
      identities: [{ provider: 'wechat_mini' }]
    })).toMatchObject({
      isSignedIn: true,
      displayName: '霞客 abcdef',
      identitySummary: '微信小程序 已连接'
    });
    expect(module.decorateLocations([{ locationName: '北京', lat: 39.9042, lon: 116.4074, type: 'sunrise' }])[0]).toMatchObject({
      name: '北京',
      typeLabel: '朝霞',
      coordinateText: '39.9042, 116.4074'
    });
  });
});
