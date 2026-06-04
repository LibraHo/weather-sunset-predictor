import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { jest } from '@jest/globals';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('web account surface source', () => {
  test('account button, modal, dropdown, and management panel exist outside the Home menu', () => {
    const html = read('index.html');
    const css = read('styles/main.css');
    const app = read('src/app.js');

    const menuHtml = html.slice(html.indexOf('id="home-view-menu-dropdown"'), html.indexOf('<div class="header-actions">'));
    expect(menuHtml).not.toContain('data-view="user"');
    expect(menuHtml).not.toContain('home.tabs.user');

    expect(html).toContain('id="account-menu-btn"');
    expect(html).toContain('id="account-auth-modal"');
    expect(html).toContain('data-auth-view="login"');
    expect(html).toContain('data-auth-view="register"');
    expect(html).toContain('data-auth-view="forgot"');
    expect(html).toContain('name="recoveryQuestion"');
    expect(html).toContain('name="recoveryAnswer"');
    expect(html).toContain('name="newPassword"');
    expect(html).toContain('id="account-login-google"');
    expect(html).not.toContain('id="account-login-wechat"');
    expect(html).toContain('id="account-dropdown"');
    expect(html).toContain('id="account-manage-btn"');
    expect(html).toContain('id="account-logout-btn"');
    expect(html).toContain('id="account-management-panel"');
    expect(html).toContain('id="account-management-favorites"');
    expect(html).toContain('id="account-management-uploads"');
    expect(html).toContain('id="account-management-api"');

    expect(css).toContain('.account-menu');
    expect(css).toContain('.account-dropdown');
    expect(css).toContain('.account-auth-modal');
    expect(css).toContain('.account-management-panel');

    expect(app).toContain("import UserPanelController from './controllers/UserPanelController.js'");
    expect(app).toContain('setupUserPanelController()');
    expect(app).toContain("credentials: 'include'");
  });

  test('web account controller talks to auth and user endpoints', () => {
    const source = read('src/controllers/UserPanelController.js');

    expect(source).toContain("fetch('/auth/me'");
    expect(source).toContain("submitAuth('/auth/login'");
    expect(source).toContain("submitAuth('/auth/register'");
    expect(source).toContain("submitAuth('/auth/password/reset'");
    expect(source).toContain("window.location.href = '/auth/google/start'");
    expect(source).not.toContain("window.location.href = '/auth/wechat/web/start'");
    expect(source).toContain("fetch('/auth/logout'");
    expect(source).toContain("fetch('/api/user/favorites'");
    expect(source).toContain("fetch('/api/applications/me'");
    expect(source).toContain('getFavoriteLocations()');
    expect(source).toContain('getSearchHistory()');
    expect(source).toContain('syncLocalFavoritesToAccount()');
  });

  test('favorite popover uses responsive anchored structure classes', () => {
    const html = read('index.html');
    const css = read('styles/main.css');

    expect(html).toContain('class="favorite-dropdown-wrapper"');
    expect(html).toContain('class="favorite-popover-panel"');
    expect(html).toContain('class="favorite-list-scroll"');
    expect(html).toContain('class="favorite-list"');
    expect(css).toContain('.favorite-popover-panel');
    expect(css).toContain('.favorite-list-scroll');
    expect(css).toContain('overflow-wrap: anywhere');
    expect(css).toContain('@media (max-width: 640px)');
  });
});

describe('UserPanelController behavior', () => {
  let UserPanelController;

  beforeEach(async () => {
    jest.resetModules();
    document.body.innerHTML = `
      <section id="tab-panel-user">
        <button id="account-menu-btn"></button>
        <div id="account-dropdown" class="hidden"></div>
        <button id="account-manage-btn"></button>
        <button id="account-logout-btn"></button>
        <div id="account-auth-modal" class="hidden">
          <button id="account-auth-close"></button>
          <button data-auth-view="login"></button>
          <button data-auth-view="register"></button>
          <button data-auth-view="forgot"></button>
          <form id="account-login-form">
            <input name="email">
            <input name="password">
          </form>
          <form id="account-register-form" class="hidden">
            <input name="email">
            <input name="password">
            <input name="recoveryQuestion">
            <input name="recoveryAnswer">
          </form>
          <form id="account-forgot-form" class="hidden">
            <input id="account-forgot-email" name="email">
            <p id="account-recovery-question"></p>
            <input name="recoveryAnswer">
            <input name="newPassword">
          </form>
          <button id="account-login-google"></button>
        </div>
        <section id="account-management-panel" class="hidden"></section>
        <span id="user-status-label"></span>
        <h2 id="user-display-name"></h2>
        <p id="user-identity-summary"></p>
        <div id="user-signed-out-actions"></div>
        <div id="user-error" class="hidden"></div>
        <ul id="user-favorites-list"></ul>
        <span id="user-uploads-count"></span>
        <ul id="user-uploads-list"></ul>
        <span id="user-api-count"></span>
        <ul id="user-recent-list"></ul>
      </section>
    `;
    ({ default: UserPanelController } = await import('../../src/controllers/UserPanelController.js'));
  });

  afterEach(() => {
    delete global.fetch;
  });

  test('renders signed-out state with local favorites and history fallback', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });
    const storageService = {
      getFavoriteLocations: jest.fn(() => [{ name: 'Beijing', lat: 39.9042, lon: 116.4074 }]),
      getSearchHistory: jest.fn(() => [{ name: 'Shanghai', lat: 31.2304, lon: 121.4737 }])
    };
    const controller = new UserPanelController({ documentRef: document, storageService });

    await controller.initialize();

    expect(document.getElementById('user-favorites-list').textContent).toContain('Beijing');
    expect(document.getElementById('user-uploads-list').textContent).toContain('Sign in to view your uploaded photos.');
    expect(document.getElementById('user-recent-list').textContent).toContain('Sign in to view account API applications.');
    expect(storageService.getFavoriteLocations).toHaveBeenCalled();
  });

  test('renders signed-in state and loads cloud lists', async () => {
    global.fetch = jest.fn((url) => {
      if (url === '/auth/me') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ user: { userId: 'user-abcdef', identities: [{ provider: 'google' }] } }) });
      }
      if (url === '/api/user/favorites') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ favorites: [{ name: 'Temple', lat: 39.882, lon: 116.406 }] }) });
      }
      if (url === '/api/user/recent-locations') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ recentLocations: [{ locationName: 'Fragrant Hills', lat: 39.99, lon: 116.18 }] }) });
      }
      if (url === '/api/photos/mine') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ photos: [{ locationName: 'Jingshan', status: 'approved', uploadedAt: '2026-06-04T12:00:00.000Z' }] })
        });
      }
      if (url === '/api/applications/me') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ application: { email: 'api@example.com', status: 'pending', purpose: 'research' } })
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });
    const controller = new UserPanelController({ documentRef: document, storageService: {} });

    await controller.initialize();

    expect(document.getElementById('user-display-name').textContent).toBe('Sunset user abcdef');
    expect(document.getElementById('user-identity-summary').textContent).toContain('Google connected');
    expect(document.getElementById('user-favorites-list').textContent).toContain('Temple');
    expect(document.getElementById('user-uploads-list').textContent).toContain('Jingshan');
    expect(document.getElementById('user-uploads-count').textContent).toBe('1');
    expect(document.getElementById('user-recent-list').textContent).toContain('api@example.com');
    expect(document.getElementById('user-api-count').textContent).toBe('1');
  });

  test('login action uses the injected window reference', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });
    const windowRef = { location: { href: '' } };
    const controller = new UserPanelController({ documentRef: document, storageService: {}, windowRef });

    await controller.initialize();
    document.getElementById('account-login-google').click();
    expect(windowRef.location.href).toBe('/auth/google/start');
  });

  test('account button opens auth modal when signed out and dropdown when signed in', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });
    const controller = new UserPanelController({ documentRef: document, storageService: {} });

    await controller.initialize();
    document.getElementById('account-menu-btn').click();
    expect(document.getElementById('account-auth-modal').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('account-dropdown').classList.contains('hidden')).toBe(true);

    controller.currentUser = { userId: 'user-123456' };
    controller.renderSession(controller.currentUser);
    document.getElementById('account-menu-btn').click();
    expect(document.getElementById('account-dropdown').classList.contains('hidden')).toBe(false);
  });

  test('email login form calls auth endpoint and refreshes session', async () => {
    global.fetch = jest.fn((url) => {
      if (url === '/auth/me') return Promise.resolve({ ok: false, status: 401 });
      if (url === '/auth/login') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ user: { userId: 'user-login' } }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ favorites: [] }) });
    });
    const controller = new UserPanelController({ documentRef: document, storageService: {} });
    await controller.initialize();
    document.querySelector('#account-login-form [name="email"]').value = 'login@example.com';
    document.querySelector('#account-login-form [name="password"]').value = 'secret123';

    document.getElementById('account-login-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();

    expect(global.fetch).toHaveBeenCalledWith('/auth/login', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ email: 'login@example.com', password: 'secret123' })
    }));
  });

  test('register form submits recovery question and answer', async () => {
    global.fetch = jest.fn((url) => {
      if (url === '/auth/me') return Promise.resolve({ ok: false, status: 401 });
      if (url === '/auth/register') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ user: { userId: 'user-register' } }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ favorites: [] }) });
    });
    const controller = new UserPanelController({ documentRef: document, storageService: {} });
    await controller.initialize();
    document.querySelector('#account-register-form [name="email"]').value = 'new@example.com';
    document.querySelector('#account-register-form [name="password"]').value = 'secret123';
    document.querySelector('#account-register-form [name="recoveryQuestion"]').value = 'City?';
    document.querySelector('#account-register-form [name="recoveryAnswer"]').value = 'Beijing';

    document.getElementById('account-register-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();

    expect(global.fetch).toHaveBeenCalledWith('/auth/register', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({
        email: 'new@example.com',
        password: 'secret123',
        recoveryQuestion: 'City?',
        recoveryAnswer: 'Beijing'
      })
    }));
  });

  test('forgot password loads recovery question and resets with answer', async () => {
    global.fetch = jest.fn((url) => {
      if (url === '/auth/me') return Promise.resolve({ ok: false, status: 401 });
      if (url === '/auth/password/recovery-question') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, recoveryQuestion: 'City?' }) });
      }
      if (url === '/auth/password/reset') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });
    const controller = new UserPanelController({ documentRef: document, storageService: {} });
    await controller.initialize();
    document.querySelector('#account-forgot-form [name="email"]').value = 'reset@example.com';
    document.querySelector('#account-forgot-form [name="recoveryAnswer"]').value = 'Beijing';
    document.querySelector('#account-forgot-form [name="newPassword"]').value = 'newsecret';

    await controller.loadRecoveryQuestion();
    expect(document.getElementById('account-recovery-question').textContent).toBe('City?');

    document.getElementById('account-forgot-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();

    expect(global.fetch).toHaveBeenCalledWith('/auth/password/reset', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ email: 'reset@example.com', recoveryAnswer: 'Beijing', newPassword: 'newsecret' })
    }));
  });
});
