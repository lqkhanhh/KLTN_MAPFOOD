import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext(); let page = await context.newPage();
  const errors = [], calls = []; let role = 'customer', refreshStatus = 200, refreshCalls = 0;
  context.on('page', p => p.on('pageerror', e => errors.push(e.message)));
  page.on('pageerror', e => errors.push(e.message));
  const user = () => ({ id: 'test-user', email: 'demo@example.com', fullName: 'OTP Test', role, phone: '0901234567' });
  const session = () => ({ accessToken: 'access-ok', refreshToken: 'refresh-ok', user: user() });
  await context.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname, body = route.request().postDataJSON();
    if (body) calls.push({ path, body });
    if (path === '/api/auth/providers') return route.fulfill({ json: { config: null, providers: { google: false } } });
    if (path === '/api/auth/login') return body.password === 'correct-password'
      ? route.fulfill({ json: { requiresOtp: true, loginTicket: 'ticket-test', expiresIn: 300, retryAfter: 60 } })
      : route.fulfill({ status: 401, json: { message: 'Email hoặc mật khẩu không đúng' } });
    if (path === '/api/auth/email-otp/resend') return route.fulfill({ json: { requiresOtp: true, loginTicket: 'ticket-resent', expiresIn: 300, retryAfter: 60 } });
    if (path === '/api/auth/email-otp/verify') return body.code === '123456'
      ? route.fulfill({ json: session() }) : route.fulfill({ status: 401, json: { message: 'Mã OTP không đúng hoặc đã hết hạn.' } });
    if (path === '/api/auth/profile') return route.request().headers().authorization === 'Bearer access-ok'
      ? route.fulfill({ json: user() }) : route.fulfill({ status: 401, json: { message: 'Expired' } });
    if (path === '/api/auth/refresh') { refreshCalls++; return route.fulfill({ status: refreshStatus, json: refreshStatus === 200 ? session() : { message: 'Refresh unavailable' } }); }
    if (path === '/api/auth/firebase/status') return route.fulfill({ json: { linked: false, hasPassword: true } });
    if (path === '/api/merchant-applications/me') return route.fulfill({ status: 404, json: {} });
    if (path === '/api/restaurants/mine') return route.fulfill({ json: [{ id: 'shop', name: 'Shop', active: true, menuItems: [] }] });
    if (path === '/api/restaurants/shop') return route.fulfill({ json: { id: 'shop', name: 'Shop', menuItems: [] } });
    if (path === '/api/admin/dashboard/overview') return route.fulfill({ json: { usersByRole: [], topRestaurants: [] } });
    if (path === '/api/admin/search-analytics') return route.fulfill({ json: { totalSearches: 0, popularOriginAreas: [] } });
    if (path === '/api/notifications') return route.fulfill({ json: { notifications: [], unreadCount: 0 } });
    if (path === '/api/restaurants') return route.fulfill({ json: { data: [], total: 0 } });
    return route.fulfill({ json: [] });
  });
  const start = async password => {
    await page.getByLabel('Email', { exact: true }).fill('demo@example.com');
    await page.getByLabel('Mật khẩu', { exact: false }).first().fill(password);
    await page.locator('.auth-form').getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  };
  await page.goto('http://127.0.0.1:4173/login');
  assert.equal(await page.getByRole('button', { name: 'Nhận mã OTP qua email' }).count(), 0);
  await start('wrong'); await page.getByRole('alert').filter({ hasText: 'mật khẩu không đúng' }).waitFor();
  assert.equal(await page.getByLabel('Mã OTP email').count(), 0);
  for (const [nextRole, destination] of [['customer', '/'], ['merchant', '/merchant/dashboard'], ['admin', '/admin/overview']]) {
    role = nextRole; await page.evaluate(() => localStorage.clear()); await page.goto('http://127.0.0.1:4173/login');
    await start('correct-password'); await page.getByLabel('Mã OTP email').waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('routebite_access_token')), null);
    assert.equal(await page.evaluate(() => JSON.stringify(localStorage).includes('ticket-test') || JSON.stringify(localStorage).includes('correct-password')), false);
    if (role === 'customer') {
      await page.getByLabel('Mã OTP email').fill('000000');
      await page.getByRole('button', { name: 'Xác minh và đăng nhập' }).click();
      await page.getByRole('alert').filter({ hasText: 'Mã OTP không đúng' }).waitFor();
      for (const width of [320, 375, 1440]) { await page.setViewportSize({ width, height: 1000 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); }
      await page.clock.install(); await page.clock.fastForward(61000);
      await page.getByRole('button', { name: 'Gửi lại mã OTP', exact: true }).click();
      await page.getByRole('button', { name: /Gửi lại sau/ }).waitFor();
    }
    await page.getByLabel('Mã OTP email').fill('123456'); await page.getByRole('button', { name: 'Xác minh và đăng nhập' }).click();
    await page.waitForURL('http://127.0.0.1:4173' + destination);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('routebite_user')).role), role);
  }
  role = 'customer';
  const sends = () => calls.filter(c => c.path === '/api/auth/login').length;
  const before = sends(); await page.close(); page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/profile'); await page.getByRole('heading', { name: 'Hồ sơ của bạn' }).waitFor();
  assert.equal(sends(), before); assert.equal(await page.evaluate(() => localStorage.getItem('routebite_access_token')), 'access-ok');
  await page.evaluate(() => localStorage.setItem('routebite_access_token', 'expired'));
  await page.reload(); await page.waitForFunction(() => localStorage.getItem('routebite_access_token') === 'access-ok');
  assert.ok(refreshCalls > 0); assert.equal(sends(), before);
  refreshStatus = 503; await page.evaluate(() => localStorage.setItem('routebite_access_token', 'expired'));
  const refreshBefore = refreshCalls; await page.reload(); await page.waitForResponse(r => r.url().endsWith('/auth/refresh'));
  assert.ok(refreshCalls > refreshBefore); assert.equal(await page.evaluate(() => localStorage.getItem('routebite_refresh_token')), 'refresh-ok');
  refreshStatus = 401; await page.reload(); await page.waitForURL('**/login');
  assert.equal(await page.evaluate(() => localStorage.getItem('routebite_refresh_token')), null);
  await start('correct-password'); await page.getByLabel('Mã OTP email').fill('123456');
  await page.getByRole('button', { name: 'Xác minh và đăng nhập' }).click(); await page.waitForURL('http://127.0.0.1:4173/');
  await page.locator('.profile-trigger').click(); await page.getByRole('menuitem', { name: 'Đăng xuất', exact: true }).click();
  await page.waitForURL('**/login'); assert.equal(await page.evaluate(() => localStorage.getItem('routebite_access_token')), null);
  await start('correct-password'); await page.getByLabel('Mã OTP email').waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('routebite_access_token')), null);
  assert.deepEqual(errors, []);
  console.log('PASS: password then OTP, wrong password/code, resend, no credentials persisted, three roles, reopen session, silent refresh, preserve session on network failure, expired refresh logout, logout then OTP required; HTTP fixtures, no emails sent.');
} finally { await browser.close(); }
