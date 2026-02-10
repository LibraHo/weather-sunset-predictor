/**
 * NotificationService - 浏览器通知服务
 * 
 * 负责管理浏览器通知功能，包括权限请求、通知发送和预测提醒
 * 
 * 需求：12.6, 12.7, 12.8 - 预测提醒功能
 */

import toastService from './ToastService.js';

class NotificationService {
  constructor(storageService) {
    this.storageService = storageService;
    this.isSupported = 'Notification' in window;
  }

  /**
   * 检查浏览器是否支持通知
   * 
   * @returns {boolean} 是否支持通知
   */
  isNotificationSupported() {
    return this.isSupported;
  }

  /**
   * 请求通知权限
   * 
   * @returns {Promise<string>} 权限状态：'granted', 'denied', 或 'default'
   * 
   * 需求：12.6 - 提供预测提醒功能
   */
  async requestPermission() {
    if (!this.isSupported) {
      console.warn('[NotificationService] 浏览器不支持通知功能');
      return 'denied';
    }

    try {
      const permission = await Notification.requestPermission();
      console.log(`[NotificationService] 通知权限状态: ${permission}`);
      return permission;
    } catch (error) {
      console.error('[NotificationService] 请求通知权限失败:', error);
      return 'denied';
    }
  }

  /**
   * 获取当前通知权限状态
   * 
   * @returns {string} 权限状态：'granted', 'denied', 或 'default'
   */
  getPermissionStatus() {
    if (!this.isSupported) {
      return 'denied';
    }
    return Notification.permission;
  }

  /**
   * 发送通知
   * 
   * @param {string} title - 通知标题
   * @param {Object} options - 通知选项
   * @returns {Notification|null} 通知对象，如果失败则返回null
   * 
   * 需求：12.8 - 发送浏览器通知
   */
  sendNotification(title, options = {}) {
    if (!this.isSupported) {
      console.warn('[NotificationService] 浏览器不支持通知功能');
      return null;
    }

    if (Notification.permission !== 'granted') {
      console.warn('[NotificationService] 没有通知权限');
      return null;
    }

    try {
      const notification = new Notification(title, {
        icon: '/icon.png',
        badge: '/badge.png',
        ...options
      });

      // 点击通知时聚焦窗口
      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      console.log('[NotificationService] 通知已发送:', title);
      return notification;
    } catch (error) {
      console.error('[NotificationService] 发送通知失败:', error);
      return null;
    }
  }

  /**
   * 检查预测并发送通知
   * 
   * @param {SunsetPrediction[]} predictions - 预测数组
   * 
   * 需求：12.7 - 允许用户自定义提醒阈值
   * 需求：12.8 - 在符合条件时发送通知
   */
  checkPredictionAndNotify(predictions) {
    if (!predictions || predictions.length === 0) {
      return;
    }

    // 获取通知设置
    const settings = this.storageService.getNotificationSettings();
    
    if (!settings.enabled) {
      console.log('[NotificationService] 通知功能未启用');
      return;
    }

    if (Notification.permission !== 'granted') {
      console.warn('[NotificationService] 没有通知权限');
      return;
    }

    // 检查每个预测
    predictions.forEach(prediction => {
      if (prediction.score >= settings.threshold) {
        this._sendPredictionNotification(prediction);
      }
    });
  }

  /**
   * 发送预测通知（内部方法）
   * 
   * @param {SunsetPrediction} prediction - 预测对象
   * @private
   */
  _sendPredictionNotification(prediction) {
    const typeLabel = prediction.getTypeLabel();
    const qualityLabel = prediction.getQualityLabel();
    const dateStr = prediction.date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric'
    });

    const title = `${typeLabel}预测提醒`;
    const body = `${dateStr} ${typeLabel}质量：${qualityLabel}（评分：${prediction.score}）`;

    const options = {
      body: body,
      tag: `prediction-${prediction.type}-${prediction.date.getTime()}`,
      requireInteraction: false,
      silent: false
    };

    this.sendNotification(title, options);
  }

  /**
   * 为特定预测发送自定义通知
   * 
   * @param {SunsetPrediction} prediction - 预测对象
   * @param {string} customMessage - 自定义消息（可选）
   */
  notifyForPrediction(prediction, customMessage = null) {
    if (!this.isSupported || Notification.permission !== 'granted') {
      return;
    }

    const typeLabel = prediction.getTypeLabel();
    const title = `${typeLabel}预测`;
    
    let body = customMessage;
    if (!body) {
      const qualityLabel = prediction.getQualityLabel();
      const timeStr = prediction.type === 'sunrise' 
        ? prediction.sunriseTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        : prediction.sunsetTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      
      body = `质量：${qualityLabel}（${prediction.score}分）\n时间：${timeStr}`;
      
      // 如果有黄金时段信息，添加到通知中
      if (prediction.goldenHour) {
        const goldenStart = prediction.goldenHour.start.toLocaleTimeString('zh-CN', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        const goldenEnd = prediction.goldenHour.end.toLocaleTimeString('zh-CN', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        body += `\n黄金时段：${goldenStart} - ${goldenEnd}`;
      }
    }

    this.sendNotification(title, { body });
  }

  /**
   * 测试通知功能
   * 
   * @returns {boolean} 是否成功发送测试通知
   */
  async testNotification() {
    if (!this.isSupported) {
      toastService.show('您的浏览器不支持通知功能', 'warning', 4000);
      return false;
    }

    if (Notification.permission === 'denied') {
      toastService.show('通知权限已被拒绝，请在浏览器设置中允许通知', 'warning', 5000);
      return false;
    }

    if (Notification.permission === 'default') {
      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        return false;
      }
    }

    this.sendNotification('测试通知', {
      body: '通知功能正常工作！',
      tag: 'test-notification'
    });

    return true;
  }
}

export default NotificationService;
