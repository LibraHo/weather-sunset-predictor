/**
 * 需求45: Token 管理 / API 申请 / 审计日志 测试
 */

import { jest } from '@jest/globals';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = global.TextEncoder || TextEncoder;
global.TextDecoder = global.TextDecoder || TextDecoder;

const express = require('express');
const request = require('supertest');
const fs = require('fs');
const os = require('os');
const path = require('path');
function parseBasicAuth(req) {
  const header = req.get('Authorization') || '';
  const match = /^Basic\s+(.+)$/i.exec(header);
  if (!match) return null;
  const decoded = Buffer.from(match[1], 'base64').toString('utf8');
  const idx = decoded.indexOf(':');
  if (idx === -1) return null;
  return { name: decoded.slice(0, idx), pass: decoded.slice(idx + 1) };
}

function buildAdminAuth(password = process.env.ADMIN_PASSWORD || 'xiake2024') {
  return (req, res, next) => {
    const credentials = parseBasicAuth(req);
    if (!credentials || credentials.pass !== password) {
      res.set('WWW-Authenticate', 'Basic realm="Xiake Photo Admin"');
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: '认证失败' } });
    }
    next();
  };
}

function makeAdminHeader(password = process.env.ADMIN_PASSWORD || 'xiake2024') {
  return `Basic ${Buffer.from(`admin:${password}`).toString('base64')}`;
}

function createExpressApp() {
  jest.resetModules();

  const app = express();
  app.use(express.json());

  // Ensure routes use per-test paths via env settings before requiring modules
  const applicationsRoutes = require('../../../server/routes/applications');
  const apiLogsRoutes = require('../../../server/routes/api-logs');
  const agentRoutes = require('../../../server/routes/agent');

  app.use('/api/applications', applicationsRoutes);
  app.use('/api/admin', buildAdminAuth(), apiLogsRoutes);
  app.use('/api/agent', agentRoutes);

  return app;
}

describe('需求45 PR C - Token 管理 / API 申请 / 审计日志', () => {
  const adminPassword = 'xiake2024';
  let tmpDir;
  let tokenStorage;
  let appStorage;
  let auditStorage;
  let applicationStorage;
  let app;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-req45-'));
    tokenStorage = path.join(tmpDir, 'api-tokens.json');
    appStorage = path.join(tmpDir, 'app-state.json');
    applicationStorage = path.join(tmpDir, 'api-applications.json');
    auditStorage = path.join(tmpDir, 'agent-audit-logs.json');

    process.env.XIAKE_DATA_DIR = tmpDir;
    process.env.SERVER_TOKEN_SECRET = 'unit-test-secret';
    process.env.API_TOKEN_STORAGE_PATH = tokenStorage;
    process.env.API_AGENT_AUDIT_LOG_PATH = auditStorage;
    process.env.API_APPLICATION_STORAGE_PATH = applicationStorage;
    process.env.ADMIN_PASSWORD = adminPassword;
    process.env.NODE_ENV = 'test';

    app = createExpressApp();
  });

  afterEach(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  test('admin 创建 token 成功，明文仅创建返回且列表不泄露明文', async () => {
    const createRes = await request(app)
      .post('/api/admin/tokens')
      .set('Authorization', makeAdminHeader(adminPassword))
      .send({ name: 'ci-test', minuteLimit: 20, dailyLimit: 2000, enabled: true });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    expect(typeof createRes.body.token).toBe('string');
    expect(createRes.body.token).toMatch(/^xiake_/);

    const listRes = await request(app)
      .get('/api/admin/tokens')
      .set('Authorization', makeAdminHeader(adminPassword));

    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.tokens)).toBe(true);
    expect(listRes.body.tokens.length).toBe(1);
    const tokenRecord = listRes.body.tokens[0];
    expect(tokenRecord).not.toHaveProperty('token');
    expect(tokenRecord).not.toHaveProperty('tokenHash');
    expect(tokenRecord.name).toBe('ci-test');

    // 创建接口返回字段 token 只能来自创建响应
    expect(listRes.body.tokens[0].id).toBe(createRes.body.tokenMeta.id);
  });

  test('admin token 启停/改名/改限流/删除', async () => {
    const createRes = await request(app)
      .post('/api/admin/tokens')
      .set('Authorization', makeAdminHeader(adminPassword))
      .send({ name: 'origin', minuteLimit: 120, dailyLimit: 5000 });

    expect(createRes.status).toBe(201);
    const tokenId = createRes.body.tokenMeta.id;

    const updateRes = await request(app)
      .patch(`/api/admin/tokens/${tokenId}`)
      .set('Authorization', makeAdminHeader(adminPassword))
      .send({ name: 'renamed', enabled: false, minuteLimit: 80, dailyLimit: 2000 });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);
    expect(updateRes.body.token.name).toBe('renamed');
    expect(updateRes.body.token.enabled).toBe(false);
    expect(updateRes.body.token.minuteLimit).toBe(80);
    expect(updateRes.body.token.dailyLimit).toBe(2000);

    // 回置启用，验证开关可更新
    const enableRes = await request(app)
      .patch(`/api/admin/tokens/${tokenId}`)
      .set('Authorization', makeAdminHeader(adminPassword))
      .send({ enabled: true });
    expect(enableRes.status).toBe(200);
    expect(enableRes.body.token.enabled).toBe(true);

    const deleteRes = await request(app)
      .delete(`/api/admin/tokens/${tokenId}`)
      .set('Authorization', makeAdminHeader(adminPassword));

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);

    const listRes = await request(app)
      .get('/api/admin/tokens')
      .set('Authorization', makeAdminHeader(adminPassword));

    expect(listRes.status).toBe(200);
    expect(listRes.body.tokens.some((t) => t.id === tokenId)).toBe(false);
  });


  test('admin 支持受信任用户 token 备注、非商用、到期时间和批量禁用', async () => {
    const createRes = await request(app)
      .post('/api/admin/tokens')
      .set('Authorization', makeAdminHeader(adminPassword))
      .send({
        name: 'trusted-user',
        trustedUser: 'alice@example.com',
        note: 'research invite',
        nonCommercial: true,
        expiresAt: '2999-01-01T00:00:00.000Z',
        minuteLimit: 20,
        dailyLimit: 500
      });

    expect(createRes.status).toBe(201);
    const tokenId = createRes.body.tokenMeta.id;
    expect(createRes.body.tokenMeta).toMatchObject({
      trustedUser: 'alice@example.com',
      note: 'research invite',
      nonCommercial: true,
      expiresAt: '2999-01-01T00:00:00.000Z'
    });

    const patchRes = await request(app)
      .patch(`/api/admin/tokens/${tokenId}`)
      .set('Authorization', makeAdminHeader(adminPassword))
      .send({ note: 'updated note', expiresAt: null });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.token.note).toBe('updated note');
    expect(patchRes.body.token.expiresAt).toBeNull();

    const batchRes = await request(app)
      .post('/api/admin/tokens/batch-disable')
      .set('Authorization', makeAdminHeader(adminPassword))
      .send({ ids: [tokenId], note: 'trust task disabled' });
    expect(batchRes.status).toBe(200);
    expect(batchRes.body.disabledCount).toBe(1);
    expect(batchRes.body.tokens[0].enabled).toBe(false);
    expect(batchRes.body.tokens[0].note).toContain('trust task disabled');
  });


  test('API 申请邮箱/联系方式必填校验 + 提交入库 + 前台不返回 Token', async () => {
    const badRes = await request(app)
      .post('/api/applications')
      .send({ email: 'a@example.com' });
    expect(badRes.status).toBe(400);
    expect(badRes.body.error.code).toBe('INVALID_PARAMS');
    expect(badRes.body.error.message).toMatch(/required/);

    const goodRes = await request(app)
      .post('/api/applications')
      .send({
        email: 'a@example.com',
        contact: 'wechat:abc',
        purpose: '个人测试',
        expectedCallVolume: 100
      });

    expect(goodRes.status).toBe(201);
    expect(goodRes.body.success).toBe(true);
    expect(goodRes.body.application).toMatchObject({
      email: 'a@example.com',
      contact: 'wechat:abc',
      purpose: '个人测试',
      expectedCallVolume: 100,
      status: 'pending'
    });
    expect(goodRes.body.application).not.toHaveProperty('token');
    expect(goodRes.body.application.id).toBeTruthy();

    const listRes = await request(app)
      .get('/api/admin/applications')
      .set('Authorization', makeAdminHeader(adminPassword));

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(listRes.body.applications.length).toBe(1);
    expect(listRes.body.applications[0].email).toBe('a@example.com');
  });

  test('后台申请列表可见、拒绝记录状态/备注、批准可创建 token 并关联 tokenId', async () => {
    const appRes = await request(app)
      .post('/api/applications')
      .send({
        email: 'b@example.com',
        contact: 'tg:123',
        purpose: '学习用途'
      });

    expect(appRes.status).toBe(201);
    const appId = appRes.body.application.id;

    const listBefore = await request(app)
      .get('/api/admin/applications')
      .set('Authorization', makeAdminHeader(adminPassword));

    expect(listBefore.status).toBe(200);
    expect(listBefore.body.applications[0].id).toBe(appId);

    const rejectRes = await request(app)
      .post(`/api/admin/applications/${appId}/review`)
      .set('Authorization', makeAdminHeader(adminPassword))
      .send({ status: 'rejected', remarks: '用途不符合' });

    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.application.status).toBe('rejected');
    expect(rejectRes.body.application.remarks).toBe('用途不符合');

    const approveRes = await request(app)
      .post('/api/applications')
      .send({
        email: 'c@example.com',
        contact: 'wx:456',
        purpose: '科研用途'
      });

    expect(approveRes.status).toBe(201);
    const approveId = approveRes.body.application.id;

    const reviewedRes = await request(app)
      .post(`/api/admin/applications/${approveId}/review`)
      .set('Authorization', makeAdminHeader(adminPassword))
      .send({ status: 'approved', remarks: 'approved', createToken: true, minuteLimit: 40, dailyLimit: 4000, tokenName: 'approved-api' });

    expect(reviewedRes.status).toBe(200);
    expect(reviewedRes.body.success).toBe(true);
    expect(reviewedRes.body.token).toBeTruthy();
    expect(reviewedRes.body.application.status).toBe('approved');
    expect(reviewedRes.body.application.tokenId).toBeTruthy();

    const listAfter = await request(app)
      .get('/api/admin/applications')
      .set('Authorization', makeAdminHeader(adminPassword));

    const appItem = listAfter.body.applications.find((x) => x.id === approveId);
    expect(appItem).toBeDefined();
    expect(appItem.status).toBe('approved');
    expect(appItem.tokenId).toBeTruthy();
    expect(appItem.remarks).toBe('approved');
  });

  test('Agent 审计日志记录 tokenId / status / elapsedMs / ipHash 且不含 token 明文', async () => {
    const createRes = await request(app)
      .post('/api/admin/tokens')
      .set('Authorization', makeAdminHeader(adminPassword))
      .send({ name: 'forecaster', minuteLimit: 200, dailyLimit: 5000 });
    expect(createRes.status).toBe(201);
    const token = createRes.body.token;
    const tokenMeta = createRes.body.tokenMeta;

    const orchestrator = require('../../../server/services/ProviderOrchestrator');
    const now = Date.now();
    const spy = jest.spyOn(orchestrator, 'fetchWeatherData');
    spy.mockResolvedValue({
      data: [{ timestamp: now, cloudCover: 10, lowClouds: 10, midClouds: 20, highClouds: 5, humidity: 50, visibility: 10 }]
    });

    const forecastRes = await request(app)
      .get('/api/agent/forecast')
      .set('Authorization', `Bearer ${token}`)
      .query({ lat: '39.9', lon: '116.4', type: 'sunset', detail: 'simple' });

    expect(forecastRes.status).toBe(200);
    expect(forecastRes.body.success).toBe(true);

    const logsRes = await request(app)
      .get('/api/admin/audit-logs?limit=20')
      .set('Authorization', makeAdminHeader(adminPassword));

    expect(logsRes.status).toBe(200);
    expect(Array.isArray(logsRes.body.logs)).toBe(true);
    expect(logsRes.body.logs.length).toBeGreaterThan(0);

    const hit = logsRes.body.logs.find((x) => x.endpoint === '/api/agent/forecast' && x.tokenId === tokenMeta.id);
    expect(hit).toBeDefined();
    expect(hit.status).toBe(200);
    expect(typeof hit.elapsedMs).toBe('number');
    expect(hit.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(hit.errorCode).toBeNull();

    expect(hit.ipHash).toMatch(/^[a-f0-9]{64}$/);
    expect(hit.ipHash).not.toContain(':');
    expect(hit.ipHash).not.toContain('.');
    expect(hit).not.toHaveProperty('ip');
    expect(hit).not.toHaveProperty('token');
    expect(hit).not.toHaveProperty('tokenHash');

    spy.mockRestore();
  });
});
