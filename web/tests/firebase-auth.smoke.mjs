import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const fixturePath = resolve('tests/firebase-auth.fixture.js');
const bundle = await build({ entryPoints: ['src/entry.jsx'], bundle: true, write: false, format: 'iife', jsx: 'automatic', plugins: [{ name: 'firebase-test-adapter', setup(builder) {
  builder.onResolve({ filter: /utils\/firebaseAuth$/ }, args => args.importer === fixturePath ? undefined : { path: fixturePath });
} }] });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  let enabled = false, role = 'customer', collision = false;
  const calls = [];
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const payload = route.request().postDataJSON();
    if (payload) calls.push({ path, payload });
    if (path === '/api/auth/providers') return route.fulfill({ json: { config: enabled ? { projectId: 'test' } : null, providers: { google: enabled, apple: enabled, phone: enabled } } });
    if (path === '/api/auth/firebase' && collision) return route.fulfill({ status: 409, json: { message: 'Email đã có tài khoản. Hãy đăng nhập bằng mật khẩu để liên kết.' } });
    const user = { id: 'test-user', email: 'test@example.com', fullName: 'Test User', role, pointsBalance: 0, phone: '0901234567' };
    if (path === '/api/auth/login') return route.fulfill({ json: { requiresOtp: true, loginTicket: 'ticket-test', expiresIn: 300, retryAfter: 60 } });
    if (path === '/api/auth/email-otp/verify' || path === '/api/auth/firebase') return route.fulfill({ json: { accessToken: 'access-test', refreshToken: 'refresh-test', user } });
    if (path === '/api/auth/profile') return route.fulfill({ json: user });
    if (path === '/api/auth/firebase/status') return route.fulfill({ json: { linked: false, hasPassword: true } });
    if (path === '/api/auth/firebase/link') return route.fulfill({ json: { message: 'Đã liên kết tài khoản.' } });
    if (path === '/api/merchant-applications/me') return route.fulfill({ status: 404, json: { message: 'Not found' } });
    if (path === '/api/restaurants/mine') return route.fulfill({ json: [{ id: 'shop', name: 'Shop', active: true }] });
    if (path === '/api/notifications') return route.fulfill({ json: { notifications: [], unreadCount: 0 } });
    if (path === '/api/admin/dashboard/overview') return route.fulfill({ json: { usersByRole: [], topRestaurants: [] } });
    if (path === '/api/admin/search-analytics') return route.fulfill({ json: { totalSearches: 0, popularOriginAreas: [] } });
    if (path === '/api/restaurants/shop') return route.fulfill({ json: { id: 'shop', name: 'Shop', menuItems: [] } });
    if (path === '/api/restaurants') return route.fulfill({ json: { data: [], total: 0 } });
    return route.fulfill({ json: [] });
  });
  await page.goto('http://127.0.0.1:4173/login');
  await page.getByText('Google sẽ khả dụng', { exact: false }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Google', exact: true }).isDisabled(), true);
  await page.getByLabel('Email', { exact: true }).fill('test@example.com');
  await page.getByLabel('Mật khẩu', { exact: false }).first().fill('password');
  await page.locator('.auth-form').getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.getByLabel('Mã OTP email').fill('123456');
  assert.equal(await page.evaluate(() => localStorage.getItem('routebite_access_token')), null);
  await page.getByRole('button', { name: 'Xác minh và đăng nhập' }).click();
  await page.waitForURL('http://127.0.0.1:4173/');
  assert.equal(await page.evaluate(() => localStorage.getItem('routebite_refresh_token')), 'refresh-test');

  await page.route('**/app.js', route => route.fulfill({ contentType: 'application/javascript', body: bundle.outputFiles[0].text }));
  enabled = true;
  for (const [method, testRole, destination] of [['Google', 'customer', '/'], ['Google', 'merchant', '/merchant/dashboard'], ['Google', 'admin', '/admin/overview']]) {
    role = testRole;
    await page.evaluate(() => localStorage.clear());
    await page.goto('http://127.0.0.1:4173/login');
    await page.getByRole('button', { name: method, exact: true }).click();
    await page.waitForURL('http://127.0.0.1:4173' + destination);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('routebite_user')).role), testRole);
  }
  role = 'customer';
  await page.evaluate(() => localStorage.clear());
  await page.goto('http://127.0.0.1:4173/login');
  await page.evaluate(() => { window.__popupError = 'auth/popup-closed-by-user'; });
  await page.getByRole('button', { name: 'Google', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'đóng cửa sổ' }).waitFor();
  await page.evaluate(() => { window.__popupError = null; });
  collision = true;
  await page.getByRole('button', { name: 'Google', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Email đã có' }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('routebite_access_token')), null);
  collision = false;
  await page.getByRole('button', { name: 'Google', exact: true }).click();
  await page.waitForURL('http://127.0.0.1:4173/');
  await page.goto('http://127.0.0.1:4173/profile');
  await page.getByLabel('Mật khẩu hiện tại để liên kết').fill('existing-password');
  await page.getByRole('button', { name: /Google/, exact: false }).click();
  await page.getByText('Đã liên kết tài khoản.', { exact: true }).waitFor();
  assert.ok(calls.some(call => call.path === '/api/auth/firebase/link' && call.payload.password === 'existing-password'));
  await page.goto('http://127.0.0.1:4173/login');
  for (const width of [320, 375, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `overflow at ${width}`);
  }
  assert.deepEqual(errors, []);
  console.log('PASS: disabled production config, password login, Google role navigation, cancelled popup, collision, account link, responsive. Provider SDK was mocked; no real SMS or OAuth.');
} finally { await browser.close(); }
