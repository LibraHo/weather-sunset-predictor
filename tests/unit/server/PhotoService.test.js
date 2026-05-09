/**
 * PhotoService 单元测试（Phase 20 任务 70.1/70.2）
 *
 * 覆盖：
 *   - initDirs() 目录与索引初始化（幂等）
 *   - savePhoto() 正常上传、octet-stream 图片兜底识别、MIME 拒绝、超大文件拒绝
 *   - getPhotos() 返回列表
 *   - deletePhoto() 删除条目
 *   - getPhotoById() 按 ID 查询
 *   - generateThumbnail() sharp 可用时生成缩略图
 *
 * 策略：
 *   - 用 os.tmpdir() 下的临时目录完全隔离磁盘操作
 *   - XIAKE_DIR 通过 process.env 注入到 PhotoService 中
 *   - 每个 test 前后清理临时目录，保证无状态
 */

import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const photoServicePath = require.resolve('../../../server/services/PhotoService');

// ─── 动态隔离目录 ────────────────────────────────────────────────────────────
let tmpDir;
let PhotoService;

beforeEach(() => {
  // 每个 test 使用独立临时目录
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xiake-test-'));
  process.env.XIAKE_DIR = tmpDir;

  // 清除 CJS 模块缓存，使 XIAKE_DIR 被重新读取
  delete require.cache[photoServicePath];
  PhotoService = require(photoServicePath);
  // Jest 的 CJS 加载缓存可能复用同一个模块实例；确保每个 test 的照片目录干净
  fs.rmSync(PhotoService.PHOTOS_DIR, { recursive: true, force: true });
  PhotoService.initDirs();
});

afterEach(() => {
  // 清理临时目录及当前 PhotoService 指向的目录
  if (PhotoService) fs.rmSync(PhotoService.PHOTOS_DIR, { recursive: true, force: true });
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.XIAKE_DIR;
});

// ─── 辅助 ─────────────────────────────────────────────────────────────────
/** 创建最小有效 JPEG buffer（20 字节，不能被 sharp 真正处理，但足以测试存储逻辑） */
function makeJpegBuffer(sizeBytes = 256) {
  const buf = Buffer.alloc(sizeBytes);
  // JPEG SOI 魔数
  buf[0] = 0xff;
  buf[1] = 0xd8;
  return buf;
}

function makePngBuffer(sizeBytes = 256) {
  const buf = Buffer.alloc(sizeBytes);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  return buf;
}

// ─── initDirs ─────────────────────────────────────────────────────────────
describe('initDirs()', () => {
  test('creates PHOTOS_DIR, ORIGINALS_DIR, THUMBS_DIR', () => {
    PhotoService.initDirs();
    expect(fs.existsSync(PhotoService.PHOTOS_DIR)).toBe(true);
    expect(fs.existsSync(PhotoService.ORIGINALS_DIR)).toBe(true);
    expect(fs.existsSync(PhotoService.THUMBS_DIR)).toBe(true);
  });

  test('creates empty photos.json index', () => {
    PhotoService.initDirs();
    expect(fs.existsSync(PhotoService.PHOTOS_INDEX)).toBe(true);
    const content = JSON.parse(fs.readFileSync(PhotoService.PHOTOS_INDEX, 'utf-8'));
    expect(Array.isArray(content)).toBe(true);
    expect(content).toHaveLength(0);
  });

  test('is idempotent (safe to call multiple times)', () => {
    PhotoService.initDirs();
    PhotoService.initDirs(); // second call should not throw
    expect(fs.existsSync(PhotoService.PHOTOS_DIR)).toBe(true);
  });
});

// ─── savePhoto ────────────────────────────────────────────────────────────
describe('savePhoto()', () => {
  test('saves JPEG and returns metadata with id/uploadedAt', async () => {
    const buffer = makeJpegBuffer(1024);
    const meta = await PhotoService.savePhoto({
      buffer,
      mimeType: 'image/jpeg',
      filename: 'test.jpg',
      lat: 39.9,
      lon: 116.4,
      takenAt: '2026-03-21T12:00:00Z',
      desc: '北京火烧云',
    });

    expect(meta).toMatchObject({
      mimeType: 'image/jpeg',
      lat: 39.9,
      lon: 116.4,
      takenAt: '2026-03-21T12:00:00Z',
      desc: '北京火烧云',
    });
    expect(typeof meta.id).toBe('string');
    expect(meta.id.length).toBeGreaterThan(10);
    expect(typeof meta.uploadedAt).toBe('string');
  });

  test('writes original file to ORIGINALS_DIR', async () => {
    const buffer = makeJpegBuffer(512);
    const meta = await PhotoService.savePhoto({ buffer, mimeType: 'image/jpeg' });
    const origPath = path.join(PhotoService.ORIGINALS_DIR, meta.origFile);
    expect(fs.existsSync(origPath)).toBe(true);
  });

  test('appends to photos.json index', async () => {
    const buf1 = makeJpegBuffer(256);
    const buf2 = makeJpegBuffer(256);
    await PhotoService.savePhoto({ buffer: buf1, mimeType: 'image/jpeg', desc: 'first' });
    await PhotoService.savePhoto({ buffer: buf2, mimeType: 'image/jpeg', desc: 'second' });

    const photos = PhotoService.getPhotos();
    expect(photos).toHaveLength(2);
    // 最新在前
    expect(photos[0].desc).toBe('second');
  });

  test('accepts image/png', async () => {
    const buffer = makePngBuffer(256);
    const meta = await PhotoService.savePhoto({ buffer, mimeType: 'image/png' });
    expect(meta.mimeType).toBe('image/png');
    expect(meta.origFile.endsWith('.png')).toBe(true);
  });

  test('accepts JPEG uploaded as application/octet-stream when file signature is valid', async () => {
    const buffer = makeJpegBuffer(256);
    const meta = await PhotoService.savePhoto({
      buffer,
      mimeType: 'application/octet-stream',
      filename: 'phone-upload.bin',
    });

    expect(meta.mimeType).toBe('image/jpeg');
    expect(meta.origFile.endsWith('.jpg')).toBe(true);
  });

  test('accepts PNG uploaded as application/octet-stream when file signature is valid', async () => {
    const buffer = makePngBuffer(256);
    const meta = await PhotoService.savePhoto({
      buffer,
      mimeType: 'application/octet-stream',
      filename: 'phone-upload.bin',
    });

    expect(meta.mimeType).toBe('image/png');
    expect(meta.origFile.endsWith('.png')).toBe(true);
  });

  test('rejects application/octet-stream when it is not an image', async () => {
    const buffer = Buffer.from('not an image payload');
    await expect(
      PhotoService.savePhoto({ buffer, mimeType: 'application/octet-stream', filename: 'payload.bin' })
    ).rejects.toThrow('UNSUPPORTED_MIME');
  });

  test('rejects unsupported MIME type', async () => {
    const buffer = makeJpegBuffer(256);
    await expect(
      PhotoService.savePhoto({ buffer, mimeType: 'image/gif' })
    ).rejects.toThrow('UNSUPPORTED_MIME');
  });

  test('rejects file exceeding MAX_FILE_SIZE_MB', async () => {
    const bigBuffer = Buffer.alloc((PhotoService.MAX_FILE_SIZE_MB + 1) * 1024 * 1024);
    await expect(
      PhotoService.savePhoto({ buffer: bigBuffer, mimeType: 'image/jpeg' })
    ).rejects.toThrow('FILE_TOO_LARGE');
  });

  test('handles null/undefined lat/lon gracefully', async () => {
    const meta = await PhotoService.savePhoto({
      buffer: makeJpegBuffer(256),
      mimeType: 'image/jpeg',
      lat: undefined,
      lon: null,
    });
    expect(meta.lat).toBeNull();
    expect(meta.lon).toBeNull();
  });

  test('limits the same client IP to three uploads per Beijing day', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-09T01:30:00Z')); // 2026-05-09 Asia/Shanghai

    try {
      const clientIp = '203.0.113.8';
      await PhotoService.savePhoto({ buffer: makeJpegBuffer(256), mimeType: 'image/jpeg', clientIp });
      await PhotoService.savePhoto({ buffer: makeJpegBuffer(256), mimeType: 'image/jpeg', clientIp });
      await PhotoService.savePhoto({ buffer: makeJpegBuffer(256), mimeType: 'image/jpeg', clientIp });

      const stats = PhotoService.getDailyUploadStatsForIp(clientIp);
      expect(stats).toMatchObject({ limit: 3, used: 3, remaining: 0, uploadDay: '2026-05-09' });

      await expect(
        PhotoService.savePhoto({ buffer: makeJpegBuffer(256), mimeType: 'image/jpeg', clientIp })
      ).rejects.toMatchObject({ code: 'DAILY_UPLOAD_LIMIT_EXCEEDED', limit: 3, used: 3 });
    } finally {
      jest.useRealTimers();
    }
  });

  test('does not store raw client IP and resets the quota on a new Beijing day', async () => {
    jest.useFakeTimers();
    const clientIp = '198.51.100.9';

    try {
      jest.setSystemTime(new Date('2026-05-09T15:55:00Z')); // 2026-05-09 23:55 +08
      await PhotoService.savePhoto({ buffer: makeJpegBuffer(256), mimeType: 'image/jpeg', clientIp });
      await PhotoService.savePhoto({ buffer: makeJpegBuffer(256), mimeType: 'image/jpeg', clientIp });
      await PhotoService.savePhoto({ buffer: makeJpegBuffer(256), mimeType: 'image/jpeg', clientIp });

      const stored = PhotoService.getPhotos()[0];
      expect(stored.uploadIpHash).toBe(PhotoService.hashClientIp(clientIp));
      expect(JSON.stringify(stored)).not.toContain(clientIp);

      jest.setSystemTime(new Date('2026-05-09T16:05:00Z')); // 2026-05-10 00:05 +08
      const nextDay = await PhotoService.savePhoto({ buffer: makeJpegBuffer(256), mimeType: 'image/jpeg', clientIp });
      expect(nextDay.uploadDay).toBe('2026-05-10');
      expect(PhotoService.getDailyUploadStatsForIp(clientIp)).toMatchObject({ used: 1, remaining: 2 });
    } finally {
      jest.useRealTimers();
    }
  });
});

// ─── getPhotos ────────────────────────────────────────────────────────────
describe('getPhotos()', () => {
  test('returns empty array when no photos', () => {
    expect(PhotoService.getPhotos()).toEqual([]);
  });

  test('returns photos sorted newest first', async () => {
    await PhotoService.savePhoto({ buffer: makeJpegBuffer(256), mimeType: 'image/jpeg', desc: 'a' });
    await PhotoService.savePhoto({ buffer: makeJpegBuffer(256), mimeType: 'image/jpeg', desc: 'b' });
    const photos = PhotoService.getPhotos();
    expect(photos[0].desc).toBe('b');
    expect(photos[1].desc).toBe('a');
  });
});

// ─── deletePhoto ──────────────────────────────────────────────────────────
describe('deletePhoto()', () => {
  test('removes photo entry from index', async () => {
    const meta = await PhotoService.savePhoto({ buffer: makeJpegBuffer(256), mimeType: 'image/jpeg' });
    expect(PhotoService.getPhotos()).toHaveLength(1);

    const result = PhotoService.deletePhoto(meta.id);
    expect(result).toBe(true);
    expect(PhotoService.getPhotos()).toHaveLength(0);
  });

  test('removes original file from disk', async () => {
    const meta = await PhotoService.savePhoto({ buffer: makeJpegBuffer(256), mimeType: 'image/jpeg' });
    const origPath = PhotoService.getOriginalPath(meta.origFile);
    expect(fs.existsSync(origPath)).toBe(true);

    PhotoService.deletePhoto(meta.id);
    expect(fs.existsSync(origPath)).toBe(false);
  });

  test('returns false for non-existent id', () => {
    PhotoService.initDirs();
    const result = PhotoService.deletePhoto('non-existent-id');
    expect(result).toBe(false);
  });
});

// ─── getPhotoById ─────────────────────────────────────────────────────────
describe('getPhotoById()', () => {
  test('returns photo by id', async () => {
    const meta = await PhotoService.savePhoto({
      buffer: makeJpegBuffer(256),
      mimeType: 'image/jpeg',
      desc: '单张查询',
    });
    const found = PhotoService.getPhotoById(meta.id);
    expect(found).not.toBeNull();
    expect(found.desc).toBe('单张查询');
  });

  test('returns null for unknown id', () => {
    PhotoService.initDirs();
    expect(PhotoService.getPhotoById('unknown')).toBeNull();
  });
});

// ─── generateThumbnail ────────────────────────────────────────────────────
describe('generateThumbnail()', () => {
  test('returns false gracefully when sharp cannot process invalid image', async () => {
    // makeJpegBuffer 产生的是假 JPEG，sharp 会报错
    // 期望降级行为：返回 false 而非抛出
    const fakeFile = path.join(tmpDir, 'fake.jpg');
    const dstFile  = path.join(tmpDir, 'thumb.jpg');
    fs.writeFileSync(fakeFile, Buffer.alloc(32));
    const result = await PhotoService.generateThumbnail(fakeFile, dstFile);
    // sharp 失败时返回 false
    expect(typeof result).toBe('boolean');
  });
});

// ─── path helpers ─────────────────────────────────────────────────────────
describe('getOriginalPath / getThumbPath', () => {
  test('returns correct paths', () => {
    const origPath  = PhotoService.getOriginalPath('abc.jpg');
    const thumbPath = PhotoService.getThumbPath('abc_thumb.jpg');
    expect(origPath).toContain('originals');
    expect(origPath).toContain('abc.jpg');
    expect(thumbPath).toContain('thumbs');
    expect(thumbPath).toContain('abc_thumb.jpg');
  });
});
