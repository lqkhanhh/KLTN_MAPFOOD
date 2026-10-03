import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Tất cả API được giả lập; không đình chỉ quán thật trong kiểm thử trình duyệt.
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
const errors = [], mutations = [], calls = [];
let active = true, reason = null, failOverview = true, failSuspend = true, failUsers = true;
const shop = () => ({ id: 'shop', name: 'Quán kiểm thử', active, source: 'demo', suspendedReason: reason, owner: { fullName: 'Chủ quán thử nghiệm' } });
async function makePage(role) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  if (role) await context.addInitScript((role) => {
    localStorage.setItem('routebite_access_token', 'isolated-admin-test');
    localStorage.setItem('routebite_user', JSON.stringify({ role, fullName: 'Người kiểm thử' }));
  }, role);
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url()), path = url.pathname, method = route.request().method();
    if (url.port === '4173') return route.continue();
    calls.push(path + url.search);
    if (path === '/api/auth/login') return route.fulfill({ json: { accessToken: 'isolated-admin-test', user: { role: 'admin', fullName: 'Quản trị thử nghiệm' } } });
    if (path === '/api/notifications') return route.fulfill({ json: { notifications: [], unreadCount: 0 } });
    if (path === '/api/restaurants/mine') return route.fulfill({ json: [] });
    if (path === '/api/restaurants') return route.fulfill({ json: { data: active ? [{ ...shop(), rating: 4.8 }] : [], total: active ? 1 : 0 } });
    if (path === '/api/admin/dashboard/overview') {
      if (failOverview) { failOverview = false; return route.fulfill({ status: 500, json: { message: 'Lỗi tổng quan kiểm thử' } }); }
      return route.fulfill({ json: { usersByRole: [{ role: 'customer', count: 12 }, { role: 'merchant', count: 3 }, { role: 'admin', count: 1 }], totalRestaurants: 21, totalOrders: 50, gmv: 2500000, newUsersThisMonth: 4, topRestaurants: [{ id: 'shop', name: 'Quán kiểm thử', orderCount: 10 }] } });
    }
    if (path === '/api/admin/search-analytics') return route.fulfill({ json: { totalSearches: 25, popularOriginAreas: [{ latitude: 10.8, longitude: 106.7, count: 5 }] } });
    if (path === '/api/admin/restaurants') return route.fulfill({ json: { data: url.searchParams.get('page') === '2' ? [{ ...shop(), id: 'last', name: 'Quán trang sau' }] : [shop()], page: Number(url.searchParams.get('page')), limit: 20, total: 21 } });
    if (path === '/api/admin/restaurants/shop/suspend') {
      assert.equal(method, 'PATCH'); mutations.push(route.request().postDataJSON());
      if (failSuspend) { failSuspend = false; return route.fulfill({ status: 500, json: { message: 'Chưa lưu được quán kiểm thử' } }); }
      active = false; reason = route.request().postDataJSON().reason; return route.fulfill({ json: shop() });
    }
    if (path === '/api/admin/restaurants/shop/activate') { assert.equal(method, 'PATCH'); active = true; reason = null; return route.fulfill({ json: shop() }); }
    if (path === '/api/admin/users') {
      if (failUsers) { failUsers = false; return route.fulfill({ status: 500, json: { message: 'Lỗi người dùng kiểm thử' } }); }
      const filter = url.searchParams.get('role');
      const rows = [{ id: '1', fullName: 'Khách hàng A', email: 'a@example.invalid', role: 'customer' }, { id: '2', fullName: 'Chủ quán B', email: 'b@example.invalid', role: 'merchant' }];
      const data = filter ? rows.filter((user) => user.role === filter) : rows;
      return route.fulfill({ json: { data, page: Number(url.searchParams.get('page')), limit: 20, total: filter ? data.length : 22 } });
    }
    return route.abort();
  });
  return page;
}
try {
  for (const role of [null, 'customer', 'merchant']) {
    for (const target of ['overview', 'restaurants', 'users']) {
      const page = await makePage(role), before = calls.filter((path) => path.startsWith('/api/admin')).length;
      await page.goto('http://127.0.0.1:4173/admin/' + target);
      await page.waitForURL(role === 'merchant' ? '**/merchant/onboarding' : role === 'customer' ? 'http://127.0.0.1:4173/' : '**/login');
      assert.equal(await page.locator('.rb-admin-shell').count(), 0);
      assert.equal(calls.filter((path) => path.startsWith('/api/admin')).length, before);
      await page.context().close();
    }
  }
  const page = await makePage(null);
  await page.goto('http://127.0.0.1:4173/login');
  await page.getByLabel('Email', { exact: true }).fill('admin@example.invalid');
  await page.getByPlaceholder('Nhập mật khẩu').fill('test-only');
  await page.locator('.auth-form').getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.waitForURL('**/admin/overview');
  await page.getByRole('alert').filter({ hasText: 'Lỗi tổng quan kiểm thử' }).waitFor();
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await page.locator('.rb-admin-metrics').waitFor();
  assert.match(await page.locator('.rb-admin-metrics').textContent(), /2\.500\.000đ/);
  assert.equal(await page.locator('.rb-admin-metrics article').first().locator('strong').textContent(), '16');
  assert.equal(await page.locator('.consumer-header').count(), 0);
  const nav = page.getByRole('navigation', { name: 'Điều hướng admin' });
  assert.equal(await nav.getByRole('link').count(), 5);
  assert.equal(await nav.getByRole('link', { name: 'Voucher', exact: true }).getAttribute('href'), '/admin/vouchers');
  await nav.getByRole('link', { name: 'Quán ăn', exact: true }).click();
  await page.getByRole('button', { name: 'Trang sau' }).click();
  await page.getByText('Quán trang sau', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Trang trước' }).click();
  await page.getByRole('button', { name: 'Tạm ngưng', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận tạm ngưng' }).click();
  await page.getByRole('alert').filter({ hasText: 'từ 5 đến 500' }).waitFor();
  assert.equal(mutations.length, 0);
  await page.getByLabel('Lý do tạm ngưng (bắt buộc)').fill('  Kiểm thử kiểm duyệt quán  ');
  await page.getByRole('button', { name: 'Xác nhận tạm ngưng' }).click();
  await page.getByRole('alert').filter({ hasText: 'Chưa lưu được' }).waitFor();
  assert.match(await page.getByLabel('Lý do tạm ngưng (bắt buộc)').inputValue(), /Kiểm thử/);
  await page.getByRole('button', { name: 'Xác nhận tạm ngưng' }).click();
  await page.getByRole('button', { name: 'Kích hoạt lại', exact: true }).waitFor();
  assert.equal(mutations.at(-1).reason, 'Kiểm thử kiểm duyệt quán');
  const customer = await makePage('customer');
  await customer.goto('http://127.0.0.1:4173/');
  await customer.getByText('Chưa có quán công khai để hiển thị.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Kích hoạt lại', exact: true }).click();
  await page.getByRole('button', { name: 'Tạm ngưng', exact: true }).waitFor();
  await customer.reload(); await customer.getByText('Quán kiểm thử', { exact: true }).waitFor();
  await customer.context().close();
  for (const width of [1280, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No overflow ${width}`);
  }
  await page.getByRole('button', { name: 'Tạm ngưng', exact: true }).click();
  await page.keyboard.press('Escape'); assert.equal(await page.getByRole('dialog').count(), 0);
  await nav.getByRole('link', { name: 'Người dùng', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Lỗi người dùng' }).waitFor();
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await page.getByText('Khách hàng A', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Trang sau' }).click();
  await page.getByText(/Trang 2\/2/).waitFor();
  await page.getByRole('button', { name: 'Chủ quán', exact: true }).click();
  await page.getByText('Chủ quán B', { exact: true }).waitFor();
  assert.equal(await page.getByText('Khách hàng A', { exact: true }).count(), 0);
  assert.ok(calls.includes('/api/admin/users?page=1&limit=20&role=merchant'));
  await page.getByRole('button', { name: 'Quản trị viên', exact: true }).click();
  await page.getByText('Không có người dùng thuộc vai trò này.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await page.waitForURL('**/login');
  assert.equal(await page.evaluate(() => localStorage.getItem('routebite_access_token')), null);
  await page.goto('http://127.0.0.1:4173/admin/users'); await page.waitForURL('**/login');
  assert.deepEqual(errors, []);
  console.log('PASS: admin login/role guards across 3 routes, actual API shapes, retry, pagination, suspend validation/failure/success, activate/customer visibility, role filters, mobile and logout (mock APIs).');
} finally { await browser.close(); }
