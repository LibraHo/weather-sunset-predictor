import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import FeedbackController from '../../../src/controllers/FeedbackController.js';

describe('FeedbackController', () => {
  afterEach(() => {
    jest.useRealTimers();
    document.body.innerHTML = '';
  });

  test('closed feedback window shows a visible toast instead of silent no-op', () => {
    jest.useFakeTimers();
    document.body.innerHTML = '<div id="feedback-modal" class="hidden"></div>';
    const controller = new FeedbackController();

    controller.openPredictionFeedback({
      type: 'sunset',
      sunsetTime: '2026-01-01T10:00:00Z'
    }, 'sunset');

    const toast = document.querySelector('.feedback-toast.error');
    expect(toast).toBeTruthy();
    expect(toast.classList.contains('show')).toBe(false);

    jest.advanceTimersByTime(20);
    expect(toast.classList.contains('show')).toBe(true);
    expect(document.getElementById('feedback-modal').classList.contains('hidden')).toBe(true);

    jest.advanceTimersByTime(3600);
    expect(document.querySelector('.feedback-toast')).toBeNull();
  });

  test('feedback toast can wrap on narrow screens', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'styles/share-panel.css'), 'utf8');

    expect(css).toMatch(/\.feedback-toast\s*\{[\s\S]*?max-width:\s*calc\(100vw - 32px\);/);
    expect(css).toMatch(/\.feedback-toast\s*\{[\s\S]*?white-space:\s*normal;/);
  });
});
