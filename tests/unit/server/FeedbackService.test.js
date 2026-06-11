import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { jest } from '@jest/globals';

describe('FeedbackService', () => {
  let tmpHome;
  let service;

  beforeEach(async () => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'xiake-feedback-'));
    process.env.HOME = tmpHome;
    jest.resetModules();
    const mod = await import('../../../server/services/FeedbackService.js');
    service = mod.default || mod;
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  test('accepts card feedback inside event window and stores snapshots', () => {
    const record = service.createFeedback({
      source: 'card',
      feedbackType: 'wrong',
      comment: '现场没有颜色',
      nickname: 'Alex',
      contactEmail: 'alex@example.com',
      period: 'sunset',
      eventTime: '2026-06-12T10:00:00.000Z',
      date: '2026-06-12',
      lat: 39.9,
      lon: 116.4,
      score: 68,
      predictionSnapshot: { score: 68 },
      weatherSnapshot: { cloudLayers: { high: 50 } }
    }, [], { now: new Date('2026-06-12T09:30:00.000Z') });

    expect(record.id).toBeTruthy();
    expect(record.feedbackTypeLabel).toBe('误报');
    expect(record.predictionSnapshot.score).toBe(68);
    expect(service.listFeedback()).toHaveLength(1);
  });

  test('rejects card feedback outside event window', () => {
    expect(() => service.createFeedback({
      source: 'card',
      feedbackType: 'missed',
      period: 'sunrise',
      eventTime: '2026-06-12T10:00:00.000Z'
    }, [], { now: new Date('2026-06-12T12:00:00.000Z') })).toThrow(/反馈暂未开放/);
  });

  test('requires prediction snapshot for home feedback', () => {
    expect(() => service.createFeedback({
      source: 'home',
      feedbackType: 'overstated',
      period: 'sunset'
    }, [], { now: new Date('2026-06-12T12:00:00.000Z') })).toThrow(/超出可反馈/);
  });

  test('stores up to two base64 images', () => {
    const tinyJpegBase64 = Buffer.from('image').toString('base64');
    const record = service.createFeedback({
      source: 'home',
      feedbackType: 'wrong',
      period: 'sunset',
      predictionSnapshot: { score: 50 },
      photos: [
        { name: 'one.jpg', mimeType: 'image/jpeg', base64: tinyJpegBase64 },
        { name: 'two.jpg', mimeType: 'image/jpeg', base64: tinyJpegBase64 },
        { name: 'three.jpg', mimeType: 'image/jpeg', base64: tinyJpegBase64 }
      ]
    }, [], { now: new Date('2026-06-12T12:00:00.000Z') });

    expect(record.images).toHaveLength(2);
    expect(fs.existsSync(service.getImagePath(record.images[0].storedName))).toBe(true);
  });
});
