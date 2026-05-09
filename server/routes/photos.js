/**
 * server/routes/photos.js - 照片 API 路由
 *
 * 提供公开的照片查询接口：
 * - GET /api/photos - 返回照片列表
 * - GET /api/photos/:id/thumb - 返回缩略图
 * - GET /api/photos/:id/original - 返回原图
 */

'use strict';

const express = require('express');
const router = express.Router();
const photoService = require('../services/PhotoService');

// ---------------------------------------------------------------------------
// GET /api/photos
// 返回所有照片的元数据（不含原图，含缩略图 URL）
// ---------------------------------------------------------------------------
router.get('/', (req, res) => {
  try {
    const photos = photoService.getPhotos();

    // 为每张照片生成缩略图 URL；内部限额字段不对外暴露
    const withThumbUrls = photos.map(({ uploadIpHash, uploadDay, ...p }) => ({
      ...p,
      thumbUrl: p.thumbFile ? `/api/photos/${p.id}/thumb` : null
    }));

    res.json({ photos: withThumbUrls });
  } catch (err) {
    console.error('[PhotosRoutes] GET /api/photos error:', err);
    res.status(500).json({
      error: {
        code: 'PHOTOS_FETCH_FAILED',
        message: '获取照片列表失败'
      }
    });
  }
});

// ---------------------------------------------------------------------------
// GET /api/photos/:id/thumb
// 返回指定照片的缩略图文件
// ---------------------------------------------------------------------------
router.get('/:id/thumb', (req, res) => {
  try {
    const { id } = req.params;
    const photo = photoService.getPhotoById(id);

    if (!photo) {
      return res.status(404).json({
        error: {
          code: 'PHOTO_NOT_FOUND',
          message: '照片不存在'
        }
      });
    }

    if (!photo.thumbFile) {
      return res.status(404).json({
        error: {
          code: 'THUMB_NOT_AVAILABLE',
          message: '缩略图不可用'
        }
      });
    }

    const thumbPath = photoService.getThumbPath(photo.thumbFile);
    res.sendFile(thumbPath);
  } catch (err) {
    console.error('[PhotosRoutes] GET /api/photos/:id/thumb error:', err);
    res.status(500).json({
      error: {
        code: 'THUMB_FETCH_FAILED',
        message: '获取缩略图失败'
      }
    });
  }
});

// ---------------------------------------------------------------------------
// GET /api/photos/:id/original
// 返回指定照片的原图文件
// ---------------------------------------------------------------------------
router.get('/:id/original', (req, res) => {
  try {
    const { id } = req.params;
    const photo = photoService.getPhotoById(id);

    if (!photo) {
      return res.status(404).json({
        error: {
          code: 'PHOTO_NOT_FOUND',
          message: '照片不存在'
        }
      });
    }

    const originalPath = photoService.getOriginalPath(photo.origFile);
    res.sendFile(originalPath);
  } catch (err) {
    console.error('[PhotosRoutes] GET /api/photos/:id/original error:', err);
    res.status(500).json({
      error: {
        code: 'ORIGINAL_FETCH_FAILED',
        message: '获取原图失败'
      }
    });
  }
});

module.exports = router;
