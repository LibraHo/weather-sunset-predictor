/**
 * NotificationService 单元测试
 *
 * 覆盖权限请求、通知发送、预测检查、testNotification 等所有分支
 * 需求：12.6, 12.7, 12.8（预测提醒）、23.13（原生 API mock）
 */

import { jest } from '@jest/globals';
import NotificationService from '@services/NotificationService.js';
import toastService from '@services/ToastService.js';

// ---- 辅助工厂 ----

function makeMockStorageService(overrides = {}) {
  return {
    getNotificationSettings: jest.fn().mockReturnValue({ enabled: true, threshold: 70 }),
    ...overrides
  };
}

function makeMockPrediction(overrides = {}) {
  return {
    score: 80,
    type: 'sunset',
    date: new Date('2026-01-01T18:00:00'),
    sunsetTime: new Date('2026-01-01T18:00:00'),
    sunriseTime: new Date('2026-01-01T06:00:00'),
    goldenHour: null,
    getTypeLabel: jest.fn().mockReturnValue('晚霞'),
    getQualityLabel: jest.fn().mockReturnValue('优秀'),
    ...overrides
  };
}

// ---- 配置 Notification mock ----

function setupNotificationSupported(permission = 'granted') {
  const NotificationMock = jest.fn().mockImplementation(() => ({
    onclick: null,
    close: jest.fn()
  }));
  NotificationMock.permission = permission;
  NotificationMock.requestPermission = jest.fn().mockResolvedValue(permission);
  Object.defineProperty(window, 'Notification', {
    value: NotificationMock,
    writable: true,
    configurable: true
  });
  return NotificationMock;
}

function removeNotification() {
  delete window.Notification;
}

// ---- 测试 ----

describe('NotificationService - 初始化', () => {
  test('浏览器支持 Notification 时 isSupported = true', () => {
    setupNotificationSupported();
    const service = new NotificationService(makeMockStorageService());
    expect(service.isNotificationSupported()).toBe(true);
  });

  test('浏览器不支持 Notification 时 isSupported = false', () => {
    removeNotification();
    const service = new NotificationService(makeMockStorageService());
    expect(service.isNotificationSupported()).toBe(false);
    setupNotificationSupported(); // 恢复
  });
});

describe('NotificationService.requestPermission', () => {
  test('不支持通知时返回 "denied"', async () => {
    removeNotification();
    const service = new NotificationService(makeMockStorageService());
    const result = await service.requestPermission();
    expect(result).toBe('denied');
    setupNotificationSupported();
  });

  test('支持通知且用户授权时返回 "granted"', async () => {
    const mock = setupNotificationSupported('granted');
    mock.requestPermission = jest.fn().mockResolvedValue('granted');
    const service = new NotificationService(makeMockStorageService());
    const result = await service.requestPermission();
    expect(result).toBe('granted');
  });

  test('用户拒绝时返回 "denied"', async () => {
    const mock = setupNotificationSupported('denied');
    mock.requestPermission = jest.fn().mockResolvedValue('denied');
    const service = new NotificationService(makeMockStorageService());
    const result = await service.requestPermission();
    expect(result).toBe('denied');
  });

  test('requestPermission 抛出异常时返回 "denied"', async () => {
    const mock = setupNotificationSupported();
    mock.requestPermission = jest.fn().mockRejectedValue(new Error('Permission API error'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const service = new NotificationService(makeMockStorageService());
    const result = await service.requestPermission();
    expect(result).toBe('denied');
    consoleSpy.mockRestore();
  });
});

describe('NotificationService.getPermissionStatus', () => {
  test('不支持通知时返回 "denied"', () => {
    removeNotification();
    const service = new NotificationService(makeMockStorageService());
    expect(service.getPermissionStatus()).toBe('denied');
    setupNotificationSupported();
  });

  test('支持通知时返回 Notification.permission', () => {
    const mock = setupNotificationSupported('granted');
    const service = new NotificationService(makeMockStorageService());
    expect(service.getPermissionStatus()).toBe('granted');
  });

  test('权限为 default 时返回 "default"', () => {
    const mock = setupNotificationSupported('default');
    const service = new NotificationService(makeMockStorageService());
    expect(service.getPermissionStatus()).toBe('default');
  });
});

describe('NotificationService.sendNotification', () => {
  test('不支持通知时返回 null', () => {
    removeNotification();
    const service = new NotificationService(makeMockStorageService());
    expect(service.sendNotification('Test')).toBeNull();
    setupNotificationSupported();
  });

  test('权限不是 granted 时返回 null', () => {
    const mock = setupNotificationSupported('default');
    const service = new NotificationService(makeMockStorageService());
    expect(service.sendNotification('Test')).toBeNull();
  });

  test('权限 granted 时创建 Notification 并返回对象', () => {
    const mock = setupNotificationSupported('granted');
    const fakeNotif = { onclick: null, close: jest.fn() };
    mock.mockReturnValue(fakeNotif);

    const service = new NotificationService(makeMockStorageService());
    const result = service.sendNotification('晚霞提醒', { body: '质量优秀' });

    expect(mock).toHaveBeenCalledWith('晚霞提醒', expect.objectContaining({ body: '质量优秀' }));
    expect(result).toBe(fakeNotif);
  });

  test('onclick 回调聚焦窗口并关闭通知', () => {
    const mock = setupNotificationSupported('granted');
    let onclickFn = null;
    const fakeNotif = {
      set onclick(fn) { onclickFn = fn; },
      get onclick() { return onclickFn; },
      close: jest.fn()
    };
    mock.mockReturnValue(fakeNotif);
    const focusSpy = jest.spyOn(window, 'focus').mockImplementation();

    const service = new NotificationService(makeMockStorageService());
    service.sendNotification('Test');

    fakeNotif.onclick();

    expect(focusSpy).toHaveBeenCalled();
    expect(fakeNotif.close).toHaveBeenCalled();
    focusSpy.mockRestore();
  });

  test('Notification 构造函数抛出异常时返回 null', () => {
    const mock = setupNotificationSupported('granted');
    mock.mockImplementation(() => { throw new Error('Notification error'); });
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const service = new NotificationService(makeMockStorageService());
    const result = service.sendNotification('Test');

    expect(result).toBeNull();
    consoleSpy.mockRestore();
  });
});

describe('NotificationService.checkPredictionAndNotify', () => {
  test('predictions 为空时直接返回，不发送通知', () => {
    const mock = setupNotificationSupported('granted');
    const service = new NotificationService(makeMockStorageService());
    const sendSpy = jest.spyOn(service, 'sendNotification');

    service.checkPredictionAndNotify([]);
    service.checkPredictionAndNotify(null);

    expect(sendSpy).not.toHaveBeenCalled();
  });

  test('通知功能未启用时不发送', () => {
    setupNotificationSupported('granted');
    const storage = makeMockStorageService({
      getNotificationSettings: jest.fn().mockReturnValue({ enabled: false, threshold: 70 })
    });
    const service = new NotificationService(storage);
    const sendSpy = jest.spyOn(service, 'sendNotification');

    service.checkPredictionAndNotify([makeMockPrediction({ score: 90 })]);

    expect(sendSpy).not.toHaveBeenCalled();
  });

  test('权限未 granted 时不发送', () => {
    const mock = setupNotificationSupported('default');
    const service = new NotificationService(makeMockStorageService());
    const sendSpy = jest.spyOn(service, 'sendNotification');

    service.checkPredictionAndNotify([makeMockPrediction({ score: 90 })]);

    expect(sendSpy).not.toHaveBeenCalled();
  });

  test('评分达到阈值时发送通知', () => {
    const mock = setupNotificationSupported('granted');
    const fakeNotif = { onclick: null, close: jest.fn() };
    mock.mockReturnValue(fakeNotif);

    const service = new NotificationService(makeMockStorageService({
      getNotificationSettings: jest.fn().mockReturnValue({ enabled: true, threshold: 70 })
    }));

    service.checkPredictionAndNotify([makeMockPrediction({ score: 80 })]);

    expect(mock).toHaveBeenCalled();
  });

  test('评分低于阈值时不发送', () => {
    setupNotificationSupported('granted');
    const service = new NotificationService(makeMockStorageService({
      getNotificationSettings: jest.fn().mockReturnValue({ enabled: true, threshold: 70 })
    }));
    const sendSpy = jest.spyOn(service, 'sendNotification');

    service.checkPredictionAndNotify([makeMockPrediction({ score: 50 })]);

    expect(sendSpy).not.toHaveBeenCalled();
  });

  test('多个预测中只有达标的被发送', () => {
    const mock = setupNotificationSupported('granted');
    const fakeNotif = { onclick: null, close: jest.fn() };
    mock.mockReturnValue(fakeNotif);

    const service = new NotificationService(makeMockStorageService({
      getNotificationSettings: jest.fn().mockReturnValue({ enabled: true, threshold: 70 })
    }));

    service.checkPredictionAndNotify([
      makeMockPrediction({ score: 80 }),
      makeMockPrediction({ score: 40 }),
      makeMockPrediction({ score: 90 })
    ]);

    // 只有 score 80 和 90 两条应触发
    expect(mock).toHaveBeenCalledTimes(2);
  });
});

describe('NotificationService.notifyForPrediction', () => {
  test('不支持通知时直接返回', () => {
    removeNotification();
    const service = new NotificationService(makeMockStorageService());
    const sendSpy = jest.spyOn(service, 'sendNotification');
    service.notifyForPrediction(makeMockPrediction());
    expect(sendSpy).not.toHaveBeenCalled();
    setupNotificationSupported();
  });

  test('权限非 granted 时直接返回', () => {
    setupNotificationSupported('default');
    const service = new NotificationService(makeMockStorageService());
    const sendSpy = jest.spyOn(service, 'sendNotification');
    service.notifyForPrediction(makeMockPrediction());
    expect(sendSpy).not.toHaveBeenCalled();
  });

  test('使用自定义消息时发送该消息', () => {
    const mock = setupNotificationSupported('granted');
    mock.mockReturnValue({ onclick: null, close: jest.fn() });
    const service = new NotificationService(makeMockStorageService());
    const sendSpy = jest.spyOn(service, 'sendNotification');

    service.notifyForPrediction(makeMockPrediction(), '自定义消息内容');

    expect(sendSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: '自定义消息内容' })
    );
  });

  test('无自定义消息时自动生成 body（含质量标签和评分）', () => {
    const mock = setupNotificationSupported('granted');
    mock.mockReturnValue({ onclick: null, close: jest.fn() });
    const service = new NotificationService(makeMockStorageService());
    const sendSpy = jest.spyOn(service, 'sendNotification');

    const prediction = makeMockPrediction({
      score: 85,
      type: 'sunset',
      getQualityLabel: jest.fn().mockReturnValue('优秀')
    });

    service.notifyForPrediction(prediction);

    expect(sendSpy).toHaveBeenCalled();
    const body = sendSpy.mock.calls[0][1].body;
    expect(body).toContain('优秀');
    expect(body).toContain('85');
  });

  test('预测包含 goldenHour 时 body 含黄金时段信息', () => {
    const mock = setupNotificationSupported('granted');
    mock.mockReturnValue({ onclick: null, close: jest.fn() });
    const service = new NotificationService(makeMockStorageService());
    const sendSpy = jest.spyOn(service, 'sendNotification');

    const prediction = makeMockPrediction({
      goldenHour: {
        start: new Date('2026-01-01T17:30:00'),
        end: new Date('2026-01-01T18:00:00')
      }
    });

    service.notifyForPrediction(prediction);

    const body = sendSpy.mock.calls[0][1].body;
    expect(body).toContain('黄金时段');
  });

  test('sunrise 类型使用 sunriseTime', () => {
    const mock = setupNotificationSupported('granted');
    mock.mockReturnValue({ onclick: null, close: jest.fn() });
    const service = new NotificationService(makeMockStorageService());
    const sendSpy = jest.spyOn(service, 'sendNotification');

    const prediction = makeMockPrediction({
      type: 'sunrise',
      getTypeLabel: jest.fn().mockReturnValue('朝霞')
    });

    service.notifyForPrediction(prediction);

    expect(sendSpy).toHaveBeenCalled();
  });
});

describe('NotificationService.testNotification', () => {
  let toastSpy;

  beforeEach(() => {
    toastSpy = jest.spyOn(toastService, 'show').mockImplementation(() => {});
  });

  afterEach(() => {
    toastSpy.mockRestore();
  });

  test('不支持通知时返回 false 并显示 toast', async () => {
    removeNotification();
    const service = new NotificationService(makeMockStorageService());

    const result = await service.testNotification();

    expect(result).toBe(false);
    expect(toastSpy).toHaveBeenCalledWith(
      expect.stringContaining('不支持'),
      'warning',
      expect.any(Number)
    );
    setupNotificationSupported();
  });

  test('权限被拒绝时返回 false 并显示 toast', async () => {
    setupNotificationSupported('denied');
    const service = new NotificationService(makeMockStorageService());

    const result = await service.testNotification();

    expect(result).toBe(false);
    expect(toastSpy).toHaveBeenCalledWith(
      expect.stringContaining('拒绝'),
      'warning',
      expect.any(Number)
    );
  });

  test('权限为 default 且用户授权后返回 true', async () => {
    const mock = setupNotificationSupported('default');
    mock.requestPermission = jest.fn().mockResolvedValue('granted');
    mock.mockReturnValue({ onclick: null, close: jest.fn() });
    // 授权后 permission 变为 granted
    Object.defineProperty(mock, 'permission', {
      get: jest.fn()
        .mockReturnValueOnce('default')
        .mockReturnValue('granted'),
      configurable: true
    });

    const service = new NotificationService(makeMockStorageService());
    jest.spyOn(service, 'requestPermission').mockResolvedValue('granted');
    jest.spyOn(service, 'sendNotification').mockReturnValue({});

    const result = await service.testNotification();

    expect(result).toBe(true);
  });

  test('权限为 default 且用户拒绝后返回 false', async () => {
    const mock = setupNotificationSupported('default');

    const service = new NotificationService(makeMockStorageService());
    jest.spyOn(service, 'requestPermission').mockResolvedValue('denied');

    const result = await service.testNotification();

    expect(result).toBe(false);
  });

  test('权限已 granted 时发送测试通知并返回 true', async () => {
    const mock = setupNotificationSupported('granted');
    mock.mockReturnValue({ onclick: null, close: jest.fn() });

    const service = new NotificationService(makeMockStorageService());
    const sendSpy = jest.spyOn(service, 'sendNotification').mockReturnValue({});

    const result = await service.testNotification();

    expect(result).toBe(true);
    expect(sendSpy).toHaveBeenCalledWith('测试通知', expect.objectContaining({ tag: 'test-notification' }));
  });
});
