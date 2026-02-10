import { jest } from '@jest/globals';
import toastService from '../../../src/services/ToastService.js';

describe('ToastService', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    document.body.innerHTML = '';
  });

  test('should show different toast types', () => {
    const types = ['success', 'error', 'warning', 'info'];

    types.forEach((type) => {
      toastService.show(`message-${type}`, type, 0);
    });

    const toasts = document.querySelectorAll('.toast');
    expect(toasts).toHaveLength(4);
    expect(document.querySelector('.toast-success')).not.toBeNull();
    expect(document.querySelector('.toast-error')).not.toBeNull();
    expect(document.querySelector('.toast-warning')).not.toBeNull();
    expect(document.querySelector('.toast-info')).not.toBeNull();
  });

  test('should auto dismiss after duration', () => {
    toastService.show('auto close', 'info', 1000);
    expect(document.querySelectorAll('.toast')).toHaveLength(1);

    jest.advanceTimersByTime(1001);
    expect(document.querySelectorAll('.toast')).toHaveLength(0);
  });

  test('should close manually by close button', () => {
    toastService.show('manual close', 'success', 10000);
    const closeBtn = document.querySelector('.toast-close');
    closeBtn.click();

    expect(document.querySelectorAll('.toast')).toHaveLength(0);
  });

  test('should queue multiple toasts', () => {
    toastService.show('first', 'info', 0);
    toastService.show('second', 'success', 0);
    toastService.show('third', 'error', 0);

    const messages = Array.from(document.querySelectorAll('.toast-message')).map((el) => el.textContent);
    expect(messages).toEqual(['first', 'second', 'third']);
  });
});
