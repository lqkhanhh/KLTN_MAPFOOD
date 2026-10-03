import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage(); const errors = [], calls = [];
  let mode = 'duplicate';
  const user = { id: 'new-user', email: 'new@example.com', fullName: 'New Customer', role: 'customer' };
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname, body = route.request().postDataJSON();
    if (body) calls.push({ path, body });
    if (path === '/api/auth/register') {
      if (mode === 'duplicate') return route.fulfill({ status: 409, json: { message: 'Email đã tồn tại' } });
      if (mode === 'unavailable') return route.fulfill({ status: 503, json: { message: 'Chưa gửi được email xác minh.' } });
      return route.fulfill({ json: { requiresOtp: true, registrationTicket: 'encrypted-registration-fixture', expiresIn: 300, retryAfter: 60 } });
    }
    if (path === '/api/auth/register/resend') return route.fulfill({ json: { requiresOtp: true, registrationTicket: 'resent-registration-fixture', expiresIn: 300, retryAfter: 60 } });
    if (path === '/api/auth/register/verify') return body.code === '123456'
      ? route.fulfill({ json: { accessToken: 'new-access', refreshToken: 'new-refresh', user } })
      : route.fulfill({ status: 401, json: { message: 'Mã OTP không đúng hoặc đã hết hạn.' } });
    if (path === '/api/auth/profile') return route.fulfill({ json: user });
    if (path === '/api/restaurants') return route.fulfill({ json: { data: [], total: 0 } });
    if (path === '/api/notifications') return route.fulfill({ json: { notifications: [], unreadCount: 0 } });
    return route.fulfill({ json: [] });
  });
  const fill = async () => {
    await page.getByLabel('Họ và tên', { exact: true }).fill('New Customer');
    await page.getByLabel('Email', { exact: true }).fill('NEW@example.com');
    await page.getByLabel('Số điện thoại', { exact: false }).fill('0901234567');
    await page.getByLabel('Mật khẩu', { exact: true }).fill('registration-password');
    await page.getByLabel('Xác nhận mật khẩu', { exact: true }).fill('registration-password');
  };
  const submit = () => page.locator('.auth-form').getByRole('button', { name: 'Đăng ký', exact: true }).click();
  await page.goto('http://127.0.0.1:4173/register'); await fill(); await submit();
  await page.getByText('Email này đã được sử dụng.').waitFor();
  assert.equal(await page.getByLabel('Mã OTP email').count(), 0);
  mode = 'unavailable'; await submit(); await page.getByRole('alert').filter({ hasText: 'Chưa gửi được' }).waitFor();
  assert.equal(await page.getByText('Email này đã được sử dụng.').count(), 0);
  mode = 'ok'; await submit(); await page.getByLabel('Mã OTP email').waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('routebite_access_token')), null);
  assert.equal(await page.evaluate(() => JSON.stringify(localStorage).includes('registration-password') || JSON.stringify(localStorage).includes('encrypted-registration-fixture')), false);
  await page.getByLabel('Mã OTP email').fill('000000');
  await page.getByRole('button', { name: 'Xác minh và tạo tài khoản' }).click();
  await page.getByRole('alert').filter({ hasText: 'Mã OTP không đúng' }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('routebite_user')), null);
  assert.equal(await page.getByRole('button', { name: /Gửi lại sau/ }).isDisabled(), true);
  for (const width of [320, 375, 1440]) { await page.setViewportSize({ width, height: 1000 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); }
  await page.clock.install(); await page.clock.fastForward(61000);
  await page.getByRole('button', { name: 'Gửi lại mã OTP', exact: true }).click();
  await page.getByRole('button', { name: /Gửi lại sau/ }).waitFor();
  await page.getByLabel('Mã OTP email').fill('123456'); await page.getByRole('button', { name: 'Xác minh và tạo tài khoản' }).click();
  await page.waitForURL('http://127.0.0.1:4173/');
  assert.equal(await page.evaluate(() => localStorage.getItem('routebite_refresh_token')), 'new-refresh');
  assert.ok(calls.some(call => call.path === '/api/auth/register/verify' && call.body.registrationTicket === 'resent-registration-fixture'));
  await page.evaluate(() => localStorage.clear());
  await page.goto('http://127.0.0.1:4173/register'); await fill(); await submit();
  await page.getByLabel('Mã OTP email').waitFor(); await page.clock.fastForward(301000);
  await page.getByRole('alert').filter({ hasText: 'Phiên xác minh đã hết hạn' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Xác minh và tạo tài khoản' }).isDisabled(), true);
  await page.getByRole('button', { name: 'Sửa thông tin đăng ký' }).click();
  assert.equal(await page.getByLabel('Mật khẩu', { exact: true }).inputValue(), '');
  assert.equal(await page.getByLabel('Họ và tên', { exact: true }).inputValue(), 'New Customer');
  assert.deepEqual(errors, []);
  console.log('PASS: registration duplicate/send failure, OTP step, no premature session, wrong code, resend/new ticket, completion, expiry/edit, password cleared, 320/375/1440px. HTTP mocked; no real email.');
} finally { await browser.close(); }
