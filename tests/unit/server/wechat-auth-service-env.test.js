import { jest } from '@jest/globals';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

describe('WechatAuthService env configuration', () => {
  const keys = ['WECHAT_APP_ID', 'WECHAT_APPID', 'WECHAT_APP_SECRET', 'WECHAT_APPSECRET'];
  let previous;

  beforeEach(() => {
    jest.resetModules();
    previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    for (const key of keys) delete process.env[key];
  });

  afterEach(() => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });

  test('accepts documented mini-program env aliases', () => {
    process.env.WECHAT_APPID = 'wx-docs-appid';
    process.env.WECHAT_APPSECRET = 'docs-secret';

    const WechatAuthService = require('../../../server/services/WechatAuthService.js');
    const service = new WechatAuthService();

    expect(service.appId).toBe('wx-docs-appid');
    expect(service.appSecret).toBe('docs-secret');
  });
});
