import { jest } from '@jest/globals';
import { configureApi, resetApiConfig, setWxInstance } from '../../../miniprogram/services/api.js';
import { clearSession, saveSession } from '../../../miniprogram/services/auth.js';
import { buildPhotoUploadFormData, listPhotos, normalizePhoto, uploadPhoto } from '../../../miniprogram/services/photos.js';

describe('miniprogram services/photos', () => {
  afterEach(() => {
    clearSession();
    resetApiConfig();
    setWxInstance(null);
    jest.restoreAllMocks();
  });

  test('listPhotos calls backend and returns normalized photos', async () => {
    const wxMock = {
      request: jest.fn(({ success }) => success({
        statusCode: 200,
        data: {
          success: true,
          data: {
            photos: [
              {
                photoId: 'p1',
                latitude: '39.9042',
                longitude: '116.4074',
                location_name: 'Beijing',
                uploader: { nickName: 'Alex' },
                taken_at: '2026-05-01T10:00:00Z',
                uploaded_at: '2026-05-01T11:00:00Z',
                description: 'sunset',
                thumbnailUrl: '/thumb/p1.jpg',
                imageUrl: '/photo/p1.jpg'
              }
            ]
          }
        }
      }))
    };
    setWxInstance(wxMock);
    configureApi({ baseUrl: 'https://api.example.com' });

    await expect(listPhotos({ params: { locationId: 'loc-1' } })).resolves.toEqual([
      {
        id: 'p1',
        lat: 39.9042,
        lon: 116.4074,
        locationName: 'Beijing',
        uploaderName: 'Alex',
        takenAt: '2026-05-01T10:00:00Z',
        uploadedAt: '2026-05-01T11:00:00Z',
        desc: 'sunset',
        thumbUrl: 'https://api.example.com/thumb/p1.jpg',
        originalUrl: 'https://api.example.com/photo/p1.jpg'
      }
    ]);
    expect(wxMock.request.mock.calls[0][0]).toEqual(expect.objectContaining({
      url: 'https://api.example.com/api/photos?locationId=loc-1',
      method: 'GET'
    }));
  });

  test('buildPhotoUploadFormData keeps expected upload fields as strings', () => {
    expect(buildPhotoUploadFormData({
      locationName: 'Paris',
      uploaderName: 'Alex',
      takenAt: '2026-05-02T12:00:00Z',
      lat: 48.8566,
      lon: 2.3522,
      desc: 'blue hour',
      ignored: 'x'
    })).toEqual({
      locationName: 'Paris',
      uploaderName: 'Alex',
      takenAt: '2026-05-02T12:00:00Z',
      lat: '48.8566',
      lon: '2.3522',
      desc: 'blue hour'
    });
  });

  test('normalizePhoto derives web-compatible photo URLs from backend id', () => {
    expect(normalizePhoto({
      id: 'photo-42',
      latitude: '30.1',
      longitude: '120.2',
      thumbFile: 'thumb.jpg'
    }, { baseUrl: 'https://api.example.com' })).toMatchObject({
      id: 'photo-42',
      lat: 30.1,
      lon: 120.2,
      thumbUrl: 'https://api.example.com/api/photos/photo-42/thumb',
      originalUrl: 'https://api.example.com/api/photos/photo-42/original'
    });
  });

  test('normalizePhoto expands relative thumbnail fields for mini program image loading', () => {
    expect(normalizePhoto({
      id: 'photo-43',
      thumbnail: '/uploads/thumbs/photo-43.jpg',
      coverUrl: '/uploads/covers/photo-43.jpg',
      imageUrl: '/uploads/original/photo-43.jpg'
    }, { baseUrl: 'https://api.example.com' })).toMatchObject({
      thumbUrl: 'https://api.example.com/uploads/thumbs/photo-43.jpg',
      originalUrl: 'https://api.example.com/uploads/original/photo-43.jpg'
    });
  });

  test('uploadPhoto sends form data with X-Session-Token and parses success response', async () => {
    const wxMock = {
      uploadFile: jest.fn(({ success }) => success({
        statusCode: 201,
        data: JSON.stringify({
          success: true,
          data: {
            photo: {
              id: 'p2',
              lat: 31.2304,
              lon: 121.4737,
              locationName: 'Shanghai',
              uploaderName: 'Alex',
              takenAt: '2026-05-03T10:00:00Z',
              uploadedAt: '2026-05-03T10:01:00Z',
              desc: 'clouds',
              thumbUrl: '/thumb/p2.jpg',
              originalUrl: '/photo/p2.jpg'
            }
          }
        })
      })),
      getStorageSync: jest.fn(),
      setStorageSync: jest.fn(),
      removeStorageSync: jest.fn()
    };
    configureApi({ baseUrl: 'https://api.example.com', timeout: 12000 });
    saveSession({ sessionToken: 'session-1' }, { wx: wxMock });

    await expect(uploadPhoto({
      filePath: '/tmp/photo.jpg',
      locationName: 'Shanghai',
      uploaderName: 'Alex',
      takenAt: '2026-05-03T10:00:00Z',
      lat: 31.2304,
      lon: 121.4737,
      desc: 'clouds'
    }, { wx: wxMock })).resolves.toEqual({
      id: 'p2',
      lat: 31.2304,
      lon: 121.4737,
      locationName: 'Shanghai',
      uploaderName: 'Alex',
      takenAt: '2026-05-03T10:00:00Z',
      uploadedAt: '2026-05-03T10:01:00Z',
      desc: 'clouds',
      thumbUrl: 'https://api.example.com/thumb/p2.jpg',
      originalUrl: 'https://api.example.com/photo/p2.jpg'
    });

    expect(wxMock.uploadFile).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://api.example.com/api/photos/upload',
      filePath: '/tmp/photo.jpg',
      name: 'photo',
      formData: {
        locationName: 'Shanghai',
        uploaderName: 'Alex',
        takenAt: '2026-05-03T10:00:00Z',
        lat: '31.2304',
        lon: '121.4737',
        desc: 'clouds'
      },
      header: { 'X-Session-Token': 'session-1' },
      timeout: 12000
    }));
  });

  test('uploadPhoto supports Authorization Bearer token', async () => {
    const wxMock = {
      uploadFile: jest.fn(({ success }) => success({
        statusCode: 200,
        data: JSON.stringify({ id: 'p3', lat: '1', lon: '2' })
      }))
    };

    await uploadPhoto({ filePath: '/tmp/photo.jpg' }, {
      wx: wxMock,
      baseUrl: 'https://api.example.com',
      authorizationToken: 'bearer-token-1'
    });

    expect(wxMock.uploadFile.mock.calls[0][0].header).toEqual({
      Authorization: 'Bearer bearer-token-1'
    });
  });

  test('uploadPhoto wires upload progress callback when wx returns an upload task', async () => {
    const onProgress = jest.fn();
    const uploadTask = { onProgressUpdate: jest.fn((handler) => handler({ progress: 42 })) };
    const wxMock = {
      uploadFile: jest.fn(({ success }) => {
        success({
          statusCode: 200,
          data: JSON.stringify({ id: 'p4', lat: '1', lon: '2' })
        });
        return uploadTask;
      })
    };

    await uploadPhoto({ filePath: '/tmp/photo.jpg' }, {
      wx: wxMock,
      baseUrl: 'https://api.example.com',
      token: 'session-4',
      onProgress
    });

    expect(uploadTask.onProgressUpdate).toHaveBeenCalledWith(onProgress);
    expect(onProgress).toHaveBeenCalledWith({ progress: 42 });
  });

  test('uploadPhoto rejects standardized server errors', async () => {
    const wxMock = {
      uploadFile: jest.fn(({ success }) => success({
        statusCode: 413,
        data: JSON.stringify({ error: { code: 'PHOTO_TOO_LARGE', message: '照片太大' } })
      })),
      getStorageSync: jest.fn(),
      removeStorageSync: jest.fn()
    };

    await expect(uploadPhoto({ filePath: '/tmp/large.jpg' }, {
      wx: wxMock,
      token: 'session-2',
      autoLogin: false
    })).rejects.toMatchObject({
      name: 'ApiError',
      code: 'PHOTO_TOO_LARGE',
      message: '照片太大',
      status: 413,
      isApiError: true
    });
  });

  test('uploadPhoto rejects when wx.uploadFile is unavailable', async () => {
    await expect(uploadPhoto({ filePath: '/tmp/photo.jpg' }, { wx: {} })).rejects.toMatchObject({
      name: 'ApiError',
      code: 'WX_UNAVAILABLE',
      isApiError: true
    });
  });
});
