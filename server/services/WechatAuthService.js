const axios = require('axios');

class WechatAuthService {
  constructor(options = {}) {
    this.appId = options.appId || process.env.WECHAT_APP_ID;
    this.appSecret = options.appSecret || process.env.WECHAT_APP_SECRET;
    this.httpClient = options.httpClient || axios;
    this.endpoint = options.endpoint || 'https://api.weixin.qq.com/sns/jscode2session';
  }

  async code2Session(code) {
    if (!code || typeof code !== 'string') {
      const error = new Error('code 为必填字段');
      error.code = 'WECHAT_CODE_REQUIRED';
      error.status = 400;
      throw error;
    }

    if (!this.appId || !this.appSecret) {
      const error = new Error('微信登录配置缺失');
      error.code = 'WECHAT_CONFIG_MISSING';
      error.status = 500;
      throw error;
    }

    const response = await this.httpClient.get(this.endpoint, {
      params: {
        appid: this.appId,
        secret: this.appSecret,
        js_code: code,
        grant_type: 'authorization_code'
      }
    });

    const data = response.data || {};
    if (data.errcode) {
      const error = new Error(data.errmsg || '微信 code2session 失败');
      error.code = 'WECHAT_CODE2SESSION_FAILED';
      error.status = 502;
      error.details = { errcode: data.errcode, errmsg: data.errmsg };
      throw error;
    }

    if (!data.openid) {
      const error = new Error('微信 code2session 响应缺少 openid');
      error.code = 'WECHAT_OPENID_MISSING';
      error.status = 502;
      throw error;
    }

    return {
      openid: data.openid,
      sessionKey: data.session_key,
      unionid: data.unionid
    };
  }
}

module.exports = WechatAuthService;
